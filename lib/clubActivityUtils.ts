import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Get Supabase admin client - creates on demand to avoid module-level env var issues
 */
function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * Standardized interface for club data with activity metrics
 */
export interface ClubWithActivity {
  club_name: string
  address: string | null
  latitude: number
  longitude: number
  wso_geography: string | null
  geocode_display_name: string | null
  activeLiftersCount: number
  totalParticipations: number
  uniqueMeets: number
}

/**
 * Fetch all clubs with valid coordinates from the database
 */
export async function fetchClubsWithCoordinates() {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: clubsData, error: clubsError } = await supabaseAdmin
    .from('usaw_clubs')
    .select('club_name, address, latitude, longitude, wso_geography, geocode_display_name')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

  if (clubsError) {
    throw new Error(`Error fetching clubs: ${clubsError.message}`)
  }

  return clubsData || []
}

/**
 * Fetch activity data from meet_results for the last 24 months
 */
export async function fetchRecentActivity() {
  const supabaseAdmin = getSupabaseAdmin()

  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  const twoYearsAgoString = twoYearsAgo.toISOString().split('T')[0]

  const { data: activityData, error: activityError } = await supabaseAdmin
    .from('usaw_meet_results')
    .select('club_name, lifter_id, meet_id, date')
    .gte('date', twoYearsAgoString)
    .not('club_name', 'is', null)

  if (activityError) {
    throw new Error(`Error fetching activity data: ${activityError.message}`)
  }

  return activityData || []
}

/**
 * Calculate activity metrics for all clubs based on meet results
 * Returns a map of club_name -> activity metrics
 */
export function calculateClubActivityMetrics(activityData: Array<{
  club_name: string
  lifter_id: string | number
  meet_id?: string | number
  date: string
}>) {
  const clubMetrics: Record<string, {
    lifters: Set<string>
    participations: number
    meets: Set<string>
  }> = {}

  // Process each result record
  activityData.forEach(result => {
    if (!result.club_name || !result.lifter_id) return

    const clubName = result.club_name.trim()

    if (!clubMetrics[clubName]) {
      clubMetrics[clubName] = {
        lifters: new Set(),
        participations: 0,
        meets: new Set()
      }
    }

    clubMetrics[clubName].lifters.add(result.lifter_id.toString())
    clubMetrics[clubName].participations++

    if (result.meet_id) {
      clubMetrics[clubName].meets.add(result.meet_id.toString())
    }
  })

  // Convert to final format with counts
  const metricsMap: Record<string, {
    activeLiftersCount: number
    totalParticipations: number
    uniqueMeets: number
  }> = {}

  Object.entries(clubMetrics).forEach(([clubName, metrics]) => {
    metricsMap[clubName] = {
      activeLiftersCount: metrics.lifters.size,
      totalParticipations: metrics.participations,
      uniqueMeets: metrics.meets.size
    }
  })

  return metricsMap
}

/**
 * Merge club data with activity metrics
 * Returns clubs with their activity data
 */
export function mergeClubsWithActivity(
  clubs: Array<{
    club_name: string
    address: string | null
    latitude: number | string
    longitude: number | string
    wso_geography?: string | null
    geocode_display_name?: string | null
  }>,
  activityMetrics: Record<string, {
    activeLiftersCount: number
    totalParticipations: number
    uniqueMeets: number
  }>
): ClubWithActivity[] {
  return clubs.map(club => {
    const metrics = activityMetrics[club.club_name] || {
      activeLiftersCount: 0,
      totalParticipations: 0,
      uniqueMeets: 0
    }

    return {
      club_name: club.club_name,
      address: club.address,
      latitude: Number(club.latitude),
      longitude: Number(club.longitude),
      wso_geography: club.wso_geography || null,
      geocode_display_name: club.geocode_display_name || null,
      activeLiftersCount: metrics.activeLiftersCount,
      totalParticipations: metrics.totalParticipations,
      uniqueMeets: metrics.uniqueMeets
    }
  })
}

/**
 * Main function to get all clubs with their activity metrics
 * This is the single source of truth for club activity data
 */
export async function getClubsWithActivity(): Promise<ClubWithActivity[]> {
  // Fetch clubs and activity data in parallel
  const [clubs, activityData] = await Promise.all([
    fetchClubsWithCoordinates(),
    fetchRecentActivity()
  ])

  // Calculate activity metrics
  const activityMetrics = calculateClubActivityMetrics(activityData)

  // Merge and return
  return mergeClubsWithActivity(clubs, activityMetrics)
}

/**
 * Filter clubs to only those with recent activity
 */
export function filterActiveClubs(clubs: ClubWithActivity[]): ClubWithActivity[] {
  return clubs.filter(club => club.activeLiftersCount > 0)
}
