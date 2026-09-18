'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Calendar,
  MapPin,
  Users,
  ShieldAlert,
  Database,
  RefreshCw,
  Zap,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle,
  FileArchive,
  ArrowRight
} from 'lucide-react';

export interface ChecklistStep {
  id: 'compress' | 'bulk_insert' | 'confirmation';
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  recordedMs?: number;
}

export interface ImportSummary {
  meet_id?: number;
  meet_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  organizer?: string | null;
  status?: string;
  parent_meet_id?: number | null;
  revision_notes?: string | null;
  lifters_created?: number;
  lifters_reused?: number;
  total_results_imported?: number;
  athletes_found?: number;
  teams_found?: number;
  dryRun?: boolean;
  raw_storage_path?: string | null;
  raw_storage_bytes?: number | null;
  compression_ratio?: string | null;
  raw_payload_bytes?: number | null;
  compressed_bytes?: number | null;
  timings?: {
    compression_and_storage_ms: number;
    bulk_insert_ms: number;
    total_ms: number;
  };
  isExactDuplicate?: boolean;
  isRevision?: boolean;
  skipped?: boolean;
}

export interface BatchItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  parsedData?: any;
  parseError?: string;
  meetName: string;
  startDate: string | null;
  endDate: string | null;
  city: string | null;
  country: string | null;
  athleteCount: number;
  clubCount: number;
  formatVersion: string;
  status: 'queued' | 'active' | 'completed' | 'staged_revision' | 'exact_duplicate' | 'error';
  errorMessage?: string;
  result?: ImportSummary;
  steps: ChecklistStep[];
  isExpanded?: boolean;
}

const CREATE_INITIAL_STEPS = (): ChecklistStep[] => [
  {
    id: 'compress',
    title: 'Backup Raw File',
    description: 'Save a compressed backup copy of the original meet file',
    status: 'pending'
  },
  {
    id: 'bulk_insert',
    title: 'Import Meet Results',
    description: 'Add athletes, club teams, and competition lifts to the system',
    status: 'pending'
  },
  {
    id: 'confirmation',
    title: 'Verify & Complete',
    description: 'Confirm all records were saved successfully',
    status: 'pending'
  }
];

const INITIAL_STEPS: ChecklistStep[] = CREATE_INITIAL_STEPS();

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

