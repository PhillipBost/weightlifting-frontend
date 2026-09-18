'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Calendar,
  MapPin,
  Users,
  ShieldAlert,
  Loader2,
  Sparkles,
  BookmarkPlus,
  UploadCloud,
  X,
  Search
} from 'lucide-react';

interface EnrichAuditReport {
  meet_id: number;
  meet_name: string;
  parent_format_version: string;
  uploaded_format_version: string;
  lifters_updated: number;
  results_updated: number;
  stats: {
    birth_dates_added: number;
    birth_years_added: number;
    memberships_added: number;
    clubs_added: number;
    categories_updated: number;
  };
  athletes: Array<{
    lifter_id: number;
    athlete_name: string;
    changes: Array<{ field: string; label: string; value: any }>;
  }>;
}

interface PendingMeet {
  storage_file_name: string;
  storage_path: string;
  storage_bytes: number;
  raw_payload_hash: string | null;
  created_at: string;
  meet_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  format_version: string;
  athlete_count: number;
  parent_meet_id: number | null;
  parent_meet: {
    meet_id: number;
    meet_name: string;
    start_date: string | null;
    format_version: string;
    created_at: string;
  } | null;
  athletes_preview: Array<{
    name: string;
    gender: string | null;
    category: string | null;
    birthYear: string | number | null;
  }>;
}

interface QuarantineReviewQueueProps {
  onCountChange?: (count: number) => void;
}

