import https from 'https'
import fs from 'fs'
import osmtogeojson from 'osmtogeojson'
import { DOMParser } from '@xmldom/xmldom'

const query = `[timeout:90];
area["name"="Tamil Nadu"]["admin_level"="4"]->.state;
(
  relation["admin_level"="5"]["boundary"="administrative"](area.state);
);
out body;
>;
out skel qt;`

const encoded = encodeURIComponent(query)
const url = `https://overpass.kumi.systems/api/interpreter?data=${encoded}`

console.log('Fetching Overpass XML from mirror...')

https.get(url, { headers: { 'User-Agent': 'BJP-App/1.0' } }, (res) => {
  let data = ''
  res.on('data', d => data += d)
  res.on('end', () => {
    try {
      console.log('Received XML data length:', data.length)
      const doc = new DOMParser().parseFromString(data, 'text/xml')
      const geojson = osmtogeojson(doc)

      geojson.features = geojson.features
        .filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
        .map(f => {
          const name = f.properties?.tags?.name || f.properties?.name || 'District'
          return {
            type: 'Feature',
            properties: {
              district: name.replace(/\s+district$/i, '').trim(),
            },
            geometry: f.geometry,
          }
        })

      console.log('Valid district features:', geojson.features.length)
      geojson.features.forEach((f, i) => console.log(`${i+1}. ${f.properties.district} (${f.geometry.type})`))

      if (geojson.features.length > 0) {
        fs.writeFileSync('public/tn-districts.geojson', JSON.stringify(geojson))
        console.log('✅ Wrote valid GeoJSON to public/tn-districts.geojson')
      }
    } catch (e) {
      console.error('Error:', e)
    }
  })
}).on('error', console.error)
