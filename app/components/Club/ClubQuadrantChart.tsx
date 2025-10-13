"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"
import { ZoomIn, RotateCcw, Info } from "lucide-react"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, ReferenceArea } from "recharts"
import { useClubQuadrantData, getQuadrantColor, getQuadrantDescription } from "../../hooks/useClubQuadrantData"
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

// Custom dot shape for scatter plot with fixed size
const CustomDot = (props: any) => {
  const { cx, cy, fill } = props
  
  return (
    <circle 
      cx={cx} 
      cy={cy} 
      r={4} 
      fill={fill} 
      style={{ cursor: 'pointer' }}
    />
  )
}

interface ClubQuadrantChartProps {
  className?: string
  height?: number
}

// Custom X-Axis Label with Tooltip
function CustomXAxisLabel({ viewBox, theme }: any) {
  const [showTooltip, setShowTooltip] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })
  const iconRef = React.useRef<SVGCircleElement>(null)
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      const tooltipWidth = 320
      const tooltipHeight = 130
      
      // Position tooltip well above the icon to avoid cursor overlap
      // Use larger offset to ensure cursor doesn't obscure content
      let top = rect.top - tooltipHeight - 25
      
      // Offset horizontally from mouse cursor to prevent overlap
      // If mouse is on left side of icon, shift tooltip right, and vice versa
      const iconCenterX = rect.left + rect.width / 2
      const offsetFromMouse = mousePos.x < iconCenterX ? 40 : -40
      let left = iconCenterX - tooltipWidth / 2 + offsetFromMouse
      
      // Keep within viewport
      if (left < 8) left = 8
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8
      }
      if (top < 8) {
        // If no space above, show below with extra clearance
        top = rect.bottom + 25
      }
      
      setPosition({ top, left })
    }
  }, [showTooltip, mousePos])

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }
    setMousePos({ x: e.clientX, y: e.clientY })
    setShowTooltip(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false)
    }, 150)
  }

  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  if (!viewBox) return null
  
  const { x, y, width, height } = viewBox
  const centerX = x + width / 2

  const tooltipContent = showTooltip && mounted ? (
    <div
      className="fixed z-[9999] w-80 pointer-events-none"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-xl">
        <div className="text-sm">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Active Lifters Count</div>
          <div className="text-gray-700 dark:text-gray-300 mb-2">
            Number of unique lifters from this club who competed in at least one sanctioned meet during the past 24 months
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-300 dark:border-gray-600">
            <strong>How it's calculated:</strong> Counts distinct lifters associated with the club who have competition results within the last 24-month rolling window
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <g>
        <text
          x={centerX}
          y={y + height + 45}
          textAnchor="middle"
          fill={theme === 'dark' ? '#E5E7EB' : '#1F2937'}
          fontSize="14"
          fontWeight="bold"
        >
          Active Lifters Count
        </text>
        <g
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'help' }}
        >
          <circle
            ref={iconRef}
            cx={centerX + 95}
            cy={y + height + 45}
            r={6}
            stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
          <text
            x={centerX + 95}
            y={y + height + 49}
            textAnchor="middle"
            fill={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
            fontSize="10"
            fontWeight="600"
            opacity={0.6}
          >
            i
          </text>
        </g>
      </g>
      {mounted && createPortal(tooltipContent, document.body)}
    </>
  )
}