function normalizeRawDate(rawDate: any): string | null {
  if (!rawDate) return null;
  if (Array.isArray(rawDate) && rawDate.length >= 3) {
    const y = rawDate[0];
    const m = String(rawDate[1]).padStart(2, '0');
    const d = String(rawDate[2]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  return null;
}

export function OwlcmsUploader() {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [hasCompletedBatch, setHasCompletedBatch] = useState(false);
  const [batchStartTime, setBatchStartTime] = useState<number | null>(null);
  const [batchElapsedMs, setBatchElapsedMs] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    setGlobalError(null);
    setHasCompletedBatch(false);
    const validJsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'));

    if (validJsonFiles.length === 0) {
      setGlobalError('No valid .json files selected. Please select OWLCMS JSON exports.');
      return;
    }

    // Process each file and construct queue items
    validJsonFiles.forEach((file) => {
      const itemId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const rawText = event.target?.result as string;
          const json = JSON.parse(rawText);

          const comp = json.competition || {};
          const meetName = (
            comp.competitionName ||
            comp.name ||
            json.competitionName ||
            file.name.replace(/\.json$/i, '')
          ).trim();

          const startDate = normalizeRawDate(
            comp.competitionDate || comp.localizedCompetitionDate || json.startDate
          );
          const endDate = normalizeRawDate(
            comp.competitionEndDate || comp.competitionDate || json.endDate
          );
          const city = comp.competitionCity || json.city || null;
          const country = comp.competitionSite || comp.country || json.country || null;
          const athletes = json.athletes || json.competitors || [];
          const teams = json.teams || [];
          const formatVersion = (json.formatVersion || json.version || '1.0').toString();

          const newItem: BatchItem = {
            id: itemId,
            file,
            fileName: file.name,
            fileSize: file.size,
            parsedData: json,
            meetName,
            startDate,
            endDate,
            city,
            country,
            athleteCount: athletes.length,
            clubCount: teams.length,
            formatVersion,
            status: 'queued',
            steps: CREATE_INITIAL_STEPS(),
            isExpanded: false
          };

          setQueue((prev) => [...prev, newItem]);
        } catch (err: any) {
          const failedItem: BatchItem = {
            id: itemId,
            file,
            fileName: file.name,
            fileSize: file.size,
            parseError: err.message,
            meetName: file.name,
            startDate: null,
            endDate: null,
            city: null,
            country: null,
            athleteCount: 0,
            clubCount: 0,
            formatVersion: 'Unknown',
            status: 'error',
            errorMessage: `Invalid JSON: ${err.message}`,
            steps: CREATE_INITIAL_STEPS(),
            isExpanded: false
          };
          setQueue((prev) => [...prev, failedItem]);
        }
      };

      reader.readAsText(file);
    });
  };

  const removeQueueItem = (id: string) => {
    if (isProcessing) return;
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleItemExpanded = (id: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isExpanded: !item.isExpanded } : item))
    );
  };

  const clearQueue = () => {
    if (isProcessing) return;
    setQueue([]);
    setHasCompletedBatch(false);
    setGlobalError(null);
    setBatchStartTime(null);
    setBatchElapsedMs(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeQueue = async (items: BatchItem[], isDryRunMode: boolean) => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setGlobalError(null);
    const startMs = performance.now();
    setBatchStartTime(startMs);

    for (let i = 0; i < items.length; i++) {
      const currentItem = items[i];

      // Skip items that had a parse error or were already processed
      if (currentItem.status !== 'queued') continue;

      // Update current item to active with Step 1 running
      setQueue((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? {
                ...item,
                status: 'active',
                steps: [
                  { ...item.steps[0], status: 'in_progress' },
                  item.steps[1],
                  item.steps[2]
                ]
              }
            : item
        )
      );

      try {
        const res = await fetch('/api/owlcms/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: currentItem.fileName,
            dryRun: isDryRunMode,
            payload: currentItem.parsedData,
            batchMode: true
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === currentItem.id
                ? {
                    ...item,
                    status: 'error',
                    errorMessage: data.error || 'Ingestion failed',
                    steps: item.steps.map((s) =>
                      s.status === 'in_progress' ? { ...s, status: 'error' } : s
                    )
                  }
                : item
            )
          );
          continue;
        }

        // Determine terminal status based on payload response
        let finalStatus: BatchItem['status'] = 'completed';
        if (data.isExactDuplicate || data.skipped) {
          finalStatus = 'exact_duplicate';
        } else if (data.status === 'pending_review' || data.isRevision) {
          finalStatus = 'staged_revision';
        }

        const timings = data.timings || {
          compression_and_storage_ms: 0,
          bulk_insert_ms: 0,
          total_ms: 0
        };

        const completedSteps: ChecklistStep[] = [
          {
            ...currentItem.steps[0],
            status: 'completed',
            recordedMs: timings.compression_and_storage_ms
          },
          {
            ...currentItem.steps[1],
            status: 'completed',
            recordedMs: timings.bulk_insert_ms
          },
          {
            ...currentItem.steps[2],
            status: 'completed',
            recordedMs: timings.total_ms
          }
        ];

        setQueue((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  status: finalStatus,
                  result: data,
                  steps: completedSteps
                }
              : item
          )
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((item) =>
            item.id === currentItem.id
              ? {
                  ...item,
                  status: 'error',
                  errorMessage: err.message || 'Network error during ingestion',
                  steps: item.steps.map((s) =>
                    s.status === 'in_progress' ? { ...s, status: 'error' } : s
                  )
                }
              : item
          )
        );
      }
    }

    const elapsed = Math.round(performance.now() - startMs);
    setBatchElapsedMs(elapsed);
    setIsProcessing(false);
    setHasCompletedBatch(true);
  };

  const handleRunClick = () => {
    if (queue.length === 0 || isProcessing) return;

    const hasQueued = queue.some((i) => i.status === 'queued');
    if (hasQueued) {
      executeQueue(queue, dryRun);
      return;
    }

    // If all items already finished a prior run, re-run with current dryRun toggle
    const reQueued = queue.map((item) => {
      if (item.parseError) return item;
      return {
        ...item,
        status: 'queued' as const,
        result: undefined,
        errorMessage: undefined,
        steps: CREATE_INITIAL_STEPS()
      };
    });
    setQueue(reQueued);
    executeQueue(reQueued, dryRun);
  };

  // Queue aggregations
  const totalCount = queue.length;
  const queuedCount = queue.filter((i) => i.status === 'queued').length;
  const completedCount = queue.filter((i) => i.status === 'completed').length;
  const stagedCount = queue.filter((i) => i.status === 'staged_revision').length;
  const duplicateCount = queue.filter((i) => i.status === 'exact_duplicate').length;
  const errorCount = queue.filter((i) => i.status === 'error').length;
  const processedCount = completedCount + stagedCount + duplicateCount + errorCount;
  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  return (
    <div className="w-full p-6 sm:p-8 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl text-slate-100">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <Database className="w-3.5 h-3.5" />
          Competition Importer
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Multi-File Competition Importer
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-xl mx-auto">
          Upload one or more OWLCMS competition files (.json). Files are checked for duplicates and imported into the system.
        </p>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold text-rose-200">Import Alert:</span> {globalError}
          </div>
        </div>
      )}

      {/* 1. Fixed File Area (Exact same height and frame before and after files are added) */}
      <div className="h-44 mb-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-3 overflow-hidden flex flex-col justify-between">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json,application/json"
          onChange={handleFileInput}
          className="hidden"
        />

        {queue.length === 0 ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
              dragActive
                ? 'border-sky-400 bg-sky-500/10'
                : 'border-slate-700/80 hover:border-slate-500 hover:bg-slate-900/40'
            }`}
          >
            <UploadCloud className="w-7 h-7 text-sky-400 mb-2" />
            <span className="text-sm font-semibold text-slate-200">
              Drag and drop OWLCMS JSON files here
            </span>
            <span className="text-xs text-slate-400 mt-0.5">or click to browse files</span>
            <span className="text-[11px] text-slate-500 mt-1.5">
              Supports OWLCMS v1.0 legacy exports &amp; modern v2.0+ exports
            </span>
          </div>
        ) : (
          <div className="h-full flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-400" />
                {queue.length} {queue.length === 1 ? 'file loaded' : 'files loaded'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="text-xs text-sky-400 hover:text-sky-300 transition"
                >
                  + Add More
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={clearQueue}
                  disabled={isProcessing}
                  className="text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-1.5 space-y-1.5 pr-1 text-xs">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-200 truncate">{item.meetName}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 flex-shrink-0">
                      v{item.formatVersion}
                    </span>
                    {item.athleteCount > 0 && (
                      <span className="text-[11px] text-slate-400 hidden sm:inline flex-shrink-0">
                        ({item.athleteCount} athletes)
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-mono flex-shrink-0 ${
                      item.status === 'completed'
                        ? 'text-emerald-400 font-medium'
                        : item.status === 'active'
                        ? 'text-sky-400 font-medium'
                        : item.status === 'staged_revision'
                        ? 'text-amber-400'
                        : item.status === 'exact_duplicate'
                        ? 'text-slate-400'
                        : item.status === 'error'
                        ? 'text-rose-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {item.status === 'completed'
                      ? '✓ Imported'
                      : item.status === 'active'
                      ? 'Importing...'
                      : item.status === 'staged_revision'
                      ? 'Held for Review'
                      : item.status === 'exact_duplicate'
                      ? 'Already in Database (Skipped)'
                      : item.status === 'error'
                      ? 'Failed'
                      : 'Queued'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Permanent 3-Stage Pipeline Checklist (Always on screen from start to finish) */}
      <div className="p-4 mb-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            Import Steps
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {isProcessing
              ? `Processing file ${processedCount + 1} of ${totalCount}...`
              : hasCompletedBatch
              ? `Completed • ${batchElapsedMs ? (batchElapsedMs / 1000).toFixed(2) + 's total' : ''}`
              : queue.length > 0
              ? 'Ready to Ingest'
              : 'Awaiting Files'}
          </span>
        </div>

        <div className="space-y-2">
          {INITIAL_STEPS.map((step, idx) => {
            const activeItem = queue.find((i) => i.status === 'active') || queue[0];
            const currentStep = activeItem?.steps[idx] || step;
            const sComplete = currentStep.status === 'completed';
            const sInProg = currentStep.status === 'in_progress';
            const sErr = currentStep.status === 'error';

            return (
              <div
                key={step.id}
                className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                  sComplete
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : sInProg
                    ? 'bg-sky-950/30 border-sky-500/40 text-sky-200'
                    : sErr
                    ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                    : 'bg-slate-900/30 border-slate-800/80 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {sComplete && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  {sInProg && <Loader2 className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />}
                  {sErr && <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                  {currentStep.status === 'pending' && <Clock className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                  <span className="font-semibold text-slate-200">{step.title}</span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">— {step.description}</span>
                </div>
                <span className="text-[11px] font-mono font-semibold flex-shrink-0">
                  {sComplete ? `✓ ${formatDuration(currentStep.recordedMs)}` : sInProg ? 'Running...' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Permanent Action Controls Bar (Fixed at bottom) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={isProcessing}
            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 bg-slate-900 border-slate-700"
          />
          <div>
            <span className="text-xs font-semibold text-slate-200">Dry Run (Test Mode)</span>
            <p className="text-[11px] text-slate-400">
              Test the files and check for duplicates without saving anything to the database.
            </p>
          </div>
        </label>

        <button
          onClick={handleRunClick}
          disabled={isProcessing || queue.length === 0}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-6 font-semibold text-sm rounded-xl shadow-lg transition-all ${
            queue.length === 0
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : dryRun
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 text-white'
              : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Queue...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>
                {queue.length === 0
                  ? 'Drop JSON Files to Begin'
                  : dryRun
                  ? `Test Import (${queue.length} ${queue.length === 1 ? 'meet' : 'meets'})`
                  : `Import ${queue.length} ${queue.length === 1 ? 'Meet' : 'Meets'}`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default OwlcmsUploader;
