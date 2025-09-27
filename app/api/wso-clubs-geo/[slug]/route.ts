import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to check if a point is inside a GeoJSON polygon
function pointInGeoJSON(point: [number, number], geojson: any): boolean {
  if (!geojson) return false

  const [lng, lat] = point

  // Handle Feature wrapper
  let geometry = geojson
  if (geojson.type === 'Feature') {
    geometry = geojson.geometry
  }

  if (!geometry || !geometry.coordinates) return false

  // Handle both Polygon and MultiPolygon geometries
  if (geometry.type === 'Polygon') {
    return pointInPolygon([lng, lat], geometry.coordinates[0])
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon: any) =>
      pointInPolygon([lng, lat], polygon[0])
    )
  }

  return false
}

// Ray casting algorithm for point-in-polygon test
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    console.log('=== WSO CLUBS GEO API CALLED ===')
    console.log('Slug:', slug)

    // Convert slug back to WSO name
    const wsoName = slugToWsoName(slug)
    console.log('Converted slug to WSO name:', wsoName)

    if (!wsoName || !slug) {
      return NextResponse.json({ error: 'Invalid WSO slug' }, { status: 400 })
    }

    // Get WSO boundary data for geographic filtering
    const { data: wsoData, error: wsoError } = await supabaseAdmin
      .from('wso_information')
      .select('name, territory_geojson')

    if (wsoError) {
      console.error('Error fetching WSO boundary data:', wsoError)
    }

    // Get ALL clubs with coordinates (we'll filter geographically)
    console.log('Querying all clubs with coordinates for geographic filtering')
    
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('clubs')
      .select('club_name, wso_geography, phone, email, address, geocode_display_name, latitude, longitude, active_lifters_count')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('club_name')

    console.log('Clubs query result (before geographic filtering):', {
      clubsCount: clubsData?.length || 0,
      error: clubsError?.message,
      sampleClub: clubsData?.[0]
    })

    if (clubsError) {
      console.error('Clubs query error:', clubsError)
      return NextResponse.json({ error: clubsError.message }, { status: 500 })
    }

    // Apply geographic filtering
    let filteredClubs = clubsData || []
    
    if (wsoData && !wsoError) {
      const targetWSO = wsoData.find(wso => wso.name === wsoName)
      
      if (targetWSO && targetWSO.territory_geojson) {
        console.log(`Applying geographic filtering for ${wsoName}`)
        
        const geographicallyFilteredClubs = filteredClubs.filter(club => {
          if (!club.latitude || !club.longitude) return false
          const isInside = pointInGeoJSON([club.longitude, club.latitude], targetWSO.territory_geojson)
          return isInside
        })
        
        console.log(`Geographic filtering: ${geographicallyFilteredClubs.length} clubs inside ${wsoName} territory (removed ${filteredClubs.length - geographicallyFilteredClubs.length} clubs outside territory)`)
        filteredClubs = geographicallyFilteredClubs
      } else {
        console.log(`No territory boundary found for ${wsoName}, falling back to wso_geography field filtering`)
        // Fallback to wso_geography field if no boundary data
        filteredClubs = filteredClubs.filter(club => club.wso_geography === wsoName)
      }
    } else {
      console.log('WSO boundary data not available, using wso_geography field filtering')
      filteredClubs = filteredClubs.filter(club => club.wso_geography === wsoName)
    }

    console.log('Final clubs result:', {
      finalClubsCount: filteredClubs.length,
      queryWsoName: wsoName
    })

    // Calculate club stats like the original API
    const locations = filteredClubs?.map(club => {
      const displayName = club.geocode_display_name || club.address || ''
      const parts = displayName.split(',').map((p: string) => p.trim())
      return {
        city: parts.length >= 2 ? parts[parts.length - 2] : '',
        state: parts.length >= 1 ? parts[parts.length - 1] : ''
      }
    }) || []

    const clubStats = {
      totalClubs: filteredClubs?.length || 0,
      activeClubs: filteredClubs?.length || 0,
      citiesCount: new Set(locations.map(l => l.city).filter(city => city && city.length > 0)).size,
      statesCount: 1 // Will be updated if we have WSO info
    }

    return NextResponse.json({
      wsoName,
      wsoInfo: null,
      clubs: filteredClubs || [],
      clubStats,
      debugInfo: {
        clubsBeforeFiltering: clubsData?.length || 0,
        clubsAfterFiltering: filteredClubs.length,
        geographicFilteringApplied: !!(wsoData && !wsoError)
      }
    }, { 
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (err) {
    console.error('Error fetching WSO clubs:', err)
    return NextResponse.json({ error: 'Failed to fetch WSO clubs' }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}