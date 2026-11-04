"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { Plus, Minus, RotateCcw } from "lucide-react";
import { getCountryDetails } from "@/lib/utils/countryNames";
import { getCountryFlagComponent } from "@/app/utils/countryFlags";
import { useTheme } from "@/app/components/ThemeProvider";

interface VisitorWorldMapProps {
  countries: { x: string; y: number }[];
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

export function VisitorWorldMap({ countries }: VisitorWorldMapProps) {
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

  const visitLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of countries) {
      const details = getCountryDetails(c.x);
      map.set(details.iso3, c.y);
      map.set(details.iso2, c.y);
    }
    return map;
  }, [countries]);

  const paths = useMemo(() => {
    if (!geoData?.features) return [];

    const projection = d3
      .geoMercator()
      .scale(120)
      .center([0, 30])
      .translate([400, 220]);

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
  }, [geoData, visitLookup]);

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
          {paths.map((p: any) => {
            const hasVisits = p.visits > 0;
            const intensity = hasVisits ? Math.max(0.4, p.visits / maxVisits) : 0;

            // Theme-reactive fill & stroke
            const unvisitedFill = isDark ? "#1e293b" : "#e2e8f0";
            const unvisitedStroke = isDark ? "#475569" : "#94a3b8";
            const fill = hasVisits ? `rgba(20, 184, 166, ${intensity})` : unvisitedFill;
            const stroke = hasVisits ? "#14b8a6" : unvisitedStroke;

            return (
              <path
                key={p.id}
                d={p.d}
                fill={fill}
                stroke={stroke}
                strokeWidth={hasVisits ? 0.8 : 0.6}
                className="transition-colors duration-150 hover:brightness-125 hover:stroke-teal-300 cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(e, p)}
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
