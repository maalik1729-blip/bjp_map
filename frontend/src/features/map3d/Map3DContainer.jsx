import { useState, useEffect, useRef } from 'react'
import { Map3D } from './Map3D'
import { DistrictTooltip } from './DistrictTooltip'
import { useDistrictGeometry } from './useDistrictGeometry'
import { buildCountLookup, normalizeDistrictName } from './districtIndex'
import { COLOR_SCALE } from './districtColorScale'
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
    <div ref={containerRef} className="tn-map-wrapper" style={{ height: 530 }}>
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

          {/* Reset Camera Button */}
          <button
            className="tn-3d-toggle"
            onClick={resetView}
            title="Reset 3D Camera Angle"
          >
            🎥 Reset 3D View
          </button>

          {/* Saffron Legend */}
          <div className="tn-map-legend">
            <div className="tn-legend-title">Applications</div>
            {COLOR_SCALE.map(({ color, label }) => (
              <div key={label} className="tn-legend-row">
                <span className="tn-legend-dot" style={{ background: color }} />
                <span className="tn-legend-text">{label}</span>
              </div>
            ))}
            <div style={{ fontSize: 9, color: '#9e9e9e', marginTop: 6, lineHeight: 1.4 }}>
              ↑ Height = 3D Extrusion
            </div>
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
