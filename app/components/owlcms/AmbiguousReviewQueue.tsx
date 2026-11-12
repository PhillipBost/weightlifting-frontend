"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ArrowRight,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  RotateCcw
} from 'lucide-react';

interface EnrichedEvaluationAthlete {
  id: number;
  name: string;
  gender: string | null;
  birthYear: number | null;
  country: string | null;
  countryName?: string | null;
  clubName?: string | null;
  bestTotal: number | null;
  tableColumn: string;
  iwfLifterId?: number | null;
  membershipNumber?: string | number | null;
  sport80InternalId?: string | number | null;
  owlanalyticsUrl: string | null;
  officialUrl: string | null;
}

export interface LinkingEvaluationItem {
  evaluationId: number;
  status: 'REVIEW_NEEDED' | 'MATCHED' | 'VETTED_ISOLATED' | 'PENDING';
  sourceFederation: { id: string; code: string; name: string };
  targetFederation: { id: string; code: string; name: string };
  confidenceScore: number;
  cohort: string | null;
  algorithmVersion: string;
  sourceAthlete: EnrichedEvaluationAthlete | null;
  candidateAthlete: EnrichedEvaluationAthlete | null;
  evidenceBreakdown: string[];
  rejectedCandidateIds: number[];
  isBlacklisted: boolean;
  reviewerNotes: string | null;
  enqueuedAt: string;
  evaluatedAt: string | null;
  updatedAt: string;
}

interface AmbiguousReviewQueueProps {
  searchQuery?: string;
  selectedStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
  refreshTrigger?: number;
  onActionComplete?: () => void;
}

function formatEasternDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
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
  } catch {
    // Fallback
  }
  return dateStr;
}

function formatDivisionFromGender(gender?: string | null): string {
  if (!gender) return 'Unspecified Division';
  const g = gender.trim().toUpperCase();
  if (g === 'M' || g === 'MEN' || g === 'MALE') return "Men's Division";
  if (g === 'F' || g === 'WOMEN' || g === 'FEMALE') return "Women's Division";
  return `${gender} Division`;
}

