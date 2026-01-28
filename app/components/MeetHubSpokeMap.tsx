"use client"

import React, { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import { DivIcon, latLngBounds, LatLngExpression } from "leaflet"
import { Users, Trophy } from "lucide-react"
import "leaflet/dist/leaflet.css"
import "leaflet-defaulticon-compatibility"
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css"
import { useTheme } from "./ThemeProvider"

// Convert country code to flag emoji
const getCountryFlagEmoji = (code: string): string => {
  if (!code || code.length !== 2) return '🌍';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Inline getCountryFlagComponent for IWF flags (copy from IWF page)
const getCountryFlagComponent = (code: string): React.ComponentType<any> | null => {
  if (!code) return null;

  // Simplified mapping - add full from IWF page if needed, but for demo use placeholder
  // Full implementation would include all flag imports and mapping
  // For now, return null or a placeholder component
  const PlaceholderFlag = ({ style }: { style?: React.CSSProperties }) => (
    <div style={{ ...style, width: '24px', height: '16px', backgroundColor: '#3B82F6', borderRadius: '2px' }} />
  );

  return PlaceholderFlag;
};

interface Spoke {
  name: string
  lat: number
  lng: number
  count: number
  code?: string // For country flags
}



function FitBounds({ meetLat, meetLng, spokes }: { meetLat: number; meetLng: number; spokes: Spoke[] }) {
  const map = useMap()

  useEffect(() => {
    if (spokes.length > 0) {
      const bounds = latLngBounds([
        [meetLat, meetLng],
        ...spokes.map(s => [s.lat, s.lng] as [number, number])
      ])
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [map, meetLat, meetLng, spokes])

  return null
}

// Icon styles
type IconType = 'meet' | 'club'

function createHubIcon(theme: 'light' | 'dark', type: IconType = 'meet') {
  const size = 30
  // Meet Hub (Red) or Club Hub (Orange)
  const bgColor = type === 'club' ? (theme === 'dark' ? '#F59E0B' : '#D97706') : (theme === 'dark' ? '#EF4444' : '#DC2626')
  const iconColor = theme === 'dark' ? '#FFFFFF' : '#FFFFFF'

  // Icon Logic: Meet = Trophy, Club = Simple Circle/Dot pattern or similar unique club marker
  // For Club Hub, let's use a distinct SVG or similar to ClubCompetitionMap
  const innerHtml = type === 'club'
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="6" fill="${iconColor}"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${theme === 'light' ? 'white' : iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>` // Lucide Trophy SVG manual for string

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
        border: 4px solid white;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      ">
        ${innerHtml}
      </div>
    `,

    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    className: 'hub-marker'
  })
}

// type here refers to the SPOKE type
function createSpokeIcon(type: 'club' | 'country' | 'meet', count: number, theme: 'light' | 'dark', code?: string) {
  const size = 15 // Standard size for all dots
  // Colors: Club=Blue/Orange, Country=Blue, Meet=Red
  const getBgColor = () => {
    if (type === 'meet') return theme === 'dark' ? '#EF4444' : '#DC2626'
    if (type === 'club') return theme === 'dark' ? '#F59E0B' : '#D97706'
    return theme === 'dark' ? '#3B82F6' : '#2563EB'
  }
  const bgColor = getBgColor()
  const iconColor = theme === 'dark' ? '#1F2937' : '#FFFFFF'

  let html = `
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
      position: relative;
    ">
  `

  if (type === 'country') {
    // Country flag emoji
    const flagEmoji = getCountryFlagEmoji(code || '');
    html += `
      <div style="font-size: 11px; line-height: 1; display: flex; align-items: center; justify-content: center;">${flagEmoji}</div>
    `
  }

  // Removed Trophy ID for meet to make it a simple dot like clubs


  html += `
      <div style="position: absolute; bottom: -2px; right: -2px; background: white; border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; color: ${bgColor};">
        ${count}
      </div>
    </div>
  `

  return new DivIcon({
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    className: 'spoke-marker'
  })
}

interface MeetHubSpokeMapProps {
  meetLat: number
  meetLng: number
  spokes: Spoke[]
  type: 'club' | 'country' | 'meet' // Spoke Type
  hubType?: 'meet' | 'club'         // Hub Type (defaults to meet)
  className?: string
  loading?: boolean
  error?: string | null
}

export default function MeetHubSpokeMap({
  meetLat,
  meetLng,
  spokes,
  type,
  hubType = 'meet',
  className = "h-[500px] w-full",
  loading = false,
  error = null
}: MeetHubSpokeMapProps) {
  const { theme } = useTheme()

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

  const tileLayer = getTileLayer()

  const hubIcon = useMemo(() => createHubIcon(theme, hubType), [theme, hubType])
  const spokeIcons = useMemo(() => spokes.map(spoke => createSpokeIcon(type, spoke.count, theme, spoke.code)), [spokes, type, theme])

  const lines = useMemo(() => {
    return spokes.map(spoke => [
      [meetLat, meetLng],
      [spoke.lat, spoke.lng]
    ] as [number, number][])
  }, [meetLat, meetLng, spokes])

  const lineStyle = {
    color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
    weight: 2,
    opacity: 0.6,
    dashArray: '5, 5'
  }

  if (loading) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <div className="text-app-muted">Loading map...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-app-tertiary rounded-lg border border-app-secondary`}>
        <div className="text-center">
          <div className="text-app-muted">No geographic data available for this meet</div>
          {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
        </div>
      </div>
    )
  }

  const initialCenter = type === 'club' ? [39.8283, -98.5795] : [20, 0]
  const initialZoom = type === 'club' ? 4 : 2

  return (
    <div className={`${className} relative`} >
      <MapContainer
        center={[meetLat, meetLng]}
        zoom={spokes.length === 0 ? 10 : initialZoom}
        style={{ height: "100%", width: "100%" }}
        className="rounded-lg border border-app-secondary"
      >
        <TileLayer attribution={tileLayer.attribution} url={tileLayer.url} />

        {spokes.length > 0 && <FitBounds meetLat={meetLat} meetLng={meetLng} spokes={spokes} />}

        {/* Hub Marker */}
        <Marker position={[meetLat, meetLng]} icon={hubIcon}>
          <Popup>
            <div className="p-3">
              <h3 className="font-bold text-lg mb-2">Meet Location</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">Center of the competition</p>
            </div>
          </Popup>
        </Marker>

        {/* Spoke Markers and Lines */}
        {spokes.map((spoke, index) => {
          const spokeIcon = spokeIcons[index]
          return (
            <React.Fragment key={index}>
              <Marker position={[spoke.lat, spoke.lng]} icon={spokeIcon}>
                <Popup>
                  <div className="p-3 max-w-xs">
                    <h3 className="font-bold text-base mb-2">{spoke.name}</h3>
                    <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 mb-2">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{spoke.count} athlete{spoke.count !== 1 ? 's' : ''}</span>
                    </div>
                    {type === 'country' && spoke.code && (
                      <div className="mb-2">
                        {(() => {
                          const FlagComponent = getCountryFlagComponent(spoke.code)
                          return FlagComponent ? <FlagComponent style={{ width: '24px', height: '16px', marginRight: '8px' }} /> : null
                        })()}
                        <span className="text-sm">{spoke.name}</span>
                      </div>
                    )}
                    {type === 'club' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const slug = spoke.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                          window.open(`/club/${slug}`, '_blank')
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm py-1 px-2 rounded transition-colors"
                      >
                        View Club
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
              <Polyline positions={lines[index]} pathOptions={lineStyle} />
            </React.Fragment>
          )
        })}

        <style jsx global>{`
          .hub-marker, .spoke-marker {
            transition: all 0.2s ease;
          }
          .hub-marker:hover, .spoke-marker:hover {
            transform: scale(1.1);
          }
          .leaflet-popup-content-wrapper {
            background: ${theme === 'dark' ? '#1F2937' : '#FFFFFF'} !important;
            border: 1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'} !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
          }
          .leaflet-popup-content {
            margin: 0 !important;
            padding: 0 !important;
            color: ${theme === 'dark' ? '#F3F4F6' : '#111827'} !important;
          }
          .leaflet-popup-tip {
            background: ${theme === 'dark' ? '#1F2937' : '#FFFFFF'} !important;
          }
        `}</style>
      </MapContainer>
    </div >
  )
}
