"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { HistoricalBackfillDialog } from './HistoricalBackfillDialog';

interface TargetFederationSummary {
  federationId: string;
  shortCode: string;
  canonicalName: string;
  pendingCount: number;
  reviewNeededCount: number;
  matchedCount?: number;
}

interface QueueStatusData {
  totalPending: number;
  totalReviewNeeded: number;
  totalMatched: number;
  totalIsolated: number;
  byTargetFederation: TargetFederationSummary[];
}

interface DrainSummary {
  evaluationsProcessed: number;
  matchedCount: number;
  reviewNeededCount: number;
  isolatedCount: number;
  isDryRun: boolean;
  isReEvaluate?: boolean;
  executionTimeMs: number;
}

interface PipelineHealthOverviewProps {
  onQueueChanged?: () => void;
}

export function PipelineHealthOverview({ onQueueChanged }: PipelineHealthOverviewProps) {
  const [statusData, setStatusData] = useState<QueueStatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Worker Drain Controls
  const [batchLimit, setBatchLimit] = useState<number>(100);
  const [sourceFed, setSourceFed] = useState<string>('ALL');
  const [targetFed, setTargetFed] = useState<string>('ALL');
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [reEvaluate, setReEvaluate] = useState<boolean>(false);

  const [isDraining, setIsDraining] = useState<boolean>(false);
  const [drainResult, setDrainResult] = useState<{
    summary: DrainSummary;
    logs: string;
  } | null>(null);
  const [drainError, setDrainError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [isBackfillOpen, setIsBackfillOpen] = useState<boolean>(false);

  const fetchQueueStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/admin/pipeline/queue-status');
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      }
    } catch {
      // Ignore background status error
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchQueueStatus();
  }, [fetchQueueStatus]);

  const handleDrainBatch = async () => {
    setIsDraining(true);
    setDrainError(null);
    try {
      const res = await fetch('/api/admin/pipeline/drain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: batchLimit,
          dryRun,
          sourceFed: sourceFed === 'ALL' ? undefined : sourceFed,
          targetFed: targetFed === 'ALL' ? undefined : targetFed,
          reEvaluate
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Evaluator worker execution failed');
      }
      setDrainResult({
        summary: data.summary,
        logs: data.logs || ''
      });
      await fetchQueueStatus();
      if (onQueueChanged) onQueueChanged();
    } catch (err: any) {
      setDrainError(err?.message || 'Failed to drain queue');
    } finally {
      setIsDraining(false);
    }
  };

  const handleCopyLogs = async () => {
    if (!drainResult?.logs) return;
    try {
      await navigator.clipboard.writeText(drainResult.logs);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="card-primary p-5 space-y-4 border-l-2 border-l-indigo-500">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-app-primary flex items-center gap-2">
            <span>Cross-Federation Evaluation Queue &amp; Worker Telemetry</span>
            <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.03] border border-white/5 text-indigo-400">
              athlete_linking_evaluations
            </code>
          </h4>
          <p className="text-xs text-app-secondary mt-0.5">
            Decoupled evaluation ledger enforcing universal demographic anchoring <code className="text-app-primary">(gender, birth_year)</code> across USAW, IWF, and OWLCMS.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsBackfillOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>Seed Historical Backfill</span>
          </button>

          <button
            type="button"
            onClick={fetchQueueStatus}
            disabled={loadingStatus}
            className="p-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-app-primary transition disabled:opacity-50"
            title="Refresh Queue Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Core Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">
            Pending Tasks
          </div>
          <div className="text-2xl font-bold text-sky-400">
            {statusData ? statusData.totalPending.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-app-muted">
            Queued for cross-federation evaluation (<code className="text-sky-400">PENDING</code>)
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">
            Needs Review (60–79%)
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {statusData ? statusData.totalReviewNeeded.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-app-muted">
            Staged for human verification (<code className="text-amber-400">REVIEW_NEEDED</code>)
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">
            Matches Established (≥80%)
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {statusData ? statusData.totalMatched.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-app-muted">
            Linked in <code className="text-emerald-400">athlete_aliases</code> (<code className="text-emerald-400">MATCHED</code>)
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-[11px] font-semibold text-app-muted uppercase tracking-wider">
            Vetted Isolated (&lt;60%)
          </div>
          <div className="text-2xl font-bold text-app-primary">
            {statusData ? statusData.totalIsolated.toLocaleString() : '—'}
          </div>
          <div className="text-[10px] text-app-muted">
            Vetted with no peer match (<code className="text-app-secondary">VETTED_ISOLATED</code>)
          </div>
        </div>
      </div>

      {/* Per-Target Governing Body Breakdown */}
      {statusData && statusData.byTargetFederation.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {statusData.byTargetFederation.map((fed) => (
            <div
              key={fed.federationId}
              className="p-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between gap-2"
            >
              <div>
                <span className="font-bold text-app-primary block">{fed.canonicalName} ({fed.shortCode})</span>
                <span className="text-[10px] text-app-muted">Target Evaluation Pool</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {fed.pendingCount.toLocaleString()} Pending
                </span>
                {fed.reviewNeededCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {fed.reviewNeededCount.toLocaleString()} Review
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Queue Drain Controls Bar */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-semibold text-app-muted">Batch Size:</label>
            <select
              value={batchLimit}
              onChange={(e) => setBatchLimit(Number(e.target.value))}
              className="px-2.5 py-1 rounded-lg bg-app-secondary border border-app-primary text-app-primary text-xs focus:outline-none focus:border-indigo-500"
            >
              {[25, 50, 100, 250, 500].map((sz) => (
                <option key={sz} value={sz}>
                  {sz} Tasks
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-semibold text-app-muted">Source:</label>
            <select
              value={sourceFed}
              onChange={(e) => setSourceFed(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-app-secondary border border-app-primary text-app-primary text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Federations</option>
              <option value="IWF">IWF</option>
              <option value="USAW">USAW</option>
              <option value="OWLCMS">OWLCMS</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-semibold text-app-muted">Target:</label>
            <select
              value={targetFed}
              onChange={(e) => setTargetFed(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-app-secondary border border-app-primary text-app-primary text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Federations</option>
              <option value="USAW">USAW</option>
              <option value="IWF">IWF</option>
              <option value="OWLCMS">OWLCMS</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded border-app-primary bg-app-secondary text-amber-500 focus:ring-0"
            />
            <span className="text-app-secondary font-medium">Dry-Run Simulation</span>
          </label>

          <label
            className="flex items-center gap-1.5 cursor-pointer select-none"
            title="Re-evaluate non-blacklisted VETTED_ISOLATED and REVIEW_NEEDED records"
          >
            <input
              type="checkbox"
              checked={reEvaluate}
              onChange={(e) => setReEvaluate(e.target.checked)}
              className="rounded border-app-primary bg-app-secondary text-indigo-500 focus:ring-0"
            />
            <span className="text-app-secondary font-medium">Include Re-Evaluation</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleDrainBatch}
          disabled={isDraining}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition flex items-center gap-1.5 shadow disabled:opacity-50 self-start lg:self-auto ${
            dryRun
              ? 'bg-amber-600 hover:bg-amber-500'
              : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {isDraining ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span>
            {isDraining
              ? 'Running Evaluator Worker...'
              : dryRun
                ? `Simulate Batch (${batchLimit})`
                : `Process Batch (${batchLimit})`}
          </span>
        </button>
      </div>

      {/* Drain Error Notice */}
      {drainError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{drainError}</span>
        </div>
      )}

      {/* Last Worker Execution Summary */}
      {drainResult && (
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-app-primary">
                Worker Batch Complete ({drainResult.summary.executionTimeMs} ms)
              </span>
              {drainResult.summary.isDryRun && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DRY RUN (0 Database Writes)
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/[0.04] text-app-secondary border border-white/5">
                Processed: {drainResult.summary.evaluationsProcessed}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                +{drainResult.summary.matchedCount} Matched
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                +{drainResult.summary.reviewNeededCount} Needs Review
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/[0.04] text-app-muted border border-white/5">
                {drainResult.summary.isolatedCount} Isolated
              </span>
            </div>

            {drainResult.logs && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="px-2.5 py-1 rounded-lg bg-app-secondary hover:bg-app-hover border border-app-primary text-[11px] text-app-secondary hover:text-app-primary transition flex items-center gap-1"
                >
                  {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLogs ? 'Copied!' : 'Copy Log'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogs((prev) => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-app-secondary hover:bg-app-hover border border-app-primary text-[11px] text-app-secondary hover:text-app-primary transition flex items-center gap-1"
                >
                  <Terminal className="w-3 h-3 text-indigo-400" />
                  <span>{showLogs ? 'Hide Console Output' : 'View Console Output'}</span>
                  {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          {showLogs && drainResult.logs && (
            <pre className="p-3 rounded-xl bg-black/50 border border-white/5 text-[11px] font-mono text-app-secondary overflow-x-auto max-h-64 select-text cursor-text whitespace-pre-wrap">
              {drainResult.logs}
            </pre>
          )}
        </div>
      )}

      <HistoricalBackfillDialog
        isOpen={isBackfillOpen}
        onClose={() => setIsBackfillOpen(false)}
        onEnqueued={() => {
          fetchQueueStatus();
          if (onQueueChanged) onQueueChanged();
        }}
      />
    </div>
  );
}

