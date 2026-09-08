export interface MapTileConfig {
  url: string
  attribution: string
  className?: string
}

export function getMapTileConfig(theme?: string): MapTileConfig {
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim()

  if (theme === 'dark') {
    if (cartoApiKey) {
      return {
        url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    }

    // Fallback: Standard OpenStreetMap with CSS dark filter (eliminates "API KEY REQUIRED" watermark)
    return {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: "dark-tile-layer"
    }
  }

  // Light theme default
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
}
