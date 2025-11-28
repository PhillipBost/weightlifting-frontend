import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface TopClub {
  club_name: string
  active_members_12mo: number
  total_competitions_12mo: number
  unique_lifters_12mo: number
  rank_by_members: number
  rank_by_competitions: number
  rank_by_lifters: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') || '2024-06-01'
    const limit = parseInt(searchParams.get('limit') || '20')
    const metric = searchParams.get('metric') || 'active_members_12mo' // active_members_12mo, total_competitions_12mo, unique_lifters_12mo

    if (limit > 50) {
      return NextResponse.json({ error: 'Limit cannot exceed 50 clubs' }, { status: 400 })
    }

    // Get data for specific month, ordered by requested metric
    const { data: clubData, error } = await supabaseAdmin
      .from('usaw_club_rolling_metrics')
      .select(`
        club_name,
        active_members_12mo,
        total_competitions_12mo,
        unique_lifters_12mo
      `)
      .eq('snapshot_month', month)
      .not('club_name', 'eq', '-') // Exclude unaffiliated
      .gt(metric, 0) // Only include clubs with data for the selected metric
      .order(metric, { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching top clubs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!clubData || clubData.length === 0) {
      return NextResponse.json({
        month,
        metric,
        topClubs: [],
        summary: {
          totalClubs: 0,
          maxValues: {
            active_members: 0,
            total_competitions: 0,
            unique_lifters: 0
          }
        }
      })
    }

    // Add ranking information
    const topClubs: TopClub[] = clubData.map((club, index) => ({
      club_name: club.club_name,
      active_members_12mo: club.active_members_12mo || 0,
      total_competitions_12mo: club.total_competitions_12mo || 0,
      unique_lifters_12mo: club.unique_lifters_12mo || 0,
      rank_by_members: index + 1, // Since we're sorting by the metric, this gives us the rank
      rank_by_competitions: index + 1,
      rank_by_lifters: index + 1
    }))

    // Calculate max values for scaling
    const maxActiveMembers = Math.max(...topClubs.map(c => c.active_members_12mo))
    const maxCompetitions = Math.max(...topClubs.map(c => c.total_competitions_12mo))
    const maxLifters = Math.max(...topClubs.map(c => c.unique_lifters_12mo))

    const response = NextResponse.json({
      month,
      metric,
      topClubs,
      summary: {
        totalClubs: topClubs.length,
        maxValues: {
          active_members: maxActiveMembers,
          total_competitions: maxCompetitions,
          unique_lifters: maxLifters
        }
      }
    })

    // Cache for 2 hours
    response.headers.set('Cache-Control', 'public, max-age=7200, s-maxage=7200')
    return response

  } catch (err) {
    console.error('Unexpected error in top clubs API:', err)
    return NextResponse.json({ error: 'Failed to fetch top clubs' }, { status: 500 })
  }
}