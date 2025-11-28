import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface MonthlyAggregate {
  snapshot_month: string
  total_active_members: number
  total_competitions: number
  total_unique_lifters: number
  club_count: number
  avg_members_per_club: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || '2020-01-01'

    // Get monthly aggregates - sum all clubs for each month
    const { data: aggregates, error } = await supabaseAdmin
      .from('usaw_club_rolling_metrics')
      .select(`
        snapshot_month,
        active_members_12mo,
        total_competitions_12mo,
        unique_lifters_12mo
      `)
      .gte('snapshot_month', startDate)
      .order('snapshot_month', { ascending: true })

    if (error) {
      console.error('Error fetching monthly aggregates:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!aggregates || aggregates.length === 0) {
      return NextResponse.json({
        aggregates: [],
        summary: { totalMonths: 0, dateRange: { start: null, end: null } }
      })
    }

    // Group by month and calculate aggregates
    const monthlyData = aggregates.reduce((acc, record) => {
      const month = record.snapshot_month
      if (!acc[month]) {
        acc[month] = {
          snapshot_month: month,
          total_active_members: 0,
          total_competitions: 0,
          total_unique_lifters: 0,
          club_count: 0,
          avg_members_per_club: 0
        }
      }

      acc[month].total_active_members += record.active_members_12mo || 0
      acc[month].total_competitions += record.total_competitions_12mo || 0
      acc[month].total_unique_lifters += record.unique_lifters_12mo || 0
      acc[month].club_count += 1

      return acc
    }, {} as Record<string, MonthlyAggregate>)

    // Convert to array and add average calculations
    const monthlyAggregates = Object.values(monthlyData).map(month => ({
      ...month,
      avg_members_per_club: month.club_count > 0
        ? Math.round((month.total_active_members / month.club_count) * 100) / 100
        : 0
    }))

    // Calculate date range
    const dates = monthlyAggregates.map(m => new Date(m.snapshot_month))
    const startDateObj = new Date(Math.min(...dates.map(d => d.getTime())))
    const endDateObj = new Date(Math.max(...dates.map(d => d.getTime())))

    const response = NextResponse.json({
      aggregates: monthlyAggregates,
      summary: {
        totalMonths: monthlyAggregates.length,
        dateRange: {
          start: startDateObj.toISOString(),
          end: endDateObj.toISOString()
        }
      }
    })

    // Cache for 6 hours
    response.headers.set('Cache-Control', 'public, max-age=21600, s-maxage=21600')
    return response

  } catch (err) {
    console.error('Unexpected error in monthly aggregates API:', err)
    return NextResponse.json({ error: 'Failed to fetch monthly aggregates' }, { status: 500 })
  }
}