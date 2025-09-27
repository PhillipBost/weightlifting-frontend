import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    // Get club location data from clubs table
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('clubs')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError)
      return NextResponse.json({ error: clubsError.message }, { status: 500 })
    }

    // Get current year for recent activity calculation
    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1

    // Get recent activity data for clubs
    const { data: activityData, error: activityError } = await supabaseAdmin
      .from('meet_results')
      .select('club_name, lifter_id, date')
      .gte('date', `${lastYear}-01-01`)
      .lt('date', `${currentYear + 1}-01-01`)
      .not('club_name', 'is', null)

    if (activityError) {
      console.warn('Could not fetch club activity data:', activityError.message)
    }

    // Process activity data by club
    const clubActivity: Record<string, Set<string>> = {}
    
    if (activityData) {
      activityData.forEach(result => {
        if (!result.club_name || !result.lifter_id) return
        
        const clubName = result.club_name.trim()
        if (!clubActivity[clubName]) {
          clubActivity[clubName] = new Set()
        }
        clubActivity[clubName].add(result.lifter_id.toString())
      })
    }

    // Enhance club data with activity metrics
    const enrichedClubs = clubsData.map(club => ({
      id: club.id,
      name: club.club_name,
      address: club.address,
      latitude: parseFloat(club.latitude),
      longitude: parseFloat(club.longitude),
      city: club.city,
      state: club.state,
      recentMemberCount: clubActivity[club.club_name]?.size || 0
    }))

    // Filter out clubs with invalid coordinates
    const validClubs = enrichedClubs.filter(club => 
      !isNaN(club.latitude) && !isNaN(club.longitude) &&
      club.latitude >= -90 && club.latitude <= 90 &&
      club.longitude >= -180 && club.longitude <= 180
    )

    const response = NextResponse.json(validClubs)
    
    // Add caching headers - club locations change monthly
    response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400') // 24 hours browser and CDN
    response.headers.set('CDN-Cache-Control', 'public, max-age=86400') // 24 hours CDN
    
    return response
  } catch (err) {
    console.error('Unexpected error in club-locations API:', err)
    return NextResponse.json({ error: 'Failed to fetch club locations' }, { status: 500 })
  }
}