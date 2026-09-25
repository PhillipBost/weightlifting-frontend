'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Building2,
  Users,
  Trophy,
  Dumbbell,
  Search,
  CheckCircle2,
  Loader2,
  Medal,
  ExternalLink
} from 'lucide-react';

interface LifterResult {
  result_id: number;
  meet_id: number;
  lifter_id: number;
  athlete_name: string;
  first_name?: string | null;
  last_name?: string | null;
  gender: string;
  birth_year: number | null;
  club_name: string | null;
  country_code: string | null;
  membership_number: string | null;
  body_weight_kg: number | null;
  category: string;
  session_name: string | null;
  lot_number: number | null;
  snatch_1: number | null;
  snatch_2: number | null;
  snatch_3: number | null;
  best_snatch: number | null;
  cj_1: number | null;
  cj_2: number | null;
  cj_3: number | null;
  best_cj: number | null;
  total: number | null;
  qpoints: number | null;
  gamx_total: number | null;
  profile_url: string;
  linked_federation: 'USAW' | 'IWF' | null;
}

interface FederationDetails {
  id: string;
  canonical_name: string;
  short_code: string | null;
  country_code: string | null;
  level: string;
  historical_sanction?: {
    full_name: string;
    acronym: string | null;
    name_type: string;
    citation?: string | null;
  } | null;
  governance?: {
    apex?: { canonical_name: string; short_code: string | null };
    continental?: { canonical_name: string; short_code: string | null };
    parent?: { canonical_name: string; short_code: string | null };
  };
}

interface MeetData {
  meet_id: number;
  meet_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  organizer: string | null;
  federation: string | null;
  federation_details?: FederationDetails | null;
  venue: string | null;
  format_version: string;
  summary: {
    total_athletes: number;
    total_clubs: number;
    total_attempts: number;
    successful_attempts: number;
    success_rate: number;
    sessions: string[];
    categories: string[];
  };
}

function formatDefinedFederation(name: string, acronym?: string | null): string {
  if (acronym && !acronym.startsWith('USAW-WSO-')) {
    if (name.includes(`(${acronym})`)) return name;
    return `${name} (${acronym})`;
  }
  if (name === 'USA Weightlifting') return 'USA Weightlifting (USAW)';
  return name;
}

