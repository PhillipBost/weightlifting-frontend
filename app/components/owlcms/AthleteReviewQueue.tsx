"use client";

import React, { useState, useEffect, useTransition } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Sparkles,
  Info,
  ExternalLink,
  Trophy,
  Scale,
  Dumbbell,
  Globe,
  GitFork,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  MessageSquare,
  X,
  FileText,
  Layers
} from 'lucide-react';

export type ReviewCategory = 'all' | 'cross_federation' | 'homonym_split' | 'name_change_merge' | 'iwf_duplicate';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export interface AdminReviewItem {
  id: string;
  category: 'cross_federation' | 'homonym_split' | 'name_change_merge' | 'iwf_duplicate';
  status: string;
  title: string;
  primary_entity_type: string;
  primary_entity_id: number;
  candidate_entity_type: string | null;
  candidate_entity_id: number | null;
  confidence_score: number | null;
  evidence: Record<string, any>;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

function formatEasternDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }).format(d);
    }
  } catch {}
  return dateStr;
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return dateStr;
}

interface AthleteReviewQueueProps {
  onCountChange?: (count: number) => void;
}

export function AthleteReviewQueue({ onCountChange }: AthleteReviewQueueProps) {
  const [activeCategory, setActiveCategory] = useState<ReviewCategory>('all');
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  const [items, setItems] = useState<AdminReviewItem[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Expanded evidence drawer states
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Notes Modal state
  const [noteModalItem, setNoteModalItem] = useState<{ id: string; title: string; resolution: 'APPROVED' | 'REJECTED' } | null>(null);
  const [modalNotesText, setModalNotesText] = useState<string>('');

  // Counts summary across all streams
  const [counts, setCounts] = useState<{
    total: number;
    homonym_split: number;
    name_change_merge: number;
    cross_federation: number;
    iwf_duplicate: number;
  }>({
    total: 0,
    homonym_split: 0,
    name_change_merge: 0,
    cross_federation: 0,
    iwf_duplicate: 0
  });

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchData = async () => {
    setLoading(true);
    setStatusNotice(null);
    try {
      const params = new URLSearchParams({
        category: activeCategory,
        status: selectedStatus,
        page: page.toString(),
        limit: limit.toString()
      });
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/admin/review-queue?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.total || 0);
        if (data.counts) {
          setCounts(data.counts);
          if (onCountChange) onCountChange(data.counts.total);
        }
      } else {
        setStatusNotice({ text: data.error || 'Failed to fetch review queue', type: 'error' });
      }
    } catch (err: any) {
      setStatusNotice({ text: err.message || 'Network error fetching reviews', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCategory, selectedStatus, page]);

  // Handle Search submit / Enter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  // Resolve Review Item
  const handleResolve = async (reviewId: string, resolution: 'APPROVED' | 'REJECTED', notes?: string) => {
    setActionInProgress(reviewId);
    setStatusNotice(null);

    try {
      const res = await fetch('/api/admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, resolution, notes })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Resolution failed');

      setStatusNotice({
        text: `Review item marked as ${resolution.toLowerCase()}.`,
        type: 'success'
      });

      // Optimistic removal if filtering for PENDING
      if (selectedStatus === 'PENDING') {
        setItems((prev) => prev.filter((item) => item.id !== reviewId));
        setTotalItems((prev) => Math.max(0, prev - 1));
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.id === reviewId
              ? {
                  ...item,
                  status: resolution,
                  resolved_at: new Date().toISOString(),
                  evidence: { ...item.evidence, ...(notes ? { admin_notes: notes } : {}) }
                }
              : item
          )
        );
      }

      // Update counts
      setCounts((prev) => {
        const itemCat = items.find((i) => i.id === reviewId)?.category;
        const next = {
          ...prev,
          total: Math.max(0, prev.total - 1),
          ...(itemCat ? { [itemCat]: Math.max(0, (prev[itemCat] || 1) - 1) } : {})
        };
        if (onCountChange) onCountChange(next.total);
        return next;
      });
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setActionInProgress(null);
      setNoteModalItem(null);
      setModalNotesText('');
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Confidence Score badge styling helper
  const getConfidenceBadge = (score: number | null) => {
    if (score === null || score === undefined) return null;
    let colorClasses = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    if (score >= 90) {
      colorClasses = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    } else if (score >= 70) {
      colorClasses = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${colorClasses}`}>
        Confidence: {score}%
      </span>
    );
  };

  return (
    <div className="w-full space-y-5">
      {/* 1. Header Suite Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Multi-Stream Data Quality & Identity Review Dashboard
              {counts.total > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {counts.total.toLocaleString()} Staged
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Persistent identity queue: homonym splits, marriage/name changes, cross-federation links, and international duplicate entries.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchData();
          }}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          title="Refresh Review Queue"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 2. Stream Metric Badges & Category Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* All Pending */}
        <button
          onClick={() => {
            setActiveCategory('all');
            setPage(1);
          }}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeCategory === 'all'
              ? 'bg-slate-800 border-indigo-500 shadow-md shadow-indigo-950/40'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">All Streams</span>
            <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold text-white mt-1">
            {counts.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total Pending Staged</div>
        </button>

        {/* Stream 1: Collapsed Homonyms (USAW) */}
        <button
          onClick={() => {
            setActiveCategory('homonym_split');
            setPage(1);
          }}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeCategory === 'homonym_split'
              ? 'bg-slate-800 border-indigo-500 shadow-md shadow-indigo-950/40'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Homonym Splits</span>
            <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400">
              <GitFork className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold text-indigo-300 mt-1">
            {counts.homonym_split.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">USA Weightlifting (USAW)</div>
        </button>

        {/* Stream 2: Name Changes (USAW) */}
        <button
          onClick={() => {
            setActiveCategory('name_change_merge');
            setPage(1);
          }}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeCategory === 'name_change_merge'
              ? 'bg-slate-800 border-emerald-500 shadow-md shadow-emerald-950/40'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Name Changes</span>
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
              <UserCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold text-emerald-300 mt-1">
            {counts.name_change_merge.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Marriages & Merges</div>
        </button>

        {/* Stream 3: Cross-Federation */}
        <button
          onClick={() => {
            setActiveCategory('cross_federation');
            setPage(1);
          }}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeCategory === 'cross_federation'
              ? 'bg-slate-800 border-sky-500 shadow-md shadow-sky-950/40'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cross-Federation</span>
            <span className="p-1 rounded-md bg-sky-500/10 text-sky-400">
              <Globe className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold text-sky-300 mt-1">
            {counts.cross_federation}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">IWF / USAW / owlcms</div>
        </button>

        {/* Stream 4: IWF Duplicates */}
        <button
          onClick={() => {
            setActiveCategory('iwf_duplicate');
            setPage(1);
          }}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeCategory === 'iwf_duplicate'
              ? 'bg-slate-800 border-amber-500 shadow-md shadow-amber-950/40'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">IWF Duplicates</span>
            <span className="p-1 rounded-md bg-amber-500/10 text-amber-400">
              <Scale className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-xl font-bold text-amber-300 mt-1">
            {counts.iwf_duplicate}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Same-Championship Duals</div>
        </button>
      </div>

      {/* 3. Search & Status Filter Controls */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search athlete, member #, or meet..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/80 self-stretch sm:self-auto justify-center">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as ReviewStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => {
                setSelectedStatus(st);
                setPage(1);
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                selectedStatus === st
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Global Status Notice */}
      {statusNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            statusNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{statusNotice.text}</span>
        </div>
      )}

      {/* 5. Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
          <p className="text-xs">Loading queue items...</p>
        </div>
      )}

      {/* 6. Empty State */}
      {!loading && items.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-200">No Review Items Found</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? `No results matching "${searchQuery}" in ${activeCategory} (${selectedStatus}).`
              : `All items under ${activeCategory} with status ${selectedStatus} have been resolved.`}
          </p>
        </div>
      )}

      {/* 7. Review Cards List */}
      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => {
            const isActing = actionInProgress === item.id;
            const isExpanded = expandedCards[item.id] ?? false;
            const ev = item.evidence || {};

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3.5 hover:border-slate-700 transition"
              >
                {/* Top Row: Title, Confidence, Category Chip, and Actions */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{item.title}</span>
                      {getConfidenceBadge(item.confidence_score)}
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {item.category}
                      </span>
                      {item.status !== 'PENDING' && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Staged: {formatEasternDateTime(item.created_at)}</span>
                      {item.resolved_at && (
                        <>
                          <span>•</span>
                          <span className="text-slate-300">Resolved: {formatEasternDateTime(item.resolved_at)}</span>
                        </>
                      )}
                      {ev.admin_notes && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-300 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Note attached
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    {/* Add Notes Button */}
                    <button
                      onClick={() => {
                        setNoteModalItem({ id: item.id, title: item.title, resolution: 'APPROVED' });
                        setModalNotesText(ev.admin_notes || '');
                      }}
                      className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Add Reviewer Notes"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    {item.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleResolve(item.id, 'APPROVED')}
                          disabled={isActing}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                        >
                          {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleResolve(item.id, 'REJECTED')}
                          disabled={isActing}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-rose-300 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Stream-Specific Content Body */}

                {/* 1. Stream: homonym_split */}
                {item.category === 'homonym_split' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                      <span>Original Athlete: <strong className="text-white">{ev.athlete_name || ev.split_plan?.originalAthleteName}</strong></span>
                      <span>•</span>
                      <span>Distinct Athletes: <strong className="text-indigo-300">{ev.distinct_athletes || ev.split_plan?.splits?.length || 2}</strong></span>
                      <span>•</span>
                      <span>Total Competitions: <strong className="text-white">{ev.total_competitions || '-'}</strong></span>
                    </div>

                    {/* Split Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {(ev.split_plan?.splits || ev.split_plan?.athletes || []).map((split: any, sIdx: number) => {
                        const internalId = split.internal_id || (ev.internal_ids && ev.internal_ids[sIdx]);
                        return (
                          <div key={sIdx} className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-white truncate">
                                {split.newAthleteName || `Person ${sIdx + 1}`}
                              </span>
                              {split.membershipNumber && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
                                  #{split.membershipNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center justify-between">
                              <span>{split.competitionCount || split.competition_count || '-'} Meets</span>
                              {internalId && (
                                <a
                                  href={`https://usaweightlifting.sport80.com/public/rankings/member/${internalId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 text-[10px]"
                                >
                                  Sport80 #{internalId} <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Stream: name_change_merge */}
                {item.category === 'name_change_merge' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-around gap-4 text-center">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Primary Record</span>
                        <div className="text-sm font-bold text-white">{ev.primary_name}</div>
                        {ev.internal_ids?.[0] && (
                          <a
                            href={`https://usaweightlifting.sport80.com/public/rankings/member/${ev.internal_ids[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-sky-400 hover:underline flex items-center justify-center gap-1"
                          >
                            Member #{ev.internal_ids[0]} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex flex-col items-center">
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] text-emerald-300 font-mono mt-0.5">
                          #{ev.membership_number}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Candidate Record</span>
                        <div className="text-sm font-bold text-emerald-300">{ev.candidate_name}</div>
                        {ev.internal_ids?.[1] && (
                          <a
                            href={`https://usaweightlifting.sport80.com/public/rankings/member/${ev.internal_ids[1]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-sky-400 hover:underline flex items-center justify-center gap-1"
                          >
                            Member #{ev.internal_ids[1]} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Stream: cross_federation */}
                {item.category === 'cross_federation' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Federations</span>
                        <div className="flex items-center gap-1.5">
                          {(ev.federations || ['IWF', 'USAW']).map((fed: string) => (
                            <span key={fed} className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 border border-sky-800 text-sky-300">
                              {fed}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-0.5 text-right text-xs">
                        <div className="text-white font-medium">
                          {ev.iwf_athlete?.athlete_name || 'IWF Athlete'} ↔ {ev.usaw_athlete?.athlete_name || 'USAW Athlete'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Matching Score: <strong className="text-sky-300">{ev.score || item.confidence_score}%</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Stream: iwf_duplicate */}
                {item.category === 'iwf_duplicate' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-white">{ev.athlete_name}</span>
                        <p className="text-[11px] text-slate-400">
                          {ev.event_name || ev.meet_name} (Meet #{ev.db_meet_id})
                        </p>
                      </div>
                      <div className="text-right">
                        {ev.weight_classes && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 border border-amber-800 text-amber-300">
                            {ev.weight_classes.join(' & ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Expandable "Evidence & Reason" Drawer */}
                <div className="pt-1 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-white transition"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{isExpanded ? 'Hide Evidence & Breakdown' : 'Show Evidence & Breakdown'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                      {/* Score Breakdown (if present) */}
                      {ev.score_breakdown && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">Score Factors</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ev.score_breakdown.map((b: string, bIdx: number) => (
                              <span key={bIdx} className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 text-slate-300">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Unidentified Competitions in split plan */}
                      {ev.split_plan?.unidentifiedCompetitions?.length > 0 && (
                        <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-200 space-y-1">
                          <span className="font-semibold text-[11px] text-amber-300">
                            Unidentified Meets ({ev.split_plan.unidentifiedCompetitions.length})
                          </span>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {ev.split_plan.unidentifiedCompetitions.map((un: any, uIdx: number) => (
                              <div key={uIdx} className="text-[10px] text-slate-300 flex items-center justify-between border-t border-amber-900/30 pt-1">
                                <span>Meet #{un.meet_id} ({formatDisplayDate(un.date)}) • {un.age_category || ''} {un.weight_class || ''}</span>
                                {un.sport80Url && (
                                  <a href={un.sport80Url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline flex items-center gap-0.5">
                                    Sport80 <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admin Notes attached */}
                      {ev.admin_notes && (
                        <div className="p-2 bg-indigo-950/30 border border-indigo-800/40 rounded-lg text-indigo-200 text-[11px]">
                          <strong>Admin Review Note:</strong> {ev.admin_notes}
                        </div>
                      )}

                      {/* Raw Evidence Inspector */}
                      <details className="text-[10px] text-slate-500 cursor-pointer pt-1">
                        <summary className="hover:text-slate-400">View Raw Evidence JSON</summary>
                        <pre className="mt-1 p-2 bg-slate-900/90 rounded border border-slate-800 overflow-x-auto text-[10px] text-slate-300 font-mono">
                          {JSON.stringify(ev, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 8. Pagination Controls */}
      {!loading && totalItems > limit && (
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalItems)} of {totalItems.toLocaleString()} items
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition disabled:opacity-40 flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 9. Reviewer Notes Modal */}
      {noteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Reviewer Notes
              </h4>
              <button
                onClick={() => setNoteModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Attach administrative rationale or context to <strong>{noteModalItem.title}</strong>:
            </p>

            <textarea
              value={modalNotesText}
              onChange={(e) => setModalNotesText(e.target.value)}
              placeholder="e.g. Verified via official Sport80 rankings and birth year correlation..."
              className="w-full h-24 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setNoteModalItem(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(noteModalItem.id, noteModalItem.resolution, modalNotesText)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow"
              >
                Save & Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
