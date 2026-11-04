"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { Plus, Minus, RotateCcw } from "lucide-react";
import { getCountryDetails } from "@/lib/utils/countryNames";
import { getCountryFlagComponent } from "@/app/utils/countryFlags";
import { useTheme } from "@/app/components/ThemeProvider";

interface VisitorWorldMapProps {
  countries: { x: string; y: number }[];
  highlightedCountry?: string | null;
}

interface HoveredCountry {
  x: number;
  y: number;
  name: string;
  code: string;
  flagCode: string;
  visits: number;
  pct: number;
}

// Canonical geographic centroids [longitude, latitude] for microstates and compact territories
// that are smaller than 1-2px on the 110m low-resolution Mercator projection.
export const MICROSTATE_CENTROIDS: Record<string, [number, number]> = {
  SGP: [103.8198, 1.3521], // Singapore
  HKG: [114.1694, 22.3193], // Hong Kong
  MAC: [113.5439, 22.1987], // Macau
  BHR: [50.5577, 26.0667], // Bahrain
  MLT: [14.3754, 35.9375], // Malta
  BRB: [-59.5432, 13.1939], // Barbados
  BMU: [-64.7574, 32.3078], // Bermuda
  MDV: [73.2207, 3.2028], // Maldives
  SYC: [55.492, -4.6796], // Seychelles
  MCO: [7.4246, 43.7384], // Monaco
  LIE: [9.5209, 47.166], // Liechtenstein
  SMR: [12.4578, 43.9424], // San Marino
  AND: [1.5218, 42.5063], // Andorra
  VAT: [12.4534, 41.9029], // Vatican City
  GIB: [-5.3536, 36.1408] // Gibraltar
};

