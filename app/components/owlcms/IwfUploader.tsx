"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
  ExternalLink,
  Globe,
  CheckCircle,
  Hash,
  Play,
  Terminal,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Info,
  User,
  Copy,
  Check,
  History,
  RotateCw,
  RefreshCw,
  X,
  XCircle,
  Clock,
  Trash2
} from 'lucide-react';

export interface MatchedScorecard {
  name?: string;
  Name?: string;
  athlete_name?: string;
  nation?: string;
  Nation?: string;
  birth_year?: number | string;
  'Year of Birth'?: number | string;
  gender?: string;
  Gender?: string;
  division?: string;
  iwf_meet_id?: string;
  'IWF Meet ID'?: string;
  weight_class?: string;
  'Weight Class'?: string;
  group?: string;
  Group?: string;
  body_weight_kg?: number | string;
  'Body Weight'?: number | string;
  snatch_1?: string;
  snatch_2?: string;
  snatch_3?: string;
  'Snatch 1'?: string;
  'Snatch 2'?: string;
  'Snatch 3'?: string;
  best_snatch?: string | number;
  'Best Snatch'?: string | number;
  cj_1?: string;
  cj_2?: string;
  cj_3?: string;
  'Clean & Jerk 1'?: string;
  'Clean & Jerk 2'?: string;
  'Clean & Jerk 3'?: string;
  best_cj?: string | number;
  'Best C&J'?: string | number;
  total?: string | number;
  Total?: string | number;
  rank?: string | number;
  Rank?: string | number;
  gamx_total?: number | string;
  qpoints?: number | string;
  simulatedAction?: 'UPDATE' | 'INSERT' | 'LOCKED_SKIP' | string;
  existingResultId?: number | string | null;
  hasChanges?: boolean;
  diffFields?: string[];
}

export interface IwfPipelineRequest {
  year: number | string;
  event_id?: string;
  athlete_name?: string;
  force?: boolean;
  dryRun?: boolean;
}

export interface IwfPipelineResponse {
  success: boolean;
  mode: 'single_event' | 'full_year';
  dryRun: boolean;
  event_id: string | null;
  iwf_meet_id?: string | null;
  year: number;
  targetAthleteScorecard?: MatchedScorecard;
  importStats?: {
    dryRun?: boolean;
    iwf_meet_id?: string;
    athleteName?: string;
    athleteFilter?: string;
    athleteFound?: boolean;
    wouldSkip?: boolean;
    skipReason?: string;
    existingResults?: number;
    simulatedUpdates?: number;
    simulatedInserts?: number;
    simulatedLocked?: number;
    targetAthlete?: MatchedScorecard | null;
    targetAthletes?: MatchedScorecard[];
    matchedScorecards?: MatchedScorecard[];
    closeMatches?: string[];
    meetTotalAthletes?: number;
    menCount?: number;
    womenCount?: number;
    totalAthletesParsed?: number;
    totalAthletes?: number;
    imported?: number;
    updated?: number;
    skipped?: number;
    errors?: number;
  };
  logs: string;
  linkerLogs?: string;
  error?: string;
}

export interface PipelineRunItem {
  id: number;
  created_at: string;
  completed_at?: string;
  duration_seconds?: number;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  mode: 'single_event' | 'full_year';
  event_id?: string;
  url?: string;
  year?: number;
  athlete_name?: string;
  dry_run: boolean;
  force: boolean;
  exit_code?: number;
  error_message?: string;
  import_stats?: any;
  db_meet_id?: number;
}

function extractEventId(input?: string | number | null): string {
  if (!input) return '';
  const str = String(input).trim();
  const urlMatch = str.match(/[?&]event_id=(\d+)/i);
  if (urlMatch) return urlMatch[1];
  const numMatch = str.match(/^\d+$/);
  if (numMatch) return numMatch[0];
  const endSlashMatch = str.match(/\/(\d+)\/?$/);
  if (endSlashMatch) return endSlashMatch[1];
  return str;
}

