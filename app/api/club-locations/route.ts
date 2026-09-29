import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClubSlug } from '@/lib/clubs/slug'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to parse city and state from geocode display name or address
function parseLocation(club: { geocode_display_name: string | null; address: string | null }): { city: string; state: string } {
  const displayName = club.geocode_display_name || club.address || ''
  const parts = displayName.split(',').map(p => p.trim())

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

export async function GET() {
  try {
    console.log('=== CLUB LOCATIONS API CALLED ===')

    // Query clubs table directly with pre-calculated active_lifters_count
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('usaw_clubs')
      .select('club_name, address, latitude, longitude, geocode_display_name, active_lifters_count, community_designation')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError)
      throw new Error(`Database error: ${clubsError.message}`)
    }

    // Collegiate status via usaw_university_programs join (no flag column)
    const { data: universityData } = await supabaseAdmin
      .from('usaw_university_programs')
      .select('associated_usaw_club')

    const linkedClubNames = new Set(
      (universityData || [])
        .map(u => u.associated_usaw_club)
        .filter((name): name is string => Boolean(name))
    )

    console.log('Clubs fetched from database:', clubsData?.length || 0)

    // Transform to match the existing API response format
    const enrichedClubs = (clubsData || []).map((club, index) => {
      const { city, state } = parseLocation(club)

      return {
        id: index + 1,
        name: club.club_name,
        address: club.address || '',
        latitude: Number(club.latitude),
        longitude: Number(club.longitude),
        city,
        state,
        recentMemberCount: club.active_lifters_count || 0,
        slug: createClubSlug(club.club_name),
        communityDesignation: club.community_designation || null,
        isCollegiate: linkedClubNames.has(club.club_name)
      }
    })

    // Filter out clubs with invalid coordinates
    const validClubs = enrichedClubs.filter(club =>
      !isNaN(club.latitude) && !isNaN(club.longitude) &&
      club.latitude >= -90 && club.latitude <= 90 &&
      club.longitude >= -180 && club.longitude <= 180
    )

    console.log('Valid clubs after filtering:', validClubs.length)
    console.log('Sample club data:', validClubs.slice(0, 2).map(c => ({
      name: c.name,
      recentMemberCount: c.recentMemberCount
    })))

    const response = NextResponse.json(validClubs)

    // Add caching headers - club locations change monthly
    response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400') // 24 hours browser and CDN
    response.headers.set('CDN-Cache-Control', 'public, max-age=86400') // 24 hours CDN

    return response
  } catch (err) {
    console.error('Unexpected error in club-locations API:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to fetch club locations',
      details: errorMessage
    }, { status: 500 })
  }
}