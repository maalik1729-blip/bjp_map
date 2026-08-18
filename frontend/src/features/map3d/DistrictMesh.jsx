import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
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
  const targetZ = isHovered ? 0.45 : isSelected ? 0.3 : 0

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

  const color = getDistrictColor(district.name, district.count, isHovered, isSelected)
  const [cx, cy] = district.centroid || [0, 0]
  const textZ = district.depth + 0.08

  // Shorten name if very long for clean 3D readability
  const displayName = district.name
    .replace('Tiruchirappalli', 'Trichy')
    .replace('Tiruvannamalai', 'T.V.Malai')
    .replace('Ramanathapuram', 'Ramnad')
    .replace('Chengalpattu', 'Chengalpet')
    .replace('Kanniyakumari', 'Kanyakumari')

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
              roughness={0.4}
              metalness={0.1}
              envMapIntensity={0.6}
            />
          </mesh>

          {/* Crisp Top Edge Outline */}
          <lineSegments>
            <edgesGeometry args={[geom, 28]} />
            <lineBasicMaterial
              color={isSelected ? '#ffffff' : isHovered ? '#ffffff' : '#333333'}
              linewidth={1}
              transparent
              opacity={isHovered || isSelected ? 0.95 : 0.25}
            />
          </lineSegments>
        </group>
      ))}

      {/* 3D District Name Label printed on top of the block */}
      <Text
        position={[cx, cy, textZ]}
        fontSize={0.34}
        color={isSelected ? '#ffffff' : '#1a1a1a'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.035}
        outlineColor={isSelected ? '#000000' : '#ffffff'}
        outlineOpacity={0.9}
        fontWeight="bold"
        letterSpacing={0.02}
      >
        {displayName}
      </Text>
    </group>
  )
}
