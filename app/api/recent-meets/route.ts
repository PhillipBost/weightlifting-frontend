import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Geographic filtering function
function pointInGeoJSON(point: [number, number], geojson: any): boolean {
  if (!geojson) return false

  const [lng, lat] = point

  // Handle Feature wrapper
  let geometry = geojson
  if (geojson.type === 'Feature') {
    geometry = geojson.geometry
  }

  if (!geometry || !geometry.coordinates) return false

  // Handle MultiPolygon
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon: any) =>
      pointInPolygon([lng, lat], polygon[0])
    )
  }

  // Handle Polygon
  if (geometry.type === 'Polygon') {
    return pointInPolygon([lng, lat], geometry.coordinates[0])
  }

  return false
}

// Point-in-polygon test using ray casting algorithm
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper function for state abbreviations
function getStateAbbreviation(stateName: string): string {
  const stateMap: { [key: string]: string } = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  }
  return stateMap[stateName] || stateName
}

// Function to convert slug to WSO name
function slugToWsoName(slug: string): string {
  const specialCases: { [key: string]: string } = {
    'dmv': 'DMV',
    'pennsylvania-west-virginia': 'Pennsylvania-West Virginia',
    'iowa-nebraska': 'Iowa-Nebraska',
    'minnesota-dakotas': 'Minnesota-Dakotas',
    'missouri-valley': 'Missouri Valley',
    'mountain-north': 'Mountain North',
    'mountain-south': 'Mountain South',
    'new-england': 'New England',
    'new-jersey': 'New Jersey',
    'new-york': 'New York',
    'pacific-northwest': 'Pacific Northwest',
    'tennessee-kentucky': 'Tennessee-Kentucky',
    'texas-oklahoma': 'Texas-Oklahoma',
    'california-north-central': 'California North Central',
    'california-south': 'California South',
    'hawaii-and-international': 'Hawaii and International'
  }

  if (specialCases[slug]) {
    return specialCases[slug]
  }

  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function GET(request: Request) {
  const startTime = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const wsoSlug = searchParams.get('wso')

    console.log(`Recent meets API: Starting request for WSO slug: ${wsoSlug}`)

    if (!wsoSlug) {
      console.log('Recent meets API: No WSO slug provided')
      return NextResponse.json({ error: 'WSO slug is required' }, { status: 400 })
    }

    // Convert slug to WSO name for database query
    const wsoName = slugToWsoName(wsoSlug)
    console.log(`Recent meets API: Converting slug '${wsoSlug}' to WSO name '${wsoName}'`)

    // Calculate 12-month window for recent meets
    const currentDate = new Date()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12)
    const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0]


    console.log(`Recent meets API: Querying meets since ${cutoffDate} for WSO: ${wsoName}`)

    // Get WSO boundary data for proper geographic filtering
    const { data: wsoData, error: wsoError } = await supabaseAdmin
      .from('wso_information')
      .select('wso_id, name, territory_geojson')
      .eq('name', wsoName)
      .single()

    // Query recent meets using wso_geography field (source of truth)
    const { data: allRecentMeets, error: meetError } = await supabaseAdmin
      .from('meets')
      .select('meet_id, Meet, Date, wso_geography, latitude, longitude, address, city, state')
      .eq('wso_geography', wsoName)
      .gte('Date', cutoffDate)
      .not('meet_id', 'is', null)
      .order('Date', { ascending: false })

    if (meetError) {
      console.error('Recent meets API: Error querying meets:', meetError)
      throw new Error(`Database query failed: ${meetError.message}`)
    }

    if (!allRecentMeets || allRecentMeets.length === 0) {
      console.log(`Recent meets API: No recent meets found for ${wsoName}`)
      return NextResponse.json([])
    }

    // Use wso_geography field directly (already filtered by query above)
    let filteredMeets = allRecentMeets

    console.log(`Recent meets API: Found ${filteredMeets.length} meets for ${wsoName}`)

    // Helper function to format location like clubs table
    const formatLocation = (meet: any): string => {
      if (meet.city && meet.state) {
        // Get state abbreviation
        const stateAbbr = getStateAbbreviation(meet.state)
        return `${meet.city}, ${stateAbbr}`
      }
      return meet.city || meet.state || 'Location not available'
    }

    // Transform to expected format (already sorted by date desc from query)
    const finalMeets = filteredMeets.map(meet => ({
      meet_id: meet.meet_id,
      meet_name: meet.Meet, // Column name is 'Meet'
      date: meet.Date, // Column name is 'Date'
      wso: wsoName, // Use the requested WSO name, not the contaminated field
      latitude: meet.latitude,
      longitude: meet.longitude,
      venue: null, // Not available in meets table
      city: meet.city,
      state: meet.state,
      address: meet.address,
      location: formatLocation(meet), // Add formatted location like clubs table
      uses_fallback_coordinates: false
    }))

    console.log(`Recent meets API: Returning ${finalMeets.length} meets with ${finalMeets.filter(m => m.latitude && m.longitude).length} having coordinates`)

    const response = NextResponse.json(finalMeets)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('CDN-Cache-Control', 'no-cache')
    response.headers.set('Vercel-CDN-Cache-Control', 'no-cache')

    console.log(`Recent meets API: Completed successfully in ${Date.now() - startTime}ms`)
    return response

  } catch (error) {
    console.error(`Recent meets API: Error after ${Date.now() - startTime}ms:`, error)
    return NextResponse.json({
      error: 'Failed to fetch recent meets',
      details: error instanceof Error ? error.message : 'Unknown error',
      timeElapsed: `${Date.now() - startTime}ms`
    }, { status: 500 })
  }
}