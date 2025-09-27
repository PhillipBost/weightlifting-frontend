"use client"

import React from "react"
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet"
import { Feature } from "geojson"
import { PathOptions, DivIcon } from "leaflet"

import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { useWSOMapData } from "../../hooks/useWSOMapData"
import { useWSODetailData } from "../../hooks/useWSODetailData"
import { useTheme } from "../ThemeProvider"

// Component to auto-fit WSO polygon bounds using Leaflet's built-in getBounds()
function WSOAutoFitter({ geoJsonRef, currentWSO }: { geoJsonRef: React.RefObject<any>, currentWSO: any }) {
  const map = useMap()

  React.useEffect(() => {
    if (geoJsonRef.current && currentWSO?.territory_geojson) {
      console.log('Auto-fitting bounds for WSO:', currentWSO.name)
      
      // Use Leaflet's built-in getBounds() method on the GeoJSON layer
      try {
        const bounds = geoJsonRef.current.getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [20, 20], // Add some padding around the polygon
            animate: false,
            maxZoom: 10 // Prevent zooming in too close for small polygons
          })
          console.log('Successfully fitted bounds for:', currentWSO.name)
        }
      } catch (error) {
        console.error('Error fitting bounds:', error)
      }
    }
  }, [map, geoJsonRef, currentWSO?.wso_id, currentWSO?.territory_geojson])

  return null
}

interface ClubLocation {
  id: number
  name: string
  address: string
  latitude: number
  longitude: number
  city: string
  state: string
  recentMemberCount: number
}

interface MeetLocation {
  meet_id?: number
  meet_name: string
  date: string
  wso: string
  latitude?: number
  longitude?: number
  venue?: string
  address?: string
  city?: string
  state?: string
  uses_fallback_coordinates?: boolean
}

interface WSODetailMapProps {
  wsoSlug: string
  wsoName: string
  className?: string
  center?: [number, number]
  zoom?: number
}

