import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface ClubRollingMetric {
  id: number
  club_name: string
  snapshot_month: string
  active_members_12mo: number
  total_competitions_12mo: number
  unique_lifters_12mo: number
  calculated_at: string
}

export async function GET() {
  try {
    // Get rolling metrics data ordered by date for time series
    // Implement pagination to get all data in chunks
    let allData: any[] = []
    let offset = 0
    const batchSize = 1000

    while (true) {
      const { data: batchData, error: batchError } = await supabaseAdmin
        .from('club_rolling_metrics')
        .select('*')
        .order('snapshot_month', { ascending: true })
        .order('club_name', { ascending: true })
        .range(offset, offset + batchSize - 1)

      if (batchError) {
        console.error('Error fetching club rolling metrics batch:', batchError)
        return NextResponse.json({ error: batchError.message }, { status: 500 })
      }

      if (!batchData || batchData.length === 0) {
        break // No more data
      }

      allData = [...allData, ...batchData]

      if (batchData.length < batchSize) {
        break // This was the last batch
      }

      offset += batchSize

      // Safety check to prevent infinite loops
      if (offset > 200000) {
        console.warn('Pagination safety limit reached')
        break
      }
    }

    const metricsData = allData

    if (!metricsData || metricsData.length === 0) {
      return NextResponse.json({
        metrics: [],
        clubs: [],
        dateRange: { start: null, end: null },
        summary: {
          totalDataPoints: 0,
          uniqueClubs: 0,
          dateSpan: 0
        },
        message: "No club rolling metrics data found. The table may be empty or not yet populated."
      })
    }

    // Transform data for charting
    const metrics: ClubRollingMetric[] = metricsData.map(record => ({
      id: record.id,
      club_name: record.club_name,
      snapshot_month: record.snapshot_month,
      active_members_12mo: record.active_members_12mo || 0,
      total_competitions_12mo: record.total_competitions_12mo || 0,
      unique_lifters_12mo: record.unique_lifters_12mo || 0,
      calculated_at: record.calculated_at
    }))

    // Get unique clubs for color assignment
    const uniqueClubs = [...new Set(metrics.map(m => m.club_name))].sort()

    // Calculate date range
    const dates = metrics.map(m => new Date(m.snapshot_month))
    const startDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())))

    // Summary statistics
    const summary = {
      totalDataPoints: metrics.length,
      uniqueClubs: uniqueClubs.length,
      dateSpan: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    }

    const responseData = {
      metrics,
      clubs: uniqueClubs,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary
    }

    const response = NextResponse.json(responseData)

    // Add caching headers - rolling metrics change daily
    response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400') // 24 hours browser and CDN
    response.headers.set('CDN-Cache-Control', 'public, max-age=86400') // 24 hours CDN

    return response
  } catch (err) {
    console.error('Unexpected error in club-rolling-metrics API:', err)
    return NextResponse.json({ error: 'Failed to fetch club rolling metrics data' }, { status: 500 })
  }
}