export default function OwlcmsMeetPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [meet, setMeet] = useState<MeetData | null>(null);
  const [results, setResults] = useState<LifterResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'category' | 'session'>('category');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  useEffect(() => {
    if (!id) return;
    const fetchMeet = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/meet/owlcms/${id}`);
        const data = await res.json();
        if (data.success) {
          setMeet(data.meet);
          setResults(data.results || []);
        } else {
          setError(data.error || 'Failed to load competition');
        }
      } catch (err: any) {
        setError(err.message || 'Network error fetching competition');
      } finally {
        setLoading(false);
      }
    };
    fetchMeet();
  }, [id]);

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchesSearch =
        !searchTerm ||
        r.athlete_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.club_name && r.club_name.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedGroup !== 'ALL') {
        if (activeTab === 'category') {
          return r.category === selectedGroup;
        } else {
          return r.session_name === selectedGroup;
        }
      }
      return true;
    });
  }, [results, searchTerm, activeTab, selectedGroup]);

  // Grouping by category or session for sectional display
  const groupedSections = useMemo(() => {
    const map = new Map<string, LifterResult[]>();
    filteredResults.forEach((r) => {
      const key = activeTab === 'category' ? (r.category || 'Open') : (r.session_name || 'General Session');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });

    // Sort lifters in each group by total descending
    map.forEach((lifters) => {
      lifters.sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    });

    return Array.from(map.entries());
  }, [filteredResults, activeTab]);

  const renderAttempt = (val: number | null) => {
    if (val === null || val === undefined || val === 0) {
      return <span className="text-slate-600">—</span>;
    }
    if (val > 0) {
      return (
        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-semibold border border-emerald-500/30">
          {val}
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono font-semibold line-through border border-rose-500/30">
        {Math.abs(val)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
          <p className="text-sm text-slate-400">Loading competition results...</p>
        </div>
      </div>
    );
  }

  if (error || !meet) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center p-6">
        <div className="max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            !
          </div>
          <h2 className="text-lg font-bold text-white">Meet Not Found</h2>
          <p className="text-xs text-slate-400">{error || 'Unable to locate this competition record.'}</p>
          <Link
            href="/admin/owlcms"
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Importer</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-gradient py-8 px-4 sm:px-6 lg:px-8 text-slate-100">
      <div className="max-w-[1200px] mx-auto space-y-6">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              owlcms Meet #{meet.meet_id}
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 text-sky-400">
              v{meet.format_version}
            </span>
          </div>
        </div>

        {/* Meet Header Card */}
        <div className="card-primary p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                {meet.federation_details ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-300">
                    <Dumbbell className="w-3.5 h-3.5" />
                    {formatDefinedFederation(meet.federation_details.canonical_name, meet.federation_details.short_code)}
                  </span>
                ) : meet.federation ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-300">
                    <Dumbbell className="w-3.5 h-3.5" />
                    {meet.federation}
                  </span>
                ) : null}

                {/* Historical Sanction Citation if applicable (Rule 10 compliant) */}
                {meet.federation_details?.historical_sanction && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    Historical Sanction: {meet.federation_details.historical_sanction.full_name}
                    {meet.federation_details.historical_sanction.acronym ? ` (${meet.federation_details.historical_sanction.acronym})` : ''}
                  </span>
                )}

                {/* Dual Governance Affiliations */}
                {meet.federation_details?.governance?.apex && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/90 border border-slate-700 text-slate-300">
                    Apex: {formatDefinedFederation(meet.federation_details.governance.apex.canonical_name, meet.federation_details.governance.apex.short_code)}
                  </span>
                )}
                {meet.federation_details?.governance?.continental && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/90 border border-slate-700 text-slate-300">
                    Confederation: {formatDefinedFederation(meet.federation_details.governance.continental.canonical_name, meet.federation_details.governance.continental.short_code)}
                  </span>
                )}
                {meet.country && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                    {meet.country}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {meet.meet_name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {meet.start_date || 'Date N/A'}
                  {meet.end_date && meet.end_date !== meet.start_date ? ` — ${meet.end_date}` : ''}
                </span>
                {meet.city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {meet.city}
                  </span>
                )}
                {meet.venue && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    {meet.venue}
                  </span>
                )}
                {meet.organizer && (
                  <span className="text-slate-400">
                    Organizer: <span className="text-slate-300 font-medium">{meet.organizer}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-center">
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-lg font-bold text-white font-mono">{meet.summary.total_athletes}</span>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">Athletes</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-lg font-bold text-sky-400 font-mono">{meet.summary.total_clubs}</span>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">Clubs / Teams</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-lg font-bold text-emerald-400 font-mono">{meet.summary.success_rate}%</span>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">Lift Success Rate</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80">
              <span className="text-lg font-bold text-amber-400 font-mono">
                {meet.summary.successful_attempts} / {meet.summary.total_attempts}
              </span>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5">Makes / Attempts</p>
            </div>
          </div>
        </div>

        {/* View Controls & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => {
                  setActiveTab('category');
                  setSelectedGroup('ALL');
                }}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${
                  activeTab === 'category' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                By Category
              </button>
              <button
                onClick={() => {
                  setActiveTab('session');
                  setSelectedGroup('ALL');
                }}
                className={`px-3 py-1.5 rounded-md font-semibold transition ${
                  activeTab === 'session' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                By Session
              </button>
            </div>

            {/* Group Selector */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All {activeTab === 'category' ? 'Categories' : 'Sessions'}</option>
              {(activeTab === 'category' ? meet.summary.categories : meet.summary.sessions).map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search athlete or club..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Grouped Results Sections */}
        {groupedSections.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
            <p className="text-xs">No competition results match the selected filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSections.map(([groupName, lifters]) => (
              <div
                key={groupName}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden"
              >
                <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-sky-400" />
                    {groupName}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {lifters.length} {lifters.length === 1 ? 'Lifter' : 'Lifters'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                        <th className="py-2.5 px-3">Athlete</th>
                        <th className="py-2.5 px-3">Club / Province</th>
                        <th className="py-2.5 px-3 text-right">BW</th>
                        <th className="py-2.5 px-2 text-center">Snatch 1</th>
                        <th className="py-2.5 px-2 text-center">Snatch 2</th>
                        <th className="py-2.5 px-2 text-center">Snatch 3</th>
                        <th className="py-2.5 px-3 text-right font-bold text-sky-300">Best SN</th>
                        <th className="py-2.5 px-2 text-center">C&amp;J 1</th>
                        <th className="py-2.5 px-2 text-center">C&amp;J 2</th>
                        <th className="py-2.5 px-2 text-center">C&amp;J 3</th>
                        <th className="py-2.5 px-3 text-right font-bold text-sky-300">Best CJ</th>
                        <th className="py-2.5 px-3 text-right font-extrabold text-white">Total</th>
                        <th className="py-2.5 px-3 text-right text-slate-400">Q-Pts</th>
                        <th className="py-2.5 px-3 text-right text-slate-400">GAMX</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {lifters.map((lifter, idx) => {
                        const rank = idx + 1;
                        return (
                          <tr
                            key={lifter.result_id}
                            className="hover:bg-slate-800/40 transition-colors"
                          >
                            {/* Rank */}
                            <td className="py-2 px-3 text-center font-mono">
                              {rank === 1 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-amber-950 font-bold text-[10px]">
                                  1
                                </span>
                              ) : rank === 2 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300 text-slate-900 font-bold text-[10px]">
                                  2
                                </span>
                              ) : rank === 3 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700 text-amber-100 font-bold text-[10px]">
                                  3
                                </span>
                              ) : (
                                <span className="text-slate-500 font-medium">{rank}</span>
                              )}
                            </td>

                            {/* Lifter Name & Link */}
                            <td className="py-2 px-3">
                              <Link
                                href={lifter.profile_url}
                                className="font-semibold text-white hover:text-sky-400 transition-colors inline-flex items-center gap-1.5"
                              >
                                <span>{lifter.athlete_name}</span>
                                {lifter.linked_federation && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      lifter.linked_federation === 'USAW'
                                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    }`}
                                  >
                                    {lifter.linked_federation}
                                  </span>
                                )}
                              </Link>
                              {lifter.birth_year && (
                                <span className="text-[11px] text-slate-500 block">
                                  b. {lifter.birth_year}
                                </span>
                              )}
                            </td>

                            {/* Club / Province */}
                            <td className="py-2 px-3 text-slate-300">
                              {lifter.club_name || '—'}
                            </td>

                            {/* Bodyweight */}
                            <td className="py-2 px-3 text-right font-mono text-slate-300">
                              {lifter.body_weight_kg ? `${Number(lifter.body_weight_kg).toFixed(1)}kg` : '—'}
                            </td>

                            {/* Snatches */}
                            <td className="py-2 px-2 text-center">{renderAttempt(lifter.snatch_1)}</td>
                            <td className="py-2 px-2 text-center">{renderAttempt(lifter.snatch_2)}</td>
                            <td className="py-2 px-2 text-center">{renderAttempt(lifter.snatch_3)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-sky-300">
                              {lifter.best_snatch ? `${lifter.best_snatch}kg` : '—'}
                            </td>

                            {/* Clean & Jerks */}
                            <td className="py-2 px-2 text-center">{renderAttempt(lifter.cj_1)}</td>
                            <td className="py-2 px-2 text-center">{renderAttempt(lifter.cj_2)}</td>
                            <td className="py-2 px-2 text-center">{renderAttempt(lifter.cj_3)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-sky-300">
                              {lifter.best_cj ? `${lifter.best_cj}kg` : '—'}
                            </td>

                            {/* Total */}
                            <td className="py-2 px-3 text-right font-mono font-extrabold text-white text-sm">
                              {lifter.total ? `${lifter.total}kg` : '—'}
                            </td>

                            {/* Analytics */}
                            <td className="py-2 px-3 text-right font-mono text-slate-400">
                              {lifter.qpoints ? Number(lifter.qpoints).toFixed(1) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-400">
                              {lifter.gamx_total ? Number(lifter.gamx_total).toFixed(0) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
