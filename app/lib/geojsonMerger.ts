import { union } from '@turf/union'
import { feature } from '@turf/helpers'

export interface WSOData {
  wso_id: number
  name: string
  territory_geojson: any
  geographic_type: string
  states: string[]
  counties: string[]
  active_status: boolean
}

/**
 * Merges GeoJSON polygons for California WSOs to create unified territories
 * without internal county boundaries
 */
export function mergeCaliforniaWSOs(wsoData: WSOData[]): WSOData[] {
  return wsoData.map(wso => {
    // Only process California WSOs
    if (!isCaliforniaWSO(wso)) {
      return wso
    }

    try {
      // If the territory_geojson is a FeatureCollection with multiple features
      if (wso.territory_geojson.type === 'FeatureCollection' && 
          wso.territory_geojson.features.length > 1) {
        
        console.log(`Merging ${wso.territory_geojson.features.length} features for WSO: ${wso.name}`)
        
        // Start with the first feature
        let mergedPolygon = wso.territory_geojson.features[0]
        
        // Union all subsequent features
        for (let i = 1; i < wso.territory_geojson.features.length; i++) {
          const currentFeature = wso.territory_geojson.features[i]
          try {
            mergedPolygon = union(mergedPolygon, currentFeature)
          } catch (error) {
            console.warn(`Failed to union feature ${i} for WSO ${wso.name}:`, error)
            // Continue with partial merge if one feature fails
          }
        }
        
        // Create new WSO data with merged polygon
        return {
          ...wso,
          territory_geojson: {
            type: 'FeatureCollection',
            features: [mergedPolygon]
          }
        }
      }
    } catch (error) {
      console.error(`Failed to merge polygons for WSO ${wso.name}:`, error)
    }
    
    // Return original if merging fails or not needed
    return wso
  })
}

/**
 * Checks if a WSO is a California WSO that should be merged
 */
function isCaliforniaWSO(wso: WSOData): boolean {
  return wso.states.length === 1 && 
         wso.states[0] === 'California' && 
         wso.counties && wso.counties.length > 1
}