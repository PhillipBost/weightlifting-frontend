/**
 * Geocoding utility for providing fallback coordinates
 * Used when meet locations have city/state but no specific coordinates
 */

interface Coordinates {
  latitude: number
  longitude: number
}

// Approximate coordinates for major US cities
// This is a simplified lookup - could be expanded or replaced with a proper geocoding API
const cityCoordinates: { [key: string]: Coordinates } = {
  // Format: "City, State" -> coordinates
  
  // Alabama
  "Birmingham, Alabama": { latitude: 33.5207, longitude: -86.8025 },
  "Montgomery, Alabama": { latitude: 32.3668, longitude: -86.2999 },
  "Mobile, Alabama": { latitude: 30.6954, longitude: -88.0399 },
  
  // Arizona
  "Phoenix, Arizona": { latitude: 33.4484, longitude: -112.0740 },
  "Tucson, Arizona": { latitude: 32.2226, longitude: -110.9747 },
  
  // California
  "Los Angeles, California": { latitude: 34.0522, longitude: -118.2437 },
  "San Diego, California": { latitude: 32.7157, longitude: -117.1611 },
  "San Francisco, California": { latitude: 37.7749, longitude: -122.4194 },
  "Sacramento, California": { latitude: 38.5816, longitude: -121.4944 },
  "San Jose, California": { latitude: 37.3382, longitude: -121.8863 },
  "Fresno, California": { latitude: 36.7378, longitude: -119.7871 },
  "Oakland, California": { latitude: 37.8044, longitude: -122.2712 },
  "Riverside, California": { latitude: 33.9533, longitude: -117.3961 },
  
  // Colorado
  "Denver, Colorado": { latitude: 39.7392, longitude: -104.9903 },
  "Colorado Springs, Colorado": { latitude: 38.8339, longitude: -104.8214 },
  
  // Florida
  "Miami, Florida": { latitude: 25.7617, longitude: -80.1918 },
  "Tampa, Florida": { latitude: 27.9506, longitude: -82.4572 },
  "Orlando, Florida": { latitude: 28.5383, longitude: -81.3792 },
  "Jacksonville, Florida": { latitude: 30.3322, longitude: -81.6557 },
  
  // Georgia
  "Atlanta, Georgia": { latitude: 33.7490, longitude: -84.3880 },
  "Savannah, Georgia": { latitude: 32.0809, longitude: -81.0912 },
  
  // Illinois
  "Chicago, Illinois": { latitude: 41.8781, longitude: -87.6298 },
  
  // Indiana
  "Indianapolis, Indiana": { latitude: 39.7684, longitude: -86.1581 },
  "Fort Wayne, Indiana": { latitude: 41.0793, longitude: -85.1394 },
  
  // Kentucky
  "Louisville, Kentucky": { latitude: 38.2527, longitude: -85.7585 },
  "Lexington, Kentucky": { latitude: 38.0406, longitude: -84.5037 },
  
  // Louisiana
  "New Orleans, Louisiana": { latitude: 29.9511, longitude: -90.0715 },
  "Baton Rouge, Louisiana": { latitude: 30.4515, longitude: -91.1871 },
  
  // Massachusetts
  "Boston, Massachusetts": { latitude: 42.3601, longitude: -71.0589 },
  
  // Michigan
  "Detroit, Michigan": { latitude: 42.3314, longitude: -83.0458 },
  
  // Minnesota
  "Minneapolis, Minnesota": { latitude: 44.9778, longitude: -93.2650 },
  "St. Paul, Minnesota": { latitude: 44.9537, longitude: -93.0900 },
  
  // Missouri
  "Kansas City, Missouri": { latitude: 39.0997, longitude: -94.5786 },
  "St. Louis, Missouri": { latitude: 38.6270, longitude: -90.1994 },
  
  // Nevada
  "Las Vegas, Nevada": { latitude: 36.1699, longitude: -115.1398 },
  
  // New York
  "New York, New York": { latitude: 40.7128, longitude: -74.0060 },
  "Buffalo, New York": { latitude: 42.8864, longitude: -78.8784 },
  
  // North Carolina
  "Charlotte, North Carolina": { latitude: 35.2271, longitude: -80.8431 },
  "Raleigh, North Carolina": { latitude: 35.7796, longitude: -78.6382 },
  
  // Ohio
  "Columbus, Ohio": { latitude: 39.9612, longitude: -82.9988 },
  "Cleveland, Ohio": { latitude: 41.4993, longitude: -81.6944 },
  "Cincinnati, Ohio": { latitude: 39.1031, longitude: -84.5120 },
  
  // Oklahoma
  "Oklahoma City, Oklahoma": { latitude: 35.4676, longitude: -97.5164 },
  "Tulsa, Oklahoma": { latitude: 36.1540, longitude: -95.9928 },
  
  // Oregon
  "Portland, Oregon": { latitude: 45.5152, longitude: -122.6784 },
  
  // Pennsylvania
  "Philadelphia, Pennsylvania": { latitude: 39.9526, longitude: -75.1652 },
  "Pittsburgh, Pennsylvania": { latitude: 40.4406, longitude: -79.9959 },
  
  // Tennessee
  "Nashville, Tennessee": { latitude: 36.1627, longitude: -86.7816 },
  "Memphis, Tennessee": { latitude: 35.1495, longitude: -90.0490 },
  "Knoxville, Tennessee": { latitude: 35.9606, longitude: -83.9207 },
  
  // Texas
  "Houston, Texas": { latitude: 29.7604, longitude: -95.3698 },
  "Dallas, Texas": { latitude: 32.7767, longitude: -96.7970 },
  "Austin, Texas": { latitude: 30.2672, longitude: -97.7431 },
  "San Antonio, Texas": { latitude: 29.4241, longitude: -98.4936 },
  "Fort Worth, Texas": { latitude: 32.7555, longitude: -97.3308 },
  
  // Washington
  "Seattle, Washington": { latitude: 47.6062, longitude: -122.3321 },
}

