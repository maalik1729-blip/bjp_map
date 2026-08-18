import { getAppDb, getVoterDb, isVoterDbOnline, getWardDb, isWardDbOnline } from '../config/db.js'

const COLLECTION = 'applications'

// Human-friendly application id: BJP-YYYY-XXXXXX (base36 random, uppercase)
export function generateApplicationId() {
  const year = new Date().getFullYear()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `BJP-${year}-${rand}`
}

// Insert one application; retries on the rare id collision.
export async function createApplication(doc) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const application_id = generateApplicationId()
    const now = new Date()
    const record = {
      application_id,
      status: 'submitted',
      submitted_at: now,
      ...doc,
    }
    try {
      await coll.insertOne(record)
      return { application_id, submitted_at: now }
    } catch (e) {
      // Duplicate key on application_id — try a fresh id
      if (e && e.code === 11000) continue
      throw e
    }
  }
  throw new Error('Could not allocate a unique application id.')
}

export async function findApplicationById(applicationId) {
  const db = getAppDb()
  const cleanId = String(applicationId).trim()
  return db.collection(COLLECTION).findOne(
    {
      $or: [
        { application_id: cleanId.toUpperCase() },
        { membership_id: cleanId },
        { mobile: cleanId },
      ]
    },
    { projection: { _id: 0 } }
  )
}

// Paginated + searchable list for the admin panel.
export async function listApplications({ search = '', page = 1, pageSize = 20 } = {}) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
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
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
  const skip = (pageNum - 1) * size
  const [rows, total] = await Promise.all([
    coll.find(q, { projection: { _id: 0 } }).sort({ submitted_at: -1 }).skip(skip).limit(size).toArray(),
    coll.countDocuments(q),
  ])
  return { applications: rows, total, page: pageNum, pageSize: size }
}

// Filtered report query for the admin Reports page.
// Filters: bodyType (rural|urban), position (matches any preference),
// from/to (submitted_at date range, inclusive), search (id/name/mobile/etc).
export async function getReport({ bodyType, position, from, to, search, page = 1, pageSize = 20 } = {}) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
  const q = {}

  if (bodyType === 'rural' || bodyType === 'urban') q.body_type = bodyType
  if (position && String(position).trim()) q.position_preferences = String(position).trim()

  const range = {}
  if (from) { const d = new Date(from); if (!Number.isNaN(d.getTime())) range.$gte = d }
  if (to) { const d = new Date(to); if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); range.$lte = d } }
  if (Object.keys(range).length) q.submitted_at = range

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

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  // Allow large page sizes so CSV export can fetch the full filtered set.
  const size = Math.min(5000, Math.max(1, parseInt(pageSize, 10) || 20))
  const skip = (pageNum - 1) * size
  const [rows, total] = await Promise.all([
    coll.find(q, { projection: { _id: 0 } }).sort({ submitted_at: -1 }).skip(skip).limit(size).toArray(),
    coll.countDocuments(q),
  ])
  return { applications: rows, total, page: pageNum, pageSize: size }
}

// Aggregate counts for the admin dashboard from real databases (DB1, DB2, DB3).
export async function getStats() {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
  // Start of today in IST (UTC+5:30) for accurate server timezone calculation
  const now = new Date()
  const istOffsetMs = 5.5 * 60 * 60 * 1000
  const istDate = new Date(now.getTime() + istOffsetMs)
  const startOfToday = new Date(Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate()) - istOffsetMs)

  const [total, rural, urban, today, allApps] = await Promise.all([
    coll.countDocuments({}),
    coll.countDocuments({ body_type: 'rural' }),
    coll.countDocuments({ body_type: 'urban' }),
    coll.countDocuments({ submitted_at: { $gte: startOfToday } }),
    coll.find({}, { projection: { 'voter.gender': 1 } }).toArray(),
  ])

  let maleCount = 0
  let femaleCount = 0
  let thirdGenderCount = 0

  for (const doc of allApps) {
    const g = String(doc.voter?.gender || '').trim().toUpperCase()
    if (g.includes('FEMALE') || g === 'F') {
      femaleCount += 1
    } else if (g.includes('MALE') || g === 'M') {
      maleCount += 1
    } else if (g) {
      thirdGenderCount += 1
    }
  }

  // Real dynamic counts from DB1 (voter_db), DB2 (ward_db), and DB3 (election_app)
  const voterDbStats = {
    assemblyCount: 0,
    corporationsCount: 0,
    municipalitiesCount: 0,
    townPanchayatsCount: 0,
    districtPanchayatsCount: 36,
    panchayatUnionsCount: 0,
    villagePanchayatsCount: 0,
    maleCandidates: maleCount,
    femaleCandidates: femaleCount,
    thirdGenderCandidates: thirdGenderCount,
  }

  if (isVoterDbOnline()) {
    try {
      const voterDb = getVoterDb()
      const cols = await voterDb.listCollections().toArray()
      const assCols = cols.filter((c) => c.name.startsWith('ass_'))
      voterDbStats.assemblyCount = assCols.length
    } catch (_) {}
  }

  if (isWardDbOnline()) {
    try {
      const wardDb = getWardDb()
      const [corps, munis, tps, unions, grams] = await Promise.all([
        wardDb.collection('corporations').countDocuments({}).catch(() => 0),
        wardDb.collection('municipalities').countDocuments({}).catch(() => 0),
        wardDb.collection('town_panchayats').countDocuments({}).catch(() => 0),
        wardDb.collection('panchayats_unions').countDocuments({}).catch(() => 0),
        wardDb.collection('grama_panchayats').countDocuments({}).catch(() => 0),
      ])
      voterDbStats.corporationsCount = corps
      voterDbStats.municipalitiesCount = munis
      voterDbStats.townPanchayatsCount = tps
      voterDbStats.panchayatUnionsCount = unions
      voterDbStats.villagePanchayatsCount = grams
    } catch (_) {}
  }

  return { total, rural, urban, today, voterDbStats }
}

// Top-N assemblies by number of submitted applications.
export async function getTopAssemblies(limit = 10) {
  const db = getAppDb()
  const coll = db.collection(COLLECTION)
  const rows = await coll.aggregate([
    { $match: { 'voter.assembly_no': { $ne: null } } },
    { $group: {
      _id: '$voter.assembly_no',
      name: { $first: '$voter.assembly_name' },
      count: { $sum: 1 },
    } },
    { $sort: { count: -1 } },
    { $limit: Math.max(1, Math.min(50, parseInt(limit, 10) || 10)) },
  ]).toArray()
  return rows.map((r) => ({
    assembly_no: r._id,
    assembly_name: r.name || '',
    count: r.count,
  }))
}

// Latest application for a given mobile number (used to detect repeat applicants).
export async function findLatestApplicationByMobile(mobile) {
  const db = getAppDb()
  const m = String(mobile || '').replace(/\D/g, '').slice(-10)
  if (!/^\d{10}$/.test(m)) return null
  return db.collection(COLLECTION).findOne(
    { mobile: m },
    { projection: { _id: 0 }, sort: { submitted_at: -1 } }
  )
}
