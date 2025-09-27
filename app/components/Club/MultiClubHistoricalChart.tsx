"use client"

import React, { useState, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useMultiClubHistoricalData, prepareHistoricalChartData, getHistoricalClubColor } from "../../hooks/useMultiClubHistoricalData"
import { useTheme } from "../ThemeProvider"

interface MultiClubHistoricalChartProps {
  className?: string
  height?: number
}

type SortByOption = 'peak' | 'recent' | 'average'

const sortByOptions: { value: SortByOption; label: string }[] = [
  { value: 'peak', label: 'Peak Performance' },
  { value: 'recent', label: 'Recent Performance' },
  { value: 'average', label: 'Average Performance' }
]

const clubCountOptions = [
  { value: 20, label: '20 Clubs' },
  { value: 25, label: '25 Clubs' },
  { value: 30, label: '30 Clubs' }
]

// Custom tooltip component
function CustomHistoricalTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    // Sort payload by value descending to show top performers first
    const sortedPayload = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0))

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-xs max-h-96 overflow-y-auto">
        <div className="mb-3">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {new Date(label).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
          </h3>
        </div>
        <div className="space-y-1">
          {sortedPayload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-gray-600 dark:text-gray-400 truncate">
                  {entry.dataKey}:
                </span>
              </div>
              <span className="font-medium text-gray-900 dark:text-gray-100 ml-2">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function MultiClubHistoricalChart({
  className = "w-full",
  height = 600
}: MultiClubHistoricalChartProps) {
  const { theme } = useTheme()
  const [clubCount, setClubCount] = useState<number>(25)
  const [sortBy, setSortBy] = useState<SortByOption>('peak')
  const [showLegend, setShowLegend] = useState<boolean>(true)

  const { historicalData, loading, error } = useMultiClubHistoricalData({
    clubCount,
    sortBy,
    minActivityThreshold: 15
  })

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!historicalData?.data) return []
    return prepareHistoricalChartData(historicalData.data.months, historicalData.data.series)
  }, [historicalData])

  const clubs = historicalData?.data?.clubs || []

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading club historical data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading historical data</div>
          <div className="text-app-muted text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!historicalData || chartData.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-app-muted mb-2">No historical data available</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className} relative`}>
      {/* Controls */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Number of Clubs:
          </label>
          <select
            value={clubCount}
            onChange={(e) => setClubCount(Number(e.target.value))}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            {clubCountOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ranking Method:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortByOption)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
          >
            {sortByOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Display Options:
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Show Legend</span>
            </label>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: showLegend ? 200 : 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
            <XAxis
              dataKey="month"
              axisLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tickLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tick={{ fill: theme === 'dark' ? '#D1D5DB' : '#374151', fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              axisLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tickLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tick={{ fill: theme === 'dark' ? '#D1D5DB' : '#374151', fontSize: 12 }}
              label={{
                value: 'Active Members (12mo)',
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
            <Tooltip content={<CustomHistoricalTooltip />} />

            {showLegend && (
              <Legend
                wrapperStyle={{
                  paddingLeft: '20px',
                  fontSize: '12px',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}
                layout="vertical"
                align="right"
                verticalAlign="top"
              />
            )}

            {/* Generate a line for each club with performance optimizations */}
            {clubs.map((clubName, index) => (
              <Line
                key={clubName}
                type="monotone"
                dataKey={clubName}
                stroke={getHistoricalClubColor(clubName, clubs, theme)}
                strokeWidth={2}
                dot={false} // Disable dots for performance
                activeDot={{ r: 4 }} // Only show dots on hover
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Information */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Clubs Displayed
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400">
            {clubs.length}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Time Points
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400">
            {chartData.length}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Total Data Points
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400">
            {historicalData?.metadata?.totalDataPoints?.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Ranking Method
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400">
            {sortByOptions.find(option => option.value === sortBy)?.label}
          </div>
        </div>
      </div>
    </div>
  )
}