// Simple state borders component using local GeoJSON data
function StateBordersLayer({ theme }: { theme: 'light' | 'dark' }) {
  const [stateData, setStateData] = React.useState<any>(null)

  React.useEffect(() => {
    // Use local US states GeoJSON file
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

export default function WSODetailMap({
  wsoSlug,
  wsoName,
  className = "h-[600px] w-full",
  center = [39.8283, -98.5795],
  zoom = 6
}: WSODetailMapProps) {
  const { wsoData, loading, error } = useWSOMapData()
  const { theme } = useTheme()
  
  // Ref for the GeoJSON component to access Leaflet layer
  const geoJsonRef = React.useRef<any>(null)

  // Use optimized data loading hook
  const {
    clubData,
    meetData,
    clubsLoading,
    meetsLoading,
    clubsError,
    meetsError,
    loadClubs,
    loadMeets
  } = useWSODetailData()

  // Toggle states
  const [showClubs, setShowClubs] = React.useState(false)
  const [showMeets, setShowMeets] = React.useState(false)

  // Load club data when toggle is enabled
  React.useEffect(() => {
    if (showClubs) {
      loadClubs(wsoSlug)
    }
  }, [showClubs, loadClubs, wsoSlug])

  // Load meet data when toggle is enabled
  React.useEffect(() => {
    if (showMeets) {
      loadMeets(wsoSlug)
    }
  }, [showMeets, wsoSlug, loadMeets])

  // Preload club data on component mount to improve perceived performance
  React.useEffect(() => {
    // Small delay to allow map to render first
    const timer = setTimeout(() => {
      loadClubs(wsoSlug)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [loadClubs, wsoSlug])

  // Filter WSO data for this specific WSO
  const currentWSO = wsoData?.find(wso =>
    wso.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-') === wsoSlug
  )

  // Get the center and zoom for the current WSO using geographic_center coordinates
  const wsoCenter: [number, number] | null = currentWSO && currentWSO.geographic_center_lat && currentWSO.geographic_center_lng
    ? [currentWSO.geographic_center_lat, currentWSO.geographic_center_lng]
    : null

  const mapCenter: [number, number] = wsoCenter || center



  // Use default zoom - fitBounds will handle optimal zoom automatically
  const mapZoom = zoom

  // Debug log
  React.useEffect(() => {
    if (currentWSO) {
      console.log('Current WSO:', currentWSO.name)
      console.log('Calculated center:', wsoCenter)
      console.log('Using map center:', mapCenter)
    }
  }, [currentWSO, wsoCenter, mapCenter])

  // Simplified 5-color palettes for better visual harmony (same as main map)
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

  // Use the same colors and styling as the main map
  const currentPalette = colorPalettes[theme]

  // Enhanced color assignment function (same as main map)
  const getWSOColor = (wsoId: number): string => {
    // Use modulo to cycle through the palette
    const colorIndex = (wsoId - 1) % currentPalette.length
    return currentPalette[colorIndex]
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

  // Enhanced styling function for single WSO display with main map colors
  const getWSOStyle = (): PathOptions => {
    const fillColor = currentWSO ? getWSOColor(currentWSO.wso_id) : 'transparent'

    // When clubs/meets are active, show outline style. When inactive, show filled style.
    const hasActiveToggles = showClubs || showMeets

    return {
      fillColor: hasActiveToggles ? 'transparent' : fillColor, // Fill when no toggles, transparent when toggles active
      weight: hasActiveToggles ? (theme === 'dark' ? 2.5 : 3) : (theme === 'dark' ? 1.5 : 2), // Thicker border when toggles active
      opacity: hasActiveToggles ? 1 : (theme === 'dark' ? 0.8 : 1), // Full opacity border when toggles active
      color: hasActiveToggles ? fillColor : (theme === 'dark' ? '#9CA3AF' : '#374151'), // Use WSO color for border when toggles active
      fillOpacity: hasActiveToggles ? 0 : 0.3, // Low opacity fill when no toggles, no fill when toggles active
      dashArray: '', // Solid line like main map
      lineCap: 'round',
      lineJoin: 'round',
      className: 'wso-polygon',
      interactive: !hasActiveToggles // Make polygon unclickable when clubs or meets are shown
    }
  }

  // Enhanced event handlers with smooth transitions
  const onEachFeature = (feature: Feature, layer: any) => {
    if (!feature.properties) return

    const wsoName = feature.properties.wso_name || 'Unknown WSO'
    const states = feature.properties.states || []
    const counties = feature.properties.counties || []

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
      <div class="bg-app-primary border border-app-secondary rounded-lg p-3 shadow-lg">
        <h3 class="font-semibold text-base mb-3 text-app-primary">${wsoName}</h3>
        <div class="space-y-2">
          <div class="text-sm text-app-secondary"><strong>States:</strong> ${states.join(', ')}</div>
          ${countyDisplay ? countyDisplay.replace('<div><strong>', '<div class="text-sm text-app-secondary"><strong>').replace('</strong>', '</strong>') : ''}
        </div>
      </div>
    `

    layer.bindPopup(popupContent)

    layer.on({
      mouseover: function(e: any) {
        const layer = e.target
        const fillColor = currentWSO ? getWSOColor(currentWSO.wso_id) : 'transparent'

        layer.setStyle({
          weight: theme === 'dark' ? 3 : 4, // Slightly thicker hover border
          color: theme === 'dark' ? '#F3F4F6' : '#000000', // Highlighted border on hover
          fillOpacity: 0.2, // Low opacity fill on hover
          fillColor: fillColor // Use WSO color on hover
        })
        layer.bringToFront()
      },
      mouseout: function(e: any) {
        const layer = e.target
        // Reset to default style (no fill)
        layer.setStyle(getWSOStyle())
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

  // Create custom club marker icon
  const createClubIcon = (memberCount: number) => {
    const size = 26 // Consistent size for all clubs
    const bgColor = theme === 'dark' ? '#F59E0B' : '#D97706' // Better contrast
    const iconColor = theme === 'dark' ? '#1F2937' : '#FFFFFF'

    return new DivIcon({
      html: `
        <div style="
          background-color: ${bgColor};
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 3px 6px rgba(0,0,0,0.4);
          cursor: pointer;
        ">
          <svg width="${Math.floor(size * 0.7)}" height="${Math.floor(size * 0.7)}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="12" r="3" fill="${iconColor}"/>
            <circle cx="18" cy="12" r="3" fill="${iconColor}"/>
            <rect x="7" y="11" width="10" height="2" fill="${iconColor}"/>
          </svg>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
      className: 'club-marker'
    })
  }

  // Create custom meet marker icon
  const createMeetIcon = () => {
    const size = 26 // Slightly larger for better visibility
    const bgColor = theme === 'dark' ? '#EF4444' : '#DC2626' // Red color
    const iconColor = theme === 'dark' ? '#FFFFFF' : '#FFFFFF'

    return new DivIcon({
      html: `
        <div style="
          background-color: ${bgColor};
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 3px 6px rgba(0,0,0,0.4);
          cursor: pointer;
        ">
          <svg width="${Math.floor(size * 0.7)}" height="${Math.floor(size * 0.7)}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 6L13.5 10.5H18L14.5 13.5L16 18L12 15L8 18L9.5 13.5L6 10.5H10.5L12 6Z" fill="${iconColor}"/>
          </svg>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
      className: 'meet-marker'
    })
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
      {/* Toggle Controls */}
      <div className="absolute bottom-4 left-4 z-[1000] space-y-2">
        {/* Club Toggle Control */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showClubs}
            onChange={(e) => setShowClubs(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Show Barbell Clubs
            {clubData.length > 0 && (
              <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                ({clubData.length})
              </span>
            )}
          </span>
        </label>
        {clubsLoading && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500 mr-1"></div>
            Loading clubs...
          </div>
        )}
        {clubsError && (
          <div className="mt-2 text-xs text-red-500">
            Error loading clubs
          </div>
        )}
        </div>

        {/* Recent Meets Toggle Control */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMeets}
              onChange={(e) => setShowMeets(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show Recent Meets
              {meetData.length > 0 && (
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  ({meetData.length})
                </span>
              )}
            </span>
          </label>
          {meetsLoading && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500 mr-1"></div>
              Loading meets...
            </div>
          )}
          {meetsError && (
            <div className="mt-2 text-xs text-red-500">
              Error loading meets
            </div>
          )}
        </div>
      </div>

      {/* Map Legend - Show when clubs or meets are active */}
      {(showClubs || showMeets) && (
        <div key={`legend-${theme}`} className="absolute bottom-4 right-4 z-[1000]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Map Legend</h4>
            <div className="space-y-2">
              {showClubs && (
                <div className="flex items-center space-x-2">
                  <div className="flex-shrink-0">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: theme === 'dark' ? '#F59E0B' : '#D97706' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="6" cy="12" r="3" fill={theme === 'dark' ? '#1F2937' : '#FFFFFF'}/>
                        <circle cx="18" cy="12" r="3" fill={theme === 'dark' ? '#1F2937' : '#FFFFFF'}/>
                        <rect x="7" y="11" width="10" height="2" fill={theme === 'dark' ? '#1F2937' : '#FFFFFF'}/>
                      </svg>
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-300">Barbell Clubs</span>
                </div>
              )}
              {showMeets && (
                <div className="flex items-center space-x-2">
                  <div className="flex-shrink-0">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: theme === 'dark' ? '#EF4444' : '#DC2626' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 6L13.5 10.5H18L14.5 13.5L16 18L12 15L8 18L9.5 13.5L6 10.5H10.5L12 6Z" fill="#FFFFFF"/>
                      </svg>
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-300">Recent Meets</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
        .club-marker {
          transition: all 0.2s ease-in-out;
        }
        .club-marker:hover {
          transform: scale(1.1);
        }
        .meet-marker {
          transition: all 0.2s ease-in-out;
        }
        .meet-marker:hover {
          transform: scale(1.1);
        }
      `}</style>

      <MapContainer
        key={`map-${currentWSO?.wso_id || 'default'}`}
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: "100%", width: "100%", backgroundColor: 'var(--bg-tertiary)' }}
        className="rounded-lg border border-app-secondary"
      >
        <TileLayer
          attribution={tileLayer.attribution}
          url={tileLayer.url}
        />

        {/* Component to auto-fit WSO polygon bounds */}
        <WSOAutoFitter geoJsonRef={geoJsonRef} currentWSO={currentWSO} />

        {/* State borders layer (underneath WSO shapes) */}
        <StateBordersLayer theme={theme} />

        {/* Show only the current WSO */}
        {currentWSO && currentWSO.territory_geojson && (
          <GeoJSON
            ref={geoJsonRef}
            key={`${currentWSO.wso_id}-${theme}-${showClubs}-${showMeets}`} // Force re-render on theme/interaction changes
            data={currentWSO.territory_geojson}
            style={() => getWSOStyle()}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Club Markers Layer */}
        {showClubs && clubData.length > 0 && clubData.map((club, index) => (
          <Marker
            key={`club-${club.id}-${club.name?.replace(/\s+/g, '-') || 'no-name'}-${index}`}
            position={[club.latitude, club.longitude]}
            icon={createClubIcon(club.recentMemberCount)}
          >
            <Popup>
              <div className="bg-app-primary border border-app-secondary rounded-lg p-3 shadow-lg">
                <div className="mb-3">
                  <h3 className="font-semibold text-base mb-2 text-app-primary">
                    {club.name || 'Unnamed Club'}
                  </h3>
                  {!club.name && (
                    <div className="text-xs text-red-500 mb-1">Debug: club.name is missing</div>
                  )}
                  {club.recentMemberCount > 0 && (
                    <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {club.recentMemberCount} active member{club.recentMemberCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2 text-sm text-app-secondary mb-3">
                  {club.address && (
                    <div className="flex items-start">
                      <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div>{club.address}</div>
                        {club.city && club.state && (
                          <div className="text-xs text-app-muted">
                            {club.city}, {club.state}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* <button 
                  onClick={() => {
                    console.log('Club data:', club)
                    const clubSlug = (club.name || 'unknown-club')
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-|-$/g, '')
                    console.log('Generated slug:', clubSlug)
                    window.open(`/barbell-club/${clubSlug}`, '_blank')
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  View Club Details
                </button> */}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Recent Meets Markers Layer */}
        {showMeets && meetData.length > 0 && meetData.map((meet, index) => (
          <Marker
            key={`meet-${meet.meet_id || 'no-id'}-${meet.meet_name?.replace(/\s+/g, '-') || 'no-name'}-${meet.date}-${index}`}
            position={[meet.latitude!, meet.longitude!]}
            icon={createMeetIcon()}
          >
            <Popup>
              <div className="bg-app-primary border border-app-secondary rounded-lg p-3 shadow-lg">
                <h3 className="font-semibold text-base mb-3 text-app-primary">{meet.meet_name}</h3>
                <div className="space-y-2">
                  <div className="text-sm text-app-secondary"><strong>Date:</strong> {new Date(meet.date).toLocaleDateString()}</div>
                  {meet.venue && (
                    <div className="text-sm text-app-secondary"><strong>Venue:</strong> {meet.venue}</div>
                  )}
                  {meet.address && (
                    <div className="text-sm text-app-secondary"><strong>Address:</strong> {meet.address}</div>
                  )}
                  {meet.city && meet.state && (
                    <div className="text-sm text-app-secondary"><strong>Location:</strong> {meet.city}, {meet.state}</div>
                  )}
                  {meet.uses_fallback_coordinates && (
                    <div className="pt-2 border-t border-app-secondary text-amber-600 dark:text-amber-400">
                      <small>⚠️ Approximate location</small>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => {
                    if (meet.meet_id) {
                      window.open(`/meet/${meet.meet_id}`, '_blank')
                    }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center mt-3"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  View Meet Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

    </div>
  )
}