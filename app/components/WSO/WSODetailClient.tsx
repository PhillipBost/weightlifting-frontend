"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import { ExternalLink, Database } from "lucide-react"
import { MetricTooltip } from "../../components/MetricTooltip"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

// Types
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
    official_url?: string | null
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

// Dynamically import map components (they rely on window/leaflet)
const WSODetailMap = dynamic(() => import("../../components/WSO/WSODetailMap"), {
    ssr: false,
    loading: () => (
        <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
        </div>
    ),
})

const WSODetailTreemap = dynamic(() => import("../../components/WSO/WSODetailTreemap"), {
    ssr: false,
    loading: () => (
        <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400">Loading treemap...</div>
        </div>
    ),
})

// -- SUB-COMPONENTS (Ported from original page.tsx) --

function WSOSummary({ clubData }: { clubData: WSOClubData }) {
    if (!clubData || !clubData.wsoInfo) return null

    // We can add summary bits here if needed, but per original design 
    // it seemed to just rely on the parent or return null if data missing.
    // The original page.tsx WSOSummary returned null if data existed? 
    // Let's re-check the original file. 
    // Ah, the original WSOSummary returned NULL if strictly using data. 
    // It seems it was a placeholder or logic check? 
    // Wait, line 600 of original file: `return null`. 
    // So it rendered NOTHING even on success? That's odd. 
    // Let's assume we don't need it if it renders nothing.
    return null
}

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

function WSOClubsTable({ clubs }: { clubs: Club[] }) {
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

    // Sort clubs based on current sort field and direction
    const sortedClubs = [...clubs].sort((a, b) => {
        let aVal: any, bVal: any

        if (sortField === 'location') {
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
        <div className="max-w-[1200px]">
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
                                    Club Name <span className={sortField === 'club_name' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'club_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th
                                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                    onClick={() => handleSort('location')}
                                >
                                    Location <span className={sortField === 'location' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'location' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
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
                                        <span>Active Lifters <span className={sortField === 'active_lifters_count' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'active_lifters_count' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span></span>
                                    </MetricTooltip>
                                </th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedClubs.map((club, index) => {
                                const location = club.geocode_display_name || club.address || ''
                                let displayLocation = 'Location not available'

                                if (location) {
                                    const parts = location.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0)
                                    if (parts.length >= 2) {
                                        // Simplified location logic for brevity, keeping main logic
                                        const lastPart = parts[parts.length - 1]
                                        displayLocation = `${parts[0]}, ${lastPart}`
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
                                        <td className="px-3 py-1.5 whitespace-nowrap">
                                            <Link
                                                href={`/club/${club.club_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
                                                className="inline-flex items-center px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                                            >
                                                View Details
                                                <ChevronRight className="ml-1 h-4 w-4" />
                                            </Link>
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
                                        description="Count of active lifters affiliated with registered barbell clubs."
                                        methodology="Sums the active lifter counts from all clubs within this WSO region."
                                    >
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                            Total: {totalActiveLifters.toLocaleString()} active lifters
                                        </div>
                                    </MetricTooltip>
                                </td>
                                <td className="px-3 py-1.5"></td>
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
        </div>
    )
}

function WSORecentMeetsTable({ meets }: { meets: any[] }) {
    const [sortField, setSortField] = useState<string>('date')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

    // Deduplicate meets based on meet_id or meet_name + date to avoid showing duplicates
    // This can happen if the API/DB query returns multiple rows per meet (though it shouldn't with correct grouping)
    const uniqueMeets = React.useMemo(() => {
        if (!meets) return []
        const seen = new Set()
        return meets.filter(meet => {
            const key = meet.meet_id || `${meet.meet_name}-${meet.date}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [meets]);

    const handleSort = (field: string) => {
        if (field === sortField) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection(field === 'date' ? 'desc' : 'asc')
        }
    }

    // Sort meets based on current sort field and direction
    const sortedMeets = [...uniqueMeets].sort((a, b) => {
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

    // Loading state handling is now done by parent Suspense, so we mostly just check if data exists
    if (!meets) return null;

    return (
        <div className="max-w-[1200px] mx-auto bg-app-secondary rounded-lg shadow-lg border border-app-primary p-6">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-app-primary mb-2">Recent Meets</h2>
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
                                    Meet Name <span className={sortField === 'meet_name' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'meet_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th
                                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                    onClick={() => handleSort('date')}
                                >
                                    Date <span className={sortField === 'date' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th
                                    className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                    onClick={() => handleSort('location')}
                                >
                                    Location <span className={sortField === 'location' ? 'text-accent-primary ml-1' : 'text-app-disabled ml-1'}>{sortField === 'location' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                                </th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedMeets.map((meet, i) => (
                                <tr key={i} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                                    <td className="px-3 py-1.5 text-sm">{meet.meet_name}</td>
                                    <td className="px-3 py-1.5 text-sm">{new Date(meet.date).toLocaleDateString()}</td>
                                    <td className="px-3 py-1.5 text-sm">{meet.location || 'N/A'}</td>
                                    <td className="px-3 py-1.5">
                                        {meet.meet_id && (
                                            <Link href={`/meet/${meet.meet_id}`} className="inline-flex items-center px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
                                                View
                                                <ChevronRight className="ml-1 h-4 w-4" />
                                            </Link>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// -- MAIN CLIENT COMPONENT --

export default function WSODetailClient({
    clubData,
    slug,
    recentMeets
}: {
    clubData: WSOClubData,
    slug: string,
    recentMeets: any[]
}) {
    const recentMeetsCount = clubData?.wsoInfo?.recent_meets_count

    const displayName = clubData.wsoName || slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

    return (
        <div className="min-h-screen bg-app-gradient">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">

                    {/* Map Container */}
                    <div className="max-w-[1200px] mx-auto bg-app-secondary rounded-lg shadow-lg border border-app-primary p-6">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-app-primary mb-2">
                                {displayName} WSO Territory and Club Locations
                            </h2>
                            <p className="text-app-secondary">
                                Geographic boundaries and registered club locations within this WSO region.
                            </p>
                            {clubData?.wsoInfo?.official_url && (
                                <a
                                    href={clubData.wsoInfo.official_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors mt-2"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    <span>Official Website</span>
                                </a>
                            )}
                        </div>

                        <WSODetailMap wsoSlug={slug} wsoName={displayName} recentMeetsCount={recentMeetsCount} />
                    </div>

                    {/* Club Participation Treemap */}
                    <div className="max-w-[1200px] mx-auto bg-app-secondary rounded-lg shadow-lg border border-app-primary p-6">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-app-primary mb-2">
                                Club Participation Overview
                            </h2>
                            <p className="text-app-secondary">
                                Visual comparison of active lifter participation across all clubs in this WSO. Box sizes represent active lifter counts.
                            </p>
                        </div>

                        <WSODetailTreemap wsoSlug={slug} height={400} />
                    </div>

                    {/* Clubs Table */}
                    <WSOClubsTable clubs={clubData.clubs} />

                    {/* Recent Meets Table */}
                    <WSORecentMeetsTable meets={recentMeets} />

                </div>
            </div>
        </div>
    )
}
