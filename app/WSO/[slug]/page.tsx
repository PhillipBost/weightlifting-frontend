"use client"

import React, { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Mail, Phone, Globe, Database } from "lucide-react"
import { ThemeSwitcher } from "../../components/ThemeSwitcher"
import { MetricTooltip } from "../../components/MetricTooltip"
import { useWSOClubData } from "../../hooks/useWSOClubData"
import { useWSODetailData } from "../../hooks/useWSODetailData"

// Helper functions for location formatting
function getStateAbbreviation(stateName: string): string {
  const stateMap: { [key: string]: string } = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  }
  return stateMap[stateName] || stateName
}

function getCountryAbbreviation(countryName: string): string {
  const countryMap: { [key: string]: string } = {
    'United States': 'US',
    'United States of America': 'US'
  }
  return countryMap[countryName] || countryName
}

// WSO Clubs Table Component
function WSOClubsTable({ slug }: { slug: string }) {
  const { clubData, loading, error } = useWSOClubData(slug)
  const [sortField, setSortField] = useState<string>('club_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  if (loading) {
    return (
      <div className="card-large">
        <div className="animate-pulse">
          <div className="h-6 bg-app-tertiary rounded mb-2 w-32"></div>
          <div className="h-4 bg-app-tertiary rounded mb-6 w-64"></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                <tr>
                  {[...Array(3)].map((_, i) => (
                    <th key={i} className="px-3 py-1.5">
                      <div className="h-3 bg-app-surface rounded"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-40"></div></td>
                    <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-32"></div></td>
                    <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-16"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center py-8 text-app-muted invisible">No data</div>
        </div>
      </div>
    )
  }

  if (error || !clubData) {
    return (
      <div className="card-large">
        <p className="text-red-500">Error loading clubs data: {error}</p>
      </div>
    )
  }

  const { clubs } = clubData

  // Sort clubs based on current sort field and direction
  const sortedClubs = [...clubs].sort((a, b) => {
    let aVal: any, bVal: any

    if (sortField === 'location') {
      // Extract city, state for sorting
      const getLocation = (club: any) => {
        const location = club.geocode_display_name || club.address || ''
        const parts = location.split(',').map((p: string) => p.trim())
        const city = parts.length >= 2 ? parts[parts.length - 3] || parts[0] : parts[0] || ''
        const state = parts.length >= 2 ? parts[parts.length - 2] : ''
        if (city && state) {
          const stateAbbr = getStateAbbreviation(state)
          const countryAbbr = getCountryAbbreviation(state)
          const finalState = stateAbbr !== state ? stateAbbr : countryAbbr
          return `${city}, ${finalState}`
        }
        return location
      }
      aVal = getLocation(a)
      bVal = getLocation(b)
    } else {
      aVal = a[sortField as keyof typeof a]
      bVal = b[sortField as keyof typeof b]
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    return 0
  })

  // Calculate total active lifters for footer
  const totalActiveLifters = clubs.reduce((sum, club) => sum + (club.active_lifters_count || 0), 0)

  return (
    <div className="card-large">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-app-primary mb-2">
          Barbell Clubs
        </h2>
        <p className="text-app-secondary">
          All registered weightlifting clubs within this WSO region.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
            <tr>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                onClick={() => handleSort('club_name')}
              >
                Club Name {sortField === 'club_name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                onClick={() => handleSort('location')}
              >
                Location {sortField === 'location' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                onClick={() => handleSort('active_lifters_count')}
              >
                <MetricTooltip
                  title="Active Lifters"
                  description="Number of competitive lifters who have competed within the past 12 months"
                  methodology="Counts unique athletes from each club who have competition results in the past 12 months"
                >
                  <span>Active Lifters {sortField === 'active_lifters_count' && (sortDirection === 'asc' ? '↑' : '↓')}</span>
                </MetricTooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedClubs.map((club, index) => {
              // Improved location parsing for better "City, State" format
              const location = club.geocode_display_name || club.address || ''
              let displayLocation = 'Location not available'

              if (location) {
                const parts = location.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)

                // Handle different geocode formats
                if (parts.length >= 2) {
                  // Try to extract city and state from common patterns
                  let city = '', state = ''

                  // Look for state abbreviation or state name (usually near the end)
                  for (let i = parts.length - 1; i >= 0; i--) {
                    const part = parts[i]
                    // Check if this looks like a state (2 letters or common state names)
                    if (part.length === 2 || ['Texas', 'California', 'Florida', 'New York', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia', 'Washington', 'Arizona', 'Massachusetts', 'Tennessee', 'Indiana', 'Missouri', 'Maryland', 'Wisconsin', 'Colorado', 'Minnesota', 'South Carolina', 'Alabama', 'Louisiana', 'Kentucky', 'Oregon', 'Oklahoma', 'Connecticut', 'Utah', 'Iowa', 'Nevada', 'Arkansas', 'Mississippi', 'Kansas', 'New Mexico', 'Nebraska', 'West Virginia', 'Idaho', 'Hawaii', 'New Hampshire', 'Maine', 'Montana', 'Rhode Island', 'Delaware', 'South Dakota', 'North Dakota', 'Alaska', 'Vermont', 'Wyoming'].includes(part)) {
                      state = part
                      // City is usually the part before the state (skip postal codes and counties)
                      for (let j = i - 1; j >= 0; j--) {
                        const cityCandidate = parts[j]
                        // Skip if it looks like a postal code or contains "County"
                        if (!/^\d+$/.test(cityCandidate) && !cityCandidate.toLowerCase().includes('county')) {
                          city = cityCandidate
                          break
                        }
                      }
                      break
                    }
                  }

                  if (city && state) {
                    const stateAbbr = getStateAbbreviation(state)
                    const countryAbbr = getCountryAbbreviation(state)
                    const finalState = stateAbbr !== state ? stateAbbr : countryAbbr
                    displayLocation = `${city}, ${finalState}`
                  } else {
                    // Fallback: use first and last meaningful parts
                    const meaningfulParts = parts.filter(p => !/^\d+$/.test(p) && !p.toLowerCase().includes('county'))
                    if (meaningfulParts.length >= 2) {
                      const lastPart = meaningfulParts[meaningfulParts.length - 1]
                      const stateAbbr = getStateAbbreviation(lastPart)
                      const countryAbbr = getCountryAbbreviation(lastPart)
                      const finalPart = stateAbbr !== lastPart ? stateAbbr : countryAbbr
                      displayLocation = `${meaningfulParts[0]}, ${finalPart}`
                    } else if (meaningfulParts.length === 1) {
                      displayLocation = meaningfulParts[0]
                    } else {
                      displayLocation = parts[0] // Last resort
                    }
                  }
                } else {
                  displayLocation = parts[0] || location
                }
              }

              return (
                <tr key={`${club.club_name}-${index}`} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="text-sm text-app-secondary">{club.club_name}</div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="text-sm text-app-secondary">
                      {displayLocation}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="text-sm text-app-primary">{club.active_lifters_count || 0}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200 border-t border-app-border">
            <tr>
              <td className="px-3 py-1.5">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                  Total: {clubs.length} clubs
                </div>
              </td>
              <td className="px-3 py-1.5"></td>
              <td className="px-3 py-1.5">
                <MetricTooltip
                  title="Club-Affiliated Active Lifters"
                  description="Count of active lifters affiliated with registered barbell clubs. This number is lower than the total active lifting population for this WSO because not all active members belong to a club."
                  methodology="Sums the active lifter counts from all clubs within this WSO region that have geocoded locations and competed in the past 12 months"
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Total: {totalActiveLifters.toLocaleString()} active lifters
                  </div>
                </MetricTooltip>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {clubs.length === 0 && (
        <div className="text-center py-8 text-app-muted">
          No clubs found for this WSO region.
        </div>
      )}
    </div>
  )
}

// WSO Recent Meets Table Component
function WSORecentMeetsTable({ slug }: { slug: string }) {
  const [recentMeets, setRecentMeets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection(field === 'date' ? 'desc' : 'asc')
    }
  }

  useEffect(() => {
    async function fetchRecentMeets() {
      if (!slug) {
        console.log('WSORecentMeetsTable: No slug provided, skipping fetch')
        return
      }

      console.log('WSORecentMeetsTable: Starting fetch for slug:', slug)

      try {
        setLoading(true)
        setError(null)

        const apiUrl = `/api/recent-meets?wso=${encodeURIComponent(slug)}`
        console.log('WSORecentMeetsTable: Calling API:', apiUrl)

        // Add timeout to the fetch request
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const response = await fetch(apiUrl, {
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        console.log('WSORecentMeetsTable: API response status:', response.status)

        if (!response.ok) {
          throw new Error(`Failed to fetch recent meets: ${response.status}`)
        }

        const meetsData = await response.json()
        console.log('WSORecentMeetsTable: API returned meets:', meetsData?.length || 0, 'meets')
        console.log('WSORecentMeetsTable: Sample meet data:', meetsData?.[0])

        setRecentMeets(meetsData || [])
      } catch (err) {
        console.error('WSORecentMeetsTable: Error fetching recent meets:', err)

        if (err instanceof Error && err.name === 'AbortError') {
          setError('Request timed out. The meets database is currently experiencing performance issues. Please try again later.')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load recent meets')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchRecentMeets()
  }, [slug])

  // Sort meets based on current sort field and direction
  const sortedMeets = [...recentMeets].sort((a, b) => {
    let aVal: any, bVal: any

    if (sortField === 'date') {
      aVal = new Date(a.date).getTime()
      bVal = new Date(b.date).getTime()
    } else if (sortField === 'location') {
      aVal = a.location || 'ZZZ' // Put items without location at the end
      bVal = b.location || 'ZZZ'
    } else {
      aVal = a[sortField]
      bVal = b[sortField]
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    return 0
  })

  if (loading) {
    return (
      <div className="card-large">
        <div className="animate-pulse">
          <div className="h-6 bg-app-tertiary rounded mb-2 w-32"></div>
          <div className="h-4 bg-app-tertiary rounded mb-6 w-64"></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                <tr>
                  {[...Array(4)].map((_, i) => (
                    <th key={i} className="px-3 py-1.5">
                      <div className="h-3 bg-app-surface rounded"></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-48"></div></td>
                    <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-24"></div></td>
                    <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-32"></div></td>
                    <td className="px-3 py-1.5"><div className="h-8 bg-blue-600 rounded-lg w-28"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center py-8 text-app-muted invisible">No data</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-large">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-app-primary mb-2">
            Recent Meets
          </h2>
          <p className="text-app-secondary">
            Recent weightlifting competitions held within this WSO region (past 12 months).
          </p>
        </div>
        <div className="text-center py-8">
          <div className="text-red-500 mb-4 font-medium">⚠️ Unable to Load Recent Meets</div>
          <p className="text-app-secondary mb-4">{error}</p>
          <div className="text-sm text-app-muted">
            <p>This WSO region has recent competition data available, but there's currently an issue with the database query.</p>
            <p className="mt-2">You can still view club information above, and we're working to resolve the meets display issue.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card-large">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-app-primary mb-2">
          Recent Meets
        </h2>
        <p className="text-app-secondary">
          Recent weightlifting competitions held within this WSO region (past 12 months).
        </p>
      </div>

      {sortedMeets.length === 0 ? (
        <div className="text-center py-8 text-app-muted">
          No recent meets found for this WSO region.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
              <tr>
                <th
                  className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                  onClick={() => handleSort('meet_name')}
                >
                  Meet Name {sortField === 'meet_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                  onClick={() => handleSort('date')}
                >
                  Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                  onClick={() => handleSort('location')}
                >
                  Location {sortField === 'location' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMeets.map((meet, index) => (
                <tr key={`${meet.meet_id || meet.meet_name}-${index}`} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                  <td className="px-3 py-1.5">
                    <div className="text-sm text-app-secondary">{meet.meet_name}</div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="text-sm text-app-secondary">
                      {new Date(meet.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <div className="text-sm text-app-secondary">{meet.location || 'Location not available'}</div>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {meet.meet_id ? (
                      <Link
                        href={`/meet/${meet.meet_id}`}
                        className="inline-flex items-center px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        View Details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="text-sm text-app-muted">No details available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200 border-t border-app-primary">
              <tr>
                <td className="px-3 py-1.5">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Total: {sortedMeets.length} recent meets
                  </div>
                </td>
                <td className="px-3 py-1.5"></td>
                <td className="px-3 py-1.5"></td>
                <td className="px-3 py-1.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// WSO Summary Component
function WSOSummary({ slug }: { slug: string }) {
  const { clubData, loading, error } = useWSOClubData(slug)

  if (loading) {
    return (
      <div className="card-large">
        <div className="animate-pulse">
          <div className="mb-4">
            <div className="h-6 bg-app-tertiary rounded mb-2 w-48"></div>
            <div className="h-4 bg-app-tertiary rounded w-64"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="h-4 bg-app-tertiary rounded mb-2 w-20 mx-auto"></div>
                <div className="h-8 bg-app-tertiary rounded w-16 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !clubData) {
    return (
      <div className="card-large">
        <p className="text-red-500">Error loading WSO information: {error}</p>
      </div>
    )
  }

  const { wsoInfo, clubStats } = clubData

  if (!wsoInfo) {
    return (
      <div className="card-large">
        <p className="text-red-500">Error: WSO information not available</p>
      </div>
    )
  }

  return null
}

// Dynamically import components
const WSODetailMap = dynamic(() => import("../../components/WSO/WSODetailMap"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
    </div>
  ),
})

export default function WSODetailPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  // Fetch WSO data once at top level
  const { clubData } = useWSOClubData(slug)
  const recentMeetsCount = clubData?.wsoInfo?.recent_meets_count

  // Convert slug back to display name
  const displayName = slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <div className="min-h-screen bg-app-gradient">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Responsive Header */}
          <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
            <div className="flex items-center space-x-4 flex-wrap gap-2">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <div className="bg-app-tertiary rounded-full p-2">
                  <Database className="h-6 w-6 text-app-secondary" />
                </div>
                <div>
                  <div className="text-lg font-bold text-app-primary">WeightliftingDB</div>
                  <div className="text-xs text-app-tertiary">USA Weightlifting Results Database</div>
                </div>
              </Link>
              <div className="text-app-muted">|</div>
              <button
                onClick={() => router.push('/WSO')}
                className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to WSO Directory</span>
              </button>
              <div className="text-app-muted">|</div>
              <h1 className="text-3xl font-bold text-app-primary">
                {displayName} WSO
              </h1>
            </div>
            <div className="flex-shrink-0">
              <ThemeSwitcher />
            </div>
          </div>



          {/* Content Sections */}
          <div className="space-y-6">
            {/* WSO Summary Statistics */}
            <WSOSummary slug={slug} />

            {/* Map Container */}
            <div className="card-large">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-app-primary mb-2">
                  WSO Territory and Club Locations
                </h2>
                <p className="text-app-secondary">
                  Geographic boundaries and registered club locations within this WSO region.
                </p>
              </div>

              <WSODetailMap wsoSlug={slug} wsoName={displayName} recentMeetsCount={recentMeetsCount} />
            </div>

            {/* Clubs Table */}
            <WSOClubsTable slug={slug} />

            {/* Recent Meets Table */}
            <WSORecentMeetsTable slug={slug} />
          </div>
        </div>
      </div>
    </div>
  )
}