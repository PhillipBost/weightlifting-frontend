"use client"

import React from "react"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts"
import { useClubQuadrantData, getQuadrantColor, getQuadrantDescription } from "../../hooks/useClubQuadrantData"
import { useTheme } from "../ThemeProvider"

interface ClubQuadrantChartProps {
  className?: string
  height?: number
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm">
        <div className="mb-2">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {data.club_name}
          </h3>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {data.city && data.state ? `${data.city}, ${data.state}` : data.wso_geography}
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Active Lifters:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{data.active_lifters_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Activity Factor:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{data.activity_factor.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Total Participations:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{data.total_participations}</span>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
          <div
            className="text-xs font-medium px-2 py-1 rounded"
            style={{
              backgroundColor: getQuadrantColor(data.quadrant, 'light'),
              color: 'white'
            }}
          >
            {data.quadrant_label}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {getQuadrantDescription(data.quadrant)}
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Quadrant label component
function QuadrantLabel({
  x,
  y,
  label,
  count,
  color,
  description
}: {
  x: number,
  y: number,
  label: string,
  count: number,
  color: string,
  description: string
}) {
  return (
    <div
      className="absolute text-center pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10
      }}
    >
      <div
        className="text-sm font-bold mb-1 px-2 py-1 rounded text-white shadow-lg"
        style={{ backgroundColor: color }}
      >
        {label}
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow">
        {count} clubs
      </div>
    </div>
  )
}

export default function ClubQuadrantChart({
  className = "w-full",
  height = 500
}: ClubQuadrantChartProps) {
  const { quadrantData, loading, error } = useClubQuadrantData()
  const { theme } = useTheme()

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading quadrant analysis...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading quadrant data</div>
          <div className="text-app-muted text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!quadrantData || quadrantData.clubs.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-app-muted">No quadrant data available</div>
        </div>
      </div>
    )
  }

  const { clubs, stats, boundaries } = quadrantData

  // Calculate chart domain with some padding
  const maxLifters = Math.max(...clubs.map(c => c.active_lifters_count))
  const maxActivity = Math.max(...clubs.map(c => c.activity_factor))
  const minActivity = Math.min(...clubs.map(c => c.activity_factor))

  const xDomain = [0, maxLifters + Math.ceil(maxLifters * 0.1)]
  const yDomain = [Math.max(0, minActivity - 0.5), maxActivity + 0.5]

  return (
    <div className={`${className} relative`}>
      {/* Chart Container */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 60, right: 60, bottom: 60, left: 60 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme === 'dark' ? '#374151' : '#E5E7EB'}
            />
            <XAxis
              type="number"
              dataKey="active_lifters_count"
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
              dataKey="activity_factor"
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

            {/* Quadrant reference lines */}
            <ReferenceLine
              x={boundaries.liftersMedian}
              stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <ReferenceLine
              y={boundaries.activityMedian}
              stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
              strokeDasharray="5 5"
              strokeWidth={2}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Scatter plot with colored points */}
            <Scatter data={clubs} fill="#8884d8">
              {clubs.map((club, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getQuadrantColor(club.quadrant, theme)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant Labels */}
        <QuadrantLabel
          x={25}
          y={25}
          label="Intensive"
          count={stats.intensive.count}
          color={getQuadrantColor('intensive', theme)}
          description="Small but very active"
        />
        <QuadrantLabel
          x={75}
          y={25}
          label="Powerhouse"
          count={stats.powerhouse.count}
          color={getQuadrantColor('powerhouse', theme)}
          description="Large and very active"
        />
        <QuadrantLabel
          x={25}
          y={75}
          label="Struggling"
          count={stats.struggling.count}
          color={getQuadrantColor('struggling', theme)}
          description="Needs support"
        />
        <QuadrantLabel
          x={75}
          y={75}
          label="Potential"
          count={stats.potential.count}
          color={getQuadrantColor('potential', theme)}
          description="Room for growth"
        />
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(stats).map(([quadrant, quadrantStats]) => (
          <div
            key={quadrant}
            className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center mb-2">
              <div
                className="w-4 h-4 rounded mr-2"
                style={{ backgroundColor: getQuadrantColor(quadrant as any, theme) }}
              ></div>
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 capitalize">
                {quadrant}
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <div>{quadrantStats.count} clubs</div>
              <div>Avg Lifters: {quadrantStats.avgLifters}</div>
              <div>Avg Activity: {quadrantStats.avgActivity}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}