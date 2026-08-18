import crypto from 'crypto'
import { signSession, COOKIE_NAME, SESSION_COOKIE_OPTS } from '../middleware/adminAuth.js'
import { listApplications, getStats, getTopAssemblies, getReport, findApplicationById } from '../models/applicationModel.js'
import { isAppDbOnline, getAppDb } from '../config/db.js'
import { uploadToCloudinary } from '../services/cloudinaryService.js'

// Constant-time string compare to avoid leaking credential length/timing.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function postLogin(req, res) {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '')
  const expectedUser = process.env.ADMIN_USERNAME || 'admin'
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin'

  if (safeEqual(username, expectedUser) && safeEqual(password, expectedPass)) {
    const token = signSession(username)
    // Set a cookie for same-origin setups AND return the token for cross-domain
    // (Vercel <-> Render) where third-party cookies are blocked.
    res.cookie(COOKIE_NAME, token, SESSION_COOKIE_OPTS)
    return res.json({ success: true, token, message: 'Logged in.' })
  }
  return res.status(401).json({ success: false, message: 'Invalid username or password.' })
}

export function getSession(req, res) {
  return res.json({ success: true, user: req.admin?.u || null })
}

export function postLogout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...SESSION_COOKIE_OPTS, maxAge: undefined })
  return res.json({ success: true })
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
    const { search = '', page = 1, page_size = 20 } = req.query
    const result = await listApplications({ search, page, pageSize: page_size })
    return res.json({ success: true, ...result })
  } catch {
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

  // Attach the one-time organiser message (stored in its own collection) in the
  // shape the admin detail page expects: { text, sent_at }.
  try {
    const msg = await getAppDb().collection('organiser_messages').findOne({ application_id: app.application_id })
    if (msg) app.organiser_message = { text: msg.message, sent_at: msg.created_at }
  } catch (_) { /* non-fatal — detail still renders without the message */ }

  return res.json({ success: true, application: app })
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

// ── District Analytics for Tamil Nadu Leaflet Heatmap ──────────────
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
        // Normalize key to Title Case for clean presentation
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
