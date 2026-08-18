import crypto from 'crypto'
import { signSession, COOKIE_NAME, SESSION_COOKIE_OPTS } from '../middleware/adminAuth.js'
import { listApplications, getStats, getTopAssemblies, getReport, findApplicationById } from '../models/applicationModel.js'
import { findAdminByUsername, verifyPassword, updateAdminLastLogin } from '../models/adminUserModel.js'
import { isAppDbOnline, getAppDb } from '../config/db.js'
import { uploadToCloudinary } from '../services/cloudinaryService.js'

// Constant-time string compare to avoid leaking credential length/timing.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function postLogin(req, res) {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')

  // 1. Check MongoDB admin_users collection first (RBAC users)
  try {
    const dbAdmin = await findAdminByUsername(username)
    if (dbAdmin && dbAdmin.password_hash) {
      if (verifyPassword(password, dbAdmin.password_hash)) {
        await updateAdminLastLogin(username)
        const token = signSession({
          username: dbAdmin.username,
          role: dbAdmin.role || 'district_admin',
          assigned_district: dbAdmin.assigned_district || null,
        })
        res.cookie(COOKIE_NAME, token, SESSION_COOKIE_OPTS)
        return res.json({
          success: true,
          token,
          user: dbAdmin.username,
          role: dbAdmin.role || 'district_admin',
          assigned_district: dbAdmin.assigned_district || null,
          full_name: dbAdmin.full_name || '',
          message: 'Logged in successfully.',
        })
      }
    }
  } catch (err) {
    console.warn('[Admin Login DB Check]', err.message)
  }

  // 2. Fallback to ENV root super admin credentials
  const expectedUser = process.env.ADMIN_USERNAME || 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin'

  if (safeEqual(username, expectedUser) && safeEqual(password, expectedPass)) {
    const token = signSession({
      username,
      role: 'super_admin',
      assigned_district: null,
    })
    res.cookie(COOKIE_NAME, token, SESSION_COOKIE_OPTS)
    return res.json({
      success: true,
      token,
      user: username,
      role: 'super_admin',
      assigned_district: null,
      message: 'Logged in as Super Admin.',
    })
  }

  return res.status(401).json({ success: false, message: 'Invalid username or password.' })
}

export function getSession(req, res) {
  return res.json({
    success: true,
    user: req.admin?.u || null,
    role: req.admin?.role || 'district_admin',
    assigned_district: req.admin?.assigned_district || null,
  })
}

export function postLogout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...SESSION_COOKIE_OPTS, maxAge: undefined })
  return res.json({ success: true, message: 'Logged out.' })
}

export async function getDashboardStats(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  try {
    const [stats, topAssemblies] = await Promise.all([getStats(), getTopAssemblies(10)])
    return res.json({ success: true, ...stats, topAssemblies })
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load stats.' })
  }
}

export async function getApplications(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  try {
    let { search = '', page = 1, page_size = 20, district = '' } = req.query

    // If logged in as district_admin, enforce district scoping
    if (req.admin?.role === 'district_admin' && req.admin?.assigned_district) {
      district = req.admin.assigned_district
    }

    const db = getAppDb()
    const coll = db.collection('applications')
    const q = {}

    const term = String(search || '').trim()
    if (term) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      q.$or = [
        { application_id: { $regex: safe, $options: 'i' } },
        { mobile: { $regex: safe } },
        { membership_id: { $regex: safe, $options: 'i' } },
        { epic_no: { $regex: safe, $options: 'i' } },
        { 'voter.name': { $regex: safe, $options: 'i' } },
      ]
    }

    if (district && String(district).trim()) {
      const distSafe = String(district).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      q.$and = q.$and || []
      q.$and.push({
        $or: [
          { 'voter.district': { $regex: `^${distSafe}$`, $options: 'i' } },
          { 'voter.DISTRICT': { $regex: `^${distSafe}$`, $options: 'i' } },
          { 'local_body.district': { $regex: `^${distSafe}$`, $options: 'i' } },
        ]
      })
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const size = Math.min(100, Math.max(1, parseInt(page_size, 10) || 20))
    const skip = (pageNum - 1) * size

    const [rows, total] = await Promise.all([
      coll.find(q, { projection: { _id: 0 } }).sort({ submitted_at: -1 }).skip(skip).limit(size).toArray(),
      coll.countDocuments(q),
    ])

    return res.json({ success: true, applications: rows, total, page: pageNum, pageSize: size })
  } catch (err) {
    console.error('[Get Applications Error]', err)
    return res.status(500).json({ success: false, message: 'Could not load applications.' })
  }
}

export async function getReports(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  try {
    const { body_type, position, from, to, search, page = 1, page_size = 20 } = req.query
    const result = await getReport({
      bodyType: body_type, position, from, to, search,
      page, pageSize: page_size,
    })
    return res.json({ success: true, ...result })
  } catch {
    return res.status(500).json({ success: false, message: 'Could not load report.' })
  }
}

export async function getApplicationDetail(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  const app = await findApplicationById(req.params.id)
  if (!app) return res.status(404).json({ success: false, message: 'Application not found.' })

  try {
    const msg = await getAppDb().collection('organiser_messages').findOne({ application_id: app.application_id })
    if (msg) app.organiser_message = { text: msg.message, sent_at: msg.created_at }
  } catch (_) { /* non-fatal */ }

  return res.json({ success: true, application: app })
}

