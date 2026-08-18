import { normalizeDistrictName } from './districtIndex'

// 38 Unique, carefully curated colors matching the reference Tamil Nadu political map
export const DISTRICT_UNIQUE_COLORS = {
  'chennai': '#fef08a',        // Warm Yellow Gold
  'tiruvallur': '#fecdd3',     // Soft Rose
  'kanchipuram': '#dcfce7',    // Mint Green
  'kancheepuram': '#dcfce7',   // Mint Green (Alias)
  'chengalpattu': '#fed7aa',   // Peach Orange
  'chengalpet': '#fed7aa',     // Peach Orange (Alias)
  'ranipet': '#bae6fd',        // Sky Blue
  'vellore': '#ffedd5',        // Warm Cream Peach
  'tirupattur': '#bef264',     // Lime Sage
  'krishnagiri': '#fbcfe8',    // Pastel Blossom Pink
  'dharmapuri': '#bbf7d0',     // Soft Meadow Green
  'tiruvannamalai': '#fef9c3', // Butter Gold
  'viluppuram': '#e0e7ff',     // Soft Periwinkle
  'kallakurichi': '#a7f3d0',   // Seafoam Mint
  'salem': '#fef08a',          // Soft Canary
  'namakkal': '#ddd6fe',       // Lavender
  'perambalur': '#fed7aa',     // Light Apricot
  'ariyalur': '#bae6fd',       // Ice Blue
  'cuddalore': '#fecdd3',      // Light Salmon
  'mayiladuthurai': '#99f6e4', // Aquamarine
  'nagapattinam': '#fef08a',   // Golden Yellow
  'tiruvarur': '#bef264',      // Lime Mint
  'thanjavur': '#fed7aa',      // Soft Tangerine
  'tiruchirappalli': '#fbcfe8',// Light Coral
  'trichy': '#fbcfe8',         // Light Coral (Alias)
  'karur': '#bef264',          // Bright Lime
  'nilgiris': '#a7f3d0',       // Highland Green
  'the nilgiris': '#a7f3d0',   // Highland Green (Alias)
  'erode': '#fef9c3',          // Pale Gold
  'coimbatore': '#fed7aa',     // Warm Peach
  'tiruppur': '#ddd6fe',       // Lilac
  'dindigul': '#fef08a',       // Sunflower
  'pudukkottai': '#fed7aa',    // Warm Coral
  'theni': '#c7d2fe',          // Slate Lavender
  'madurai': '#d9f99d',        // Spring Green
  'sivaganga': '#fecdd3',      // Dusty Rose
  'sivagangai': '#fecdd3',     // Dusty Rose (Alias)
  'virudhunagar': '#fef08a',   // Golden Butter
  'ramanathapuram': '#fed7aa', // Warm Sand
  'ramnad': '#fed7aa',         // Warm Sand (Alias)
  'thoothukudi': '#bef264',    // Olive Lime
  'thoothukkudi': '#bef264',   // Olive Lime (Alias)
  'tenkasi': '#fdba74',        // Sunset Orange
  'tirunelveli': '#e0e7ff',    // Soft Azure
  'kanyakumari': '#fbcfe8',    // Southern Pink
  'kanniyakumari': '#fbcfe8',  // Southern Pink (Alias)
}

// 23 fallback colors for any custom/dynamic district
const FALLBACK_PALETTE = [
  '#f8b195', '#f67280', '#c06c84', '#6c5b7b', '#355c7d', '#99b898', '#feceab', '#ff847c',
  '#e84a5f', '#4a9ea8', '#7bb0a6', '#f9d56e', '#f3c68f', '#ee99a0', '#8ec6c5', '#e27802',
  '#6aa06a', '#d4a5a5', '#9b5de5', '#f15bb5', '#fee440', '#00bbf9', '#00f5d4'
]

export function getDistrictBaseColor(name = '') {
  const norm = normalizeDistrictName(name)
  if (DISTRICT_UNIQUE_COLORS[norm]) {
    return DISTRICT_UNIQUE_COLORS[norm]
  }
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}

export function getDistrictColor(districtName = '', count = 0, isHovered = false, isSelected = false) {
  if (isSelected) return '#d32f2f' // Crimson for selected
  if (isHovered) return '#ff6f00'  // Glowing Bright Saffron on hover

  // Distinct unique 3D block color for each of the 38 districts
  return getDistrictBaseColor(districtName)
}

// 3D block extrusion depth in Three.js units (substantial thickness like the reference 3D model)
export function getExtrusionDepth(count = 0) {
  const baseDepth = 0.85 // Prominent 3D block depth
  if (!count || count === 0) return baseDepth
  return Math.min(baseDepth + count * 0.025, 2.4)
}
