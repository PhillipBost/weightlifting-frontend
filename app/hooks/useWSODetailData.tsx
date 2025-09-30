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
  address?: string
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
  const [currentWsoSlug, setCurrentWsoSlug] = useState<string | null>(null)

  const loadClubs = useCallback(async (wsoSlug: string) => {
    // Always reload if WSO changed
    const needsReset = currentWsoSlug !== wsoSlug
    
    if (needsReset) {
      console.log('WSO changed from', currentWsoSlug, 'to', wsoSlug, '- resetting club data')
      setClubData([])
      setCurrentWsoSlug(wsoSlug)
    } else if (clubData.length > 0) {
      console.log('Club data already loaded for', wsoSlug)
      return // Already loaded for this WSO
    }

    setClubsLoading(true)
    setClubsError(null)

    try {
      // Use WSO-specific clubs API endpoint
      console.log('Fetching clubs for', wsoSlug)
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
        
        console.log('Club data received from WSO API for', wsoSlug, ':', transformedClubs.length, 'clubs with coordinates')
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
  }, [clubData.length, currentWsoSlug])

  const loadMeets = useCallback(async (wsoSlug: string) => {
    // Always reload if WSO changed
    const needsReset = currentWsoSlug !== wsoSlug
    
    if (needsReset) {
      console.log('WSO changed from', currentWsoSlug, 'to', wsoSlug, '- resetting meet data')
      setMeetData([])
      setCurrentWsoSlug(wsoSlug)
    } else if (meetData.length > 0) {
      console.log('Meet data already loaded for', wsoSlug)
      return // Already loaded for this WSO
    }

    setMeetsLoading(true)
    setMeetsError(null)

    try {
      console.log('Fetching fresh meet data for', wsoSlug)

      const response = await fetch(`/api/recent-meets?wso=${encodeURIComponent(wsoSlug)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch meet data')
      }

      const data = await response.json()
      if (Array.isArray(data)) {
        // Accept all meets with coordinates (including fallback coordinates)
        const meetsWithLocation = data.filter(meet =>
          meet.latitude && meet.longitude
        )
        const meetsWithFallback = meetsWithLocation.filter(m => m.uses_fallback_coordinates).length
        console.log('Meet data fetched from API:', data.length, 'total meets')
        console.log('Meets with location:', meetsWithLocation.length, `(${meetsWithFallback} using fallback coordinates)`)
        console.log('Setting meetData state to', meetsWithLocation.length, 'meets for', wsoSlug)
        setMeetData(meetsWithLocation)
        console.log('meetData state updated')
      } else {
        throw new Error(data.error || 'Failed to fetch meet data')
      }
    } catch (err) {
      console.error('Error fetching recent meets:', err)
      setMeetsError(err instanceof Error ? err.message : 'Failed to load recent meets')
    } finally {
      setMeetsLoading(false)
    }
  }, [meetData.length, currentWsoSlug])

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