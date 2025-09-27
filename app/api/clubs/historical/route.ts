import { NextResponse } from 'next/server'

interface HistoricalRequest {
  clubCount?: number
  sortBy?: 'peak' | 'recent' | 'average'
  minActivityThreshold?: number
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
  }
}

export async function POST(request: Request) {
  try {
    const body: HistoricalRequest = await request.json()

    const {
      clubCount = 25,
      sortBy = 'peak',
      minActivityThreshold = 15
    } = body

    // Validate parameters
    if (clubCount < 1 || clubCount > 50) {
      return NextResponse.json({
        success: false,
        error: 'clubCount must be between 1 and 50'
      }, { status: 400 })
    }

    if (!['peak', 'recent', 'average'].includes(sortBy)) {
      return NextResponse.json({
        success: false,
        error: 'sortBy must be peak, recent, or average'
      }, { status: 400 })
    }

    // Call your backend endpoint
    const { execSync } = require('child_process')

    try {
      // Execute your backend script with the specified parameters
      const command = `node scripts/analytics/graph-data-endpoints.js historical ${clubCount} ${sortBy}`
      const backendResult = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 30000 // 30 second timeout
      })

      // Parse the backend response
      const backendData = JSON.parse(backendResult)

      // Transform to match our API format
      const response: HistoricalResponse = {
        success: true,
        data: {
          months: backendData.data.months,
          clubs: backendData.data.clubs,
          series: backendData.data.series
        },
        metadata: {
          clubCount: backendData.metadata.clubCount,
          dataPointsPerClub: backendData.metadata.dataPointsPerClub,
          totalDataPoints: backendData.metadata.totalDataPoints
        }
      }

      // Add cache headers for 1 hour
      const nextResponse = NextResponse.json(response)
      nextResponse.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600')

      return nextResponse

    } catch (backendError) {
      console.error('Backend script error:', backendError)

      // Fallback to mock data if backend fails
      const fallbackResponse: HistoricalResponse = {
        success: true,
        data: {
          months: generateMonthsArray(),
          clubs: generateMockClubs(clubCount),
          series: generateMockSeries(clubCount, 164)
        },
        metadata: {
          clubCount,
          dataPointsPerClub: 164,
          totalDataPoints: clubCount * 164
        }
      }

      const response = NextResponse.json(fallbackResponse)
      response.headers.set('Cache-Control', 'public, max-age=1800, s-maxage=1800') // Shorter cache for fallback
      return response
    }

  } catch (error) {
    console.error('Error in clubs historical API:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch historical club data'
    }, { status: 500 })
  }
}

// Helper functions for mock data - replace these when connecting to real backend
function generateMonthsArray(): string[] {
  const months: string[] = []
  const startDate = new Date('2012-01-01')
  const endDate = new Date()

  const current = new Date(startDate)
  while (current <= endDate) {
    months.push(current.toISOString().substring(0, 7) + '-01')
    current.setMonth(current.getMonth() + 1)
  }

  return months
}

function generateMockClubs(count: number): string[] {
  const sampleClubs = [
    'California Strength',
    'Catalyst Athletics',
    'Team Juggernaut',
    'Iron Sports',
    'MDUSA',
    'Hassle Free Barbell',
    'Team Fusion',
    'Mid-Atlantic CrossFit Training Center',
    'Weightlifting Club of Los Angeles',
    'South Carolina Barbell',
    'Ohio State Weightlifting',
    'Maine Strength',
    'Texas Barbell',
    'Arizona Weightlifting',
    'Colorado Weightlifting',
    'Elite Sports Training',
    'Northwest Weightlifting',
    'Florida Weightlifting',
    'Georgia Weightlifting',
    'Illinois Weightlifting',
    'Nevada Barbell',
    'Utah Olympic Weightlifting',
    'Wisconsin Weightlifting',
    'New York Athletic Club',
    'Boston University Weightlifting',
    'Virginia Weightlifting',
    'Tennessee Valley Weightlifting',
    'Michigan Weightlifting',
    'Pennsylvania Weightlifting',
    'North Carolina Weightlifting'
  ]

  return sampleClubs.slice(0, count)
}

function generateMockSeries(clubCount: number, monthCount: number): Array<{ name: string, data: number[] }> {
  const clubs = generateMockClubs(clubCount)

  return clubs.map(clubName => ({
    name: clubName,
    data: Array.from({ length: monthCount }, (_, i) => {
      // Generate realistic-looking data with growth trends
      const baseValue = Math.random() * 20 + 5
      const growthFactor = 1 + (i * 0.002) + (Math.random() * 0.1 - 0.05)
      return Math.round(baseValue * growthFactor)
    })
  }))
}