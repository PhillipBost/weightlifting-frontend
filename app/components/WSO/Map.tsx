"use client"

import React from "react"
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet"
import { Feature } from "geojson"
import { PathOptions } from "leaflet"

import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { useWSOMapData } from "../../hooks/useWSOMapData"
import { useTheme } from "../ThemeProvider"

interface MapProps {
  className?: string
  center?: [number, number]
  zoom?: number
}

// Simple state borders component using local GeoJSON file
function StateBordersLayer({ theme }: { theme: 'light' | 'dark' }) {
  const [stateData, setStateData] = React.useState<any>(null)

  React.useEffect(() => {
    // Use local US states GeoJSON file for better performance
    fetch('/us-states.json')
      .then(response => response.json())
      .then(data => {
        setStateData(data)
      })
      .catch(() => {
        // If local file fails, just render nothing
        console.log('Could not load state boundaries')
      })
  }, [])

  if (!stateData) return null

  const stateStyle = {
    fillColor: 'transparent',
    weight: 2,
    opacity: theme === 'dark' ? 0.25 : 0.6,
    color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
    fillOpacity: 0,
    dashArray: '3,3',
    interactive: false
  }

  return (
    <GeoJSON
      data={stateData}
      style={stateStyle}
    />
  )
}



export default function Map({
  className = "h-96 w-full",
  center = [39.8283, -98.5795],
  zoom = 4
}: MapProps) {
  const { wsoData, loading, error } = useWSOMapData()
  const { theme } = useTheme()

  // Simplified 5-color palettes for better visual harmony
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

  // Get theme-appropriate tile layer
  const getTileLayer = () => {
    if (theme === 'dark') {
      return {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    } else {
      return {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    }
  }

  const currentPalette = colorPalettes[theme]

  // Enhanced color assignment function
  const getWSOColor = (wsoId: number): string => {
    // Use modulo to cycle through the palette
    const colorIndex = (wsoId - 1) % currentPalette.length
    return currentPalette[colorIndex]
  }

  // Enhanced styling function with gap elimination
  const getWSOStyle = (wsoId: number): PathOptions => {
    const fillColor = getWSOColor(wsoId)

    return {
      fillColor: fillColor,
      weight: theme === 'dark' ? 1.5 : 2, // Consistent thin borders
      opacity: theme === 'dark' ? 0.8 : 1, // Good contrast borders
      color: theme === 'dark' ? '#9CA3AF' : '#374151', // Consistent border colors
      fillOpacity: 0.6, // Reduced opacity to show underlying map features
      dashArray: '',
      lineCap: 'round',
      lineJoin: 'round',
      // Add subtle shadow to eliminate gaps
      className: 'wso-polygon'
    }
  }

  // Enhanced event handlers with smooth transitions
  const onEachFeature = (feature: Feature, layer: any) => {
    if (!feature.properties) return

    const wsoName = feature.properties.wso_name || 'Unknown WSO'
    const states = feature.properties.states || []
    const counties = feature.properties.counties || []

    // Create WSO slug for URL
    const wsoSlug = wsoName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim()

    // Handle California county listing - either show all or none
    let countyDisplay = ''
    if (counties.length > 0) {
      const isCaliforniaWSO = states.length === 1 && states[0] === 'California'
      if (isCaliforniaWSO) {
        // For California WSOs, show all counties or a simplified message
        if (counties.length > 10) {
          countyDisplay = `<div><strong>Counties:</strong> ${counties.length} counties in California</div>`
        } else {
          countyDisplay = `<div><strong>Counties:</strong> ${counties.join(', ')}</div>`
        }
      } else {
        // For non-California WSOs, show counties normally
        countyDisplay = `<div><strong>Counties:</strong> ${counties.slice(0, 5).join(', ')}${counties.length > 5 ? '...' : ''}</div>`
      }
    }

    const popupContent = `
      <div style="padding: 12px; background-color: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
        <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 12px; color: var(--text-primary);">${wsoName}</h3>
        <div style="margin-bottom: 12px;">
          <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 8px;"><strong>States:</strong> ${states.join(', ')}</div>
          ${countyDisplay ? countyDisplay.replace('<div><strong>', '<div style="color: var(--text-secondary); font-size: 14px;"><strong>').replace('</strong>', '</strong>') : ''}
        </div>
        <div style="padding-top: 8px; border-top: 1px solid var(--border-primary);">
          <a
            href="/WSO/${wsoSlug}"
            style="display: inline-flex; align-items: center; padding: 6px 12px; background-color: #3b82f6; color: white; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; transition: background-color 0.2s;"
            onmouseover="this.style.backgroundColor='#2563eb'"
            onmouseout="this.style.backgroundColor='#3b82f6'"
          >
            View Details →
          </a>
        </div>
      </div>
    `

    layer.bindPopup(popupContent)

    layer.on({
      mouseover: function(e: any) {
        const layer = e.target
        const currentColor = layer.options.fillColor

        layer.setStyle({
          weight: theme === 'dark' ? 3 : 4, // Slightly thinner hover border in dark mode
          color: theme === 'dark' ? '#F3F4F6' : '#000000', // Softer white in dark mode
          fillOpacity: 0.9,
          // Brighten the fill color on hover
          fillColor: adjustBrightness(currentColor, theme === 'dark' ? 15 : -10)
        })
        layer.bringToFront()
      },
      mouseout: function(e: any) {
        const layer = e.target
        const wsoName = feature.properties?.wso_name
        const wso = wsoData?.find(w => w.name === wsoName)
        if (wso) {
          layer.setStyle(getWSOStyle(wso.wso_id))
        }
      }
    })
  }

  // Helper function to adjust color brightness
  const adjustBrightness = (color: string, amount: number): string => {
    const hex = color.replace('#', '')
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(0, 2), 16) + amount))
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(2, 4), 16) + amount))
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(4, 6), 16) + amount))
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }


  if (loading) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading WSO boundaries...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading WSO boundaries</div>
          <div className="text-app-muted text-sm">{error}</div>
        </div>
      </div>
    )
  }

  const tileLayer = getTileLayer()

  return (
    <div className={`${className} relative`}>

      <style jsx global>{`
        .wso-polygon {
          filter: ${theme === 'dark'
            ? 'drop-shadow(0 0 1px rgba(255,255,255,0.1))'
            : 'drop-shadow(0 0 1px rgba(0,0,0,0.3))'
          };
        }
        .leaflet-interactive {
          transition: all 0.2s ease-in-out;
        }
        .leaflet-popup-content-wrapper {
          background: var(--bg-secondary) !important;
          border: none !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
        }
        .leaflet-popup-tip {
          background: var(--bg-secondary) !important;
          border: none !important;
        }
      `}</style>
      
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%", backgroundColor: 'var(--bg-tertiary)' }}
        className="rounded-lg border border-app-secondary"
      >
        <TileLayer
          attribution={tileLayer.attribution}
          url={tileLayer.url}
        />

        {/* State borders layer (underneath WSO shapes) */}
        <StateBordersLayer theme={theme} />

        {wsoData && wsoData.length > 0 && wsoData.map((wso) => (
          wso.territory_geojson && (
            <GeoJSON
              key={`${wso.wso_id}-${theme}`} // Force re-render on theme change
              data={wso.territory_geojson}
              style={() => getWSOStyle(wso.wso_id)}
              onEachFeature={onEachFeature}
            />
          )
        ))}

      </MapContainer>

    </div>
  )
}