export function AmbiguousReviewQueue({
  searchQuery = '',
  selectedStatus = 'PENDING',
  refreshTrigger = 0,
  onActionComplete
}: AmbiguousReviewQueueProps) {
  const [items, setItems] = useState<LinkingEvaluationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sourceFedFilter, setSourceFedFilter] = useState<string>('');
  const [targetFedFilter, setTargetFedFilter] = useState<string>('');

  const [actingId, setActingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [notesDraftMap, setNotesDraftMap] = useState<Record<number, string>>({});
  const [openNotesId, setOpenNotesId] = useState<number | null>(null);

  // Map top-level status tab to athlete_linking_evaluations status
  const mappedEvalStatus =
    selectedStatus === 'PENDING'
      ? 'REVIEW_NEEDED'
      : selectedStatus === 'APPROVED'
        ? 'MATCHED'
        : selectedStatus === 'REJECTED'
          ? 'VETTED_ISOLATED'
          : 'ALL';

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: mappedEvalStatus
      });
      if (sourceFedFilter) params.set('sourceFed', sourceFedFilter);
      if (targetFedFilter) params.set('targetFed', targetFedFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/pipeline/review-queue?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.totalItems ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch {
      // Ignore fetch error
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, mappedEvalStatus, sourceFedFilter, targetFedFilter, searchQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshTrigger]);

  const handleAction = async (
    item: LinkingEvaluationItem,
    action: 'CONFIRM_MATCH' | 'REJECT_BLACKLIST' | 'DISMISS_ISOLATED' | 'REOPEN_REVIEW'
  ) => {
    setActingId(item.evaluationId);
    setNotice(null);
    try {
      const notes = notesDraftMap[item.evaluationId] ?? item.reviewerNotes ?? undefined;
      const res = await fetch('/api/admin/pipeline/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationId: item.evaluationId,
          action,
          notes
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute review action');
      }

      // Optimistic in-place removal so remaining cards do not flash or unmount
      setItems((prev) => prev.filter((i) => i.evaluationId !== item.evaluationId));
      setTotalItems((prev) => Math.max(0, prev - 1));
      setNotice({ text: data.message || 'Review decision recorded.', type: 'success' });
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      setNotice({ text: err?.message || 'Action failed', type: 'error' });
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Federation Pair Filter Bar */}
      <div className="card-primary p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">
            Filter Pairing Direction:
          </span>
          <select
            value={sourceFedFilter}
            onChange={(e) => {
              setSourceFedFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 rounded-lg bg-app-secondary border border-app-primary text-app-primary focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Source Governing Bodies</option>
            <option value="IWF">Source: IWF</option>
            <option value="USAW">Source: USAW</option>
            <option value="OWLCMS">Source: OWLCMS</option>
          </select>

          <ArrowRight className="w-3.5 h-3.5 text-app-muted" />

          <select
            value={targetFedFilter}
            onChange={(e) => {
              setTargetFedFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 rounded-lg bg-app-secondary border border-app-primary text-app-primary focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Target Governing Bodies</option>
            <option value="USAW">Target: USAW</option>
            <option value="IWF">Target: IWF</option>
            <option value="OWLCMS">Target: OWLCMS</option>
          </select>
        </div>

        <div className="text-xs text-app-muted">
          Showing <strong className="text-app-primary">{items.length}</strong> of{' '}
          <strong className="text-app-primary">{totalItems.toLocaleString()}</strong> evaluation(s) in{' '}
          <code className="text-indigo-400">{mappedEvalStatus}</code>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center rounded-2xl card-primary text-app-secondary space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
          <p className="text-xs">Loading cross-federation candidate evaluations...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl card-primary text-app-secondary space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-semibold text-app-primary">
            No Cross-Federation Evaluations in {mappedEvalStatus}
          </h4>
          <p className="text-xs text-app-muted max-w-md mx-auto">
            All queued candidate pairings for the selected filter have been triaged. Use the batch worker above to evaluate pending tasks or seed a historical backfill.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => {
            const isActing = actingId === item.evaluationId;
            const sAth = item.sourceAthlete;
            const cAth = item.candidateAthlete;
            const isNotesOpen = openNotesId === item.evaluationId;

            return (
              <div
                key={item.evaluationId}
                className="card-primary space-y-4 p-5 rounded-2xl border-l-2 border-l-purple-500 shadow-lg hover:shadow-xl dark:shadow-2xl dark:shadow-black/60"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-app-primary">
                        {sAth?.name || 'Source Athlete'} ({item.sourceFederation.code}) ↔{' '}
                        {cAth?.name || 'Candidate Athlete'} ({item.targetFederation.code})
                      </span>

                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Confidence: {item.confidenceScore}%
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        Cross-Federation Identity Evaluation
                      </span>

                      <code className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/[0.03] border border-white/5 text-app-muted">
                        athlete_linking_evaluations.evaluation_id: #{item.evaluationId}
                      </code>
                    </div>

                    <div className="text-[11px] text-app-muted flex items-center gap-2 flex-wrap">
                      <span>
                        Algorithm: <code className="text-app-secondary">{item.algorithmVersion}</code>
                      </span>
                      <span>•</span>
                      <span>
                        Evaluated: {formatEasternDateTime(item.evaluatedAt || item.enqueuedAt)}
                      </span>
                      {item.isBlacklisted && (
                        <>
                          <span>•</span>
                          <span className="text-rose-400 font-semibold">Blacklisted Pairing</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setOpenNotesId(isNotesOpen ? null : item.evaluationId)
                    }
                    className="p-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-app-primary transition flex items-center gap-1 text-xs"
                    title="Attach or edit reviewer notes"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Reviewer Note</span>
                  </button>
                </div>

                {/* 3-Panel Operational Diagnostic Brief (Rule 13 Compliance) */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
                      1. Current Database State
                    </span>
                    <p className="text-app-secondary leading-relaxed">
                      <strong>{sAth?.name}</strong> (<code className="text-sky-400">{sAth?.tableColumn}: #{sAth?.id}</code>) in {item.sourceFederation.name} and <strong>{cAth?.name}</strong> (<code className="text-emerald-400">{cAth?.tableColumn}: #{cAth?.id}</code>) in {item.targetFederation.name} are currently unlinked profiles with no pairwise edge in <code className="text-indigo-400">athlete_aliases</code>.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                      2. Flagged Hypothesis ({item.confidenceScore}% Score)
                    </span>
                    <p className="text-app-secondary leading-relaxed">
                      Flagged by the symmetrical evaluator worker in the 60–79% human review band based on shared demographic cohort (<code className="text-amber-300">{formatDivisionFromGender(sAth?.gender)}, b. {sAth?.birthYear || '—'}</code>) and multi-factor name/country/performance scoring.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      3. Administrative Decision Impact
                    </span>
                    <p className="text-app-secondary leading-relaxed">
                      <strong>Confirm Match</strong> inserts a pairwise edge into <code className="text-emerald-400">athlete_aliases</code> (<code className="text-app-muted">check_alias_type = 2</code>) and marks <code className="text-emerald-400">MATCHED</code>. <strong>Reject &amp; Blacklist</strong> records candidate <code className="text-rose-400">#{cAth?.id}</code> in <code className="text-rose-400">rejected_candidate_ids</code> and marks <code className="text-app-muted">VETTED_ISOLATED</code>.
                    </p>
                  </div>
                </div>

                {/* Side-by-Side Comparison Grid */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-stretch gap-3 text-xs">
                  {/* Left: Source Athlete */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                          Source Profile • {item.sourceFederation.name} ({item.sourceFederation.code})
                        </span>
                        <code className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          {sAth?.tableColumn}: #{sAth?.id}
                        </code>
                      </div>

                      <div className="text-base font-bold text-app-primary">
                        {sAth?.name || 'Unknown Athlete'}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Division</span>
                          <span className="font-semibold text-app-primary">
                            {formatDivisionFromGender(sAth?.gender)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Birth Year</span>
                          <span className="font-semibold text-app-primary">
                            {sAth?.birthYear || '—'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Country / Club</span>
                          <span className="font-semibold text-app-primary">
                            {sAth?.country || sAth?.clubName || '—'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Career Best Total</span>
                          <span className="font-semibold text-emerald-400">
                            {sAth?.bestTotal ? `${sAth.bestTotal} kg` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Verification Links */}
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap">
                      {sAth?.owlanalyticsUrl && (
                        <Link
                          href={sAth.owlanalyticsUrl}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/60 dark:border-indigo-700/60 dark:text-indigo-300 transition flex items-center gap-1.5"
                        >
                          <span>OWLanalytics Athlete Profile</span>
                          <ExternalLink className="w-3 h-3 text-indigo-400" />
                        </Link>
                      )}
                      {sAth?.officialUrl && (
                        <a
                          href={sAth.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/80 dark:hover:bg-sky-900/60 dark:border-sky-800/60 dark:text-sky-300 transition flex items-center gap-1.5"
                        >
                          <span>
                            {item.sourceFederation.code === 'IWF'
                              ? `Official IWF Athlete Profile (#${sAth.iwfLifterId})`
                              : `Official Sport80 Member Profile (#${sAth.sport80InternalId})`}
                          </span>
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Middle: Evidence Chips */}
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-2 min-w-[180px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted">
                      Scoring Breakdown
                    </span>
                    <div className="flex flex-col items-center gap-1.5 w-full">
                      {item.evidenceBreakdown.map((chip, idx) => {
                        const isNegative = chip.includes('-');
                        return (
                          <span
                            key={idx}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border text-center w-full ${
                              isNegative
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {chip}
                          </span>
                        );
                      })}
                    </div>
                    <span className="mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Total Score: {item.confidenceScore}%
                    </span>
                  </div>

                  {/* Right: Candidate Athlete */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Candidate Profile • {item.targetFederation.name} ({item.targetFederation.code})
                        </span>
                        <code className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {cAth?.tableColumn}: #{cAth?.id}
                        </code>
                      </div>

                      <div className="text-base font-bold text-app-primary">
                        {cAth?.name || 'Unknown Candidate'}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Division</span>
                          <span className="font-semibold text-app-primary">
                            {formatDivisionFromGender(cAth?.gender)}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Birth Year</span>
                          <span className="font-semibold text-app-primary">
                            {cAth?.birthYear || '—'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Country / Club</span>
                          <span className="font-semibold text-app-primary">
                            {cAth?.country || cAth?.clubName || '—'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                          <span className="text-[10px] text-app-muted block">Career Best Total</span>
                          <span className="font-semibold text-emerald-400">
                            {cAth?.bestTotal ? `${cAth.bestTotal} kg` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Verification Links */}
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2 flex-wrap">
                      {cAth?.owlanalyticsUrl && (
                        <Link
                          href={cAth.owlanalyticsUrl}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/60 dark:border-indigo-700/60 dark:text-indigo-300 transition flex items-center gap-1.5"
                        >
                          <span>OWLanalytics Athlete Profile</span>
                          <ExternalLink className="w-3 h-3 text-indigo-400" />
                        </Link>
                      )}
                      {cAth?.officialUrl && (
                        <a
                          href={cAth.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/80 dark:hover:bg-sky-900/60 dark:border-sky-800/60 dark:text-sky-300 transition flex items-center gap-1.5"
                        >
                          <span>
                            {item.targetFederation.code === 'IWF'
                              ? `Official IWF Athlete Profile (#${cAth.iwfLifterId})`
                              : `Official Sport80 Member Profile (#${cAth.sport80InternalId})`}
                          </span>
                          <ExternalLink className="w-3 h-3 text-sky-400" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Optional Reviewer Notes Box */}
                {(isNotesOpen || item.reviewerNotes) && (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                    <label className="text-[11px] font-semibold text-app-secondary block">
                      Administrative Reviewer Notes:
                    </label>
                    <input
                      type="text"
                      value={notesDraftMap[item.evaluationId] ?? item.reviewerNotes ?? ''}
                      onChange={(e) =>
                        setNotesDraftMap((prev) => ({
                          ...prev,
                          [item.evaluationId]: e.target.value
                        }))
                      }
                      placeholder="e.g. Verified via competition video / official federation roster..."
                      className="w-full px-3 py-1.5 rounded-lg bg-app-secondary border border-app-primary text-xs text-app-primary placeholder-app-muted focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                {/* Bottom Decision Bar */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="text-[11px] text-app-muted">
                    {item.status === 'REVIEW_NEEDED'
                      ? 'Select an administrative resolution for this cross-federation candidate pairing:'
                      : `Current ledger state: ${item.status}`}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {item.status === 'REVIEW_NEEDED' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAction(item, 'CONFIRM_MATCH')}
                          disabled={isActing}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                        >
                          {isActing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Approve &amp; Link Profiles</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAction(item, 'REJECT_BLACKLIST')}
                          disabled={isActing}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                          <span>Reject &amp; Blacklist Pairing</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAction(item, 'DISMISS_ISOLATED')}
                          disabled={isActing}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-app-primary transition flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Dismiss as Isolated</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(item, 'REOPEN_REVIEW')}
                        disabled={isActing}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore to Review Queue</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-3 card-primary flex items-center justify-between text-xs">
          <span className="text-app-muted">
            Page <strong className="text-app-primary">{page}</strong> of{' '}
            <strong className="text-app-primary">{totalPages}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary disabled:opacity-40 flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

