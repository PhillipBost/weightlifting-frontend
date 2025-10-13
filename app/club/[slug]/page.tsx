"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, MapPin, Users, TrendingUp, Calendar, ExternalLink, Dumbbell, BarChart3 } from "lucide-react"
import { ThemeSwitcher } from "../../components/ThemeSwitcher"
import { MetricTooltip } from "../../components/MetricTooltip"

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

export default function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [clubData, setClubData] = useState<ClubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    async function unwrapParams() {
      const resolvedParams = await params
      setSlug(resolvedParams.slug)
    }
    unwrapParams()
  }, [params])

  useEffect(() => {
    if (!slug) return

    async function fetchClubData() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/club/${slug}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Club not found')
          } else {
            setError('Failed to load club data')
          }
          setLoading(false)
          return
        }

        const data = await response.json()
        setClubData(data)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching club data:', err)
        setError('An unexpected error occurred')
        setLoading(false)
      }
    }

    fetchClubData()
  }, [slug])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.png"
                  alt="WeightliftingDB Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </Link>
              <button
                onClick={() => router.back()}
                className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            </div>
            <ThemeSwitcher />
          </div>

          <div className="card-large">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-app-tertiary rounded w-3/4"></div>
              <div className="h-4 bg-app-tertiary rounded w-1/2"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-app-tertiary rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !clubData) {
    return (
      <div className="min-h-screen bg-app-gradient">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.png"
                  alt="WeightliftingDB Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </Link>
              <button
                onClick={() => router.back()}
                className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            </div>
            <ThemeSwitcher />
          </div>

          <div className="card-large">
            <div className="text-center py-12">
              <div className="text-red-500 text-xl mb-4">{error || 'Club not found'}</div>
              <p className="text-app-secondary mb-6">
                The club you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.
              </p>
              <Link
                href="/club"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-secondary transition-colors"
              >
                <span>View All Clubs</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const quadrantColor = getQuadrantColor(clubData.quadrant)

  return (
    <div className="min-h-screen bg-app-gradient">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
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
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          </div>
          <div className="flex-shrink-0">
            <ThemeSwitcher />
          </div>
        </div>

        {/* Club Profile Header */}
        <div className="card-large mb-6">
          <div className="space-y-4">
            {/* Club Name and Badge */}
            <div className="flex flex-wrap items-start justify-between gap-4">
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

            {/* External Link */}
            <div className="pt-4 border-t border-app-secondary">
              <a
                href="https://usaweightlifting.sport80.com/public/widget/7"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-accent-primary hover:text-accent-secondary transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View USA Weightlifting Club Directory</span>
              </a>
            </div>
          </div>
        </div>

        {/* Club Statistics */}
        <div className="card-large mb-6">
          <h2 className="text-xl font-semibold text-app-primary mb-6 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Club Statistics
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Active Lifters */}
            <div className="text-center">
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
            <div className="text-center">
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
            <div className="text-center">
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
            <div className="text-center">
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
        <div className="card-large">
          <h2 className="text-xl font-semibold text-app-primary mb-4">About This Club</h2>
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
      </div>
    </div>
  )
}
