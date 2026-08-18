import { MongoClient } from 'mongodb'
import https from 'https'

// ── DNS-over-HTTPS helper (bypasses ISP DNS SRV block) ───────────
function dohFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { reject(e) } })
    }).on('error', reject)
  })
}

async function resolveAtlasUri(srvUri) {
  // Parse host from mongodb+srv://user:pass@hostname/...
  const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)/)
  if (!match) return srvUri // Not SRV, return as-is

  const [, user, pass, host] = match
  const dbPart = srvUri.match(/@[^/]+\/([^?]*)/)?.[1] || ''
  const queryPart = srvUri.match(/\?(.+)$/)?.[1] || ''

  try {
    // Resolve SRV records
    const srvData = await dohFetch(`https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`)
    const hosts = (srvData.Answer || [])
      .filter(a => a.type === 33)
      .map(a => { const p = a.data.split(' '); return `${p[3].replace(/\.$/, '')}:${p[2]}` })

    // Resolve TXT for replicaSet + authSource
    const txtData = await dohFetch(`https://dns.google/resolve?name=${host}&type=TXT`)
    const txt = (txtData.Answer || []).filter(a => a.type === 16).map(a => a.data.replace(/"/g, '')).join('&')

    const replicaSet = txt.match(/replicaSet=([^&\s]+)/)?.[1] || 'atlas-shard-0'
    const authSource = txt.match(/authSource=([^&\s]+)/)?.[1] || 'admin'

    const db = dbPart || ''
    const extra = queryPart ? `&${queryPart}` : ''
    const uri = `mongodb://${user}:${pass}@${hosts.join(',')}/${db}?replicaSet=${replicaSet}&authSource=${authSource}&retryWrites=true&w=majority${extra}`
    console.log(`[db] SRV resolved for ${host} → ${hosts.length} hosts, replicaSet=${replicaSet}`)
    return uri
  } catch (e) {
    console.warn(`[db] DoH SRV resolve failed for ${host}: ${e.message} — using original URI`)
    return srvUri
  }
}

// ── DB connections ────────────────────────────────────────────────
let voterClient, wardClient, appClient
let voterDb = null
let wardDb = null
let appDb = null

export async function connectDbs() {
  const voterUrl = process.env.MONGO_VOTER_URL || process.env.VOTER_DB_URI
  const voterDbName = process.env.MONGO_VOTER_DB_NAME || 'voter_db'

  const wardUrl = process.env.MONGO_WARD_URL || process.env.WARD_DB_URI
  const wardDbName = process.env.MONGO_WARD_DB_NAME || 'ward_db'

  const appUrl = process.env.MONGO_APP_URL
  const appDbName = process.env.MONGO_APP_DB_NAME || 'bjp_localbody'

  if (!appUrl) {
    console.warn('[db] MONGO_APP_URL not set — app db will be offline')
  }

  const MONGO_OPTS = {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    tls: true,
    tlsInsecure: true,
    family: 4,
  }

  // ── Voter DB (read-only) ──────────────────────────────────────
  if (voterUrl) {
    try {
      const resolvedVoterUrl = await resolveAtlasUri(voterUrl)
      voterClient = new MongoClient(resolvedVoterUrl, MONGO_OPTS)
      await voterClient.connect()
      voterDb = voterClient.db(voterDbName)
      console.log(`[db] voter_db connected (${voterDbName}) — read only`)
    } catch (e) {
      console.warn(`[db] voter_db connection failed: ${e.message} (voter lookup will report offline)`)
      voterDb = null
    }
  }

  // ── Ward DB (optional, read-only) ────────────────────────────
  if (wardUrl) {
    try {
      const resolvedWardUrl = await resolveAtlasUri(wardUrl)
      wardClient = new MongoClient(resolvedWardUrl, MONGO_OPTS)
      await wardClient.connect()
      wardDb = wardClient.db(wardDbName)
      console.log(`[db] ward_db connected (${wardDbName}) — read only`)
    } catch (e) {
      console.warn(`[db] ward_db connection failed: ${e.message}`)
      wardDb = null
    }
  }

  // ── App DB (read/write) ──────────────────────────────────────
  if (appUrl) {
    try {
      const resolvedAppUrl = await resolveAtlasUri(appUrl)
      appClient = new MongoClient(resolvedAppUrl, MONGO_OPTS)
      await appClient.connect()
      appDb = appClient.db(appDbName)
      try {
        await appDb.collection('applications').createIndex({ application_id: 1 }, { unique: true })
        await appDb.collection('applications').createIndex({ mobile: 1 })
      } catch (_) { /* index best-effort */ }
      console.log(`[db] app db connected (${appDbName})`)
    } catch (e) {
      console.warn(`[db] app db connection failed: ${e.message}`)
      appDb = null
    }
  }
}

export function getVoterDb() {
  if (!voterDb) throw new Error('VOTER_DB_OFFLINE')
  return voterDb
}
export function isVoterDbOnline() { return !!voterDb }

export function getWardDb() {
  if (!wardDb) throw new Error('WARD_DB_OFFLINE')
  return wardDb
}
export function isWardDbOnline() { return !!wardDb }

export function getAppDb() {
  if (!appDb) throw new Error('APP_DB_OFFLINE')
  return appDb
}
export function isAppDbOnline() { return !!appDb }

export async function closeDbs() {
  await voterClient?.close().catch(() => {})
  await wardClient?.close().catch(() => {})
  await appClient?.close().catch(() => {})
}