// ── FULL UPDATE Application (Super Admin & State Admin) ────────────
export async function updateApplication(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  const { id } = req.params
  const cleanId = String(id).trim().toUpperCase()
  const payload = req.body || {}

  try {
    const col = getAppDb().collection('applications')
    const updateDoc = {
      updated_at: new Date(),
      updated_by: req.admin?.u || 'admin',
    }

    if (payload.mobile) updateDoc.mobile = String(payload.mobile).replace(/\D/g, '').slice(-10)
    if (payload.membership_id) updateDoc.membership_id = String(payload.membership_id).trim()
    if (payload.epic_no) updateDoc.epic_no = String(payload.epic_no).trim().toUpperCase()
    if (payload.body_type) updateDoc.body_type = payload.body_type
    if (payload.status) updateDoc.status = payload.status

    if (payload.voter) {
      updateDoc['voter.name'] = payload.voter.name
      updateDoc['voter.gender'] = payload.voter.gender
      updateDoc['voter.age'] = payload.voter.age
      updateDoc['voter.district'] = payload.voter.district
      updateDoc['voter.assembly_name'] = payload.voter.assembly_name
      updateDoc['voter.relative_name'] = payload.voter.relative_name
    }

    if (payload.local_body) {
      updateDoc['local_body.district'] = payload.local_body.district
      updateDoc['local_body.local_body_type'] = payload.local_body.local_body_type
      updateDoc['local_body.local_body'] = payload.local_body.local_body
      updateDoc['local_body.ward'] = payload.local_body.ward
    }

    if (Array.isArray(payload.position_preferences)) {
      updateDoc.position_preferences = payload.position_preferences
    }

    if (payload.work_experience) updateDoc.work_experience = payload.work_experience
    if (payload.local_area_understanding) updateDoc.local_area_understanding = payload.local_area_understanding
    if (payload.ward_strategy) updateDoc.ward_strategy = payload.ward_strategy

    const result = await col.updateOne(
      { application_id: cleanId },
      { $set: updateDoc }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Application record not found.' })
    }

    return res.json({ success: true, message: 'Application updated successfully.' })
  } catch (err) {
    console.error('[Update Application Error]', err)
    return res.status(500).json({ success: false, message: 'Could not update application.' })
  }
}

// ── DELETE Application (Super Admin & State Admin Only) ───────────
export async function deleteApplication(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  const { id } = req.params
  const cleanId = String(id).trim().toUpperCase()

  try {
    const col = getAppDb().collection('applications')
    const result = await col.deleteOne({ application_id: cleanId })

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Application record not found.' })
    }

    return res.json({ success: true, message: `Application ${cleanId} deleted successfully.` })
  } catch (err) {
    console.error('[Delete Application Error]', err)
    return res.status(500).json({ success: false, message: 'Could not delete application.' })
  }
}

export async function updateApplicationPhoto(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  const { id } = req.params
  const file = req.file
  if (!file || !file.buffer || !file.buffer.length) {
    return res.status(400).json({ success: false, message: 'No image file received.' })
  }
  try {
    const uploadRes = await uploadToCloudinary({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: `bjp_localbody/admin_uploads`,
    })
    const photoUrl = uploadRes.url
    const col = getAppDb().collection('applications')
    const result = await col.updateOne(
      { application_id: id },
      { $set: { photo_url: photoUrl, updated_at: new Date() } }
    )
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Application record not found.' })
    }
    return res.json({ success: true, photo_url: photoUrl, message: 'Candidate photo updated successfully.' })
  } catch (err) {
    console.error('[Update Candidate Photo Error]', err)
    return res.status(500).json({ success: false, message: 'Could not upload candidate photo.' })
  }
}

export async function updateApplicationMembershipId(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  const { id } = req.params
  const membershipId = String(req.body?.membership_id || '').trim()
  if (!membershipId) {
    return res.status(400).json({ success: false, message: 'BJP Membership ID is required.' })
  }
  try {
    const col = getAppDb().collection('applications')
    const result = await col.updateOne(
      { application_id: String(id).toUpperCase() },
      { $set: { membership_id: membershipId, updated_at: new Date() } }
    )
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Application record not found.' })
    }
    return res.json({ success: true, membership_id: membershipId, message: 'BJP Membership ID updated successfully.' })
  } catch (err) {
    console.error('[Update Membership ID Error]', err)
    return res.status(500).json({ success: false, message: 'Could not update BJP Membership ID.' })
  }
}

// ── District Analytics for Tamil Nadu 3D Heatmap ──────────────────
export async function getDistrictAnalytics(req, res) {
  if (!isAppDbOnline()) return res.status(503).json({ success: false, message: 'Application database unavailable.' })
  try {
    const col = getAppDb().collection('applications')
    const pipeline = [
      {
        $project: {
          district: {
            $ifNull: ['$voter.district', { $ifNull: ['$voter.DISTRICT', '$local_body.district'] }]
          }
        }
      },
      {
        $match: {
          district: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$district',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]
    const rows = await col.aggregate(pipeline).toArray()
    const districtCounts = {}
    let total = 0
    rows.forEach(r => {
      if (r._id) {
        const cleanName = String(r._id).trim()
        districtCounts[cleanName] = (districtCounts[cleanName] || 0) + r.count
        total += r.count
      }
    })
    return res.json({ success: true, total_applications: total, district_counts: districtCounts })
  } catch (err) {
    console.error('[District Analytics Error]', err)
    return res.status(500).json({ success: false, message: 'Could not load district analytics.' })
  }
}
