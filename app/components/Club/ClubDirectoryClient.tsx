"use client"

import React, { useState } from "react"
import dynamic from "next/dynamic"
import { ExternalLink, GraduationCap, Instagram, MapPin } from "lucide-react"
import { MetricTooltip } from "../MetricTooltip"
import {
    type ClubFilterKey,
    CLUB_FILTER_LABELS,
    clubMatchesFilter,
    getClubFilterCounts,
} from "@/lib/clubs/badges"
import { normalizeInstagram, normalizeExternalUrl } from "@/lib/clubs/social"
import type { UniversityProgram } from "@/types/university"

// Dynamically import the Club Map component with SSR disabled
const ClubMap = dynamic(() => import("./ClubMap"), {
    ssr: false,
    loading: () => (
        <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
        </div>
    ),
})

// Dynamically import the Club Quadrant Chart component with SSR disabled
const ClubQuadrantChart = dynamic(() => import("./ClubQuadrantChart"), {
    ssr: false,
    loading: () => (
        <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <div className="text-gray-500 dark:text-gray-400">Loading analysis...</div>
        </div>
    ),
})

interface ClubDirectoryClientProps {
    clubData: {
        clubLocations: any[]
        quadrantData: any
        clubStats: {
            totalClubs: number
            activeClubs: number
            statesCount: number
            averageMembersPerClub: number
            collegiateClubs?: number
            designatedClubs?: number
        }
        universityPrograms?: UniversityProgram[]
        linkedUniversityCount?: number
    }
}

const FILTER_ORDER: ClubFilterKey[] = ['all', 'collegiate', 'bipoc', 'lgbtqia']

