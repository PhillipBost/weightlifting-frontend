"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTheme } from "../ThemeProvider"
import { useRouter } from "next/navigation"
import * as d3 from "d3"

interface TreemapNode {
  name: string
  wso_id?: number
  size?: number
  type?: 'wso' | 'club'
  lat?: number
  lng?: number
  children?: TreemapNode[]
}

interface WSOTreemapD3Props {
  className?: string
  height?: number
}

export default function WSOTreemapD3({ className = "", height = 600 }: WSOTreemapD3Props) {
  const [data, setData] = useState<TreemapNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{x: number, y: number, content: string} | null>(null)
  const { theme } = useTheme()
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const svg = d3.select(svgRef.current)

    // Clear previous content
    svg.selectAll("*").remove()

    // Color palettes matching Map.tsx
    const colorPalettes = {
      light: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'
      ],
      dark: [
        '#8B5A5A', '#5A8B8B', '#5A7B9A', '#6B8B6B', '#9A8B5A'
      ]
    }

    const currentPalette = colorPalettes[theme]

    const getWSOColor = (wsoId: number): string => {
      const colorIndex = (wsoId - 1) % currentPalette.length
      return currentPalette[colorIndex]
    }

    const adjustColorBrightness = (color: string, amount: number): string => {
      const hex = color.replace('#', '')
      const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + amount))
      const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + amount))
      const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + amount))

      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    // Create hierarchy and treemap layout
    const root = d3.hierarchy(data)
      .sum((d: any) => d.size || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemap = d3.treemap<TreemapNode>()
      .size([width, height])
      .paddingOuter(4)
      .paddingInner(3)
      .round(true)

    treemap(root as any)

    // Create groups for each node
    const nodes = svg
      .selectAll('g')
      .data(root.descendants())
      .join('g')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`)

    // Draw rectangles (only WSO boxes now - no clubs)
    nodes
      .filter((d: any) => d.depth === 1) // Only render WSO level
      .append('rect')
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('fill', (d: any) => {
        if (d.data.wso_id) {
          return getWSOColor(d.data.wso_id)
        }
        return '#cccccc'
      })
      .attr('stroke', theme === 'dark' ? '#1f2937' : '#e5e7eb')
      .attr('stroke-width', 2)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('cursor', 'pointer')
      .attr('class', 'wso-box')
      .on('click', function(event, d: any) {
        if (d.depth === 1 && d.data.name) {
          const slug = d.data.name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .trim()
          router.push(`/WSO/${slug}`)
        }
      })
      .on('mouseenter', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 0.85)

        // Show tooltip
        const lifters = d.value || 0
        const content = `${d.data.name}\n${lifters.toLocaleString()} active lifters\n\nClick to view details`
        setTooltip({
          x: event.pageX,
          y: event.pageY,
          content
        })
      })
      .on('mousemove', function(event, d: any) {
        if (tooltip) {
          setTooltip({
            ...tooltip,
            x: event.pageX,
            y: event.pageY
          })
        }
      })
      .on('mouseleave', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('opacity', 1)
        setTooltip(null)
      })

    // Add WSO labels with text wrapping
    nodes
      .filter((d: any) => d.depth === 1)
      .each(function(d: any) {
        const node = d3.select(this)
        const boxWidth = d.x1 - d.x0
        const boxHeight = d.y1 - d.y0

        if (boxWidth < 80 || boxHeight < 60) return // Skip small boxes

        const name = d.data.name
        const lifters = d.value || 0

        // Word wrap the name
        const words = name.split(/\s+/)
        const lineHeight = 16
        const maxWidth = boxWidth - 10 // 5px padding each side

        const textGroup = node.append('g')
          .attr('pointer-events', 'none')
          .style('user-select', 'none')

        let lines: string[] = []
        let currentLine = ''

        words.forEach((word: string, i: number) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          // Rough estimate: 7 pixels per character
          if (testLine.length * 7 > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine = testLine
          }
        })
        if (currentLine) lines.push(currentLine)

        // Calculate total height needed
        const totalTextHeight = lines.length * lineHeight + (lifters ? 20 : 0)
        const startY = (boxHeight - totalTextHeight) / 2 + lineHeight

        // Draw each line
        lines.forEach((line, i) => {
          textGroup.append('text')
            .attr('x', boxWidth / 2)
            .attr('y', startY + (i * lineHeight))
            .attr('text-anchor', 'middle')
            .attr('fill', theme === 'dark' ? '#ffffff' : '#000000')
            .attr('font-size', '12px')
            .attr('font-weight', '700')
            .text(line)
        })

        // Add lifter count if there's room
        if (boxHeight > totalTextHeight + 10) {
          textGroup.append('text')
            .attr('x', boxWidth / 2)
            .attr('y', startY + (lines.length * lineHeight) + 15)
            .attr('text-anchor', 'middle')
            .attr('fill', theme === 'dark' ? '#ffffff' : '#000000')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('opacity', 0.85)
            .text(lifters.toLocaleString())
        }
      })

  }, [data, theme, router])

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
        Each box represents a WSO. Box sizes are proportional to total active lifters. Hover for details, click to view WSO details page.
      </div>
      <div ref={containerRef} className="w-full relative">
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          className="bg-app-tertiary rounded-lg border border-app-secondary"
        />
        {tooltip && (
          <div
            className="fixed z-50 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
            style={{
              left: tooltip.x + 10,
              top: tooltip.y + 10,
              whiteSpace: 'pre-line'
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  )
}
