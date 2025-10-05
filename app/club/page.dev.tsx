"use client"

import React from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Database } from "lucide-react"
import { ThemeSwitcher } from "../components/ThemeSwitcher"
import { MetricTooltip } from "../components/MetricTooltip"
import { useClubData } from "../hooks/useClubData"

// Club Statistics Summary Component
function ClubSummary() {
  const { clubData, loading, error } = useClubData()

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
        <p className="text-red-500">Error loading club information: {error}</p>
      </div>
    )
  }

  const { stats } = clubData

  return (
    <div className="card-large">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-app-primary mb-2">
          USA Weightlifting Clubs Overview
        </h2>
        <p className="text-app-secondary">
          Summary statistics for all registered barbell clubs across the United States.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="text-center">
          <MetricTooltip
            title="Total Clubs"
            description="Total number of registered barbell clubs nationwide"
            methodology="Counts all clubs in the official club directory with valid location data"
          >
            <div className="text-app-secondary text-sm mb-1">Total Clubs</div>
            <div className="text-2xl font-bold text-app-primary">
              {stats.totalClubs}
            </div>
          </MetricTooltip>
        </div>

        <div className="text-center">
          <MetricTooltip
            title="Active Clubs"
            description="Clubs with recent competitive activity"
            methodology="Clubs with at least one active competitive lifter based on recent competition participation"
          >
            <div className="text-app-secondary text-sm mb-1">Active Clubs</div>
            <div className="text-2xl font-bold text-app-primary">
              {stats.activeClubs}
            </div>
          </MetricTooltip>
        </div>

        <div className="text-center">
          <MetricTooltip
            title="States Covered"
            description="Number of states with registered barbell clubs"
            methodology="Unique count of states with at least one registered club location"
          >
            <div className="text-app-secondary text-sm mb-1">States Covered</div>
            <div className="text-2xl font-bold text-app-primary">
              {stats.statesCount}
            </div>
          </MetricTooltip>
        </div>

        <div className="text-center">
          <MetricTooltip
            title="Avg Members/Club"
            description="Average number of active competitive members per club"
            methodology="Average based on clubs with recent competitive activity from meet results data"
          >
            <div className="text-app-secondary text-sm mb-1">Avg Members/Club</div>
            <div className="text-2xl font-bold text-app-primary">
              {stats.averageMembersPerClub}
            </div>
          </MetricTooltip>
        </div>
      </div>
    </div>
  )
}

// Dynamically import the Club Map component with SSR disabled
const ClubMap = dynamic(() => import("../components/Club/ClubMap"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
    </div>
  ),
})

// Dynamically import the Club Quadrant Chart component with SSR disabled
const ClubQuadrantChart = dynamic(() => import("../components/Club/ClubQuadrantChart"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading analysis...</div>
    </div>
  ),
})

// Dynamically import the Club Bubble Chart component with SSR disabled
const ClubBubbleChart = dynamic(() => import("../components/Club/ClubBubbleChart"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading bubble chart...</div>
    </div>
  ),
})

// Dynamically import the Active Club Historical Chart component with SSR disabled
const ActiveClubHistoricalChart = dynamic(() => import("../components/Club/ActiveClubHistoricalChart"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
      <div className="text-gray-500 dark:text-gray-400">Loading active club chart...</div>
    </div>
  ),
})

export default function ClubPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-app-gradient">
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Responsive Header */}
          <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
            <div className="flex items-center space-x-4 flex-wrap gap-2">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.png"
                  alt="WeightliftingDB Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <div className="text-lg font-bold text-app-primary">WeightliftingDB</div>
                  <div className="text-xs text-app-tertiary">USA Weightlifting Results Database</div>
                </div>
              </Link>
              <div className="text-app-muted">|</div>
              <button
                onClick={() => router.push('/')}
                className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </button>
              <div className="text-app-muted">|</div>
              <h1 className="text-3xl font-bold text-app-primary">
                Barbell Clubs
              </h1>
            </div>
            <div className="flex-shrink-0">
              <ThemeSwitcher />
            </div>
          </div>

          <div className="text-center mb-6">
            <p className="text-lg text-app-secondary">
              Explore USA Weightlifting clubs across the United States
            </p>
          </div>

          {/* Content Sections */}
          <div className="space-y-6">
            {/* Club Summary Statistics */}
            <ClubSummary />

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

              <ClubMap />
            </div>

            {/* Club Development Quadrant Analysis */}
            <div className="card-large">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-app-primary mb-2">
                  Club Development Quadrant Analysis
                </h2>
                <p className="text-app-secondary">
                  Scatter plot visualization categorizing clubs by member count and activity level.
                  Hover over points for detailed club information and click to explore individual club pages.
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10B981' }}></div>
                    <span className="text-app-secondary"><strong>Powerhouse:</strong> High members + High activity</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
                    <span className="text-app-secondary"><strong>Intensive:</strong> Low members + High activity</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
                    <span className="text-app-secondary"><strong>Potential:</strong> High members + Low activity</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: '#EF4444' }}></div>
                    <span className="text-app-secondary"><strong>Struggling:</strong> Low members + Low activity</span>
                  </div>
                </div>
              </div>

              <ClubQuadrantChart />
            </div>

            {/* Club Comprehensive Bubble Chart */}
            <div className="card-large">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-app-primary mb-2">
                  Comprehensive Club Profile Bubble Chart
                </h2>
                <p className="text-app-secondary">
                  Four-dimensional visualization showing active lifters (X-axis), activity factor (Y-axis),
                  total participations (bubble size), and recent meets count (color intensity).
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>X-axis:</strong> Active lifters count
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>Y-axis:</strong> Activity factor (competitions per lifter)
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>Bubble size:</strong> Total participations
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>Color intensity:</strong> Recent meets count
                    </div>
                  </div>
                </div>
              </div>

              <ClubBubbleChart />
            </div>

            {/* Active Club Performance Trends */}
            <div className="card-large">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-app-primary mb-2">
                  Active Club Performance Trends
                </h2>
                <p className="text-app-secondary">
                  Rolling 12-month active membership trends for currently active weightlifting clubs. Focus on clubs with recent competitive activity using meaningful historical data.
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>Data Source:</strong> Rolling 12-month active membership snapshots
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>Club Selection:</strong> Currently active clubs ranked by recent, peak, or average activity
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>Time Range:</strong> Configurable from 2 years to full historical data
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-app-secondary">
                      <strong>Focus:</strong> Only clubs with current competitive activity
                    </div>
                  </div>
                </div>
              </div>

              <ActiveClubHistoricalChart />
            </div>

            {/* Additional Information */}
            <div className="card-large">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-app-primary mb-2">
                  About Club Data
                </h2>
                <div className="space-y-3 text-app-secondary">
                  <p>
                    This directory includes all registered USA Weightlifting barbell clubs with location data.
                    Club activity is measured by recent competitive participation from club members.
                  </p>
                  <p>
                    Click on any club marker to view details and access individual club pages with member information,
                    performance metrics, and competition history.
                  </p>
                  <p>
                    Use the map controls to filter by active clubs only or toggle state boundaries for geographic context.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}