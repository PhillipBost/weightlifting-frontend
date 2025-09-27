"use client"

import { useState, useEffect } from "react"

interface Club {
  club_name: string
  wso_geography: string
  phone?: string
  email?: string
  address?: string
  geocode_display_name?: string
  latitude?: number
  longitude?: number
  active_lifters_count?: number
  // Derived fields from geocode_display_name/address
  city?: string
  state?: string
}

interface WSOInfo {
  wso_id: number
  name: string
  estimated_population?: number
  active_lifters_count?: number
  recent_meets_count?: number
  barbell_clubs_count?: number
}

interface ClubStats {
  totalClubs: number
  activeClubs: number
  citiesCount: number
  statesCount: number
}

interface WSOClubData {
  wsoName: string
  wsoInfo: WSOInfo | null
  clubs: Club[]
  clubStats: ClubStats
}

export function useWSOClubData(slug: string) {
  const [data, setData] = useState<{
    clubData: WSOClubData | null
    loading: boolean
    error: string | null
  }>({
    clubData: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchWSOClubData() {
      console.log('=== WSO CLUB DATA HOOK CALLED ===')
      console.log('Slug:', slug)
      
      if (!slug) {
        console.log('No slug provided, returning')
        setData(prev => ({ ...prev, loading: false, error: 'No WSO slug provided' }))
        return
      }

      try {
        console.log('Setting loading to true')
        setData(prev => ({ ...prev, loading: true, error: null }))

        // DEBUGGING: Disable localStorage caching
        console.log('DEBUGGING: Caching disabled, calling API directly')

        // Fetch fresh data from API
        console.log('=== CALLING WSO CLUBS API ===')
        console.log('Slug:', slug)
        console.log('URL:', `/api/wso-clubs/${encodeURIComponent(slug)}`)
        
        const response = await fetch(`/api/wso-clubs/${encodeURIComponent(slug)}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch club data: ${response.status}`)
        }

        const clubData = await response.json()

        // DEBUGGING: Caching disabled

        setData({
          clubData,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching WSO club data:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchWSOClubData()
  }, [slug])

  return data
}