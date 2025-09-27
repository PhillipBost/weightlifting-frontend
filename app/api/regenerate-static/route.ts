import { NextResponse } from 'next/server'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Import our static data generation functions
const { generateWSOBoundaries, generateClubLocations, generateRecentMeets } = require('../../../scripts/generate-static-data.js')

export async function POST(request: Request) {
  console.log('🔄 Static data regeneration triggered')
  
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
  
  if (!process.env.CRON_SECRET) {
    console.error('❌ CRON_SECRET environment variable not set')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  
  if (authHeader !== expectedAuth) {
    console.error('❌ Unauthorized cron request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🚀 Starting static data regeneration...')
    
    // Ensure the data directory exists
    const dataDir = join(process.cwd(), 'public', 'data')
    mkdirSync(dataDir, { recursive: true })
    
    // Generate all static data
    const results = await Promise.all([
      generateWSOBoundaries(),
      generateClubLocations(),
      generateRecentMeets()
    ])
    
    console.log('✅ Static data regeneration completed')
    console.log(`📊 Generated: ${results[0]} WSOs, ${results[1]} clubs, ${results[2]} meets`)
    
    return NextResponse.json({ 
      success: true, 
      timestamp: new Date().toISOString(),
      stats: {
        wsos: results[0],
        clubs: results[1], 
        meets: results[2]
      }
    })
    
  } catch (error) {
    console.error('❌ Static data regeneration failed:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Allow manual testing via GET request
export async function GET() {
  return NextResponse.json({ 
    message: 'Static data regeneration endpoint',
    note: 'Use POST with proper authorization to trigger regeneration'
  })
}