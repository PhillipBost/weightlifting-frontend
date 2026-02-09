"use client"

import React from "react"
import Link from "next/link"
import dynamic from 'next/dynamic'
import { MapPin, Users, TrendingUp, Calendar, ExternalLink, Dumbbell, BarChart3, PieChart, Map as MapIcon } from "lucide-react"
import { MetricTooltip } from "../../components/MetricTooltip"
import ClubDemographics from "./ClubDemographics"

const MeetHubSpokeMap = dynamic(() => import('../../components/MeetHubSpokeMap'), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg" />
})

interface ClubData {
    club_name: string
    active_lifters_count: number
    activity_factor: number
    total_participations: number
    recent_meets_count: number
    address: string
    city: string
    state: string
    latitude: number
    longitude: number
    wso_geography: string
    quadrant: 'powerhouse' | 'intensive' | 'sleeping-giant' | 'developing'
    quadrant_label: string
}

interface DemographicsData {
    clubName: string
    demographics: {
        gender: { name: string; value: number }[]
        age: { range: string; count: number; percentage: number }[]
    }
    averageClub: {
        gender: { name: string; value: number }[]
        age: { range: string; percentage: number }[]
    }
    competitionReach: {
        spokes: any[]
    }
}

interface ClubDetailClientProps {
    clubData: ClubData
    demographicsData: DemographicsData | null
}

// Quadrant color helper
function getQuadrantColor(quadrant: string): string {
    switch (quadrant) {
        case 'powerhouse':
            return '#10B981' // Green
        case 'intensive':
            return '#3B82F6' // Blue
        case 'sleeping-giant':
            return '#F59E0B' // Amber
        case 'developing':
            return '#EF4444' // Red
        default:
            return '#6B7280' // Gray
    }
}

// Quadrant description helper
function getQuadrantDescription(quadrant: string): string {
    switch (quadrant) {
        case 'powerhouse':
            return 'High member count with high activity per member - successful large clubs'
        case 'intensive':
            return 'Lower member count but very high activity per member - efficient small clubs'
        case 'sleeping-giant':
            return 'High member count but lower activity per member - clubs with growth opportunity'
        case 'developing':
            return 'Lower member count and lower activity per member - developing clubs with growth potential'
        default:
            return 'Club classification based on membership size and competitive activity'
    }
}

