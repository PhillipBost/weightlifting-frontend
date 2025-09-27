"use client"

import { useState, useEffect } from "react"

interface MonthlyAggregate {
  snapshot_month: string
  total_active_members: number
  total_competitions: number
  total_unique_lifters: number
  club_count: number
  avg_members_per_club: number
}

interface ClubTimeSeries {
  snapshot_month: string
  active_members_12mo: number
  total_competitions_12mo: number
  unique_lifters_12mo: number
}

interface ClubRollingMetric {
  club_name: string
  snapshot_month: string
  active_members_12mo: number
  total_competitions_12mo: number
  unique_lifters_12mo: number
}

interface TopClub {
  club_name: string
  active_members_12mo: number
  total_competitions_12mo: number
  unique_lifters_12mo: number
  rank_by_members: number
  rank_by_competitions: number
  rank_by_lifters: number
}

export function useClubsList() {
  const [data, setData] = useState<{
    clubs: string[]
    loading: boolean
    error: string | null
  }>({
    clubs: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchClubs() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        const response = await fetch('/api/club-metrics/clubs')
        if (!response.ok) {
          throw new Error(`Failed to fetch clubs list: ${response.status}`)
        }

        const result = await response.json()
        setData({
          clubs: result.clubs,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching clubs list:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchClubs()
  }, [])

  return data
}

export function useMonthlyAggregates(startDate?: string) {
  const [data, setData] = useState<{
    aggregates: MonthlyAggregate[]
    loading: boolean
    error: string | null
  }>({
    aggregates: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchAggregates() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        const params = new URLSearchParams()
        if (startDate) params.append('start_date', startDate)

        const response = await fetch(`/api/club-metrics/monthly-aggregates?${params}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch monthly aggregates: ${response.status}`)
        }

        const result = await response.json()
        setData({
          aggregates: result.aggregates,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching monthly aggregates:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchAggregates()
  }, [startDate])

  return data
}

export function useClubTimeSeries(clubName?: string, startDate?: string) {
  const [data, setData] = useState<{
    timeSeries: ClubTimeSeries[]
    loading: boolean
    error: string | null
  }>({
    timeSeries: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    if (!clubName) {
      setData({ timeSeries: [], loading: false, error: null })
      return
    }

    async function fetchTimeSeries() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        const params = new URLSearchParams()
        if (clubName) {
          params.append('club_name', clubName)
        }
        if (startDate) params.append('start_date', startDate)

        const response = await fetch(`/api/club-metrics/time-series?${params}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch club time series: ${response.status}`)
        }

        const result = await response.json()
        setData({
          timeSeries: result.timeSeries,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching club time series:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchTimeSeries()
  }, [clubName, startDate])

  return data
}

export function useTopClubs(month?: string, limit?: number, metric?: string) {
  const [data, setData] = useState<{
    topClubs: TopClub[]
    loading: boolean
    error: string | null
  }>({
    topClubs: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchTopClubs() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        const params = new URLSearchParams()
        if (month) params.append('month', month)
        if (limit) params.append('limit', limit.toString())
        if (metric) params.append('metric', metric)

        const response = await fetch(`/api/club-metrics/top-clubs?${params}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch top clubs: ${response.status}`)
        }

        const result = await response.json()
        setData({
          topClubs: result.topClubs,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching top clubs:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchTopClubs()
  }, [month, limit, metric])

  return data
}

// Helper function to get unique club colors for line chart
export function getClubColor(clubName: string, clubs: string[], theme: 'light' | 'dark' = 'light') {
  const colors = {
    light: [
      '#EF4444', // Red
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Orange
      '#8B5CF6', // Purple
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#F97316', // Orange alt
      '#EC4899', // Pink
      '#6366F1', // Indigo
      '#14B8A6', // Teal
      '#F59E0B'  // Amber
    ],
    dark: [
      '#DC2626', // Darker red
      '#2563EB', // Darker blue
      '#059669', // Darker green
      '#D97706', // Darker orange
      '#7C3AED', // Darker purple
      '#0891B2', // Darker cyan
      '#65A30D', // Darker lime
      '#EA580C', // Darker orange alt
      '#DB2777', // Darker pink
      '#4F46E5', // Darker indigo
      '#0D9488', // Darker teal
      '#D97706'  // Darker amber
    ]
  }

  const colorPalette = colors[theme]
  const clubIndex = clubs.indexOf(clubName)

  if (clubIndex === -1) {
    return colorPalette[0] // Default to first color if club not found
  }

  return colorPalette[clubIndex % colorPalette.length]
}

// Helper function to prepare data for time series chart
export function prepareChartData(metrics: ClubRollingMetric[], selectedMetric: keyof Pick<ClubRollingMetric, 'active_members_12mo' | 'total_competitions_12mo' | 'unique_lifters_12mo'>) {
  // Group metrics by date
  const dataByDate = metrics.reduce((acc, metric) => {
    const date = metric.snapshot_month
    if (!acc[date]) {
      acc[date] = { date }
    }
    acc[date][metric.club_name] = metric[selectedMetric]
    return acc
  }, {} as Record<string, any>)

  // Convert to array and sort by date
  return Object.values(dataByDate).sort((a: any, b: any) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
}