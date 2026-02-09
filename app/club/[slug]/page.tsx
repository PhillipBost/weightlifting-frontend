import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import ClubDetailClient from '../../components/Club/ClubDetailClient'

// Initialize Supabase Admin client for server-side fetching
// Using Service Role key to bypass RLS and ensure complete data access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Enable ISR with 24-hour revalidation
export const revalidate = 86400

// Types
interface ClubData {
  club_name: string
  active_lifters_count: number
  activity_factor: number
  total_participations: number
  recent_meets_count: number
  address: string
  city: string
  state: string
  latitude: number
  longitude: number
  wso_geography: string
  quadrant: 'powerhouse' | 'intensive' | 'sleeping-giant' | 'developing'
  quadrant_label: string
}

// Helper function to parse location from geocode display name or address
function parseLocation(club: any): { city: string; state: string } {
  const displayName = club.geocode_display_name || club.address || ''
  const parts = displayName.split(',').map((p: string) => p.trim())

  if (parts.length >= 2) {
    const state = parts[parts.length - 1]
    const city = parts[parts.length - 2]

    if (state && !state.match(/^\d/) && state.length <= 20) {
      return { city, state }
    }
  }

  return { city: '', state: '' }
}

// Helper to calculate quadrant
function calculateQuadrant(liftersCount: number, activityFactor: number) {
  let quadrant: 'powerhouse' | 'intensive' | 'sleeping-giant' | 'developing'
  let quadrant_label: string

  if (liftersCount >= 20 && activityFactor >= 2.75) {
    quadrant = 'powerhouse'
    quadrant_label = 'Powerhouse'
  } else if (liftersCount <= 19 && activityFactor >= 2.25) {
    quadrant = 'intensive'
    quadrant_label = 'Intensive'
  } else if (liftersCount >= 20 && activityFactor < 2.75) {
    quadrant = 'sleeping-giant'
    quadrant_label = 'Sleeping Giant'
  } else {
    quadrant = 'developing'
    quadrant_label = 'Developing'
  }

  return { quadrant, quadrant_label }
}

// 5-year age buckets helper
function getAgeBucket(age: number): string {
  if (age < 15) return 'Under 15'
  if (age >= 100) return '100+'
  const start = Math.floor(age / 5) * 5
  return `${start}-${start + 4}`
}

