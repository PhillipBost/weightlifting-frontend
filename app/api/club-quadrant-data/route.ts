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
  quadrant: 'powerhouse' | 'intensive' | 'potential' | 'struggling'
  quadrant_label: string
}

interface QuadrantStats {
  powerhouse: { count: number; avgLifters: number; avgActivity: number }
  intensive: { count: number; avgLifters: number; avgActivity: number }
  potential: { count: number; avgLifters: number; avgActivity: number }
  struggling: { count: number; avgLifters: number; avgActivity: number }
}

export async function GET() {
  try {
    // Get club data with activity metrics from the clubs table
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('clubs')
      .select(`
        club_name,
        active_lifters_count,
        activity_factor,
        total_participations,
        recent_meets_count,
        address,
        latitude,
        longitude,
        wso_geography,
        geocode_display_name
      `)
      .not('active_lifters_count', 'is', null)
      .not('activity_factor', 'is', null)
      .gt('active_lifters_count', 0)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError)
      return NextResponse.json({ error: clubsError.message }, { status: 500 })
    }

    if (!clubsData || clubsData.length === 0) {
      return NextResponse.json({
        clubs: [],
        stats: {
          powerhouse: { count: 0, avgLifters: 0, avgActivity: 0 },
          intensive: { count: 0, avgLifters: 0, avgActivity: 0 },
          potential: { count: 0, avgLifters: 0, avgActivity: 0 },
          struggling: { count: 0, avgLifters: 0, avgActivity: 0 }
        },
        boundaries: { liftersMedian: 0, activityMedian: 0 }
      })
    }

    // Calculate quadrant boundaries using medians
    const liftersCounts = clubsData.map(club => club.active_lifters_count).sort((a, b) => a - b)
    const activityFactors = clubsData.map(club => club.activity_factor).sort((a, b) => a - b)

    const liftersMedian = liftersCounts[Math.floor(liftersCounts.length / 2)]
    const activityMedian = activityFactors[Math.floor(activityFactors.length / 2)]

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

    // Categorize clubs into quadrants and enhance data
    const enhancedClubs: ClubQuadrantData[] = clubsData.map(club => {
      const { city, state } = parseLocation(club)

      let quadrant: ClubQuadrantData['quadrant']
      let quadrant_label: string

      const highLifters = club.active_lifters_count >= liftersMedian
      const highActivity = club.activity_factor >= activityMedian

      if (highLifters && highActivity) {
        quadrant = 'powerhouse'
        quadrant_label = 'Powerhouse'
      } else if (!highLifters && highActivity) {
        quadrant = 'intensive'
        quadrant_label = 'Intensive'
      } else if (highLifters && !highActivity) {
        quadrant = 'potential'
        quadrant_label = 'Potential'
      } else {
        quadrant = 'struggling'
        quadrant_label = 'Struggling'
      }

      return {
        club_name: club.club_name,
        active_lifters_count: club.active_lifters_count,
        activity_factor: Number(club.activity_factor),
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
      potential: { count: 0, avgLifters: 0, avgActivity: 0 },
      struggling: { count: 0, avgLifters: 0, avgActivity: 0 }
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
        liftersMedian,
        activityMedian
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