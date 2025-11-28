import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface ClubTimeSeries {
  snapshot_month: string
  active_members_12mo: number
  total_competitions_12mo: number
  unique_lifters_12mo: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clubName = searchParams.get('club_name')
    const startDate = searchParams.get('start_date') || '2020-01-01'

    if (!clubName) {
      return NextResponse.json({ error: 'club_name parameter is required' }, { status: 400 })
    }

    // Get time series data for specific club
    const { data: timeSeries, error } = await supabaseAdmin
      .from('usaw_club_rolling_metrics')
      .select(`
        snapshot_month,
        active_members_12mo,
        total_competitions_12mo,
        unique_lifters_12mo
      `)
      .eq('club_name', clubName)
      .gte('snapshot_month', startDate)
      .order('snapshot_month', { ascending: true })

    if (error) {
      console.error('Error fetching club time series:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!timeSeries || timeSeries.length === 0) {
      return NextResponse.json({
        clubName,
        timeSeries: [],
        summary: {
          totalDataPoints: 0,
          dateRange: { start: null, end: null },
          maxValues: {
            active_members: 0,
            total_competitions: 0,
            unique_lifters: 0
          }
        }
      })
    }

    // Calculate max values for scaling
    const maxActiveMembers = Math.max(...timeSeries.map(d => d.active_members_12mo || 0))
    const maxCompetitions = Math.max(...timeSeries.map(d => d.total_competitions_12mo || 0))
    const maxLifters = Math.max(...timeSeries.map(d => d.unique_lifters_12mo || 0))

    // Calculate date range
    const dates = timeSeries.map(d => new Date(d.snapshot_month))
    const startDateObj = new Date(Math.min(...dates.map(d => d.getTime())))
    const endDateObj = new Date(Math.max(...dates.map(d => d.getTime())))

    const response = NextResponse.json({
      clubName,
      timeSeries: timeSeries.map(record => ({
        snapshot_month: record.snapshot_month,
        active_members_12mo: record.active_members_12mo || 0,
        total_competitions_12mo: record.total_competitions_12mo || 0,
        unique_lifters_12mo: record.unique_lifters_12mo || 0
      })),
      summary: {
        totalDataPoints: timeSeries.length,
        dateRange: {
          start: startDateObj.toISOString(),
          end: endDateObj.toISOString()
        },
        maxValues: {
          active_members: maxActiveMembers,
          total_competitions: maxCompetitions,
          unique_lifters: maxLifters
        }
      }
    })

    // Cache for 1 hour
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    return response

  } catch (err) {
    console.error('Unexpected error in time series API:', err)
    return NextResponse.json({ error: 'Failed to fetch club time series' }, { status: 500 })
  }
}