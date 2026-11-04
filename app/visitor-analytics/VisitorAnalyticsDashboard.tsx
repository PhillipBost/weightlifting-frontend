"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Activity, Users, Eye, Clock, ShieldCheck, Globe, FileText, ChevronDown, Search, ChevronLeft, ChevronRight, Loader2, MapPin, Building, Flag, Info } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getCountryFlagComponent } from "@/app/utils/countryFlags";
import { getCountryDetails, formatRegionName, formatCityName } from "@/lib/utils/countryNames";
import { AnalyticsData, TimeRangeKey } from "@/lib/analytics/visitorStats";
import { VisitorWorldMap } from "./VisitorWorldMap";

const TIME_RANGES: { key: TimeRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "24h", label: "Last 24 Hours" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" }
];

type GeoBreakdownTab = "countries" | "regions" | "cities";

export function VisitorAnalyticsDashboard({
  initialData,
  initialRange = "30d"
}: {
  initialData: AnalyticsData;
  initialRange?: TimeRangeKey;
}) {
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>(initialRange);
  const [data, setData] = useState<AnalyticsData>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive Hover Highlights & Tooltips
  const [highlightedCountry, setHighlightedCountry] = useState<string | null>(null);
  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState(false);

  // Geographic Breakdown Tab (Mutually Exclusive: Countries / Regions / Cities)
  const [geoTab, setGeoTab] = useState<GeoBreakdownTab>("countries");

  // Pages Visited controls
  const [urlSearch, setUrlSearch] = useState("");
  const [urlPage, setUrlPage] = useState(1);
  const PAGE_SIZE = 10;

  const handleRangeChange = async (newRange: TimeRangeKey) => {
    setSelectedRange(newRange);
    setIsUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/visitor-stats?range=${newRange}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setUrlPage(1);
      } else {
        setError(json.error || "Unable to update telemetry");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to analytics endpoint");
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const chartData = (data?.pageviewsSeries || []).map((point: { x: string; y: number }) => {
    const d = new Date(point.x);
    const dateLabel =
      data?.unit === "hour"
        ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      date: isNaN(d.getTime()) ? point.x : dateLabel,
      views: point.y
    };
  });

  const filteredUrls = (data?.urls || []).filter((u) => {
    const term = urlSearch.trim().toLowerCase();
    return u.x.toLowerCase().includes(term) || (u.displayLabel && u.displayLabel.toLowerCase().includes(term));
  });
  const totalUrlPages = Math.max(1, Math.ceil(filteredUrls.length / PAGE_SIZE));
  const paginatedUrls = filteredUrls.slice((urlPage - 1) * PAGE_SIZE, urlPage * PAGE_SIZE);

  const maxUrlViews = (data?.urls || [])[0]?.y || 1;
  const totalCountryViews = (data?.countries || []).reduce((acc, c) => acc + c.y, 0) || 1;
  const totalRegionViews = (data?.regions || []).reduce((acc, r) => acc + r.y, 0) || 1;
  const totalCityViews = (data?.cities || []).reduce((acc, ci) => acc + ci.y, 0) || 1;

  return (
    <div className="min-h-screen bg-app-gradient py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1200px] mx-auto space-y-8">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-teal-400" />
              <h1 className="text-2xl font-bold text-app-primary">Visitor Analytics</h1>
              {isUpdating && <Loader2 className="h-4 w-4 text-teal-400 animate-spin ml-2" />}
            </div>
            <p className="text-sm text-app-tertiary">
              Public website traffic, pageviews, and geographic metrics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Cookie-Free & Privacy-Preserving Interactive Popover */}
            <div className="relative">
              <button
                type="button"
                onMouseEnter={() => setShowPrivacyTooltip(true)}
                onMouseLeave={() => setShowPrivacyTooltip(false)}
                onClick={() => setShowPrivacyTooltip((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Cookie-Free & Privacy-Preserving</span>
                <Info className="h-3 w-3 ml-0.5 opacity-70" />
              </button>

              {showPrivacyTooltip && (
                <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 p-4 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl text-left text-xs text-slate-200 space-y-2.5 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-teal-400 font-semibold border-b border-slate-800 pb-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Privacy Architecture & Data Integrity</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Powered by the open-source <strong className="text-white">Umami Analytics</strong> platform hosted on <strong className="text-white">dedicated OWLanalytics infrastructure</strong>. Operates with zero third-party telemetry, trackers, or commercial data brokers.
                  </p>
                  <div className="bg-slate-800/70 p-2.5 rounded-lg border border-slate-700/50 space-y-1">
                    <span className="font-semibold text-white block text-[11px]">Stateless Unique Visitor Identification</span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Unique visitors are computed via a stateless 24-hour cryptographic hash:
                    </p>
                    <code className="block bg-slate-950 p-1.5 rounded text-[10px] text-teal-300 font-mono overflow-x-auto">
                      SHA-256(IP Address + User-Agent + Daily Salt)
                    </code>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      The rotating salt is permanently purged every 24 hours at 00:00 UTC, rendering cross-day profiling mathematically impossible. No persistent cookies, LocalStorage tokens, or device fingerprinting.
                    </p>
                  </div>
                  <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                    <span className="font-semibold text-slate-300 block">Compliant Jurisdictional Frameworks:</span>
                    <p>• European Union General Data Protection Regulation (GDPR)</p>
                    <p>• United States California Consumer Privacy Act (CCPA)</p>
                    <p>• United Kingdom Privacy and Electronic Communications Regulations (PECR)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Time Range Selector */}
            <div className="relative">
              <select
                value={selectedRange}
                onChange={(e) => handleRangeChange(e.target.value as TimeRangeKey)}
                disabled={isUpdating}
                className="appearance-none bg-app-secondary border border-app-primary text-app-primary text-xs font-medium rounded-lg px-3 py-1.5 pr-8 hover:bg-app-hover focus:outline-none focus:ring-2 focus:ring-teal-500/50 cursor-pointer transition-colors disabled:opacity-50"
              >
                {TIME_RANGES.map((r) => (
                  <option key={r.key} value={r.key} className="bg-app-surface text-app-primary">
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-app-tertiary absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
            {error}
          </div>
        )}

        <div className="space-y-8">
          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-app-secondary border border-app-primary rounded-xl p-5">
              <div className="flex items-center justify-between text-app-tertiary mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Pageviews</span>
                <Eye className="h-4 w-4 text-teal-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-app-primary">
                {(data?.stats.pageviews ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-app-secondary border border-app-primary rounded-xl p-5">
              <div className="flex items-center justify-between text-app-tertiary mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Unique Visitors</span>
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-app-primary">
                {(data?.stats.visitors ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-app-secondary border border-app-primary rounded-xl p-5">
              <div className="flex items-center justify-between text-app-tertiary mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Total Visits</span>
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-app-primary">
                {(data?.stats.visits ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-app-secondary border border-app-primary rounded-xl p-5">
              <div className="flex items-center justify-between text-app-tertiary mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Avg Duration</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-app-primary">
                {formatDuration((data?.stats.totalTime ?? 0) / Math.max(data?.stats.visits ?? 1, 1))}
              </div>
            </div>
          </div>

          {/* Traffic Volume Trend Chart */}
          <div className="bg-app-secondary border border-app-primary rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-app-primary">Traffic Volume</h2>
              <span className="text-xs text-app-tertiary">
                {TIME_RANGES.find((r) => r.key === selectedRange)?.label}
              </span>
            </div>
            <div className="w-full h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f8fafc"
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#14b8a6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#viewsGrad)"
                    name="Pageviews"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dedicated World Map Visualization Card */}
          <div className="bg-app-secondary border border-app-primary rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-teal-400" />
                <h2 className="text-lg font-semibold text-app-primary">Global Reach</h2>
              </div>
              <div className="text-xs text-app-tertiary">
                {(data?.countries || []).length} countries represented • Pan & Zoom available
              </div>
            </div>
            <VisitorWorldMap
              countries={data?.countries || []}
              highlightedCountry={highlightedCountry}
            />
          </div>

          {/* Two-Column Grid: Pages Visited & Distinct Geographic Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pages Visited Table with Rich Human-Readable Entity Annotations */}
            <div className="bg-app-secondary border border-app-primary rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-400" />
                    <h2 className="text-lg font-semibold text-app-primary">Pages Visited</h2>
                  </div>
                  {/* Path Search */}
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-app-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search routes or lifters..."
                      value={urlSearch}
                      onChange={(e) => {
                        setUrlSearch(e.target.value);
                        setUrlPage(1);
                      }}
                      className="bg-app-surface border border-app-primary rounded-lg pl-8 pr-3 py-1 text-xs text-app-primary placeholder:text-app-tertiary/60 focus:outline-none focus:ring-1 focus:ring-teal-500 w-full sm:w-52"
                    />
                  </div>
                </div>

                {/* List */}
                <div className="divide-y divide-app-primary min-h-[300px]">
                  {paginatedUrls.length === 0 ? (
                    <p className="text-sm text-app-tertiary py-8 text-center">
                      {urlSearch ? "No matching pages found." : "No pageview data recorded for this period."}
                    </p>
                  ) : (
                    paginatedUrls.map((page, idx) => {
                      const pct = Math.round((page.y / maxUrlViews) * 100);
                      return (
                        <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={page.x}
                              className="text-xs font-mono text-app-primary truncate hover:text-teal-400 transition-colors block hover:underline"
                              title={page.displayLabel || page.x}
                            >
                              {page.displayLabel || page.x}
                            </Link>
                            <div className="w-full bg-app-tertiary/20 rounded-full h-1 mt-1.5">
                              <div
                                className="bg-teal-500/80 h-1 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-teal-400 shrink-0">
                            {page.y.toLocaleString()} views
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Pagination */}
              {totalUrlPages > 1 && (
                <div className="pt-4 border-t border-app-primary flex items-center justify-between text-xs text-app-tertiary">
                  <span>
                    Page {urlPage} of {totalUrlPages} ({filteredUrls.length} pages)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setUrlPage((p) => Math.max(1, p - 1))}
                      disabled={urlPage === 1}
                      className="p-1 rounded hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setUrlPage((p) => Math.min(totalUrlPages, p + 1))}
                      disabled={urlPage === totalUrlPages}
                      className="p-1 rounded hover:bg-app-hover disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Distinct Geographic Breakdown: Mutually Exclusive Tabs (Countries / Regions / Cities) */}
            <div className="bg-app-secondary border border-app-primary rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-400" />
                    <h2 className="text-lg font-semibold text-app-primary">Geographic Breakdown</h2>
                  </div>

                  {/* Mutually Exclusive Tabs: Countries / Regions / Cities */}
                  <div className="flex items-center bg-app-surface border border-app-primary rounded-lg p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setGeoTab("countries")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                        geoTab === "countries"
                          ? "bg-teal-500 text-white shadow-sm"
                          : "text-app-tertiary hover:text-app-primary"
                      }`}
                    >
                      <Flag className="h-3 w-3" />
                      <span>Countries</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeoTab("regions")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                        geoTab === "regions"
                          ? "bg-teal-500 text-white shadow-sm"
                          : "text-app-tertiary hover:text-app-primary"
                      }`}
                    >
                      <MapPin className="h-3 w-3" />
                      <span>Regions</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGeoTab("cities")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                        geoTab === "cities"
                          ? "bg-teal-500 text-white shadow-sm"
                          : "text-app-tertiary hover:text-app-primary"
                      }`}
                    >
                      <Building className="h-3 w-3" />
                      <span>Cities</span>
                    </button>
                  </div>
                </div>

                {/* Tab 1: Countries */}
                {geoTab === "countries" && (
                  <div className="divide-y divide-app-primary max-h-[380px] overflow-y-auto min-h-[300px]">
                    {(data?.countries || []).length === 0 ? (
                      <p className="text-sm text-app-tertiary py-8 text-center">
                        No country data recorded for this period.
                      </p>
                    ) : (
                      (data?.countries || []).map((c, idx) => {
                        const details = getCountryDetails(c.x);
                        const FlagComp = getCountryFlagComponent(details.iso2 || details.iso3);
                        const pct = Math.round((c.y / totalCountryViews) * 100);
                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => setHighlightedCountry(c.x)}
                            onMouseLeave={() => setHighlightedCountry(null)}
                            className={`py-2 px-2.5 rounded-lg flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                              highlightedCountry === c.x
                                ? "bg-teal-500/15 border border-teal-500/30"
                                : "hover:bg-app-hover"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {FlagComp ? (
                                <FlagComp style={{ width: "18px", height: "auto" }} />
                              ) : null}
                              <span className="text-xs font-medium text-app-primary truncate">
                                {details.displayName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-app-tertiary">{pct}%</span>
                              <span className="text-xs font-semibold text-blue-400">
                                {c.y.toLocaleString()} visits
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Tab 2: Regions */}
                {geoTab === "regions" && (
                  <div className="divide-y divide-app-primary max-h-[380px] overflow-y-auto min-h-[300px]">
                    {(data?.regions || []).length === 0 ? (
                      <p className="text-sm text-app-tertiary py-8 text-center">
                        No regional data recorded for this period.
                      </p>
                    ) : (
                      (data?.regions || []).map((r, idx) => {
                        const label = formatRegionName(r.x, r.country);
                        const flagCode = r.country || (r.x.includes('-') ? r.x.split('-')[0] : r.x);
                        const FlagComp = getCountryFlagComponent(flagCode);
                        const pct = Math.round((r.y / totalRegionViews) * 100);
                        return (
                          <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {FlagComp ? (
                                <FlagComp style={{ width: "18px", height: "auto" }} />
                              ) : null}
                              <span className="text-xs font-medium text-app-primary truncate">
                                {label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-app-tertiary">{pct}%</span>
                              <span className="text-xs font-semibold text-purple-400">
                                {r.y.toLocaleString()} visits
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Tab 3: Cities */}
                {geoTab === "cities" && (
                  <div className="divide-y divide-app-primary max-h-[380px] overflow-y-auto min-h-[300px]">
                    {(data?.cities || []).length === 0 ? (
                      <p className="text-sm text-app-tertiary py-8 text-center">
                        No city data recorded for this period.
                      </p>
                    ) : (
                      (data?.cities || []).map((ci, idx) => {
                        const label = formatCityName(ci.x, ci.country, data?.regions);
                        const FlagComp = getCountryFlagComponent(ci.country || "");
                        const pct = Math.round((ci.y / totalCityViews) * 100);
                        return (
                          <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {FlagComp ? (
                                <FlagComp style={{ width: "18px", height: "auto" }} />
                              ) : null}
                              <span className="text-xs font-medium text-app-primary truncate">
                                {label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-xs text-app-tertiary">{pct}%</span>
                              <span className="text-xs font-semibold text-emerald-400">
                                {ci.y.toLocaleString()} visits
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
