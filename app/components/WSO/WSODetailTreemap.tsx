"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTheme } from "../ThemeProvider"
import * as d3 from "d3"
import { voronoiTreemap } from "d3-voronoi-treemap"

interface TreemapNode {
  name: string
  size?: number
  children?: TreemapNode[]
}

interface WSODetailTreemapProps {
  wsoSlug: string
  className?: string
  height?: number
}

// Cache key constants
const CACHE_KEY = 'wso_detail_voronoi'
const CACHE_VERSION = 'v1'
const CACHE_EXPIRY_HOURS = 24

// Simple hash function for data fingerprinting
const hashData = (data: any): string => {
  const str = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export default function WSODetailTreemap({ wsoSlug, className = "", height = 400 }: WSODetailTreemapProps) {
  const [data, setData] = useState<TreemapNode | null>(null)
  const [computedHierarchy, setComputedHierarchy] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [structureReady, setStructureReady] = useState(false)
  const [wsoId, setWsoId] = useState<number | null>(null)
  const { theme } = useTheme()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch club data and transform to hierarchy
  useEffect(() => {
    async function fetchClubData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/wso-clubs/${encodeURIComponent(wsoSlug)}`)
        if (!response.ok) {
          throw new Error('Failed to fetch club data')
        }
        const apiData = await response.json()

        // Store WSO ID for color mapping
        if (apiData.wsoInfo?.wso_id) {
          setWsoId(apiData.wsoInfo.wso_id)
        }

        // Transform club data into flat hierarchy
        const clubs = apiData.clubs || []
        const treemapData: TreemapNode = {
          name: apiData.wsoName || 'WSO Clubs',
          children: clubs
            .filter((club: any) => club.active_lifters_count > 0)
            .map((club: any) => ({
              name: club.club_name,
              size: club.active_lifters_count
            }))
        }

        console.log('WSO Detail Treemap data:', treemapData)
        setData(treemapData)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching club treemap data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load treemap')
        setLoading(false)
      }
    }

    if (wsoSlug) {
      fetchClubData()
    }
  }, [wsoSlug])

  // Compute tessellation once when data changes (with localStorage caching)
  useEffect(() => {
    if (!data || !containerRef.current || !data.children || data.children.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const dataHash = hashData(data)
    const cacheKey = `${CACHE_KEY}_${CACHE_VERSION}_${dataHash}_${width}_${height}`

    // Try to load from cache
    try {
      const cachedStr = localStorage.getItem(cacheKey)
      if (cachedStr) {
        const cached = JSON.parse(cachedStr)
        const now = Date.now()
        const expiryTime = CACHE_EXPIRY_HOURS * 60 * 60 * 1000

        if (now - cached.timestamp < expiryTime) {
          console.log('✓ Loaded WSO detail Voronoi hierarchy from cache')
          // Reconstruct hierarchy from cached data
          const hierarchy = d3.hierarchy(data)
            .sum((d: any) => d.size || 0)
            .sort((a, b) => (b.value || 0) - (a.value || 0))

          // Restore polygon data from cache
          const restorePolygons = (node: any, cachedNode: any) => {
            if (cachedNode.polygon) {
              node.polygon = cachedNode.polygon
            }
            if (node.children && cachedNode.children) {
              node.children.forEach((child: any, i: number) => {
                restorePolygons(child, cachedNode.children[i])
              })
            }
          }
          restorePolygons(hierarchy, cached.hierarchy)

          setComputedHierarchy(hierarchy)
          return
        }
      }
    } catch (e) {
      console.warn('Cache read failed:', e)
    }

    // Cache miss - compute tessellation
    console.time('WSO detail Voronoi tessellation computation')

    // Create hierarchy
    const hierarchy = d3.hierarchy(data)
      .sum((d: any) => d.size || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Define the clipping polygon
    const clipPolygon = [[0, 0], [width, 0], [width, height], [0, height]]

    // Compute Voronoi tessellation with optimized settings
    const voronoiLayout = voronoiTreemap()
      .clip(clipPolygon)
      .convergenceRatio(0.01)
      .maxIterationCount(50)
      .minWeightRatio(0.01)
      .prng(d3.randomLcg(42))

    voronoiLayout(hierarchy)

    console.timeEnd('WSO detail Voronoi tessellation computation')

    // Save to cache
    try {
      const extractPolygons = (node: any): any => {
        const extracted: any = {
          polygon: node.polygon,
          children: node.children?.map((c: any) => extractPolygons(c))
        }
        return extracted
      }

      const cacheData = {
        timestamp: Date.now(),
        hierarchy: extractPolygons(hierarchy)
      }
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      console.log('✓ Saved WSO detail Voronoi hierarchy to cache')
    } catch (e) {
      console.warn('Cache write failed:', e)
    }

    setComputedHierarchy(hierarchy)
  }, [data, height])

  // EFFECT 1: Draw SVG structure once when hierarchy changes
  useEffect(() => {
    if (!computedHierarchy || !svgRef.current || !containerRef.current) return

    // Reset structure ready flag when rebuilding
    setStructureReady(false)

    const svg = d3.select(svgRef.current)

    // Clear previous content
    svg.selectAll("*").remove()

    // Create a group for all cells
    const cells = svg.append("g")
      .attr("class", "voronoi-cells")

    // Draw club cells (depth 1 children)
    function drawClubCell(node: any, index: number) {
      if (!node.polygon) return

      const cellData = node.data
      const cellValue = node.value || 0

      // Create cell group
      const cellGroup = cells.append("g")
        .attr("class", `voronoi-cell club-cell`)
        .style("cursor", "default")

      // Draw club cell path (no colors yet, will be set by theme effect)
      cellGroup.append("path")
        .attr("d", `M${node.polygon.map((p: [number, number]) => p.join(",")).join("L")}Z`)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("class", "club-cell-path")
        .attr("data-index", index)

      // Add club labels (no thresholds - show all labels)
      const centroid = d3.polygonCentroid(node.polygon)
      const bounds = {
        minX: d3.min(node.polygon, (p: [number, number]) => p[0]) || 0,
        maxX: d3.max(node.polygon, (p: [number, number]) => p[0]) || 0,
        minY: d3.min(node.polygon, (p: [number, number]) => p[1]) || 0,
        maxY: d3.max(node.polygon, (p: [number, number]) => p[1]) || 0
      }
      const cellWidth = bounds.maxX - bounds.minX
      const cellHeight = bounds.maxY - bounds.minY

      const textGroup = cellGroup.append("g")
        .attr("class", "club-labels")
        .attr("pointer-events", "none")
        .style("user-select", "none")

      // Multi-line text wrapping for club names
      const words = cellData.name.split(/\s+/)
      const lineHeight = 12
      const maxWidth = cellWidth - 8

      let lines: string[] = []
      let currentLine = ''

      words.forEach((word: string) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        if (testLine.length * 5.5 > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      })
      if (currentLine) lines.push(currentLine)
      lines = lines.slice(0, 3) // Max 3 lines

      const totalTextHeight = lines.length * lineHeight + 12
      const textStartY = centroid[1] - (totalTextHeight / 2) + lineHeight

      // Club name (multi-line)
      lines.forEach((line, i) => {
        textGroup.append("text")
          .attr("class", "club-label-text")
          .attr("x", centroid[0])
          .attr("y", textStartY + (i * lineHeight))
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "600")
          .attr("opacity", 0.95)
          .text(line)
      })

      // Active lifter count
      textGroup.append("text")
        .attr("class", "club-label-count")
        .attr("x", centroid[0])
        .attr("y", textStartY + (lines.length * lineHeight) + 10)
        .attr("text-anchor", "middle")
        .attr("font-size", "9px")
        .attr("font-weight", "600")
        .attr("opacity", 0.8)
        .text(cellValue.toLocaleString())
    }

    // Draw all club cells
    computedHierarchy.children?.forEach((child: any, index: number) => drawClubCell(child, index))

    // Animate cells on initial render only
    if (isInitialRender) {
      svg.selectAll(".voronoi-cell path")
        .style("opacity", 0)
        .transition()
        .duration(800)
        .delay((d: any, i: number) => i * 30)
        .style("opacity", 1)

      setIsInitialRender(false)
    } else {
      svg.selectAll(".voronoi-cell path").style("opacity", 1)
    }

    // Mark that structure has been rendered
    setStructureReady(true)

  }, [computedHierarchy, isInitialRender])

  // EFFECT 2: Update colors when theme changes OR after structure is rendered
  useEffect(() => {
    if (!computedHierarchy || !svgRef.current || !structureReady || wsoId === null) return

    const svg = d3.select(svgRef.current)

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

    // Get the WSO's base color
    const getWSOColor = (wsoId: number): string => {
      const colorIndex = (wsoId - 1) % currentPalette.length
      return currentPalette[colorIndex]
    }

    const baseColor = getWSOColor(wsoId)

    // Brightness adjustment function
    const adjustBrightness = (color: string, amount: number): string => {
      const hex = color.replace('#', '')
      const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + amount))
      const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + amount))
      const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + amount))
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    const originalStroke = theme === 'dark' ? '#9CA3AF' : '#374151'
    const originalStrokeWidth = theme === 'dark' ? 1.5 : 2

    // Update club cell colors
    svg.selectAll(".club-cell-path").each(function() {
      const path = d3.select(this)
      const index = parseInt(path.attr("data-index"))

      // Vary color slightly based on index for visual interest
      const colorVariation = (index % 5) * 5
      const cellColor = adjustBrightness(baseColor, colorVariation)
      const brightColor = adjustBrightness(cellColor, theme === 'dark' ? 20 : -15)

      path
        .attr("fill", cellColor)
        .attr("stroke", originalStroke)
        .attr("stroke-width", originalStrokeWidth)
        .attr("fill-opacity", 0.6)
        .attr("stroke-opacity", theme === 'dark' ? 0.8 : 1)

      // Attach hover handlers with updated colors
      const cellGroup = d3.select(this.parentNode as any)
      cellGroup
        .on("mouseenter", function() {
          d3.select(this).select(".club-cell-path")
            .transition()
            .duration(200)
            .attr("fill", brightColor)
            .attr("fill-opacity", 0.9)
            .attr("stroke-width", theme === 'dark' ? 3 : 4)
            .attr("stroke", theme === 'dark' ? '#F3F4F6' : '#000000')
        })
        .on("mouseleave", function() {
          d3.select(this).select(".club-cell-path")
            .transition()
            .duration(200)
            .attr("fill", cellColor)
            .attr("fill-opacity", 0.6)
            .attr("stroke-width", originalStrokeWidth)
            .attr("stroke", originalStroke)
            .attr("stroke-opacity", theme === 'dark' ? 0.8 : 1)
        })
    })

    // Update label colors
    svg.selectAll(".club-label-text, .club-label-count")
      .attr("fill", theme === 'dark' ? '#ffffff' : '#000000')

  }, [theme, computedHierarchy, structureReady, wsoId])

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading club visualization...</div>
          <div className="text-app-muted text-xs mt-2">(First load computes layout, then cached)</div>
        </div>
      </div>
    )
  }

  if (error || !data || !data.children || data.children.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="text-app-muted text-sm">
            {error || 'No club data available for visualization'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full relative">
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          className="bg-app-tertiary rounded-lg border border-app-secondary"
        />
      </div>
    </div>
  )
}
