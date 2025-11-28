require('dotenv').config({ path: '.env.local' })
require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function generateWSOBoundaries() {
  console.log('Generating WSO boundaries data...')

  try {
    const { data: wsoData, error } = await supabaseAdmin
      .from('usaw_wso_information')
      .select(`
        wso_id,
        name,
        territory_geojson,
        geographic_type,
        states,
        counties,
        active_status,
        geographic_center_lat,
        geographic_center_lng
      `)
      .eq('active_status', true)
      .order('name')

    if (error) {
      throw new Error(`WSO boundaries error: ${error.message}`)
    }

    // Get population and meet statistics
    const { data: statsData, error: statsError } = await supabaseAdmin
      .rpc('get_wso_statistics')

    if (statsError) {
      console.warn('Could not fetch WSO statistics:', statsError.message)
    }

    // Combine data
    const combinedData = wsoData.map(wso => {
      const stats = statsData?.find(s => s.wso_id === wso.wso_id) || {}
      return {
        ...wso,
        lifterStats: stats.lifter_stats || {},
        estimatedPopulation: stats.estimated_population || 0,
        meetCount: stats.meet_count || 0,
        clubCount: stats.club_count || 0
      }
    })

    // Write to public directory
    const outputPath = path.join(process.cwd(), 'public', 'data', 'wso-boundaries.json')
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(combinedData, null, 2))

    console.log(`✅ Generated WSO boundaries: ${combinedData.length} WSOs -> ${outputPath}`)
    return combinedData.length

  } catch (error) {
    console.error('❌ Error generating WSO boundaries:', error.message)
    throw error
  }
}

async function generateClubLocations() {
  console.log('Generating club locations data...')

  try {
    // Get club location data from clubs table
    const { data: clubsData, error: clubsError } = await supabaseAdmin
      .from('usaw_clubs')
      .select('*')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (clubsError) {
      throw new Error(`Club locations error: ${clubsError.message}`)
    }

    // Get current year for recent activity calculation
    const currentYear = new Date().getFullYear()
    const lastYear = currentYear - 1

    // Get recent activity data for clubs
    const { data: activityData, error: activityError } = await supabaseAdmin
      .from('usaw_meet_results')
      .select('club_name, lifter_id, date')
      .gte('date', `${lastYear}-01-01`)
      .lt('date', `${currentYear + 1}-01-01`)
      .not('club_name', 'is', null)

    if (activityError) {
      console.warn('Could not fetch club activity data:', activityError.message)
    }

    // Process activity data by club
    const clubActivity = {}

    if (activityData) {
      activityData.forEach(result => {
        if (!result.club_name || !result.lifter_id) return

        const clubName = result.club_name.trim()
        if (!clubActivity[clubName]) {
          clubActivity[clubName] = new Set()
        }
        clubActivity[clubName].add(result.lifter_id.toString())
      })
    }

    // Enhance club data with activity metrics
    const enrichedClubs = clubsData.map(club => ({
      id: club.id,
      name: club.club_name,
      address: club.address,
      latitude: parseFloat(club.latitude),
      longitude: parseFloat(club.longitude),
      city: club.city,
      state: club.state,
      recentMemberCount: clubActivity[club.club_name]?.size || 0
    }))

    // Filter out clubs with invalid coordinates
    const validClubs = enrichedClubs.filter(club =>
      !isNaN(club.latitude) && !isNaN(club.longitude) &&
      club.latitude >= -90 && club.latitude <= 90 &&
      club.longitude >= -180 && club.longitude <= 180
    )

    // Write to public directory
    const outputPath = path.join(process.cwd(), 'public', 'data', 'club-locations.json')
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(validClubs, null, 2))

    console.log(`✅ Generated club locations: ${validClubs.length} clubs -> ${outputPath}`)
    return validClubs.length

  } catch (error) {
    console.error('❌ Error generating club locations:', error.message)
    throw error
  }
}

