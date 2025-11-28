import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
  try {
    // Enable aggressive caching (1 week) since data updates weekly
    const headers = {
      'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
      'CDN-Cache-Control': 'public, s-maxage=604800',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=604800'
    }

    // Get WSO boundary data with pre-calculated metrics
    const { data: wsoData, error: wsoError } = await supabaseAdmin
      .from('usaw_wso_information')
      .select('*')

    if (wsoError) {
      return NextResponse.json({ error: wsoError.message }, { status: 500 })
    }

    // Calculate recent meets dynamically using 12-month window
    const currentDate = new Date()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12)
    const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0]

    // Query for meets in the last 12 months using wso_geography field
    let dynamicMeetCounts: Record<string, number> = {}
    try {
      const { data: recentMeets, error: meetError } = await supabaseAdmin
        .from('usaw_meets')
        .select('wso_geography, meet_id')
        .gte('Date', cutoffDate)
        .not('wso_geography', 'is', null)
        .not('meet_id', 'is', null)

      if (!meetError && recentMeets) {
        // Group by WSO and count unique meet_ids
        const meetsByWso: Record<string, Set<number>> = {}
        recentMeets.forEach(meet => {
          const wsoName = meet.wso_geography?.trim()
          if (!wsoName) return

          if (!meetsByWso[wsoName]) {
            meetsByWso[wsoName] = new Set()
          }
          if (meet.meet_id) {
            meetsByWso[wsoName].add(meet.meet_id)
          }
        })

        // Convert to counts
        dynamicMeetCounts = {} as Record<string, number>
        Object.keys(meetsByWso).forEach(wsoName => {
          dynamicMeetCounts[wsoName] = meetsByWso[wsoName].size
        })

        console.log('Dynamic meet counts calculated:', dynamicMeetCounts)
      }
    } catch (error) {
      console.warn('Could not calculate dynamic meet counts, falling back to pre-calculated:', error)
    }

    // Fetch clubs data for treemap visualization
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('usaw_clubs')
      .select('club_name, wso_geography, latitude, longitude, active_lifters_count')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('club_name')

    if (clubsError) {
      console.warn('Could not fetch clubs data:', clubsError)
    }

    // Group clubs by WSO
    const clubsByWSO = new Map<string, typeof clubsData>()
    if (clubsData) {
      clubsData.forEach(club => {
        const wsoName = club.wso_geography
        if (wsoName) {
          if (!clubsByWSO.has(wsoName)) {
            clubsByWSO.set(wsoName, [])
          }
          clubsByWSO.get(wsoName)?.push(club)
        }
      })
    }

    // Use pre-calculated data from wso_information table with dynamic meet counts and clubs
    const enrichedData = wsoData.map(wso => {
      const dynamicMeetCount = dynamicMeetCounts[wso.name] || 0
      const wsoClubs = clubsByWSO.get(wso.name) || []

      return {
        ...wso,
        recent_meets_count: dynamicMeetCount, // Use dynamic calculation instead of pre-calculated
        // Keep original field names for compatibility with frontend
        active_lifters_count: wso.active_lifters_count || 0,
        barbell_clubs_count: wso.barbell_clubs_count || 0,
        estimated_population: wso.estimated_population || 0,
        // Add clubs data for treemap
        clubs: wsoClubs.map(club => ({
          name: club.club_name,
          size: club.active_lifters_count || 0,
          latitude: club.latitude,
          longitude: club.longitude
        }))
      }
    })

    return NextResponse.json(enrichedData, { headers })
  } catch (err) {
    console.error('API Error:', err)
    return NextResponse.json({ error: 'Failed to fetch WSO boundaries' }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}