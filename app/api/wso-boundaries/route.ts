import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    // DEBUGGING: Disable all caching to get fresh data
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'CDN-Cache-Control': 'no-cache',
      'Vercel-CDN-Cache-Control': 'no-cache'
    }
    
    // Get WSO boundary data with pre-calculated metrics
    const { data: wsoData, error: wsoError } = await supabaseAdmin
      .from('wso_information')
      .select('*')

    if (wsoError) {
      return NextResponse.json({ error: wsoError.message }, { status: 500 })
    }

    // Calculate recent meets dynamically using 12-month window
    const currentDate = new Date()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12)
    const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0]

    // Query for meets in the last 12 months
    let dynamicMeetCounts: Record<string, number> = {}
    try {
      const { data: recentMeetResults, error: meetError } = await supabaseAdmin
        .from('meet_results')
        .select('wso, meet_id')
        .gte('date', cutoffDate)
        .not('wso', 'is', null)

      if (!meetError && recentMeetResults) {
        // Group by WSO and count unique meet_ids
        const meetsByWso: Record<string, Set<number>> = {}
        recentMeetResults.forEach(result => {
          const wsoName = result.wso?.trim()
          if (!wsoName) return
          
          if (!meetsByWso[wsoName]) {
            meetsByWso[wsoName] = new Set()
          }
          if (result.meet_id) {
            meetsByWso[wsoName].add(result.meet_id)
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

    // Use pre-calculated data from wso_information table with dynamic meet counts
    const enrichedData = wsoData.map(wso => {
      const dynamicMeetCount = dynamicMeetCounts[wso.name] || 0

      return {
        ...wso,
        recent_meets_count: dynamicMeetCount, // Use dynamic calculation instead of pre-calculated
        // Keep original field names for compatibility with frontend
        active_lifters_count: wso.active_lifters_count || 0,
        barbell_clubs_count: wso.barbell_clubs_count || 0,
        estimated_population: wso.estimated_population || 0
      }
    })

    return NextResponse.json(enrichedData, { headers })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch WSO boundaries' }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}