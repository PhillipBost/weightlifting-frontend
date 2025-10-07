"use client"

import React, { useState, useEffect } from "react"
import { Treemap, ResponsiveContainer, Tooltip } from "recharts"
import { useTheme } from "../ThemeProvider"
import { useRouter } from "next/navigation"

interface TreemapNode {
  name: string
  wso_id?: number
  size?: number
  type?: 'wso' | 'club'
  children?: TreemapNode[]
  [key: string]: any
}

interface WSOTreemapProps {
  className?: string
  height?: number
}

export default function WSOTreemap({ className = "", height = 600 }: WSOTreemapProps) {
  const [data, setData] = useState<TreemapNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()
  const router = useRouter()

  useEffect(() => {
    async function fetchTreemapData() {
      try {
        setLoading(true)
        const response = await fetch('/api/wso-treemap')
        if (!response.ok) {
          throw new Error('Failed to fetch treemap data')
        }
        const treemapData = await response.json()
        setData(treemapData)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching treemap data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load treemap')
        setLoading(false)
      }
    }

    fetchTreemapData()
  }, [])

  // Color palettes matching Map.tsx
  const colorPalettes = {
    light: [
      '#FF6B6B', // Coral Red
      '#4ECDC4', // Turquoise
      '#45B7D1', // Sky Blue
      '#96CEB4', // Mint Green
      '#FECA57'  // Golden Yellow
    ],
    dark: [
      '#8B5A5A', // Muted Red
      '#5A8B8B', // Muted Teal
      '#5A7B9A', // Muted Blue
      '#6B8B6B', // Muted Green
      '#9A8B5A'  // Muted Gold
    ]
  }

  const currentPalette = colorPalettes[theme]

  // Get WSO color based on wso_id
  const getWSOColor = (wsoId: number): string => {
    const colorIndex = (wsoId - 1) % currentPalette.length
    return currentPalette[colorIndex]
  }

  // Adjust color brightness for clubs (lighter/darker shade)
  const adjustColorBrightness = (color: string, amount: number): string => {
    const hex = color.replace('#', '')
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + amount))
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + amount))
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + amount))
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Custom content renderer for treemap cells
  const CustomTreemapContent = (props: any) => {
    const { depth, x, y, width, height, index, name, wso_id, size, type, root } = props

    // Depth 0 is the root "USA Weightlifting" - don't render
    if (depth === 0) return null

    // Depth 1 is WSO level
    const isWSO = depth === 1

    // Get color
    let fillColor = '#cccccc' // Default fallback
    if (isWSO && wso_id) {
      fillColor = getWSOColor(wso_id)
    } else if (!isWSO && root?.wso_id) {
      // Club level - use lighter shade of parent WSO color
      const wsoColor = getWSOColor(root.wso_id)
      fillColor = adjustColorBrightness(wsoColor, theme === 'dark' ? 30 : 50)
    }

    // Calculate if we have enough space for text
    // PRIORITY: Show WSO labels (they're the important ones)
    // Hide most club labels to reduce clutter - use tooltip instead
    const showWSOText = isWSO && width > 50 && height > 25
    const showClubText = !isWSO && width > 100 && height > 50 // Much higher threshold for clubs
    const showText = showWSOText || showClubText
    const showCount = isWSO && width > 100 && height > 50

    // Format display text - make WSO names more compact if needed
    let displayName = name
    if (isWSO) {
      // Abbreviate long WSO names intelligently
      displayName = name.replace('Weightlifting State Organization', 'WSO')
                        .replace('California', 'CA')
                        .replace('North Central', 'NC')
                        .replace('South Central', 'SC')
                        .replace('Northern', 'N.')
                        .replace('Southern', 'S.')
                        .replace('Eastern', 'E.')
                        .replace('Western', 'W.')

      // Further shorten if still too long
      if (displayName.length > 20) {
        displayName = displayName.substring(0, 17) + '...'
      }
    } else if (!isWSO && name.length > 15) {
      displayName = name.substring(0, 12) + '...'
    }

    const fontSize = isWSO ? 13 : 9
    const fontWeight = isWSO ? 700 : 400

    // Handle click to navigate to WSO detail page
    const handleClick = () => {
      if (isWSO && name) {
        const slug = name.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .trim()
        router.push(`/WSO/${slug}`)
      }
    }

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: fillColor,
            stroke: theme === 'dark' ? '#374151' : '#ffffff',
            strokeWidth: isWSO ? 3 : 1,
            strokeOpacity: 1,
            cursor: isWSO ? 'pointer' : 'default',
            transition: 'all 0.2s ease-in-out'
          }}
          onClick={handleClick}
          className={isWSO ? 'hover:opacity-90' : ''}
        />
        {showText && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill={theme === 'dark' ? '#ffffff' : '#000000'}
            fontSize={fontSize}
            fontWeight={fontWeight}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <tspan x={x + width / 2} dy={showCount ? -6 : 0}>
              {displayName}
            </tspan>
            {showCount && size && (
              <tspan x={x + width / 2} dy={16} fontSize={fontSize - 2} opacity={0.8}>
                ({size.toLocaleString()} lifters)
              </tspan>
            )}
          </text>
        )}
      </g>
    )
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null

    const data = payload[0].payload
    const isWSO = data.depth === 1

    return (
      <div className="bg-app-secondary border border-app-primary rounded-lg shadow-lg p-3">
        <div className="font-semibold text-app-primary mb-1">
          {data.name}
        </div>
        <div className="text-sm text-app-secondary">
          {isWSO ? 'WSO' : 'Barbell Club'}
        </div>
        {data.size && (
          <div className="text-sm text-app-secondary mt-1">
            Active Lifters: <span className="font-medium text-app-primary">{data.size.toLocaleString()}</span>
          </div>
        )}
        {isWSO && (
          <div className="text-xs text-app-muted mt-2">
            Click to view details
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading treemap...</div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading treemap</div>
          <div className="text-app-muted text-sm">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="mb-2 text-xs text-app-muted">
        Box sizes represent total active lifters. Large colored boxes are WSOs, smaller interior boxes are clubs (5+ active lifters). Click WSO boxes for details.
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <Treemap
          data={data.children || []}
          dataKey="size"
          stroke={theme === 'dark' ? '#374151' : '#ffffff'}
          fill="#8884d8"
          content={<CustomTreemapContent />}
          animationDuration={300}
          aspectRatio={2}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  )
}