// Custom Y-Axis Label with Tooltip
function CustomYAxisLabel({ viewBox, theme }: any) {
  const [showTooltip, setShowTooltip] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })
  const iconRef = React.useRef<SVGCircleElement>(null)
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      const tooltipWidth = 320
      const tooltipHeight = 130
      
      // Position tooltip to the right of the icon with extra clearance
      let left = rect.right + 25
      
      // Offset vertically from mouse cursor to prevent overlap
      const iconCenterY = rect.top + rect.height / 2
      const offsetFromMouse = mousePos.y < iconCenterY ? 30 : -30
      let top = iconCenterY - tooltipHeight / 2 + offsetFromMouse
      
      // Keep within viewport
      if (top < 8) top = 8
      if (top + tooltipHeight > window.innerHeight - 8) {
        top = window.innerHeight - tooltipHeight - 8
      }
      if (left + tooltipWidth > window.innerWidth - 8) {
        // Show on left if no space on right
        left = rect.left - tooltipWidth - 25
      }
      
      setPosition({ top, left })
    }
  }, [showTooltip, mousePos])

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }
    setMousePos({ x: e.clientX, y: e.clientY })
    setShowTooltip(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false)
    }, 150)
  }

  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  if (!viewBox) return null
  
  const { x, y, width, height } = viewBox
  const centerY = y + height / 2

  const tooltipContent = showTooltip && mounted ? (
    <div
      className="fixed z-[9999] w-80 pointer-events-none"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-xl">
        <div className="text-sm">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Activity Factor</div>
          <div className="text-gray-700 dark:text-gray-300 mb-2">
            Average number of competitions per active lifter during the past 24 months. Higher values indicate more frequent competitive activity
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-300 dark:border-gray-600">
            <strong>How it's calculated:</strong> Calculated as total competition participations divided by active lifters count over the past 24 months
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <g>
        <text
          x={x - 45}
          y={centerY}
          textAnchor="middle"
          fill={theme === 'dark' ? '#E5E7EB' : '#1F2937'}
          fontSize="14"
          fontWeight="bold"
          transform={`rotate(-90, ${x - 45}, ${centerY})`}
        >
          Activity Factor (Competitions per Lifter)
        </text>
        <g
          transform={`rotate(-90, ${x - 45}, ${centerY - 155})`}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'help' }}
        >
          <circle
            ref={iconRef}
            cx={x - 45}
            cy={centerY - 155}
            r={6}
            stroke={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
            strokeWidth={1.5}
            fill="none"
            opacity={0.6}
          />
          <text
            x={x - 45}
            y={centerY - 151}
            textAnchor="middle"
            fill={theme === 'dark' ? '#9CA3AF' : '#6B7280'}
            fontSize="10"
            fontWeight="600"
            opacity={0.6}
          >
            i
          </text>
        </g>
      </g>
      {mounted && createPortal(tooltipContent, document.body)}
    </>
  )
}

// Custom tooltip component
function CustomTooltip({ active, payload }: any) {
  const router = useRouter()

  if (active && payload && payload.length) {
    const data = payload[0].payload
    const clubSlug = createClubSlug(data.club_name)

    const handleClick = () => {
      router.push(`/club/${clubSlug}`)
    }

    return (
      <div
        className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm cursor-pointer hover:border-blue-500 transition-colors"
        onClick={handleClick}
      >
        <div className="mb-2">
          <h3 className="font-bold text-blue-600 dark:text-blue-400 text-sm hover:underline">
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
  description,
  onZoom
}: {
  x: number,
  y: number,
  label: string,
  count: number,
  color: string,
  description: string,
  onZoom: () => void
}) {
  return (
    <div
      className="absolute text-center"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10
      }}
    >
      <div className="flex items-center gap-1 mb-1">
        <div
          className="text-sm font-bold px-2 py-1 rounded text-white shadow-lg pointer-events-none"
          style={{ backgroundColor: color }}
        >
          {label}
        </div>
        <button
          onClick={onZoom}
          className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors pointer-events-auto cursor-pointer"
          title={`Zoom to ${label} quadrant`}
        >
          <ZoomIn className="h-3 w-3" />
        </button>
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded shadow pointer-events-none">
        {count} clubs
      </div>
    </div>
  )
}

