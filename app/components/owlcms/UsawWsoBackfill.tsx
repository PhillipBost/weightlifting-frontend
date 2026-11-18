"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Terminal,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';

interface WsoSessionSummary {
  processed?: number;
  completed?: number;
  completedWithoutMetadata?: number;
  failed?: number;
  skipped?: number;
  durationMs?: number;
  dryRunActionsCount: number;
}

export function UsawWsoBackfill() {
  // Default Dry Run to true so admins preview intended changes before live mutations
  const [dryRun, setDryRun] = useState<boolean>(true);

  // Target Filters
  const [missingMembership, setMissingMembership] = useState<boolean>(true);
  const [missingInternalId, setMissingInternalId] = useState<boolean>(false);
  const [membershipDuplicates, setMembershipDuplicates] = useState<boolean>(false);

  // Optional Metadata Filters
  const [showMetadataFilters, setShowMetadataFilters] = useState<boolean>(false);
  const [missingWso, setMissingWso] = useState<boolean>(false);
  const [missingClub, setMissingClub] = useState<boolean>(false);
  const [missingAge, setMissingAge] = useState<boolean>(false);
  const [missingGender, setMissingGender] = useState<boolean>(false);
  const [missingRank, setMissingRank] = useState<boolean>(false);
  const [excludeZeroTotal, setExcludeZeroTotal] = useState<boolean>(false);

  // Scope Limiters
  const [athleteName, setAthleteName] = useState<string>('');
  const [meetIds, setMeetIds] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [maxResults, setMaxResults] = useState<string>('25');

  // Execution Controls
  const [force, setForce] = useState<boolean>(false);
  const [logLevel, setLogLevel] = useState<'info' | 'debug' | 'warn' | 'error'>('info');
  const [delay, setDelay] = useState<string>('2000');
  const [timeout, setTimeoutVal] = useState<string>('30000');

  // Run State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<{
    success: boolean;
    cancelled?: boolean;
    dryRun: boolean;
    summary?: WsoSessionSummary;
  } | null>(null);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const logContainerRef = useRef<HTMLPreElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);

  useEffect(() => {
    const el = logContainerRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  const handleLogScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 40;
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleCopyLogs = async () => {
    if (!logs) return;
    try {
      await navigator.clipboard.writeText(logs);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    stickToBottomRef.current = true;
    setIsRunning(true);
    setLogs('');
    setErrorMsg(null);
    setRunResult(null);

    try {
      const res = await fetch('/api/admin/usaw-wso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
        body: JSON.stringify({
          dryRun,
          missingMembership,
          missingInternalId,
          membershipDuplicates,
          missingWso,
          missingClub,
          missingAge,
          missingGender,
          missingRank,
          excludeZeroTotal,
          athleteName,
          meetIds,
          startDate,
          endDate,
          gender,
          maxResults,
          force,
          logLevel,
          delay,
          timeout,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No response stream received from server.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const lines = rawEvent.split('\n');
          let eventName = 'message';
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (dataLines.length === 0) continue;
          const payload = JSON.parse(dataLines.join('\n'));

          if (eventName === 'log' && payload.chunk) {
            setLogs((prev) => prev + payload.chunk);
          } else if (eventName === 'done') {
            setRunResult({
              success: Boolean(payload.success),
              cancelled: Boolean(payload.cancelled),
              dryRun: Boolean(payload.dryRun),
              summary: payload.summary,
            });
            if (!payload.success && payload.error) {
              setErrorMsg(payload.error);
            }
          } else if (eventName === 'error') {
            setErrorMsg(payload.error || 'Unknown error during WSO backfill.');
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setLogs((prev) => `${prev}\n[ABORTED BY ADMINISTRATOR]\n`);
        setErrorMsg('Run cancelled by administrator.');
      } else {
        setErrorMsg(err?.message || 'Failed to start USAW WSO backfill.');
      }
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              USAW Membership &amp; WSO Backfill (<code className="text-indigo-300 text-sm">--mode wso</code>)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Runs <code className="text-slate-300">scripts/unified-scraper.js --mode wso</code> against Sport80 to discover
              USAW membership numbers, internal IDs, and Weightlifting State Organization (WSO) metadata. Single-run locked.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 border ${
              dryRun
                ? 'bg-sky-500/15 border-sky-400/30 text-sky-300'
                : 'bg-amber-500/15 border-amber-400/30 text-amber-300'
            }`}
          >
            {dryRun ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            <span>{dryRun ? 'Dry Run Preview' : 'Live Mutations Enabled'}</span>
          </span>
        </div>

        {/* Mode / Safety Banner */}
        {dryRun ? (
          <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-700/50 text-xs text-sky-200 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-sky-100">Dry Run Mode Active (--dry-run)</div>
              <p className="text-sky-200/85">
                Tier 2 verification performs read-only Sport80 lookups and logs intended changes (
                <code className="text-sky-100">[DRY RUN] Would ...</code>) without mutating{' '}
                <code className="text-sky-100">usaw_lifters</code>, <code className="text-sky-100">usaw_meet_results</code>, or{' '}
                <code className="text-sky-100">surgical-strike-wso-unresolved.json</code>. Tier 1 enrichment is skipped in dry run.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-700/60 text-xs text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-100">Live Database Mutations &amp; Tier 2 Decontamination Enabled</div>
              <p className="text-amber-200/85">
                Updates <code className="text-amber-100">usaw_lifters.membership_number</code> and performs automatic Tier 2
                decontamination: reassigns <code className="text-amber-100">usaw_meet_results.lifter_id</code> on verified
                identity matches, deletes conflicting duplicate results on unique-constraint collisions, and deletes orphaned{' '}
                <code className="text-amber-100">usaw_lifters</code> rows with 0 remaining results.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleRun} className="space-y-6">
          {/* Target Filters */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Target Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={missingMembership}
                  onChange={(e) => setMissingMembership(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Missing Membership</div>
                  <div className="text-[11px] text-slate-400">
                    <code>--missing-membership</code>
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={missingInternalId}
                  onChange={(e) => setMissingInternalId(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Missing Sport80 Internal ID</div>
                  <div className="text-[11px] text-slate-400">
                    <code>--missing-internal-id</code>
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={membershipDuplicates}
                  onChange={(e) => setMembershipDuplicates(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Membership Duplicates</div>
                  <div className="text-[11px] text-slate-400">
                    <code>--membership-duplicates</code>
                  </div>
                </div>
              </label>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowMetadataFilters((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showMetadataFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Optional Metadata Filters</span>
              </button>

              {showMetadataFilters && (
                <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  {[
                    { label: 'Missing WSO', flag: '--missing-wso', checked: missingWso, set: setMissingWso },
                    { label: 'Missing Club', flag: '--missing-club', checked: missingClub, set: setMissingClub },
                    { label: 'Missing Age', flag: '--missing-age', checked: missingAge, set: setMissingAge },
                    { label: 'Missing Gender', flag: '--missing-gender', checked: missingGender, set: setMissingGender },
                    { label: 'Missing Rank', flag: '--missing-rank', checked: missingRank, set: setMissingRank },
                    { label: 'Exclude Zero Total', flag: '--exclude-zero-total', checked: excludeZeroTotal, set: setExcludeZeroTotal },
                  ].map((item) => (
                    <label key={item.flag} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.set(e.target.checked)}
                        className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                      />
                      <span>
                        {item.label} <code className="text-[10px] text-slate-500">{item.flag}</code>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scope Limiters */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Scope Limiters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Athlete Name(s) <code className="text-slate-500">--athlete-name</code>
                </label>
                <input
                  type="text"
                  value={athleteName}
                  onChange={(e) => setAthleteName(e.target.value)}
                  placeholder="Jane Doe, John Smith"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Meet IDs (comma-separated) <code className="text-slate-500">--meet-ids</code>
                </label>
                <input
                  type="text"
                  value={meetIds}
                  onChange={(e) => setMeetIds(e.target.value)}
                  placeholder="7142, 7143"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Max Results <code className="text-slate-500">--max-results</code>
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                  placeholder="25"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Start Date <code className="text-slate-500">--start-date</code>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  End Date <code className="text-slate-500">--end-date</code>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Gender <code className="text-slate-500">--gender</code>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">All</option>
                  <option value="M">M (Men)</option>
                  <option value="F">F (Women)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Execution Controls */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Execution Controls
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <span>
                  Dry Run <code className="text-[10px] text-slate-400">--dry-run</code>
                </span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
                <span>
                  Force <code className="text-[10px] text-slate-400">--force</code>
                </span>
              </label>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Log Level <code className="text-slate-500">--log-level</code>
                </label>
                <select
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value as 'info' | 'debug' | 'warn' | 'error')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="info">info</option>
                  <option value="debug">debug</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Delay (ms) <code className="text-slate-500">--delay</code>
                </label>
                <input
                  type="number"
                  min={0}
                  value={delay}
                  onChange={(e) => setDelay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Timeout (ms) <code className="text-slate-500">--timeout</code>
                </label>
                <input
                  type="number"
                  min={1000}
                  value={timeout}
                  onChange={(e) => setTimeoutVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isRunning}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50 ${
                dryRun ? 'bg-sky-600 hover:bg-sky-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'Running WSO Backfill...' : dryRun ? 'Run Dry-Run Preview' : 'Run Live WSO Backfill'}</span>
            </button>

            {isRunning && (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white transition cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Run</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-700/60 text-xs text-rose-200 flex items-center gap-2.5">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* End-of-Run Summary Metrics */}
      {runResult && (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              {runResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {runResult.cancelled
                  ? 'Run Cancelled'
                  : runResult.success
                    ? runResult.dryRun
                      ? 'Dry-Run Preview Complete'
                      : 'Live WSO Backfill Complete'
                    : 'Run Failed'}
              </span>
            </div>
            {runResult.summary?.durationMs !== undefined && (
              <span className="text-xs text-slate-400">
                Duration: {(runResult.summary.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Processed</div>
              <div className="text-lg font-bold text-white mt-0.5">{runResult.summary?.processed ?? '—'}</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
              <div className="text-[10px] uppercase text-emerald-300 font-semibold">Completed</div>
              <div className="text-lg font-bold text-emerald-200 mt-0.5">{runResult.summary?.completed ?? '—'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">No Metadata</div>
              <div className="text-lg font-bold text-slate-200 mt-0.5">
                {runResult.summary?.completedWithoutMetadata ?? '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50">
              <div className="text-[10px] uppercase text-rose-300 font-semibold">Failed</div>
              <div className="text-lg font-bold text-rose-200 mt-0.5">{runResult.summary?.failed ?? '—'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Skipped</div>
              <div className="text-lg font-bold text-slate-200 mt-0.5">{runResult.summary?.skipped ?? '—'}</div>
            </div>
            {runResult.dryRun && (
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/50">
                <div className="text-[10px] uppercase text-sky-300 font-semibold">Previewed Writes</div>
                <div className="text-lg font-bold text-sky-200 mt-0.5">{runResult.summary?.dryRunActionsCount ?? 0}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Terminal Output */}
      {(logs || isRunning) && (
        <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Scraper Output</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLogs}
              disabled={!logs}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
            >
              {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedLogs ? 'Copied' : 'Copy Logs'}</span>
            </button>
          </div>
          <pre
            ref={logContainerRef}
            onScroll={handleLogScroll}
            className="p-4 text-[11px] leading-relaxed text-slate-200 font-mono max-h-[420px] overflow-y-auto whitespace-pre-wrap break-words"
          >
            {logs || 'Starting unified-scraper.js --mode wso...\n'}
          </pre>
        </div>
      )}
    </div>
  );
}
