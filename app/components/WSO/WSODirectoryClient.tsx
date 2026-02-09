'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { MapPin, BarChart3, ChevronRight, ExternalLink } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamically import the map component to avoid SSR issues
const WSOMap = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => (
        <div className="h-96 w-full bg-app-tertiary rounded-lg border border-app-primary flex items-center justify-center">
            <div className="text-app-muted">Loading WSO map...</div>
        </div>
    ),
})

const WSOTreemap = dynamic(() => import('./WSOVoronoiTreemap'), {
    ssr: false,
    loading: () => (
        <div className="h-96 w-full bg-app-tertiary rounded-lg border border-app-primary flex items-center justify-center">
            <div className="text-app-muted">Loading Voronoi treemap...</div>
        </div>
    ),
})

export interface WSOEntry {
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
    // Map data
    territory_geojson?: any
    geographic_center_lat?: number
    geographic_center_lng?: number
    // Clubs data for treemap
    clubs?: any[]
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

export default function WSODirectoryClient({ wsoData }: { wsoData: WSOEntry[] }) {
    const [sortField, setSortField] = useState<keyof WSOEntry>('name')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

    // Calculate statistics from props
    const stats = useMemo<WSOStats>(() => {
        if (!wsoData) return {
            totalWSOs: 0, totalStates: 0, totalClubs: 0, totalLifters: 0,
            totalPopulation: 0, totalRecentMeets: 0, averageActivityFactor: 0
        }

        const totalWSOs = wsoData.length
        const allStates = wsoData.flatMap(wso => wso.states || [])
        const uniqueStates = new Set(allStates)
        const totalStates = uniqueStates.size
        const totalClubs = wsoData.reduce((sum, wso) => sum + (wso.barbell_clubs_count || 0), 0)
        const totalLifters = wsoData.reduce((sum, wso) => sum + (wso.active_lifters_count || 0), 0)
        const totalRecentMeets = wsoData.reduce((sum, wso) => sum + (wso.recent_meets_count || 0), 0)
        const totalPopulation = wsoData.reduce((sum, wso) => sum + (wso.estimated_population || 0), 0)
        const avgActivity = wsoData.reduce((sum, wso) => sum + (wso.activity_factor || 0), 0) / (totalWSOs || 1)

        return {
            totalWSOs,
            totalStates,
            totalClubs,
            totalLifters,
            totalPopulation,
            totalRecentMeets,
            averageActivityFactor: Math.round(avgActivity * 100) / 100
        }
    }, [wsoData])

    const handleSort = (field: keyof WSOEntry) => {
        if (field === sortField) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    const sortedData = useMemo(() => {
        return [...wsoData].sort((a, b) => {
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

            // Handle arrays (e.g. states)
            if (Array.isArray(aVal) && Array.isArray(bVal)) {
                return sortDirection === 'asc'
                    ? aVal.length - bVal.length
                    : bVal.length - aVal.length
            }

            return 0
        })
    }, [wsoData, sortField, sortDirection])

    return (
        <div className="min-h-screen bg-app-gradient">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Interactive WSO Map */}
                <div className="max-w-[1200px] mx-auto mt-8 card-large shadow-lg mb-8">
                    <h2 className="text-xl font-semibold text-app-primary mb-2 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        USA Weightlifting State Organizations Territory Map
                    </h2>
                    <a
                        href="https://www.usaweightlifting.org/club-wso/wso-information"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors mb-4"
                    >
                        <ExternalLink className="h-4 w-4" />
                        <span>WSO Information</span>
                    </a>

                    {/* Use the new prop-based Map component */}
                    <WSOMap className="h-[500px] w-full" wsoData={wsoData} />
                </div>

                {/* WSO Treemap Visualization */}
                <div className="max-w-[1200px] mx-auto card-large shadow-lg mb-8">
                    <h2 className="text-xl font-semibold text-app-primary mb-4 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        WSO Barbell Club Participation
                    </h2>
                    <p className="text-app-secondary mb-4">
                        Voronoi treemap visualization showing relative barbell club participation across WSOs. Cell sizes represent club-associated active lifter counts.
                    </p>
                    <WSOTreemap height={600} wsoData={wsoData} />
                </div>

                {/* WSO Directory Table */}
                <div className="max-w-[1200px] mx-auto card-results shadow-lg">
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
                                            Total ({stats.totalWSOs} WSOs)
                                        </td>
                                        <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                                            {stats.totalPopulation ? (stats.totalPopulation / 1000000).toFixed(1) : '0.0'}
                                        </td>
                                        <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                                            {(stats.totalLifters || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                                            {stats.totalRecentMeets || 0}
                                        </td>
                                        <td className="px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-gray-200">
                                            {stats.totalClubs || 0}
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