async function generateRecentMeets() {
  console.log('Generating recent meets data...')

  try {
    // Calculate date 3 years ago
    const currentDate = new Date()
    const threeYearsAgo = new Date()
    threeYearsAgo.setFullYear(currentDate.getFullYear() - 3)
    const cutoffDate = threeYearsAgo.toISOString().split('T')[0]

    // Query for recent meets from last 3 years
    const { data: meetResults, error: meetError } = await supabaseAdmin
      .from('usaw_meet_results')
      .select(`
        meet_name,
        date,
        meet_id,
        wso
      `)
      .gte('date', cutoffDate)
      .not('meet_name', 'is', null)

    if (meetError) {
      throw new Error(`Recent meets error: ${meetError.message}`)
    }

    if (!meetResults || meetResults.length === 0) {
      console.log('No meet results found')
      return 0
    }

    console.log(`Found ${meetResults.length} meet results`)

    // Group by unique meet (using meet_id or meet_name + date combination)
    const uniqueMeets = new Map()

    meetResults.forEach(result => {
      // Use meet_id if available, otherwise create unique key from name + date
      const meetKey = result.meet_id
        ? result.meet_id.toString()
        : `${result.meet_name}|${result.date}`

      if (!uniqueMeets.has(meetKey)) {
        uniqueMeets.set(meetKey, {
          meet_id: result.meet_id,
          meet_name: result.meet_name,
          date: result.date,
          wso: result.wso
        })
      }
    })

    // Get unique meets array
    const meets = Array.from(uniqueMeets.values())

    // Try to get location information from the meets table
    try {
      if (meets.length > 0) {
        const meetIds = meets
          .filter(meet => meet.meet_id)
          .map(meet => meet.meet_id)

        if (meetIds.length > 0) {
          // Try meet_locations table first
          let { data: meetLocations, error: locationError } = await supabaseAdmin
            .from('usaw_meet_locations')
            .select('meet_id, latitude, longitude, venue, city, state, address')
            .in('meet_id', meetIds)

          // If meet_locations doesn't exist, try meets table
          if (locationError || !meetLocations || meetLocations.length === 0) {
            console.log('Trying meets table for location data...')
            const { data: meetData, error: meetError } = await supabaseAdmin
              .from('usaw_meets')
              .select('meet_id, lat, lng, venue, city, state, address')
              .in('meet_id', meetIds)

            // Convert lat/lng to latitude/longitude for consistency
            if (meetData && !meetError) {
              meetLocations = meetData.map(meet => ({
                meet_id: meet.meet_id,
                latitude: meet.lat,
                longitude: meet.lng,
                venue: meet.venue,
                city: meet.city,
                state: meet.state,
                address: meet.address
              }))
              locationError = null
            }
          }

          if (!locationError && meetLocations) {
            console.log(`Found ${meetLocations.length} meets with location data`)

            // Create a map of meet_id to location data
            const locationMap = new Map()
            meetLocations.forEach(loc => {
              locationMap.set(loc.meet_id, {
                latitude: loc.latitude,
                longitude: loc.longitude,
                venue: loc.venue,
                city: loc.city,
                state: loc.state
              })
            })

            // Enhance meets with location data where available
            let meetsWithLocationData = 0
            meets.forEach(meet => {
              if (meet.meet_id && locationMap.has(meet.meet_id)) {
                const location = locationMap.get(meet.meet_id)
                Object.assign(meet, location)
                meetsWithLocationData++
              }
            })

            console.log(`Enhanced ${meetsWithLocationData} meets with location data`)
          }
        }
      }
    } catch (locationError) {
      console.warn('Could not fetch meet location data:', locationError)
    }

    // Filter out meets that don't have real geocoding
    const meetsWithLocation = meets.filter(meet =>
      meet.latitude && meet.longitude && !meet.uses_fallback_coordinates
    )

    console.log(`Filtered to ${meetsWithLocation.length} meets with real geocodes`)

    // Group by WSO for easier querying
    const meetsByWSO = {}
    meetsWithLocation.forEach(meet => {
      if (!meet.wso) return

      const wsoKey = meet.wso.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
      if (!meetsByWSO[wsoKey]) {
        meetsByWSO[wsoKey] = []
      }
      meetsByWSO[wsoKey].push(meet)
    })

    // Sort meets by date (most recent first) for each WSO
    Object.keys(meetsByWSO).forEach(wsoKey => {
      meetsByWSO[wsoKey].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    })

    // Write to public directory
    const outputPath = path.join(process.cwd(), 'public', 'data', 'recent-meets.json')
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(meetsByWSO, null, 2))

    const totalMeets = Object.values(meetsByWSO).reduce((sum, meets) => sum + meets.length, 0)
    console.log(`✅ Generated recent meets: ${totalMeets} meets across ${Object.keys(meetsByWSO).length} WSOs -> ${outputPath}`)
    return totalMeets

  } catch (error) {
    console.error('❌ Error generating recent meets:', error.message)
    throw error
  }
}

async function main() {
  console.log('🚀 Starting static data generation...')

  try {
    const results = await Promise.all([
      generateWSOBoundaries(),
      generateClubLocations(),
      generateRecentMeets()
    ])

    console.log('\n✅ Static data generation completed successfully!')
    console.log(`📊 Generated:`)
    console.log(`   - ${results[0]} WSO boundaries`)
    console.log(`   - ${results[1]} club locations`)
    console.log(`   - ${results[2]} recent meets`)

  } catch (error) {
    console.error('\n❌ Static data generation failed:', error.message)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}

module.exports = { generateWSOBoundaries, generateClubLocations, generateRecentMeets }