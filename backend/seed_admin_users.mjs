import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import https from 'https'

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
  const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)/)
  if (!match) return srvUri
  const [, user, pass, host] = match
  const dbPart = srvUri.match(/@[^/]+\/([^?]*)/)?.[1] || ''
  const queryPart = srvUri.match(/\?(.+)$/)?.[1] || ''

  try {
    const srvData = await dohFetch(`https://dns.google/resolve?name=_mongodb._tcp.${host}&type=SRV`)
    const hosts = (srvData.Answer || []).filter(a => a.type === 33).map(a => {
      const p = a.data.split(' ')
      return `${p[3].replace(/\.$/, '')}:${p[2]}`
    })
    const txtData = await dohFetch(`https://dns.google/resolve?name=${host}&type=TXT`)
    const txt = (txtData.Answer || []).filter(a => a.type === 16).map(a => a.data.replace(/"/g, '')).join('&')
    const replicaSet = txt.match(/replicaSet=([^&\s]+)/)?.[1] || 'atlas-shard-0'
    const authSource = txt.match(/authSource=([^&\s]+)/)?.[1] || 'admin'
    const db = dbPart || ''
    const extra = queryPart ? `&${queryPart}` : ''
    return `mongodb://${user}:${pass}@${hosts.join(',')}/${db}?replicaSet=${replicaSet}&authSource=${authSource}&retryWrites=true&w=majority${extra}`
  } catch (e) {
    return srvUri
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(String(password), salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

const ADMIN_ACCOUNTS = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'super_admin',
    assigned_district: null,
    full_name: 'BJP State President / General Secretary',
    email: 'admin.tn@bjp.org',
    mobile: '9840012345',
  },
  {
    username: 'state_admin',
    password: 'state123',
    role: 'state_admin',
    assigned_district: null,
    full_name: 'State Election Coordinator',
    email: 'state.election@bjp.org',
    mobile: '9840054321',
  },
  {
    username: 'chennai_admin',
    password: 'chennai123',
    role: 'district_admin',
    assigned_district: 'Chennai',
    full_name: 'Chennai District President',
    email: 'chennai@bjp.org',
    mobile: '9840111111',
  },
  {
    username: 'coimbatore_admin',
    password: 'coimbatore123',
    role: 'district_admin',
    assigned_district: 'Coimbatore',
    full_name: 'Coimbatore District President',
    email: 'coimbatore@bjp.org',
    mobile: '9840222222',
  },
  {
    username: 'madurai_admin',
    password: 'madurai123',
    role: 'district_admin',
    assigned_district: 'Madurai',
    full_name: 'Madurai District President',
    email: 'madurai@bjp.org',
    mobile: '9840333333',
  },
  {
    username: 'salem_admin',
    password: 'salem123',
    role: 'district_admin',
    assigned_district: 'Salem',
    full_name: 'Salem District President',
    email: 'salem@bjp.org',
    mobile: '9840444444',
  },
]

async function seed() {
  const rawUrl = 'mongodb+srv://sudhathiriller_db_user:j3c79W7qLGw6v2LV@cluster0.bsno3vx.mongodb.net/?appName=Cluster0'
  console.log('🔗 Resolving connection string...')
  const resolvedUrl = await resolveAtlasUri(rawUrl)

  const client = new MongoClient(resolvedUrl, {
    serverSelectionTimeoutMS: 15000,
    tls: true,
    tlsInsecure: true,
    family: 4,
  })

  try {
    await client.connect()
    console.log('✅ Connected to MongoDB Atlas (bjp_localbody)!')

    const db = client.db('bjp_localbody')
    const col = db.collection('admin_users')

    // Create unique index on username
    await col.createIndex({ username: 1 }, { unique: true }).catch(() => {})

    console.log('Seeding Multi-Tier RBAC admin accounts...')
    for (const acc of ADMIN_ACCOUNTS) {
      const doc = {
        username: acc.username,
        password_hash: hashPassword(acc.password),
        role: acc.role,
        assigned_district: acc.assigned_district,
        full_name: acc.full_name,
        email: acc.email,
        mobile: acc.mobile,
        is_active: true,
        created_at: new Date(),
        last_login: null,
      }
      await col.updateOne({ username: acc.username }, { $set: doc }, { upsert: true })
      console.log(`  ✅ [${acc.role.toUpperCase()}] User: ${acc.username} | Pass: ${acc.password} | Scope: ${acc.assigned_district || 'State-Wide'}`)
    }

    console.log('\n🎉 Admin RBAC accounts successfully seeded into admin_users!')
  } catch (err) {
    console.error('❌ Error during admin seeding:', err)
  } finally {
    await client.close()
  }
}

seed()