export function VisitorWorldMap({ countries, highlightedCountry }: VisitorWorldMapProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [geoData, setGeoData] = useState<any>(null);
  const [hovered, setHovered] = useState<HoveredCountry | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomBehaviorRef = useRef<any>(null);

  useEffect(() => {
    fetch("/datamaps.world.json")
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error("Failed to load world map GeoJSON:", err));
  }, []);

  const totalVisits = useMemo(() => countries.reduce((sum, c) => sum + c.y, 0) || 1, [countries]);
  const maxVisits = useMemo(() => Math.max(...countries.map((c) => c.y), 1), [countries]);

  const highlightedDetails = useMemo(() => {
    return highlightedCountry ? getCountryDetails(highlightedCountry) : null;
  }, [highlightedCountry]);

  const visitLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of countries) {
      const details = getCountryDetails(c.x);
      map.set(details.iso3, c.y);
      map.set(details.iso2, c.y);
    }
    return map;
  }, [countries]);

  const projection = useMemo(() => {
    return d3
      .geoMercator()
      .scale(120)
      .center([0, 30])
      .translate([400, 220]);
  }, []);

  const paths = useMemo(() => {
    if (!geoData?.features) return [];

    const pathGenerator = d3.geoPath().projection(projection);

    return geoData.features.map((feature: any) => {
      const id = feature.id as string;
      const visits = visitLookup.get(id) || 0;
      const d = pathGenerator(feature) || "";
      return {
        id,
        name: feature.properties?.name || id,
        d,
        visits
      };
    });
  }, [geoData, visitLookup, projection]);

  const microstateBeacons = useMemo(() => {
    return Object.entries(MICROSTATE_CENTROIDS)
      .map(([code, coords]) => {
        const details = getCountryDetails(code);
        const visits = visitLookup.get(details.iso3) || visitLookup.get(details.iso2) || 0;
        const isHighlighted =
          highlightedDetails &&
          (code === highlightedDetails.iso3 ||
            code === highlightedDetails.iso2 ||
            details.iso3 === highlightedDetails.iso3 ||
            details.iso2 === highlightedDetails.iso2);

        // Only render beacon if visited or actively highlighted
        if (visits === 0 && !isHighlighted) return null;

        const projected = projection(coords);
        if (!projected) return null;

        return {
          code,
          name: details.name,
          flagCode: details.iso2 || details.iso3,
          visits,
          isHighlighted: Boolean(isHighlighted),
          cx: projected[0],
          cy: projected[1]
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [projection, visitLookup, highlightedDetails]);

  // Render highlighted country last in SVG hierarchy to prevent border clipping
  const sortedPaths = useMemo(() => {
    if (!highlightedDetails) return paths;
    return [...paths].sort((a, b) => {
      const aMatch = a.id === highlightedDetails.iso3 || a.id === highlightedDetails.iso2;
      const bMatch = b.id === highlightedDetails.iso3 || b.id === highlightedDetails.iso2;
      if (aMatch && !bMatch) return 1;
      if (!aMatch && bMatch) return -1;
      return 0;
    });
  }, [paths, highlightedDetails]);

  // Setup D3 Zoom & Pan
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        d3.select(gRef.current).attr("transform", event.transform);
      });

    d3.select(svgRef.current).call(zoom);
    zoomBehaviorRef.current = zoom;
  }, []);

  const zoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.5);
    }
  };

  const zoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.67);
    }
  };

  const resetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, p: { id: string; name: string; visits: number }) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const details = getCountryDetails(p.id);
    const pct = Math.round((p.visits / totalVisits) * 100);

    setHovered({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name: details.name || p.name,
      code: details.displayCode,
      flagCode: details.iso2 || details.iso3,
      visits: p.visits,
      pct
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!hovered || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setHovered((prev) =>
      prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null
    );
  };

  const FlagComponent = hovered ? getCountryFlagComponent(hovered.flagCode) : null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl border ${
        isDark ? "bg-[#0b1329] border-slate-800" : "bg-[#f8fafc] border-slate-200"
      }`}
    >
      {/* Zoom / Pan Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-center bg-app-surface/90 backdrop-blur-sm border border-app-primary rounded-lg shadow-md p-1 space-y-1">
        <button
          type="button"
          onClick={zoomIn}
          title="Zoom In"
          className="p-1.5 rounded hover:bg-app-hover text-app-primary transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          title="Zoom Out"
          className="p-1.5 rounded hover:bg-app-hover text-app-primary transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={resetZoom}
          title="Reset Zoom"
          className="p-1.5 rounded hover:bg-app-hover text-app-primary transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 800 450"
        className="w-full h-auto max-h-[440px] cursor-grab active:cursor-grabbing select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <g ref={gRef}>
          {sortedPaths.map((p: any) => {
            const hasVisits = p.visits > 0;
            const intensity = hasVisits ? Math.max(0.4, p.visits / maxVisits) : 0;
            const isHighlighted =
              highlightedDetails &&
              (p.id === highlightedDetails.iso3 || p.id === highlightedDetails.iso2);

            // Theme-reactive fill & stroke
            const unvisitedFill = isDark ? "#1e293b" : "#e2e8f0";
            const unvisitedStroke = isDark ? "#475569" : "#94a3b8";
            const fill = isHighlighted
              ? "#2dd4bf"
              : hasVisits
              ? `rgba(20, 184, 166, ${intensity})`
              : unvisitedFill;
            const stroke = isHighlighted ? "#ffffff" : hasVisits ? "#14b8a6" : unvisitedStroke;
            const strokeWidth = isHighlighted ? 2.5 : hasVisits ? 0.8 : 0.6;

            return (
              <path
                key={p.id}
                d={p.d}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                className={`transition-colors duration-150 cursor-pointer ${
                  isHighlighted
                    ? "filter drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]"
                    : "hover:brightness-125 hover:stroke-teal-300"
                }`}
                onMouseEnter={(e) => handleMouseEnter(e, p)}
              />
            );
          })}
          {/* Microstate Beacon Dots */}
          {microstateBeacons.map((beacon) => {
            const intensity = beacon.visits > 0 ? Math.max(0.5, beacon.visits / maxVisits) : 0;
            const fill = beacon.isHighlighted
              ? "#2dd4bf"
              : `rgba(20, 184, 166, ${intensity})`;
            const stroke = beacon.isHighlighted ? "#ffffff" : "#0f766e";
            const radius = beacon.isHighlighted ? 5.5 : 3.5;

            return (
              <circle
                key={`microstate-${beacon.code}`}
                cx={beacon.cx}
                cy={beacon.cy}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={beacon.isHighlighted ? 2 : 1.2}
                className={`transition-all duration-150 cursor-pointer ${
                  beacon.isHighlighted
                    ? "filter drop-shadow-[0_0_8px_rgba(45,212,191,0.9)]"
                    : "hover:scale-125 hover:stroke-teal-200"
                }`}
                onMouseEnter={(e) =>
                  handleMouseEnter(e, {
                    id: beacon.code,
                    name: beacon.name,
                    visits: beacon.visits
                  })
                }
              />
            );
          })}
        </g>
      </svg>

      {/* Floating Tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full pb-3"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur-sm whitespace-nowrap">
            {FlagComponent && <FlagComponent style={{ width: "18px", height: "auto" }} />}
            <div>
              <p className="font-semibold text-slate-100">
                {hovered.name} ({hovered.code})
              </p>
              <p className="text-[11px] text-teal-400">
                {hovered.visits.toLocaleString()} visit{hovered.visits === 1 ? "" : "s"}{" "}
                {hovered.visits > 0 && `(${hovered.pct}%)`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
