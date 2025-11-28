import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    // Get distinct club names with recent activity - limit to most recent month for performance
    const { data: clubs, error } = await supabaseAdmin
      .from('usaw_club_rolling_metrics')
      .select('club_name')
      .not('club_name', 'eq', '-') // Exclude unaffiliated
      .eq('snapshot_month', '2025-08-01') // Use latest month only for performance
      .gt('active_members_12mo', 0) // Only clubs with active members

    if (error) {
      console.error('Error fetching clubs list:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!clubs || clubs.length === 0) {
      return NextResponse.json({ clubs: [] })
    }

    // Get unique club names and sort alphabetically
    const uniqueClubs = [...new Set(clubs.map(c => c.club_name))].sort()

    const response = NextResponse.json({
      clubs: uniqueClubs,
      totalClubs: uniqueClubs.length
    })

    // Cache for 24 hours since club list doesn't change frequently
    response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return response

  } catch (err) {
    console.error('Unexpected error in clubs list API:', err)
    return NextResponse.json({ error: 'Failed to fetch clubs list' }, { status: 500 })
  }
}