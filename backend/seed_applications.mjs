import { MongoClient } from 'mongodb'
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

// 15 Sample Districts with application counts and candidate names
const SEED_DISTRICTS = [
  { name: 'Chennai', count: 68, assemblies: ['Thiru-Vi-Ka-Nagar', 'Royapuram', 'Harbour', 'Mylapore', 'Velachery'] },
  { name: 'Coimbatore', count: 54, assemblies: ['Coimbatore South', 'Coimbatore North', 'Singanallur', 'Pollachi'] },
  { name: 'Madurai', count: 48, assemblies: ['Madurai North', 'Madurai South', 'Madurai Central', 'Thiruparankundram'] },
  { name: 'Salem', count: 42, assemblies: ['Salem North', 'Salem South', 'Salem West', 'Edappadi'] },
  { name: 'Tiruchirappalli', count: 36, assemblies: ['Tiruchirappalli East', 'Tiruchirappalli West', 'Srirangam'] },
  { name: 'Tirunelveli', count: 32, assemblies: ['Tirunelveli', 'Palayamkottai', 'Ambasamudram'] },
  { name: 'Thiruvallur', count: 30, assemblies: ['Thiruvallur', 'Gummidipoondi', 'Ponneri', 'Poonamallee'] },
  { name: 'Kanyakumari', count: 28, assemblies: ['Kanyakumari', 'Nagercoil', 'Colachel', 'Killiyoor'] },
  { name: 'Erode', count: 25, assemblies: ['Erode East', 'Erode West', 'Modakkurichi', 'Gobichettipalayam'] },
  { name: 'Thanjavur', count: 22, assemblies: ['Thanjavur', 'Kumbakonam', 'Papanasam', 'Pattukkottai'] },
  { name: 'Kanchipuram', count: 20, assemblies: ['Kanchipuram', 'Sriperumbudur', 'Uthiramerur'] },
  { name: 'Chengalpattu', count: 18, assemblies: ['Chengalpattu', 'Tambaram', 'Pallavaram', 'Cheyyur'] },
  { name: 'Vellore', count: 16, assemblies: ['Vellore', 'Katpadi', 'Anaikattu'] },
  { name: 'Dindigul', count: 14, assemblies: ['Dindigul', 'Palani', 'Athoor', 'Natham'] },
  { name: 'Thoothukudi', count: 12, assemblies: ['Thoothukkudi', 'Tiruchendur', 'Kovilpatti', 'Vilathikulam'] },
]

const SAMPLE_NAMES = [
  'K. Sundaram', 'P. Ramesh', 'S. Meenakshi', 'M. Annamalai', 'R. Vijayakumar',
  'T. Saravanan', 'G. Balaji', 'K. Lakshmi', 'V. Karthik', 'N. Radhakrishnan',
  'P. Sangeetha', 'D. Manikandan', 'S. Arumugam', 'M. Kavitha', 'A. Jeyachandran',
  'B. Muthukumar', 'C. Sivakumar', 'E. Rajesh', 'J. Jayashree', 'S. Prakash'
]

const POSITIONS = [
  'Ward Councillor', 'Municipal Chairman', 'Town Panchayat President',
  'District Panchayat Member', 'Panchayat Union Councillor', 'Mayor'
]

function generateAppId(year = 2026) {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `BJP-${year}-${rand}`
}

function randomMobile() {
  const prefixes = ['98', '99', '94', '97', '96', '93', '70', '80', '91']
  const p = prefixes[Math.floor(Math.random() * prefixes.length)]
  const rest = Math.floor(10000000 + Math.random() * 90000000).toString().substring(0, 8)
  return `${p}${rest}`
}

function randomEpic(dist) {
  const prefix = dist.substring(0, 3).toUpperCase()
  const num = Math.floor(1000000 + Math.random() * 9000000)
  return `${prefix}${num}`
}

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
    const col = db.collection('applications')

    const seedRecords = []
    let totalGenerated = 0

    for (const dist of SEED_DISTRICTS) {
      for (let i = 0; i < dist.count; i++) {
        const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)]
        const assembly = dist.assemblies[Math.floor(Math.random() * dist.assemblies.length)]
        const position = POSITIONS[Math.floor(Math.random() * POSITIONS.length)]
        const isUrban = Math.random() > 0.4
        const gender = Math.random() > 0.45 ? 'Male' : 'Female'
        const daysAgo = Math.floor(Math.random() * 14)
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 3600000)

        seedRecords.push({
          application_id: generateAppId(2026),
          status: 'submitted',
          submitted_at: date,
          mobile: randomMobile(),
          membership_id: `BJP-TN-${Math.floor(100000 + Math.random() * 900000)}`,
          epic_no: randomEpic(dist.name),
          body_type: isUrban ? 'urban' : 'rural',
          voter: {
            name: `${name} (${dist.name})`,
            district: dist.name,
            assembly_name: assembly,
            gender: gender,
            age: Math.floor(28 + Math.random() * 35),
          },
          local_body: {
            type: isUrban ? 'urban' : 'rural',
            district: dist.name,
            local_body_type: isUrban ? 'Municipality' : 'Panchayat Union',
            local_body: `${dist.name} Zone ${Math.floor(1 + Math.random() * 5)}`,
            ward: Math.floor(1 + Math.random() * 60),
          },
          position_preferences: [position],
          social_media: {
            facebook: `https://facebook.com/bjp.${name.toLowerCase().replace(/[^a-z]/g, '')}`,
            twitter: `https://x.com/bjp_${dist.name.toLowerCase()}`,
          },
          work_experience: `Dedicated grassroots worker in ${dist.name} district with 5+ years of active public service for BJP Tamil Nadu.`,
          local_area_understanding: `Well versed with civic challenges, infrastructure and local governance issues in ${dist.name} district.`,
          ward_strategy: `Door-to-door public connect, booth-level committee empowerment, and social media outreach in ${dist.name}.`,
        })
        totalGenerated++
      }
    }

    console.log(`Inserting ${totalGenerated} candidate applications across ${SEED_DISTRICTS.length} districts...`)
    const result = await col.insertMany(seedRecords)
    console.log(`🎉 Successfully inserted ${result.insertedCount} seed applications!`)

    // Verify district aggregation
    const pipeline = [
      { $group: { _id: '$voter.district', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]
    const agg = await col.aggregate(pipeline).toArray()
    console.log('\n📊 Updated District Distribution:')
    agg.forEach(a => console.log(`  - ${a._id}: ${a.count} applications`))

  } catch (err) {
    console.error('❌ Error during seeding:', err)
  } finally {
    await client.close()
  }
}

seed()
