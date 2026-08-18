import { useMemo } from 'react'
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'
import { getExtrusionDepth } from './districtColorScale'
import { normalizeDistrictName } from './districtIndex'

// Map size in 3D world units
const SCENE_WIDTH = 22
const SCENE_HEIGHT = 22

export function useDistrictGeometry(geoData, countLookup = {}) {
  return useMemo(() => {
    if (!geoData || !geoData.features) return []

    // 1. Setup Mercator projection fitted to the Tamil Nadu GeoJSON bounding box
    const projection = geoMercator()
      .fitSize([SCENE_WIDTH, SCENE_HEIGHT], geoData)

    const districts = []

    geoData.features.forEach((feature, idx) => {
      const rawName = feature.properties?.district || feature.properties?.name || `District_${idx}`
      const normName = normalizeDistrictName(rawName)
      const count = countLookup[normName] || 0
      const depth = getExtrusionDepth(count)

      const geomType = feature.geometry.type
      const coords = feature.geometry.coordinates

      const shapes = []

      function processPolygon(rings) {
        if (!rings || rings.length === 0) return
        
        // Outer boundary
        const outerRing = rings[0]
        const shape = new THREE.Shape()

        outerRing.forEach((pt, i) => {
          const [px, py] = projection(pt)
          // Center projection coordinates around origin [0,0] and flip Y for 3D coordinate space
          const x = px - SCENE_WIDTH / 2
          const y = -(py - SCENE_HEIGHT / 2)

          if (i === 0) shape.moveTo(x, y)
          else shape.lineTo(x, y)
        })

        // Inner holes (if any)
        for (let h = 1; h < rings.length; h++) {
          const holeRing = rings[h]
          const holePath = new THREE.Path()
          holeRing.forEach((pt, i) => {
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

      if (geomType === 'Polygon') {
        processPolygon(coords)
      } else if (geomType === 'MultiPolygon') {
        coords.forEach(polyRings => processPolygon(polyRings))
      }

      if (shapes.length > 0) {
        // Extrude settings for 3D pucks with beveled edges
        const extrudeSettings = {
          depth: depth,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.04,
          bevelThickness: 0.04,
        }

        const geometries = shapes.map(s => new THREE.ExtrudeGeometry(s, extrudeSettings))

        districts.push({
          id: normName,
          name: rawName,
          count,
          depth,
          shapes,
          geometries,
        })
      }
    })

    return districts
  }, [geoData, countLookup])
}
