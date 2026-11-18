"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  GitCompareArrows,
  Play,
  Square,
  Loader2,
  Terminal,
  Copy,
  Check,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

type ScopeType = 'days' | 'event_id' | 'year' | 'athlete_name' | 'all';
type FederationMode = 'all' | 'usaw' | 'owlcms';

interface LinkerSummary {
  targetScope?: { type?: string; value?: string | number };
  athletesEvaluated?: number;
  meetsEvaluated?: number;
  targetFederation?: string;
  usawMatchesFound?: number;
  newUsawAliasesInserted?: number;
  alreadyLinkedUsawAliases?: number;
  owlcmsMatchesFound?: number;
  ambiguousStagedToReview?: number;
  isDryRun?: boolean;
  isReEvaluate?: boolean;
  executionTimeMs?: number;
}

/**
 * Standalone runner for scripts/production/link-new-iwf-athletes.js so admins can
 * isolate USAW <-> IWF or IWF <-> OWLCMS pairing and back-check older meets without
 * re-scraping or force-importing meet results.
 */
export function IwfLinkerPanel({ onRunComplete }: { onRunComplete?: () => void }) {
  const [scopeType, setScopeType] = useState<ScopeType>('days');
  const [days, setDays] = useState<string>('3');
  const [eventId, setEventId] = useState<string>('');
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [athleteName, setAthleteName] = useState<string>('');
  const [federation, setFederation] = useState<FederationMode>('all');
  const [dryRun, setDryRun] = useState<boolean>(true);
  const [reEvaluate, setReEvaluate] = useState<boolean>(false);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<string>('');
  const [summary, setSummary] = useState<LinkerSummary | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [autoScrollLogs, setAutoScrollLogs] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLPreElement | null>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const lastScrollTopRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = logContainerRef.current;
    if (autoScrollLogs && el) {
      isProgrammaticScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
      lastScrollTopRef.current = el.scrollTop;
    }
  }, [liveLogs, autoScrollLogs]);

  const handleLogScroll = () => {
    const el = logContainerRef.current;
    if (!el) return;
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      lastScrollTopRef.current = el.scrollTop;
      return;
    }
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 24;
    if (isAtBottom) {
      setAutoScrollLogs(true);
    } else if (el.scrollTop < lastScrollTopRef.current - 2) {
      setAutoScrollLogs(false);
    }
    lastScrollTopRef.current = el.scrollTop;
  };

  const jumpToBottom = () => {
    setAutoScrollLogs(true);
    const el = logContainerRef.current;
    if (el) {
      isProgrammaticScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
      lastScrollTopRef.current = el.scrollTop;
    }
  };

  const handleCopyLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!liveLogs) return;
    try {
      await navigator.clipboard.writeText(liveLogs);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleAbortLinker = () => {
    abortControllerRef.current?.abort();
  };

  const handleRunLinker = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsRunning(true);
    setErrorMessage(null);
    setSummary(null);
    setLiveLogs('');
    setAutoScrollLogs(true);
    setShowLogs(true);
    setStatusMessage('Initializing standalone cross-federation linker...');

    try {
      const res = await fetch('/api/admin/iwf-linker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
        body: JSON.stringify({
          scopeType,
          days: Number(days) || 3,
          event_id: eventId.trim(),
          year: year.trim(),
          athlete_name: athleteName.trim(),
          federation,
          dryRun,
          reEvaluate,
          stream: true,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMessage(data.error || 'Linker execution failed.');
        } else {
          setSummary(data.summary || null);
          setLiveLogs(data.logs || '');
        }
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setErrorMessage('Failed to attach to linker stream.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const eventMatch = frame.match(/^event:\s*(.+)$/m);
          const dataMatch = frame.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventName = eventMatch[1].trim();
          const payload = JSON.parse(dataMatch[1]);

          if (eventName === 'status') {
            setStatusMessage(payload.message || null);
          } else if (eventName === 'log') {
            setLiveLogs((prev) => prev + payload.text);
          } else if (eventName === 'done') {
            setSummary(payload.summary || null);
            if (payload.logs) setLiveLogs(payload.logs);
            setStatusMessage(null);
          } else if (eventName === 'error') {
            setErrorMessage(payload.error || 'Linker exited with an error.');
            if (payload.summary) setSummary(payload.summary);
            setStatusMessage(null);
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setErrorMessage('Linker run aborted by admin.');
      } else {
        setErrorMessage(err?.message || 'Network error starting linker.');
      }
    } finally {
      abortControllerRef.current = null;
      setIsRunning(false);
      setStatusMessage(null);
      onRunComplete?.();
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
            <GitCompareArrows className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
              <span>Standalone Cross-Federation Athlete Linker</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800">
                link-new-iwf-athletes.js
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Run USAW ↔ IWF (Phases 1–2) or IWF ↔ OWLCMS (Phase 3) athlete matching and back-check historical meets without re-scraping or overwriting meet results.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls */}
        <div className="lg:col-span-5 space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Scope
            </label>
            <select
              value={scopeType}
              onChange={(e) => setScopeType(e.target.value as ScopeType)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="days">Recent Updates (--days)</option>
              <option value="event_id">Single IWF Event (--event-id)</option>
              <option value="year">Full Competition Year (--year)</option>
              <option value="athlete_name">Specific Athlete (--athlete-name)</option>
              <option value="all">All Historical IWF Meets (--all)</option>
            </select>
          </div>

          {scopeType === 'days' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Lookback Window (Days)
              </label>
              <input
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          {scopeType === 'event_id' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                IWF Event ID or URL
              </label>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="e.g. 676 or https://iwf.sport/results/.../?event_id=676"
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          {scopeType === 'year' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Competition Year
              </label>
              <input
                type="number"
                min={1990}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          {scopeType === 'athlete_name' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Athlete Name
              </label>
              <input
                type="text"
                value={athleteName}
                onChange={(e) => setAthleteName(e.target.value)}
                placeholder="e.g. Hampton MORRIS"
                disabled={isRunning}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Federation / Phase Isolation
            </label>
            <select
              value={federation}
              onChange={(e) => setFederation(e.target.value as FederationMode)}
              disabled={isRunning}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Phases (USAW ↔ IWF + IWF ↔ OWLCMS)</option>
              <option value="usaw">USAW ↔ IWF Only (Phases 1–2)</option>
              <option value="owlcms">IWF ↔ OWLCMS Only (Phase 3)</option>
            </select>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                disabled={isRunning}
                className="mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-200">Dry Run (--dry-run)</span>
                <p className="text-[11px] text-slate-400">
                  Simulate matching and staging without writing to <code className="text-slate-300">athlete_aliases</code> or <code className="text-slate-300">admin_review_queue</code>.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={reEvaluate}
                onChange={(e) => setReEvaluate(e.target.checked)}
                disabled={isRunning}
                className="mt-0.5 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-200">Re-evaluate Existing (--re-evaluate)</span>
                <p className="text-[11px] text-slate-400">
                  Re-check athletes even if previously evaluated against older matching rules.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={handleRunLinker}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer ${dryRun
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Cross-Federation Linker...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>{dryRun ? 'Run Linker (Dry Run)' : 'Run Linker (Live Write)'}</span>
                </>
              )}
            </button>

            {isRunning && (
              <button
                type="button"
                onClick={handleAbortLinker}
                className="py-2.5 px-3.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1.5 shadow-lg cursor-pointer shrink-0"
                title="Abort running linker process"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Abort</span>
              </button>
            )}
          </div>
        </div>

        {/* Output & Summary */}
        <div className="lg:col-span-7 space-y-3">
          {statusMessage && (
            <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/60 text-xs text-sky-200 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {summary && (
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>
                    {summary.isDryRun ? 'Dry-Run Linker Summary' : 'Linker Execution Summary'}
                  </span>
                  {summary.executionTimeMs !== undefined && (
                    <span className="text-[11px] font-normal text-slate-400">
                      ({(summary.executionTimeMs / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>

                {(summary.ambiguousStagedToReview ?? 0) > 0 && (
                  <Link
                    href="/admin/review"
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-400/40 transition flex items-center gap-1"
                  >
                    <span>Review {summary.ambiguousStagedToReview} Ambiguous Athlete Pair(s)</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-sm font-bold text-white">{summary.meetsEvaluated ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Meets Checked</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-sm font-bold text-white">{summary.athletesEvaluated ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Athletes Evaluated</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-sm font-bold text-emerald-300">
                    +{summary.newUsawAliasesInserted ?? 0} / +{summary.owlcmsMatchesFound ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-400">IWF ↔ USAW / IWF ↔ OWLCMS</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-sm font-bold text-amber-300">{summary.ambiguousStagedToReview ?? 0}</div>
                  <div className="text-[10px] text-slate-400">Ambiguous Pairs Staged</div>
                </div>
              </div>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300">
              <button
                type="button"
                onClick={() => setShowLogs((prev) => !prev)}
                className="flex items-center gap-2 hover:text-white transition flex-1 text-left"
              >
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>Linker Console Output</span>
                {showLogs ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              </button>
              <div className="flex items-center gap-2">
                {!autoScrollLogs && liveLogs && (
                  <button
                    type="button"
                    onClick={jumpToBottom}
                    className="px-2 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900/80 border border-sky-700/70 text-[11px] text-sky-300 transition cursor-pointer"
                  >
                    Jump to bottom
                  </button>
                )}
                {liveLogs && (
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedLogs ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            {showLogs && (
              <pre
                ref={logContainerRef}
                onScroll={handleLogScroll}
                className="p-3 rounded-lg bg-black/60 border border-slate-800/80 text-[11px] font-mono text-slate-300 max-h-72 overflow-y-auto whitespace-pre-wrap break-words"
              >
                {liveLogs || 'Select a scope and phase on the left, then click Run Linker to stream inline Phase 1–3 matching output.'}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
