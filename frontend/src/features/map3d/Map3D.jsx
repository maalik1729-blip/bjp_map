import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { DistrictMesh } from './DistrictMesh'
import { normalizeDistrictName } from './districtIndex'

function SceneContent({
  districts,
  hoveredId,
  selectedDistrict,
  onPointerOver,
  onPointerOut,
  onClick,
}) {
  const selectedNorm = normalizeDistrictName(selectedDistrict || '')

  return (
    <>
      {/* High Performance Lighting Setup */}
      <ambientLight intensity={1.15} color="#ffffff" />
      <directionalLight position={[-10, 16, 20]} intensity={1.4} />
      <directionalLight position={[12, -10, 14]} intensity={0.5} color="#ffe5d9" />
      <pointLight position={[0, 0, 18]} intensity={0.4} />

      {/* 3D Tamil Nadu Map - Front-facing with slight isometric tilt */}
      <group rotation={[-0.22, 0.15, -0.02]}>
        {/* 38 3D District Blocks */}
        {districts.map((d) => (
          <DistrictMesh
            key={d.id}
            district={d}
            isHovered={hoveredId === d.id}
            isSelected={selectedNorm === d.id}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            onClick={onClick}
          />
        ))}
      </group>
    </>
  )
}

export function Map3D({
  districts,
  hoveredId,
  selectedDistrict,
  onPointerOver,
  onPointerOut,
  onClick,
  controlsRef,
}) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{ width: '100%', height: '100%', background: '#fdf6ee' }}
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
      <Suspense fallback={null}>
        <SceneContent
          districts={districts}
          hoveredId={hoveredId}
          selectedDistrict={selectedDistrict}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onClick={onClick}
        />
      </Suspense>
    </Canvas>
  )
}
