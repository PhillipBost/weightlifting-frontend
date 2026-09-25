'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Building2,
  Trophy,
  Dumbbell,
  Loader2,
  ExternalLink,
  User,
  Globe,
  Award,
  Hash
} from 'lucide-react';

interface AthleteProfile {
  lifter: {
    lifter_id: number;
    athlete_name: string;
    first_name?: string | null;
    last_name?: string | null;
    gender: string | null;
    birth_year: number | null;
    country_code: string | null;
    club_name: string | null;
    membership_number: string | null;
  };
  linked_identities: {
    usaw_lifter_id?: number | null;
    usaw_membership_number?: string | null;
    usaw_name?: string | null;
    iwf_db_lifter_id?: number | null;
    iwf_name?: string | null;
  };
  personal_bests: {
    best_snatch: number | null;
    best_cj: number | null;
    best_total: number | null;
    best_qpoints: number | null;
    best_gamx_total: number | null;
  };
  results: Array<{
    result_id: number;
    meet_id: number;
    meet_name: string;
    start_date: string | null;
    city: string | null;
    country: string | null;
    category: string;
    body_weight_kg: number | null;
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
    rank: number | null;
  }>;
}

export default function OwlcmsAthletePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchAthlete() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/athlete/owlcms/${id}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load athlete profile');
        }

        setProfile(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAthlete();
  }, [id]);

  const renderAttempt = (val: number | null | undefined) => {
    if (val === null || val === undefined || val === 0) {
      return <span className="text-slate-600">—</span>;
    }
    if (val > 0) {
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
          {val}
        </span>
      );
    }
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-800/40 line-through font-mono">
        {Math.abs(val)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          <p className="text-slate-400 text-sm">Loading athlete profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-[1200px] mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/20 p-6 text-center">
            <p className="text-rose-400 font-semibold mb-2">Athlete Not Found</p>
            <p className="text-slate-400 text-sm">{error || 'Unable to retrieve athlete record.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const { lifter, linked_identities, personal_bests, results } = profile;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-slate-800/80 p-4 flex-shrink-0 text-slate-300">
                <User className="h-10 w-10" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                    owlcms Domestic
                  </span>
                  {lifter.country_code && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {lifter.country_code}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  {lifter.athlete_name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400 mt-1">
                  {lifter.gender && (
                    <span>{lifter.gender === 'M' || lifter.gender === 'Men' ? 'Male' : 'Female'}</span>
                  )}
                  {lifter.birth_year && (
                    <span>Born {lifter.birth_year}</span>
                  )}
                  {lifter.club_name && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-slate-500" />
                      {lifter.club_name}
                    </span>
                  )}
                  {lifter.membership_number && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      <Hash className="h-3 w-3 text-slate-500" />
                      ID: {lifter.membership_number}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Cross-Federation Profile Navigation */}
            {(linked_identities.usaw_lifter_id || linked_identities.iwf_db_lifter_id) && (
              <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 items-start md:items-end">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Linked Profiles
                </span>
                {linked_identities.usaw_lifter_id && (
                  <Link
                    href={`/athlete/${linked_identities.usaw_membership_number || linked_identities.usaw_lifter_id}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-800/60 bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 text-xs font-medium transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>View USAW Profile</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                )}
                {linked_identities.iwf_db_lifter_id && (
                  <Link
                    href={`/athlete/iwf/${linked_identities.iwf_db_lifter_id}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-medium transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>View IWF Profile</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Personal Bests Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Best Snatch</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-sky-400">
                {personal_bests.best_snatch ? `${personal_bests.best_snatch}` : '—'}
              </span>
              {personal_bests.best_snatch && <span className="text-xs text-slate-400">kg</span>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Best C&J</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-sky-400">
                {personal_bests.best_cj ? `${personal_bests.best_cj}` : '—'}
              </span>
              {personal_bests.best_cj && <span className="text-xs text-slate-400">kg</span>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Best Total</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-white">
                {personal_bests.best_total ? `${personal_bests.best_total}` : '—'}
              </span>
              {personal_bests.best_total && <span className="text-xs text-slate-400">kg</span>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Best Q-Points</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-amber-400">
                {personal_bests.best_qpoints ? Number(personal_bests.best_qpoints).toFixed(1) : '—'}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Best GAMX</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-purple-400">
                {personal_bests.best_gamx_total ? Number(personal_bests.best_gamx_total).toFixed(0) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Competition Results Table */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Competition Results</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {results.length} {results.length === 1 ? 'Meet' : 'Meets'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Meet</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-2 text-right">B.Wt</th>
                  <th className="py-2.5 px-2 text-center" colSpan={3}>Snatch</th>
                  <th className="py-2.5 px-3 text-right">Best</th>
                  <th className="py-2.5 px-2 text-center" colSpan={3}>Clean & Jerk</th>
                  <th className="py-2.5 px-3 text-right">Best</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Q-Pts</th>
                  <th className="py-2.5 px-3 text-right">GAMX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {results.map((r) => (
                  <tr key={r.result_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono">
                      {r.start_date ? new Date(r.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/meet/owlcms/${r.meet_id}`}
                        className="font-medium text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1"
                      >
                        {r.meet_name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{r.category}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                      {r.body_weight_kg ? `${r.body_weight_kg}kg` : '—'}
                    </td>

                    {/* Snatches */}
                    <td className="py-2.5 px-1.5 text-center">{renderAttempt(r.snatch_1)}</td>
                    <td className="py-2.5 px-1.5 text-center">{renderAttempt(r.snatch_2)}</td>
                    <td className="py-2.5 px-1.5 text-center">{renderAttempt(r.snatch_3)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-300">
                      {r.best_snatch ? `${r.best_snatch}kg` : '—'}
                    </td>

                    {/* Clean & Jerks */}
                    <td className="py-2.5 px-1.5 text-center">{renderAttempt(r.cj_1)}</td>
                    <td className="py-2.5 px-1.5 text-center">{renderAttempt(r.cj_2)}</td>
                    <td className="py-2.5 px-1.5 text-center">{renderAttempt(r.cj_3)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-300">
                      {r.best_cj ? `${r.best_cj}kg` : '—'}
                    </td>

                    {/* Total */}
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-white text-sm">
                      {r.total ? `${r.total}kg` : '—'}
                    </td>

                    {/* Analytics */}
                    <td className="py-2.5 px-3 text-right font-mono text-amber-300">
                      {r.qpoints ? Number(r.qpoints).toFixed(1) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-purple-300">
                      {r.gamx_total ? Number(r.gamx_total).toFixed(0) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
