import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to convert slug to club name pattern
function slugToClubNamePattern(slug: string): string {
  // Convert slug back to something we can search for
  // Example: "crossfit-empire" -> "crossfit empire" or "CrossFit Empire"
  return slug.replace(/-/g, ' ')
}

// Helper function to parse location from geocode display name or address
function parseLocation(club: any): { city: string; state: string } {
  const displayName = club.geocode_display_name || club.address || ''
  const parts = displayName.split(',').map((p: string) => p.trim())

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const searchPattern = slugToClubNamePattern(slug)

    console.log('=== CLUB SLUG API CALLED ===')
    console.log('Slug:', slug)
    console.log('Search pattern:', searchPattern)

    // Get club data from clubs table
    // We need to do case-insensitive matching on club name
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('clubs')
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
      .ilike('club_name', `%${searchPattern}%`)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(10)

    if (clubsError) {
      console.error('Error fetching club:', clubsError)
      return NextResponse.json({ error: clubsError.message }, { status: 500 })
    }

    console.log('Clubs found:', clubsData?.length || 0)
    if (clubsData && clubsData.length > 0) {
      console.log('All matching clubs:', clubsData.map(c => ({
        name: c.club_name,
        wso: c.wso_geography,
        active_lifters: c.active_lifters_count
      })))
    }

    if (!clubsData || clubsData.length === 0) {
      return NextResponse.json({ error: 'Club not found' }, { status: 404 })
    }

    // Find the best match - prioritize exact matches
    let bestMatch = clubsData[0]

    // Try to find exact match (case-insensitive) - HIGHEST PRIORITY
    const exactMatch = clubsData.find(club =>
      club.club_name.toLowerCase() === searchPattern.toLowerCase()
    )

    if (exactMatch) {
      bestMatch = exactMatch
      console.log('Found exact name match:', bestMatch.club_name)
    } else {
      // Try to find closest match by converting both to slugs and comparing
      const targetSlug = slug.toLowerCase()
      const matches = clubsData.map(club => {
        const clubSlug = (club.club_name || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')

        // Improved similarity scoring
        let similarity = 0
        if (clubSlug === targetSlug) {
          similarity = 3 // Perfect slug match
        } else if (clubSlug.includes(targetSlug) || targetSlug.includes(clubSlug)) {
          similarity = 2 // Partial match
        } else {
          similarity = 1 // Weak match
        }

        return {
          club,
          slug: clubSlug,
          similarity
        }
      })

      matches.sort((a, b) => b.similarity - a.similarity)
      bestMatch = matches[0].club

      console.log('Match scores:', matches.map(m => ({
        name: m.club.club_name,
        slug: m.slug,
        similarity: m.similarity,
        active_lifters: m.club.active_lifters_count
      })))
      console.log('Selected best match:', bestMatch.club_name)
    }

    const { city, state } = parseLocation(bestMatch)

    // Calculate quadrant classification using hard-coded thresholds
    // These match the thresholds used in club-quadrant-data API
    const LIFTERS_THRESHOLD = 20
    const ACTIVITY_THRESHOLD_POWERHOUSE = 2.0
    const ACTIVITY_THRESHOLD_INTENSIVE = 1.6

    const liftersCount = bestMatch.active_lifters_count || 0
    const activityFactor = bestMatch.activity_factor || 0

    let quadrant: 'powerhouse' | 'intensive' | 'sleeping-giant' | 'developing'
    let quadrant_label: string

    // Hard-coded quadrant assignment based on fixed thresholds
    // Powerhouse: 20+ lifters AND 2.0+ activity
    // Intensive: 1-19 lifters AND 1.6+ activity
    // Sleeping Giant: 20+ lifters AND ≤1.99 activity
    // Developing: 1-19 lifters AND ≤1.59 activity

    if (liftersCount >= 20 && activityFactor >= 2.0) {
      quadrant = 'powerhouse'
      quadrant_label = 'Powerhouse'
    } else if (liftersCount <= 19 && activityFactor >= 1.6) {
      quadrant = 'intensive'
      quadrant_label = 'Intensive'
    } else if (liftersCount >= 20 && activityFactor <= 1.99) {
      quadrant = 'sleeping-giant'
      quadrant_label = 'Sleeping Giant'
    } else {
      // Developing: 1-19 lifters AND ≤1.59 activity
      quadrant = 'developing'
      quadrant_label = 'Developing'
    }

    const clubData = {
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

    console.log('Final selected club:', {
      name: clubData.club_name,
      wso: clubData.wso_geography,
      active_lifters: clubData.active_lifters_count,
      location: `${city}, ${state}`
    })

    const response = NextResponse.json(clubData)

    // Add caching headers - individual club data changes less frequently
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600') // 1 hour
    response.headers.set('CDN-Cache-Control', 'public, max-age=3600') // 1 hour CDN

    return response
  } catch (err) {
    console.error('Unexpected error in club slug API:', err)
    return NextResponse.json({ error: 'Failed to fetch club data' }, { status: 500 })
  }
}