async function getClubData(slug: string) {
  try {
    // 1. Find the club
    const words = slug.split('-').filter(w => w.length > 0)
    const processedWords = words.map(word => {
      if (word.length === 2) return word.split('').join('%')
      return word
    })
    const simplePattern = processedWords.join('%')

    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('usaw_clubs')
      .select(`
        club_name,
        active_lifters_count,
        activity_factor,
        total_participations,
        recent_meets_count,
        address,
        latitude,
        longitude,
        wso_geography,
        geocode_display_name
      `)
      .ilike('club_name', `%${simplePattern}%`)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(10)

    if (clubsError || !clubsData || clubsData.length === 0) {
      return null
    }

    // Determine best match
    const targetSlug = slug.toLowerCase()
    let bestMatch = clubsData[0]

    // Exact match check
    const exactMatch = clubsData.find(club => {
      const clubSlug = (club.club_name || '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      return clubSlug === targetSlug
    })

    if (exactMatch) bestMatch = exactMatch

    const { city, state } = parseLocation(bestMatch)
    const { quadrant, quadrant_label } = calculateQuadrant(
      bestMatch.active_lifters_count || 0,
      Number(bestMatch.activity_factor || 0)
    )

    const clubData: ClubData = {
      club_name: bestMatch.club_name,
      active_lifters_count: bestMatch.active_lifters_count || 0,
      activity_factor: Number(bestMatch.activity_factor || 0),
      total_participations: bestMatch.total_participations || 0,
      recent_meets_count: bestMatch.recent_meets_count || 0,
      address: bestMatch.address || '',
      city,
      state,
      latitude: Number(bestMatch.latitude),
      longitude: Number(bestMatch.longitude),
      wso_geography: bestMatch.wso_geography || '',
      quadrant,
      quadrant_label
    }

    // 2. Fetch Demographics
    const twoYearsAgo = new Date()
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    const dateStr = twoYearsAgo.toISOString().split('T')[0]

    const { data: results } = await supabaseAdmin
      .from('usaw_meet_results')
      .select('gender, competition_age, meet_name, date, meet_id')
      .eq('club_name', bestMatch.club_name)
      .gte('date', dateStr)

    // Process demographics
    const genderCounts: Record<string, number> = { M: 0, F: 0 }
    const ageCounts: Record<string, number> = {}
    const meetsAttended = new Set<string>()
    let totalEntries = 0
    let totalAgeEntries = 0

    if (results) {
      results.forEach(r => {
        if (r.gender === 'M' || r.gender === 'F') {
          genderCounts[r.gender]++
          totalEntries++
        }
        if (r.competition_age) {
          const bucket = getAgeBucket(r.competition_age)
          ageCounts[bucket] = (ageCounts[bucket] || 0) + 1
          totalAgeEntries++
        }
        const meetKey = r.meet_id ? String(r.meet_id) : `${r.meet_name}|${r.date}`
        meetsAttended.add(meetKey)
      })
    }

    const demographics = {
      gender: [
        { name: 'Male', value: totalEntries ? (genderCounts.M / totalEntries) * 100 : 0 },
        { name: 'Female', value: totalEntries ? (genderCounts.F / totalEntries) * 100 : 0 }
      ],
      age: Object.entries(ageCounts)
        .map(([range, count]) => ({
          range,
          count,
          percentage: totalAgeEntries ? (count / totalAgeEntries) * 100 : 0
        }))
        .sort((a, b) => {
          const getStartAge = (range: string) => {
            if (range === 'Under 15') return 0
            if (range === '100+') return 100
            return parseInt(range.split('-')[0])
          }
          return getStartAge(a.range) - getStartAge(b.range)
        })
    }

    // 3. Fetch Competition Reach (Spokes)
    let spokes: any[] = []
    const uniqueMeetIds = Array.from(meetsAttended).filter(m => !m.includes('|')).map(m => parseInt(m))

    if (uniqueMeetIds.length > 0) {
      const { data: meetsData } = await supabaseAdmin
        .from('usaw_meets')
        .select('meet_id, latitude, longitude, city, state, Meet')
        .in('meet_id', uniqueMeetIds)
        .not('latitude', 'is', null)

      const foundMeetIds = new Set<number>()
      if (meetsData) {
        meetsData.forEach(m => {
          spokes.push({
            name: m.Meet || m.city || 'Unknown Meet',
            lat: m.latitude,
            lng: m.longitude,
            count: results ? results.filter(r => r.meet_id === m.meet_id).length : 0,
            meet_id: m.meet_id
          })
          foundMeetIds.add(m.meet_id)
        })
      }

      // Try locations table for missing IDs
      const missingIds = uniqueMeetIds.filter(id => !foundMeetIds.has(id))
      if (missingIds.length > 0) {
        const { data: locData } = await supabaseAdmin
          .from('usaw_meet_locations')
          .select('meet_id, latitude, longitude, city, state, meet_name')
          .in('meet_id', missingIds)
          .not('latitude', 'is', null)

        if (locData) {
          locData.forEach(l => {
            spokes.push({
              name: l.meet_name || l.city || 'Unknown Location',
              lat: l.latitude,
              lng: l.longitude,
              count: results ? results.filter(r => r.meet_id === l.meet_id).length : 0,
              meet_id: l.meet_id
            })
          })
        }
      }
    }

    // Static averages
    const avgGenderDist = [
      { name: 'Male', value: 48.0 },
      { name: 'Female', value: 52.0 }
    ]
    const avgAgeDist = [
      { range: 'Under 15', percentage: 11.9 },
      { range: '15-19', percentage: 16.8 },
      { range: '20-24', percentage: 13.4 },
      { range: '25-29', percentage: 14.3 },
      { range: '30-34', percentage: 12.1 },
      { range: '35-39', percentage: 10.3 },
      { range: '40-44', percentage: 8.6 },
      { range: '45-49', percentage: 5.1 },
      { range: '50-54', percentage: 2.9 },
      { range: '55-59', percentage: 2.0 },
      { range: '60-64', percentage: 1.2 },
      { range: '65-69', percentage: 0.8 },
      { range: '70-74', percentage: 0.4 },
      { range: '75-79', percentage: 0.2 },
      { range: '80-84', percentage: 0.05 },
      { range: '85-89', percentage: 0.0 },
      { range: '90-94', percentage: 0.0 }
    ]

    return {
      clubData,
      demographicsData: {
        clubName: bestMatch.club_name,
        demographics,
        averageClub: {
          gender: avgGenderDist,
          age: avgAgeDist
        },
        competitionReach: {
          spokes
        }
      }
    }

  } catch (err) {
    console.error('Error fetching club data:', err)
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const words = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return {
    title: `${words} - Weightlifting Club Profile`,
    description: `View club statistics, demographics, and competition history for ${words}.`,
  }
}

// Generate static params for all clubs to pre-render at build time
export async function generateStaticParams() {
  try {
    const { data: clubs } = await supabaseAdmin
      .from('usaw_clubs')
      .select('club_name')
      .not('latitude', 'is', null)
      .limit(1000) // Limit to 1000 most active clubs for initial build to avoid timeout

    if (!clubs) return []

    return clubs.map((club) => ({
      slug: club.club_name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }))
  } catch (err) {
    console.error('Error generating static params:', err)
    return []
  }
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getClubData(slug)

  if (!data) {
    notFound()
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-app-gradient flex items-center justify-center p-8 text-xl text-app-primary">Loading Club Data...</div>}>
      <ClubDetailClient
        clubData={data.clubData}
        demographicsData={data.demographicsData}
      />
    </Suspense>
  )
}
