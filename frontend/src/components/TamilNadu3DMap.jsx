import { useEffect, useRef, useState, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../styles/tn-map.css'

// ── District name normalizer ─────────────────────────────────────
function normalizeName(name = '') {
  return name.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace('the nilgiris', 'nilgiris')
    .replace('kanniyakumari', 'kanyakumari')
    .replace('sivagangai', 'sivaganga')
    .replace('thiruvarur', 'tiruvarur')
    .replace('kanchipuram', 'kancheepuram')
}

function buildLookup(districtCounts) {
  const map = {}
  Object.entries(districtCounts).forEach(([k, v]) => { map[normalizeName(k)] = v })
  return map
}

// Height in meters for 3D extrusion — minimum 15,000m so all districts have 3D block thickness
function getExtrusionHeight(count) {
  const base = 15000 // 15km baseline 3D height so every district stands out in 3D
  if (!count || count === 0) return base
  return Math.min(base + count * 1200, 250000)
}

function getExtrusionColor(count) {
  if (!count || count === 0) return '#fcead9'
  if (count >= 500) return '#f76201'
  if (count >= 300) return '#ff7a1a'
  if (count >= 150) return '#ff9944'
  if (count >= 50)  return '#ffb87a'
  return '#ffd4aa'
}

export default function TamilNadu3DMap({ districtCounts = {}, selectedDistrict, onSelectDistrict }) {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, district: '', count: 0 })
  const [is3D, setIs3D] = useState(true)

  const buildGeoJsonData = useCallback((geoData) => {
    const lookup = buildLookup(districtCounts)
    return {
      ...geoData,
      features: geoData.features.map(f => {
        const name = f.properties?.district || ''
        const key = normalizeName(name)
        const count = lookup[key] || 0
        return {
          ...f,
          properties: {
            ...f.properties,
            count,
            color: getExtrusionColor(count),
            height: getExtrusionHeight(count),
            base_height: 0,
          },
        }
      }),
    }
  }, [districtCounts])

  useEffect(() => {
    if (mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'basemap': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#f8f4ee' },
          },
          {
            id: 'basemap-layer',
            type: 'raster',
            source: 'basemap',
            paint: {
              'raster-opacity': 0.2,
              'raster-saturation': -0.7,
              'raster-brightness-max': 0.95,
            },
          },
        ],
      },
      center: [78.6, 11.0],
      zoom: 6.4,
      pitch: 45,       // 3D tilt angle
      bearing: -8,     // Slight angle
      antialias: true,
    })

    mapRef.current = map

    map.on('load', async () => {
      let geoData
      try {
        const res = await fetch('/tn-districts.geojson')
        if (!res.ok) throw new Error('GeoJSON not found')
        geoData = await res.json()
      } catch {
        setStatus('error')
        return
      }

      const enriched = buildGeoJsonData(geoData)

      map.addSource('tn-districts', {
        type: 'geojson',
        data: enriched,
      })

      // ── 3D EXTRUSION layer ────────────────────────────────────
      map.addLayer({
        id: 'districts-3d',
        type: 'fill-extrusion',
        source: 'tn-districts',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      })

      // Auto-fit to Tamil Nadu bounds
      try {
        const bounds = new maplibregl.LngLatBounds()
        geoData.features.forEach(f => {
          const type = f.geometry.type
          const coords = f.geometry.coordinates
          if (type === 'Polygon') {
            coords[0].forEach(pt => bounds.extend(pt))
          } else if (type === 'MultiPolygon') {
            coords.forEach(poly => poly[0].forEach(pt => bounds.extend(pt)))
          }
        })
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 30, pitch: 45, bearing: -8 })
        }
      } catch (_) {}

      // ── Selected district highlight ───────────────────────────
      map.addLayer({
        id: 'districts-selected',
        type: 'fill-extrusion',
        source: 'tn-districts',
        filter: ['==', ['get', 'district'], selectedDistrict || '__none__'],
        paint: {
          'fill-extrusion-color': '#7a2e00',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
        },
      })

      // ── Mouse hover ───────────────────────────────────────────
      map.on('mousemove', 'districts-3d', (e) => {
        if (!e.features?.length) return
        map.getCanvas().style.cursor = 'pointer'
        const feature = e.features[0]
        const name = feature.properties?.district || ''
        const count = feature.properties?.count || 0
        const rect = mapContainer.current.getBoundingClientRect()
        setTooltip({
          visible: true,
          x: e.point.x + 14,
          y: e.point.y - 60,
          district: name,
          count,
        })
      })

      map.on('mouseleave', 'districts-3d', () => {
        map.getCanvas().style.cursor = ''
        setTooltip(prev => ({ ...prev, visible: false }))
      })

      // ── Click to select ───────────────────────────────────────
      map.on('click', 'districts-3d', (e) => {
        if (!e.features?.length) return
        const name = e.features[0].properties?.district || ''
        if (onSelectDistrict) {
          onSelectDistrict(normalizeName(name) === normalizeName(selectedDistrict || '') ? '' : name)
        }
      })

      map.on('click', (e) => {
        // Click on empty area — deselect
        const features = map.queryRenderedFeatures(e.point, { layers: ['districts-3d'] })
        if (!features.length && onSelectDistrict) onSelectDistrict('')
      })

      setStatus('ready')
    })

    map.on('error', () => setStatus('error'))

    // Navigation controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update data when districtCounts changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return
    const source = map.getSource('tn-districts')
    if (!source) return

    fetch('/tn-districts.geojson')
      .then(r => r.json())
      .then(geoData => {
        source.setData(buildGeoJsonData(geoData))
      })
      .catch(() => {})
  }, [districtCounts, status, buildGeoJsonData])

  // Update selected district highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || status !== 'ready') return
    if (map.getLayer('districts-selected')) {
      map.setFilter('districts-selected', ['==', ['get', 'district'], selectedDistrict || '__none__'])
    }
  }, [selectedDistrict, status])

  // Toggle 3D/2D
  const toggle3D = () => {
    const map = mapRef.current
    if (!map) return
    const newIs3D = !is3D
    setIs3D(newIs3D)
    map.easeTo({ pitch: newIs3D ? 45 : 0, bearing: newIs3D ? -10 : 0, duration: 600 })
  }

  return (
    <div className="tn-map-wrapper" style={{ height: 520 }}>
      {/* Loading */}
      {status === 'loading' && (
        <div className="tn-map-loading">
          <div className="tn-map-spinner" />
          <span>Loading 3D Tamil Nadu Map…</span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="tn-map-loading">
          <span style={{ fontSize: 32 }}>🗺️</span>
          <span style={{ color: '#c45200' }}>Map unavailable</span>
        </div>
      )}

      {/* MapLibre container */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Tooltip */}
      {tooltip.visible && (
        <div className="tn-map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tn-tooltip-district">📍 {tooltip.district}</div>
          <div className="tn-tooltip-count">
            <span className="tn-tooltip-num">{tooltip.count.toLocaleString()}</span>
            <span className="tn-tooltip-label"> applications</span>
          </div>
          {tooltip.count > 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
              Height: {(tooltip.count * 800 / 1000).toFixed(0)}km
            </div>
          )}
          {tooltip.count === 0 && <div className="tn-tooltip-empty">No applications yet</div>}
        </div>
      )}

      {/* 2D/3D Toggle button */}
      <button className="tn-3d-toggle" onClick={toggle3D}>
        {is3D ? '2D' : '3D'}
      </button>

      {/* Legend */}
      <div className="tn-map-legend">
        <div className="tn-legend-title">Applications</div>
        {[
          { color: '#f76201', label: '500+' },
          { color: '#ff7a1a', label: '300–499' },
          { color: '#ff9944', label: '150–299' },
          { color: '#ffb87a', label: '50–149' },
          { color: '#ffd4aa', label: '1–49' },
          { color: '#fde8d8', label: 'None' },
        ].map(({ color, label }) => (
          <div key={label} className="tn-legend-row">
            <span className="tn-legend-dot" style={{ background: color }} />
            <span className="tn-legend-text">{label}</span>
          </div>
        ))}
        <div style={{ fontSize: 9, color: '#c0bbb6', marginTop: 6, lineHeight: 1.4 }}>
          ↑ Height = Application count
        </div>
      </div>

      {/* Selected badge */}
      {selectedDistrict && (
        <div className="tn-selected-badge">
          <span>📌 {selectedDistrict}</span>
          <button onClick={() => onSelectDistrict?.('')}>✕</button>
        </div>
      )}
    </div>
  )
}
