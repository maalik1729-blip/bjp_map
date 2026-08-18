import https from 'https'
import fs from 'fs'

// Get admin_level=6 = Districts in TN (not taluks which are level 7 or 8)
const query = `[out:json][timeout:90];
area["name"="Tamil Nadu"]["admin_level"="4"]->.state;
(
  relation["admin_level"="5"]["boundary"="administrative"](area.state);
);
out geom;`

const encoded = encodeURIComponent(query)
const url = `https://overpass-api.de/api/interpreter?data=${encoded}`

console.log('Fetching TN DISTRICT boundaries (admin_level=5)...')

https.get(url, { headers: { 'User-Agent': 'BJP-App/1.0', 'Accept': 'application/json' } }, (res) => {
  console.log('Status:', res.statusCode)
  let data = ''
  res.on('data', d => { data += d; process.stdout.write('.') })
  res.on('end', () => {
    console.log('\nBytes:', data.length)
    try {
      const json = JSON.parse(data)
      console.log('Elements:', json.elements?.length)
      json.elements?.slice(0,5).forEach(el => console.log(' -', el.tags?.name, 'admin_level:', el.tags?.admin_level))
      
      if (json.elements?.length > 0) {
        const features = json.elements.map(el => {
          const name = el.tags?.name || 'Unknown'
          const members = el.members || []
          const outers = members.filter(m => m.role === 'outer' && m.geometry)
          
          let allCoords = []
          outers.forEach(m => {
            const ring = m.geometry.map(pt => [pt.lon, pt.lat])
            if (ring.length > 0) {
              if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) ring.push(ring[0])
              allCoords.push(ring)
            }
          })
          
          if (allCoords.length === 0) return null
          
          return {
            type: 'Feature',
            properties: { district: name },
            geometry: allCoords.length === 1
              ? { type: 'Polygon', coordinates: allCoords }
              : { type: 'MultiPolygon', coordinates: allCoords.map(r => [r]) }
          }
        }).filter(Boolean)
        
        console.log('Valid features:', features.length)
        features.forEach(f => console.log(' -', f.properties.district))
        
        const geojson = { type: 'FeatureCollection', features }
        fs.mkdirSync('public', { recursive: true })
        fs.writeFileSync('public/tn-districts.geojson', JSON.stringify(geojson))
        console.log('\n✅ Saved: public/tn-districts.geojson')
      }
    } catch(e) {
      console.error('Parse error:', e.message)
      console.log('Raw (first 300):', data.substring(0, 300))
    }
  })
}).on('error', e => console.error('Error:', e.message))
