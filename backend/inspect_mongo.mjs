import { MongoClient } from 'mongodb'
import https from 'https'

const RW_URI_SRV = 'mongodb+srv://sudhathiriller_db_user:j3c79W7qLGw6v2LV@cluster0.bsno3vx.mongodb.net/?appName=Cluster0'

async function resolveSrvViaDoH(hostname) {
  return new Promise((resolve, reject) => {
    https.get(`https://dns.google/resolve?name=${hostname}&type=SRV`, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const hosts = (json.Answer || []).filter(a => a.type === 33).map(a => {
            const parts = a.data.split(' ')
            return `${parts[3].replace(/\.$/, '')}:${parts[2]}`
          })
          resolve(hosts)
        } catch(e) { reject(e) }
      })
    }).on('error', reject)
  })
}

async function resolveTxtViaDoH(hostname) {
  return new Promise((resolve, reject) => {
    https.get(`https://dns.google/resolve?name=${hostname}&type=TXT`, (res) => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const txts = (json.Answer || []).filter(a => a.type === 16).map(a => a.data.replace(/"/g, ''))
          resolve(txts)
        } catch(e) { reject(e) }
      })
    }).on('error', reject)
  })
}

async function inspect() {
  console.log('🌐 Resolving SRV for READ-WRITE cluster (bsno3vx)...\n')

  const hosts = await resolveSrvViaDoH('_mongodb._tcp.cluster0.bsno3vx.mongodb.net')
  console.log('📡 Hosts:', hosts)

  const txts = await resolveTxtViaDoH('cluster0.bsno3vx.mongodb.net')
  console.log('📝 TXT:', txts)

  let replicaSet = 'atlas-shard-0'
  let authSource = 'admin'
  txts.forEach(t => {
    const rs = t.match(/replicaSet=([^&\s]+)/)
    if (rs) replicaSet = rs[1]
    const as = t.match(/authSource=([^&\s]+)/)
    if (as) authSource = as[1]
  })
  console.log(`\n🔁 ReplicaSet: ${replicaSet}`)
  console.log(`🔑 AuthSource: ${authSource}`)

  const DIRECT_URI = `mongodb://sudhathiriller_db_user:j3c79W7qLGw6v2LV@${hosts.join(',')}/?replicaSet=${replicaSet}&authSource=${authSource}&retryWrites=true&w=majority`

  const client = new MongoClient(DIRECT_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    tls: true,
    tlsInsecure: true,
    family: 4,
  })

  try {
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    console.log('\n✅ Connected to READ-WRITE cluster!\n')

    const adminDb = client.db().admin()
    const dbList = await adminDb.listDatabases()

    console.log('📦 DATABASES:')
    dbList.databases.forEach(db => {
      console.log(`   📁 ${db.name}  (${(db.sizeOnDisk / 1024).toFixed(1)} KB)`)
    })

    for (const dbInfo of dbList.databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue
      const db = client.db(dbInfo.name)
      const collections = await db.listCollections().toArray()
      if (!collections.length) continue

      console.log(`\n${'='.repeat(55)}`)
      console.log(`📂 DATABASE: ${dbInfo.name}`)
      console.log('='.repeat(55))

      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments()
        console.log(`\n  📋 Collection: "${col.name}" — ${count} records`)

        if (count > 0) {
          const docs = await db.collection(col.name).find({}).limit(3).toArray()
          docs.forEach((doc, i) => {
            console.log(`\n    ── Record ${i + 1} ──`)
            Object.keys(doc).slice(0, 18).forEach(k => {
              const v = doc[k]
              if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
                const sub = Object.keys(v).slice(0, 5).map(sk => `${sk}: ${String(v[sk]).substring(0, 30)}`).join(', ')
                console.log(`      ${k}: { ${sub} }`)
              } else if (Array.isArray(v)) {
                console.log(`      ${k}: [Array, ${v.length} items]`)
              } else {
                console.log(`      ${k}: ${String(v).substring(0, 100)}`)
              }
            })
          })
        } else {
          console.log('    (empty collection)')
        }
      }
    }
    console.log('\n\n🎯 Inspection Complete! Reply with which DB/collection to delete.')
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.close().catch(() => {})
  }
}

inspect().catch(console.error)
