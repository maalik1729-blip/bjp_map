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
      {/* Studio Lighting to illuminate the front face and extruded 3D side walls */}
      <ambientLight intensity={1.1} color="#ffffff" />
      
      {/* Key Light (Top-Left) creates soft depth and shadows on the side walls */}
      <directionalLight
        position={[-12, 18, 22]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      {/* Fill Light (Bottom-Right) */}
      <directionalLight position={[14, -12, 16]} intensity={0.6} color="#ffe5d9" />
      
      {/* Front Soft Spot */}
      <pointLight position={[0, 0, 20]} intensity={0.5} color="#ffffff" />

      {/* 3D Tamil Nadu Map - Front-facing with slight isometric tilt like the reference photo */}
      <group rotation={[-0.22, 0.15, -0.02]}>
        {/* Soft Background Plate */}
        <mesh position={[0, 0, -0.2]} receiveShadow>
          <planeGeometry args={[36, 36]} />
          <shadowMaterial opacity={0.15} />
        </mesh>

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
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
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
        dampingFactor={0.06}
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
