"use client"

import { useState, useEffect } from "react"

interface Club {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  city: string
  state: string
  recentMemberCount: number
}

interface ClubStats {
  totalClubs: number
  activeClubs: number
  statesCount: number
  averageMembersPerClub: number
}

interface ClubData {
  clubs: Club[]
  stats: ClubStats
}

export function useClubData() {
  const [data, setData] = useState<{
    clubData: ClubData | null
    loading: boolean
    error: string | null
  }>({
    clubData: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    async function fetchClubData() {
      try {
        setData(prev => ({ ...prev, loading: true, error: null }))

        // Check localStorage for cached club data (cache for 30 minutes)
        const cacheKey = 'all-club-data'
        const cached = localStorage.getItem(cacheKey)

        if (cached) {
          try {
            const { data: cachedData, timestamp } = JSON.parse(cached)
            const now = Date.now()
            const cacheAge = now - timestamp
            const maxAge = 30 * 60 * 1000 // 30 minutes in milliseconds

            if (cacheAge < maxAge) {
              setData({
                clubData: cachedData,
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
        const response = await fetch('/api/club-locations')
        if (!response.ok) {
          throw new Error(`Failed to fetch club data: ${response.status}`)
        }

        const clubs: Club[] = await response.json()

        // Calculate statistics
        const totalClubs = clubs.length
        const activeClubs = clubs.filter(club => club.recentMemberCount > 0).length
        const states = clubs.map(club => club.state).filter(Boolean)
        const uniqueStates = new Set(states)
        const statesCount = uniqueStates.size
        const totalMembers = clubs.reduce((sum, club) => sum + club.recentMemberCount, 0)
        const averageMembersPerClub = totalClubs > 0 ? Math.round(totalMembers / totalClubs * 10) / 10 : 0

        // Debug states count issue
        console.log('Club data debug:', {
          totalClubs,
          statesCount,
          uniqueStatesArray: Array.from(uniqueStates),
          sampleStates: states.slice(0, 10),
          clubsSample: clubs.slice(0, 3).map(c => ({ name: c.name, state: c.state }))
        })

        const clubData: ClubData = {
          clubs,
          stats: {
            totalClubs,
            activeClubs,
            statesCount,
            averageMembersPerClub
          }
        }

        // Cache the data
        localStorage.setItem(cacheKey, JSON.stringify({
          data: clubData,
          timestamp: Date.now()
        }))

        setData({
          clubData,
          loading: false,
          error: null
        })

      } catch (error) {
        console.error('Error fetching club data:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'An unexpected error occurred',
          loading: false
        }))
      }
    }

    fetchClubData()
  }, [])

  return data
}