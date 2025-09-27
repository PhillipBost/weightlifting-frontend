"use client"

import React, { useState, useMemo, useEffect } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useActiveClubHistoricalData, prepareActiveClubChartData, getActiveClubColor } from "../../hooks/useActiveClubHistoricalData"
import { useTheme } from "../ThemeProvider"

interface ActiveClubHistoricalChartProps {
  className?: string
  height?: number
}

type TimeRangeOption = 2 | 5 | 10 | 'all'

const clubCountOptions = [
  { value: 10, label: '10 Clubs' },
  { value: 25, label: '25 Clubs' },
  { value: 50, label: '50 Clubs' },
  { value: 75, label: '75 Clubs' }
]

const timeRangeOptions: { value: TimeRangeOption; label: string }[] = [
  { value: 2, label: 'Last 2 Years' },
  { value: 5, label: 'Last 5 Years' },
  { value: 10, label: 'Last 10 Years' },
  { value: 'all', label: 'All Time' }
]

type DisplayMetric = 'members' | 'activity' | 'participations'

const displayMetricOptions: { value: DisplayMetric; label: string }[] = [
  { value: 'members', label: 'Active Members' },
  { value: 'activity', label: 'Activity Score' },
  { value: 'participations', label: 'Total Participations' }
]

// Custom tooltip component
function CustomActiveClubTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    // Sort payload by value descending to show top performers first
    const sortedPayload = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0))

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-xs max-h-96 overflow-y-auto">
        <div className="mb-3">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {new Date(label).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h3>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            12-Month Rolling Active Members
          </div>
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

export default function ActiveClubHistoricalChart({
  className = "w-full",
  height = 600
}: ActiveClubHistoricalChartProps) {
  const { theme } = useTheme()
  const [clubCount, setClubCount] = useState<number>(25)
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('all')
  const [showLegend, setShowLegend] = useState<boolean>(false)
  const [displayMetric, setDisplayMetric] = useState<DisplayMetric>('members')
  const [minActivityThreshold, setMinActivityThreshold] = useState<number>(1)
  const [wsoFilter, setWsoFilter] = useState<string>('all')
  const [wsoOptions, setWsoOptions] = useState<Array<{name: string}>>([])
  const [wsoLoading, setWsoLoading] = useState<boolean>(false)

  const timeRangeYears = timeRange === 'all' ? 15 : timeRange // Use 15 years as max for 'all'

  const { historicalData, loading, error } = useActiveClubHistoricalData({
    clubCount,
    sortBy: 'recent',
    minActivityThreshold: displayMetric === 'activity' ? 10 : minActivityThreshold,
    timeRangeYears,
    wsoFilter,
    displayMetric
  })

  // Fetch WSO options on component mount
  useEffect(() => {
    const fetchWsoOptions = async () => {
      setWsoLoading(true)
      try {
        const response = await fetch('/api/wso-boundaries')
        if (response.ok) {
          const wsoData = await response.json()
          setWsoOptions(wsoData.map((wso: any) => ({ name: wso.name })))
        }
      } catch (error) {
        console.error('Error fetching WSO options:', error)
      } finally {
        setWsoLoading(false)
      }
    }

    fetchWsoOptions()
  }, [])

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!historicalData?.data) return []
    return prepareActiveClubChartData(historicalData.data.months, historicalData.data.series)
  }, [historicalData])

  const clubs = historicalData?.data?.clubs || []

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading active club data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading active club data</div>
          <div className="text-app-muted text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!historicalData || chartData.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-app-muted mb-2">No active club data available</div>
          <div className="text-app-muted text-sm">Try adjusting the activity threshold or time range</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className} relative`}>
      {/* Controls */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Number of Clubs:
          </label>
          <select
            value={clubCount}
            onChange={(e) => setClubCount(Number(e.target.value))}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-gray-900 dark:text-gray-100"
          >
            {clubCountOptions.map((option) => (
              <option key={option.value} value={option.value} className="text-gray-900 dark:text-gray-100">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Display Metric:
          </label>
          <select
            value={displayMetric}
            onChange={(e) => setDisplayMetric(e.target.value as DisplayMetric)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-gray-900 dark:text-gray-100"
          >
            {displayMetricOptions.map((option) => (
              <option key={option.value} value={option.value} className="text-gray-900 dark:text-gray-100">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Time Range:
          </label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value === 'all' ? 'all' : Number(e.target.value) as TimeRangeOption)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 text-gray-900 dark:text-gray-100"
          >
            {timeRangeOptions.map((option) => (
              <option key={option.value} value={option.value} className="text-gray-900 dark:text-gray-100">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            WSO Region:
          </label>
          <select
            value={wsoFilter}
            onChange={(e) => setWsoFilter(e.target.value)}
            disabled={wsoLoading}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50 text-gray-900 dark:text-gray-100"
          >
            <option value="all" className="text-gray-900 dark:text-gray-100">All Regions</option>
            {wsoOptions.map((wso) => (
              <option key={wso.name} value={wso.name} className="text-gray-900 dark:text-gray-100">
                {wso.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
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
              <span className="ml-2 text-sm text-gray-900 dark:text-gray-100">Show Legend</span>
            </label>
            {displayMetric === 'activity' && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                (Clubs with 10+ members only)
              </div>
            )}
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
              tick={{ fill: theme === 'dark' ? '#F3F4F6' : '#111827', fontSize: 12, fontWeight: 'bold' }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              axisLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tickLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tick={{ fill: theme === 'dark' ? '#F3F4F6' : '#111827', fontSize: 12, fontWeight: 'bold' }}
              label={{
                value: displayMetric === 'members' ? 'Active Members (12mo Rolling)' :
                       displayMetric === 'activity' ? 'Activity Score (12mo Rolling)' :
                       'Total Participations (12mo Rolling)',
                angle: -90,
                position: 'insideLeft',
                style: {
                  textAnchor: 'middle',
                  fill: theme === 'dark' ? '#F3F4F6' : '#111827',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }
              }}
            />
            <Tooltip content={<CustomActiveClubTooltip />} />

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

            {/* Generate a line for each active club with performance optimizations */}
            {clubs.map((clubName, index) => (
              <Line
                key={clubName}
                type="monotone"
                dataKey={clubName}
                stroke={getActiveClubColor(clubName, clubs, theme)}
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
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            Active Clubs Total
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400">
            {historicalData?.metadata?.activeClubsTotal?.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Display Metric
          </div>
          <div className="text-lg text-gray-600 dark:text-gray-400">
            {displayMetricOptions.find(option => option.value === displayMetric)?.label}
          </div>
        </div>
      </div>
    </div>
  )
}