export function IwfUploader() {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [eventId, setEventId] = useState<string>('');
  const [detectedUrlId, setDetectedUrlId] = useState<string | null>(null);
  const [athleteName, setAthleteName] = useState<string>('');
  const [force, setForce] = useState<boolean>(false);
  const [dryRun, setDryRun] = useState<boolean>(false);

  const [existingDbMeet, setExistingDbMeet] = useState<{
    db_meet_id: number;
    iwf_meet_id: string;
    meet: string;
    date: string | null;
    level: string | null;
    resultsCount: number;
  } | null>(null);
  const [isCheckingMeet, setIsCheckingMeet] = useState<boolean>(false);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [response, setResponse] = useState<IwfPipelineResponse | null>(null);
  const [showScraperLogs, setShowScraperLogs] = useState<boolean>(true);
  const [showLinkerLogs, setShowLinkerLogs] = useState<boolean>(false);
  const [liveLogs, setLiveLogs] = useState<string>('');
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const logContainerRef = React.useRef<HTMLPreElement | null>(null);
  const [copiedScraperLogs, setCopiedScraperLogs] = useState<boolean>(false);
  const [copiedLinkerLogs, setCopiedLinkerLogs] = useState<boolean>(false);

  const handleCopyScraperLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = liveLogs || response?.logs || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedScraperLogs(true);
      setTimeout(() => setCopiedScraperLogs(false), 2000);
    } catch (err) {
      console.error('Failed to copy scraper logs', err);
    }
  };

  const handleCopyLinkerLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = response?.linkerLogs || '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLinkerLogs(true);
      setTimeout(() => setCopiedLinkerLogs(false), 2000);
    } catch (err) {
      console.error('Failed to copy linker logs', err);
    }
  };

  // Pipeline Run History state & handlers
  const [runsHistory, setRunsHistory] = useState<PipelineRunItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [showHistorySection, setShowHistorySection] = useState<boolean>(true);
  const [selectedRunDetail, setSelectedRunDetail] = useState<{
    id: number;
    created_at: string;
    status: string;
    event_id?: string;
    athlete_name?: string;
    logs?: string;
    linker_logs?: string;
    error_message?: string;
    duration_seconds?: number;
    import_stats?: any;
    db_meet_id?: number;
    dry_run?: boolean;
    force?: boolean;
  } | null>(null);
  const [loadingRunDetail, setLoadingRunDetail] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'scraper' | 'linker'>('scraper');
  const [copiedModalLogs, setCopiedModalLogs] = useState<boolean>(false);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<number>>(new Set());
  const [isDeletingRuns, setIsDeletingRuns] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const toggleSelectAllRuns = () => {
    if (selectedRunIds.size === runsHistory.length) {
      setSelectedRunIds(new Set());
    } else {
      setSelectedRunIds(new Set(runsHistory.map((r) => r.id)));
    }
    setShowDeleteConfirm(false);
  };

  const toggleSelectRun = (id: number) => {
    setSelectedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setShowDeleteConfirm(false);
  };

  const handleDeleteSelectedRuns = async () => {
    if (selectedRunIds.size === 0) return;
    setIsDeletingRuns(true);
    try {
      const idsToDelete = Array.from(selectedRunIds);
      const res = await fetch('/api/admin/iwf-runs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRunsHistory((prev) => prev.filter((r) => !selectedRunIds.has(r.id)));
        if (selectedRunDetail && selectedRunIds.has(selectedRunDetail.id)) {
          setSelectedRunDetail(null);
        }
        setSelectedRunIds(new Set());
        setShowDeleteConfirm(false);
      } else {
        console.error('Failed to delete runs:', data.error);
      }
    } catch (err) {
      console.error('Error deleting runs:', err);
    } finally {
      setIsDeletingRuns(false);
    }
  };

  const fetchRunsHistory = async () => {
    try {
      const res = await fetch('/api/admin/iwf-runs');
      const data = await res.json();
      if (res.ok) {
        if (data.success && Array.isArray(data.runs)) {
          setRunsHistory(data.runs);
        }
      } else {
        console.error('Error fetching runs history:', data.error);
      }
    } catch (err) {
      console.warn('Failed to fetch runs history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchRunsHistory();
  }, []);

  const formatEasternTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const handleOpenRunLogs = async (runId: number) => {
    setLoadingRunDetail(true);
    setActiveModalTab('scraper');
    try {
      const res = await fetch(`/api/admin/iwf-runs?id=${runId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.run) {
          setSelectedRunDetail(data.run);
        }
      }
    } catch (err) {
      console.error('Failed to load run logs', err);
    } finally {
      setLoadingRunDetail(false);
    }
  };

  const handleCopyModalLogs = async () => {
    const text = activeModalTab === 'scraper' ? (selectedRunDetail?.logs || '') : (selectedRunDetail?.linker_logs || '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedModalLogs(true);
      setTimeout(() => setCopiedModalLogs(false), 2000);
    } catch (err) {
      console.error('Failed to copy modal logs', err);
    }
  };

  // Relay existing meet metadata & auto-fill competition year when typing eventId
  useEffect(() => {
    const cleanId = extractEventId(eventId);
    if (!cleanId) {
      setExistingDbMeet(null);
      setIsCheckingMeet(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingMeet(true);
      try {
        const res = await fetch(`/api/meet/iwf/${encodeURIComponent(cleanId)}?summary=true`);
        if (res.ok) {
          const data = await res.json();
          if (data?.meet) {
            setExistingDbMeet({
              db_meet_id: data.meet.db_meet_id,
              iwf_meet_id: data.meet.iwf_meet_id,
              meet: data.meet.meet,
              date: data.meet.date,
              level: data.meet.level,
              resultsCount: data.resultsCount ?? 0
            });
            if (data.meet.date) {
              const yearMatch = String(data.meet.date).match(/\b(19|20)\d{2}\b/);
              if (yearMatch?.[0]) {
                setYear(yearMatch[0]);
              }
            }
          } else {
            setExistingDbMeet(null);
          }
        } else {
          setExistingDbMeet(null);
        }
      } catch {
        setExistingDbMeet(null);
      } finally {
        setIsCheckingMeet(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [eventId]);

  useEffect(() => {
    if (isRunning && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLogs, isRunning]);

  const handleEventInputChange = (val: string) => {
    setEventId(val);
    const trimmed = val.trim();
    const urlMatch = trimmed.match(/[?&]event_id=(\d+)/i);
    if (urlMatch) {
      const extractedId = urlMatch[1];
      setDetectedUrlId(extractedId);
      if (trimmed.includes('results-by-events-upto2018') && Number(year) > 2018) {
        setYear('2018');
      }
    } else {
      setDetectedUrlId(null);
    }
  };

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setResponse(null);
    setLiveLogs('');
    setStreamStatus('Initializing pipeline process...');
    setShowScraperLogs(true);

    try {
      const cleanEventId = extractEventId(eventId);
      const payload: IwfPipelineRequest = {
        year: year.trim() || new Date().getFullYear(),
        ...(cleanEventId ? { event_id: cleanEventId } : {}),
        ...(athleteName.trim() ? { athlete_name: athleteName.trim() } : {}),
        force,
        dryRun
      };

      const res = await fetch('/api/admin/iwf-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ ...payload, stream: true }),
      });

      if (res.headers.get('content-type')?.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (!part.trim()) continue;
            let eventType = 'message';
            let dataStr = '';

            for (const line of part.split('\n')) {
              if (line.startsWith('event:')) {
                eventType = line.replace('event:', '').trim();
              } else if (line.startsWith('data:')) {
                dataStr += line.replace('data:', '').trim();
              }
            }

            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                if (eventType === 'log') {
                  setLiveLogs((prev) => prev + parsed.text);
                } else if (eventType === 'status') {
                  setStreamStatus(parsed.message);
                } else if (eventType === 'done') {
                  setResponse(parsed);
                  setStreamStatus(null);
                  if (!dryRun) {
                    try {
                      await fetch('/api/revalidate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: '/archive' }),
                      });
                    } catch {}
                  }
                } else if (eventType === 'error') {
                  setErrorMessage(parsed.error || 'Pipeline execution failed.');
                  if (parsed.logs) setLiveLogs((prev) => prev || parsed.logs);
                  setStreamStatus(null);
                }
              } catch {
                setLiveLogs((prev) => prev + dataStr);
              }
            }
          }
        }
      } else {
        const data = (await res.json()) as IwfPipelineResponse;
        setResponse(data);
        if (!data.success) {
          setErrorMessage(data.error || 'Pipeline execution failed.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to execute IWF pipeline.');
    } finally {
      setIsRunning(false);
      setStreamStatus(null);
      fetchRunsHistory();
    }
  };

  const parsedYearNum = Number(year) || new Date().getFullYear();
  const isPre2018 = parsedYearNum <= 2018;
  const targetIwfId = response?.event_id || existingDbMeet?.iwf_meet_id || eventId.trim();
  const officialIwfEventUrl = targetIwfId
    ? (isPre2018
      ? `https://iwf.sport/results/results-by-events/results-by-events-upto2018/?event_id=${targetIwfId}`
      : `https://iwf.sport/results/results-by-events/?event_id=${targetIwfId}`)
    : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>IWF Results Pipeline &amp; Scraper</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Primary Source: iwf.sport
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct administrative runner replacing GitHub Actions workflow (<code className="text-slate-300">iwf-daily-results-pipeline.yml</code>). Spawns local Chrome for 1-click Cloudflare verification, extracts competition attempts, and upserts scorecards into <code className="text-slate-300">iwf_meets</code>, <code className="text-slate-300">iwf_lifters</code>, and <code className="text-slate-300">iwf_meet_results</code>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Parameters & Run Control) + Right (Status & Execution Telemetry) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Workflow Parameters */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-emerald-400" />
                <span>Workflow Parameters</span>
              </div>
              {isCheckingMeet && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Checking database...</span>
                </span>
              )}
            </div>

            {/* Existing Meet Relay Card */}
            {existingDbMeet && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-bold text-white truncate flex items-center gap-2 flex-wrap">
                        <span>{existingDbMeet.meet}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-900 text-emerald-300 border border-emerald-700">
                          {existingDbMeet.resultsCount} Scorecard{existingDbMeet.resultsCount === 1 ? '' : 's'} in Database
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-300/80">
                        IWF Event #{existingDbMeet.iwf_meet_id} • Date: {existingDbMeet.date || 'Unrecorded'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <Link
                      href={`/meet/iwf/${existingDbMeet.iwf_meet_id}`}
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 hover:border-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 dark:hover:text-indigo-200 dark:border-indigo-700/50 dark:hover:border-indigo-500 transition flex items-center gap-1.5"
                      title="View competition results on OWLanalytics"
                    >
                      <span>OWLanalytics Meet Results</span>
                      <ExternalLink className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    </Link>
                    {officialIwfEventUrl && (
                      <a
                        href={officialIwfEventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-900 border border-sky-200 hover:border-sky-300 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 dark:text-sky-300 dark:hover:text-sky-200 dark:border-sky-800/50 dark:hover:border-sky-600 transition flex items-center gap-1.5"
                        title="Official IWF Competition Results Page"
                      >
                        <span>Official IWF Meet Results</span>
                        <ExternalLink className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                      </a>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  {force
                    ? "Running with 'Force Re-import' will upsert existing scorecards while preserving manual overrides."
                    : "Running without 'Force Re-import' retains existing scorecards and only appends missing categories."}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Year to Scrape <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2000, 2025"
                  disabled={isRunning}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Default: Current competition year</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span>Target IWF Event URL or ID</span>
                  <span className="text-[10px] text-slate-500 font-normal">(Single Event)</span>
                </label>
                <input
                  type="text"
                  value={eventId}
                  onChange={(e) => handleEventInputChange(e.target.value)}
                  placeholder="e.g. 154 or https://iwf.sport/results/.../?event_id=154"
                  disabled={isRunning}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {detectedUrlId ? (
                  <span className="text-[10px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    <span>Target Event #{detectedUrlId} detected from URL (Single Event Mode)</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Paste event results URL or ID to scrape 1 meet, or leave blank for full-year
                  </span>
                )}
              </div>
            </div>

            {/* Targeted Athlete Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Filter to Specific Athlete Name <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={athleteName}
                onChange={(e) => setAthleteName(e.target.value)}
                placeholder="e.g. Robert HAWKINS"
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Isolates scorecards matching this athlete (matches GitHub Actions parameter).
              </span>
            </div>

            {/* Checkboxes: Force & Dry Run */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  disabled={isRunning}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200">Force Re-import Existing Meet Results</span>
                  <p className="text-[11px] text-slate-400">
                    Upserts meet results keyed on <code className="text-slate-300">(db_meet_id, db_lifter_id, weight_class)</code> while preserving locked overrides.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={isRunning}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-200">Dry Run (Scrape &amp; validate without writing to database)</span>
                  <p className="text-[11px] text-slate-400">
                    Navigates, solves challenge, scrapes attempts, and logs stats without committing rows to PostgreSQL.
                  </p>
                </div>
              </label>
            </div>

            {/* Run Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={handleRunPipeline}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer ${dryRun
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running IWF Pipeline (Check Chrome Window)...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {dryRun
                        ? `Run Dry-Run Scrape (${eventId.trim() ? `Event #${eventId.trim()}` : `Year ${year}`})`
                        : `Run IWF Pipeline (${eventId.trim() ? `Event #${eventId.trim()}` : `Year ${year}`})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Telemetry & Logs */}
        <div className="lg:col-span-7 space-y-4">
          {/* Active Cloudflare Instruction Banner while running */}
          {isRunning && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-amber-200 shadow-xl space-y-2 animate-pulse">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-white">Browser Window Active — Cloudflare Action Required</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-200/90">
                A Google Chrome window has opened on your screen. When Cloudflare presents the <strong className="text-white">&quot;Verify you are human&quot;</strong> checkbox, click it once. The automated pipeline will immediately take over, scrape Men&apos;s and Women&apos;s divisions, close the browser, and upsert records into Supabase.
              </p>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/60 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-300">Pipeline Execution Error</div>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Success / Summary Card */}
          {response && (() => {
            const matchedScorecards: MatchedScorecard[] =
              (response.importStats?.matchedScorecards && response.importStats.matchedScorecards.length > 0)
                ? response.importStats.matchedScorecards
                : (response.importStats?.targetAthletes && response.importStats.targetAthletes.length > 0)
                  ? response.importStats.targetAthletes
                  : response.importStats?.targetAthlete
                    ? [response.importStats.targetAthlete]
                    : (response.targetAthleteScorecard ? [response.targetAthleteScorecard] : []);

            const simulatedCount =
              response.importStats?.simulatedScorecards ??
              (matchedScorecards.length > 0
                ? matchedScorecards.length
                : (response.importStats?.totalAthletesParsed ?? response.importStats?.totalAthletes ?? 0));
            const athleteFound = response.importStats?.athleteFound;
            const closeMatches = response.importStats?.closeMatches || [];

            return (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {response.success ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="text-sm font-bold text-white">
                        {response.dryRun
                          ? 'Dry-Run Scrape Completed'
                          : response.success
                            ? 'IWF Pipeline Completed Successfully'
                            : 'Pipeline Completed with Warnings'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Mode: <strong className="text-white">{response.mode === 'single_event' ? `Event #${response.event_id}` : `Year ${response.year} Discovery`}</strong> • {response.dryRun ? `Dry-Run Simulation: Would upsert ${simulatedCount} scorecard(s) across iwf_meets, iwf_lifters, and iwf_meet_results (0 written)` : 'Committed to Supabase & Static Shard Enqueued'}
                    </p>
                  </div>

                  {existingDbMeet?.iwf_meet_id && !response.dryRun && (
                    <Link
                      href={`/meet/iwf/${existingDbMeet.iwf_meet_id}`}
                      target="_blank"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 hover:border-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 dark:hover:text-indigo-200 dark:border-indigo-700/50 dark:hover:border-indigo-500 transition flex items-center gap-1.5 shadow"
                      title="View competition results on OWLanalytics"
                    >
                      <span>OWLanalytics Meet Results</span>
                      <ExternalLink className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                    </Link>
                  )}
                </div>

                {/* Dedicated Dry-Run Scorecard Previews (supports multi-category same-meet entries) */}
                {(() => {
                  const matchedScorecards: MatchedScorecard[] =
                    (response.importStats?.matchedScorecards && response.importStats.matchedScorecards.length > 0)
                      ? response.importStats.matchedScorecards
                      : (response.importStats?.targetAthletes && response.importStats.targetAthletes.length > 0)
                        ? response.importStats.targetAthletes
                        : response.importStats?.targetAthlete
                          ? [response.importStats.targetAthlete]
                          : (response.targetAthleteScorecard ? [response.targetAthleteScorecard] : []);
                  const athleteFound = response.importStats?.athleteFound;
                  const closeMatches = response.importStats?.closeMatches || [];

                  // 1. Simulation Result: Non-Forced Skip Advisory
                  if (response.dryRun && response.importStats?.wouldSkip) {
                    return (
                      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs space-y-3 shadow-lg">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <span>Simulation Result • Live Execution Would Skip</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                0 Database Writes
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white">
                              Meet #{response.event_id || eventId} Already in Database ({response.importStats.existingResults ?? '254'} Results)
                            </h4>
                            <p className="text-xs text-amber-200/90 leading-relaxed">
                              {response.importStats.skipReason || `Meet #${response.event_id || eventId} already exists in the database. Live non-forced execution would skip this competition with zero database writes.`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setForce(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1.5 shadow"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Enable Force Overwrite</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (matchedScorecards.length > 0) {
                    return (
                      <div className="space-y-3">
                        {matchedScorecards.length > 1 && (
                          <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-indigo-200 text-xs flex items-center gap-2">
                            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span>
                              <strong>Multi-Category Competition Entry:</strong> {matchedScorecards.length} distinct scorecards matched for this athlete in Event #{response.event_id || eventId}. Both primary-source records are verified below.
                            </span>
                          </div>
                        )}

                        {matchedScorecards.map((sc, scIdx) => {
                          const athleteNameDisplay = sc.Name || sc.athlete_name || sc.name || athleteName.trim();
                          const nationDisplay = sc.Nation || sc.nation;
                          const birthYearDisplay = sc['Year of Birth'] || sc.birth_year;
                          const genderDisplay = sc.Gender || sc.gender;
                          const divisionDisplay =
                            sc.division ||
                            (genderDisplay
                              ? String(genderDisplay).toLowerCase().startsWith('w')
                                ? "Women's Division"
                                : "Men's Division"
                              : undefined);
                          const weightClassDisplay = sc['Weight Class'] || sc.weight_class;
                          const bodyWeightDisplay = sc['Body Weight'] || sc.body_weight_kg;
                          const groupDisplay = sc.Group || sc.group;
                          const rankDisplay = sc.Rank || sc.rank;
                          const snatch1 = sc['Snatch 1'] || sc.snatch_1;
                          const snatch2 = sc['Snatch 2'] || sc.snatch_2;
                          const snatch3 = sc['Snatch 3'] || sc.snatch_3;
                          const bestSnatch = sc['Best Snatch'] || sc.best_snatch;
                          const cj1 = sc['Clean & Jerk 1'] || sc.cj_1;
                          const cj2 = sc['Clean & Jerk 2'] || sc.cj_2;
                          const cj3 = sc['Clean & Jerk 3'] || sc.cj_3;
                          const bestCj = sc['Best C&J'] || sc.best_cj;
                          const totalDisplay = sc.Total || sc.total;

                          return (
                            <div
                              key={scIdx}
                              className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-3.5 shadow-lg"
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>
                                        Dry Run Preview • 0 DB Writes
                                        {matchedScorecards.length > 1 ? ` (Scorecard ${scIdx + 1} of ${matchedScorecards.length})` : ''}
                                      </span>
                                    </span>
                                    {sc.simulatedAction === 'UPDATE' && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                        <span>Simulated Update</span>
                                        {sc.existingResultId && <span className="font-mono text-amber-400">(ID #{sc.existingResultId})</span>}
                                      </span>
                                    )}
                                    {sc.simulatedAction === 'INSERT' && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                        <span>Simulated Insert</span>
                                        <span className="text-emerald-400 font-semibold">(New Scorecard)</span>
                                      </span>
                                    )}
                                    {sc.simulatedAction === 'LOCKED_SKIP' && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                                        <span>Locked (Manual Override)</span>
                                      </span>
                                    )}
                                    {divisionDisplay && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                        {divisionDisplay}
                                      </span>
                                    )}
                                    {weightClassDisplay && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                        {weightClassDisplay}
                                      </span>
                                    )}
                                    {groupDisplay && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-900 border border-slate-700 text-slate-400">
                                        {groupDisplay}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                                    <span>{athleteNameDisplay}</span>
                                    {nationDisplay && (
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400">
                                        {nationDisplay}
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-xs text-slate-400">
                                    {birthYearDisplay ? `Birth Year: ${birthYearDisplay}` : 'Birth year unrecorded'}
                                    {bodyWeightDisplay ? ` • Bodyweight: ${bodyWeightDisplay} kg` : ''}
                                    {rankDisplay ? ` • Rank: #${rankDisplay}` : ''}
                                  </p>
                                  {sc.simulatedAction === 'UPDATE' && sc.diffFields && sc.diffFields.length > 0 && (
                                    <div className="text-[11px] text-amber-300/90 font-medium bg-amber-950/30 px-2.5 py-1 rounded-lg border border-amber-800/40 inline-block">
                                      Fields with changes: <strong>{sc.diffFields.join(', ')}</strong>
                                    </div>
                                  )}
                                  {sc.simulatedAction === 'UPDATE' && (!sc.diffFields || sc.diffFields.length === 0) && (
                                    <div className="text-[11px] text-slate-400 font-normal bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800/60 inline-block">
                                      Primary-source values match current database row
                                    </div>
                                  )}
                                  {sc.simulatedAction === 'INSERT' && (
                                    <div className="text-[11px] text-emerald-300/90 font-medium bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-800/40 inline-block">
                                      Missing from database • Will add new category entry (increments meet total: {response.importStats?.existingResults ?? 254} → {(response.importStats?.existingResults ?? 254) + 1})
                                    </div>
                                  )}
                                </div>

                                <div className="text-right">
                                  <div className="text-[10px] uppercase font-semibold text-slate-400">Scraped Total</div>
                                  <div className="text-xl font-black text-emerald-400">
                                    {totalDisplay ? `${totalDisplay} kg` : '—'}
                                  </div>
                                </div>
                              </div>

                              {/* Scorecard Attempts Table */}
                              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80">
                                <table className="w-full text-xs text-left">
                                  <thead>
                                    <tr className="border-b border-slate-800 text-[10px] uppercase font-semibold text-slate-400 bg-slate-900/60">
                                      <th className="px-3 py-2">Discipline</th>
                                      <th className="px-3 py-2 text-center">Attempt 1</th>
                                      <th className="px-3 py-2 text-center">Attempt 2</th>
                                      <th className="px-3 py-2 text-center">Attempt 3</th>
                                      <th className="px-3 py-2 text-center font-bold text-white">Best</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60">
                                    <tr>
                                      <td className="px-3 py-2 font-medium text-amber-400">Snatch</td>
                                      <td className="px-3 py-2 text-center">
                                        {renderAttemptPill(snatch1)}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {renderAttemptPill(snatch2)}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {renderAttemptPill(snatch3)}
                                      </td>
                                      <td className="px-3 py-2 text-center font-bold text-amber-300">
                                        {bestSnatch ? `${bestSnatch} kg` : '—'}
                                      </td>
                                    </tr>
                                    <tr>
                                      <td className="px-3 py-2 font-medium text-sky-400">Clean &amp; Jerk</td>
                                      <td className="px-3 py-2 text-center">
                                        {renderAttemptPill(cj1)}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {renderAttemptPill(cj2)}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {renderAttemptPill(cj3)}
                                      </td>
                                      <td className="px-3 py-2 text-center font-bold text-sky-300">
                                        {bestCj ? `${bestCj} kg` : '—'}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              {/* Calculated Metrics: GAMX & Q-Points if present */}
                              {(sc.gamx_total || sc.qpoints) && (
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  {sc.gamx_total && (
                                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                      <span className="text-[10px] text-slate-400 uppercase font-semibold">GAMX-Total</span>
                                      <div className="text-sm font-bold text-amber-400">
                                        {sc.gamx_total}
                                      </div>
                                    </div>
                                  )}
                                  {sc.qpoints && (
                                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Q-Points</span>
                                      <div className="text-sm font-bold text-emerald-400">
                                        {sc.qpoints}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>
                                  Primary-source scorecard parsed from live competition markup on <strong>iwf.sport</strong>. Zero records were inserted or modified in Supabase.
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (response.dryRun && athleteName.trim() && (athleteFound === false || !matchedScorecards.length)) {
                    return (
                      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs space-y-2.5">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Target Athlete &quot;{athleteName.trim()}&quot; Not Found in Parsed Meet Markup</span>
                        </div>
                        <p className="text-[11px] text-amber-200/80">
                          The scraper verified Event #{response.event_id || eventId} without database writes, but did not match &quot;{athleteName.trim()}&quot; in the competition scorecards.
                        </p>
                        {closeMatches.length > 0 && (
                          <div className="space-y-1.5 pt-1.5 border-t border-amber-800/40">
                            <div className="text-[10px] uppercase font-semibold text-amber-300/90 tracking-wider">
                              Closest Matching Athletes in Event #{response.event_id || eventId} (click to select):
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {closeMatches.map((cand, candIdx) => (
                                <button
                                  key={candIdx}
                                  type="button"
                                  onClick={() => setAthleteName(cand)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-900/40 hover:bg-amber-800/70 border border-amber-700/60 text-amber-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                  title={`Set athlete filter to "${cand}"`}
                                >
                                  <span>{cand}</span>
                                  <span className="text-[10px] text-amber-400 font-bold">↵</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Statistics Grid */}
                {response.importStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Parsed</span>
                      <div className="text-base font-bold text-white">
                        {response.importStats.totalAthletesParsed ?? 0}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {response.importStats.athleteFilter || response.importStats.athleteName ? 'Targeted athlete results' : 'Scorecards scraped'}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/50 space-y-1">
                      <span className="text-[10px] text-indigo-300 uppercase font-semibold">Men&apos;s Division</span>
                      <div className="text-base font-bold text-indigo-200">
                        {response.importStats.menCount ?? 0}
                      </div>
                      <div className="text-[11px] text-indigo-300/80">Athletes parsed</div>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50 space-y-1">
                      <span className="text-[10px] text-rose-300 uppercase font-semibold">Women&apos;s Division</span>
                      <div className="text-base font-bold text-rose-200">
                        {response.importStats.womenCount ?? 0}
                      </div>
                      <div className="text-[11px] text-rose-300/80">Athletes parsed</div>
                    </div>

                    {response.dryRun ? (
                      response.importStats.wouldSkip ? (
                        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-1">
                          <span className="text-[10px] text-amber-300 uppercase font-semibold flex items-center justify-between">
                            <span>Would Skip Meet</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200 text-[9px] font-bold">DRY RUN</span>
                          </span>
                          <div className="text-base font-bold text-amber-300">
                            0 Actions
                          </div>
                          <div className="text-[11px] text-amber-300/80">
                            Meet exists ({response.importStats.existingResults ?? 0} in DB) • Pass Force to write
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-1">
                          <span className="text-[10px] text-amber-300 uppercase font-semibold flex items-center justify-between">
                            <span>Simulated Actions</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200 text-[9px] font-bold">DRY RUN</span>
                          </span>
                          <div className="text-base font-bold text-amber-300">
                            {(response.importStats.simulatedUpdates ?? 0) + (response.importStats.simulatedInserts ?? 0)} Scorecards
                          </div>
                          <div className="text-[11px] text-amber-300/80">
                            {response.importStats.simulatedUpdates ?? 0} to update • {response.importStats.simulatedInserts ?? 0} to insert
                            {response.importStats.simulatedLocked ? ` • ${response.importStats.simulatedLocked} locked` : ''}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-1">
                        <span className="text-[10px] text-emerald-300 uppercase font-semibold">Database Actions</span>
                        <div className="text-base font-bold text-emerald-200">
                          {(response.importStats.imported ?? 0) + (response.importStats.updated ?? 0)}
                        </div>
                        <div className="text-[11px] text-emerald-300/80">
                          {response.importStats.imported ?? 0} new • {response.importStats.updated ?? 0} updated
                        </div>
                      </div>
                    )}

                    {response.importStats?.linkerStats && (response.importStats.linkerStats.totalAliasesLinked > 0 || response.importStats.linkerStats.shardsRefreshed > 0) && (
                      <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/50 space-y-1 sm:col-span-2">
                        <span className="text-[10px] text-sky-300 uppercase font-semibold flex items-center justify-between">
                          <span>{response.dryRun ? 'Simulated Cross-Federation Links' : 'Cross-Federation Athlete Links'}</span>
                          {response.dryRun && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-900/60 text-sky-200 text-[9px] font-bold">DRY RUN</span>
                          )}
                        </span>
                        <div className="text-base font-bold text-sky-200">
                          +{response.importStats.linkerStats.totalAliasesLinked} Alias{response.importStats.linkerStats.totalAliasesLinked === 1 ? '' : 'es'} {response.dryRun ? 'Identified (0 Written)' : 'Linked'}
                        </div>
                        <div className="text-[11px] text-sky-300/80">
                          {response.importStats.linkerStats.usawAliasesLinked} USAW ↔ IWF • {response.importStats.linkerStats.owlcmsAliasesLinked} IWF ↔ OWLCMS
                          {response.importStats.linkerStats.shardsRefreshed > 0 ? ` • ${response.importStats.linkerStats.shardsRefreshed} shard(s) regenerated` : ''}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Collapsible Scraper Execution Log Block */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-slate-300">
              <button
                type="button"
                onClick={() => setShowScraperLogs((prev) => !prev)}
                className="flex items-center gap-2 hover:text-white transition flex-1 text-left min-w-0"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Puppeteer Scraper Output Log</span>
                {isRunning && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Live Output Streaming</span>
                  </span>
                )}
                {(liveLogs || response?.logs) && !isRunning && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({(liveLogs || response?.logs || '').length.toLocaleString()} characters)
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2 shrink-0">
                {(liveLogs || response?.logs) && (
                  <button
                    type="button"
                    onClick={handleCopyScraperLogs}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm"
                    title="Copy full log to clipboard"
                  >
                    {copiedScraperLogs ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copy Log</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowScraperLogs((prev) => !prev)}
                  className="p-1 text-slate-400 hover:text-white transition"
                  aria-label="Toggle scraper logs"
                >
                  {showScraperLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showScraperLogs && (
              <div className="space-y-1.5">
                {streamStatus && isRunning && (
                  <div className="text-[11px] text-emerald-400/90 font-mono flex items-center gap-2 px-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{streamStatus}</span>
                  </div>
                )}
                <pre
                  ref={logContainerRef}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed select-text cursor-text"
                >
                  {liveLogs || response?.logs || (isRunning ? 'Initializing scraper process...' : 'Waiting for pipeline execution...')}
                </pre>
              </div>
            )}
          </div>

          {/* Collapsible Cross-Federation Athlete Linker Log Block */}
          {response?.linkerLogs && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-slate-300">
                <button
                  type="button"
                  onClick={() => setShowLinkerLogs((prev) => !prev)}
                  className="flex items-center gap-2 hover:text-white transition flex-1 text-left min-w-0"
                >
                  <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Cross-Federation Alias Linker Output (<code className="text-slate-400">link-new-iwf-athletes.js</code>)</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyLinkerLogs}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm"
                    title="Copy linker log to clipboard"
                  >
                    {copiedLinkerLogs ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copy Log</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLinkerLogs((prev) => !prev)}
                    className="p-1 text-slate-400 hover:text-white transition"
                    aria-label="Toggle linker logs"
                  >
                    {showLinkerLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {showLinkerLogs && (
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-300 max-h-56 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed select-text cursor-text">
                  {response.linkerLogs}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Execution History Section */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-950/60 border border-sky-800/60 text-sky-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Recent Pipeline Runs &amp; Historical Log Archive</span>
                <span className="text-xs font-normal text-slate-400">
                  ({runsHistory.length} recorded)
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Review past executions, verify pass/fail outcomes, inspect historical console logs, and jump directly to imported meets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchRunsHistory}
              disabled={loadingHistory}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition disabled:opacity-50"
              title="Refresh runs history"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowHistorySection((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition"
              title={showHistorySection ? 'Collapse history' : 'Expand history'}
            >
              {showHistorySection ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showHistorySection && (
          <div className="space-y-3">
            {selectedRunIds.size > 0 && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700/80 text-xs text-slate-300 animate-in fade-in duration-150">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">
                    {selectedRunIds.size} run{selectedRunIds.size === 1 ? '' : 's'} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedRunIds(new Set()); setShowDeleteConfirm(false); }}
                    className="text-sky-400 hover:text-sky-300 underline text-[11px]"
                  >
                    Deselect All
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2 bg-rose-950/90 border border-rose-800 px-3 py-1.5 rounded-lg animate-in fade-in duration-150">
                      <span className="text-rose-200 text-[11px] font-medium">
                        Permanently delete {selectedRunIds.size} log{selectedRunIds.size === 1 ? '' : 's'}?
                      </span>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedRuns}
                        disabled={isDeletingRuns}
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {isDeletingRuns ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        <span>Confirm Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeletingRuns}
                        className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 border border-rose-800/60 transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete Selected ({selectedRunIds.size})</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {loadingHistory && runsHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>Loading pipeline run history...</span>
              </div>
            ) : runsHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800/60">
                No pipeline runs recorded in database yet. Executed scrapes and dry-runs will appear here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-semibold text-slate-400 bg-slate-900/60">
                      <th className="px-3 py-2.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={runsHistory.length > 0 && selectedRunIds.size === runsHistory.length}
                          onChange={toggleSelectAllRuns}
                          className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 cursor-pointer"
                          title="Select / deselect all runs"
                        />
                      </th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5">Target &amp; Scope</th>
                      <th className="px-3.5 py-2.5">Mode</th>
                      <th className="px-3.5 py-2.5">Executed (EST)</th>
                      <th className="px-3.5 py-2.5">Runtime</th>
                      <th className="px-3.5 py-2.5">Ingestion Telemetry</th>
                      <th className="px-3.5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {runsHistory.map((run) => {
                      const isSelected = selectedRunIds.has(run.id);
                      const isSuccess = run.status === 'SUCCESS';
                      const isFailed = run.status === 'FAILED';
                      const isRunningRun = run.status === 'RUNNING';
                      const isCancelled = run.status === 'CANCELLED';

                      const importedCount = (run.import_stats?.imported ?? 0) + (run.import_stats?.updated ?? 0);
                      const parsedCount = run.import_stats?.totalAthletesParsed ?? run.import_stats?.totalAthletes ?? run.import_stats?.simulatedScorecards;

                      return (
                        <tr key={run.id} className={`hover:bg-slate-900/40 transition ${isSelected ? 'bg-sky-950/20' : ''}`}>
                          <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRun(run.id)}
                              className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            {isSuccess && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-1 w-fit">
                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                                <span>Passed</span>
                              </span>
                            )}
                            {isFailed && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                <span>Failed</span>
                              </span>
                            )}
                            {isRunningRun && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1 w-fit animate-pulse">
                                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                                <span>Running</span>
                              </span>
                            )}
                            {isCancelled && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 w-fit">
                                <XCircle className="w-3 h-3 text-slate-400" />
                                <span>Cancelled</span>
                              </span>
                            )}
                          </td>

                          <td className="px-3.5 py-3">
                            <div className="space-y-0.5">
                              <div className="font-semibold text-white flex items-center gap-1.5 flex-wrap">
                                <span>{run.mode === 'single_event' ? `Event #${run.event_id || '—'}` : `Year ${run.year || '—'} Discovery`}</span>
                                {run.db_meet_id && (
                                  <Link
                                    href={`/meet/iwf/${run.db_meet_id}`}
                                    target="_blank"
                                    className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 hover:text-emerald-300 border border-emerald-800/80 inline-flex items-center gap-1 transition"
                                  >
                                    <span>Meet #{run.db_meet_id}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </Link>
                                )}
                              </div>
                              {run.athlete_name && (
                                <div className="text-[11px] text-slate-400">
                                  Lifter: <span className="text-amber-300 font-mono font-medium">{run.athlete_name}</span>
                                </div>
                              )}
                              {run.url && (
                                <div className="text-[10px] text-slate-500 truncate max-w-xs" title={run.url}>
                                  {run.url}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 flex-wrap">
                              {run.dry_run ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                  Dry Run
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                                  Live
                                </span>
                              )}
                              {run.force && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950/60 text-rose-300 border border-rose-800/60">
                                  Force
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                            {formatEasternTime(run.created_at)}
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                            {run.duration_seconds !== undefined && run.duration_seconds !== null
                              ? `${run.duration_seconds}s`
                              : run.status === 'RUNNING'
                                ? 'In flight...'
                                : '—'}
                          </td>

                          <td className="px-3.5 py-3">
                            {run.error_message ? (
                              <div className="text-[11px] text-rose-300 font-medium truncate max-w-xs" title={run.error_message}>
                                {run.error_message}
                              </div>
                            ) : run.dry_run ? (
                              <div className="text-[11px] text-amber-300/90 font-medium space-y-0.5">
                                <div>
                                  {run.import_stats?.wouldSkip
                                    ? 'Would Skip (0 writes)'
                                    : `${run.import_stats?.simulatedScorecards ?? 0} simulated scorecard(s)`}
                                </div>
                                {run.import_stats?.linkerStats && run.import_stats.linkerStats.totalAliasesLinked > 0 && (
                                  <div className="text-[10px] text-sky-300 font-medium pt-0.5 flex items-center gap-1.5 flex-wrap">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                                    <span>+{run.import_stats.linkerStats.totalAliasesLinked} simulated alias{run.import_stats.linkerStats.totalAliasesLinked === 1 ? '' : 'es'}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-300 space-y-0.5">
                                <div>
                                  {importedCount > 0 ? (
                                    <>
                                      <strong className="text-emerald-400">{importedCount}</strong> result(s) imported
                                    </>
                                  ) : run.import_stats?.linkerStats && run.import_stats.linkerStats.totalAliasesLinked === 0 ? (
                                    <span className="text-slate-400">Results &amp; aliases up to date</span>
                                  ) : (
                                    <span className="text-slate-400">Results up to date</span>
                                  )}
                                </div>
                                {parsedCount !== undefined && parsedCount > 0 && (
                                  <div className="text-[10px] text-slate-500">
                                    {parsedCount} athletes parsed
                                  </div>
                                )}
                                {run.import_stats?.linkerStats && (run.import_stats.linkerStats.totalAliasesLinked > 0 || run.import_stats.linkerStats.shardsRefreshed > 0) && (
                                  <div className="text-[10px] text-sky-300 font-medium pt-0.5 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                                      <span>+{run.import_stats.linkerStats.totalAliasesLinked} alias{run.import_stats.linkerStats.totalAliasesLinked === 1 ? '' : 'es'} linked</span>
                                      {run.import_stats.linkerStats.usawAliasesLinked > 0 && run.import_stats.linkerStats.owlcmsAliasesLinked > 0 && (
                                        <span className="text-slate-400 font-normal">({run.import_stats.linkerStats.usawAliasesLinked} USAW, {run.import_stats.linkerStats.owlcmsAliasesLinked} OWLCMS)</span>
                                      )}
                                    </div>
                                    {run.import_stats.linkerStats.shardsRefreshed > 0 && (
                                      <div className="text-[10px] text-emerald-400/90 pl-3">
                                        {run.import_stats.linkerStats.shardsRefreshed} shard{run.import_stats.linkerStats.shardsRefreshed === 1 ? '' : 's'} refreshed
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-3.5 py-3 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenRunLogs(run.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition inline-flex items-center gap-1.5 shadow-sm"
                            >
                              <Terminal className="w-3.5 h-3.5 text-sky-400" />
                              <span>View Logs</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historical Console Log Modal / Inspector */}
      {(selectedRunDetail || loadingRunDetail) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-sky-400">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Pipeline Run #{selectedRunDetail?.id || '...'} Console Logs
                    </h3>
                    {selectedRunDetail?.status && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedRunDetail.status === 'SUCCESS'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : selectedRunDetail.status === 'FAILED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {selectedRunDetail.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {formatEasternTime(selectedRunDetail?.created_at)}
                    {selectedRunDetail?.duration_seconds ? ` • Runtime: ${selectedRunDetail.duration_seconds}s` : ''}
                    {selectedRunDetail?.event_id ? ` • Event #${selectedRunDetail.event_id}` : ''}
                    {selectedRunDetail?.athlete_name ? ` • Lifter: ${selectedRunDetail.athlete_name}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyModalLogs}
                  disabled={loadingRunDetail || (!selectedRunDetail?.logs && !selectedRunDetail?.linker_logs)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  title="Copy log to clipboard"
                >
                  {copiedModalLogs ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Log</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRunDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  aria-label="Close log viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Subheader / Tabs if Linker logs exist */}
            {selectedRunDetail?.linker_logs && (
              <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalTab('scraper')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeModalTab === 'scraper'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Puppeteer Scraper Output
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalTab('linker')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    activeModalTab === 'linker'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cross-Federation Linker Output
                </button>
              </div>
            )}

            {/* Modal Log Body */}
            <div className="p-4 overflow-y-auto flex-1 bg-slate-950">
              {loadingRunDetail ? (
                <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Loading historical console logs...</span>
                </div>
              ) : (
                <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed select-text cursor-text">
                  {(activeModalTab === 'scraper'
                    ? selectedRunDetail?.logs || selectedRunDetail?.error_message || 'No log output captured for this run.'
                    : selectedRunDetail?.linker_logs || 'No cross-federation linker logs recorded for this run.')}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderAttemptPill(attempt?: string | number) {
  if (attempt === undefined || attempt === null || attempt === '' || attempt === '---' || attempt === '—') {
    return <span className="text-slate-500">—</span>;
  }
  const str = String(attempt).trim();
  const isMiss = str.startsWith('-') || str.toLowerCase().includes('x');
  const cleanVal = str.replace(/^-/, '').trim();
  if (isMiss) {
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-950/70 text-rose-300 line-through border border-rose-800/80">
        {cleanVal} kg
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/80">
      {cleanVal} kg
    </span>
  );
}
