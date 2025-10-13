"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useClubQuadrantData } from "../../hooks/useClubQuadrantData"
import { useTheme } from "../ThemeProvider"

// Helper function to create club slug
function createClubSlug(clubName: string): string {
  return clubName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

interface ClubBubbleChartProps {
  className?: string
  height?: number
}

// Helper function to calculate bubble size based on total_participations
function getBubbleSize(participations: number, maxParticipations: number, minParticipations: number): number {
  const minSize = 20   // Keep tiny dots for smallest values
  const maxSize = 800  // Still large maximum but not as extreme

  if (maxParticipations === minParticipations) return minSize

  const normalizedValue = (participations - minParticipations) / (maxParticipations - minParticipations)

  // Use square root scaling to create better distribution in the middle range
  // This gives more medium-sized bubbles between small and large
  const scaledValue = Math.pow(normalizedValue, 0.6) // Power between 0.5 (sqrt) and 1 (linear)

  return minSize + (maxSize - minSize) * scaledValue
}

// Helper function to calculate color intensity based on recent_meets_count
function getColorIntensity(meetsCount: number, maxMeets: number, minMeets: number, theme: 'light' | 'dark'): string {
  if (maxMeets === minMeets) return theme === 'dark' ? 'rgba(96, 165, 250, 0.7)' : 'rgba(59, 130, 246, 0.7)'

  const intensity = (meetsCount - minMeets) / (maxMeets - minMeets)

  // Simple blue with varying opacity based on meets count
  const baseColor = theme === 'dark' ? [96, 165, 250] : [59, 130, 246] // Blue color
  const alpha = Math.max(0.3, 0.3 + (intensity * 0.7)) // Range from 0.3 to 1.0

  return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${alpha})`
}

// Custom tooltip component
function CustomBubbleTooltip({ active, payload }: any) {
  const router = useRouter()

  if (active && payload && payload.length) {
    const data = payload[0].payload
    const clubSlug = createClubSlug(data.club_name)

    const handleClick = () => {
      router.push(`/club/${clubSlug}`)
    }

    return (
      <div
        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm cursor-pointer hover:border-blue-500 transition-colors"
        onClick={handleClick}
      >
        <div className="mb-3">
          <h3 className="font-bold text-blue-600 dark:text-blue-400 text-sm hover:underline">
            {data.club_name}
          </h3>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {data.city && data.state ? `${data.city}, ${data.state}` : data.wso_geography}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-600 dark:text-gray-400">Active Lifters</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{data.active_lifters_count}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">Activity Factor</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{data.activity_factor.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">Total Participations</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{data.total_participations}</div>
          </div>
          <div>
            <div className="text-gray-600 dark:text-gray-400">Recent Meets</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{data.recent_meets_count}</div>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Bubble size:</strong> Total participations<br/>
            <strong>Color intensity:</strong> Recent meets count
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Custom bubble component for Recharts
function CustomBubble(props: any) {
  const { cx, cy, payload, maxParticipations, minParticipations, maxMeets, minMeets, theme } = props

  if (!payload) return null

  const size = getBubbleSize(payload.total_participations, maxParticipations, minParticipations)
  const radius = Math.sqrt(size / Math.PI)

  const fillColor = getColorIntensity(payload.recent_meets_count, maxMeets, minMeets, theme)

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fillColor}
      stroke={theme === 'dark' ? '#1F2937' : '#FFFFFF'}
      strokeWidth={2}
      className="cursor-pointer hover:stroke-4 transition-all duration-200"
      style={{
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
      }}
    />
  )
}

export default function ClubBubbleChart({
  className = "w-full",
  height = 800
}: ClubBubbleChartProps) {
  const { quadrantData, loading, error } = useClubQuadrantData()
  const { theme } = useTheme()
  const router = useRouter()

  // Handle bubble click
  const handleBubbleClick = (data: any) => {
    if (data && data.club_name) {
      const clubSlug = createClubSlug(data.club_name)
      router.push(`/club/${clubSlug}`)
    }
  }

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading bubble chart...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading bubble chart data</div>
          <div className="text-app-muted text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!quadrantData || quadrantData.clubs.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-app-muted">No bubble chart data available</div>
        </div>
      </div>
    )
  }

  const { clubs } = quadrantData

  // Calculate chart domain and min/max values for scaling
  const maxLifters = Math.max(...clubs.map(c => c.active_lifters_count))
  const maxActivity = Math.max(...clubs.map(c => c.activity_factor))
  const minActivity = Math.min(...clubs.map(c => c.activity_factor))
  const maxParticipations = Math.max(...clubs.map(c => c.total_participations))
  const minParticipations = Math.min(...clubs.map(c => c.total_participations))
  const maxMeets = Math.max(...clubs.map(c => c.recent_meets_count))
  const minMeets = Math.min(...clubs.map(c => c.recent_meets_count))

  const xDomain = [0, maxLifters + Math.ceil(maxLifters * 0.1)]
  const yDomain = [Math.max(0, minActivity - 0.5), maxActivity + 0.5]

  // Prepare data for scatter chart
  const chartData = clubs.map(club => ({
    x: club.active_lifters_count,
    y: club.activity_factor,
    ...club
  }))

  return (
    <div className={`${className} relative`}>
      {/* Chart Container */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 80, right: 80, bottom: 80, left: 80 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme === 'dark' ? '#374151' : '#E5E7EB'}
            />
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              axisLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tickLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tick={{ fill: theme === 'dark' ? '#D1D5DB' : '#374151', fontSize: 12 }}
              label={{
                value: 'Active Lifters Count',
                position: 'insideBottom',
                offset: -40,
                style: {
                  textAnchor: 'middle',
                  fill: theme === 'dark' ? '#D1D5DB' : '#374151',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={yDomain}
              axisLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tickLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tick={{ fill: theme === 'dark' ? '#D1D5DB' : '#374151', fontSize: 12 }}
              label={{
                value: 'Activity Factor (Competitions per Lifter)',
                angle: -90,
                position: 'insideLeft',
                style: {
                  textAnchor: 'middle',
                  fill: theme === 'dark' ? '#D1D5DB' : '#374151',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }
              }}
            />

            <Tooltip content={<CustomBubbleTooltip />} />

            <Scatter
              data={chartData}
              onClick={handleBubbleClick}
              shape={(props: any) => (
                <CustomBubble
                  {...props}
                  maxParticipations={maxParticipations}
                  minParticipations={minParticipations}
                  maxMeets={maxMeets}
                  minMeets={minMeets}
                  theme={theme}
                />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3">Bubble Size Scale</h4>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 opacity-70"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Small</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-blue-500 opacity-70"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Medium</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 opacity-70"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Large</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Based on total participations ({maxParticipations} max)
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-3">Opacity Scale</h4>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 opacity-30"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Few Meets</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 opacity-100"></div>
              <span className="text-xs text-gray-600 dark:text-gray-400">Many Meets</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Recent meets count: {minMeets} to {maxMeets} (higher opacity = more meets)
          </div>
        </div>
      </div>
    </div>
  )
}