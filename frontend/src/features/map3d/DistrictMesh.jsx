import { Text } from '@react-three/drei'
import { getDistrictColor } from './districtColorScale'

export function DistrictMesh({
  district,
  isHovered,
  isSelected,
  onPointerOver,
  onPointerOut,
  onClick,
}) {
  const color = getDistrictColor(district.name, district.count, isHovered, isSelected)
  const [cx, cy] = district.centroid || [0, 0]
  const textZ = district.depth + 0.06
  const posZ = isHovered ? 0.4 : isSelected ? 0.25 : 0

  // Shorten name if very long for clean 3D readability
  const displayName = district.name
    .replace('Tiruchirappalli', 'Trichy')
    .replace('Tiruvannamalai', 'T.V.Malai')
    .replace('Ramanathapuram', 'Ramnad')
    .replace('Chengalpattu', 'Chengalpet')
    .replace('Kanniyakumari', 'Kanyakumari')

  return (
    <group
      position={[0, 0, posZ]}
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
        <mesh key={idx} geometry={geom}>
          <meshStandardMaterial
            color={color}
            roughness={0.4}
            metalness={0.12}
          />
        </mesh>
      ))}

      {/* 3D District Name Label printed on top of the block */}
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
