"use client"

import React from "react"
import dynamic from "next/dynamic"
import { ExternalLink } from "lucide-react"
import { MetricTooltip } from "../MetricTooltip"

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
        }
    }
}

export default function ClubDirectoryClient({ clubData }: ClubDirectoryClientProps) {
    const { clubLocations, quadrantData, clubStats } = clubData

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

                        <ClubMap clubData={{ clubs: clubLocations, stats: clubStats }} />
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