export default function ClubDirectoryClient({ clubData }: ClubDirectoryClientProps) {
    const { clubLocations, quadrantData, clubStats, universityPrograms = [], linkedUniversityCount = 0 } = clubData

    // Directory filter pills — match on community_designation TEXT (never the
    // deprecated boolean columns) and the collegiate table join.
    const [activeFilter, setActiveFilter] = useState<ClubFilterKey>('all')
    const filterCounts = getClubFilterCounts(clubLocations)
    const filteredClubs = activeFilter === 'all'
        ? clubLocations
        : clubLocations.filter(club => clubMatchesFilter(activeFilter, club))

    return (
        <div className="min-h-screen bg-app-gradient">
            <div className="max-w-[1248px] mx-auto px-4 py-8">
                <div className="space-y-6">
                    {/* Club Summary Statistics */}
                    <div className="card-large">
                        <h1 className="text-3xl font-bold text-app-primary mb-6">
                            Barbell Clubs
                        </h1>
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold text-app-primary mb-2">
                                USA Weightlifting Clubs Overview
                            </h2>
                            <p className="text-app-secondary">
                                Summary statistics for all registered barbell clubs. Competition clubs have had at least one lifter compete in the last 24 months.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="text-center">
                                <MetricTooltip
                                    title="Total Clubs"
                                    description="Total number of registered barbell clubs nationwide"
                                    methodology="Counts all clubs in the official club directory with valid location data"
                                >
                                    <div className="text-app-secondary text-sm mb-1">Total Clubs</div>
                                    <div className="text-2xl font-bold text-app-primary">
                                        {clubStats.totalClubs}
                                    </div>
                                </MetricTooltip>
                            </div>

                            <div className="text-center">
                                <MetricTooltip
                                    title="Competition Clubs"
                                    description="Clubs with competitive activity in the last 24 months"
                                    methodology="Clubs with at least one lifter who has competed in a sanctioned meet within the past 24 months"
                                >
                                    <div className="text-app-secondary text-sm mb-1">Competition Clubs</div>
                                    <div className="text-2xl font-bold text-app-primary">
                                        {clubStats.activeClubs}
                                    </div>
                                </MetricTooltip>
                            </div>

                            <div className="text-center">
                                <MetricTooltip
                                    title="Collegiate Programs"
                                    description="University weightlifting programs affiliated with a USA Weightlifting club"
                                    methodology="Counted from university programs linked to a club in the directory"
                                >
                                    <div className="text-app-secondary text-sm mb-1">Collegiate Programs</div>
                                    <div className="text-2xl font-bold text-app-primary">
                                        {linkedUniversityCount}
                                    </div>
                                </MetricTooltip>
                            </div>

                            <div className="text-center">
                                <MetricTooltip
                                    title="Community Designated"
                                    description="Clubs carrying a BIPOC or LGBTQIA+ community designation"
                                    methodology="Clubs with a community designation listed on the USA Weightlifting BIPOC/LGBTQIA+ clubs page"
                                >
                                    <div className="text-app-secondary text-sm mb-1">Community Designated</div>
                                    <div className="text-2xl font-bold text-app-primary">
                                        {clubStats.designatedClubs ?? 0}
                                    </div>
                                </MetricTooltip>
                            </div>
                        </div>

                        {/* External Link */}
                        <div className="pt-4 border-t border-app-secondary">
                            <a
                                href="https://usaweightlifting.sport80.com/public/widget/7"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                                <span>Official Club Directory</span>
                            </a>
                        </div>
                    </div>

                    {/* Map Container */}
                    <div className="card-large">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-app-primary mb-2">
                                Club Locations Map
                            </h2>
                            <p className="text-app-secondary">
                                Interactive map showing all registered barbell club locations. Toggle filters to explore active clubs and state boundaries.
                            </p>
                        </div>

                        {/* Filter pills — text matching on community_designation + collegiate join */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            {FILTER_ORDER.map(key => {
                                const isActive = activeFilter === key
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveFilter(key)}
                                        aria-pressed={isActive}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                            isActive
                                                ? 'bg-app-primary text-app-surface border-app-primary'
                                                : 'bg-app-surface text-app-secondary border-app-primary/20 hover:border-app-primary/50 hover:text-app-primary'
                                        }`}
                                    >
                                        {CLUB_FILTER_LABELS[key]}
                                        <span className={`ml-1.5 text-xs ${isActive ? 'opacity-80' : 'text-app-tertiary'}`}>
                                            {filterCounts[key]}
                                        </span>
                                    </button>
                                )
                            })}
                            <span className="text-xs text-app-tertiary ml-auto">
                                Showing {filteredClubs.length} of {clubLocations.length} clubs
                            </span>
                        </div>

                        <ClubMap clubData={{ clubs: filteredClubs, stats: clubStats }} />
                    </div>

                    {/* University Programs without a linked club page (single /club route) */}
                    <div className="card-large" id="university-programs">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-app-primary mb-2 flex items-center">
                                <GraduationCap className="h-5 w-5 mr-2" />
                                University Programs
                            </h2>
                            <p className="text-app-secondary">
                                Collegiate weightlifting programs that do not yet have an available club profile page.
                                {linkedUniversityCount > 0 && (
                                    <span className="text-app-tertiary">
                                        {' '}Programs with an available club profile are shown on that club's page instead.
                                    </span>
                                )}
                            </p>
                        </div>
                        {universityPrograms.length === 0 ? (
                            <p className="text-app-tertiary text-sm">No unlinked university programs found.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {universityPrograms.map(program => {
                                    const programInstagram = normalizeInstagram(program.instagram)
                                    const programWebsite = normalizeExternalUrl(program.website_url)
                                    const programLocation = [program.city, program.state].filter(Boolean).join(', ')
                                    return (
                                        <div key={program.program_id} className="border border-app-primary/15 rounded-lg p-4 flex flex-col gap-2">
                                            <div className="font-semibold text-app-primary">
                                                {program.school_name}
                                            </div>
                                            {programLocation && (
                                                <div className="text-sm text-app-tertiary flex items-center">
                                                    <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                                                    {programLocation}
                                                </div>
                                            )}
                                            {program.associated_usaw_club && (
                                                <div className="text-sm text-app-secondary">
                                                    Affiliated club: {program.associated_usaw_club}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-2 mt-auto pt-2">
                                                {programInstagram && (
                                                    <a
                                                        href={programInstagram}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded border border-app-primary/20 text-sm text-app-secondary hover:text-accent-primary hover:border-accent-primary transition-colors"
                                                    >
                                                        <Instagram className="h-3.5 w-3.5" />
                                                        <span>Instagram</span>
                                                    </a>
                                                )}
                                                {programWebsite && (
                                                    <a
                                                        href={programWebsite}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded border border-app-primary/20 text-sm text-app-secondary hover:text-accent-primary hover:border-accent-primary transition-colors"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        <span>Website</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Club Development Asymmetric Quadrant Plot */}
                    <div className="card-large">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-app-primary mb-2">
                                Club Development Asymmetric Quadrant Plot
                            </h2>
                            <p className="text-app-secondary">
                                Scatter plot visualization categorizing clubs by member count and activity level.
                                Hover over points for detailed club information and click to explore individual club pages.
                                Note that point location on the graph isn't exactly precise due to 'jitter' setting which allows for visualization of overlapping points.
                            </p>
                        </div>

                        <ClubQuadrantChart quadrantData={quadrantData} />
                    </div>
                </div>
            </div>
        </div>
    )
}
