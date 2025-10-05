'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MapPin, Users, BarChart3, Activity, TrendingUp, ChevronRight, Database } from 'lucide-react'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useWSOMapData } from '../hooks/useWSOMapData'
import dynamic from 'next/dynamic'

// Dynamically import the map component to avoid SSR issues
const WSOMap = dynamic(() => import('../components/WSO/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-app-tertiary rounded-lg border border-app-primary flex items-center justify-center">
      <div className="text-app-muted">Loading WSO map...</div>
    </div>
  ),
})

interface WSOEntry {
  wso_id: number
  name: string
  states: string[]
  counties: string[]
  barbell_clubs_count: number
  recent_meets_count: number
  active_lifters_count: number
  estimated_population: number
  activity_factor: number
  geographic_type: 'state' | 'multi_state' | 'county' | 'city'
  total_participations: number
  official_url?: string
  contact_email?: string
}

interface WSOStats {
  totalWSOs: number
  totalStates: number
  totalClubs: number
  totalLifters: number
  totalPopulation: number
  totalRecentMeets: number
  averageActivityFactor: number
}

export default function WSODirectoryPage() {
  const [wsoData, setWSOData] = useState<WSOEntry[]>([])
  const [stats, setStats] = useState<WSOStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<keyof WSOEntry>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const { wsoData: wsoMapData, loading: mapLoading } = useWSOMapData()

  useEffect(() => {
    async function fetchWSOData() {
      try {
        setLoading(true)
        const response = await fetch('/api/wso-boundaries')
        if (!response.ok) {
          throw new Error(`Failed to fetch WSO data: ${response.status}`)
        }

        const data: WSOEntry[] = await response.json()
        setWSOData(data)

        // Calculate statistics
        const totalWSOs = data.length
        const allStates = data.flatMap(wso => wso.states || [])
        const uniqueStates = new Set(allStates)
        const totalStates = uniqueStates.size
        const totalClubs = data.reduce((sum, wso) => sum + (wso.barbell_clubs_count || 0), 0)
        const totalLifters = data.reduce((sum, wso) => sum + (wso.active_lifters_count || 0), 0)
        const totalRecentMeets = data.reduce((sum, wso) => sum + (wso.recent_meets_count || 0), 0)
        const totalPopulation = data.reduce((sum, wso) => sum + (wso.estimated_population || 0), 0)
        const avgActivity = data.reduce((sum, wso) => sum + (wso.activity_factor || 0), 0) / totalWSOs

        setStats({
          totalWSOs,
          totalStates,
          totalClubs,
          totalLifters,
          totalPopulation,
          totalRecentMeets,
          averageActivityFactor: Math.round(avgActivity * 100) / 100
        })

        setLoading(false)
      } catch (err) {
        console.error('Error fetching WSO data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load WSO data')
        setLoading(false)
      }
    }

    fetchWSOData()
  }, [])

  const handleSort = (field: keyof WSOEntry) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedData = [...wsoData].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    if (Array.isArray(aVal) && Array.isArray(bVal)) {
      return sortDirection === 'asc'
        ? aVal.length - bVal.length
        : bVal.length - aVal.length
    }

    return 0
  })

  const formatPopulation = (pop: number) => {
    if (pop >= 1000000) {
      return `${(pop / 1000000).toFixed(1)}M`
    } else if (pop >= 1000) {
      return `${(pop / 1000).toFixed(0)}K`
    }
    return pop.toString()
  }

  const getActivityLevelColor = (factor: number) => {
    if (factor >= 2.0) return 'text-green-600 dark:text-green-400'
    if (factor >= 1.5) return 'text-yellow-600 dark:text-yellow-400'
    if (factor >= 1.0) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getActivityLevelLabel = (factor: number) => {
    if (factor >= 2.0) return 'Very High'
    if (factor >= 1.5) return 'High'
    if (factor >= 1.0) return 'Moderate'
    return 'Low'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-app-tertiary rounded mb-4 w-64"></div>
            <div className="card-results shadow-lg">
              <div className="px-6 py-4 border-b border-app-primary">
                <div className="h-5 bg-app-tertiary rounded w-40"></div>
              </div>
              <div className="px-6 py-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                      <tr>
                        {[...Array(6)].map((_, i) => (
                          <th key={i} className="px-3 py-1.5">
                            <div className="h-3 bg-app-surface rounded"></div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(10)].map((_, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-32"></div></td>
                          <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-16"></div></td>
                          <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-20"></div></td>
                          <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-16"></div></td>
                          <td className="px-3 py-1.5"><div className="h-5 bg-app-tertiary rounded w-12"></div></td>
                          <td className="px-3 py-1.5"><div className="h-8 bg-blue-600 rounded-lg w-28"></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error loading WSO data</div>
          <div className="text-app-muted">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Responsive Header */}
        <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
          <div className="flex items-center space-x-4 flex-wrap gap-2">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="WeightliftingDB Logo"
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-app-primary">WeightliftingDB</h1>
                <p className="text-sm text-app-tertiary">USA Weightlifting Results Database</p>
              </div>
            </Link>
            <div className="text-app-muted">|</div>
            <h2 className="text-3xl font-bold text-app-primary">Weightlifting State Organizations</h2>
          </div>
          <div className="flex-shrink-0">
            <ThemeSwitcher />
          </div>
        </div>

        {/* Interactive WSO Map */}
        <div className="mt-8 card-large shadow-lg mb-8">
          <h2 className="text-xl font-semibold text-app-primary mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            WSO Territory Map
          </h2>
          <WSOMap className="h-[500px] w-full" />
        </div>

        {/* WSO Directory Table */}
        <div className="card-results shadow-lg">
          <div className="px-6 py-4 border-b border-app-primary">
            <h2 className="text-xl font-semibold text-app-primary flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              WSO Directory
            </h2>
          </div>

          <div className="px-6 py-4">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                <tr>
                  <th
                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                    onClick={() => handleSort('name')}
                  >
                    WSO Name <span className={sortField === 'name' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                  <th
                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                    onClick={() => handleSort('estimated_population')}
                  >
                    Est Population (M) <span className={sortField === 'estimated_population' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'estimated_population' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                  <th
                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                    onClick={() => handleSort('active_lifters_count')}
                  >
                    Active Lifters <span className={sortField === 'active_lifters_count' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'active_lifters_count' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                  <th
                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                    onClick={() => handleSort('recent_meets_count')}
                  >
                    Recent Meets <span className={sortField === 'recent_meets_count' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'recent_meets_count' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                  <th
                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                    onClick={() => handleSort('barbell_clubs_count')}
                  >
                    Clubs <span className={sortField === 'barbell_clubs_count' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'barbell_clubs_count' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </th>
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">
                    View Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((wso) => (
                  <tr key={wso.wso_id} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div className="text-sm font-medium text-app-primary">{wso.name}</div>
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-sm text-app-secondary">
                      {wso.estimated_population ? (wso.estimated_population / 1000000).toFixed(1) : 'N/A'}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-sm text-app-secondary">
                      {(wso.active_lifters_count || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-sm text-app-secondary">
                      {wso.recent_meets_count || 0}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-sm text-app-secondary">
                      {wso.barbell_clubs_count || 0}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <Link
                        href={`/WSO/${wso.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                        className="inline-flex items-center px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        View Details
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200 border-t border-app-primary">
                <tr>
                  <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                    Total ({stats?.totalWSOs || 0} WSOs)
                  </td>
                  <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                    {stats?.totalPopulation ? (stats.totalPopulation / 1000000).toFixed(1) : '0.0'}
                  </td>
                  <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                    {(stats?.totalLifters || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                    {stats?.totalRecentMeets || 0}
                  </td>
                  <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                    {stats?.totalClubs || 0}
                  </td>
                  <td className="px-3 py-1.5"></td>
                </tr>
              </tfoot>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}