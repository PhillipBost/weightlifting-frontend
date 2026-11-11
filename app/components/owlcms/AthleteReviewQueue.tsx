"use client";

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
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
  Globe,
  GitFork,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  MessageSquare,
  X,
  FileText,
  Layers,
  Save,
  RotateCcw,
  History,
  Copy,
  UserPlus,
  Trash2
} from 'lucide-react';

export type ReviewCategory = 'all' | 'homonym_split' | 'name_change_merge' | 'duplicate_profile' | 'data_hygiene_typo' | 'cross_federation' | 'iwf_duplicate';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

export interface AdminReviewItem {
  id: string;
  category: 'cross_federation' | 'homonym_split' | 'name_change_merge' | 'duplicate_profile' | 'data_hygiene_typo' | 'iwf_duplicate';
  status: string;
  title: string;
  primary_entity_type: string;
  primary_entity_id: number;
  candidate_entity_type: string | null;
  candidate_entity_id: number | null;
  confidence_score: number | null;
  evidence: Record<string, any>;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

function formatEasternDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
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
  } catch { }
  return dateStr;
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
  return dateStr;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

function isDuplicateOrTypo(primaryName?: string | null, candidateName?: string | null): boolean {
  if (!primaryName || !candidateName) return false;
  const p = primaryName.trim().toLowerCase(), c = candidateName.trim().toLowerCase();
  if (p === c || p.includes('@') || c.includes('@') || /\d/.test(p) || /\d/.test(c)) return true;
  const pParts = p.split(/\s+/), cParts = c.split(/\s+/);
  if (pParts.length > 1 && cParts.length > 1 && pParts[0] === cParts[0]) {
    const pLast = pParts.slice(1).join(' '), cLast = cParts.slice(1).join(' ');
    if (Math.abs(pLast.length - cLast.length) <= 2 && (pLast.includes(cLast) || cLast.includes(pLast))) return true;
    if (levenshteinDistance(pLast, cLast) <= 1) return true;
  }
  return false;
}

interface AthleteReviewQueueProps {
  onCountChange?: (count: number) => void;
}

