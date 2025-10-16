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

// Custom tooltip component - HOVER ONLY (non-interactive preview)
function CustomTooltip({ active, payload, theme }: any) {
  // Only show for hover, not for sticky (sticky is rendered via portal)
  const displayData = active && payload && payload.length ? payload[0].payload : null

  if (displayData) {
    const data = displayData

    return (
      <div
        className="p-3 rounded-lg border max-w-sm"
        style={{
          backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
          color: theme === 'dark' ? '#F3F4F6' : '#111827',
          borderColor: theme === 'dark' ? '#374151' : '#E5E7EB',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div className="mb-3">
          <h3 className="font-bold text-base mb-1">
            {data.club_name}
          </h3>
          <div className="text-sm" style={{ opacity: 0.8 }}>
            {data.city && data.state ? `${data.city}, ${data.state}` : data.wso_geography}
          </div>
        </div>

        <div className="space-y-2 text-sm mb-3" style={{ opacity: 0.8 }}>
          <div className="flex justify-between">
            <span>Active Lifters:</span>
            <span className="font-medium">{data.active_lifters_count}</span>
          </div>
          <div className="flex justify-between">
            <span>Activity Factor:</span>
            <span className="font-medium">{data.activity_factor.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Participations:</span>
            <span className="font-medium">{data.total_participations}</span>
          </div>
        </div>

        <div className="pt-2 mb-2" style={{ borderTop: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` }}>
          <div
            className="text-xs font-medium px-2 py-1 rounded"
            style={{
              backgroundColor: getQuadrantColor(data.quadrant, 'light'),
              color: 'white'
            }}
          >
            {data.quadrant_label}
          </div>
          <div className="text-xs mt-1" style={{ opacity: 0.8 }}>
            {getQuadrantDescription(data.quadrant)}
          </div>
        </div>

        <div className="text-xs text-center italic" style={{ opacity: 0.6 }}>
          Click point for details
        </div>
      </div>
    )
  }

  return null
}

// Sticky tooltip component - INTERACTIVE (rendered via portal)
function StickyTooltipPortal({ data, position, onClose, theme }: {
  data: any,
  position: { x: number, y: number },
  onClose: () => void,
  theme: 'light' | 'dark'
}) {
  const router = useRouter()
  const [positioned, setPositioned] = React.useState(false)
  const [tooltipPos, setTooltipPos] = React.useState({ top: 0, left: 0 })
  const tooltipRef = React.useRef<HTMLDivElement>(null)
  const positionKeyRef = React.useRef<string>('')

  // Reset positioned flag when position changes (for subsequent clicks)
  React.useEffect(() => {
    const newKey = `${position.x},${position.y}`
    if (positionKeyRef.current !== newKey && positionKeyRef.current !== '') {
      setPositioned(false)
    }
    positionKeyRef.current = newKey
  }, [position])

  // Calculate tooltip position to keep it within viewport
  React.useEffect(() => {
    if (!tooltipRef.current) return

    // Use requestAnimationFrame to ensure DOM has painted and dimensions are available
    const frameId = requestAnimationFrame(() => {
      if (!tooltipRef.current) return

      const tooltipWidth = tooltipRef.current.offsetWidth
      const tooltipHeight = tooltipRef.current.offsetHeight

      // Only proceed if we have valid dimensions
      if (tooltipWidth === 0 || tooltipHeight === 0) {
        // Retry on next frame if dimensions aren't ready
        requestAnimationFrame(() => {
          if (!tooltipRef.current) return
          const width = tooltipRef.current.offsetWidth
          const height = tooltipRef.current.offsetHeight
          if (width > 0 && height > 0) {
            calculatePosition(width, height)
          }
        })
        return
      }

      calculatePosition(tooltipWidth, tooltipHeight)
    })

    function calculatePosition(tooltipWidth: number, tooltipHeight: number) {
      let left = position.x - tooltipWidth / 2
      let top = position.y - tooltipHeight - 15 // Position above cursor with gap

      // Keep within viewport horizontally
      if (left < 8) left = 8
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8
      }

      // Keep within viewport vertically
      if (top < 8) {
        // Show below cursor if no space above
        top = position.y + 15
      }

      setTooltipPos({ top, left })
      setPositioned(true)
    }

    return () => cancelAnimationFrame(frameId)
  }, [position])

  if (!data) return null

  const clubSlug = createClubSlug(data.club_name)

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/club/${clubSlug}`)
  }

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] w-80 transition-opacity duration-200"
      style={{
        top: `${tooltipPos.top}px`,
        left: `${tooltipPos.left}px`,
        opacity: positioned ? 1 : 0
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="sticky-tooltip p-3 rounded-lg border max-w-sm"
        style={{
          backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
          color: theme === 'dark' ? '#F3F4F6' : '#111827',
          borderColor: theme === 'dark' ? '#374151' : '#E5E7EB',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div className="mb-3">
          <h3 className="font-bold text-base mb-1">
            {data.club_name}
          </h3>
          <div className="text-sm" style={{ opacity: 0.8 }}>
            {data.city && data.state ? `${data.city}, ${data.state}` : data.wso_geography}
          </div>
        </div>

        <div className="space-y-2 text-sm mb-3" style={{ opacity: 0.8 }}>
          <div className="flex justify-between">
            <span>Active Lifters:</span>
            <span className="font-medium">{data.active_lifters_count}</span>
          </div>
          <div className="flex justify-between">
            <span>Activity Factor:</span>
            <span className="font-medium">{data.activity_factor.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Participations:</span>
            <span className="font-medium">{data.total_participations}</span>
          </div>
        </div>

        <div className="mb-3 pt-2" style={{ borderTop: `1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}` }}>
          <div
            className="text-xs font-medium px-2 py-1 rounded"
            style={{
              backgroundColor: getQuadrantColor(data.quadrant, 'light'),
              color: 'white'
            }}
          >
            {data.quadrant_label}
          </div>
          <div className="text-xs mt-1" style={{ opacity: 0.8 }}>
            {getQuadrantDescription(data.quadrant)}
          </div>
        </div>

        <button
          onClick={handleButtonClick}
          className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center cursor-pointer"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          View Club Details
        </button>
      </div>
    </div>
  )

  return createPortal(tooltipContent, document.body)
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
        zIndex: 10,
        pointerEvents: 'none'
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

  // Sticky tooltip state
  const [stickyTooltip, setStickyTooltip] = React.useState<any>(null)
  const [tooltipPosition, setTooltipPosition] = React.useState<{x: number, y: number} | null>(null)
  
  // Zoom state for mouse wheel and touch gestures - must be before conditional returns
  const chartRef = React.useRef<HTMLDivElement>(null)
  const touchRef = React.useRef<{ distance: number | null, center: { x: number, y: number } | null }>({
    distance: null,
    center: null
  })

  // Store domains in refs to avoid dependency issues in callbacks
  const xDomainRef = React.useRef<[number, number]>([0, 100])
  const yDomainRef = React.useRef<[number, number]>([0, 5])

  // Track mouse position for sticky tooltip positioning
  const mousePositionRef = React.useRef<{ x: number, y: number }>({ x: 0, y: 0 })

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
  
  // Track mouse position for fallback tooltip positioning
  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  // Attach wheel, touch, and mouse move event listeners
  React.useEffect(() => {
    const chartElement = chartRef.current
    if (!chartElement) return

    chartElement.addEventListener('wheel', handleWheel, { passive: false })
    chartElement.addEventListener('touchstart', handleTouchStart, { passive: false })
    chartElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    chartElement.addEventListener('touchend', handleTouchEnd)

    // Track mouse position globally to ensure we always have valid coordinates
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      chartElement.removeEventListener('wheel', handleWheel)
      chartElement.removeEventListener('touchstart', handleTouchStart)
      chartElement.removeEventListener('touchmove', handleTouchMove)
      chartElement.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseMove])

  // Handle scatter point click to make tooltip sticky
  // Recharts onClick signature: (data, index, event)
  const handleScatterClick = (data: any, index: number, event: any) => {
    if (data && data.club_name) {
      // DEBUG: Log all parameters to understand Recharts onClick
      console.log('=== Recharts Click Debug ===')
      console.log('Parameter 1 (data):', data?.club_name)
      console.log('Parameter 2 (index):', index, 'Type:', typeof index)
      console.log('Parameter 3 (event):', event)
      console.log('Event type:', typeof event)
      console.log('Event keys:', event ? Object.keys(event) : 'null/undefined')
      console.log('Event.clientX:', event?.clientX)
      console.log('Event.clientY:', event?.clientY)
      console.log('mousePositionRef:', mousePositionRef.current)
      console.log('===========================')

      // Prevent the click from immediately triggering the outside click handler
      if (event && event.stopPropagation) {
        event.stopPropagation()
      }

      setStickyTooltip(data)

      // Try multiple methods to get click coordinates
      // Initialize with fallback values to ensure type safety
      let clickX: number = mousePositionRef.current.x
      let clickY: number = mousePositionRef.current.y

      // Method 1: Direct event properties (preferred)
      if (event?.clientX !== undefined && event?.clientY !== undefined) {
        console.log('Using Method 1: event.clientX/clientY')
        clickX = event.clientX
        clickY = event.clientY
      }
      // Method 2: Native event (for synthetic events)
      else if (event?.nativeEvent?.clientX !== undefined && event?.nativeEvent?.clientY !== undefined) {
        console.log('Using Method 2: event.nativeEvent.clientX/clientY')
        clickX = event.nativeEvent.clientX
        clickY = event.nativeEvent.clientY
      }
      // Method 3: Already set to fallback values
      else {
        console.log('Using Method 3: mousePositionRef fallback')
      }

      console.log('Final coordinates:', { x: clickX, y: clickY })

      // Always set tooltip position
      setTooltipPosition({ x: clickX, y: clickY })
    }
  }

  // Close sticky tooltip when clicking outside
  React.useEffect(() => {
    if (!stickyTooltip) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Don't close if clicking on the tooltip itself
      if (target.closest('.sticky-tooltip')) {
        return
      }
      setStickyTooltip(null)
      setTooltipPosition(null)
    }

    // Add the listener in the next tick to avoid catching the opening click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [stickyTooltip])

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
    const ACTIVITY_THRESHOLD_POWERHOUSE = 2.75
    const ACTIVITY_THRESHOLD_INTENSIVE = 2.25

    const quadrantBounds = {
      // Intensive: 1-19 lifters, 2.25+ activity
      intensive: { x: [0, 19.5] as [number, number], y: [ACTIVITY_THRESHOLD_INTENSIVE, maxActivity + 0.5] as [number, number] },
      // Powerhouse: 20+ lifters, 2.75+ activity
      powerhouse: { x: [LIFTERS_THRESHOLD - 0.5, maxLifters + Math.ceil(maxLifters * 0.1)] as [number, number], y: [ACTIVITY_THRESHOLD_POWERHOUSE, maxActivity + 0.5] as [number, number] },
      // Developing: 1-19 lifters, < 2.25 activity
      developing: { x: [0, 19.5] as [number, number], y: [Math.max(0, minActivity - 0.5), 2.24] as [number, number] },
      // Sleeping Giant: 20+ lifters, < 2.75 activity
      'sleeping-giant': { x: [LIFTERS_THRESHOLD - 0.5, maxLifters + Math.ceil(maxLifters * 0.1)] as [number, number], y: [Math.max(0, minActivity - 0.5), 2.74] as [number, number] }
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

            {/* Partial horizontal line at 2.25 activity - only left side (Intensive/Developing boundary) */}
            <ReferenceLine
              segment={[
                { x: xDomain[0], y: 2.25 },
                { x: boundaries.liftersMedian, y: 2.25 }
              ]}
              stroke={theme === 'dark' ? '#3B82F6' : '#2563EB'}
              strokeDasharray="8 4"
              strokeWidth={2}
              ifOverflow="extendDomain"
            />

            <Tooltip
              content={<CustomTooltip theme={theme} />}
              active={stickyTooltip ? false : undefined}
            />

            {/* Scatter plot with colored points */}
            <Scatter
              data={clubsWithProximity}
              fill="#8884d8"
              shape={CustomDot}
              onClick={handleScatterClick}
            >
              {clubsWithProximity.map((club, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getQuadrantColor(club.quadrant, theme)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Quadrant labels - overlaid on chart */}
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

      {/* Sticky Tooltip Portal - renders interactive tooltip outside SVG */}
      {stickyTooltip && tooltipPosition && (
        <StickyTooltipPortal
          data={stickyTooltip}
          position={tooltipPosition}
          theme={theme}
          onClose={() => {
            setStickyTooltip(null)
            setTooltipPosition(null)
          }}
        />
      )}
    </div>
  )
}