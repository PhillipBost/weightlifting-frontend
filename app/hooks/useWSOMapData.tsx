"use client"

import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

interface WSOBoundaryData {
  wso_id: number
  name: string
  territory_geojson: any
  geographic_type: string
  states: string[]
  counties: string[]
  active_status: boolean
}

export function useWSOMapData() {
  const [data, setData] = useState<{
    wsoData: any[]
    loading: boolean
    error: string | null
  }>({
    wsoData: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchWSOBoundaries() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        // Force use API to get dynamic meet counts (static data disabled)
        console.log('Using API for dynamic meet counts calculation')

        // Fallback to API with caching (for development or if static generation fails)
        // Check localStorage for cached boundaries (static data - cache for 30 days)
        const boundariesKey = 'wso-boundaries-static'
        const statsKey = 'wso-statistics-12m'
        
        const cachedBoundaries = localStorage.getItem(boundariesKey)
        const cachedStats = localStorage.getItem(statsKey)
        
        let boundaries = null
        let useCache = false

        // DEBUGGING: Skip all cache checks, fetch fresh data directly

        // Fetch fresh data from API
        const response = await fetch('/api/wso-boundaries')
        if (!response.ok) {
          throw new Error('Failed to fetch WSO boundaries')
        }

        const wsoData = await response.json()

        // Split and cache the data
        const boundariesData = wsoData.map((item: any) => ({
          wso_id: item.wso_id,
          name: item.name,
          territory_geojson: item.territory_geojson,
          geographic_type: item.geographic_type,
          states: item.states,
          counties: item.counties,
          active_status: item.active_status,
          geographic_center_lat: item.geographic_center_lat,
          geographic_center_lng: item.geographic_center_lng
        }))

        const statisticsData = wsoData.map((item: any) => ({
          wso_id: item.wso_id,
          lifterStats: item.lifterStats,
          estimatedPopulation: item.estimatedPopulation,
          meetCount: item.meetCount,
          clubCount: item.clubCount
        }))

        // DEBUGGING: Caching disabled

        setData({
          wsoData,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching WSO boundaries:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchWSOBoundaries()
  }, [])

  return data
}