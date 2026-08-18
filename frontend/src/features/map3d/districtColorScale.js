// Saffron & Indian Flag themed choropleth palette for BJP Local Body dashboard
export const COLOR_SCALE = [
  { threshold: 500, color: '#e65100', label: '500+' },
  { threshold: 300, color: '#f57c00', label: '300–499' },
  { threshold: 150, color: '#ff9800', label: '150–299' },
  { threshold: 50,  color: '#ffb74d', label: '50–149' },
  { threshold: 1,   color: '#ffe0b2', label: '1–49' },
  { threshold: 0,   color: '#fff3e0', label: '0 / None' },
]

export function getDistrictColor(count = 0, isHovered = false, isSelected = false) {
  if (isSelected) return '#b71c1c' // Deep Crimson Highlight for selected
  if (isHovered) return '#ff6f00'  // Vibrant Saffron Glow on hover

  if (!count || count === 0) return '#fff3e0'
  if (count >= 500) return '#e65100'
  if (count >= 300) return '#f57c00'
  if (count >= 150) return '#ff9800'
  if (count >= 50)  return '#ffb74d'
  return '#ffe0b2'
}

// Height extrusion scale for Three.js units (1 application adds height)
export function getExtrusionDepth(count = 0) {
  const baseDepth = 0.35 // 3D puck baseline thickness so every district stands out
  if (!count || count === 0) return baseDepth
  return Math.min(baseDepth + count * 0.015, 2.5) // Cap maximum height for elegance
}
