"use client"

import { useState, useEffect } from "react"

interface ClubQuadrantData {
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
  quadrant: 'powerhouse' | 'intensive' | 'potential' | 'struggling'
  quadrant_label: string
}

interface QuadrantStats {
  powerhouse: { count: number; avgLifters: number; avgActivity: number }
  intensive: { count: number; avgLifters: number; avgActivity: number }
  potential: { count: number; avgLifters: number; avgActivity: number }
  struggling: { count: number; avgLifters: number; avgActivity: number }
}

interface QuadrantBoundaries {
  liftersMedian: number
  activityMedian: number
}

interface ClubQuadrantResponse {
  clubs: ClubQuadrantData[]
  stats: QuadrantStats
  boundaries: QuadrantBoundaries
  totalClubs: number
}

export function useClubQuadrantData() {
  const [data, setData] = useState<{
    quadrantData: ClubQuadrantResponse | null
    loading: boolean
    error: string | null
  }>({
    quadrantData: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchQuadrantData() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        // Check localStorage for cached quadrant data (cache for 30 minutes)
        const cacheKey = 'club-quadrant-data'
        const cached = localStorage.getItem(cacheKey)

        if (cached) {
          try {
            const { data: cachedData, timestamp } = JSON.parse(cached)
            const now = Date.now()
            const cacheAge = now - timestamp
            const maxAge = 30 * 60 * 1000 // 30 minutes in milliseconds

            if (cacheAge < maxAge) {
              setData({
                quadrantData: cachedData,
                loading: false,
                error: null
              })
              return
            }
          } catch (e) {
            localStorage.removeItem(cacheKey)
          }
        }

        // Fetch fresh data from API
        const response = await fetch('/api/club-quadrant-data')
        if (!response.ok) {
          throw new Error(`Failed to fetch quadrant data: ${response.status}`)
        }

        const quadrantData: ClubQuadrantResponse = await response.json()

        // Cache the data
        localStorage.setItem(cacheKey, JSON.stringify({
          data: quadrantData,
          timestamp: Date.now()
        }))

        setData({
          quadrantData,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching club quadrant data:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchQuadrantData()
  }, [])

  return data
}

// Helper function to get quadrant color
export function getQuadrantColor(quadrant: ClubQuadrantData['quadrant'], theme: 'light' | 'dark' = 'light') {
  const colors = {
    light: {
      powerhouse: '#10B981', // Green
      intensive: '#3B82F6',  // Blue
      potential: '#F59E0B',  // Orange
      struggling: '#EF4444'  // Red
    },
    dark: {
      powerhouse: '#059669', // Darker green
      intensive: '#2563EB',  // Darker blue
      potential: '#D97706',  // Darker orange
      struggling: '#DC2626'  // Darker red
    }
  }

  return colors[theme][quadrant]
}

// Helper function to get quadrant description
export function getQuadrantDescription(quadrant: ClubQuadrantData['quadrant']) {
  const descriptions = {
    powerhouse: 'High member count with high activity per member - successful large clubs',
    intensive: 'Lower member count but very high activity per member - efficient small clubs',
    potential: 'High member count but lower activity per member - clubs with growth opportunity',
    struggling: 'Lower member count and lower activity per member - clubs needing support'
  }

  return descriptions[quadrant]
}