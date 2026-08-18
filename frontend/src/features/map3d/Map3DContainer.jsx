import { useState, useEffect, useRef } from 'react'
import { Map3D } from './Map3D'
import { DistrictTooltip } from './DistrictTooltip'
import { useDistrictGeometry } from './useDistrictGeometry'
import { buildCountLookup, normalizeDistrictName } from './districtIndex'
import '../../styles/tn-map.css'

export default function Map3DContainer({
  districtCounts = {},
  selectedDistrict,
  onSelectDistrict,
}) {
  const [geoData, setGeoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hoveredId, setHoveredId] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, district: '', count: 0 })
  const containerRef = useRef(null)
  const controlsRef = useRef(null)

  // 1. Fetch the 38-district GeoJSON
  useEffect(() => {
    fetch('/tn-districts.geojson')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load GeoJSON')
        return res.json()
      })
      .then((data) => {
        setGeoData(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('[Map3D] GeoJSON loading failed:', err)
        setError(true)
        setLoading(false)
      })
  }, [])

  const countLookup = buildCountLookup(districtCounts)
  const districts = useDistrictGeometry(geoData, countLookup)

  // Pointer event handlers
  const handlePointerOver = (e, district) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setHoveredId(district.id)
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        district: district.name,
        count: district.count,
      })
    }
  }

  const handlePointerOut = () => {
    setHoveredId(null)
    setTooltip((prev) => ({ ...prev, visible: false }))
  }

  const handleClick = (district) => {
    if (onSelectDistrict) {
      const isAlreadyActive = normalizeDistrictName(selectedDistrict || '') === district.id
      onSelectDistrict(isAlreadyActive ? '' : district.name)
    }
  }

  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset()
    }
  }

  return (
    <div ref={containerRef} className="tn-map-wrapper" style={{ height: 560, background: '#fdf6ee' }}>
      {loading && (
        <div className="tn-map-loading">
          <div className="tn-map-spinner" />
          <span>Rendering 3D Tamil Nadu Map…</span>
        </div>
      )}

      {error && (
        <div className="tn-map-loading">
          <span style={{ fontSize: 32 }}>🗺️</span>
          <span style={{ color: '#c45200' }}>3D Map Unavailable</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <Map3D
            districts={districts}
            hoveredId={hoveredId}
            selectedDistrict={selectedDistrict}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
            controlsRef={controlsRef}
          />

          <DistrictTooltip tooltip={tooltip} />

          {/* Floating Subtle Reset View Control */}
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 900, display: 'flex', gap: 8 }}>
            <button
              onClick={resetView}
              className="btn btn-sm btn-light"
              style={{
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                color: '#e65100',
                background: '#ffffff',
                border: '1px solid rgba(230, 81, 0, 0.25)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                padding: '5px 12px',
              }}
              title="Reset 3D Map Perspective"
            >
              ↺ Reset 3D View
            </button>
          </div>

          {/* District 3D Hint Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              zIndex: 900,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(247, 98, 1, 0.15)',
              borderRadius: 10,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#666',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            🖱️ Drag to rotate 3D • Scroll to zoom • Click district to filter
          </div>

          {/* Selected District Badge */}
          {selectedDistrict && (
            <div className="tn-selected-badge">
              <span>📍 {selectedDistrict}</span>
              <button onClick={() => onSelectDistrict && onSelectDistrict('')}>
                ✕
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