// State center coordinates (fallback if city not found)
const stateCoordinates: { [key: string]: Coordinates } = {
  "Alabama": { latitude: 32.806671, longitude: -86.791130 },
  "Alaska": { latitude: 61.370716, longitude: -152.404419 },
  "Arizona": { latitude: 33.729759, longitude: -111.431221 },
  "Arkansas": { latitude: 34.969704, longitude: -92.373123 },
  "California": { latitude: 36.116203, longitude: -119.681564 },
  "Colorado": { latitude: 39.059811, longitude: -105.311104 },
  "Connecticut": { latitude: 41.597782, longitude: -72.755371 },
  "Delaware": { latitude: 39.318523, longitude: -75.507141 },
  "Florida": { latitude: 27.766279, longitude: -81.686783 },
  "Georgia": { latitude: 33.040619, longitude: -83.643074 },
  "Hawaii": { latitude: 21.094318, longitude: -157.498337 },
  "Idaho": { latitude: 44.240459, longitude: -114.478828 },
  "Illinois": { latitude: 40.349457, longitude: -88.986137 },
  "Indiana": { latitude: 39.849426, longitude: -86.258278 },
  "Iowa": { latitude: 42.011539, longitude: -93.210526 },
  "Kansas": { latitude: 38.526600, longitude: -96.726486 },
  "Kentucky": { latitude: 37.668140, longitude: -84.670067 },
  "Louisiana": { latitude: 31.169546, longitude: -91.867805 },
  "Maine": { latitude: 44.693947, longitude: -69.381927 },
  "Maryland": { latitude: 39.063946, longitude: -76.802101 },
  "Massachusetts": { latitude: 42.230171, longitude: -71.530106 },
  "Michigan": { latitude: 43.326618, longitude: -84.536095 },
  "Minnesota": { latitude: 45.694454, longitude: -93.900192 },
  "Mississippi": { latitude: 32.741646, longitude: -89.678696 },
  "Missouri": { latitude: 38.456085, longitude: -92.288368 },
  "Montana": { latitude: 46.921925, longitude: -110.454353 },
  "Nebraska": { latitude: 41.125370, longitude: -98.268082 },
  "Nevada": { latitude: 38.313515, longitude: -117.055374 },
  "New Hampshire": { latitude: 43.452492, longitude: -71.563896 },
  "New Jersey": { latitude: 40.298904, longitude: -74.521011 },
  "New Mexico": { latitude: 34.840515, longitude: -106.248482 },
  "New York": { latitude: 42.165726, longitude: -74.948051 },
  "North Carolina": { latitude: 35.630066, longitude: -79.806419 },
  "North Dakota": { latitude: 47.528912, longitude: -99.784012 },
  "Ohio": { latitude: 40.388783, longitude: -82.764915 },
  "Oklahoma": { latitude: 35.565342, longitude: -96.928917 },
  "Oregon": { latitude: 44.572021, longitude: -122.070938 },
  "Pennsylvania": { latitude: 40.590752, longitude: -77.209755 },
  "Rhode Island": { latitude: 41.680893, longitude: -71.511780 },
  "South Carolina": { latitude: 33.856892, longitude: -80.945007 },
  "South Dakota": { latitude: 44.299782, longitude: -99.438828 },
  "Tennessee": { latitude: 35.747845, longitude: -86.692345 },
  "Texas": { latitude: 31.054487, longitude: -97.563461 },
  "Utah": { latitude: 40.150032, longitude: -111.862434 },
  "Vermont": { latitude: 44.045876, longitude: -72.710686 },
  "Virginia": { latitude: 37.769337, longitude: -78.169968 },
  "Washington": { latitude: 47.400902, longitude: -121.490494 },
  "West Virginia": { latitude: 38.491226, longitude: -80.954453 },
  "Wisconsin": { latitude: 44.268543, longitude: -89.616508 },
  "Wyoming": { latitude: 42.755966, longitude: -107.302490 },
}

/**
 * Get approximate coordinates for a city and state
 * Returns null if no coordinates can be determined
 */
export function getApproximateCoordinates(city: string | null | undefined, state: string | null | undefined): Coordinates | null {
  if (!city && !state) {
    return null
  }

  // Try exact city/state match first
  if (city && state) {
    const key = `${city}, ${state}`
    if (cityCoordinates[key]) {
      console.log(`Geocoding: Found exact match for ${key}`)
      return cityCoordinates[key]
    }
  }

  // Fallback to state center
  if (state && stateCoordinates[state]) {
    console.log(`Geocoding: Using state center for ${state}`)
    return stateCoordinates[state]
  }

  console.log(`Geocoding: No coordinates found for city="${city}", state="${state}"`)
  return null
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinates(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return false
  }
  
  // Check if coordinates are within valid ranges
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}