export function AthleteReviewQueue({ onCountChange }: AthleteReviewQueueProps) {
  const [activeCategory, setActiveCategory] = useState<ReviewCategory>('all');
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [homonymSubsegment, setHomonymSubsegment] = useState<'all' | 'clean' | 'contested'>('all');

  // Audit Modal state for clean partition batch reconciliation
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [selectedAuditIds, setSelectedAuditIds] = useState<Set<string>>(new Set());
  const [auditFilterText, setAuditFilterText] = useState<string>('');
  const [auditActing, setAuditActing] = useState<boolean>(false);
  const [recentBatch, setRecentBatch] = useState<{ id: string; count: number; date: string; ids: string[] } | null>(null);

  const [items, setItems] = useState<AdminReviewItem[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const currentRequestIdRef = React.useRef<number>(0);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Expanded evidence drawer states
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Expanded individual person meets in split cards: key = ${itemId}_
  const [expandedSplitMeets, setExpandedSplitMeets] = useState<Record<string, boolean>>({});

  // Staged in-line assignments for unassigned meets: itemId -> { [meetId]: personIdx (or empty string) }
  const [meetAssignments, setMeetAssignments] = useState<Record<string, Record<string | number, string | number>>>({});

  // Notes Modal state
  const [noteModalItem, setNoteModalItem] = useState<{ id: string; title: string; resolution: 'APPROVED' | 'REJECTED' } | null>(null);
  const [modalNotesText, setModalNotesText] = useState<string>('');

  // Former Name Public Profile Display Overrides: itemId -> boolean
  const [formerNameDisplayMap, setFormerNameDisplayMap] = useState<Record<string, boolean>>({});

  // IWF Duplicate Scorecard Repair Drawer state: key = `${item.id}_${sc.db_result_id}`
  const [iwfRepairModeMap, setIwfRepairModeMap] = useState<Record<string, 'split_new' | 'reassign_existing' | null>>({});
  const [iwfNewAthleteFormMap, setIwfNewAthleteFormMap] = useState<Record<string, {
    athlete_name: string;
    gender: string;
    country_code: string;
    country_name: string;
    birth_year: string;
    iwf_lifter_id: string;
  }>>({});
  const [iwfReassignTargetMap, setIwfReassignTargetMap] = useState<Record<string, string>>({});

  const getFormerNameDisplay = (item: AdminReviewItem): boolean => {
    if (formerNameDisplayMap[item.id] !== undefined) {
      return formerNameDisplayMap[item.id];
    }
    if (item.category === 'duplicate_profile' || item.category === 'data_hygiene_typo') {
      return false;
    }
    if (item.evidence?.display_former_name !== undefined) {
      return Boolean(item.evidence.display_former_name);
    }
    const primary = item.evidence?.primary_name || '';
    if (primary.includes('@') || /\d/.test(primary)) return false;
    return true;
  };

  const handleUpdateFormerNameDisplay = async (reviewId: string, display: boolean) => {
    setActionInProgress(reviewId);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          resolution: 'UPDATE_FORMER_NAME_DISPLAY',
          updatedEvidence: { display_former_name: display }
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update preference');
      setStatusNotice({ text: 'Former name display preference saved.', type: 'success' });
      setItems(prev => prev.map(item => item.id === reviewId ? {
        ...item,
        evidence: { ...item.evidence, display_former_name: display }
      } : item));
    } catch (err: any) {
      setStatusNotice({ text: err.message || 'Error updating preference', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Counts summary across all streams
  const [counts, setCounts] = useState<{
    total: number;
    homonym_split: number;
    homonym_clean?: number;
    homonym_contested?: number;
    name_change_merge: number;
    duplicate_profile: number;
    data_hygiene_typo: number;
    cross_federation: number;
    iwf_duplicate: number;
  }>({
    total: 0,
    homonym_split: 0,
    homonym_clean: 0,
    homonym_contested: 0,
    name_change_merge: 0,
    duplicate_profile: 0,
    data_hygiene_typo: 0,
    cross_federation: 0,
    iwf_duplicate: 0
  });

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchData = async () => {
    const requestId = ++currentRequestIdRef.current;
    setLoading(true);
    setStatusNotice(null);
    try {
      const params = new URLSearchParams({
        category: activeCategory,
        status: selectedStatus,
        page: page.toString(),
        limit: limit.toString()
      });
      if (activeCategory === 'homonym_split' && homonymSubsegment !== 'all') {
        params.set('subsegment', homonymSubsegment);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/admin/review-queue?${params.toString()}`);
      const data = await res.json();
      if (currentRequestIdRef.current !== requestId) return;
      if (data.success) {
        setItems(data.items || []);
        setTotalItems(data.total || 0);
        if (data.counts) {
          setCounts(data.counts);
        }
      } else {
        setStatusNotice({ text: data.error || 'Failed to fetch review queue', type: 'error' });
      }
    } catch (err: any) {
      if (currentRequestIdRef.current !== requestId) return;
      setStatusNotice({ text: err.message || 'Network error fetching reviews', type: 'error' });
    } finally {
      if (currentRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeCategory, selectedStatus, page, homonymSubsegment]);

  // Synchronize total review count to parent component post-commit without render-phase collisions
  useEffect(() => {
    if (onCountChange) {
      onCountChange(counts.total);
    }
  }, [counts.total, onCountChange]);

  // Handle Search submit / Enter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const toggleSplitMeets = (key: string) => {
    setExpandedSplitMeets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAssignMeet = (itemId: string, meetId: string | number, assignedValue: string) => {
    setMeetAssignments((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [meetId]: assignedValue === 'external' ? 'external' : (assignedValue === '' ? '' : Number(assignedValue))
      }
    }));
  };

  const buildUpdatedEvidenceForSplit = (item: AdminReviewItem) => {
    const itemOverrides = meetAssignments[item.id] || {};
    const ev = item.evidence || {};
    const splitPlan = ev.split_plan || {};
    const unMeets = splitPlan.unidentifiedCompetitions || [];
    const splits = splitPlan.splits || splitPlan.athletes || [];

    const updatedUnMeets = unMeets.map((un: any) => {
      const mid = un.meet_id || un.id;
      const isCandidateHolder = typeof un.current_person_index === 'number';
      const defaultVal = isCandidateHolder ? un.current_person_index : (un.external_holder ? 'external' : '');
      const chosenVal = itemOverrides[mid] !== undefined ? itemOverrides[mid] : (un.assigned_to ?? defaultVal);

      if (chosenVal === 'external') {
        return {
          ...un,
          assigned_to: 'external',
          assigned_person: null,
          assigned_membership: un.external_holder?.membership_number || null,
          donor_person: 'external',
          donor_lifter_id: un.external_holder?.lifter_id ?? un.current_lifter_id ?? null,
          target_lifter_id: un.external_holder?.lifter_id ?? null
        };
      }
      const targetIdx = Number(chosenVal);
      const targetPerson = splits[targetIdx];

      return {
        ...un,
        assigned_to: targetIdx,
        assigned_person: targetIdx + 1,
        assigned_membership: targetPerson
          ? (targetPerson.membershipNumber || targetPerson.membership_number || null)
          : null,
        donor_person: isCandidateHolder ? un.current_person_index + 1 : (un.external_holder ? 'external' : null),
        donor_lifter_id: un.current_lifter_id ?? un.external_holder?.lifter_id ?? null,
        target_lifter_id: targetPerson?.lifter_id ?? null
      };
    });

    return {
      ...ev,
      split_plan: {
        ...splitPlan,
        unidentifiedCompetitions: updatedUnMeets
      }
    };
  };

  const handleSavePlan = async (item: AdminReviewItem) => {
    const updatedEv = buildUpdatedEvidenceForSplit(item);
    setActionInProgress(item.id);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: item.id, resolution: 'UPDATE_PLAN', updatedEvidence: updatedEv })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save plan');

      setStatusNotice({
        text: 'Meet assignments saved to split plan successfully.',
        type: 'success'
      });

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, evidence: updatedEv } : i))
      );
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Audit Modal Data Fetcher
  const openCleanAuditModal = async () => {
    setIsAuditModalOpen(true);
    setAuditLoading(true);
    try {
      const res = await fetch('/api/admin/review-queue?mode=clean_audit');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setAuditItems(data.items);
        setSelectedAuditIds(new Set(data.items.map((i: any) => i.id)));
      } else {
        throw new Error(data.error || 'Failed to load clean partition items');
      }
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setAuditLoading(false);
    }
  };

  // Batch Approval for Clean Partitions
  const handleBatchApprove = async () => {
    const idsToApprove = Array.from(selectedAuditIds);
    if (idsToApprove.length === 0) return;
    setAuditActing(true);
    try {
      const res = await fetch('/api/admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewIds: idsToApprove, resolution: 'APPROVED' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Batch approval failed');

      setRecentBatch({
        id: Date.now().toString(),
        count: idsToApprove.length,
        date: new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
        ids: idsToApprove
      });

      setStatusNotice({
        text: `Clean partitions reconciled: ${idsToApprove.length} items marked as APPROVED.`,
        type: 'success'
      });

      setIsAuditModalOpen(false);
      fetchData();
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setAuditActing(false);
    }
  };

  // Batch Undo for Reverting Approved Batch
  const handleUndoBatch = async () => {
    if (!recentBatch || recentBatch.ids.length === 0) return;
    setActionInProgress('batch_undo');
    try {
      const res = await fetch('/api/admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewIds: recentBatch.ids, resolution: 'PENDING' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to undo batch');

      setStatusNotice({
        text: `Batch undone: ${recentBatch.ids.length} items restored back to PENDING.`,
        type: 'success'
      });

      setRecentBatch(null);
      fetchData();
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Resolve Review Item (or Revert to Pending)
  const handleResolve = async (
    reviewId: string,
    resolution: 'APPROVED' | 'REJECTED' | 'PENDING',
    notes?: string,
    updatedEvidence?: Record<string, any>
  ) => {
    setActionInProgress(reviewId);
    setStatusNotice(null);

    try {
      const res = await fetch('/api/admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, resolution, notes, updatedEvidence })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Resolution failed');

      const isRevert = resolution === 'PENDING';
      setStatusNotice({
        text: isRevert ? 'Review item reverted to pending.' : `Review item marked as ${resolution.toLowerCase()}.`,
        type: 'success'
      });

      // Update state
      if (selectedStatus === 'PENDING') {
        if (!isRevert) {
          setItems((prev) => prev.filter((item) => item.id !== reviewId));
          setTotalItems((prev) => Math.max(0, prev - 1));
        }
      } else if (isRevert) {
        setItems((prev) => prev.filter((item) => item.id !== reviewId));
        setTotalItems((prev) => Math.max(0, prev - 1));
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.id === reviewId
              ? {
                ...item,
                status: resolution,
                resolved_at: new Date().toISOString(),
                evidence: { ...(updatedEvidence || item.evidence), ...(notes ? { admin_notes: notes } : {}) }
              }
              : item
          )
        );
      }

      // Update counts
      setCounts((prev) => {
        const itemCat = items.find((i) => i.id === reviewId)?.category;
        const delta = isRevert ? 1 : -1;
        return {
          ...prev,
          total: Math.max(0, prev.total + delta),
          ...(itemCat ? { [itemCat]: Math.max(0, (prev[itemCat] || 0) + delta) } : {})
        };
      });
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setActionInProgress(null);
      setNoteModalItem(null);
      setModalNotesText('');
    }
  };

  // Real-time Database Status Check for IWF Duplicate Card
  const handleCheckIwfStatus = async (item: AdminReviewItem) => {
    setActionInProgress(item.id);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/admin/review-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: item.id, resolution: 'CHECK_IWF_STATUS' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to check database status');
      setStatusNotice({ text: data.message, type: data.verified ? 'success' : 'error' });
      if (Array.isArray(data.scorecards)) {
        setItems((prev) => prev.map((i) => i.id === item.id ? {
          ...i,
          evidence: {
            ...i.evidence,
            duplicate_scorecards: data.scorecards,
            last_status_check: {
              checked_at: new Date().toISOString(),
              scorecards_found: data.scorecardsFound,
              registered_categories: data.requiredCategories,
              is_complete: data.verified
            }
          }
        } : i));
      }
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Mark as Verified & Resolved (0 DB Modifications)
  const handleConfirmVerified = async (item: AdminReviewItem) => {
    await handleResolve(
      item.id,
      'APPROVED',
      'Database verified correct: all registered competition categories present in live records with 0 mutations.',
      { repair_action: 'CONFIRMED_OFFICIAL', verified_complete_in_db: true }
    );
  };

  // Trigger Targeted Local Puppeteer Re-Scrape for IWF Event
  const handleRescrapeIwfEvent = async (item: AdminReviewItem, year: string, eventId: string, athleteName: string) => {
    setActionInProgress(item.id);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/admin/iwf-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: year ? Number(year) : undefined,
          event_id: eventId,
          athlete_name: athleteName,
          force: true,
          dryRun: false
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to execute targeted re-scrape');
      setStatusNotice({ text: `Targeted re-scrape complete for ${athleteName} (Event #${eventId}). Re-checking database...`, type: 'success' });
      await handleCheckIwfStatus(item);
      fetchData();
    } catch (err: any) {
      setStatusNotice({ text: err.message, type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Confidence Score badge styling helper
  const getConfidenceBadge = (score: number | null) => {
    if (score === null || score === undefined) return null;
    let colorClasses = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    if (score >= 90) {
      colorClasses = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    } else if (score >= 70) {
      colorClasses = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${colorClasses}`}>
        Confidence: {score}%
      </span>
    );
  };

  // Category accent border helper for outer card definition
  const getCategoryAccentBorder = (category: string) => {
    switch (category) {
      case 'iwf_duplicate':
        return 'border-l-2 border-l-amber-500';
      case 'homonym_split':
        return 'border-l-2 border-l-indigo-500';
      case 'name_change_merge':
        return 'border-l-2 border-l-emerald-500';
      case 'duplicate_profile':
        return 'border-l-2 border-l-sky-500';
      case 'data_hygiene_typo':
        return 'border-l-2 border-l-rose-500';
      case 'cross_federation':
        return 'border-l-2 border-l-purple-500';
      default:
        return 'border-l-2 border-l-app-primary';
    }
  };

  // Extensible, source-aware provenance telemetry resolver
  const getProvenanceTelemetry = (item: AdminReviewItem) => {
    const ev = item.evidence || {};
    // 1. User / Community Flag
    if (ev.flagged_by || ev.source_type === 'user' || ev.source_type === 'user_report' || (item as any).source === 'user') {
      const reporter = ev.reporter_name || ev.flagged_by || 'Registered User';
      return {
        label: `Reported by ${reporter} • ${formatEasternDateTime(item.created_at)}`,
        title: 'Flagged by a registered user dispute/report on the platform.'
      };
    }
    // 2. Automated Pipelines & Baseline Seeders
    if (item.category === 'iwf_duplicate' || ev.source_type === 'seeder') {
      const pairText = ev.pair_id ? ` • Pair #${ev.pair_id}` : '';
      return {
        label: `Historical Catalog Seeder (DUPLICATE_DATA_CORRECTION.json${pairText}) • Staged: ${formatEasternDateTime(item.created_at)}`,
        title: 'Cataloged from the 14 historical multi-category same-meet collision pairs identified during the October 31, 2025 database audit.'
      };
    }
    if (item.category === 'cross_federation') {
      return {
        label: `Daily Cross-Federation Discovery Pipeline (5:00 PM EST) • Staged: ${formatEasternDateTime(item.created_at)}`,
        title: 'Flagged in the 60–79% match confidence band by link-new-iwf-athletes.js.'
      };
    }
    if (['name_change_merge', 'duplicate_profile', 'data_hygiene_typo'].includes(item.category)) {
      return {
        label: `USAW Daily Discovery Pipeline • Staged: ${formatEasternDateTime(item.created_at)}`,
        title: 'Evaluated by scan-usaw-name-changes.js across accounts sharing identical USAW membership numbers.'
      };
    }
    if (item.category === 'homonym_split') {
      return {
        label: `Daily Homonym Scanner (4:00 AM EST) • Staged: ${formatEasternDateTime(item.created_at)}`,
        title: 'Flagged by contamination-cleanup-master.js where a single lifter_id is attached to multiple membership numbers.'
      };
    }
    // 3. Extensible Default / Fallback
    return {
      label: `Staged for Review: ${formatEasternDateTime(item.created_at)}`,
      title: 'Timestamp when this item was detected and staged in the administrative review queue.'
    };
  };

  return (
    <div className="w-full space-y-5">
      {/* Unified Administrative Dashboard Header Card */}
      <div className="card-primary space-y-4 p-4 sm:p-5">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-app-primary flex items-center gap-2">
                Multi-Stream Data Quality &amp; Identity Review Dashboard
                {counts.total > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {counts.total.toLocaleString()} Staged
                  </span>
                )}
              </h3>
              <p className="text-xs text-app-secondary">
                Persistent identity queue: homonym splits, marriage/name changes, cross-federation links, and international duplicate entries.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              fetchData();
            }}
            disabled={loading}
            className="p-2 text-app-secondary hover:text-app-primary rounded-lg hover:bg-app-hover transition disabled:opacity-50"
            title="Refresh Review Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 2. Stream Metric Badges & Category Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {/* All Categories */}
          <button
            onClick={() => {
              setActiveCategory('all');
              setPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-full ${activeCategory === 'all'
              ? 'bg-app-secondary border-indigo-500 shadow-md ring-1 ring-indigo-500/20 text-app-primary'
              : 'bg-white/[0.02] hover:bg-white/[0.06] border-app-primary text-app-secondary'
              }`}
          >
            <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
              <span className="text-xs font-semibold text-app-primary leading-snug">All Review Categories</span>
              <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-app-primary">
                {counts.total.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-muted mt-0.5 leading-snug">Complete athlete identity review queue</div>
            </div>
          </button>

          {/* Stream 1: USAW Athletes Sharing a Name */}
          <button
            onClick={() => {
              setActiveCategory('homonym_split');
              setPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-full ${activeCategory === 'homonym_split'
              ? 'bg-app-secondary border-indigo-500 shadow-md ring-1 ring-indigo-500/20 text-app-primary'
              : 'bg-white/[0.02] hover:bg-white/[0.06] border-app-primary text-app-secondary'
              }`}
          >
            <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
              <span className="text-xs font-semibold text-app-primary leading-snug">USAW Athletes Sharing a Name</span>
              <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0">
                <GitFork className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-indigo-500 dark:text-indigo-300">
                {counts.homonym_split.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-muted mt-0.5 leading-snug">Separate distinct lifters with identical names into individual profiles</div>
            </div>
          </button>

          {/* Stream 2: USAW Athlete Name Changes */}
          <button
            onClick={() => {
              setActiveCategory('name_change_merge');
              setPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-full ${activeCategory === 'name_change_merge'
              ? 'bg-app-secondary border-emerald-500 shadow-md ring-1 ring-emerald-500/20 text-app-primary'
              : 'bg-white/[0.02] hover:bg-white/[0.06] border-app-primary text-app-secondary'
              }`}
          >
            <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
              <span className="text-xs font-semibold text-app-primary leading-snug">USAW Athlete Name Changes</span>
              <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0">
                <UserCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-emerald-500 dark:text-emerald-300">
                {counts.name_change_merge.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-muted mt-0.5 leading-snug">Link past competition history to an athlete's updated official name</div>
            </div>
          </button>

          {/* Stream 3: USAW Fractured Athlete Profiles */}
          <button
            onClick={() => {
              setActiveCategory('duplicate_profile');
              setPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-full ${activeCategory === 'duplicate_profile'
              ? 'bg-app-secondary border-sky-500 shadow-md ring-1 ring-sky-500/20 text-app-primary'
              : 'bg-white/[0.02] hover:bg-white/[0.06] border-app-primary text-app-secondary'
              }`}
          >
            <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
              <span className="text-xs font-semibold text-app-primary leading-snug">USAW Fractured Athlete Profiles</span>
              <span className="p-1 rounded-md bg-sky-500/10 text-sky-400 shrink-0">
                <Copy className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-sky-500 dark:text-sky-300">
                {counts.duplicate_profile.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-muted mt-0.5 leading-snug">Consolidate multiple database records for the same lifter so all competition history displays on one page</div>
            </div>
          </button>

          {/* Stream 4: USAW Name Typo Corrections */}
          <button
            onClick={() => {
              setActiveCategory('data_hygiene_typo');
              setPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-full ${activeCategory === 'data_hygiene_typo'
              ? 'bg-app-secondary border-rose-500 shadow-md ring-1 ring-rose-500/20 text-app-primary'
              : 'bg-white/[0.02] hover:bg-white/[0.06] border-app-primary text-app-secondary'
              }`}
          >
            <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
              <span className="text-xs font-semibold text-app-primary leading-snug">USAW Name Typo Corrections</span>
              <span className="p-1 rounded-md bg-rose-500/10 text-rose-400 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-rose-500 dark:text-rose-300">
                {counts.data_hygiene_typo.toLocaleString()}
              </div>
              <div className="text-[10px] text-app-muted mt-0.5 leading-snug">Fix misspelled names and email address artifacts</div>
            </div>
          </button>

          {/* Stream 5: Cross-Federation Athlete Linking */}
          <button
            onClick={() => {
              setActiveCategory('cross_federation');
              setPage(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-full ${activeCategory === 'cross_federation'
              ? 'bg-app-secondary border-indigo-500 shadow-md ring-1 ring-indigo-500/20 text-app-primary'
              : 'bg-white/[0.02] hover:bg-white/[0.06] border-app-primary text-app-secondary'
              }`}
          >
            <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
              <span className="text-xs font-semibold text-app-primary leading-snug">Cross-Federation Athlete Linking</span>
              <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0">
                <Globe className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-indigo-500 dark:text-indigo-300">
                {counts.cross_federation}
              </div>
              <div className="text-[10px] text-app-muted mt-0.5 leading-snug">Unify an athlete's profiles across federations and meet management platforms</div>
            </div>
          </button>

          {/* Stream 6: IWF Multi-Result Athlete Reviews */}
          <button
            onClick={() => {
              if (activeCategory === 'iwf_duplicate') {
                fetchData();
              } else {
                setActiveCategory('iwf_duplicate');
                setPage(1);
              }
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-full ${activeCategory === 'iwf_duplicate'
              ? 'bg-app-secondary border-amber-500 shadow-md ring-1 ring-amber-500/20 text-app-primary'
              : 'bg-white/[0.02] hover:bg-white/[0.06] border-app-primary text-app-secondary'
              }`}
            title="Competitions where multiple distinct meet results share identical or closely matching athlete names. Requires administrator review to determine whether these results represent one athlete competing multiple times or distinct individuals sharing a name."
          >
            <div className="flex items-start justify-between gap-1.5 min-h-[2.5rem]">
              <span className="text-xs font-semibold text-app-primary leading-snug">IWF Multi-Result Athlete Reviews</span>
              <span className="p-1 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                <Scale className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-amber-500 dark:text-amber-300">
                {counts.iwf_duplicate}
              </div>
              <div className="text-[10px] text-app-muted mt-0.5 leading-snug">Verify lifters with multiple entries or matching names in a single meet</div>
            </div>
          </button>
        </div>

        {/* Bottom Row: Search & Status Filters Integrated Within Header Card */}
        <div className="pt-3 border-t border-app-primary flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-app-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search athlete, member #, or meet..."
              className="w-full pl-9 pr-8 py-1.5 bg-white/[0.02] border border-app-primary rounded-lg text-xs text-app-primary placeholder:text-app-muted focus:outline-none focus:border-accent-primary focus:bg-white/[0.05]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded-lg border border-app-primary self-stretch sm:self-auto justify-center">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as ReviewStatus[]).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setSelectedStatus(st);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${selectedStatus === st
                  ? 'bg-app-secondary text-app-primary shadow-sm border border-app-primary'
                  : 'text-app-secondary hover:text-app-primary hover:bg-app-hover'
                  }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Homonym Subsegment Filter & Clean Reconciliation Banner */}
      {activeCategory === 'homonym_split' && (
        <div className="p-3 card-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-app-muted mr-1">View:</span>
            <button
              onClick={() => {
                setHomonymSubsegment('all');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${homonymSubsegment === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white/[0.02] hover:bg-white/[0.06] border border-app-primary text-app-secondary'
                }`}
            >
              All Homonym Groups ({counts.homonym_split?.toLocaleString() ?? 0})
            </button>
            <button
              onClick={() => {
                setHomonymSubsegment('contested');
                setPage(1);
              }}
              className={`group relative px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 ${homonymSubsegment === 'contested'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-white/[0.02] hover:bg-white/[0.06] border border-app-primary text-app-secondary'
                }`}
            >
              <span>Splits with Flagged Competitions ({counts.homonym_contested?.toLocaleString() ?? 0})</span>
              <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-300 opacity-80 group-hover:opacity-100 flex-shrink-0" />
              <span className="pointer-events-none absolute left-0 top-full mt-1.5 w-64 rounded-lg bg-app-secondary border border-app-primary text-app-primary p-2 text-[10px] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 normal-case font-normal text-left">
                Shared-name athlete groups containing one or more competitions that could not be linked to a membership number and require attribution review.
              </span>
            </button>
            <button
              onClick={() => {
                setHomonymSubsegment('clean');
                setPage(1);
              }}
              className={`group relative px-2.5 py-1 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 ${homonymSubsegment === 'clean'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-white/[0.02] hover:bg-white/[0.06] border border-app-primary text-app-secondary'
                }`}
            >
              <span>Zero-Conflict Identity Splits ({counts.homonym_clean?.toLocaleString() ?? 0})</span>
              <Info className="w-3 h-3 text-emerald-500 dark:text-emerald-300 opacity-80 group-hover:opacity-100 flex-shrink-0" />
              <span className="pointer-events-none absolute right-0 top-full mt-1.5 w-72 rounded-lg bg-app-secondary border border-app-primary text-app-primary p-2 text-[10px] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 normal-case font-normal text-left">
                Shared-name athlete groups where 100% of historical competitions are already linked to verified USA Weightlifting membership numbers. Approving establishes separate profiles without moving any scorecards.
              </span>
            </button>
          </div>

          {selectedStatus === 'PENDING' && (
            <button
              onClick={openCleanAuditModal}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1.5 shadow-sm"
              title="Review and batch-resolve homonym groups where all historical competitions are already linked to verified candidate profiles"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Audit & Batch-Resolve Zero-Conflict Splits</span>
            </button>
          )}
        </div>
      )}

      {/* Batch Undo Banner for Approved items */}
      {selectedStatus === 'APPROVED' && recentBatch && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>
              <strong>Recent Batch:</strong> {recentBatch.count} items approved at {recentBatch.date} EDT.
            </span>
          </div>
          <button
            onClick={handleUndoBatch}
            disabled={actionInProgress === 'batch_undo'}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 shadow disabled:opacity-50"
          >
            {actionInProgress === 'batch_undo' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            <span>Undo Batch & Restore All to Pending</span>
          </button>
        </div>
      )}

      {/* 4. Global Status Notice */}
      {statusNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${statusNotice.type === 'success'
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

      {/* 5. Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-2xl card-primary text-app-secondary space-y-2 shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
          <p className="text-xs">Loading queue items...</p>
        </div>
      )}

      {/* 6. Empty State */}
      {!loading && items.length === 0 && (
        <div className="p-12 text-center rounded-2xl card-primary text-app-secondary space-y-2 shadow-sm">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h4 className="text-sm font-semibold text-app-primary">No Review Items Found</h4>
          <p className="text-xs text-app-muted max-w-md mx-auto">
            {searchQuery
              ? `No results matching "${searchQuery}" in ${activeCategory} (${selectedStatus}).`
              : `All items under ${activeCategory} with status ${selectedStatus} have been resolved.`}
          </p>
        </div>
      )}

      {/* 7. Review Cards List */}
      {!loading && items.length > 0 && (
        <div className="space-y-6">
          {items.map((item) => {
            const isActing = actionInProgress === item.id;
            const isExpanded = expandedCards[item.id] ?? false;
            const ev = item.evidence || {};

            return (
              <div
                key={item.id}
                className={`card-primary space-y-4 p-5 rounded-2xl transition hover:border-app-hover shadow-lg hover:shadow-xl dark:shadow-2xl dark:shadow-black/60 ${getCategoryAccentBorder(item.category)}`}
              >
                {/* Top Row: Title, Confidence, Category Chip, and Actions */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-app-primary">
                        {item.category === 'homonym_split' && (ev.operation_type === 'scorecard_attribution' || item.title.includes('Collapsed'))
                          ? `${ev.athlete_name || ev.split_plan?.originalAthleteName || 'Athlete'} (Scorecard Attribution Across ${(ev.split_plan?.splits || ev.split_plan?.athletes || []).length || 4} Distinct Athletes)`
                          : item.category === 'iwf_duplicate'
                            ? `${ev.athlete_name || item.title.replace(/^IWF Same-Meet Duplicate:\s*/i, '').split('(')[0].trim()}${ev.db_lifter_id ? ` (Database Lifter #${ev.db_lifter_id})` : ''} • ${ev.iwf_meet_id ? `Official IWF Event #${ev.iwf_meet_id}` : `Database Meet #${ev.db_meet_id || 'Unknown'}`}`
                            : item.title}
                      </span>
                      {item.category === 'duplicate_profile' ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                          title="Two separate lifter records exist in the database for this member number with the same name. Approving will merge all scorecards onto a single canonical profile."
                        >
                          Issue: Duplicate Profile Records
                        </span>
                      ) : item.category === 'data_hygiene_typo' ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                          title="An email address, numeric token, or clerical error was recorded as the lifter name. Approving will sanitize the name and consolidate scorecards to the verified member record."
                        >
                          Issue: Roster Data Artifact
                        </span>
                      ) : item.category === 'name_change_merge' ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                          title="Competitions exist under two different names for this athlete. Approving preserves former-name timeline provenance on the athlete's public profile."
                        >
                          Issue: Athlete Name Transition
                        </span>
                      ) : item.category === 'iwf_duplicate' ? (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          title="Multiple distinct meet results with identical or closely matching athlete names were recorded in this single competition. Review whether these represent one athlete contesting dual weight classes or distinct individuals."
                        >
                          Issue: Same-Meet Name Collision
                        </span>
                      ) : (
                        <>
                          {item.category !== 'homonym_split' && getConfidenceBadge(item.confidence_score)}
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-app-tertiary text-app-secondary border border-app-primary"
                            title={
                              item.category === 'homonym_split'
                                ? 'Separation of distinct athletes who share the same name'
                                : 'Linking domestic USAW and international IWF profiles for the same athlete'
                            }
                          >
                            {item.category === 'homonym_split'
                              ? 'Shared-Name Separation'
                              : 'Cross-Federation Alias'}
                          </span>
                        </>
                      )}
                      {ev.operation_type && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${ev.operation_type === 'scorecard_attribution'
                          ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60'
                          : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60'
                          }`}>
                          {ev.operation_type === 'scorecard_attribution'
                            ? 'Scorecard Attribution'
                            : 'Identity Split'}
                        </span>
                      )}
                      {(() => {
                        if (item.status === 'PENDING') {
                          return (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              title="Item is staged and pending administrative decision."
                            >
                              Status: Pending Review
                            </span>
                          );
                        }
                        let statusText = item.status;
                        let statusTitle = '';
                        if (item.status === 'APPROVED') {
                          if (item.category === 'name_change_merge') {
                            const canonical = ev.candidate_name || ev.canonical_name || 'Canonical Profile';
                            statusText = `Merged into ${canonical}`;
                            statusTitle = `Historical competition results were reassigned to ${canonical}, duplicate record removed, and public profile former-name notice updated.`;
                          } else if (item.category === 'duplicate_profile') {
                            statusText = 'Consolidated into Single Profile';
                            statusTitle = 'All split competition results were consolidated onto a single profile and duplicate lifter records removed.';
                          } else if (item.category === 'data_hygiene_typo') {
                            statusText = 'Name Sanitized & Consolidated';
                            statusTitle = 'Invalid scraper artifacts sanitized and competition results consolidated onto the official member profile.';
                          } else if (item.category === 'homonym_split') {
                            statusText = 'Identities Established';
                            statusTitle = 'Separate athlete profiles established in database.';
                          } else if (item.category === 'cross_federation') {
                            statusText = 'Federation Profiles Linked';
                            statusTitle = 'USAW and IWF profiles linked in athlete_aliases.';
                          } else if (item.category === 'iwf_duplicate') {
                            const actionType = ev.repair_execution?.action_type;
                            if (actionType === 'NEW_ATHLETE_CREATED') {
                              statusText = `Split to New Profile (#${ev.repair_execution.provisioned_db_lifter_id})`;
                              statusTitle = 'Meet result reassigned to newly provisioned IWF athlete profile with manual_override lock.';
                            } else if (actionType === 'SCORECARD_REASSIGNED') {
                              statusText = 'Result Reassigned';
                              statusTitle = 'Meet result re-attributed to existing IWF athlete profile with manual_override lock.';
                            } else if (actionType === 'SCORECARD_PURGED') {
                              statusText = 'Erroneous Result Deleted';
                              statusTitle = 'Erroneous meet result removed from iwf_meet_results with backup snapshot stored in evidence.';
                            } else {
                              statusText = 'Dual Entry Confirmed (Resolved)';
                              statusTitle = 'Dual weight-class entries verified as legitimately belonging to this single athlete.';
                            }
                          }
                        } else if (item.status === 'REJECTED') {
                          statusText = 'Flag Dismissed (Database Unchanged)';
                          statusTitle = 'The flag was dismissed and no database records were modified.';
                        }

                        return (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${item.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : item.status === 'RESOLVED'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              }`}
                            title={statusTitle}
                          >
                            {statusText}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-[11px] text-app-muted flex items-center gap-2 flex-wrap">
                      {(() => {
                        const prov = getProvenanceTelemetry(item);
                        return (
                          <span
                            className="cursor-help underline decoration-dotted decoration-app-muted"
                            title={prov.title}
                          >
                            {prov.label}
                          </span>
                        );
                      })()}
                      {item.resolved_at && (
                        <>
                          <span>•</span>
                          <span className="text-app-secondary">
                            {item.status === 'APPROVED' ? 'Approved' : 'Resolved'}
                            {item.resolved_by ? ` by ${item.resolved_by}` : ''} on {formatEasternDateTime(item.resolved_at)}
                          </span>
                        </>
                      )}
                      {ev.admin_notes && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-600 dark:text-indigo-300 flex items-center gap-1 font-medium">
                            <FileText className="w-3 h-3" /> Note attached
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Header */}
                  <div className="flex items-center gap-2">
                    {/* Add Notes Button */}
                    <button
                      onClick={() => {
                        setNoteModalItem({ id: item.id, title: item.title, resolution: 'APPROVED' });
                        setModalNotesText(ev.admin_notes || '');
                      }}
                      className="p-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-app-primary transition"
                      title="Add Reviewer Notes"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    {item.status === 'PENDING' && (
                      <>
                        {item.category === 'homonym_split' ? (
                          <button
                            onClick={() => {
                              const updatedEv = buildUpdatedEvidenceForSplit(item);
                              handleResolve(item.id, 'APPROVED', undefined, updatedEv);
                            }}
                            disabled={isActing}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                            title="Executes the competition result reassignments in the database and triggers athlete profile rebuilds"
                          >
                            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>Approve Result Attribution</span>
                          </button>
                        ) : item.category === 'iwf_duplicate' ? null : (
                          <button
                            onClick={() => {
                              const extraEv = item.category === 'name_change_merge'
                                ? { display_former_name: getFormerNameDisplay(item) }
                                : undefined;
                              handleResolve(item.id, 'APPROVED', undefined, extraEv);
                            }}
                            disabled={isActing}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                            title={
                              item.category === 'name_change_merge'
                                ? `Consolidates all historical competition results under ${ev.candidate_name || 'canonical profile'}, archives the duplicate record, and rebuilds athlete profile`
                                : item.category === 'duplicate_profile'
                                  ? 'Consolidates split competition results onto the primary member profile and deletes the duplicate row'
                                  : 'Sanitizes corrupt scraper artifacts and consolidates competition results onto the verified member profile'
                            }
                          >
                            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>{(() => {
                              if (item.category === 'duplicate_profile') return 'Approve Profile Consolidation';
                              if (item.category === 'data_hygiene_typo') return 'Approve Data Sanitization';
                              if (item.category === 'name_change_merge') return 'Approve Name Change & Merge';
                              return 'Approve';
                            })()}</span>
                          </button>
                        )}
                        {item.category !== 'iwf_duplicate' && (
                          <button
                            onClick={() => handleResolve(item.id, 'REJECTED')}
                            disabled={isActing}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-rose-400 transition flex items-center gap-1.5 disabled:opacity-50"
                            title="Declines the suggestion and leaves all database records untouched"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Proposal (Leave Database Unchanged)</span>
                          </button>
                        )}
                      </>
                    )}

                    {item.status !== 'PENDING' && (
                      <button
                        onClick={() => handleResolve(item.id, 'PENDING')}
                        disabled={isActing}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
                        title="Revert this item back to Pending status"
                      >
                        {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        <span>Revert to Pending</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Stream-Specific Content Body */}

                {/* 1. Stream: homonym_split */}
                {item.category === 'homonym_split' && (() => {
                  const splitPlan = ev.split_plan || {};
                  const splitsList: any[] = splitPlan.splits || splitPlan.athletes || [];
                  const unidentifiedMeets: any[] = splitPlan.unidentifiedCompetitions || [];
                  const athleteName = ev.athlete_name || splitPlan.originalAthleteName || item.title;
                  const itemAssignments = meetAssignments[item.id] || {};
                  const hasUnsavedAssignments = Object.keys(itemAssignments).length > 0;
                  const originalInternalId = ev.primary_internal_id || ev.original_internal_id;
                  const liveTotalMeets = splitsList.reduce((acc: number, s: any) => acc + (typeof s.live_meet_count === 'number' ? s.live_meet_count : 0), 0);
                  const sortedContestedMeets = [...unidentifiedMeets].sort((a: any, b: any) => {
                    const dateA = a.date ? new Date(a.date).getTime() : 0;
                    const dateB = b.date ? new Date(b.date).getTime() : 0;
                    return dateA - dateB;
                  });

                  return (
                    <div className="space-y-3.5">
                      {/* Review Brief Banner */}
                      <div className="p-3 bg-indigo-950/20 border border-indigo-500/25 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-indigo-400">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Review Brief</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-app-secondary">
                          <div>
                            <span className="font-semibold text-app-muted">Issue:</span> {splitsList.length} distinct athletes share the name "{athleteName}".
                          </div>
                          <div>
                            <span className="font-semibold text-app-muted">Task:</span> {unidentifiedMeets.length === 0
                              ? `Confirm identity separation into ${splitsList.length} distinct athlete profiles. All ${liveTotalMeets} competitions are already linked to verified USAW membership numbers.`
                              : `Review ${unidentifiedMeets.length} competition${unidentifiedMeets.length === 1 ? '' : 's'} where official records omitted membership numbers, and confirm or reassign attribution.`}
                          </div>
                          <div>
                            <span className="font-semibold text-app-muted">Action on Approval:</span> {unidentifiedMeets.length === 0
                              ? `Establishes ${splitsList.length} individual athlete profile pages without moving any competition scorecards.`
                              : `Applies your scorecard assignments in the database and establishes the distinct athlete profiles.`}
                          </div>
                        </div>
                      </div>

                      {/* Original Collapsed Athlete Dossier Row */}
                      <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs flex-wrap gap-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-app-muted uppercase tracking-wide">
                            {item.primary_entity_id > 0 ? "Primary Entity Record:" : "Shared Name Group:"}
                          </span>
                          {item.primary_entity_id > 0 ? (
                            <>
                              <Link
                                href={`/athlete/u-${item.primary_entity_id}`}
                                target="_blank"
                                className="font-bold text-app-primary hover:text-indigo-400 hover:underline inline-flex items-center gap-1"
                                title="View primary profile on our site"
                              >
                                {athleteName}
                                <ExternalLink className="w-3 h-3 text-app-muted" />
                              </Link>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-app-secondary text-app-secondary border border-app-primary">
                                Internal #u-{item.primary_entity_id}
                              </span>
                            </>
                          ) : (
                            <Link
                              href={`/athlete/${ev.name_slug || encodeURIComponent(athleteName.toLowerCase().trim().replace(/\s+/g, '-'))}`}
                              target="_blank"
                              className="font-bold text-app-primary hover:text-indigo-400 hover:underline inline-flex items-center gap-1"
                              title="View name disambiguation on our site"
                            >
                              {athleteName}
                              <ExternalLink className="w-3 h-3 text-app-muted" />
                            </Link>
                          )}
                          {originalInternalId && (
                            <a
                              href={`https://usaweightlifting.sport80.com/public/rankings/member/${originalInternalId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 text-[10px] font-medium"
                              title="Official USAW / Sport80 Member Ranking Profile"
                            >
                              Sport80 #{originalInternalId} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-app-secondary flex-wrap">
                          <span>Candidate Profiles: <strong className="text-indigo-400">{splitsList.length || 2}</strong></span>
                          <span>•</span>
                          <span>Total Competitions: <strong className="text-app-primary">{liveTotalMeets || ev.total_competitions || '-'}</strong></span>
                          <span>•</span>
                          <span className="group relative inline-flex items-center">
                            <span className="text-emerald-400 font-semibold cursor-help">
                              {(liveTotalMeets ? liveTotalMeets - unidentifiedMeets.length : 0)} Linked by Member #
                            </span>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 pointer-events-none transition-opacity duration-75 delay-0">
                              <span className="block bg-app-secondary border border-app-primary text-app-primary text-[10px] rounded px-2 py-1 shadow-xl whitespace-nowrap">
                                Competitions attributed directly to this athlete's official USA Weightlifting membership number
                              </span>
                            </span>
                          </span>
                          <span>•</span>
                          <span className="group relative inline-flex items-center">
                            <span className={`${unidentifiedMeets.length > 0 ? 'text-amber-400' : 'text-app-muted'} font-semibold cursor-help`}>
                              {unidentifiedMeets.length} Flagged for Review
                            </span>
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-30 pointer-events-none transition-opacity duration-75 delay-0">
                              <span className="block bg-app-secondary border border-app-primary text-app-primary text-[10px] rounded px-2 py-1 shadow-xl whitespace-nowrap">
                                Competitions in the live database that could not be linked to a membership number
                              </span>
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Distinct Athlete Split Cards */}
                      <div className={`grid ${splitsList.length <= 1 ? 'grid-cols-1 max-w-md' :
                        splitsList.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                          splitsList.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                            splitsList.length === 4 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' :
                              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        } gap-3`}>
                        {splitsList.map((split: any, sIdx: number) => {
                          const internalId = split.internal_id || (ev.internal_ids && ev.internal_ids[sIdx]);
                          const membershipNum = split.membershipNumber || split.membership_number;
                          const isAnchor = ev.anchor_lifter_id ? (split.lifter_id === ev.anchor_lifter_id) : (sIdx === 0);
                          const athleteHref = membershipNum ? `/athlete/${membershipNum}` : (internalId ? `/athlete/u-${internalId}` : null);
                          const meetsCount = split.competitionCount || split.competition_count || (split.meets ? split.meets.length : '-');
                          const splitMeets: any[] = split.meets || split.competitions || [];
                          const isSplitMeetsExpanded = expandedSplitMeets[`${item.id}_${sIdx}`] ?? false;

                          return (
                            <div key={sIdx} className="p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl space-y-2 hover:border-app-hover shadow-sm transition">
                              <div className="flex items-start justify-between gap-1">
                                <div className="space-y-0.5">
                                  {athleteHref ? (
                                    <Link
                                      href={athleteHref}
                                      target="_blank"
                                      className="text-xs font-bold text-app-primary hover:text-indigo-400 hover:underline flex items-center gap-1"
                                      title="View athlete profile on our site"
                                    >
                                      {split.newAthleteName || `Person ${sIdx + 1}`}
                                      <ExternalLink className="w-2.5 h-2.5 text-app-muted" />
                                    </Link>
                                  ) : (
                                    <span className="text-xs font-bold text-app-primary">
                                      {split.newAthleteName || `Person ${sIdx + 1}`}
                                    </span>
                                  )}
                                  <div className="text-[10px] text-app-muted font-medium">
                                    Person {sIdx + 1}
                                  </div>
                                  {(split.club_name || split.wso) && (
                                    <div className="text-[9px] text-app-muted truncate max-w-[160px]" title={[split.club_name, split.wso].filter(Boolean).join(' • ')}>
                                      {[split.club_name, split.wso].filter(Boolean).join(' • ')}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {membershipNum && (
                                    <span
                                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-800/50"
                                      title={`USAW Membership Number: ${membershipNum}`}
                                    >
                                      USAW Member #{membershipNum}
                                    </span>
                                  )}

                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-app-primary flex-wrap gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {splitMeets.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleSplitMeets(`${item.id}_${sIdx}`)}
                                      className="group relative inline-flex items-center gap-1 text-indigo-400 hover:text-white font-medium transition"
                                    >
                                      <span>Linked by Member #: {meetsCount}</span>
                                      {isSplitMeetsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      <span className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-30 pointer-events-none transition-opacity duration-75 delay-0">
                                        <span className="block bg-app-secondary border border-app-primary text-app-primary text-[10px] rounded px-2 py-1 shadow-xl whitespace-nowrap">
                                          Competitions attributed directly to this athlete's official USA Weightlifting membership number
                                        </span>
                                      </span>
                                    </button>
                                  ) : (
                                    <span className="group relative inline-flex items-center text-app-muted font-medium">
                                      <span>Linked by Member #: {meetsCount}</span>
                                      <span className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-30 pointer-events-none transition-opacity duration-75 delay-0">
                                        <span className="block bg-app-secondary border border-app-primary text-app-primary text-[10px] rounded px-2 py-1 shadow-xl whitespace-nowrap">
                                          Competitions attributed directly to this athlete's official USA Weightlifting membership number
                                        </span>
                                      </span>
                                    </span>
                                  )}
                                  {split.live_meet_count !== undefined && split.live_meet_count !== null && (
                                    <span className="group relative inline-flex items-center">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-app-secondary text-app-secondary border border-app-primary cursor-help">
                                        Total in Database: {split.live_meet_count} Meets
                                      </span>
                                      <span className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-30 pointer-events-none transition-opacity duration-75 delay-0">
                                        <span className="block bg-app-secondary border border-app-primary text-app-primary text-[10px] rounded px-2 py-1 shadow-xl whitespace-nowrap">
                                          Total competition scorecards currently saved in the live database for this profile
                                        </span>
                                      </span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {internalId && (
                                    <a
                                      href={`https://usaweightlifting.sport80.com/public/rankings/member/${internalId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 text-[10px] font-medium"
                                      title="Official USAW / Sport80 Member Ranking Profile"
                                    >
                                      USAW Sport80 #{internalId} <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                  {split.linked_iwf_id && (
                                    <a
                                      href={`https://iwf.sport/weightlifting_/athletes-bios/?athlete_id=${split.linked_iwf_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 text-[10px] font-medium"
                                      title="Official International Weightlifting Federation (IWF) Bio"
                                    >
                                      IWF Bio #{split.linked_iwf_id} <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Collapsible Meet List for this Person if available in JSON */}
                              {isSplitMeetsExpanded && splitMeets.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-app-primary space-y-1.5 max-h-52 overflow-y-auto pr-1">
                                  {splitMeets.map((m: any, mIdx: number) => {
                                    const mId = typeof m === 'number' || typeof m === 'string'
                                      ? Number(m)
                                      : Number(m?.meet_id ?? m?.meetId ?? m?.id ?? m?.competition_id ?? m?.competitionId ?? m?.db_meet_id);
                                    const mDate = typeof m === 'object' && m !== null
                                      ? (m.date ?? m.meet_date ?? m.meetDate ?? m.competition_date)
                                      : null;
                                    const mName = typeof m === 'object' && m !== null ? m.meet_name : null;
                                    const mUrl = typeof m === 'object' && m !== null ? (m.sport80Url || m.sport80_url || m.meet_url) : null;
                                    const mCategory = typeof m === 'object' && m !== null
                                      ? (m.weight_class ?? m.weightClass ?? m.category ?? m.division ?? '')
                                      : '';
                                    return (
                                      <div key={mIdx} className="text-[10px] text-app-secondary flex items-center justify-between bg-white/[0.02] p-1.5 rounded border border-white/5 gap-2">
                                        <div className="flex items-center gap-1.5 truncate">
                                          {mId ? (
                                            <Link
                                              href={`/meet/${mId}`}
                                              target="_blank"
                                              className="font-semibold text-sky-400 hover:underline flex items-center gap-0.5"
                                              title={mName ? `Meet #${mId}: ${mName}` : `Meet #${mId}`}
                                            >
                                              Meet #{mId}{mName ? `: ${mName}` : ''}
                                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                            </Link>
                                          ) : (
                                            <span className="font-semibold text-app-muted">
                                              {mName || 'Meet (Unspecified ID)'}
                                            </span>
                                          )}
                                          {mDate && <span className="text-app-muted">({formatDisplayDate(mDate)})</span>}
                                          {mCategory && <span className="text-app-muted text-[9px] shrink-0">• {mCategory}</span>}
                                        </div>
                                        {mUrl && (
                                          <a
                                            href={mUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5 text-[9px] font-medium shrink-0"
                                            title="Official Sport80 Meet Results Page"
                                          >
                                            Sport80 Results <ExternalLink className="w-2 h-2" />
                                          </a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Backend Execution Summary when item is RESOLVED */}
                      {item.status === 'RESOLVED' && ev.execution_summary && (
                        <div className="p-3 bg-sky-50 border border-sky-200 dark:bg-sky-950/20 dark:border-sky-800/40 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>Execution Completed: {formatEasternDateTime(ev.execution_summary.executed_at)}</span>
                          </div>
                          <div className="text-[11px] text-sky-800 dark:text-sky-200/80">
                            Triaged Meets Reassigned: <strong className="text-app-primary">{ev.execution_summary.triaged_meets_reassigned ?? 0}</strong> • Donor Lifter ID: <strong className="text-app-primary">{ev.execution_summary.donor_lifter_id ?? ev.anchor_lifter_id ?? '-'}</strong>
                          </div>
                        </div>
                      )}

                      {/* Unassigned Scorecards Diagnostic & In-Line Triage Box */}
                      {unidentifiedMeets.length > 0 && (
                        <div className="p-3.5 bg-amber-500/[0.03] border border-amber-500/25 rounded-xl space-y-2.5">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                  Competitions Flagged for Review ({unidentifiedMeets.length} Historical Competitions)
                                </span>
                                {hasUnsavedAssignments && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                    Unsaved Reassignments
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-app-secondary mt-1 max-w-2xl leading-relaxed">
                                These competitions in the live database could not be linked to a membership number. Review each competition's current attribution below and select a candidate if reassignment is needed.
                              </p>
                            </div>

                            {hasUnsavedAssignments && (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleSavePlan(item)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1.5 shadow"
                              >
                                {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                <span>Save Assigned Meets</span>
                              </button>
                            )}
                          </div>

                          {/* Unassigned Meets List */}
                          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {sortedContestedMeets.map((un: any, uIdx: number) => {
                              const meetId = un.meet_id || un.id;
                              const isCandidateHolder = typeof un.current_person_index === 'number';
                              const dbHolderIdx = isCandidateHolder ? un.current_person_index : null;
                              const dbHolderPerson = typeof dbHolderIdx === 'number' ? splitsList[dbHolderIdx] : null;
                              const dbHolderMembership = un.current_membership_number || dbHolderPerson?.membershipNumber || dbHolderPerson?.membership_number;
                              const assignedVal = itemAssignments[meetId] !== undefined
                                ? itemAssignments[meetId]
                                : (un.assigned_to !== undefined && un.assigned_to !== null ? un.assigned_to : (isCandidateHolder ? dbHolderIdx : (un.external_holder ? 'external' : '')));

                              return (
                                <div
                                  key={uIdx}
                                  className="p-3 rounded-lg bg-white/[0.03] border border-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                                >
                                  {/* Left Column: Meet Title, Date, Category, Provenance & Verification Links */}
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Link
                                        href={`/meet/${meetId}`}
                                        target="_blank"
                                        className="font-bold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1"
                                        title="View internal meet results"
                                      >
                                        <span>Meet #{meetId}{un.meet_name ? `: ${un.meet_name}` : ''}</span>
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      </Link>
                                      <span className="text-app-muted font-normal">({formatDisplayDate(un.date)})</span>
                                      <span className="text-app-secondary font-medium">• {un.age_category || ''} {un.weight_class || ''}</span>
                                    </div>

                                    <div className="flex items-center gap-2.5 text-[10px] text-app-muted flex-wrap">
                                      {un.club_name && (
                                        <span>Club: <strong className="text-app-primary font-medium">{un.club_name}</strong></span>
                                      )}
                                      {un.wso && (
                                        <span>WSO: <strong className="text-app-primary font-medium">{un.wso}</strong></span>
                                      )}
                                      {(un.club_name || un.wso) && (un.meet_url || un.sport80Url) && <span>•</span>}
                                      {un.meet_url && (
                                        <a
                                          href={un.meet_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-0.5 font-medium hover:underline"
                                          title="Official Sport80 Meet Results Page"
                                        >
                                          Sport80 Meet Results <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                      {un.sport80Url && (
                                        <a
                                          href={un.sport80Url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5 font-medium hover:underline"
                                          title="Official Sport80 Rankings search query for this competition date and weight category. In the published ranking export, this result lacked an explicit USA Weightlifting membership number."
                                        >
                                          Sport80 Rankings Query <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Column: Database Attribution & Action Dropdown */}
                                  <div className="flex items-center gap-2 shrink-0 justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-app-primary">
                                    {isCandidateHolder ? (
                                      <span className="px-2 py-1 rounded text-[10px] font-medium bg-app-tertiary border border-app-primary text-app-primary shrink-0" title="Profile currently holding this competition result in the live database table (usaw_meet_results)">
                                        Currently in Live Database: Person {un.current_person_index + 1} {dbHolderMembership ? `(#${dbHolderMembership})` : ''}
                                      </span>
                                    ) : un.external_holder ? (
                                      <Link
                                        href={un.external_holder.membership_number ? `/athlete/${un.external_holder.membership_number}` : `/athlete/u-${un.external_holder.internal_id}`}
                                        target="_blank"
                                        className="px-2 py-1 rounded text-[10px] font-medium bg-purple-950/80 border border-purple-800 text-purple-300 hover:text-white hover:border-purple-600 transition shrink-0 flex items-center gap-1"
                                        title="Currently assigned in the live database to an external athlete profile outside this candidate pool"
                                      >
                                        <span>Currently in Live Database: External Profile (#{un.external_holder.membership_number || un.external_holder.internal_id})</span>
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                      </Link>
                                    ) : (
                                      <span className="px-2 py-1 rounded text-[10px] font-medium bg-app-tertiary border border-app-primary text-app-muted shrink-0" title="Not attributed to any athlete record in usaw_meet_results">
                                        Currently in Live Database: Unassigned
                                      </span>
                                    )}

                                    {/* Assignment Select */}
                                    {item.status === 'PENDING' ? (
                                      <select
                                        value={assignedVal}
                                        onChange={(e) => handleAssignMeet(item.id, meetId, e.target.value)}
                                        className="px-2.5 py-1 bg-app-secondary border border-app-primary text-app-primary rounded text-[11px] focus:outline-none focus:border-indigo-500 shrink-0 font-medium"
                                      >
                                        {un.external_holder && (
                                          <option value="external">
                                            Retain on External Profile #{un.external_holder.membership_number || un.external_holder.internal_id} [In Live Database]
                                          </option>
                                        )}
                                        {splitsList.map((sp: any, spIdx: number) => {
                                          const spMembership = sp.membershipNumber || sp.membership_number || sp.internal_id || spIdx + 1;
                                          const isCurrent = spIdx === un.current_person_index;
                                          return (
                                            <option key={spIdx} value={spIdx}>
                                              {isCurrent
                                                ? `Person ${spIdx + 1} (#${spMembership}) [In Live Database]`
                                                : `Assign to Person ${spIdx + 1} (#${spMembership})`}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    ) : (
                                      <span className="px-2.5 py-1 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0">
                                        {assignedVal === 'external'
                                          ? `Retained: Profile #${un.external_holder?.membership_number || 'External'}`
                                          : Number(assignedVal) !== un.current_person_index
                                            ? `Reassigned: Person ${Number(assignedVal) + 1}`
                                            : `Retained: Person ${(un.current_person_index ?? 0) + 1}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* End-of-Workflow Action Bar */}
                      {item.status === 'PENDING' && (
                        <div className="pt-3 border-t border-app-primary flex items-center justify-between gap-3 flex-wrap bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                          <div className="text-xs text-app-secondary">
                            {hasUnsavedAssignments ? (
                              <span className="text-amber-400 font-medium flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                You have unsaved scorecard reassignments.
                              </span>
                            ) : (
                              <span>Review complete. Apply scorecard attribution to live database:</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {hasUnsavedAssignments && (
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleSavePlan(item)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                                title="Save reassignments to the plan without finalizing approval"
                              >
                                {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                <span>Save Draft Changes</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const updatedEv = buildUpdatedEvidenceForSplit(item);
                                handleResolve(item.id, 'APPROVED', undefined, updatedEv);
                              }}
                              disabled={isActing}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                              title="Executes the scorecard reassignments in the database and triggers athlete profile rebuilds"
                            >
                              {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>Approve Scorecard Attribution</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResolve(item.id, 'REJECTED')}
                              disabled={isActing}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-rose-400 transition flex items-center gap-1.5 disabled:opacity-50"
                              title="Declines the proposal and leaves all meet results untouched in the database"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject (Leave Database Unchanged)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 2. Stream: USAW Profile Consolidation (name_change_merge, duplicate_profile, data_hygiene_typo) */}
                {['name_change_merge', 'duplicate_profile', 'data_hygiene_typo'].includes(item.category) && (() => {
                  const titleMatch = item.title?.match(/(?:Name Change|Data Hygiene Correction):\s*"([^"]+)"\s*[↔→]\s*"([^"]+)"\s*(?:\(Member\s*#(\d+)\))?/)
                    || item.title?.match(/Duplicate Profile Records:\s*(.+?)\s*\(Member\s*#(\d+)\)/);
                  const isDuplicate = item.category === 'duplicate_profile';
                  const isTypo = item.category === 'data_hygiene_typo';
                  const isNameChange = item.category === 'name_change_merge';

                  const primaryName = ev.primary_name || ev.former_name || titleMatch?.[1];
                  const candidateName = ev.candidate_name || ev.canonical_name || (titleMatch?.[2] ?? titleMatch?.[1]);
                  const membershipNum = ev.membership_number || (titleMatch?.[3] ?? titleMatch?.[2]);
                  const sport80Id = ev.internal_ids?.[0] || ev.internal_ids?.[1];

                  const athleteHref = membershipNum
                    ? `/athlete/${membershipNum}`
                    : (ev.internal_ids?.[0] ? `/athlete/u-${ev.internal_ids[0]}` : `/athlete/u-${item.primary_entity_id}`);

                  return (
                    <div className="space-y-3">
                      {/* Unified Athlete Identity Bar */}
                      <div className="p-2.5 px-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-2.5 flex-wrap">
                        <span className="text-[11px] font-medium text-app-muted mr-0.5">Verification:</span>
                        <Link
                          href={athleteHref}
                          target="_blank"
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:text-indigo-900 hover:border-indigo-400 dark:bg-indigo-950/80 dark:border-indigo-700/60 dark:text-indigo-300 dark:hover:text-indigo-200 dark:hover:border-indigo-600 transition flex items-center gap-1.5"
                          title="View athlete profile on OWLanalytics"
                        >
                          <span>OWLanalytics Athlete Profile</span>
                          <ExternalLink className="w-3 h-3 text-indigo-400" />
                        </Link>
                        {sport80Id && (
                          <a
                            href={`https://usaweightlifting.sport80.com/public/rankings/member/${sport80Id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 border border-sky-200 text-sky-700 hover:text-sky-900 hover:border-sky-400 dark:bg-sky-950/80 dark:border-sky-800/60 dark:text-sky-300 dark:hover:text-sky-200 dark:hover:border-sky-700 transition flex items-center gap-1.5"
                            title="Official USAW / Sport80 Member Ranking Profile"
                          >
                            <span>Official Sport80 Member Profile (#{sport80Id})</span>
                            <ExternalLink className="w-3 h-3 text-sky-400" />
                          </a>
                        )}
                      </div>

                      {/* Timeline Provenance Banner (Exclusive to Authentic Name Changes) */}
                      {isNameChange && ev.timeline && (
                        <div className="p-2.5 px-3 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>
                              <strong>Historical Competition Span:</strong>{' '}
                              {ev.timeline.start_year}{ev.timeline.end_year !== ev.timeline.start_year ? `–${ev.timeline.end_year}` : ''}
                              {ev.timeline.first_seen && ev.timeline.last_seen && (
                                <span className="text-emerald-700 dark:text-emerald-300/80 text-[11px] ml-1">
                                  ({formatDisplayDate(ev.timeline.first_seen)} to {formatDisplayDate(ev.timeline.last_seen)})
                                </span>
                              )}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700/50">
                            {ev.timeline.meet_count} Competitions as &ldquo;{primaryName}&rdquo;
                          </span>
                        </div>
                      )}

                      {/* Name Transition Comparison */}
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className={`p-2.5 rounded-lg border space-y-0.5 text-center sm:text-left ${isTypo ? 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800/40' : 'bg-white/[0.03] border-white/5'
                          }`}>
                          <span className={`text-[10px] uppercase tracking-wider font-semibold ${isTypo ? 'text-rose-600 dark:text-rose-400' : isDuplicate ? 'text-sky-600 dark:text-sky-400' : 'text-app-muted'
                            }`}>
                            {isDuplicate ? 'Duplicate Record in usaw_lifters' : isTypo ? 'Corrupted Name in usaw_lifters' : 'Historical Name in usaw_lifters'}
                          </span>
                          <div className={`text-sm font-bold ${isTypo ? 'text-rose-700 dark:text-rose-200 font-mono text-xs' : 'text-app-primary'}`}>
                            {primaryName}
                          </div>
                          <p className="text-[10px] text-app-muted">
                            {isDuplicate
                              ? `Secondary row (lifter_id: ${item.primary_entity_id}) in usaw_lifters holding split results`
                              : isTypo
                                ? 'Typographical scraper artifact in usaw_lifters'
                                : 'Recorded on historical meet results in usaw_meet_results'}
                          </p>
                        </div>

                        <div className="flex flex-col items-center justify-center text-center px-1">
                          <ArrowRight className={`w-4 h-4 ${isDuplicate ? 'text-sky-600 dark:text-sky-400' : isTypo ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                            } hidden sm:block`} />
                          <span className={`text-[10px] ${isDuplicate ? 'text-sky-600/80 dark:text-sky-400/80' : isTypo ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-emerald-600/80 dark:text-emerald-400/80'
                            } font-medium sm:mt-1`}>
                            {isDuplicate ? 'Consolidate to' : isTypo ? 'Sanitize to' : 'Updated to'}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 space-y-0.5 text-center sm:text-left">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-semibold">
                            {isDuplicate ? 'Primary Profile in usaw_lifters' : isTypo ? 'Verified Name in usaw_lifters' : 'Updated Name in usaw_lifters'}
                          </span>
                          <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            {candidateName}
                          </div>
                          <p className="text-[10px] text-app-muted">
                            {isDuplicate ? `Primary record (lifter_id: ${item.candidate_entity_id}) in usaw_lifters` : 'Current official name on USAW member records'}
                          </p>
                        </div>
                      </div>

                      {/* Former Name Profile Display Toggle (Strictly for Authentic Name Changes) */}
                      {isNameChange && (
                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between gap-4">
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              id={`fn-toggle-${item.id}`}
                              checked={getFormerNameDisplay(item)}
                              onChange={(e) => setFormerNameDisplayMap(prev => ({ ...prev, [item.id]: e.target.checked }))}
                              className="mt-0.5 rounded border-app-primary bg-app-secondary text-indigo-500 focus:ring-indigo-500/20"
                            />
                            <label htmlFor={`fn-toggle-${item.id}`} className="text-xs text-app-secondary cursor-pointer select-none">
                              <span className="font-semibold text-app-primary">Display former name notice on public profile</span>
                              <p className="text-[11px] text-app-muted mt-0.5">
                                Displays &ldquo;Formerly competed as {primaryName}&rdquo; on the athlete page and enables redirect from former name. Suppressed automatically for duplicate records and typos.
                              </p>
                            </label>
                          </div>
                          {item.status === 'APPROVED' && (
                            <button
                              onClick={() => handleUpdateFormerNameDisplay(item.id, getFormerNameDisplay(item))}
                              disabled={actionInProgress === item.id}
                              className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-600/20 dark:hover:bg-indigo-600/30 dark:text-indigo-300 dark:border-indigo-500/30 transition flex items-center gap-1.5"
                              title="Save this display preference for the public athlete profile"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save Preference</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 3. Stream: cross_federation */}
                {item.category === 'cross_federation' && (() => {
                  const iwfLifterId = ev.iwf_athlete?.db_lifter_id || item.primary_entity_id;
                  const usawLifterId = ev.usaw_athlete?.lifter_id || item.candidate_entity_id;
                  const usawMemberNumber = ev.usaw_athlete?.membership_number || ev.membership_number;
                  const sport80Id = ev.usaw_athlete?.internal_id || ev.internal_ids?.[0];
                  const iwfRegistryId = ev.iwf_athlete?.iwf_lifter_id;

                  return (
                    <div className="space-y-3">
                      {/* Unified Verification Links */}
                      <div className="p-2.5 px-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-2.5 flex-wrap text-xs">
                        <span className="text-[11px] font-semibold text-app-muted uppercase tracking-wide mr-1">Verification Links:</span>
                        {iwfRegistryId && (
                          <Link
                            href={`/athlete/iwf/${iwfRegistryId}`}
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/60 dark:border-indigo-700/60 dark:text-indigo-300 dark:hover:text-indigo-200 transition flex items-center gap-1.5"
                            title="View IWF profile on OWLanalytics"
                          >
                            <span>OWLanalytics Athlete Profile (IWF #{iwfRegistryId})</span>
                            <ExternalLink className="w-3 h-3 text-indigo-400" />
                          </Link>
                        )}
                        {(usawMemberNumber || usawLifterId) && (
                          <Link
                            href={usawMemberNumber ? `/athlete/${usawMemberNumber}` : `/athlete/u-${usawLifterId}`}
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:hover:bg-indigo-900/60 dark:border-indigo-700/60 dark:text-indigo-300 dark:hover:text-indigo-200 transition flex items-center gap-1.5"
                            title="View USAW profile on OWLanalytics"
                          >
                            <span>OWLanalytics Athlete Profile (USAW #{usawMemberNumber || usawLifterId})</span>
                            <ExternalLink className="w-3 h-3 text-indigo-400" />
                          </Link>
                        )}
                        {iwfRegistryId && (
                          <a
                            href={`https://iwf.sport/weightlifting_/athletes-bios/?id=${iwfRegistryId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/80 dark:hover:bg-sky-900/60 dark:border-sky-800/60 dark:text-sky-300 dark:hover:text-sky-200 transition flex items-center gap-1.5"
                            title="Official IWF Athlete Profile"
                          >
                            <span>Official IWF Athlete Profile (#{iwfRegistryId})</span>
                            <ExternalLink className="w-3 h-3 text-sky-400" />
                          </a>
                        )}
                        {sport80Id && (
                          <a
                            href={`https://usaweightlifting.sport80.com/public/rankings/member/${sport80Id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-950/80 dark:hover:bg-sky-900/60 dark:border-sky-800/60 dark:text-sky-300 dark:hover:text-sky-200 transition flex items-center gap-1.5"
                            title="Official Sport80 Member Profile"
                          >
                            <span>Official Sport80 Member Profile (#{sport80Id})</span>
                            <ExternalLink className="w-3 h-3 text-sky-400" />
                          </a>
                        )}
                      </div>

                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-sky-400 block">IWF Athlete Record</span>
                          <div className="text-sm font-bold text-app-primary">
                            {ev.iwf_athlete?.athlete_name || 'IWF Athlete'}
                          </div>
                          <p className="text-[10px] text-app-muted font-mono">
                            <code className="text-sky-400">iwf_lifters.db_lifter_id:</code> {iwfLifterId}
                          </p>
                        </div>

                        <div className="flex flex-col items-center justify-center text-center px-1">
                          <ArrowRight className="w-4 h-4 text-sky-400 hidden sm:block" />
                          <span className="text-[10px] text-sky-400 font-medium">Link Profiles</span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block">USAW Athlete Record</span>
                          <div className="text-sm font-bold text-emerald-300">
                            {ev.usaw_athlete?.athlete_name || 'USAW Athlete'}
                          </div>
                          <p className="text-[10px] text-app-muted font-mono">
                            <code className="text-emerald-400">usaw_lifters.lifter_id:</code> {usawLifterId}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Stream: iwf_duplicate */}
                {item.category === 'iwf_duplicate' && (() => {
                  const dbMeetId = ev.db_meet_id;
                  const iwfMeetId = ev.iwf_meet_id;
                  const dbLifterId = ev.db_lifter_id || ev.all_lifters?.[0]?.db_lifter_id;
                  const iwfLifterId = ev.iwf_lifter_id || ev.all_lifters?.[0]?.iwf_lifter_id;
                  const athleteName = ev.athlete_name || item.title?.replace(/^IWF Same-Meet Duplicate:\s*/, '').split('(')[0]?.trim();
                  const meetName = ev.meet_name || ev.event_name || 'International Competition';

                  const owlanalyticsAthleteUrl = iwfLifterId ? `/athlete/iwf/${iwfLifterId}` : null;
                  const iwfAthleteUrl = ev.iwf_athlete_url || (iwfLifterId ? `https://iwf.sport/weightlifting_/athletes-bios/?id=${iwfLifterId}` : null);
                  const owlanalyticsMeetUrl = ev.owlanalytics_meet_url || (iwfMeetId ? `/meet/iwf/${iwfMeetId}` : (dbMeetId ? `/meet/iwf/${dbMeetId}` : null));
                  const iwfMeetUrl = ev.iwf_meet_url || (iwfMeetId ? `https://iwf.sport/results/results-by-events/?event_id=${iwfMeetId}` : null);

                  const scorecards: any[] = ev.duplicate_scorecards || [];
                  const allLifters: any[] = ev.all_lifters || [];
                  const registeredCategories: string[] = ev.weight_classes || [];
                  const meetYear = ev.meet_date ? String(new Date(ev.meet_date).getFullYear()) : '';
                  const meetDate = ev.meet_date || scorecards[0]?.date || null;
                  const formattedMeetDate = meetDate ? formatDisplayDate(meetDate) : (meetYear || 'Date Unspecified');

                  const countryCode = ev.country_code || scorecards[0]?.country_code || '';
                  const countryName = ev.country_name || scorecards[0]?.country_name || '';
                  const countryLabel = countryName ? `${countryName}${countryCode ? ` (${countryCode})` : ''}` : countryCode;

                  const gender = ev.gender || (scorecards[0]?.gender === 'M' || scorecards[0]?.gender === 'Men' ? 'Men' : scorecards[0]?.gender === 'F' || scorecards[0]?.gender === 'Women' ? 'Women' : null);
                  const divisionLabel = gender ? (gender === 'Men' ? "Men's Division" : "Women's Division") : null;

                  const flaggedClassesLabel = registeredCategories.length > 0
                    ? registeredCategories.map((wc: string) => {
                      if (gender && !wc.toLowerCase().includes(gender.toLowerCase())) {
                        return `${gender === 'Men' ? "Men's" : "Women's"} ${wc}`;
                      }
                      return wc;
                    }).join(' & ')
                    : 'Multiple Weight Classes';

                  const isMissingCategoryInDb = registeredCategories.length > scorecards.length;

                  // Discover all available athlete profiles (fallback to primary if all_lifters array is empty)
                  const displayLifters = allLifters.length > 0
                    ? allLifters
                    : (dbLifterId || iwfLifterId)
                      ? [{
                        db_lifter_id: dbLifterId,
                        iwf_lifter_id: iwfLifterId,
                        athlete_name: athleteName,
                        country_code: countryCode,
                        country_name: countryName,
                        birth_year: ev.birth_year,
                        iwf_url: iwfAthleteUrl
                      }]
                      : [];

                  // Deterministic Person 1, Person 2 mapping across discovered lifters
                  const lifterPersonMap = new Map<number, { personIndex: number; birthYear?: number | string | null; lifterName: string }>();
                  displayLifters.forEach((l: any, idx: number) => {
                    if (l.db_lifter_id) {
                      lifterPersonMap.set(l.db_lifter_id, {
                        personIndex: idx + 1,
                        birthYear: l.birth_year,
                        lifterName: l.athlete_name
                      });
                    }
                  });

                  // Dynamically evaluate database attribution across scorecards
                  const lifterGroupsMap = new Map<number, { db_lifter_id: number; lifter_name: string; results: any[] }>();
                  scorecards.forEach((sc: any) => {
                    const lId = sc.db_lifter_id || dbLifterId || 0;
                    if (!lifterGroupsMap.has(lId)) {
                      lifterGroupsMap.set(lId, {
                        db_lifter_id: lId,
                        lifter_name: sc.lifter_name || athleteName || 'Athlete',
                        results: []
                      });
                    }
                    lifterGroupsMap.get(lId)!.results.push(sc);
                  });
                  const lifterGroups = Array.from(lifterGroupsMap.values());
                  const isSplitAcrossMultipleProfiles = lifterGroups.length > 1;
                  const isHomonymDisambiguation = allLifters.length > 1 && scorecards.length <= 1;
                  const isMultiCategorySingleLifter = scorecards.length > 1 && !isSplitAcrossMultipleProfiles;

                  // Person lookup for single-result disambiguation
                  const singleAttributedLifterId = scorecards[0]?.db_lifter_id || dbLifterId || lifterGroups[0]?.db_lifter_id;
                  const singleAttributedPInfo = singleAttributedLifterId ? lifterPersonMap.get(singleAttributedLifterId) : undefined;
                  const singleAttributedPNumber = singleAttributedPInfo?.personIndex;
                  const singleAttributedPYear = singleAttributedPInfo?.birthYear || scorecards[0]?.birth_year;
                  const alternatePersons = displayLifters
                    .filter((l: any) => l.db_lifter_id !== singleAttributedLifterId)
                    .map((l: any) => {
                      const p = lifterPersonMap.get(l.db_lifter_id);
                      return `Person ${p?.personIndex || '?'}${p?.birthYear ? ` (b. ${p.birthYear})` : ''} [Database Lifter #${l.db_lifter_id}]`;
                    })
                    .join(' or ');

                  return (
                    <div className="space-y-3.5">
                      {/* Competition Context Matrix */}
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-app-muted block mb-0.5">Competition</span>
                          <span className="font-semibold text-app-primary block truncate" title={meetName}>
                            {meetName}
                          </span>
                          <div className="space-y-0.5 mt-0.5">
                            <span className="text-[11px] text-indigo-400 font-semibold block font-mono" title="Canonical competition identifier on iwf.sport (event_id)">
                              {iwfMeetId ? `Official IWF Event #${iwfMeetId}` : `Database Meet #${dbMeetId || 'Unknown'}`}
                            </span>
                            <span className="text-[10px] text-app-muted font-mono block" title="Local database table primary key">
                              iwf_meets.db_meet_id: {dbMeetId}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-app-muted block mb-0.5">Competition Date</span>
                          <span className="font-semibold text-app-primary">
                            {formattedMeetDate}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-app-muted block mb-0.5">Division &amp; Country</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {divisionLabel && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${gender === 'Men'
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-700/60'
                                  : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700/60'
                                }`}>
                                {divisionLabel}
                              </span>
                            )}
                            {countryLabel && (
                              <span className="text-app-secondary font-medium">
                                {countryLabel}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-app-muted block mb-0.5">Flagged Weight Classes</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 dark:bg-amber-950/80 border border-amber-500/30 text-amber-300 inline-block">
                            {flaggedClassesLabel}
                          </span>
                        </div>

                        {/* Embedded Competition Verification Links */}
                        {(owlanalyticsMeetUrl || iwfMeetUrl) && (
                          <div className="sm:col-span-2 lg:col-span-4 pt-2.5 border-t border-app-primary flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-[10px] uppercase font-bold text-app-muted tracking-wider mr-1">Competition Verification:</span>
                            {owlanalyticsMeetUrl && (
                              <Link
                                href={owlanalyticsMeetUrl}
                                target="_blank"
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 hover:border-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 dark:hover:text-indigo-200 dark:border-indigo-700/50 dark:hover:border-indigo-500 transition flex items-center gap-1.5"
                                title="View competition results on OWLanalytics"
                              >
                                <span>OWLanalytics Meet Results</span>
                                <ExternalLink className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                              </Link>
                            )}
                            {iwfMeetUrl && (
                              <a
                                href={iwfMeetUrl}
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
                        )}
                      </div>

                      {/* Prominent Operational Diagnostic Brief */}
                      <div className="p-3.5 rounded-xl bg-amber-500/[0.03] border border-amber-500/25 text-xs space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between gap-2 border-b border-app-primary pb-2">
                          <div className="flex items-center gap-2 font-bold text-app-primary text-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                              {isHomonymDisambiguation
                                ? 'Operational Review Brief: Homonym Athlete Profile Disambiguation'
                                : isSplitAcrossMultipleProfiles
                                  ? 'Operational Review Brief: Split Homonym Multi-Scorecard Verification'
                                  : 'Operational Review Brief: Same-Meet Multi-Category Competitor Verification'}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Anomaly Verification Required
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          {/* Panel 1: Current Database State */}
                          <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-app-muted tracking-wider block">1. Current Database State</span>
                            <div className="text-app-primary text-xs leading-relaxed">
                              {scorecards.length > 0 ? (
                                isSplitAcrossMultipleProfiles ? (
                                  <div className="space-y-1.5">
                                    <div>
                                      <span className="font-semibold text-rose-400">Results Split Across {lifterGroups.length} Profiles:</span>{' '}
                                      The {scorecards.length} results in <code className="text-sky-400 font-mono text-[11px]">iwf_meet_results</code> are currently divided across distinct lifters:
                                    </div>
                                    <div className="space-y-1 pl-1">
                                      {lifterGroups.map((lg) => {
                                        const pInfo = lifterPersonMap.get(lg.db_lifter_id);
                                        const pNumber = pInfo?.personIndex;
                                        const pYear = pInfo?.birthYear || lg.results.find((r: any) => r.birth_year)?.birth_year;
                                        return (
                                          <div key={lg.db_lifter_id} className="text-[11px] font-mono leading-tight">
                                            <code className="text-sky-400 font-semibold">
                                              iwf_lifters.db_lifter_id: #{lg.db_lifter_id}
                                            </code>{' '}
                                            <span className="text-app-secondary font-sans font-semibold">
                                              ({lg.lifter_name}{pNumber ? ` — Person ${pNumber}` : ''}{pYear ? `, b. ${pYear}` : ''})
                                            </span>
                                            <div className="text-app-muted pl-2">
                                              {lg.results.map((r: any) => (
                                                <span key={r.db_result_id} className="block">
                                                  ↳ Result #{r.db_result_id} ({r.gender === 'M' || r.gender === 'Men' ? "Men's " : r.gender === 'F' || r.gender === 'Women' ? "Women's " : ''}{r.weight_class || 'Class'}{r.body_weight_kg ? ` • ${r.body_weight_kg} kg BW` : ''}{r.total ? ` • ${r.total} kg Total` : ''})
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="text-[10px] text-app-muted pt-0.5">
                                      Primary-source records share matching names, but database ingestion has already divided them into separate lifter profiles.
                                    </div>
                                  </div>
                                ) : isHomonymDisambiguation ? (
                                  <div className="space-y-1.5">
                                    <div>
                                      <span className="font-semibold text-emerald-400">Single Result Ingested:</span>{' '}
                                      The single recorded result in <code className="text-sky-400 font-mono text-[11px]">iwf_meet_results</code> for Event #{iwfMeetId || dbMeetId} is currently attributed to:
                                    </div>
                                    <div className="font-mono text-[11px]">
                                      <code className="text-sky-400 font-semibold">iwf_lifters.db_lifter_id: #{singleAttributedLifterId || 'Unknown'}</code>{' '}
                                      <span className="font-sans text-app-secondary font-semibold">
                                        ({athleteName}{displayLifters.length > 1 ? ` — Person ${singleAttributedPNumber || 1}` : ''}{singleAttributedPYear ? `, b. ${singleAttributedPYear}` : ''})
                                      </span>
                                    </div>
                                    {scorecards[0] && (
                                      <div className="text-[11px] text-app-secondary pl-2 font-mono">
                                        ↳ Result #{scorecards[0].db_result_id}: {scorecards[0].gender === 'M' || scorecards[0].gender === 'Men' ? "Men's " : scorecards[0].gender === 'F' || scorecards[0].gender === 'Women' ? "Women's " : ''}{scorecards[0].weight_class || 'Weight Class'}{scorecards[0].body_weight_kg ? ` (${scorecards[0].body_weight_kg} kg BW` : ''}{scorecards[0].total ? `, ${scorecards[0].total} kg Total)` : ')'}
                                      </div>
                                    )}
                                    <div className="text-[10px] text-app-muted pt-0.5">
                                      Notice: Only 1 scorecard exists in <code className="text-sky-400">iwf_meet_results</code> for this meet, while {allLifters.length} distinct athlete profiles exist in <code className="text-sky-400">iwf_lifters</code>.
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <div>
                                      <span className="font-semibold text-emerald-400">Single Profile Attribution:</span>{' '}
                                      All <strong>{scorecards.length} distinct results</strong> in <code className="text-sky-400 font-mono text-[11px]">iwf_meet_results</code> are currently attributed to:
                                    </div>
                                    <div className="font-mono text-[11px]">
                                      <code className="text-sky-400 font-semibold">iwf_lifters.db_lifter_id: #{singleAttributedLifterId || 'Unknown'}</code>{' '}
                                      <span className="font-sans text-app-secondary font-semibold">
                                        ({athleteName}{displayLifters.length > 1 ? ` — Person ${singleAttributedPNumber || 1}` : ''}{singleAttributedPYear ? `, b. ${singleAttributedPYear}` : ''})
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-app-secondary space-y-0.5 pl-2 font-mono">
                                      {scorecards.map((sc: any) => (
                                        <div key={sc.db_result_id}>
                                          ↳ Result #{sc.db_result_id}: {sc.gender === 'M' || sc.gender === 'Men' ? "Men's " : sc.gender === 'F' || sc.gender === 'Women' ? "Women's " : ''}{sc.weight_class || 'Weight Class'}{sc.body_weight_kg ? ` (${sc.body_weight_kg} kg BW` : ''}{sc.total ? `, ${sc.total} kg Total)` : ')'}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="text-[10px] text-app-muted pt-0.5">
                                      This athlete's public profile currently displays all {scorecards.length} competition entries.
                                    </div>
                                  </div>
                                )
                              ) : (
                                <span>No active competition results found in <code className="text-sky-400 font-mono text-[11px]">iwf_meet_results</code> for Meet #{dbMeetId || 'Unknown'}.</span>
                              )}
                            </div>
                          </div>

                          {/* Panel 2: Flagged Hypothesis / Claim */}
                          <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-app-muted tracking-wider block">2. Flagged Hypothesis / Claim</span>
                            <p className="text-app-primary text-xs leading-relaxed">
                              {scorecards.length === 0 ? (
                                <>
                                  The review item was staged for <strong>{athleteName}</strong> in <strong>{meetName || `Meet #${dbMeetId}`}</strong> ({flaggedClassesLabel}).
                                  <span className="block mt-1 text-app-secondary">
                                    Flagged by the historical catalog seeder, but zero competition results are currently recorded in the database for this meet.
                                  </span>
                                </>
                              ) : isHomonymDisambiguation ? (
                                <>
                                  Multiple distinct international lifters named <strong>{athleteName}</strong> exist in the registry ({allLifters.length} profiles detected in <code className="text-sky-400 font-mono text-[11px]">iwf_lifters</code>).
                                  <span className="block mt-1 text-app-secondary">
                                    Flagged to verify whether this single competition result legitimately belongs to Database Lifter #{singleAttributedLifterId} (Person {singleAttributedPNumber || 1}{singleAttributedPYear ? `, b. ${singleAttributedPYear}` : ''}) or requires reassignment to {alternatePersons || 'a candidate homonym profile'}.
                                  </span>
                                </>
                              ) : isSplitAcrossMultipleProfiles ? (
                                <>
                                  Primary records on <code className="text-amber-500 font-mono text-[11px]">iwf.sport</code> list {scorecards.length} results under <strong>{athleteName}</strong> for Event #{iwfMeetId || dbMeetId}.
                                  <span className="block mt-1 text-app-secondary">
                                    Flagged to confirm that these results legitimately belong to {lifterGroups.length} separate competitors and should remain divided.
                                  </span>
                                </>
                              ) : (
                                <>
                                  Official primary records on <code className="text-amber-500 font-mono text-[11px]">iwf.sport</code> list <strong>{athleteName}</strong> in multiple weight classes ({flaggedClassesLabel}) for Event #{iwfMeetId || dbMeetId}.
                                  <span className="block mt-1 text-app-secondary">
                                    Flagged to determine if this was a <strong>legitimate multi-category competitor</strong> or a <strong>collision between two different individuals</strong> sharing a name.
                                  </span>
                                </>
                              )}
                            </p>
                          </div>

                          {/* Panel 3: Administrative Decision Impact */}
                          <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-app-muted tracking-wider block">3. Administrative Decision Impact</span>
                            <div className="text-[11px] text-app-secondary space-y-1.5 leading-snug">
                              {scorecards.length === 0 ? (
                                <div>
                                  <strong className="text-app-primary">Dismiss Flag:</strong> Marks the review item resolved with <span className="underline decoration-emerald-500/50">0 database modifications</span>. If this competition was never ingested, execute a targeted re-scrape above.
                                </div>
                              ) : isHomonymDisambiguation ? (
                                <>
                                  <div>
                                    <strong className="text-emerald-500">Confirm Attribution:</strong> Validates that Result #{scorecards[0]?.db_result_id} belongs to Database Lifter #{singleAttributedLifterId} ({athleteName} — Person {singleAttributedPNumber || 1}{singleAttributedPYear ? `, b. ${singleAttributedPYear}` : ''}). Resolves the review item with <span className="underline decoration-emerald-500/50">0 database modifications</span>.
                                  </div>
                                  <div>
                                    <strong className="text-accent-secondary">Reassign Attribution:</strong> If this competition result belongs to {alternatePersons || 'the alternate profile'}, use the per-result tools below to reassign the result to the correct candidate lifter.
                                  </div>
                                </>
                              ) : isSplitAcrossMultipleProfiles ? (
                                <>
                                  <div>
                                    <strong className="text-emerald-500">Confirm Separate Athletes:</strong> Confirms results belong to distinct individuals. Marks resolved with <span className="underline decoration-emerald-500/50">0 database modifications</span>, preserving existing separate profiles.
                                  </div>
                                  <div>
                                    <strong className="text-accent-secondary">Reassign / Consolidate Result:</strong> If results were misattributed or belong to one athlete, use the per-result tools below to reassign or merge profiles.
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <strong className="text-emerald-500">Confirm Dual Entry:</strong> Affirms single-athlete multi-entry claim. Marks resolved with <span className="underline decoration-emerald-500/50">0 database modifications</span>, preserving all results on this profile.
                                  </div>
                                  <div>
                                    <strong className="text-accent-secondary">Split / Reassign Result:</strong> Denies single-athlete claim. Use the per-result tools below to reassign a result to an existing profile or create a newly provisioned profile.
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* IWF Athlete Registry Profile(s) with Promoted Verification Pills */}
                      {displayLifters.length > 0 && (
                        <div className="p-2.5 px-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-1.5 text-xs">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-app-muted">
                            {displayLifters.length > 1
                              ? `Multiple IWF Lifter Accounts Detected in iwf_lifters (${displayLifters.length})`
                              : `IWF Athlete Registry Profile in iwf_lifters`}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {displayLifters.map((l: any, idx: number) => {
                              const iwfProfileUrl = l.iwf_athlete_url || l.iwf_url || (l.iwf_lifter_id ? `https://iwf.sport/weightlifting_/athletes-bios/?id=${l.iwf_lifter_id}` : null);
                              return (
                                <div key={idx} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2 text-[11px] flex-wrap">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <strong className="text-app-primary truncate">
                                        {l.athlete_name} (Person {idx + 1}{l.birth_year ? `, b. ${l.birth_year}` : ''})
                                      </strong>
                                    </div>
                                    <div className="text-[10px] text-app-muted font-mono mt-0.5">
                                      <code className="text-sky-400 font-semibold">iwf_lifters.db_lifter_id: #{l.db_lifter_id}</code> {l.country_code ? `• ${l.country_code}` : ''}
                                      {l.iwf_lifter_id ? ` • IWF #${l.iwf_lifter_id}` : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {l.iwf_lifter_id ? (
                                      <Link
                                        href={`/athlete/iwf/${l.iwf_lifter_id}`}
                                        target="_blank"
                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 hover:border-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 dark:hover:text-indigo-200 dark:border-indigo-700/50 dark:hover:border-indigo-500 transition flex items-center gap-1.5"
                                        title={`View athlete profile on OWLanalytics for ${l.athlete_name}`}
                                      >
                                        <span>OWLanalytics Athlete Profile</span>
                                        <ExternalLink className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                                      </Link>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-app-tertiary border border-app-primary text-app-muted">
                                        OWLanalytics Profile (No IWF ID)
                                      </span>
                                    )}
                                    {iwfProfileUrl ? (
                                      <a
                                        href={iwfProfileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-900 border border-sky-200 hover:border-sky-300 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 dark:text-sky-300 dark:hover:text-sky-200 dark:border-sky-800/50 dark:hover:border-sky-600 transition flex items-center gap-1.5"
                                        title={`Official IWF Athlete Profile for ${l.athlete_name} (${l.iwf_lifter_id ? `#${l.iwf_lifter_id}` : 'Web Link'})`}
                                      >
                                        <span>Official IWF Athlete Profile {l.iwf_lifter_id ? `(#${l.iwf_lifter_id})` : ''}</span>
                                        <ExternalLink className="w-3 h-3 text-sky-500 dark:text-sky-400" />
                                      </a>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-app-tertiary border border-app-primary text-app-muted">
                                        Official IWF Profile (Unlinked)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Distinct Meet Results Breakdown */}
                      {scorecards.length > 0 && (
                        <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-app-primary">
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-app-primary block">
                                {isHomonymDisambiguation
                                  ? `Meet Result in Database (${scorecards.length} Recorded Entry)`
                                  : `Distinct Meet Results in Database (${scorecards.length} of ${registeredCategories.length || scorecards.length} Weight Classes Present)`}
                              </span>
                              <div className="text-[11px] text-app-muted">
                                {isHomonymDisambiguation ? (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                                    Single competition result recorded for Event #{iwfMeetId || dbMeetId} in <code className="text-emerald-300">iwf_meet_results</code>.
                                  </span>
                                ) : isMissingCategoryInDb ? (
                                  <span className="text-rose-400 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-400 inline" />
                                    Missing weight class in <code className="text-rose-300">iwf_meet_results</code>. Use Targeted Re-Scrape or repair tools.
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 inline" />
                                    All registered weight classes verified in live database records via tokenized query against <code className="text-emerald-300">iwf_meet_results</code>
                                    {ev.last_status_check?.checked_at && (
                                      <span> on {formatEasternDateTime(ev.last_status_check.checked_at)}</span>
                                    )}.
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleCheckIwfStatus(item)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-app-primary border border-app-primary transition flex items-center gap-1.5"
                                title="Re-query live database records in iwf_meet_results"
                              >
                                {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                <span>Re-Check DB</span>
                              </button>
                              {iwfMeetId && meetYear && isMissingCategoryInDb && (
                                <button
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => handleRescrapeIwfEvent(item, meetYear, String(iwfMeetId), athleteName || '')}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                                  title={`Execute visible local Puppeteer scraper for Event #${iwfMeetId}`}
                                >
                                  {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                                  <span>Targeted Re-Scrape</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {scorecards.map((sc: any, scIdx: number) => {
                              const cardKey = `${item.id}_${sc.db_result_id}`;
                              const activeMode = iwfRepairModeMap[cardKey] || null;
                              const pInfo = lifterPersonMap.get(sc.db_lifter_id);
                              const pNumber = pInfo?.personIndex;
                              const pYear = pInfo?.birthYear || sc.birth_year;
                              const defaultForm = {
                                athlete_name: sc.lifter_name || athleteName || '',
                                gender: sc.gender || ev.raw_gender || (ev.gender === 'Women' ? 'F' : 'M'),
                                country_code: sc.country_code || ev.country_code || '',
                                country_name: sc.country_name || ev.country_name || '',
                                birth_year: sc.birth_year ? String(sc.birth_year) : (ev.birth_year ? String(ev.birth_year) : ''),
                                iwf_lifter_id: ''
                              };
                              const formState = iwfNewAthleteFormMap[cardKey] || defaultForm;
                              const reassignTarget = iwfReassignTargetMap[cardKey] ?? '';

                              return (
                                <div key={scIdx} className="p-3 rounded-lg bg-white/[0.03] border border-white/5 space-y-2.5 shadow-sm">
                                  {/* Result Header & Database Table Provenance */}
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-app-primary text-xs">
                                          {sc.gender ? (sc.gender === 'M' || sc.gender === 'Men' ? "Men's " : "Women's ") : (ev.gender ? `${ev.gender === 'Men' ? "Men's " : "Women's "}` : '')}{sc.weight_class || 'Weight Class Unspecified'}
                                          {pNumber ? ` (Person ${pNumber}${pYear ? `, b. ${pYear}` : ''})` : ''}
                                        </span>
                                      </div>
                                      {sc.body_weight_kg && (
                                        <span className="text-[11px] text-app-secondary font-mono bg-app-tertiary px-2 py-0.5 rounded border border-app-primary">
                                          Body Weight: <strong className="text-app-primary">{sc.body_weight_kg} kg</strong>
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-mono text-app-secondary space-y-0.5">
                                      <div>
                                        <code className="text-amber-500 font-semibold">iwf_meet_results.db_result_id: #{sc.db_result_id}</code>
                                      </div>
                                      <div>
                                        <code className="text-sky-400 font-semibold">iwf_lifters.db_lifter_id: #{sc.db_lifter_id || ev.db_lifter_id}</code>{' '}
                                        <span className="text-app-muted font-sans font-medium">
                                          ({sc.lifter_name || athleteName}{pNumber ? ` — Person ${pNumber}` : ''}{pYear ? `, b. ${pYear}` : ''})
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 6-Attempt Progression Matrix */}
                                  <div className="pt-2 border-t border-app-primary space-y-1.5">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      {/* Snatch Attempts */}
                                      <div className="p-2 rounded bg-white/[0.03] border border-white/5 space-y-1">
                                        <div className="flex items-center justify-between text-[11px] text-app-secondary font-medium">
                                          <span>Snatch</span>
                                          <span className="text-app-primary font-bold">Best: {sc.best_snatch ? `${sc.best_snatch} kg` : '-'}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 text-center font-mono text-xs">
                                          <div className={`p-1 rounded border ${sc.snatch_lift_1 > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold' : sc.snatch_lift_1 < 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 line-through font-normal' : 'bg-app-tertiary text-app-muted border-dashed border-app-primary'}`}>
                                            {sc.snatch_lift_1 !== null && sc.snatch_lift_1 !== undefined ? `${Math.abs(sc.snatch_lift_1)}` : '-'}
                                          </div>
                                          <div className={`p-1 rounded border ${sc.snatch_lift_2 > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold' : sc.snatch_lift_2 < 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 line-through font-normal' : 'bg-app-tertiary text-app-muted border-dashed border-app-primary'}`}>
                                            {sc.snatch_lift_2 !== null && sc.snatch_lift_2 !== undefined ? `${Math.abs(sc.snatch_lift_2)}` : '-'}
                                          </div>
                                          <div className={`p-1 rounded border ${sc.snatch_lift_3 > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold' : sc.snatch_lift_3 < 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 line-through font-normal' : 'bg-app-tertiary text-app-muted border-dashed border-app-primary'}`}>
                                            {sc.snatch_lift_3 !== null && sc.snatch_lift_3 !== undefined ? `${Math.abs(sc.snatch_lift_3)}` : '-'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Clean & Jerk Attempts */}
                                      <div className="p-2 rounded bg-white/[0.03] border border-white/5 space-y-1">
                                        <div className="flex items-center justify-between text-[11px] text-app-secondary font-medium">
                                          <span>Clean &amp; Jerk</span>
                                          <span className="text-app-primary font-bold">Best: {sc.best_cj ? `${sc.best_cj} kg` : '-'}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 text-center font-mono text-xs">
                                          <div className={`p-1 rounded border ${sc.cj_lift_1 > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold' : sc.cj_lift_1 < 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 line-through font-normal' : 'bg-app-tertiary text-app-muted border-dashed border-app-primary'}`}>
                                            {sc.cj_lift_1 !== null && sc.cj_lift_1 !== undefined ? `${Math.abs(sc.cj_lift_1)}` : '-'}
                                          </div>
                                          <div className={`p-1 rounded border ${sc.cj_lift_2 > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold' : sc.cj_lift_2 < 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 line-through font-normal' : 'bg-app-tertiary text-app-muted border-dashed border-app-primary'}`}>
                                            {sc.cj_lift_2 !== null && sc.cj_lift_2 !== undefined ? `${Math.abs(sc.cj_lift_2)}` : '-'}
                                          </div>
                                          <div className={`p-1 rounded border ${sc.cj_lift_3 > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold' : sc.cj_lift_3 < 0 ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 line-through font-normal' : 'bg-app-tertiary text-app-muted border-dashed border-app-primary'}`}>
                                            {sc.cj_lift_3 !== null && sc.cj_lift_3 !== undefined ? `${Math.abs(sc.cj_lift_3)}` : '-'}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs pt-1 px-1 text-app-secondary">
                                      <div>Total: <strong className="text-emerald-400 font-mono text-sm font-bold">{sc.total ? `${sc.total} kg` : '—'}</strong></div>
                                    </div>
                                  </div>

                                  {/* Direct Database Repair Toolbar per Result */}
                                  {item.status === 'PENDING' && (
                                    <div className="pt-1.5 border-t border-app-primary space-y-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIwfRepairModeMap(prev => ({
                                              ...prev,
                                              [cardKey]: prev[cardKey] === 'split_new' ? null : 'split_new'
                                            }));
                                            if (!iwfNewAthleteFormMap[cardKey]) {
                                              setIwfNewAthleteFormMap(prev => ({ ...prev, [cardKey]: defaultForm }));
                                            }
                                          }}
                                          className={`px-2 py-1 rounded text-[10px] font-semibold border transition flex items-center gap-1 ${activeMode === 'split_new'
                                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                              : 'bg-white/[0.03] hover:bg-app-tertiary text-indigo-400 border-app-primary'
                                            }`}
                                          title="Create a new athlete row in iwf_lifters and reassign this meet result to that new profile"
                                        >
                                          <UserPlus className="w-3 h-3" />
                                          <span>Split to New Athlete</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIwfRepairModeMap(prev => ({
                                              ...prev,
                                              [cardKey]: prev[cardKey] === 'reassign_existing' ? null : 'reassign_existing'
                                            }));
                                          }}
                                          className={`px-2 py-1 rounded text-[10px] font-semibold border transition flex items-center gap-1 ${activeMode === 'reassign_existing'
                                              ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                                              : 'bg-white/[0.03] hover:bg-app-tertiary text-sky-400 border-app-primary'
                                            }`}
                                          title="Reassign this meet result to an existing db_lifter_id in iwf_lifters"
                                        >
                                          <GitFork className="w-3 h-3" />
                                          <span>Reassign to Existing Athlete</span>
                                        </button>

                                        <button
                                          type="button"
                                          disabled={isActing}
                                          onClick={() => {
                                            handleResolve(item.id, 'APPROVED', undefined, {
                                              repair_action: 'SCORECARD_PURGED',
                                              db_result_id: sc.db_result_id,
                                              purge_result_id: sc.db_result_id
                                            });
                                          }}
                                          className="px-2 py-1 rounded text-[10px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 dark:border-rose-800/60 transition flex items-center gap-1 ml-auto"
                                          title="Delete this erroneous meet result from iwf_meet_results (stores a full backup snapshot in evidence for 1-click undo)"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Delete Result</span>
                                        </button>
                                      </div>

                                      {/* Mode 1: Split to New IWF Athlete Form */}
                                      {activeMode === 'split_new' && (
                                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-2 text-[11px]">
                                          <div className="font-semibold text-indigo-400">
                                            Provision New IWF Lifter (<code className="text-[10px]">iwf_lifters</code>) &amp; Reassign Result #{sc.db_result_id}
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                              <label className="block text-[10px] text-app-muted mb-0.5">Athlete Name (Firstname LASTNAME)</label>
                                              <input
                                                type="text"
                                                value={formState.athlete_name}
                                                onChange={(e) => setIwfNewAthleteFormMap(prev => ({
                                                  ...prev,
                                                  [cardKey]: { ...formState, athlete_name: e.target.value }
                                                }))}
                                                className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className="block text-[10px] text-app-muted mb-0.5">Gender</label>
                                                <select
                                                  value={formState.gender}
                                                  onChange={(e) => setIwfNewAthleteFormMap(prev => ({
                                                    ...prev,
                                                    [cardKey]: { ...formState, gender: e.target.value }
                                                  }))}
                                                  className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                                >
                                                  <option value="M">M (Men)</option>
                                                  <option value="F">F (Women)</option>
                                                </select>
                                              </div>
                                              <div>
                                                <label className="block text-[10px] text-app-muted mb-0.5">Birth Year</label>
                                                <input
                                                  type="number"
                                                  placeholder="e.g. 1989"
                                                  value={formState.birth_year}
                                                  onChange={(e) => setIwfNewAthleteFormMap(prev => ({
                                                    ...prev,
                                                    [cardKey]: { ...formState, birth_year: e.target.value }
                                                  }))}
                                                  className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                                />
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                              <div>
                                                <label className="block text-[10px] text-app-muted mb-0.5">Country Code (3-Letter)</label>
                                                <input
                                                  type="text"
                                                  maxLength={3}
                                                  placeholder="e.g. MYA"
                                                  value={formState.country_code}
                                                  onChange={(e) => setIwfNewAthleteFormMap(prev => ({
                                                    ...prev,
                                                    [cardKey]: { ...formState, country_code: e.target.value.toUpperCase() }
                                                  }))}
                                                  className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-[10px] text-app-muted mb-0.5">IWF Lifter ID (Optional)</label>
                                                <input
                                                  type="number"
                                                  placeholder="Leave blank if unindexed"
                                                  value={formState.iwf_lifter_id}
                                                  onChange={(e) => setIwfNewAthleteFormMap(prev => ({
                                                    ...prev,
                                                    [cardKey]: { ...formState, iwf_lifter_id: e.target.value }
                                                  }))}
                                                  className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-[10px] text-app-muted mb-0.5">Country Name</label>
                                              <input
                                                type="text"
                                                placeholder="e.g. Myanmar"
                                                value={formState.country_name}
                                                onChange={(e) => setIwfNewAthleteFormMap(prev => ({
                                                  ...prev,
                                                  [cardKey]: { ...formState, country_name: e.target.value }
                                                }))}
                                                className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex items-center justify-end gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => setIwfRepairModeMap(prev => ({ ...prev, [cardKey]: null }))}
                                              className="px-2.5 py-1 rounded text-[10px] bg-app-secondary border border-app-primary text-app-secondary hover:bg-app-hover hover:text-app-primary"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isActing || !formState.athlete_name.trim()}
                                              onClick={() => {
                                                handleResolve(item.id, 'APPROVED', undefined, {
                                                  repair_action: 'NEW_ATHLETE_CREATED',
                                                  db_result_id: sc.db_result_id,
                                                  new_athlete_profile: {
                                                    athlete_name: formState.athlete_name.trim(),
                                                    gender: formState.gender,
                                                    country_code: formState.country_code.trim(),
                                                    country_name: formState.country_name.trim(),
                                                    birth_year: formState.birth_year ? Number(formState.birth_year) : null,
                                                    iwf_lifter_id: formState.iwf_lifter_id ? Number(formState.iwf_lifter_id) : null
                                                  }
                                                });
                                              }}
                                              className="px-2.5 py-1 rounded text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow disabled:opacity-50"
                                            >
                                              Create Profile &amp; Reassign Result
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Mode 2: Reassign to Existing IWF Athlete */}
                                      {activeMode === 'reassign_existing' && (
                                        <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 space-y-2 text-[11px]">
                                          <div className="font-semibold text-sky-400">
                                            Reassign Result #{sc.db_result_id} to Existing IWF Profile in <code className="text-[10px]">iwf_lifters</code>
                                          </div>
                                          {allLifters.length > 1 && (
                                            <div>
                                              <label className="block text-[10px] text-app-muted mb-0.5">Select Discovered Candidate Lifter</label>
                                              <select
                                                value={reassignTarget}
                                                onChange={(e) => setIwfReassignTargetMap(prev => ({ ...prev, [cardKey]: e.target.value }))}
                                                className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                              >
                                                <option value="">-- Choose candidate or enter DB Lifter ID below --</option>
                                                {allLifters.map((l: any, pIdx: number) => (
                                                  <option key={l.db_lifter_id} value={String(l.db_lifter_id)}>
                                                    Person {pIdx + 1}: {l.athlete_name} ({l.birth_year ? `b. ${l.birth_year} • ` : ''}DB #{l.db_lifter_id} in iwf_lifters{l.iwf_lifter_id ? ` • IWF #${l.iwf_lifter_id}` : ''}{l.country_code ? ` • ${l.country_code}` : ''})
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          )}
                                          <div>
                                            <label className="block text-[10px] text-app-muted mb-0.5">Target <code className="text-[10px]">db_lifter_id</code> in <code className="text-[10px]">iwf_lifters</code></label>
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              pattern="[0-9]*"
                                              placeholder="Enter target db_lifter_id (e.g. 45683)"
                                              value={reassignTarget}
                                              onChange={(e) => setIwfReassignTargetMap(prev => ({ ...prev, [cardKey]: e.target.value }))}
                                              className="w-full px-2 py-1 rounded bg-app-secondary border border-app-primary text-app-primary text-[11px]"
                                            />
                                          </div>
                                          <div className="flex items-center justify-end gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => setIwfRepairModeMap(prev => ({ ...prev, [cardKey]: null }))}
                                              className="px-2.5 py-1 rounded text-[10px] bg-app-secondary border border-app-primary text-app-secondary hover:bg-app-hover hover:text-app-primary"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isActing || !reassignTarget.trim()}
                                              onClick={() => {
                                                handleResolve(item.id, 'APPROVED', undefined, {
                                                  repair_action: 'SCORECARD_REASSIGNED',
                                                  db_result_id: sc.db_result_id,
                                                  target_db_lifter_id: Number(reassignTarget)
                                                });
                                              }}
                                              className="px-2.5 py-1 rounded text-[10px] font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow disabled:opacity-50"
                                            >
                                              Confirm Result Reassignment
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {scorecards.length === 0 && (
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center space-y-1">
                          <div className="text-xs font-semibold text-amber-400">No active competition results found in database for Meet #{dbMeetId || 'Unknown'}</div>
                          <p className="text-[11px] text-app-secondary">
                            The staged review ticket is associated with {meetName ? `"${meetName}" (Meet #${dbMeetId})` : `Meet #${dbMeetId}`}, but no matching results currently exist in <code className="text-app-primary">iwf_meet_results</code>. You can dismiss this flag below, or execute a targeted re-scrape if this competition has not yet been ingested.
                          </p>
                        </div>
                      )}

                      {/* Authoritative Bottom Decision & Action Bar */}
                      {item.status === 'PENDING' && (() => {
                        const distinctAssignedLifters = Array.from(new Set(scorecards.map((sc: any) => sc.db_lifter_id).filter(Boolean)));
                        const hasMultipleLifters = distinctAssignedLifters.length > 1;

                        return (
                          <div className="mt-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs text-app-secondary">
                              <span className="font-semibold text-app-primary">Administrative Decision:</span>{' '}
                              {scorecards.length === 0 ? (
                                <span>
                                  No competition results exist in the live database for Meet #{dbMeetId || 'Unknown'}. You can dismiss this review item with zero database modifications.
                                </span>
                              ) : isHomonymDisambiguation ? (
                                <span>
                                  The result in Event #{iwfMeetId || dbMeetId} is currently attributed to Database Lifter #{distinctAssignedLifters[0] || dbLifterId} ({athleteName}). Confirming verifies this result belongs to this athlete profile with zero database modifications.
                                </span>
                              ) : hasMultipleLifters ? (
                                <span>
                                  Results are split across <strong>{distinctAssignedLifters.length} distinct athlete profiles</strong>: {distinctAssignedLifters.map(id => {
                                    const pInfo = lifterPersonMap.get(id);
                                    return `Person ${pInfo?.personIndex || '?'} (${pInfo?.lifterName || athleteName}${pInfo?.birthYear ? `, b. ${pInfo.birthYear}` : ''} • DB #${id})`;
                                  }).join(' and ')}. Confirming separate athletes keeps them on their respective profiles with zero database modifications.
                                </span>
                              ) : (
                                <span>
                                  All results are currently attributed to a single profile (<strong>db_lifter_id: {distinctAssignedLifters[0] || dbLifterId}</strong>). Confirming preserves dual-entry results with zero database modifications.
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => handleResolve(item.id, 'REJECTED')}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-app-primary bg-app-secondary hover:bg-app-hover text-app-secondary hover:text-rose-400 transition flex items-center gap-1.5 disabled:opacity-50"
                                title="Dismisses this review item and leaves all database records untouched"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Dismiss Flag (Leave Database Unchanged)</span>
                              </button>
                              {scorecards.length > 0 && (
                                <button
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => handleConfirmVerified(item)}
                                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-950/50 disabled:opacity-50"
                                  title={isHomonymDisambiguation
                                    ? "Confirms that this competition result belongs to this athlete profile and marks item resolved with zero database modifications"
                                    : hasMultipleLifters
                                      ? "Confirms that these results belong to distinct individuals and preserves their separate profiles with zero database modifications"
                                      : "Confirms both distinct meet results belong to this single athlete and marks item resolved with zero database modifications"
                                  }
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>
                                    {isHomonymDisambiguation
                                      ? 'Confirm Correct Attribution (0 Database Changes)'
                                      : hasMultipleLifters
                                        ? 'Confirm Separate Athletes (0 Database Changes)'
                                        : 'Confirm Dual Entry (Same Athlete — 0 Database Changes)'}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Expandable "Evidence & Reason" Drawer */}
                <div className="pt-1 border-t border-app-primary">
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-app-tertiary hover:text-app-primary transition"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span>{isExpanded ? 'Hide Evidence & Breakdown' : 'Show Evidence & Breakdown'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
                      {/* Score Breakdown (if present) */}
                      {ev.score_breakdown && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-app-muted uppercase">Score Factors</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ev.score_breakdown.map((b: string, bIdx: number) => (
                              <span key={bIdx} className="px-2 py-0.5 rounded text-[10px] bg-app-secondary border border-app-primary text-app-secondary">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Unassigned Competitions in split plan */}
                      {ev.split_plan?.unidentifiedCompetitions?.length > 0 && (
                        <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-lg text-amber-300 space-y-1">
                          <span className="font-semibold text-[11px] text-amber-400">
                            Unassigned Scorecards ({ev.split_plan.unidentifiedCompetitions.length})
                          </span>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {ev.split_plan.unidentifiedCompetitions.map((un: any, uIdx: number) => (
                              <div key={uIdx} className="text-[10px] text-app-secondary flex items-center justify-between border-t border-amber-500/20 pt-1">
                                <span className="flex items-center gap-1.5">
                                  <Link href={`/meet/${un.meet_id}`} target="_blank" className="text-sky-400 hover:underline font-semibold">
                                    Meet #{un.meet_id}
                                  </Link>
                                  <span>({formatDisplayDate(un.date)}) • {un.age_category || ''} {un.weight_class || ''}</span>
                                </span>
                                {un.sport80Url && (
                                  <a href={un.sport80Url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline flex items-center gap-0.5">
                                    Sport80 <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admin Notes attached */}
                      {ev.admin_notes && (
                        <div className="p-2 bg-indigo-950/30 border border-indigo-500/30 rounded-lg text-indigo-300 text-[11px]">
                          <strong>Admin Review Note:</strong> {ev.admin_notes}
                        </div>
                      )}

                      {/* Raw Evidence Inspector */}
                      <details className="text-[10px] text-app-muted cursor-pointer pt-1">
                        <summary className="hover:text-app-primary">View Raw Evidence JSON</summary>
                        <pre className="mt-1 p-2 bg-app-secondary rounded border border-app-primary overflow-x-auto text-[10px] text-app-secondary font-mono">
                          {JSON.stringify(ev, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 8. Pagination Controls */}
      {!loading && totalItems > limit && (
        <div className="p-3 bg-app-secondary border border-app-primary rounded-xl flex items-center justify-between text-xs text-app-secondary shadow-sm">
          <div>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalItems)} of {totalItems.toLocaleString()} items
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-lg border border-app-primary bg-white/[0.03] hover:bg-app-tertiary text-app-secondary hover:text-app-primary transition disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-mono text-[11px] text-app-primary">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-app-primary bg-white/[0.03] hover:bg-app-tertiary text-app-secondary hover:text-app-primary transition disabled:opacity-40 flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 9. Reviewer Notes Modal */}
      {noteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card-primary border border-app-primary rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-app-primary flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Reviewer Notes
              </h4>
              <button
                onClick={() => setNoteModalItem(null)}
                className="text-app-muted hover:text-app-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-app-secondary">
              Attach administrative rationale or context to <strong>{noteModalItem.title}</strong>:
            </p>

            <textarea
              value={modalNotesText}
              onChange={(e) => setModalNotesText(e.target.value)}
              placeholder="e.g. Verified via official Sport80 rankings and birth year correlation..."
              className="w-full h-24 p-2.5 rounded-xl bg-app-secondary border border-app-primary text-xs text-app-primary placeholder-app-muted focus:outline-none focus:border-indigo-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setNoteModalItem(null)}
                className="px-3 py-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-xs text-app-secondary hover:text-app-primary transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(noteModalItem.id, noteModalItem.resolution, modalNotesText)}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow"
              >
                Save & Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Clean Partition Batch Reconciliation Audit Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="card-primary border border-app-primary rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-app-primary flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-app-primary flex items-center gap-2">
                    Batch Resolution: Zero-Conflict Identity Splits
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                      0 Flagged Competitions
                    </span>
                  </h3>
                  <p className="text-[11px] text-app-muted">
                    Audit and approve shared-name athlete groups where 100% of competitions are already linked to official USA Weightlifting membership numbers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1 rounded-lg text-app-muted hover:text-app-primary hover:bg-app-hover transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Controls Bar */}
            <div className="p-3 border-b border-app-primary bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex items-center w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={auditFilterText}
                  onChange={(e) => setAuditFilterText(e.target.value)}
                  placeholder="Filter clean items by name or member #..."
                  className="w-full pl-8 pr-3 py-1.5 bg-app-secondary border border-app-primary rounded-lg text-xs text-app-primary placeholder-app-muted focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = new Set(auditItems.map((i: any) => i.id));
                    setSelectedAuditIds(allIds);
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-app-secondary hover:bg-app-hover text-app-secondary border border-app-primary transition"
                >
                  Select All ({auditItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAuditIds(new Set())}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-app-secondary hover:bg-app-hover text-app-secondary border border-app-primary transition"
                >
                  Deselect All
                </button>
                <span className="text-xs text-app-muted ml-2">
                  Selected: <strong className="text-emerald-500">{selectedAuditIds.size}</strong> of {auditItems.length}
                </span>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {auditLoading ? (
                <div className="py-16 text-center text-app-muted space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-500" />
                  <p className="text-xs">Loading candidate profiles from live database...</p>
                </div>
              ) : auditItems.length === 0 ? (
                <div className="py-16 text-center text-app-muted space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-semibold text-app-primary">No zero-conflict identity splits pending</p>
                  <p className="text-[11px] text-app-muted">All pending homonym splits currently contain competitions flagged for review.</p>
                </div>
              ) : (
                <div className="border border-app-primary rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/[0.03] border-b border-app-primary text-[11px] text-app-muted font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={auditItems.length > 0 && selectedAuditIds.size === auditItems.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAuditIds(new Set(auditItems.map((i: any) => i.id)));
                              } else {
                                setSelectedAuditIds(new Set());
                              }
                            }}
                            className="rounded border-app-primary bg-app-secondary text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">Athlete Name & Title</th>
                        <th className="py-2.5 px-3 text-center">Candidates</th>
                        <th className="py-2.5 px-3 text-center">Total Meets</th>
                        <th className="py-2.5 px-3">Member Numbers</th>
                        <th className="py-2.5 px-3 text-right">Staged Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-primary bg-app-secondary">
                      {auditItems
                        .filter((item) => {
                          if (!auditFilterText) return true;
                          const q = auditFilterText.toLowerCase();
                          return (
                            (item.athlete_name && item.athlete_name.toLowerCase().includes(q)) ||
                            (item.title && item.title.toLowerCase().includes(q)) ||
                            (item.membership_numbers && item.membership_numbers.some((m: string) => String(m).includes(q)))
                          );
                        })
                        .map((item) => {
                          const isSelected = selectedAuditIds.has(item.id);
                          return (
                            <tr
                              key={item.id}
                              onClick={() => {
                                setSelectedAuditIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              className={`cursor-pointer transition ${isSelected ? 'bg-indigo-950/30 hover:bg-indigo-950/40' : 'hover:bg-app-hover'
                                }`}
                            >
                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedAuditIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  className="rounded border-app-primary bg-app-secondary text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-app-primary">{item.athlete_name || item.title}</div>
                                <div className="text-[10px] text-app-muted font-mono">{item.id.slice(0, 8)}...</div>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20">
                                  {item.candidate_count} Athletes
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-app-secondary">
                                {item.total_competitions}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-app-muted font-mono">
                                {item.membership_numbers?.join(', ') || '—'}
                              </td>
                              <td className="py-2 px-3 text-right text-[11px] text-app-muted">
                                {formatEasternDateTime(item.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-app-primary bg-white/[0.02] flex items-center justify-between gap-3">
              <div className="text-xs text-app-muted">
                <span>Total Zero-Conflict: <strong className="text-app-primary">{auditItems.length}</strong></span>
                <span className="mx-2">•</span>
                <span>Selected: <strong className="text-emerald-500">{selectedAuditIds.size}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-app-primary bg-app-secondary hover:bg-app-hover text-xs text-app-secondary hover:text-app-primary transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBatchApprove}
                  disabled={auditActing || selectedAuditIds.size === 0}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow disabled:opacity-50"
                >
                  {auditActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Approve Selected ({selectedAuditIds.size} Items)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
