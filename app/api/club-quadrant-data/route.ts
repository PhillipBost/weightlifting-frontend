import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface ClubQuadrantData {
  club_name: string
  active_lifters_count: number
  activity_factor: number
  total_participations: number
  recent_meets_count: number
  address: string
  city: string
  state: string
  latitude: number
  longitude: number
  wso_geography: string
  quadrant: 'powerhouse' | 'intensive' | 'sleeping-giant' | 'developing'
  quadrant_label: string
}

interface QuadrantStats {
  powerhouse: { count: number; avgLifters: number; avgActivity: number }
  intensive: { count: number; avgLifters: number; avgActivity: number }
  'sleeping-giant': { count: number; avgLifters: number; avgActivity: number }
  developing: { count: number; avgLifters: number; avgActivity: number }
}

export async function GET() {
  try {
    console.log('=== CLUB QUADRANT DATA API CALLED ===')

    // Query clubs table with pre-calculated activity metrics
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('clubs')
      .select('club_name, address, latitude, longitude, geocode_display_name, wso_geography, active_lifters_count, activity_factor, total_participations, recent_meets_count')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gt('active_lifters_count', 0) // Only competition clubs

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError)
      throw new Error(`Database error: ${clubsError.message}`)
    }

    console.log('Competition clubs fetched from database:', clubsData?.length || 0)

    // Use the data directly from the clubs table
    const activeClubsData = clubsData || []

    if (activeClubsData.length === 0) {
      return NextResponse.json({
        clubs: [],
        stats: {
          powerhouse: { count: 0, avgLifters: 0, avgActivity: 0 },
          intensive: { count: 0, avgLifters: 0, avgActivity: 0 },
          'sleeping-giant': { count: 0, avgLifters: 0, avgActivity: 0 },
          developing: { count: 0, avgLifters: 0, avgActivity: 0 }
        },
        boundaries: { liftersMedian: 0, activityMedian: 0 },
        totalClubs: 0
      })
    }

    // Hard-coded quadrant thresholds
    const LIFTERS_THRESHOLD = 20  // 20+ = high lifters, 1-19 = low lifters
    const ACTIVITY_THRESHOLD_POWERHOUSE = 2.75  // 2.75+ = powerhouse
    const ACTIVITY_THRESHOLD_INTENSIVE = 2.25  // 2.25+ = intensive

    // Fixed boundaries for reference lines on chart
    const liftersThreshold = LIFTERS_THRESHOLD
    const activityThreshold = ACTIVITY_THRESHOLD_POWERHOUSE

    // Helper function to parse location from geocode display name or address
    function parseLocation(club: any): { city: string; state: string } {
      const displayName = club.geocode_display_name || club.address || ''
      const parts = displayName.split(',').map((p: string) => p.trim())

      // Common formats: "City, State" or "Address, City, State" or "Address, City, State, Country"
      if (parts.length >= 2) {
        const state = parts[parts.length - 1]
        const city = parts[parts.length - 2]

        // Filter out country names and zip codes
        if (state && !state.match(/^\d/) && state.length <= 20) {
          return { city, state }
        }
      }

      return { city: '', state: '' }
    }

    // Categorize competition clubs into quadrants and enhance data
    const enhancedClubs: ClubQuadrantData[] = activeClubsData.map(club => {
      const { city, state } = parseLocation(club)

      // Use pre-calculated activity factor from database
      const activityFactor = club.activity_factor || 0

      let quadrant: ClubQuadrantData['quadrant']
      let quadrant_label: string

      // Hard-coded quadrant assignment based on fixed thresholds
      // Powerhouse: 20+ lifters AND 2.75+ activity
      // Intensive: 1-19 lifters AND 2.25+ activity
      // Sleeping Giant: 20+ lifters AND < 2.75 activity
      // Developing: 1-19 lifters AND < 2.25 activity

      if (club.active_lifters_count >= 20 && activityFactor >= 2.75) {
        quadrant = 'powerhouse'
        quadrant_label = 'Powerhouse'
      } else if (club.active_lifters_count <= 19 && activityFactor >= 2.25) {
        quadrant = 'intensive'
        quadrant_label = 'Intensive'
      } else if (club.active_lifters_count >= 20 && activityFactor < 2.75) {
        quadrant = 'sleeping-giant'
        quadrant_label = 'Sleeping Giant'
      } else {
        // Developing: 1-19 lifters AND < 2.25 activity
        quadrant = 'developing'
        quadrant_label = 'Developing'
      }

      return {
        club_name: club.club_name,
        active_lifters_count: club.active_lifters_count,
        activity_factor: Number(activityFactor.toFixed(2)),
        total_participations: club.total_participations || 0,
        recent_meets_count: club.recent_meets_count || 0,
        address: club.address || '',
        city,
        state,
        latitude: Number(club.latitude),
        longitude: Number(club.longitude),
        wso_geography: club.wso_geography || '',
        quadrant,
        quadrant_label
      }
    })

    // Calculate statistics for each quadrant
    const stats: QuadrantStats = {
      powerhouse: { count: 0, avgLifters: 0, avgActivity: 0 },
      intensive: { count: 0, avgLifters: 0, avgActivity: 0 },
      'sleeping-giant': { count: 0, avgLifters: 0, avgActivity: 0 },
      developing: { count: 0, avgLifters: 0, avgActivity: 0 }
    }

    enhancedClubs.forEach(club => {
      const quadrantStats = stats[club.quadrant]
      quadrantStats.count++
      quadrantStats.avgLifters += club.active_lifters_count
      quadrantStats.avgActivity += club.activity_factor
    })

    // Calculate averages
    Object.keys(stats).forEach(quadrant => {
      const quadrantKey = quadrant as keyof QuadrantStats
      const quadrantStats = stats[quadrantKey]
      if (quadrantStats.count > 0) {
        quadrantStats.avgLifters = Math.round((quadrantStats.avgLifters / quadrantStats.count) * 10) / 10
        quadrantStats.avgActivity = Math.round((quadrantStats.avgActivity / quadrantStats.count) * 100) / 100
      }
    })

    const responseData = {
      clubs: enhancedClubs,
      stats,
      boundaries: {
        liftersMedian: liftersThreshold,
        activityMedian: activityThreshold
      },
      totalClubs: enhancedClubs.length
    }

    const response = NextResponse.json(responseData)

    // Add caching headers - club analytics change daily
    response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400') // 24 hours browser and CDN
    response.headers.set('CDN-Cache-Control', 'public, max-age=86400') // 24 hours CDN

    return response
  } catch (err) {
    console.error('Unexpected error in club-quadrant-data API:', err)
    return NextResponse.json({ error: 'Failed to fetch club quadrant data' }, { status: 500 })
  }
}