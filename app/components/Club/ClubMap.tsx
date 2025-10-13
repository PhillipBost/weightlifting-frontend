"use client"

import React from "react"
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet"
import { DivIcon } from "leaflet"

import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { useClubData } from "../../hooks/useClubData"
import { useTheme } from "../ThemeProvider"

interface ClubMapProps {
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

export default function ClubMap({
  className = "h-[600px] w-full",
  center = [39.8283, -98.5795],
  zoom = 4
}: ClubMapProps) {
  const { clubData, loading, error } = useClubData()
  const { theme } = useTheme()

  // Toggle states
  const [filterByActivity, setFilterByActivity] = React.useState(false)

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

  // Create custom club marker icon
  const createClubIcon = () => {
    const size = 20 // Static size for all clubs
    const bgColor = theme === 'dark' ? '#F59E0B' : '#D97706' // Orange color
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

  if (loading) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading club locations...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">Error loading club locations</div>
          <div className="text-app-muted text-sm">{error}</div>
        </div>
      </div>
    )
  }

  if (!clubData) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`}>
        <div className="text-center">
          <div className="text-app-muted">No club data available</div>
        </div>
      </div>
    )
  }

  const tileLayer = getTileLayer()

  // Filter clubs based on activity toggle
  const displayedClubs = filterByActivity
    ? clubData.clubs.filter(club => club.recentMemberCount > 0)
    : clubData.clubs

  return (
    <div className={`${className} relative`}>
      {/* Toggle Controls */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        {/* Competition Filter Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterByActivity}
              onChange={(e) => setFilterByActivity(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Competition Clubs Only
              {clubData.stats.activeClubs > 0 && (
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                  ({clubData.stats.activeClubs})
                </span>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 right-4 z-[1000]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Map Legend</h4>
          <div className="space-y-2">
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
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Click markers for club details
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .club-marker {
          transition: all 0.2s ease-in-out;
        }
        .club-marker:hover {
          transform: scale(1.1);
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

        {/* Club Markers Layer */}
        {displayedClubs.map((club, index) => (
          <Marker
            key={`club-${club.id}-${club.name?.replace(/\s+/g, '-') || 'no-name'}-${index}`}
            position={[club.latitude, club.longitude]}
            icon={createClubIcon()}
          >
            <Popup>
              <div className="p-3 max-w-sm">
                <div className="mb-3">
                  <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-1">
                    {club.name || 'Unnamed Club'}
                  </h3>
                  {club.recentMemberCount > 0 && (
                    <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {club.recentMemberCount} competing lifter{club.recentMemberCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {club.address && (
                    <div className="flex items-start">
                      <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div>{club.address}</div>
                        {club.city && club.state && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {club.city}, {club.state}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    const clubSlug = (club.name || 'unknown-club')
                      .toLowerCase()
                      .replace(/[^a-z0-9\s-]/g, '')
                      .replace(/\s+/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-|-$/g, '')
                    window.open(`/club/${clubSlug}`, '_blank')
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium py-2 px-3 rounded-md transition-colors duration-200 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  View Club Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}