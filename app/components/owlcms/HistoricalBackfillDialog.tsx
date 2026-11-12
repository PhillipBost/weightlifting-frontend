"use client";

import React, { useState } from 'react';
import {
  X,
  Database,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Play,
  Layers
} from 'lucide-react';

interface HistoricalBackfillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEnqueued: () => void;
}

const FEDERATION_OPTIONS = [
  { code: 'IWF', name: 'International Weightlifting Federation (IWF)' },
  { code: 'USAW', name: 'USA Weightlifting (USAW)' },
  { code: 'OWLCMS', name: 'Open Weightlifting Competition Management System (OWLCMS)' }
];

export function HistoricalBackfillDialog({
  isOpen,
  onClose,
  onEnqueued
}: HistoricalBackfillDialogProps) {
  const [sourceFederation, setSourceFederation] = useState<string>('IWF');
  const [targetFederations, setTargetFederations] = useState<string[]>(['USAW', 'OWLCMS']);
  const [scopeMode, setScopeMode] = useState<'year' | 'meet' | 'full'>('year');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [meetId, setMeetId] = useState<string>('');
  const [unlinkedOnly, setUnlinkedOnly] = useState<boolean>(true);

  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [enqueuing, setEnqueuing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    sourceAthletesFound: number;
    tasksToEnqueueCount: number;
    enqueuedCount: number;
    previewOnly: boolean;
    breakdownByTarget: Array<{
      targetFederation: string;
      candidateAthletes: number;
      alreadyLinkedSkipped: number;
      alreadyEvaluatedSkipped: number;
      newTasksCount: number;
    }>;
  } | null>(null);

  if (!isOpen) return null;

  const handleSourceChange = (newSource: string) => {
    setSourceFederation(newSource);
    setTargetFederations((prev) => {
      const filtered = prev.filter((f) => f !== newSource);
      if (filtered.length > 0) return filtered;
      return FEDERATION_OPTIONS.map((o) => o.code).filter((c) => c !== newSource);
    });
    setPreviewResult(null);
    setError(null);
  };

  const toggleTargetFed = (code: string) => {
    if (code === sourceFederation) return;
    setTargetFederations((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
    setPreviewResult(null);
    setError(null);
  };

  const executeSeedRequest = async (isPreview: boolean) => {
    if (targetFederations.length === 0) {
      setError('Select at least one target federation.');
      return;
    }
    if (scopeMode === 'year' && (!year || isNaN(Number(year)))) {
      setError('Enter a valid 4-digit competition year.');
      return;
    }
    if (scopeMode === 'meet' && (!meetId || isNaN(Number(meetId)))) {
      setError('Enter a valid numeric Meet or Event ID.');
      return;
    }

    setError(null);
    if (isPreview) setLoadingPreview(true);
    else setEnqueuing(true);

    try {
      const res = await fetch('/api/admin/pipeline/seed-backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceFederation,
          targetFederations,
          scope: {
            year: scopeMode === 'year' ? Number(year) : undefined,
            meetId: scopeMode === 'meet' ? Number(meetId) : undefined,
            unlinkedOnly
          },
          previewOnly: isPreview
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to seed historical backfill');
      }
      setPreviewResult(data);
      if (!isPreview) {
        onEnqueued();
      }
    } catch (err: any) {
      setError(err?.message || 'Request failed');
    } finally {
      setLoadingPreview(false);
      setEnqueuing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="card-primary border border-app-primary rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-app-primary flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-app-primary">
                Historical Cross-Federation Backfill Orchestrator
              </h3>
              <p className="text-[11px] text-app-muted">
                Seed evaluation tasks into <code className="text-indigo-400">athlete_linking_evaluations</code> by governing body, competition year, or meet ID.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-app-muted hover:text-app-primary hover:bg-app-hover transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Source Federation */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-app-primary">
              1. Source Governing Body / Platform
            </label>
            <select
              value={sourceFederation}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-app-secondary border border-app-primary text-app-primary focus:outline-none focus:border-indigo-500"
            >
              {FEDERATION_OPTIONS.map((fed) => (
                <option key={fed.code} value={fed.code}>
                  {fed.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Target Federations */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-app-primary">
              2. Target Governing Bodies / Platforms to Evaluate Against
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEDERATION_OPTIONS.filter((f) => f.code !== sourceFederation).map((fed) => {
                const checked = targetFederations.includes(fed.code);
                return (
                  <label
                    key={fed.code}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition select-none ${
                      checked
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-app-primary'
                        : 'bg-white/[0.02] border-app-primary text-app-secondary hover:bg-white/[0.04]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTargetFed(fed.code)}
                      className="rounded border-app-primary bg-app-secondary text-indigo-600 focus:ring-0"
                    />
                    <span className="font-medium leading-snug">{fed.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 3. Scope Filter */}
          <div className="space-y-2">
            <label className="block font-semibold text-app-primary">
              3. Athlete Cohort Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'year', label: 'By Competition Year' },
                { id: 'meet', label: 'By Specific Meet / Event ID' },
                { id: 'full', label: 'Full Federation Corpus' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setScopeMode(opt.id as 'year' | 'meet' | 'full');
                    setPreviewResult(null);
                  }}
                  className={`py-2 px-3 rounded-xl border text-center font-semibold transition ${
                    scopeMode === opt.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                      : 'bg-white/[0.02] border-app-primary text-app-secondary hover:text-app-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scopeMode === 'year' && (
              <div className="pt-1">
                <label className="block text-[11px] text-app-muted mb-1">
                  Competition Calendar Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setPreviewResult(null);
                  }}
                  placeholder="e.g. 2026"
                  className="w-48 px-3 py-1.5 rounded-lg bg-app-secondary border border-app-primary text-app-primary focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {scopeMode === 'meet' && (
              <div className="pt-1">
                <label className="block text-[11px] text-app-muted mb-1">
                  {sourceFederation === 'IWF'
                    ? 'Official IWF Event ID or Database Meet ID (iwf_meets.db_meet_id)'
                    : `Database Meet ID (${sourceFederation.toLowerCase()}_meets.meet_id)`}
                </label>
                <input
                  type="number"
                  value={meetId}
                  onChange={(e) => {
                    setMeetId(e.target.value);
                    setPreviewResult(null);
                  }}
                  placeholder="e.g. 656"
                  className="w-56 px-3 py-1.5 rounded-lg bg-app-secondary border border-app-primary text-app-primary focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* 4. Unlinked Only Toggle */}
          <label className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(e) => {
                setUnlinkedOnly(e.target.checked);
                setPreviewResult(null);
              }}
              className="mt-0.5 rounded border-app-primary bg-app-secondary text-indigo-600 focus:ring-0"
            />
            <div>
              <span className="font-semibold text-app-primary block">
                Exclude athletes already linked in <code className="text-indigo-400">athlete_aliases</code>
              </span>
              <span className="text-[11px] text-app-muted">
                Skips athletes who already have an established pairwise identity edge for the selected target governing body.
              </span>
            </div>
          </label>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview / Execution Result Box */}
          {previewResult && (
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-app-primary flex items-center gap-1.5">
                  {previewResult.previewOnly ? (
                    <>
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>Backfill Cohort Preview</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">
                        Enqueued {previewResult.enqueuedCount.toLocaleString()} Evaluation Task(s)
                      </span>
                    </>
                  )}
                </span>
                <span className="text-[11px] text-app-muted">
                  Distinct Source Athletes Found: <strong className="text-app-primary">{previewResult.sourceAthletesFound.toLocaleString()}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {previewResult.breakdownByTarget.map((b) => (
                  <div
                    key={b.targetFederation}
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-app-primary">
                      <span>{sourceFederation} → {b.targetFederation}</span>
                      <span className="text-indigo-400">+{b.newTasksCount.toLocaleString()} New Tasks</span>
                    </div>
                    <div className="text-[10px] text-app-muted flex items-center justify-between">
                      <span>Already Linked Skipped: {b.alreadyLinkedSkipped.toLocaleString()}</span>
                      <span>Already Queued/Vetted: {b.alreadyEvaluatedSkipped.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-app-primary bg-white/[0.02] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-xs text-app-secondary hover:text-app-primary transition"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => executeSeedRequest(true)}
              disabled={loadingPreview || enqueuing}
              className="px-3.5 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-semibold text-indigo-300 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loadingPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Calculate Preview Count</span>
            </button>

            <button
              type="button"
              onClick={() => executeSeedRequest(false)}
              disabled={enqueuing || loadingPreview || (previewResult !== null && previewResult.tasksToEnqueueCount === 0)}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
            >
              {enqueuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>
                {previewResult
                  ? `Enqueue ${previewResult.tasksToEnqueueCount.toLocaleString()} Task(s)`
                  : 'Enqueue Tasks'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

