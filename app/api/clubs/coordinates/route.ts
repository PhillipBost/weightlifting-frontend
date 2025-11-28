import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const { clubNames } = await request.json()

    if (!clubNames || !Array.isArray(clubNames) || clubNames.length === 0) {
      return NextResponse.json({ error: 'clubNames array required' }, { status: 400 })
    }

    console.log(`[API] Fetching coordinates for ${clubNames.length} clubs`)

    // Fetch all clubs with coordinates
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('usaw_clubs')
      .select('club_name, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (clubsError) {
      console.error('[API] Error fetching clubs:', clubsError)
      return NextResponse.json({ error: clubsError.message }, { status: 500 })
    }

    console.log(`[API] Fetched ${clubsData?.length || 0} clubs with coordinates`)

    // Create a normalized lookup map
    const normalizeClubName = (name: string): string => {
      return name ? name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '') : ''
    }

    const clubMap: Record<string, { lat: number; lng: number }> = {}
    clubsData?.forEach((club: any) => {
      if (club.latitude && club.longitude) {
        const normalized = normalizeClubName(club.club_name)
        clubMap[normalized] = {
          lat: Number(club.latitude),
          lng: Number(club.longitude)
        }
      }
    })

    console.log(`[API] Created lookup map for ${Object.keys(clubMap).length} clubs`)

    // Find coordinates for requested clubs
    const results: Record<string, { lat: number; lng: number } | null> = {}
    clubNames.forEach((clubName: string) => {
      const normalized = normalizeClubName(clubName)
      results[clubName] = clubMap[normalized] || null
    })

    console.log(`[API] Matched ${Object.values(results).filter(r => r !== null).length} out of ${clubNames.length} clubs`)

    return NextResponse.json(results)
  } catch (err: any) {
    console.error('[API] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
