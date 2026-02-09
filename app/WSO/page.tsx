import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import WSODirectoryClient from '../components/WSO/WSODirectoryClient'

// Enable ISR with 24-hour revalidation
export const revalidate = 86400

// Initialize Supabase Admin client for server-side fetching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const metadata: Metadata = {
  title: 'WSO Directory - USA Weightlifting',
  description: 'Directory of all USA Weightlifting State Organizations (WSOs), including club locations, active lifter statistics, and recent meet activity.',
}

async function getDirectoryData() {
  try {
    // 1. Get WSO boundary data with pre-calculated metrics
    const { data: wsoData, error: wsoError } = await supabase
      .from('usaw_wso_information')
      .select('*')

    if (wsoError) throw wsoError

    // 2. Calculate recent meets dynamically using 12-month window
    const currentDate = new Date()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12)
    const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0]

    // Query for meets in the last 12 months using wso_geography field
    let dynamicMeetCounts: Record<string, number> = {}

    const { data: recentMeets, error: meetError } = await supabase
      .from('usaw_meets')
      .select('wso_geography, meet_id')
      .gte('Date', cutoffDate)
      .not('wso_geography', 'is', null)
      .not('meet_id', 'is', null)

    if (!meetError && recentMeets) {
      // Group by WSO and count unique meet_ids
      const meetsByWso: Record<string, Set<number>> = {}
      recentMeets.forEach(meet => {
        const wsoName = meet.wso_geography?.trim()
        if (!wsoName) return

        if (!meetsByWso[wsoName]) {
          meetsByWso[wsoName] = new Set()
        }
        if (meet.meet_id) {
          meetsByWso[wsoName].add(meet.meet_id)
        }
      })

      // Convert to counts
      Object.keys(meetsByWso).forEach(wsoName => {
        dynamicMeetCounts[wsoName] = meetsByWso[wsoName].size
      })
    }

    // 3. Fetch clubs data for treemap visualization
    const { data: clubsData, error: clubsError } = await supabase
      .from('usaw_clubs')
      .select('club_name, wso_geography, latitude, longitude, active_lifters_count')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('club_name')

    if (clubsError) {
      console.warn('Could not fetch clubs data:', clubsError)
    }

    // Group clubs by WSO
    const clubsByWSO = new Map<string, any[]>()
    if (clubsData) {
      clubsData.forEach(club => {
        const wsoName = club.wso_geography
        if (wsoName) {
          if (!clubsByWSO.has(wsoName)) {
            clubsByWSO.set(wsoName, [])
          }
          clubsByWSO.get(wsoName)?.push(club)
        }
      })
    }

    // 4. Combine data
    const enrichedData = wsoData.map(wso => {
      const dynamicMeetCount = dynamicMeetCounts[wso.name] || 0
      const wsoClubs = clubsByWSO.get(wso.name) || []

      return {
        ...wso,
        recent_meets_count: dynamicMeetCount, // Use dynamic calculation
        // Keep original field names for compatibility
        active_lifters_count: wso.active_lifters_count || 0,
        barbell_clubs_count: wso.barbell_clubs_count || 0,
        estimated_population: wso.estimated_population || 0,
        // Add clubs data for client-side treemap
        clubs: wsoClubs.map(club => ({
          name: club.club_name,
          size: club.active_lifters_count || 0,
          latitude: club.latitude,
          longitude: club.longitude
        }))
      }
    })

    return enrichedData

  } catch (err) {
    console.error('Error fetching directory data:', err)
    return []
  }
}

export default async function WSODirectoryPage() {
  const wsoData = await getDirectoryData()

  return <WSODirectoryClient wsoData={wsoData} />
}