export default function ClubQuadrantChart({
  className = "w-full",
  height = 600
}: ClubQuadrantChartProps) {
  const { quadrantData, loading, error } = useClubQuadrantData()
  const { theme } = useTheme()
  const router = useRouter()

  // Zoom state management
  const [zoomDomain, setZoomDomain] = React.useState<{x: [number, number], y: [number, number]} | null>(null)
  
  // Zoom state for mouse wheel and touch gestures - must be before conditional returns
  const chartRef = React.useRef<HTMLDivElement>(null)
  const touchRef = React.useRef<{ distance: number | null, center: { x: number, y: number } | null }>({ 
    distance: null, 
    center: null 
  })
  
  // Store domains in refs to avoid dependency issues in callbacks
  const xDomainRef = React.useRef<[number, number]>([0, 100])
  const yDomainRef = React.useRef<[number, number]>([0, 5])

  // Handle mouse wheel zoom
  const handleWheel = React.useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    if (!chartRef.current) return
    
    const rect = chartRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Calculate mouse position as percentage of chart
    const xPercent = mouseX / rect.width
    const yPercent = 1 - (mouseY / rect.height) // Invert Y axis
    
    const currentXDomain = zoomDomain?.x || xDomainRef.current
    const currentYDomain = zoomDomain?.y || yDomainRef.current
    
    const xRange = currentXDomain[1] - currentXDomain[0]
    const yRange = currentYDomain[1] - currentYDomain[0]
    
    // Zoom factor (negative delta = zoom in, positive = zoom out)
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
    
    const newXRange = xRange * zoomFactor
    const newYRange = yRange * zoomFactor
    
    // Calculate new domain centered on mouse position
    const mouseXValue = currentXDomain[0] + xRange * xPercent
    const mouseYValue = currentYDomain[0] + yRange * yPercent
    
    const newXDomain: [number, number] = [
      Math.max(0, mouseXValue - newXRange * xPercent),
      mouseXValue + newXRange * (1 - xPercent)
    ]
    
    const newYDomain: [number, number] = [
      Math.max(0, mouseYValue - newYRange * yPercent),
      mouseYValue + newYRange * (1 - yPercent)
    ]
    
    setZoomDomain({ x: newXDomain, y: newYDomain })
  }, [zoomDomain])
  
  // Handle touch gestures for pinch zoom
  const handleTouchStart = React.useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchRef.current.distance = Math.sqrt(dx * dx + dy * dy)
      touchRef.current.center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      }
    }
  }, [])
  
  const handleTouchMove = React.useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && touchRef.current.distance && chartRef.current) {
      e.preventDefault()
      
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const newDistance = Math.sqrt(dx * dx + dy * dy)
      
      const zoomFactor = touchRef.current.distance / newDistance
      
      const currentXDomain = zoomDomain?.x || xDomainRef.current
      const currentYDomain = zoomDomain?.y || yDomainRef.current
      
      const xRange = currentXDomain[1] - currentXDomain[0]
      const yRange = currentYDomain[1] - currentYDomain[0]
      
      const newXRange = xRange * zoomFactor
      const newYRange = yRange * zoomFactor
      
      const rect = chartRef.current.getBoundingClientRect()
      const centerX = touchRef.current.center!.x - rect.left
      const centerY = touchRef.current.center!.y - rect.top
      
      const xPercent = centerX / rect.width
      const yPercent = 1 - (centerY / rect.height)
      
      const centerXValue = currentXDomain[0] + xRange * xPercent
      const centerYValue = currentYDomain[0] + yRange * yPercent
      
      const newXDomain: [number, number] = [
        Math.max(0, centerXValue - newXRange * xPercent),
        centerXValue + newXRange * (1 - xPercent)
      ]
      
      const newYDomain: [number, number] = [
        Math.max(0, centerYValue - newYRange * yPercent),
        centerYValue + newYRange * (1 - yPercent)
      ]
      
      setZoomDomain({ x: newXDomain, y: newYDomain })
      touchRef.current.distance = newDistance
    }
  }, [zoomDomain])
  
  const handleTouchEnd = React.useCallback(() => {
    touchRef.current.distance = null
    touchRef.current.center = null
  }, [])
  
  // Attach wheel and touch event listeners
  React.useEffect(() => {
    const chartElement = chartRef.current
    if (!chartElement) return
    
    chartElement.addEventListener('wheel', handleWheel, { passive: false })
    chartElement.addEventListener('touchstart', handleTouchStart, { passive: false })
    chartElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    chartElement.addEventListener('touchend', handleTouchEnd)
    
    return () => {
      chartElement.removeEventListener('wheel', handleWheel)
      chartElement.removeEventListener('touchstart', handleTouchStart)
      chartElement.removeEventListener('touchmove', handleTouchMove)
      chartElement.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd])

  // Handle scatter point click
  const handleScatterClick = (data: any) => {
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

  if (!quadrantData || quadrantData.clubs.length === 0 || !quadrantData.stats) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-app-muted">No quadrant data available</div>
        </div>
      </div>
    )
  }

  const { clubs, stats, boundaries } = quadrantData

  // Use club name hash for deterministic jitter with overlap detection
  const jitteredClubs = clubs.map(club => {
    // Create a simple hash from club name for deterministic positioning
    const hash = club.club_name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    let jitterX = ((hash % 100) / 100 - 0.5) * 0.8
    let jitterY = ((hash % 50) / 50 - 0.5) * 0.08
    
    return {
      ...club,
      active_lifters_count_display: club.active_lifters_count + jitterX,
      activity_factor_display: club.activity_factor + jitterY,
      hash // Store hash for further jitter adjustment
    }
  })
  
  // Iteratively increase jitter for overlapping points
  const adjustedClubs = jitteredClubs.map((club, index) => {
    let x = club.active_lifters_count_display
    let y = club.activity_factor_display
    let jitterMultiplier = 1
    
    // Check for overlaps (within 0.5 units)
    const OVERLAP_THRESHOLD = 0.5
    let hasOverlap = true
    let iterations = 0
    const MAX_ITERATIONS = 5
    
    while (hasOverlap && iterations < MAX_ITERATIONS) {
      hasOverlap = false
      
      for (let i = 0; i < jitteredClubs.length; i++) {
        if (i === index) continue
        
        const other = jitteredClubs[i]
        const dx = x - other.active_lifters_count_display
        const dy = y - other.activity_factor_display
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < OVERLAP_THRESHOLD) {
          hasOverlap = true
          break
        }
      }
      
      if (hasOverlap) {
        jitterMultiplier += 1
        const baseJitterX = ((club.hash % 100) / 100 - 0.5) * 0.8
        const baseJitterY = ((club.hash % 50) / 50 - 0.5) * 0.08
        x = club.active_lifters_count + baseJitterX * jitterMultiplier
        y = club.activity_factor + baseJitterY * jitterMultiplier
        iterations++
      }
    }
    
    return {
      ...club,
      active_lifters_count_display: x,
      activity_factor_display: y
    }
  })
  
  // Calculate proximity factors after jittering
  const clubsWithProximity = adjustedClubs.map((club, index) => {
    const x = club.active_lifters_count_display
    const y = club.activity_factor_display
    
    // Calculate distance to nearest neighbor using displayed coordinates
    let minDistance = Infinity
    adjustedClubs.forEach((otherClub, otherIndex) => {
      if (index === otherIndex) return
      
      const dx = x - otherClub.active_lifters_count_display
      const dy = y - otherClub.activity_factor_display
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < minDistance) {
        minDistance = distance
      }
    })
    
    // Normalize proximity factor based on distance
    // Closer points (distance < 2) get smaller proximityFactor
    // Isolated points (distance > 10) get larger proximityFactor
    const proximityFactor = Math.min(1, Math.max(0, (minDistance - 2) / 8))
    
    return {
      ...club,
      proximityFactor
    }
  })

  // Calculate chart domain with some padding
  const maxLifters = Math.max(...clubs.map(c => c.active_lifters_count))
  const maxActivity = Math.max(...clubs.map(c => c.activity_factor))
  const minActivity = Math.min(...clubs.map(c => c.activity_factor))

  const xDomain: [number, number] = [0, maxLifters + Math.ceil(maxLifters * 0.1)]
  const yDomain: [number, number] = [Math.max(0, minActivity - 0.5), maxActivity + 0.5]
  
  // Update domain refs for zoom callbacks
  xDomainRef.current = xDomain
  yDomainRef.current = yDomain

  // Zoom handler for quadrants using hard-coded thresholds
  const handleQuadrantZoom = (quadrant: 'powerhouse' | 'intensive' | 'sleeping-giant' | 'developing') => {
    // Hard-coded thresholds matching API logic
    const LIFTERS_THRESHOLD = 20
    const ACTIVITY_THRESHOLD_POWERHOUSE = 2.0
    const ACTIVITY_THRESHOLD_INTENSIVE = 1.6

    const quadrantBounds = {
      // Intensive: 1-19 lifters, 1.6+ activity
      intensive: { x: [0, 19.5] as [number, number], y: [ACTIVITY_THRESHOLD_INTENSIVE, maxActivity + 0.5] as [number, number] },
      // Powerhouse: 20+ lifters, 2.0+ activity
      powerhouse: { x: [LIFTERS_THRESHOLD - 0.5, maxLifters + Math.ceil(maxLifters * 0.1)] as [number, number], y: [ACTIVITY_THRESHOLD_POWERHOUSE, maxActivity + 0.5] as [number, number] },
      // Developing: 1-19 lifters, ≤1.59 activity
      developing: { x: [0, 19.5] as [number, number], y: [Math.max(0, minActivity - 0.5), 1.59] as [number, number] },
      // Sleeping Giant: 20+ lifters, ≤1.99 activity
      'sleeping-giant': { x: [LIFTERS_THRESHOLD - 0.5, maxLifters + Math.ceil(maxLifters * 0.1)] as [number, number], y: [Math.max(0, minActivity - 0.5), 1.99] as [number, number] }
    }

    setZoomDomain(quadrantBounds[quadrant])
  }

  const handleResetZoom = () => {
    setZoomDomain(null)
  }

  return (
    <div className={`${className} relative`}>
      {/* Reset Zoom Button */}
      {zoomDomain && (
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={handleResetZoom}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-600 dark:bg-blue-500 text-white border border-blue-700 dark:border-blue-600 rounded shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all"
            title="Reset zoom to show all clubs"
          >
            <RotateCcw className="h-4 w-4" />
            Reset View
          </button>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartRef} className={`rounded-lg border p-4 ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}>
        <style jsx>{`
          :global(.recharts-symbols) {
            transition: all 0.15s ease-in-out;
            cursor: pointer;
          }
          :global(.recharts-symbols:hover) {
            filter: brightness(1.4) drop-shadow(0 0 3px rgba(0, 0, 0, 0.6));
          }
          :global(.recharts-wrapper .recharts-surface) {
            background: transparent !important;
          }
          :global(.recharts-wrapper svg) {
            background: transparent !important;
          }
          :global(.recharts-wrapper svg rect[width][height]) {
            fill: transparent !important;
            opacity: 0 !important;
          }
        `}</style>
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 60, right: 60, bottom: 60, left: 60 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={theme === 'dark' ? '#374151' : '#E5E7EB'}
            />
            <XAxis
              type="number"
              dataKey="active_lifters_count_display"
              domain={zoomDomain?.x || xDomain}
              allowDataOverflow={true}
              axisLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tickLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tick={{ fill: theme === 'dark' ? '#E5E7EB' : '#1F2937', fontSize: 12, fontWeight: 600 }}
              label={(props: any) => <CustomXAxisLabel {...props} theme={theme} />}
            />
            <YAxis
              type="number"
              dataKey="activity_factor_display"
              domain={zoomDomain?.y || yDomain}
              allowDataOverflow={true}
              axisLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tickLine={{ stroke: theme === 'dark' ? '#6B7280' : '#9CA3AF' }}
              tick={{ fill: theme === 'dark' ? '#E5E7EB' : '#1F2937', fontSize: 12, fontWeight: 600 }}
              label={(props: any) => <CustomYAxisLabel {...props} theme={theme} />}
            />

            {/* Quadrant reference lines */}
            {/* Vertical line at 20 lifters - full height */}
            <ReferenceLine
              x={boundaries.liftersMedian}
              stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
              strokeDasharray="5 5"
              strokeWidth={2}
            />

            {/* Partial horizontal line at 2.0 activity - only right side (Powerhouse/Sleeping Giant boundary) */}
            <ReferenceLine
              segment={[
                { x: boundaries.liftersMedian, y: boundaries.activityMedian },
                { x: xDomain[1], y: boundaries.activityMedian }
              ]}
              stroke={theme === 'dark' ? '#10B981' : '#059669'}
              strokeDasharray="8 4"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />

            {/* Partial horizontal line at 1.6 activity - only left side (Intensive/Developing boundary) */}
            <ReferenceLine
              segment={[
                { x: xDomain[0], y: 1.6 },
                { x: boundaries.liftersMedian, y: 1.6 }
              ]}
              stroke={theme === 'dark' ? '#3B82F6' : '#2563EB'}
              strokeDasharray="8 4"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Scatter plot with colored points */}
            <Scatter
              data={clubsWithProximity}
              fill="#8884d8"
              onClick={handleScatterClick}
              cursor="pointer"
              shape={CustomDot}
            >
              {clubsWithProximity.map((club, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getQuadrantColor(club.quadrant, theme)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant labels - inside chart */}
        <QuadrantLabel
          x={15}
          y={10}
          label="Intensive"
          count={stats.intensive.count}
          color={getQuadrantColor('intensive', theme)}
          description="High activity per member"
          onZoom={() => handleQuadrantZoom('intensive')}
        />
        <QuadrantLabel
          x={75}
          y={10}
          label="Powerhouse"
          count={stats.powerhouse.count}
          color={getQuadrantColor('powerhouse', theme)}
          description="Large and active"
          onZoom={() => handleQuadrantZoom('powerhouse')}
        />
        <QuadrantLabel
          x={15}
          y={75}
          label="Developing"
          count={stats.developing.count}
          color={getQuadrantColor('developing', theme)}
          description="Needs support"
          onZoom={() => handleQuadrantZoom('developing')}
        />
        <QuadrantLabel
          x={75}
          y={75}
          label="Sleeping Giant"
          count={stats['sleeping-giant']?.count || 0}
          color={getQuadrantColor('sleeping-giant', theme)}
          description="Room for growth"
          onZoom={() => handleQuadrantZoom('sleeping-giant')}
        />
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(stats).map(([quadrant, quadrantStats]) => {
          const descriptions: Record<string, string> = {
            powerhouse: 'High members + High activity',
            intensive: 'Low members + High activity',
            'sleeping-giant': 'High members + Low activity',
            developing: 'Low members + Low activity'
          }
          
          return (
            <div
              key={quadrant}
              className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <div className="mb-2">
                <div className="flex items-center mb-1">
                  <div
                    className="w-4 h-4 rounded mr-2 flex-shrink-0"
                    style={{ backgroundColor: getQuadrantColor(quadrant as any, theme) }}
                  ></div>
                  <div>
                    <span className={`font-semibold text-sm capitalize ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                      {quadrant}
                    </span>
                    <span className={`text-xs ml-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                      {descriptions[quadrant]}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`space-y-1 text-xs ${theme === 'dark' ? 'text-gray-200' : 'text-gray-600'}`}>
                <div>{quadrantStats.count} clubs</div>
                <div>Avg Lifters: {quadrantStats.avgLifters}</div>
                <div>Avg Activity: {quadrantStats.avgActivity}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}