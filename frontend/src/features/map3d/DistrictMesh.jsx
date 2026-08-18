import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getDistrictColor } from './districtColorScale'

export function DistrictMesh({
  district,
  isHovered,
  isSelected,
  onPointerOver,
  onPointerOut,
  onClick,
}) {
  const groupRef = useRef()
  const targetZ = isHovered ? 0.35 : isSelected ? 0.2 : 0

  // Smooth lerp hover lift effect along Z axis
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.z = THREE.MathUtils.damp(
        groupRef.current.position.z,
        targetZ,
        14,
        delta
      )
    }
  })

  const color = getDistrictColor(district.count, isHovered, isSelected)

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => {
        e.stopPropagation()
        onPointerOver(e, district)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onPointerOut(district)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(district)
      }}
    >
      {district.geometries.map((geom, idx) => (
        <group key={idx}>
          {/* Main 3D Extruded Body */}
          <mesh geometry={geom} castShadow receiveShadow>
            <meshStandardMaterial
              color={color}
              roughness={0.35}
              metalness={0.15}
              envMapIntensity={0.8}
            />
          </mesh>

          {/* Crisp Top Edge Outline */}
          <lineSegments>
            <edgesGeometry args={[geom, 25]} />
            <lineBasicMaterial
              color={isSelected ? '#ffffff' : isHovered ? '#ffffff' : '#d4a373'}
              linewidth={1}
              transparent
              opacity={isHovered || isSelected ? 0.9 : 0.45}
            />
          </lineSegments>
        </group>
      ))}
    </group>
  )
}
