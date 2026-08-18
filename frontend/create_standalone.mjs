import fs from 'fs'

const raw = JSON.parse(fs.readFileSync('public/tn-districts.geojson', 'utf8'))

// Compress coordinates to 4 decimals
raw.features.forEach(f => {
  function roundRing(r) {
    return r.map(pt => [Number(pt[0].toFixed(4)), Number(pt[1].toFixed(4))])
  }
  if (f.geometry.type === 'Polygon') {
    f.geometry.coordinates = f.geometry.coordinates.map(roundRing)
  } else if (f.geometry.type === 'MultiPolygon') {
    f.geometry.coordinates = f.geometry.coordinates.map(poly => poly.map(roundRing))
  }
})

const geojsonStr = JSON.stringify(raw)

const componentCode = `import React, { useMemo, useState, useRef, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'

// ── 1. Embedded 38-District GeoJSON (Zero Network Fetch Required) ──
const TN_GEOJSON = ${geojsonStr}

// ── 2. Canonical 38 Districts of Tamil Nadu ──────────────────────────
export const TN_DISTRICTS = [
  'Chennai', 'Tiruvallur', 'Kanchipuram', 'Chengalpattu', 'Ranipet', 'Vellore', 'Tirupattur',
  'Krishnagiri', 'Dharmapuri', 'Tiruvannamalai', 'Viluppuram', 'Kallakurichi', 'Salem',
  'Namakkal', 'Perambalur', 'Ariyalur', 'Cuddalore', 'Mayiladuthurai', 'Nagapattinam',
  'Tiruvarur', 'Thanjavur', 'Tiruchirappalli', 'Karur', 'Nilgiris', 'Erode', 'Coimbatore',
  'Tiruppur', 'Dindigul', 'Pudukkottai', 'Theni', 'Madurai', 'Sivaganga', 'Virudhunagar',
  'Ramanathapuram', 'Thoothukudi', 'Tenkasi', 'Tirunelveli', 'Kanyakumari'
]

// ── 3. Color & Depth Scale Helpers ────────────────────────────────────
const DISTRICT_PALETTE = [
  '#f8b195', '#f67280', '#c06c84', '#6c5b7b', '#355c7d', '#99b898', '#feceab', '#ff847c',
  '#e84a5f', '#4a9ea8', '#7bb0a6', '#f9d56e', '#f3c68f', '#ee99a0', '#8ec6c5', '#e27802',
  '#6aa06a', '#d4a5a5', '#9b5de5', '#f15bb5', '#fee440', '#00bbf9', '#00f5d4'
]

function getDistrictBaseColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return DISTRICT_PALETTE[Math.abs(hash) % DISTRICT_PALETTE.length]
}

function normalizeName(name = '') {
  return name.trim().toLowerCase().replace(/\\s+/g, ' ').replace(/\\./g, '')
    .replace('the nilgiris', 'nilgiris').replace('kanniyakumari', 'kanyakumari')
    .replace('sivagangai', 'sivaganga').replace('thiruvarur', 'tiruvarur')
    .replace('thoothukkudi', 'thoothukudi').replace('kanchipuram', 'kancheepuram')
}

// ── 4. Individual 3D District Mesh ────────────────────────────────────
function DistrictMesh({ district, isHovered, isSelected, onPointerOver, onPointerOut, onClick }) {
  const color = isSelected ? '#d32f2f' : isHovered ? '#ff6f00' : getDistrictBaseColor(district.name)
  const [cx, cy] = district.centroid || [0, 0]
  const textZ = district.depth + 0.06
  const posZ = isHovered ? 0.4 : isSelected ? 0.25 : 0

  const displayName = district.name
    .replace('Tiruchirappalli', 'Trichy')
    .replace('Tiruvannamalai', 'T.V.Malai')
    .replace('Ramanathapuram', 'Ramnad')
    .replace('Chengalpattu', 'Chengalpet')
    .replace('Kanniyakumari', 'Kanyakumari')

  return (
    <group
      position={[0, 0, posZ]}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver(e, district) }}
      onPointerOut={(e) => { e.stopPropagation(); onPointerOut(district) }}
      onClick={(e) => { e.stopPropagation(); onClick(district) }}
    >
      {district.geometries.map((geom, idx) => (
        <mesh key={idx} geometry={geom}>
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.12} />
        </mesh>
      ))}
      <Text
        position={[cx, cy, textZ]}
        fontSize={0.34}
        color={isSelected ? '#ffffff' : '#222222'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor={isSelected ? '#000000' : '#ffffff'}
        fontWeight="bold"
      >
        {displayName}
      </Text>
    </group>
  )
}

// ── 5. Main Standalone Plug-and-Play Component ────────────────────────
export default function TamilNadu3DMap({
  districtCounts = {},
  selectedDistrict = '',
  onSelectDistrict = () => {},
  height = 560,
  backgroundColor = '#fdf6ee',
  showReset = true,
  showHint = true,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null)
  const controlsRef = useRef(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, district: '', count: 0 })

  // Normalized counts lookup
  const countLookup = useMemo(() => {
    const map = {}
    Object.entries(districtCounts).forEach(([k, v]) => {
      map[normalizeName(k)] = v
    })
    return map
  }, [districtCounts])

  // Project GeoJSON to 3D Extruded Geometry
  const districts = useMemo(() => {
    const SCENE_WIDTH = 22
    const SCENE_HEIGHT = 22
    const projection = geoMercator().fitSize([SCENE_WIDTH, SCENE_HEIGHT], TN_GEOJSON)
    const list = []

    TN_GEOJSON.features.forEach((feature, idx) => {
      const rawName = feature.properties?.district || feature.properties?.name || \`District_\${idx}\`
      const normName = normalizeName(rawName)
      const count = countLookup[normName] || 0
      const depth = 0.85 + Math.min(count * 0.025, 2.4)

      const geomType = feature.geometry.type
      const coords = feature.geometry.coordinates
      const shapes = []
      let totalX = 0, totalY = 0, totalLng = 0, totalLat = 0, pointCount = 0

      function processPolygon(rings) {
        if (!rings || !rings.length) return
        const shape = new THREE.Shape()
        rings[0].forEach((pt, i) => {
          const [px, py] = projection(pt)
          const x = px - SCENE_WIDTH / 2
          const y = -(py - SCENE_HEIGHT / 2)
          if (i === 0) shape.moveTo(x, y)
          else shape.lineTo(x, y)
          totalX += x
          totalY += y
          totalLng += pt[0]
          totalLat += pt[1]
          pointCount++
        })
        for (let h = 1; h < rings.length; h++) {
          const holePath = new THREE.Path()
          rings[h].forEach((pt, i) => {
            const [px, py] = projection(pt)
            const x = px - SCENE_WIDTH / 2
            const y = -(py - SCENE_HEIGHT / 2)
            if (i === 0) holePath.moveTo(x, y)
            else holePath.lineTo(x, y)
          })
          shape.holes.push(holePath)
        }
        shapes.push(shape)
      }

      if (geomType === 'Polygon') processPolygon(coords)
      else if (geomType === 'MultiPolygon') coords.forEach(processPolygon)

      if (shapes.length > 0) {
        const extrudeSettings = {
          depth,
          bevelEnabled: true,
          bevelSegments: 1,
          steps: 1,
          bevelSize: 0.03,
          bevelThickness: 0.03,
        }
        const geometries = shapes.map(s => new THREE.ExtrudeGeometry(s, extrudeSettings))
        const centroid = [
          pointCount > 0 ? totalX / pointCount : 0,
          pointCount > 0 ? totalY / pointCount : 0,
        ]
        const lat = pointCount > 0 ? Number((totalLat / pointCount).toFixed(3)) : 0
        const lng = pointCount > 0 ? Number((totalLng / pointCount).toFixed(3)) : 0
        list.push({ id: normName, name: rawName, count, depth, centroid, lat, lng, geometries })
      }
    })
    return list
  }, [countLookup])

  const selectedNorm = normalizeName(selectedDistrict || '')

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 16,
        overflow: 'hidden',
        background: backgroundColor,
        border: '1.5px solid rgba(247, 98, 1, 0.15)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
        ...style,
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ width: '100%', height: '100%', background: backgroundColor }}
      >
        <PerspectiveCamera makeDefault position={[0, -0.5, 23]} fov={42} />
        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.7}
          minDistance={10}
          maxDistance={38}
          dampingFactor={0.08}
        />
        <ambientLight intensity={1.15} color="#ffffff" />
        <directionalLight position={[-10, 16, 20]} intensity={1.4} />
        <directionalLight position={[12, -10, 14]} intensity={0.5} color="#ffe5d9" />
        <pointLight position={[0, 0, 18]} intensity={0.4} />

        <group rotation={[-0.22, 0.15, -0.02]}>
          <Suspense fallback={null}>
            {districts.map((d) => (
              <DistrictMesh
                key={d.id}
                district={d}
                isHovered={hoveredId === d.id}
                isSelected={selectedNorm === d.id}
                onPointerOver={(e, dist) => {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect()
                    setHoveredId(dist.id)
                    setTooltip({
                      visible: true,
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      district: dist.name,
                      count: dist.count,
                    })
                  }
                }}
                onPointerOut={() => {
                  setHoveredId(null)
                  setTooltip(p => ({ ...p, visible: false }))
                }}
                onClick={(dist) => {
                  const isAlready = selectedNorm === dist.id
                  onSelectDistrict(isAlready ? '' : dist.name)
                }}
              />
            ))}
          </Suspense>
        </group>
      </Canvas>

      {/* Floating 2D Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 14,
            top: tooltip.y - 75,
            pointerEvents: 'none',
            zIndex: 1000,
            background: 'rgba(24, 25, 26, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(247, 98, 1, 0.45)',
            borderRadius: 10,
            padding: '10px 14px',
            minWidth: 170,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>📍 {tooltip.district}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#f76201' }}>{tooltip.count.toLocaleString()}</span>
            <span style={{ fontSize: 12, opacity: 0.75 }}> applications</span>
          </div>
          {tooltip.lat && tooltip.lng && (
            <div style={{ fontSize: 10.5, color: '#90caf9', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>🌐</span>
              <span style={{ fontWeight: 600 }}>{tooltip.lat}° N, {tooltip.lng}° E</span>
            </div>
          )}
        </div>
      )}

      {/* Reset Camera Button */}
      {showReset && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 900 }}>
          <button
            onClick={() => controlsRef.current?.reset()}
            style={{
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              color: '#e65100',
              background: '#ffffff',
              border: '1px solid rgba(230, 81, 0, 0.25)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: '5px 12px',
              cursor: 'pointer',
            }}
            title="Reset 3D Map Perspective"
          >
            ↺ Reset 3D View
          </button>
        </div>
      )}

      {/* Interaction Hint */}
      {showHint && (
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
          🖱️ Drag to rotate 3D • Scroll to zoom • Click district to select
        </div>
      )}

      {/* Selected District Badge */}
      {selectedDistrict && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(135deg, #f76201, #e05500)',
            color: '#ffffff',
            padding: '6px 14px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(247, 98, 1, 0.35)',
          }}
        >
          <span>📍 {selectedDistrict}</span>
          <button
            onClick={() => onSelectDistrict('')}
            style={{
              background: 'rgba(255, 255, 255, 0.25)',
              border: 'none',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '2px 7px',
              borderRadius: 10,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
`

fs.writeFileSync('src/components/TamilNadu3DMapStandalone.jsx', componentCode)
console.log('✅ Created 100% standalone component: src/components/TamilNadu3DMapStandalone.jsx')
