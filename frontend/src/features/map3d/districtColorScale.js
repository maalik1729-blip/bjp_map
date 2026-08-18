// Curated color palette inspired by the reference 3D district map
const DISTRICT_BASE_PALETTE = [
  '#f8b195', // Peach
  '#f67280', // Coral Rose
  '#c06c84', // Dusty Rose
  '#6c5b7b', // Soft Purple
  '#355c7d', // Slate Blue
  '#99b898', // Soft Sage Green
  '#feceab', // Apricot
  '#ff847c', // Salmon
  '#e84a5f', // Red Berry
  '#4a9ea8', // Ocean Teal
  '#7bb0a6', // Mint
  '#f9d56e', // Sunflower Yellow
  '#f3c68f', // Sand
  '#ee99a0', // Blossom Pink
  '#8ec6c5', // Sky Teal
  '#e27802', // Saffron Warm
  '#6aa06a', // Meadow Green
  '#d4a5a5', // Soft Taupe
  '#9b5de5', // Lavender
  '#f15bb5', // Rose
  '#fee440', // Bright Warm Gold
  '#00bbf9', // Bright Azure
  '#00f5d4', // Seafoam
]

// Stable deterministic color hash per district name
export function getDistrictBaseColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % DISTRICT_BASE_PALETTE.length
  return DISTRICT_BASE_PALETTE[index]
}

export function getDistrictColor(districtName = '', count = 0, isHovered = false, isSelected = false) {
  if (isSelected) return '#d32f2f' // Crimson for selected
  if (isHovered) return '#ff6f00'  // Glowing Bright Saffron on hover

  // Distinct colorful 3D block color for each district
  return getDistrictBaseColor(districtName)
}

// 3D block extrusion depth in Three.js units (substantial thickness like the reference 3D model)
export function getExtrusionDepth(count = 0) {
  const baseDepth = 0.85 // Prominent 3D block depth
  if (!count || count === 0) return baseDepth
  return Math.min(baseDepth + count * 0.025, 2.4)
}
