"use client"

import { useState, useEffect } from "react"

interface HistoricalDataRequest {
  clubCount?: number
  sortBy?: 'peak' | 'recent' | 'average'
  minActivityThreshold?: number
}

interface ClubSeries {
  name: string
  data: number[]
}

interface HistoricalDataResponse {
  success: boolean
  error?: string
  data: {
    months: string[]
    clubs: string[]
    series: ClubSeries[]
  }
  metadata: {
    clubCount: number
    dataPointsPerClub: number
    totalDataPoints: number
  }
}

interface UseMultiClubHistoricalDataResult {
  historicalData: HistoricalDataResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useMultiClubHistoricalData({
  clubCount = 25,
  sortBy = 'peak',
  minActivityThreshold = 15
}: HistoricalDataRequest = {}): UseMultiClubHistoricalDataResult {
  const [data, setData] = useState<{
    historicalData: HistoricalDataResponse | null
    loading: boolean
    error: string | null
  }>({
    historicalData: null,
    loading: true,
    error: null
  })

  const fetchData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }))

      const response = await fetch('/api/clubs/historical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clubCount,
          sortBy,
          minActivityThreshold
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch historical club data: ${response.status}`)
      }

      const historicalData: HistoricalDataResponse = await response.json()

      if (!historicalData.success) {
        throw new Error(historicalData.error || 'Failed to fetch historical data')
      }

      setData({
        historicalData,
        loading: false,
        error: null
      })

    } catch (error) {
      console.error('Error fetching multi-club historical data:', error)
      setData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        loading: false
      }))
    }
  }

  useEffect(() => {
    fetchData()
  }, [clubCount, sortBy, minActivityThreshold])

  return {
    ...data,
    refetch: fetchData
  }
}

// Helper function to prepare data for Recharts
export function prepareHistoricalChartData(
  months: string[],
  series: ClubSeries[]
): Array<Record<string, any>> {
  return months.map((month, index) => {
    const dataPoint: Record<string, any> = { month }

    series.forEach(clubSeries => {
      dataPoint[clubSeries.name] = clubSeries.data[index] || 0
    })

    return dataPoint
  })
}

// Enhanced color palette for 25+ clubs using chroma-js compatible colors
export function getHistoricalClubColor(
  clubName: string,
  clubs: string[],
  theme: 'light' | 'dark' = 'light'
): string {
  // Extended color palette supporting 30+ clubs
  const colors = {
    light: [
      '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', // Red, Blue, Green, Orange, Purple
      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1', // Cyan, Lime, Orange-alt, Pink, Indigo
      '#14B8A6', '#F59E0B', '#DC2626', '#2563EB', '#059669', // Teal, Amber, Dark-red, Dark-blue, Dark-green
      '#D97706', '#7C3AED', '#0891B2', '#65A30D', '#EA580C', // Dark-orange, Dark-purple, Dark-cyan, Dark-lime, Dark-orange-alt
      '#DB2777', '#4F46E5', '#0D9488', '#B45309', '#BE185D', // Dark-pink, Dark-indigo, Dark-teal, Brown, Rose
      '#7C2D12', '#166534', '#1E3A8A', '#581C87', '#0C4A6E', // Darker variants
      '#78350F', '#365314', '#312E81', '#6B21A8', '#164E63'  // Even darker variants
    ],
    dark: [
      '#DC2626', '#2563EB', '#059669', '#D97706', '#7C3AED', // Darker versions for dark theme
      '#0891B2', '#65A30D', '#EA580C', '#DB2777', '#4F46E5',
      '#0D9488', '#D97706', '#EF4444', '#3B82F6', '#10B981',
      '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316',
      '#EC4899', '#6366F1', '#14B8A6', '#F59E0B', '#BE185D',
      '#92400E', '#14532D', '#1E40AF', '#6B21A8', '#155E75',
      '#A16207', '#4D7C0F', '#3730A3', '#7E22CE', '#0E7490'
    ]
  }

  const colorPalette = colors[theme]
  const clubIndex = clubs.indexOf(clubName)

  if (clubIndex === -1) {
    return colorPalette[0] // Default to first color if club not found
  }

  return colorPalette[clubIndex % colorPalette.length]
}

export type { HistoricalDataResponse, ClubSeries, HistoricalDataRequest }