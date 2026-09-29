import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import ClubDirectoryClient from '../components/Club/ClubDirectoryClient'
import { createClubSlug } from '@/lib/clubs/slug'
import type { UniversityProgram } from '@/types/university'

// Enable ISR with 24-hour revalidation
export const revalidate = 86400

// Initialize Supabase Admin client for server-side fetching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const metadata: Metadata = {
  title: 'Club Directory - USA Weightlifting',
  description: 'Directory of all USA Weightlifting barbell clubs, including locations, active lifter statistics, and quadrant analysis.',
}

// Helper function to parse city and state from geocode display name or address
function parseLocation(club: { geocode_display_name: string | null; address: string | null }): { city: string; state: string } {
  const displayName = club.geocode_display_name || club.address || ''
  const parts = displayName.split(',').map(p => p.trim())

  // Common formats: "City, State" or "Address, City, State" or "Address, City, State, Country"
  if (parts.length >= 2) {
    const state = parts[parts.length - 1]
    const city = parts[parts.length - 2]

    // Filter out country names and zip codes
    if (state && !state.match(/^\d/) && state.length <= 20) {
      return { city, state }
    }
  }

  return { city: '', state: '' }
}

async function getClubData() {
  try {
    // 1. Fetch club locations data
    const { data: clubsData, error: clubsError } = await supabase
      .from('usaw_clubs')
      .select('club_name, address, latitude, longitude, geocode_display_name, active_lifters_count, community_designation')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (clubsError) throw clubsError

    // 1b. University programs: linked clubs get the "Collegiate Program" badge;
    //     unlinked programs render in the directory's University Programs section.
    const { data: universityData, error: universityError } = await supabase
      .from('usaw_university_programs')
      .select('program_id, school_name, state, city, associated_usaw_club, instagram, website_url')
      .order('school_name')

    if (universityError) throw universityError

    const universities: UniversityProgram[] = universityData || []
    const linkedClubNames = new Set(
      universities
        .map(u => u.associated_usaw_club)
        .filter((name): name is string => Boolean(name))
    )

    // Transform to match expected format
    const clubLocations = (clubsData || []).map((club, index) => {
      const { city, state } = parseLocation(club)

      return {
        id: index + 1,
        name: club.club_name,
        address: club.address || '',
        latitude: Number(club.latitude),
        longitude: Number(club.longitude),
        city,
        state,
        recentMemberCount: club.active_lifters_count || 0,
        slug: createClubSlug(club.club_name),
        communityDesignation: club.community_designation || null,
        isCollegiate: linkedClubNames.has(club.club_name)
      }
    }).filter(club =>
      !isNaN(club.latitude) && !isNaN(club.longitude) &&
      club.latitude >= -90 && club.latitude <= 90 &&
      club.longitude >= -180 && club.longitude <= 180
    )

    // 2. Fetch quadrant data
    const { data: quadrantClubsData, error: quadrantError } = await supabase
      .from('usaw_clubs')
      .select('club_name, address, latitude, longitude, geocode_display_name, wso_geography, active_lifters_count, activity_factor, total_participations, recent_meets_count')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gt('active_lifters_count', 0) // Only competition clubs

    if (quadrantError) throw quadrantError

    // Hard-coded quad quadrant thresholds
    const LIFTERS_THRESHOLD = 20
    const ACTIVITY_THRESHOLD_POWERHOUSE = 2.75
    const ACTIVITY_THRESHOLD_INTENSIVE = 2.25

    // Categorize clubs into quadrants
    const enhancedClubs = (quadrantClubsData || []).map(club => {
      const { city, state } = parseLocation(club)
      const activityFactor = club.activity_factor || 0

      let quadrant: 'powerhouse' | 'intensive' | 'sleeping-giant' | 'developing'
      let quadrant_label: string

      if (club.active_lifters_count >= 20 && activityFactor >= 2.75) {
        quadrant = 'powerhouse'
        quadrant_label = 'Powerhouse'
      } else if (club.active_lifters_count <= 19 && activityFactor >= 2.25) {
        quadrant = 'intensive'
        quadrant_label = 'Intensive'
      } else if (club.active_lifters_count >= 20 && activityFactor < 2.75) {
        quadrant = 'sleeping-giant'
        quadrant_label = 'Sleeping Giant'
      } else {
        quadrant = 'developing'
        quadrant_label = 'Developing'
      }

      return {
        club_name: club.club_name,
        active_lifters_count: club.active_lifters_count,
        activity_factor: Number(activityFactor.toFixed(2)),
        total_participations: club.total_participations || 0,
        recent_meets_count: club.recent_meets_count || 0,
        address: club.address || '',
        city,
        state,
        latitude: Number(club.latitude),
        longitude: Number(club.longitude),
        wso_geography: club.wso_geography || '',
        quadrant,
        quadrant_label
      }
    })

    // Calculate quadrant statistics
    const stats = {
      powerhouse: { count: 0, avgLifters: 0, avgActivity: 0 },
      intensive: { count: 0, avgLifters: 0, avgActivity: 0 },
      'sleeping-giant': { count: 0, avgLifters: 0, avgActivity: 0 },
      developing: { count: 0, avgLifters: 0, avgActivity: 0 }
    }

    enhancedClubs.forEach(club => {
      const quadrantStats = stats[club.quadrant]
      quadrantStats.count++
      quadrantStats.avgLifters += club.active_lifters_count
      quadrantStats.avgActivity += club.activity_factor
    })

    // Calculate averages
    Object.keys(stats).forEach(quadrant => {
      const quadrantKey = quadrant as keyof typeof stats
      const quadrantStats = stats[quadrantKey]
      if (quadrantStats.count > 0) {
        quadrantStats.avgLifters = Math.round((quadrantStats.avgLifters / quadrantStats.count) * 10) / 10
        quadrantStats.avgActivity = Math.round((quadrantStats.avgActivity / quadrantStats.count) * 100) / 100
      }
    })

    // 3. Calculate overall stats
    const totalClubs = clubLocations.length
    const activeClubs = clubLocations.filter(club => club.recentMemberCount > 0).length
    const states = clubLocations.map(club => club.state).filter(Boolean)
    const uniqueStates = new Set(states)
    const statesCount = uniqueStates.size
    const totalMembers = clubLocations.reduce((sum, club) => sum + club.recentMemberCount, 0)
    const averageMembersPerClub = totalClubs > 0 ? Math.round(totalMembers / totalClubs * 10) / 10 : 0
    const collegiateClubs = clubLocations.filter(club => club.isCollegiate).length
    const designatedClubs = clubLocations.filter(club => club.communityDesignation).length

    // Programs shown in the directory section: unlinked programs, plus linked
    // programs whose club has no profile page yet (non-geocoded clubs 404 on
    // /club/[slug], so they would otherwise be unreachable). Linked-to-geocoded
    // programs live on their club's canonical profile page instead.
    const geocodedSlugs = new Set(clubLocations.map(c => c.slug))
    const sectionUniversities = universities.filter(u =>
      !u.associated_usaw_club || !geocodedSlugs.has(createClubSlug(u.associated_usaw_club))
    )

    return {
      clubLocations,
      quadrantData: {
        clubs: enhancedClubs,
        stats,
        boundaries: {
          liftersMedian: LIFTERS_THRESHOLD,
          activityMedian: ACTIVITY_THRESHOLD_POWERHOUSE
        },
        totalClubs: enhancedClubs.length
      },
      clubStats: {
        totalClubs,
        activeClubs,
        statesCount,
        averageMembersPerClub,
        collegiateClubs,
        designatedClubs
      },
      universityPrograms: sectionUniversities,
      linkedUniversityCount: universities.filter(u => u.associated_usaw_club).length
    }
  } catch (err) {
    console.error('Error fetching club data:', err)
    return {
      clubLocations: [],
      quadrantData: {
        clubs: [],
        stats: {
          powerhouse: { count: 0, avgLifters: 0, avgActivity: 0 },
          intensive: { count: 0, avgLifters: 0, avgActivity: 0 },
          'sleeping-giant': { count: 0, avgLifters: 0, avgActivity: 0 },
          developing: { count: 0, avgLifters: 0, avgActivity: 0 }
        },
        boundaries: { liftersMedian: 0, activityMedian: 0 },
        totalClubs: 0
      },
      clubStats: {
        totalClubs: 0,
        activeClubs: 0,
        statesCount: 0,
        averageMembersPerClub: 0,
        collegiateClubs: 0,
        designatedClubs: 0
      },
      universityPrograms: [],
      linkedUniversityCount: 0
    }
  }
}

export default async function ClubDirectoryPage() {
  const clubData = await getClubData()

  return <ClubDirectoryClient clubData={clubData} />
}
