import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

interface HistoricalRequest {
  clubCount?: number
  sortBy?: 'peak' | 'recent' | 'average'
  minActivityThreshold?: number
  timeRangeYears?: number
  wsoFilter?: string
  displayMetric?: 'members' | 'activity' | 'participations'
}

interface ClubTimeSeriesData {
  club_name: string
  data_points: Array<{
    snapshot_month: string
    active_members_12mo: number
    activity_factor: number
    total_competitions_12mo: number
  }>
}

interface HistoricalResponse {
  success: boolean
  data: {
    months: string[]
    clubs: string[]
    series: Array<{
      name: string
      data: number[]
    }>
  }
  metadata: {
    clubCount: number
    dataPointsPerClub: number
    totalDataPoints: number
    timeRangeYears: number
    activeClubsTotal: number
    wsoFilter?: string
  }
}

export async function POST(request: Request) {
  try {
    const body: HistoricalRequest = await request.json()

    const {
      clubCount = 25,
      sortBy = 'recent',
      minActivityThreshold = 1,
      timeRangeYears = 10,
      wsoFilter = 'all',
      displayMetric = 'members'
    } = body

    // Validate parameters
    if (clubCount < 1 || clubCount > 100) {
      return NextResponse.json({
        success: false,
        error: 'clubCount must be between 1 and 100'
      }, { status: 400 })
    }

    if (!['peak', 'recent', 'average'].includes(sortBy)) {
      return NextResponse.json({
        success: false,
        error: 'sortBy must be peak, recent, or average'
      }, { status: 400 })
    }

    // Calculate date range - extend much further back for historical data
    const endDate = new Date()
    const startDate = new Date()

    // Use appropriate time range - extend to full historical data for "all time"
    const actualTimeRange = timeRangeYears > 12 ? 25 : timeRangeYears // Go back to ~1999 for full data
    startDate.setFullYear(endDate.getFullYear() - actualTimeRange)

    const startDateStr = startDate.toISOString().substring(0, 10)
    const endDateStr = endDate.toISOString().substring(0, 10)

    // Get the most recent snapshot to identify active clubs
    console.log('Fetching most recent snapshot...')
    const { data: recentSnapshot, error: recentError } = await supabaseAdmin
      .from('club_rolling_metrics')
      .select('snapshot_month')
      .order('snapshot_month', { ascending: false })
      .limit(1)
      .single()

    if (recentError) {
      console.error('Error fetching recent snapshot:', recentError)
      console.log('Supabase URL:', supabaseUrl ? 'Present' : 'Missing')
      console.log('Service Key:', supabaseServiceKey ? 'Present' : 'Missing')
      return NextResponse.json({
        success: false,
        error: `Failed to fetch recent snapshot data: ${recentError.message}`
      }, { status: 500 })
    }

    console.log('Most recent snapshot found:', recentSnapshot?.snapshot_month)

    const mostRecentMonth = recentSnapshot.snapshot_month

    // Get currently active clubs (clubs with recent activity > threshold)
    const selectFields = displayMetric === 'activity' ?
      'club_name, active_members_12mo, activity_factor' :
      displayMetric === 'participations' ?
      'club_name, active_members_12mo, total_competitions_12mo' :
      'club_name, active_members_12mo'

    let activeClubsQuery = supabaseAdmin
      .from('club_rolling_metrics')
      .select(selectFields)
      .eq('snapshot_month', mostRecentMonth)
      .gte('active_members_12mo', minActivityThreshold)

    // Add WSO filtering if specified
    if (wsoFilter && wsoFilter !== 'all') {
      console.log('Applying WSO filter:', wsoFilter)

      // Get clubs that belong to the specified WSO
      const { data: wsoClubs, error: wsoClubsError } = await supabaseAdmin
        .from('clubs')
        .select('club_name')
        .eq('wso_geography', wsoFilter)
        .not('club_name', 'is', null)

      if (wsoClubsError) {
        console.error('Error fetching WSO clubs:', wsoClubsError)
      } else if (wsoClubs && wsoClubs.length > 0) {
        const wsoClubNames = wsoClubs.map(c => c.club_name)
        console.log(`Found ${wsoClubNames.length} clubs in ${wsoFilter}:`, wsoClubNames.slice(0, 5))

        // Filter active clubs to only include those in the WSO
        activeClubsQuery = activeClubsQuery.in('club_name', wsoClubNames)
      } else {
        console.log(`No clubs found for WSO: ${wsoFilter}`)
      }
    }

    const orderField = displayMetric === 'activity' ? 'activity_factor' :
                     displayMetric === 'participations' ? 'total_competitions_12mo' :
                     'active_members_12mo'

    const { data: activeClubs, error: activeError } = await activeClubsQuery
      .order(orderField, { ascending: false })

    if (activeError) {
      console.error('Error fetching active clubs:', activeError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch active clubs'
      }, { status: 500 })
    }

    if (!activeClubs || activeClubs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          months: [],
          clubs: [],
          series: []
        },
        metadata: {
          clubCount: 0,
          dataPointsPerClub: 0,
          totalDataPoints: 0,
          timeRangeYears: actualTimeRange,
          activeClubsTotal: 0,
          wsoFilter
        }
      })
    }

    // Apply sorting logic to determine which clubs to include
    let selectedClubs: string[]

    if (sortBy === 'recent') {
      // Already sorted by recent activity
      selectedClubs = activeClubs.slice(0, clubCount).map(c => c.club_name)
    } else {
      // For peak/average, use a simplified approach focusing on recent active clubs
      const topActiveClubs = activeClubs.slice(0, Math.min(clubCount * 2, 50)) // Limit to prevent query issues
      const clubNames = topActiveClubs.map(c => c.club_name)

      try {
        // Query last 2 years of data for peak/average calculations - more efficient
        const calcStartDate = new Date()
        calcStartDate.setFullYear(calcStartDate.getFullYear() - 2)
        const calcStartDateStr = calcStartDate.toISOString().substring(0, 10)

        const historicalSelectFields = displayMetric === 'activity' ?
          'club_name, active_members_12mo, activity_factor' :
          displayMetric === 'participations' ?
          'club_name, active_members_12mo, total_competitions_12mo' :
          'club_name, active_members_12mo'

        const { data: historicalData, error: historicalError } = await supabaseAdmin
          .from('club_rolling_metrics')
          .select(historicalSelectFields)
          .in('club_name', clubNames)
          .gte('snapshot_month', calcStartDateStr)
          .lte('snapshot_month', endDateStr)

        if (historicalError || !historicalData) {
          console.error('Error fetching historical data for sorting:', historicalError)
          // Fall back to recent sorting
          selectedClubs = activeClubs.slice(0, clubCount).map(c => c.club_name)
        } else {
          // Calculate peak or average for each club
          const clubStats: Record<string, { peak: number; average: number; count: number; total: number }> = {}

          // Initialize clubs with their current values as baseline
          topActiveClubs.forEach(club => {
            const currentValue = displayMetric === 'activity' ? (club as any).activity_factor :
                               displayMetric === 'participations' ? (club as any).total_competitions_12mo :
                               club.active_members_12mo
            clubStats[club.club_name] = {
              peak: currentValue || 0,
              average: currentValue || 0,
              count: 1,
              total: currentValue || 0
            }
          })

          // Process historical data
          historicalData.forEach(row => {
            const stats = clubStats[row.club_name]
            const value = displayMetric === 'activity' ? (row as any).activity_factor :
                         displayMetric === 'participations' ? (row as any).total_competitions_12mo :
                         row.active_members_12mo
            if (stats && typeof value === 'number') {
              stats.peak = Math.max(stats.peak, value)
              stats.total += value
              stats.count++
            }
          })

          // Calculate final averages
          Object.values(clubStats).forEach(stats => {
            stats.average = stats.count > 0 ? stats.total / stats.count : 0
          })

          // Sort by chosen metric
          const sortedClubs = clubNames.sort((a, b) => {
            const statsA = clubStats[a]
            const statsB = clubStats[b]
            if (!statsA || !statsB) return 0

            const valueA = sortBy === 'peak' ? statsA.peak : statsA.average
            const valueB = sortBy === 'peak' ? statsB.peak : statsB.average
            return valueB - valueA
          })

          selectedClubs = sortedClubs.slice(0, clubCount)
        }
      } catch (error) {
        console.error('Exception in peak/average calculation:', error)
        // Fall back to recent sorting
        selectedClubs = activeClubs.slice(0, clubCount).map(c => c.club_name)
      }
    }

    // Get complete historical data for selected clubs
    const timeSeriesSelectFields = displayMetric === 'activity' ?
      'club_name, snapshot_month, active_members_12mo, activity_factor' :
      displayMetric === 'participations' ?
      'club_name, snapshot_month, active_members_12mo, total_competitions_12mo' :
      'club_name, snapshot_month, active_members_12mo'

    const { data: timeSeriesData, error: timeSeriesError } = await supabaseAdmin
      .from('club_rolling_metrics')
      .select(timeSeriesSelectFields)
      .in('club_name', selectedClubs)
      .gte('snapshot_month', startDateStr)
      .lte('snapshot_month', endDateStr)
      .order('snapshot_month')
      .order('club_name')

    if (timeSeriesError) {
      console.error('Error fetching time series data:', timeSeriesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch time series data'
      }, { status: 500 })
    }

    if (!timeSeriesData || timeSeriesData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          months: [],
          clubs: selectedClubs,
          series: selectedClubs.map(club => ({ name: club, data: [] }))
        },
        metadata: {
          clubCount: selectedClubs.length,
          dataPointsPerClub: 0,
          totalDataPoints: 0,
          timeRangeYears: actualTimeRange,
          activeClubsTotal: activeClubs.length,
          wsoFilter
        }
      })
    }

    // Get unique months and sort them
    const uniqueMonths = [...new Set(timeSeriesData.map(row => row.snapshot_month))]
      .sort()
      .map(date => new Date(date).toISOString().substring(0, 10))

    // Organize data by club
    const clubDataMap: Record<string, Record<string, number>> = {}

    timeSeriesData.forEach(row => {
      if (!clubDataMap[row.club_name]) {
        clubDataMap[row.club_name] = {}
      }
      const monthKey = new Date(row.snapshot_month).toISOString().substring(0, 10)
      const value = displayMetric === 'activity' ? (row as any).activity_factor :
                   displayMetric === 'participations' ? (row as any).total_competitions_12mo :
                   row.active_members_12mo
      clubDataMap[row.club_name][monthKey] = value || 0
    })

    // Create series data for each selected club
    const series = selectedClubs.map(clubName => ({
      name: clubName,
      data: uniqueMonths.map(month => clubDataMap[clubName]?.[month] || 0)
    }))

    const response: HistoricalResponse = {
      success: true,
      data: {
        months: uniqueMonths,
        clubs: selectedClubs,
        series
      },
      metadata: {
        clubCount: selectedClubs.length,
        dataPointsPerClub: uniqueMonths.length,
        totalDataPoints: selectedClubs.length * uniqueMonths.length,
        timeRangeYears: actualTimeRange,
        activeClubsTotal: activeClubs.length,
        wsoFilter
      }
    }

    const nextResponse = NextResponse.json(response)
    nextResponse.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600') // 1 hour cache

    return nextResponse

  } catch (error) {
    console.error('Error in club-rolling-metrics historical API:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch club rolling metrics historical data'
    }, { status: 500 })
  }
}