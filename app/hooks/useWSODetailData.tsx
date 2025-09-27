"use client"

import { useState, useEffect, useCallback } from "react"

interface ClubLocation {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  city: string
  state: string
  recentMemberCount: number
}

interface MeetLocation {
  meet_id?: number
  meet_name: string
  date: string
  wso: string
  latitude?: number
  longitude?: number
  venue?: string
  city?: string
  state?: string
  uses_fallback_coordinates?: boolean
}

interface UseWSODetailDataReturn {
  clubData: ClubLocation[]
  meetData: MeetLocation[]
  clubsLoading: boolean
  meetsLoading: boolean
  clubsError: string | null
  meetsError: string | null
  loadClubs: (wsoSlug: string) => void
  loadMeets: (wsoSlug: string) => void
}

export function useWSODetailData(): UseWSODetailDataReturn {
  const [clubData, setClubData] = useState<ClubLocation[]>([])
  const [meetData, setMeetData] = useState<MeetLocation[]>([])
  const [clubsLoading, setClubsLoading] = useState(false)
  const [meetsLoading, setMeetsLoading] = useState(false)
  const [clubsError, setClubsError] = useState<string | null>(null)
  const [meetsError, setMeetsError] = useState<string | null>(null)

  const loadClubs = useCallback(async (wsoSlug: string) => {
    if (clubData.length > 0) return // Already loaded

    setClubsLoading(true)
    setClubsError(null)

    try {
      // Use WSO-specific clubs API endpoint
      const response = await fetch(`/api/wso-clubs/${encodeURIComponent(wsoSlug)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch club data')
      }

      const data = await response.json()
      if (data.clubs && Array.isArray(data.clubs)) {
        // Transform WSO clubs data to match ClubLocation interface
        const transformedClubs: ClubLocation[] = data.clubs
          .filter((club: any) => club.latitude && club.longitude)
          .map((club: any) => ({
            id: club.club_name ? club.club_name.charCodeAt(0) : 1, // Simple ID generation
            name: club.club_name,
            address: club.address || club.geocode_display_name || '',
            latitude: club.latitude,
            longitude: club.longitude,
            city: club.city || '',
            state: club.state || '',
            recentMemberCount: club.active_lifters_count || 0
          }))
        
        console.log('Club data received from WSO API:', transformedClubs.length, 'clubs with coordinates')
        setClubData(transformedClubs)
      } else {
        throw new Error(data.error || 'Failed to fetch club data')
      }
    } catch (err) {
      console.error('Error fetching club locations:', err)
      setClubsError(err instanceof Error ? err.message : 'Failed to load club locations')
    } finally {
      setClubsLoading(false)
    }
  }, [clubData.length])

  const loadMeets = useCallback(async (wsoSlug: string) => {
    if (meetData.length > 0) return // Already loaded

    setMeetsLoading(true)
    setMeetsError(null)

    try {
      // DEBUGGING: Disable localStorage caching to get fresh data
      console.log('Fetching fresh meet data for', wsoSlug, '(caching disabled)')

      const response = await fetch(`/api/recent-meets?wso=${encodeURIComponent(wsoSlug)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch meet data')
      }

      const data = await response.json()
      if (Array.isArray(data)) {
        // Filter to only meets with location data
        const meetsWithLocation = data.filter(meet =>
          meet.latitude && meet.longitude
        )
        console.log('Meet data fetched from API:', data.length, 'total meets')
        console.log('Meets with location:', meetsWithLocation.length)
        setMeetData(meetsWithLocation)

        // DEBUGGING: Caching disabled
      } else {
        throw new Error(data.error || 'Failed to fetch meet data')
      }
    } catch (err) {
      console.error('Error fetching recent meets:', err)
      setMeetsError(err instanceof Error ? err.message : 'Failed to load recent meets')
    } finally {
      setMeetsLoading(false)
    }
  }, [meetData.length])

  return {
    clubData,
    meetData,
    clubsLoading,
    meetsLoading,
    clubsError,
    meetsError,
    loadClubs,
    loadMeets
  }
}