export default function ClubDetailClient({ clubData, demographicsData }: ClubDetailClientProps) {
    const quadrantColor = getQuadrantColor(clubData.quadrant)

    return (
        <div className="min-h-screen bg-app-gradient">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Club Profile Header */}
                <div className="max-w-[1200px] card-primary mb-6">
                    <div className="flex items-start justify-between gap-4">
                        {/* Club Name and Location */}
                        <div>
                            <h1 className="text-3xl font-bold text-app-primary mb-2">
                                {clubData.club_name}
                            </h1>
                            <div className="flex items-center space-x-2 text-app-secondary">
                                <MapPin className="h-4 w-4" />
                                <span>
                                    {clubData.city && clubData.state ? `${clubData.city}, ${clubData.state}` : clubData.address}
                                </span>
                            </div>
                            {clubData.wso_geography && (
                                <div className="flex items-center space-x-2 text-app-tertiary text-sm mt-1">
                                    <Dumbbell className="h-4 w-4" />
                                    <span>WSO: {clubData.wso_geography}</span>
                                </div>
                            )}
                        </div>

                        {/* External Link */}
                        <div className="flex flex-col gap-2">
                            <a
                                href="https://usaweightlifting.sport80.com/public/widget/7"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                                <span>Club Directory</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Club Statistics */}
                <div className="max-w-[1200px]">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-app-primary mb-6 flex items-center">
                            <BarChart3 className="h-5 w-5 mr-2" />
                            Club Statistics
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                        {/* Active Lifters */}
                        <div className="card-primary text-center">
                            <MetricTooltip
                                title="Active Lifters"
                                description="Number of unique competitive lifters associated with this club in recent competitions"
                                methodology="Counted from meet results data over the past 12-24 months"
                            >
                                <div className="flex flex-col items-center">
                                    <Users className="h-8 w-8 text-accent-primary mb-2" />
                                    <div className="text-app-secondary text-sm mb-1">Active Lifters</div>
                                    <div className="text-3xl font-bold text-app-primary">
                                        {clubData.active_lifters_count}
                                    </div>
                                </div>
                            </MetricTooltip>
                        </div>

                        {/* Activity Factor */}
                        <div className="card-primary text-center">
                            <MetricTooltip
                                title="Activity Factor"
                                description="Average competitions per lifter - measures how actively club members compete"
                                methodology="Total participations divided by active lifters count"
                            >
                                <div className="flex flex-col items-center">
                                    <TrendingUp className="h-8 w-8 text-accent-primary mb-2" />
                                    <div className="text-app-secondary text-sm mb-1">Activity Factor</div>
                                    <div className="text-3xl font-bold text-app-primary">
                                        {clubData.activity_factor.toFixed(2)}
                                    </div>
                                </div>
                            </MetricTooltip>
                        </div>

                        {/* Total Participations */}
                        <div className="card-primary text-center">
                            <MetricTooltip
                                title="Total Participations"
                                description="Total number of competition entries by club members"
                                methodology="Sum of all meet participations by active club members"
                            >
                                <div className="flex flex-col items-center">
                                    <Dumbbell className="h-8 w-8 text-accent-primary mb-2" />
                                    <div className="text-app-secondary text-sm mb-1">Total Participations</div>
                                    <div className="text-3xl font-bold text-app-primary">
                                        {clubData.total_participations}
                                    </div>
                                </div>
                            </MetricTooltip>
                        </div>

                        {/* Recent Meets */}
                        <div className="card-primary text-center">
                            <MetricTooltip
                                title="Recent Meets"
                                description="Number of different competitions club members have attended recently"
                                methodology="Count of unique meets with club member participation in recent period"
                            >
                                <div className="flex flex-col items-center">
                                    <Calendar className="h-8 w-8 text-accent-primary mb-2" />
                                    <div className="text-app-secondary text-sm mb-1">Recent Meets</div>
                                    <div className="text-3xl font-bold text-app-primary">
                                        {clubData.recent_meets_count}
                                    </div>
                                </div>
                            </MetricTooltip>
                        </div>
                    </div>
                </div>

                {/* About Section */}
                <div className="max-w-[1200px] card-primary">
                    <div className="flex items-start justify-between gap-4 mb-4">
                        <h2 className="text-xl font-semibold text-app-primary">About This Club</h2>

                        {/* Quadrant Badge */}
                        <div>
                            <MetricTooltip
                                title={`${clubData.quadrant_label} Club`}
                                description={getQuadrantDescription(clubData.quadrant)}
                                methodology="Classification based on active member count and competition activity factor relative to all clubs"
                            >
                                <div
                                    className="px-4 py-2 rounded-lg text-white font-semibold shadow-lg"
                                    style={{ backgroundColor: quadrantColor }}
                                >
                                    {clubData.quadrant_label}
                                </div>
                            </MetricTooltip>
                        </div>
                    </div>

                    <div className="space-y-3 text-app-secondary">
                        <p>
                            <strong>{clubData.club_name}</strong> is classified as a <strong style={{ color: quadrantColor }}>{clubData.quadrant_label}</strong> club,
                            with {clubData.active_lifters_count} active competitive lifters and an activity factor of {clubData.activity_factor.toFixed(2)} competitions per lifter.
                        </p>
                        <p className="text-sm">
                            {getQuadrantDescription(clubData.quadrant)}
                        </p>
                        <div className="pt-4 border-t border-app-secondary">
                            <p className="text-sm text-app-tertiary">
                                Data reflects recent competitive activity and may not include all club members or recreational lifters.
                                For official club information and contact details, please visit the USA Weightlifting club directory.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Demographics & Insights Section */}
                {demographicsData && (
                    <div className="max-w-[1200px] mt-8">
                        <h2 className="text-xl font-semibold text-app-primary mb-6 flex items-center">
                            <PieChart className="h-5 w-5 mr-2" />
                            Club Demographics
                        </h2>

                        <ClubDemographics
                            data={demographicsData.demographics}
                            averageData={demographicsData.averageClub}
                        />
                    </div>
                )}

                {/* Competition Reach Map */}
                {demographicsData && clubData && (
                    <div className="max-w-[1200px] mt-8 mb-12">
                        <div className="card-primary p-0 overflow-hidden">
                            <div className="p-4 border-b border-app-secondary">
                                <h2 className="text-xl font-semibold text-app-primary flex items-center">
                                    <MapIcon className="h-5 w-5 mr-2" />
                                    Competition Reach
                                </h2>
                                <p className="text-sm text-app-secondary mt-1">
                                    Map shows competitions attended by club members in the last 2 years (Club Center → Meets).
                                    {demographicsData.competitionReach.spokes.length === 0 && (
                                        <span className="text-red-500 ml-2">(No geographic data found for recent meets)</span>
                                    )}
                                </p>
                            </div>
                            <div className="h-[500px] w-full relative z-0">
                                <MeetHubSpokeMap
                                    meetLat={clubData.latitude}
                                    meetLng={clubData.longitude}
                                    spokes={demographicsData.competitionReach.spokes}
                                    type="meet"
                                    hubType="club"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