export function QuarantineReviewQueue({ onCountChange }: QuarantineReviewQueueProps) {
  const [meets, setMeets] = useState<PendingMeet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFileName, setExpandedFileName] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [enrichAudit, setEnrichAudit] = useState<EnrichAuditReport | null>(null);
  const [auditSearchTerm, setAuditSearchTerm] = useState('');

  const fetchPendingMeets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/owlcms/pending');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch quarantined meets');
      }
      setMeets(data.meets || []);
      if (onCountChange) onCountChange(data.meets?.length || 0);
    } catch (err: any) {
      setError(err.message || 'Error loading quarantined meets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingMeets();
  }, []);

  const handleAction = async (
    fileName: string,
    action: 'reject_delete' | 'reject_keep' | 'accept_upload' | 'accept_enrich',
    parentMeetId?: number | null
  ) => {
    if (action === 'reject_delete') {
      const confirmed = window.confirm(
        `Permanently delete ${fileName} from quarantine? This cannot be undone.`
      );
      if (!confirmed) return;
    }

    if (action === 'reject_keep') {
      const confirmed = window.confirm(
        `Reject and keep ${fileName}? Its SHA-256 hash will be blocklisted from future imports.`
      );
      if (!confirmed) return;
    }

    setActionInProgress(fileName);
    setStatusNotice(null);

    try {
      const res = await fetch('/api/owlcms/pending/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, action, parentMeetId })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to execute ${action}`);
      }

      if (data.audit) {
        setEnrichAudit(data.audit);
      }

      setStatusNotice({ text: data.message, type: 'success' });
      setMeets((prev) => prev.filter((m) => m.storage_file_name !== fileName));
      if (onCountChange) onCountChange(meets.length - 1);
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
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Review Queue
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {meets.length} {meets.length === 1 ? 'Meet' : 'Meets'} Held
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Held safely as backup files. Nothing has been added to the database.
            </p>
          </div>
        </div>

        <button
          onClick={fetchPendingMeets}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          title="Refresh Queue"
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

      {/* Granular Enrichment Audit Report */}
      {enrichAudit && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-sky-500/40 shadow-2xl space-y-4">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <h4 className="text-sm font-bold text-white">
                  Enrichment Audit Report: Meet #{enrichAudit.meet_id} ({enrichAudit.meet_name})
                </h4>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Meet format: <span className="font-mono text-slate-300">v{enrichAudit.parent_format_version}</span> | Upload format: <span className="font-mono text-slate-300">v{enrichAudit.uploaded_format_version}</span>
              </p>
            </div>
            <button
              onClick={() => setEnrichAudit(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Close Audit Report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Metric Pills */}
          {enrichAudit.lifters_updated > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                  <div className="text-xs text-slate-400 font-medium">🎂 Birth Dates</div>
                  <div className="text-lg font-bold text-emerald-400">+{enrichAudit.stats.birth_dates_added}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                  <div className="text-xs text-slate-400 font-medium">🪪 Memberships</div>
                  <div className="text-lg font-bold text-sky-400">+{enrichAudit.stats.memberships_added}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                  <div className="text-xs text-slate-400 font-medium">🏢 Clubs</div>
                  <div className="text-lg font-bold text-indigo-400">+{enrichAudit.stats.clubs_added}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
                  <div className="text-xs text-slate-400 font-medium">🏷️ Categories</div>
                  <div className="text-lg font-bold text-amber-400">+{enrichAudit.stats.categories_updated}</div>
                </div>
              </div>

              {/* Search and Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Modified Athletes ({enrichAudit.athletes.length})
                  </span>
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter athletes..."
                      value={auditSearchTerm}
                      onChange={(e) => setAuditSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                  {enrichAudit.athletes
                    .filter((a) =>
                      a.athlete_name.toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
                      a.changes.some((c) => c.value?.toString().toLowerCase().includes(auditSearchTerm.toLowerCase()))
                    )
                    .map((ath) => (
                      <div
                        key={ath.lifter_id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{ath.athlete_name}</span>
                          <span className="text-[10px] text-slate-500">ID #{ath.lifter_id}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {ath.changes.map((ch, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] flex items-center gap-1"
                            >
                              <span className="text-slate-400 font-sans">{ch.label}:</span>
                              <span className="text-sky-300 font-semibold">{String(ch.value)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Zero Overwrites Needed
              </div>
              <p className="text-slate-400">
                Meet #{enrichAudit.meet_id} already contains complete athlete records. No missing fields were identified, and no existing data was overwritten. The uploaded file has been archived safely.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Global Error */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && meets.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-sky-400" />
          <p className="text-xs">Checking for files held for review...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && meets.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-200">Review Queue Clear</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No files held for review. When an uploaded file matches an existing meet, it appears here for your review.
          </p>
        </div>
      )}

      {/* Meets List */}
      <div className="space-y-3">
        {meets.map((m) => {
          const isExpanded = expandedFileName === m.storage_file_name;
          const isActing = actionInProgress === m.storage_file_name;

          return (
            <div
              key={m.storage_file_name}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden transition-all"
            >
              {/* Card Summary Header */}
              <div className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-base truncate">{m.meet_name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        v{m.format_version}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        Held for Review
                      </span>
                    </div>

                    {/* Metadata Row */}
                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      {m.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {m.start_date}
                        </span>
                      )}
                      {m.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {m.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {m.athlete_count} {m.athlete_count === 1 ? 'athlete' : 'athletes'}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {(m.storage_bytes / 1024).toFixed(1)} KB (.gz)
                      </span>
                    </div>
                  </div>

                  {/* Toggle Preview Button */}
                  <button
                    onClick={() => setExpandedFileName(isExpanded ? null : m.storage_file_name)}
                    className="self-start sm:self-center px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1 flex-shrink-0"
                  >
                    <span>{isExpanded ? 'Hide Roster' : 'Preview Roster'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                  {/* Collision Alert Notice */}
                  {m.parent_meet && (
                    <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span>
                          Matches existing Meet #{m.parent_meet.meet_id}: <strong>&quot;{m.parent_meet.meet_name}&quot;</strong> (v{m.parent_meet.format_version}, {m.parent_meet.start_date})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-amber-400/80 flex-shrink-0 hidden md:inline">
                        Same Name &amp; Date
                      </span>
                    </div>
                  )}

                {/* The 4 Decision Buttons */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  {/* Option 4 (Recommended): Update Existing Meet */}
                  <button
                    onClick={() => handleAction(m.storage_file_name, 'accept_enrich', m.parent_meet_id)}
                    disabled={isActing || !m.parent_meet_id}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
                    title="Merge missing athlete data, birthdates, and clubs into existing meet without creating duplicates"
                  >
                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-sky-200" />}
                    <span>Update Existing Meet #{m.parent_meet_id || '?'}</span>
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Option 3: Accept & Upload as New */}
                    <button
                      onClick={() => handleAction(m.storage_file_name, 'accept_upload')}
                      disabled={isActing}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Import as a completely new separate meet in the database"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Import as New Meet</span>
                    </button>

                    {/* Option 2: Reject & Keep (Blocklist Hash) */}
                    <button
                      onClick={() => handleAction(m.storage_file_name, 'reject_keep')}
                      disabled={isActing}
                      className="px-3 py-2 text-xs font-medium rounded-xl bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Keep file in backup archive and block future uploads of this identical file"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ignore &amp; Block Future Uploads</span>
                    </button>

                    {/* Option 1: Reject & Delete */}
                    <button
                      onClick={() => handleAction(m.storage_file_name, 'reject_delete')}
                      disabled={isActing}
                      className="px-3 py-2 text-xs font-medium rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Permanently delete this backup file"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete Upload</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Athlete Roster Preview */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400 font-semibold uppercase text-[10px] tracking-wider pb-1 border-b border-slate-800/80">
                    <span>Uploaded Athlete Roster Preview (First 50)</span>
                    <span>Total: {m.athlete_count}</span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                    {m.athletes_preview.length === 0 ? (
                      <p className="text-slate-500 italic py-2">No athlete records found in file.</p>
                    ) : (
                      m.athletes_preview.map((ath, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/60"
                        >
                          <span className="text-slate-200 font-medium truncate">{ath.name}</span>
                          <div className="flex items-center gap-3 text-slate-400 flex-shrink-0 text-[10px]">
                            {ath.gender && <span>{ath.gender}</span>}
                            {ath.category && <span className="text-sky-400">{ath.category}</span>}
                            {ath.birthYear && <span>b. {ath.birthYear}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default QuarantineReviewQueue;
