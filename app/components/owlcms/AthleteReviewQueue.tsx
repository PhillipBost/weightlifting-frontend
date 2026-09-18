"use client";

import React, { useState, useEffect } from 'react';
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
  Globe
} from 'lucide-react';

export interface CompetitionData {
  meet_id?: number;
  meet_name: string;
  date?: string | null;
  category?: string | null;
  weight_class?: string | null;
  body_weight_kg?: number | string | null;
  snatch_1?: number | null;
  snatch_2?: number | null;
  snatch_3?: number | null;
  best_snatch?: number | string | null;
  cj_1?: number | null;
  cj_2?: number | null;
  cj_3?: number | null;
  best_cj?: number | string | null;
  total?: number | string | null;
}

export interface ReviewCandidate {
  type: 'USAW' | 'IWF';
  candidate_id: number;
  candidate_name: string;
  score: number;
  evidence?: string;
  country?: { code: string; name: string; flag: string };
  membership_number?: number | string | null;
  affiliation?: string;
  internal_url?: string;
  external_url?: string | null;
  recent_competition?: CompetitionData | null;
}

export interface ReviewItem {
  lifter_id: number;
  athlete_name: string;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  birth_year?: number | null;
  exact_birth_date?: string | null;
  club_name?: string | null;
  country_code?: string | null;
  country?: { code: string; name: string; flag: string };
  membership_number?: string | null;
  link_status: string;
  competition?: CompetitionData | null;
  review_candidate?: ReviewCandidate | null;
  rejected_candidate_ids?: number[];
  created_at?: string;
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
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return dateStr;
}

interface AthleteReviewQueueProps {
  onCountChange?: (count: number) => void;
}

