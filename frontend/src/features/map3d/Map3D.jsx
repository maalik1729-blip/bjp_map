import { useRef, Suspense } from 'react'
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
      {/* Cinematic Lighting Setup */}
      <ambientLight intensity={0.85} color="#fffaf0" />
      <directionalLight
        position={[15, 20, 25]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-15, -10, 15]} intensity={0.5} color="#ffd4aa" />
      <pointLight position={[0, 0, 15]} intensity={0.4} />

      {/* 3D Tamil Nadu Map Plane tilted slightly */}
      <group rotation={[-Math.PI / 4.2, 0, 0]}>
        {/* Ground Floor Shadow Plate */}
        <mesh position={[0, 0, -0.15]} receiveShadow>
          <planeGeometry args={[32, 32]} />
          <shadowMaterial opacity={0.12} />
        </mesh>

        {/* 38 District Meshes */}
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
      style={{ width: '100%', height: '100%' }}
    >
      <PerspectiveCamera makeDefault position={[0, -5, 28]} fov={45} />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.3}
        minDistance={12}
        maxDistance={45}
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
