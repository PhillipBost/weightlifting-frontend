import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Geographic filtering function (same as recent-meets)
function pointInGeoJSON(point: [number, number], geojson: any): boolean {
  if (!geojson) return false

  const [lng, lat] = point

  // Handle Feature wrapper
  let geometry = geojson
  if (geojson.type === 'Feature') {
    geometry = geojson.geometry
  }

  if (!geometry || !geometry.coordinates) return false

  // Handle MultiPolygon
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon: any) =>
      pointInPolygon([lng, lat], polygon[0])
    )
  }

  // Handle Polygon
  if (geometry.type === 'Polygon') {
    return pointInPolygon([lng, lat], geometry.coordinates[0])
  }

  return false
}

// Point-in-polygon test using ray casting algorithm
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const wsoName = searchParams.get('wso') || 'Carolina'

    console.log(`\n=== DEBUGGING WSO GEOGRAPHY FOR: ${wsoName} ===`)

    // Get WSO boundary data
    const { data: wsoData, error: wsoError } = await supabaseAdmin
      .from('usaw_wso_information')
      .select('name, territory_geojson')
      .eq('name', wsoName)
      .single()

    if (wsoError) {
      console.error('WSO boundary error:', wsoError)
      return NextResponse.json({ error: 'Could not find WSO boundary data' }, { status: 404 })
    }

    // Get recent meets from last 12 months
    const currentDate = new Date()
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12)
    const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0]

    // Query meets with all relevant fields
    const { data: recentMeets, error: meetError } = await supabaseAdmin
      .from('usaw_meets')
      .select('meet_id, Meet, Date, wso_geography, latitude, longitude, city, state')
      .gte('Date', cutoffDate)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('Date', { ascending: false })
      .limit(200) // Limit for debugging

    if (meetError) {
      console.error('Meet query error:', meetError)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    if (!recentMeets || recentMeets.length === 0) {
      return NextResponse.json({ message: 'No recent meets found' })
    }

    // Analyze the data
    const analysis = {
      totalMeets: recentMeets.length,
      meetsClaimingThisWSO: 0,
      meetsGeographicallyInThisWSO: 0,
      correctlyLabeled: 0,
      incorrectlyLabeled: 0,
      examples: {
        correctlyLabeled: [] as any[],
        incorrectlyLabeled: [] as any[],
        outsideMeetsClaimingThisWSO: [] as any[],
        insideMeetsNotClaimingThisWSO: [] as any[]
      }
    }

    recentMeets.forEach(meet => {
      const claimsToBeInWSO = meet.wso_geography === wsoName
      const isGeographicallyInWSO = pointInGeoJSON([meet.longitude, meet.latitude], wsoData.territory_geojson)

      if (claimsToBeInWSO) {
        analysis.meetsClaimingThisWSO++
      }

      if (isGeographicallyInWSO) {
        analysis.meetsGeographicallyInThisWSO++
      }

      // Classification
      if (claimsToBeInWSO && isGeographicallyInWSO) {
        analysis.correctlyLabeled++
        if (analysis.examples.correctlyLabeled.length < 5) {
          analysis.examples.correctlyLabeled.push({
            meet_name: meet.Meet,
            date: meet.Date,
            wso_geography: meet.wso_geography,
            location: `${meet.city}, ${meet.state}`,
            coordinates: [meet.longitude, meet.latitude]
          })
        }
      } else if (claimsToBeInWSO && !isGeographicallyInWSO) {
        analysis.incorrectlyLabeled++
        analysis.examples.outsideMeetsClaimingThisWSO.push({
          meet_name: meet.Meet,
          date: meet.Date,
          wso_geography: meet.wso_geography,
          location: `${meet.city}, ${meet.state}`,
          coordinates: [meet.longitude, meet.latitude]
        })
      } else if (!claimsToBeInWSO && isGeographicallyInWSO) {
        analysis.incorrectlyLabeled++
        analysis.examples.insideMeetsNotClaimingThisWSO.push({
          meet_name: meet.Meet,
          date: meet.Date,
          wso_geography: meet.wso_geography,
          location: `${meet.city}, ${meet.state}`,
          coordinates: [meet.longitude, meet.latitude]
        })
      }
    })

    // Calculate contamination percentage
    const contaminationRate = analysis.meetsClaimingThisWSO > 0
      ? (analysis.incorrectlyLabeled / analysis.meetsClaimingThisWSO * 100).toFixed(1)
      : '0.0'

    console.log(`\nANALYSIS RESULTS for ${wsoName}:`)
    console.log(`Total meets analyzed: ${analysis.totalMeets}`)
    console.log(`Meets claiming to be in ${wsoName}: ${analysis.meetsClaimingThisWSO}`)
    console.log(`Meets geographically in ${wsoName}: ${analysis.meetsGeographicallyInThisWSO}`)
    console.log(`Correctly labeled: ${analysis.correctlyLabeled}`)
    console.log(`Incorrectly labeled: ${analysis.incorrectlyLabeled}`)
    console.log(`Contamination rate: ${contaminationRate}%`)

    return NextResponse.json({
      wso: wsoName,
      analysis,
      contaminationRate: `${contaminationRate}%`,
      conclusion: analysis.incorrectlyLabeled > 0
        ? `CONTAMINATION DETECTED: ${analysis.incorrectlyLabeled} incorrectly labeled meets out of ${analysis.meetsClaimingThisWSO} claiming to be in ${wsoName}`
        : `NO CONTAMINATION: All meets claiming to be in ${wsoName} are geographically correct`
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      error: 'Debug analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}