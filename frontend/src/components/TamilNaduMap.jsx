import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import '../styles/tn-map.css'

// Normalize district name for matching
function normalizeName(name = '') {
  return name.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace('kanniyakumari', 'kanyakumari')
    .replace('sivagangai', 'sivaganga')
    .replace('thoothukudi', 'thoothukudi')
    .replace('thiruvarur', 'tiruvarur')
    .replace('nilgiris', 'the nilgiris')
    .replace('kanchipuram', 'kancheepuram')
}

function buildLookup(districtCounts) {
  const map = {}
  Object.entries(districtCounts).forEach(([k, v]) => { map[normalizeName(k)] = v })
  return map
}

function getHeatColor(count) {
  if (!count || count === 0) return '#fde8d8'
  if (count >= 500) return '#f76201'
  if (count >= 300) return '#ff7a1a'
  if (count >= 150) return '#ff9944'
  if (count >= 50)  return '#ffb87a'
  return '#ffd4aa'
}

export default function TamilNaduMap({ districtCounts = {}, selectedDistrict, onSelectDistrict }) {
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const geoLayerRef = useRef(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, district: '', count: 0 })
  const [geoData, setGeoData] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  // Load GeoJSON from public folder (no external dependency)
  useEffect(() => {
    fetch('/tn-districts.geojson')
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(data => { setGeoData(data); setStatus('ready') })
      .catch(() => setStatus('error'))
  }, [])

  // Init Leaflet map after GeoJSON loaded
  useEffect(() => {
    if (status !== 'ready' || !geoData || leafletMapRef.current) return

    import('leaflet').then((L) => {
      const map = L.map(mapRef.current, {
        center: [10.8505, 78.6677],
        zoom: 6,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
        doubleClickZoom: false,
      })
      leafletMapRef.current = map

      const lookup = buildLookup(districtCounts)

      function styleFeature(feature, forceSelected) {
        const raw = feature.properties?.district || ''
        const key = normalizeName(raw)
        const count = lookup[key] || 0
        const isSelected = forceSelected ?? (normalizeName(selectedDistrict || '') !== '' && key === normalizeName(selectedDistrict || ''))
        return {
          fillColor: isSelected ? '#c45200' : getHeatColor(count),
          fillOpacity: 0.85,
          color: '#ffffff',
          weight: isSelected ? 2.5 : 1,
          opacity: 1,
        }
      }

      const layer = L.geoJSON(geoData, {
        style: styleFeature,
        onEachFeature: (feature, lyr) => {
          const raw = feature.properties?.district || ''
          lyr.on({
            mouseover: (e) => {
              const key = normalizeName(raw)
              const count = lookup[key] || 0
              lyr.setStyle({ fillOpacity: 1, weight: 2 })
              const rect = mapRef.current.getBoundingClientRect()
              setTooltip({
                visible: true,
                x: e.originalEvent.clientX - rect.left + 14,
                y: e.originalEvent.clientY - rect.top - 60,
                district: raw,
                count,
              })
            },
            mousemove: (e) => {
              const rect = mapRef.current.getBoundingClientRect()
              setTooltip(prev => ({
                ...prev,
                x: e.originalEvent.clientX - rect.left + 14,
                y: e.originalEvent.clientY - rect.top - 60,
              }))
            },
            mouseout: () => {
              layer.resetStyle(lyr)
              setTooltip(prev => ({ ...prev, visible: false }))
            },
            click: () => {
              if (onSelectDistrict) {
                const isActive = normalizeName(raw) === normalizeName(selectedDistrict || '')
                onSelectDistrict(isActive ? '' : raw)
              }
            },
          })
        },
      }).addTo(map)

      geoLayerRef.current = layer

      try { map.fitBounds(layer.getBounds(), { padding: [12, 12] }) } catch (_) {}
    })

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        geoLayerRef.current = null
      }
    }
  }, [status, geoData])

  // Update styles when data or selection changes
  useEffect(() => {
    if (!geoLayerRef.current) return
    const lookup = buildLookup(districtCounts)
    geoLayerRef.current.eachLayer((lyr) => {
      const raw = lyr.feature?.properties?.district || ''
      const key = normalizeName(raw)
      const count = lookup[key] || 0
      const isSelected = normalizeName(selectedDistrict || '') !== '' && key === normalizeName(selectedDistrict || '')
      lyr.setStyle({
        fillColor: isSelected ? '#c45200' : getHeatColor(count),
        fillOpacity: 0.85,
        color: '#ffffff',
        weight: isSelected ? 2.5 : 1,
      })
    })
  }, [districtCounts, selectedDistrict])

  return (
    <div className="tn-map-wrapper">
      {/* Loading state */}
      {status === 'loading' && (
        <div className="tn-map-loading">
          <div className="tn-map-spinner" />
          <span>Loading Tamil Nadu Map…</span>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="tn-map-loading">
          <span style={{ fontSize: 28 }}>🗺️</span>
          <span style={{ color: '#c45200' }}>Map data unavailable</span>
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} className="tn-leaflet-map" style={{ opacity: status === 'ready' ? 1 : 0 }} />

      {/* Tooltip */}
      {tooltip.visible && (
        <div className="tn-map-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tn-tooltip-district">📍 {tooltip.district}</div>
          <div className="tn-tooltip-count">
            <span className="tn-tooltip-num">{tooltip.count.toLocaleString()}</span>
            <span className="tn-tooltip-label"> applications</span>
          </div>
          {tooltip.count === 0 && <div className="tn-tooltip-empty">No applications yet</div>}
        </div>
      )}

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
      </div>

      {/* Selected district badge */}
      {selectedDistrict && (
        <div className="tn-selected-badge">
          <span>📌 {selectedDistrict}</span>
          <button onClick={() => onSelectDistrict?.('')}>✕</button>
        </div>
      )}
    </div>
  )
}
