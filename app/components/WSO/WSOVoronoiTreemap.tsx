"use client"

import React, { useEffect, useRef, useState } from "react"
import { useTheme } from "../ThemeProvider"
import { useRouter } from "next/navigation"
import * as d3 from "d3"
import { voronoiTreemap } from "d3-voronoi-treemap"

interface TreemapNode {
  name: string
  wso_id?: number
  size?: number
  type?: 'wso' | 'club'
  lat?: number
  lng?: number
  children?: TreemapNode[]
}

interface WSOVoronoiTreemapProps {
  className?: string
  height?: number
  wsoData?: any[] // Accept data from parent
}

// Cache key constants
const CACHE_KEY = 'wso_voronoi_hierarchy'
const CACHE_VERSION = 'v2' // Incremented to invalidate old cache with incorrect data
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

export default function WSOVoronoiTreemap({ className = "", height = 600, wsoData }: WSOVoronoiTreemapProps) {
  const [data, setData] = useState<TreemapNode | null>(null)
  const [computedHierarchy, setComputedHierarchy] = useState<any>(null)
  const [loading, setLoading] = useState(!wsoData) // Not loading if data provided
  const [error, setError] = useState<string | null>(null)
  const [isInitialRender, setIsInitialRender] = useState(true)
  const [structureReady, setStructureReady] = useState(false)
  const { theme } = useTheme()
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Transform data when wsoData prop changes
  useEffect(() => {
    if (!wsoData) return

    // Transform to hierarchical structure
    const treemapData = {
      name: 'USA Weightlifting',
      children: wsoData
        .filter((wso: any) => wso.active_lifters_count > 0)
        .map((wso: any) => ({
          name: wso.name,
          wso_id: wso.wso_id,
          // Don't set size at WSO level - let it be calculated from children
          // If no children, use the WSO's total
          size: (!wso.clubs || wso.clubs.length === 0) ? wso.active_lifters_count : undefined,
          type: 'wso' as const,
          children: wso.clubs && wso.clubs.length > 0
            ? wso.clubs
                .filter((club: any) => club.size > 0)
                .map((club: any) => ({
                  name: club.name,
                  size: club.size,
                  type: 'club' as const,
                  lat: club.latitude,
                  lng: club.longitude
                }))
            : undefined
        }))
    }

    // Debug: Log a sample WSO to verify structure
    if (treemapData.children.length > 0) {
      const sampleWSO = treemapData.children.find((w: any) => w.name === 'Alabama')
      const sampleWSO2 = treemapData.children.find((w: any) => w.name === 'Tennessee-Kentucky')
      console.log('Alabama WSO data:', sampleWSO)
      console.log('Tennessee-Kentucky WSO data:', sampleWSO2)
      if (sampleWSO?.children) {
        console.log('Alabama total from clubs:', sampleWSO.children.reduce((sum: number, c: any) => sum + (c.size || 0), 0))
      }
      if (sampleWSO2?.children) {
        console.log('Tennessee-Kentucky total from clubs:', sampleWSO2.children.reduce((sum: number, c: any) => sum + (c.size || 0), 0))
      }
    }

    setData(treemapData)
    setLoading(false)
  }, [wsoData])

  // Compute tessellation once when data changes (with localStorage caching)
  useEffect(() => {
    if (!data || !containerRef.current) return

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
          console.log('✓ Loaded Voronoi hierarchy from cache')
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
    console.time('Voronoi tessellation computation')

    // Create hierarchy
    const hierarchy = d3.hierarchy(data)
      .sum((d: any) => d.size || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Debug: Log hierarchy values to verify
    const alabama = hierarchy.children?.find((c: any) => c.data.name === 'Alabama')
    const tennessee = hierarchy.children?.find((c: any) => c.data.name === 'Tennessee-Kentucky')
    const indiana = hierarchy.children?.find((c: any) => c.data.name === 'Indiana')
    console.log('Alabama hierarchy value:', alabama?.value, 'children:', alabama?.children?.length)
    console.log('Tennessee-Kentucky hierarchy value:', tennessee?.value, 'children:', tennessee?.children?.length)
    console.log('Indiana hierarchy value:', indiana?.value, 'children:', indiana?.children?.length)

    // Log all top-level WSO values to see the full distribution
    console.log('All WSO values:', hierarchy.children?.map((c: any) => ({ name: c.data.name, value: c.value })).sort((a: any, b: any) => b.value - a.value))

    // Define the clipping polygon
    const clipPolygon = [[0, 0], [width, 0], [width, height], [0, height]]

    // Compute Voronoi tessellation with optimized settings
    const voronoiLayout = voronoiTreemap()
      .clip(clipPolygon)
      .convergenceRatio(0.01) // Lower = more accurate (takes longer)
      .maxIterationCount(50) // More iterations for better accuracy
      .minWeightRatio(0.01)
      .prng(d3.randomLcg(42))

    voronoiLayout(hierarchy)

    console.timeEnd('Voronoi tessellation computation')

    // Save to cache - extract only the polygon data (hierarchy has circular refs)
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
      console.log('✓ Saved Voronoi hierarchy to cache')
    } catch (e) {
      console.warn('Cache write failed:', e)
    }

    setComputedHierarchy(hierarchy)
  }, [data, height])

  // EFFECT 1: Draw SVG structure once when hierarchy changes (expensive DOM creation)
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

    // Recursively draw all cells (WSOs and clubs) - STRUCTURE ONLY (no colors yet)
    function drawCell(node: any, depth: number = 0, parentWSOId?: number) {
      if (!node.polygon) return

      const cellData = node.data
      const cellValue = node.value || 0
      const isWSO = depth === 1 // First level children are WSOs
      const isClub = depth === 2 // Second level children are clubs

      // Track parent WSO ID for club cells
      const currentWSOId = isWSO ? cellData.wso_id : parentWSOId

      // Create cell group
      const cellGroup = cells.append("g")
        .attr("class", `voronoi-cell depth-${depth}`)
        .attr("data-wso-id", cellData.wso_id)
        .attr("data-parent-wso", currentWSOId)
        .style("cursor", isWSO ? "pointer" : "default")

      if (isWSO) {
        // Draw WSO cell path (no colors yet, will be set by theme effect)
        cellGroup.append("path")
          .attr("d", `M${node.polygon.map((p: [number, number]) => p.join(",")).join("L")}Z`)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("class", "wso-cell-path")
          .attr("data-wso-id", cellData.wso_id)

        // Add click handler
        cellGroup.on("click", function() {
          if (cellData.name) {
            const slug = cellData.name.toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .trim()
            router.push(`/WSO/${slug}`)
          }
        })

        // Add WSO labels (text color will be set by theme effect)
        const centroid = d3.polygonCentroid(node.polygon)
        const bounds = {
          minX: d3.min(node.polygon, (p: [number, number]) => p[0]) || 0,
          maxX: d3.max(node.polygon, (p: [number, number]) => p[0]) || 0,
          minY: d3.min(node.polygon, (p: [number, number]) => p[1]) || 0,
          maxY: d3.max(node.polygon, (p: [number, number]) => p[1]) || 0
        }
        const cellWidth = bounds.maxX - bounds.minX
        const cellHeight = bounds.maxY - bounds.minY

        if (cellWidth > 40 && cellHeight > 30) {
          const textGroup = cellGroup.append("g")
            .attr("class", "wso-labels")
            .attr("pointer-events", "none")
            .style("user-select", "none")

          const words = cellData.name.split(/\s+/)
          const lineHeight = 14
          const maxWidth = cellWidth - 16

          let lines: string[] = []
          let currentLine = ''

          words.forEach((word: string) => {
            const testLine = currentLine ? `${currentLine} ${word}` : word
            if (testLine.length * 6.5 > maxWidth && currentLine) {
              lines.push(currentLine)
              currentLine = word
            } else {
              currentLine = testLine
            }
          })
          if (currentLine) lines.push(currentLine)
          lines = lines.slice(0, 3)

          const totalTextHeight = lines.length * lineHeight + 16
          const textStartY = centroid[1] - (totalTextHeight / 2) + lineHeight

          lines.forEach((line, i) => {
            textGroup.append("text")
              .attr("class", "wso-label-text")
              .attr("x", centroid[0])
              .attr("y", textStartY + (i * lineHeight))
              .attr("text-anchor", "middle")
              .attr("font-size", "11px")
              .attr("font-weight", "700")
              .attr("opacity", 0.95)
              .text(line)
          })

          if (cellHeight > totalTextHeight + 10) {
            textGroup.append("text")
              .attr("class", "wso-label-count")
              .attr("x", centroid[0])
              .attr("y", textStartY + (lines.length * lineHeight) + 12)
              .attr("text-anchor", "middle")
              .attr("font-size", "10px")
              .attr("font-weight", "600")
              .attr("opacity", 0.8)
              .text(cellValue.toLocaleString())
          }
        }
      } else if (isClub) {
        // Draw club borders only (colors will be set by theme effect)
        cellGroup.append("path")
          .attr("d", `M${node.polygon.map((p: [number, number]) => p.join(",")).join("L")}Z`)
          .attr("fill", "none")
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("pointer-events", "none")
          .attr("class", "club-border")
          .attr("data-parent-wso", currentWSOId)
      }

      // Recursively draw children
      if (node.children) {
        node.children.forEach((child: any) => drawCell(child, depth + 1, currentWSOId))
      }
    }

    // Draw all cells starting from root
    computedHierarchy.children?.forEach((child: any) => drawCell(child, 1))

    // Animate cells on initial render only
    if (isInitialRender) {
      svg.selectAll(".voronoi-cell path")
        .style("opacity", 0)
        .transition()
        .duration(800)
        .delay((d: any, i: number) => i * 50)
        .style("opacity", 1)

      setIsInitialRender(false)
    } else {
      // Skip animation on subsequent renders
      svg.selectAll(".voronoi-cell path").style("opacity", 1)
    }

    // Mark that structure has been rendered - trigger styling effect
    setStructureReady(true)

  }, [computedHierarchy, router, isInitialRender])

  // EFFECT 2: Update colors when theme changes OR after structure is rendered (fast, no DOM recreation)
  useEffect(() => {
    if (!computedHierarchy || !svgRef.current || !structureReady) return

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

    const getWSOColor = (wsoId: number): string => {
      const colorIndex = (wsoId - 1) % currentPalette.length
      return currentPalette[colorIndex]
    }

    const adjustBrightness = (color: string, amount: number): string => {
      const hex = color.replace('#', '')
      const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + amount))
      const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + amount))
      const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + amount))
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    const originalStroke = theme === 'dark' ? '#9CA3AF' : '#374151'
    const originalStrokeWidth = theme === 'dark' ? 1.5 : 2

    // Update WSO cell colors
    svg.selectAll(".wso-cell-path").each(function() {
      const path = d3.select(this)
      const wsoId = parseInt(path.attr("data-wso-id"))
      const wsoColor = wsoId ? getWSOColor(wsoId) : '#cccccc'
      const brightColor = adjustBrightness(wsoColor, theme === 'dark' ? 15 : -10)

      path
        .attr("fill", wsoColor)
        .attr("stroke", originalStroke)
        .attr("stroke-width", originalStrokeWidth)
        .attr("fill-opacity", 0.6)
        .attr("stroke-opacity", theme === 'dark' ? 0.8 : 1)

      // Re-attach hover handlers with updated colors
      const element = this as unknown as HTMLElement
      if (!element?.parentNode) return
      const cellGroup = d3.select(element.parentNode as any)
      cellGroup
        .on("mouseenter", function() {
          const group = d3.select(this)
          const wsoIdAttr = group.attr("data-wso-id")

          group.select(".wso-cell-path")
            .transition()
            .duration(200)
            .attr("fill", brightColor)
            .attr("fill-opacity", 0.9)
            .attr("stroke-width", theme === 'dark' ? 3 : 4)
            .attr("stroke", theme === 'dark' ? '#F3F4F6' : '#000000')

          svg.selectAll(`.club-border[data-parent-wso="${wsoIdAttr}"]`)
            .transition()
            .duration(200)
            .attr("stroke-opacity", 0)
        })
        .on("mouseleave", function() {
          const group = d3.select(this)
          const wsoIdAttr = group.attr("data-wso-id")

          group.select(".wso-cell-path")
            .transition()
            .duration(200)
            .attr("fill", wsoColor)
            .attr("fill-opacity", 0.6)
            .attr("stroke-width", originalStrokeWidth)
            .attr("stroke", originalStroke)
            .attr("stroke-opacity", theme === 'dark' ? 0.8 : 1)

          svg.selectAll(`.club-border[data-parent-wso="${wsoIdAttr}"]`)
            .transition()
            .duration(200)
            .attr("stroke-opacity", theme === 'dark' ? 0.4 : 0.5)
        })
    })

    // Update club border colors
    svg.selectAll(".club-border")
      .attr("stroke", theme === 'dark' ? '#9CA3AF' : '#374151')
      .attr("stroke-width", theme === 'dark' ? 0.75 : 1)
      .attr("stroke-opacity", theme === 'dark' ? 0.4 : 0.5)

    // Update label colors
    svg.selectAll(".wso-label-text, .wso-label-count")
      .attr("fill", theme === 'dark' ? '#ffffff' : '#000000')

  }, [theme, computedHierarchy, structureReady])

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading visualization data...</div>
          <div className="text-app-muted text-xs mt-2">(First load computes layout, then cached)</div>
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