export function AthleteReviewQueue({ onCountChange }: AthleteReviewQueueProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/owlcms/reviews');
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews || []);
        if (onCountChange) onCountChange(data.count || 0);
      } else {
        setStatusNotice({ text: data.error || 'Failed to fetch reviews', type: 'error' });
      }
    } catch (err: any) {
      setStatusNotice({ text: err.message || 'Network error fetching reviews', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleResolve = async (
    lifter_id: number,
    action: 'link' | 'reject',
    candidate_type?: 'USAW' | 'IWF',
    candidate_id?: number
  ) => {
    setActionInProgress(lifter_id);
    setStatusNotice(null);

    try {
      const res = await fetch('/api/owlcms/reviews/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lifter_id,
          action,
          candidate_type,
          candidate_id
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Resolution failed');
      }

      setStatusNotice({
        text: action === 'link'
          ? `Confirmed link for athlete #${lifter_id}. Successfully written to athlete_aliases.`
          : `Rejected candidate for athlete #${lifter_id}. Added to blacklist.`,
        type: 'success'
      });

      // Remove from local list
      const updated = reviews.filter((r) => r.lifter_id !== lifter_id);
      setReviews(updated);
      if (onCountChange) onCountChange(updated.length);
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Athlete Review Queue
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {reviews.length} {reviews.length === 1 ? 'Athlete' : 'Athletes'} Needing Review
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Borderline matches (60%–79% confidence). Confirm to link athlete profiles or reject to blacklist.
            </p>
          </div>
        </div>

        <button
          onClick={fetchReviews}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          title="Refresh Athlete Reviews"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Global Status Notice */}
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

      {/* Loading State */}
      {loading && reviews.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-400" />
          <p className="text-xs">Loading athlete reviews...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && reviews.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-200">Athlete Review Queue Clear</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All athlete matches have been resolved. When an imported lifter partially matches an existing USAW or IWF profile, it will appear here.
          </p>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((item) => {
          const isActing = actionInProgress === item.lifter_id;
          const cand = item.review_candidate;

          const owlcmsTotal = item.competition?.total ? Number(item.competition.total) : null;
          const candTotal = cand?.recent_competition?.total ? Number(cand.recent_competition.total) : null;
          const totalDelta = owlcmsTotal !== null && candTotal !== null ? Math.abs(owlcmsTotal - candTotal) : null;

          return (
            <div
              key={item.lifter_id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4 shadow-lg"
            >
              {/* Top Bar: Lifter Name, IDs, Confidence */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">{item.athlete_name}</span>
                  <span className="text-xs text-slate-400 font-mono">
                    OWLCMS #{item.lifter_id} ➔ {cand?.type} #{cand?.candidate_id}
                  </span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {cand?.score ?? 75}% Confidence
                </span>
              </div>

              {/* Horizontally Aligned Comparison Table */}
              <div className="rounded-lg border border-slate-800 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <th className="py-2.5 px-4 w-1/4 font-semibold">Attribute</th>
                      <th className="py-2.5 px-4 w-[37.5%] font-semibold text-slate-200">
                        OWLCMS Upload (#{item.lifter_id})
                      </th>
                      <th className="py-2.5 px-4 w-[37.5%] font-semibold text-slate-200">
                        {cand?.type} Candidate (#{cand?.candidate_id})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                    {/* Athlete Name & Direct Links */}
                    <tr>
                      <td className="py-2.5 px-4 text-slate-400 font-medium">Athlete Name</td>
                      <td className="py-2.5 px-4 text-white font-bold">{item.athlete_name}</td>
                      <td className="py-2.5 px-4 text-white font-bold">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span>{cand?.candidate_name}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {cand?.internal_url && (
                              <a
                                href={cand.internal_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] inline-flex items-center gap-1 transition"
                              >
                                <span>Profile</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            )}
                            {cand?.external_url && (
                              <a
                                href={cand.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] inline-flex items-center gap-1 transition"
                              >
                                <span>{cand?.type} Bio</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Country & Location */}
                    <tr>
                      <td className="py-2.5 px-4 text-slate-400 font-medium">Country &amp; Location</td>
                      <td className="py-2.5 px-4 text-slate-300">
                        <span>{item.country?.flag} {item.country?.name} ({item.country?.code})</span>
                        {item.club_name && <span className="text-slate-400 text-[11px] ml-2">• {item.club_name}</span>}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">
                        <span>{cand?.country?.flag} {cand?.country?.name} ({cand?.country?.code})</span>
                        {cand?.affiliation && <span className="text-slate-400 text-[11px] ml-2">• {cand.affiliation}</span>}
                      </td>
                    </tr>

                    {/* Demographics */}
                    <tr>
                      <td className="py-2.5 px-4 text-slate-400 font-medium">Gender &amp; Birth Year</td>
                      <td className="py-2.5 px-4 text-slate-300">
                        {item.gender === 'M' ? 'Male' : item.gender === 'F' ? 'Female' : item.gender || '-'} • b. {item.birth_year || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">
                        {item.gender === 'M' ? 'Male' : item.gender === 'F' ? 'Female' : item.gender || '-'} • b. {item.birth_year || '-'}
                      </td>
                    </tr>

                    {/* Competition */}
                    <tr>
                      <td className="py-2.5 px-4 text-slate-400 font-medium">Competition</td>
                      <td className="py-2.5 px-4 text-slate-300">
                        {item.competition?.meet_id ? (
                          <a
                            href={`/meet/${item.competition.meet_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-200 hover:text-sky-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>{item.competition.meet_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </a>
                        ) : (
                          item.competition?.meet_name || '-'
                        )}
                        {item.competition?.date && (
                          <span className="text-slate-500 text-[11px] ml-1.5">
                            ({formatDisplayDate(item.competition.date)})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300">
                        <span>{cand?.recent_competition?.meet_name || 'No prior meet'}</span>
                        {cand?.recent_competition?.date && (
                          <span className="text-slate-500 text-[11px] ml-1.5">
                            ({formatDisplayDate(cand.recent_competition.date)})
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Category & Bodyweight */}
                    <tr>
                      <td className="py-2.5 px-4 text-slate-400 font-medium">Category &amp; Bodyweight</td>
                      <td className="py-2.5 px-4 text-slate-300 font-mono">
                        {item.competition?.category || '-'} {item.competition?.body_weight_kg ? `(${item.competition.body_weight_kg} kg)` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 font-mono">
                        {cand?.recent_competition?.weight_class || '-'} {cand?.recent_competition?.body_weight_kg ? `(${cand.recent_competition.body_weight_kg} kg)` : ''}
                      </td>
                    </tr>

                    {/* Snatch */}
                    <tr>
                      <td className="py-2.5 px-4 text-slate-400 font-medium">Best Snatch</td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-bold text-white">{item.competition?.best_snatch ? `${item.competition.best_snatch} kg` : '-'}</span>
                        {item.competition?.snatch_1 !== undefined && (
                          <span className="text-slate-500 text-[11px] ml-2">[{item.competition.snatch_1}, {item.competition.snatch_2 ?? '-'}, {item.competition.snatch_3 ?? '-'}]</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-bold text-white">{cand?.recent_competition?.best_snatch ? `${cand.recent_competition.best_snatch} kg` : '-'}</span>
                        {cand?.recent_competition?.snatch_1 !== undefined && (
                          <span className="text-slate-500 text-[11px] ml-2">[{cand.recent_competition.snatch_1}, {cand.recent_competition.snatch_2 ?? '-'}, {cand.recent_competition.snatch_3 ?? '-'}]</span>
                        )}
                      </td>
                    </tr>

                    {/* Clean & Jerk */}
                    <tr>
                      <td className="py-2.5 px-4 text-slate-400 font-medium">Best Clean &amp; Jerk</td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-bold text-white">{item.competition?.best_cj ? `${item.competition.best_cj} kg` : '-'}</span>
                        {item.competition?.cj_1 !== undefined && (
                          <span className="text-slate-500 text-[11px] ml-2">[{item.competition.cj_1}, {item.competition.cj_2 ?? '-'}, {item.competition.cj_3 ?? '-'}]</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        <span className="font-bold text-white">{cand?.recent_competition?.best_cj ? `${cand.recent_competition.best_cj} kg` : '-'}</span>
                        {cand?.recent_competition?.cj_1 !== undefined && (
                          <span className="text-slate-500 text-[11px] ml-2">[{cand.recent_competition.cj_1}, {cand.recent_competition.cj_2 ?? '-'}, {cand.recent_competition.cj_3 ?? '-'}]</span>
                        )}
                      </td>
                    </tr>

                    {/* Total & Delta */}
                    <tr className="bg-slate-950/40">
                      <td className="py-2.5 px-4 text-slate-300 font-semibold">Total</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-white text-sm">
                        {item.competition?.total ? `${item.competition.total} kg` : '-'}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-white text-sm">
                        <div className="flex items-center justify-between">
                          <span>{cand?.recent_competition?.total ? `${cand.recent_competition.total} kg` : '-'}</span>
                          {totalDelta !== null && (
                            <span className="text-xs font-mono font-normal text-slate-400">
                              Δ {totalDelta} kg
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Evidence String */}
              {cand?.evidence && (
                <div className="text-xs text-slate-400 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800 font-mono">
                  <span className="text-slate-300 font-sans font-medium">Match Evidence:</span>
                  <span>{cand.evidence}</span>
                </div>
              )}

              {/* Action Bar */}
              <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs text-slate-500">
                  Linking writes to <code>athlete_aliases</code> with 100% manual confidence.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResolve(item.lifter_id, 'link', cand?.type, cand?.candidate_id)}
                    disabled={isActing || !cand?.candidate_id || !cand?.type}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Confirm Link</span>
                  </button>
                  <button
                    onClick={() => handleResolve(item.lifter_id, 'reject', cand?.type, cand?.candidate_id)}
                    disabled={isActing}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Match</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AthleteReviewQueue;
