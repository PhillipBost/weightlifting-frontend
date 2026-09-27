'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
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
  ArrowRight,
  UserCheck,
  Mail
} from 'lucide-react';
import { FederationSelector } from './FederationSelector';
import { GeographyCascade } from './GeographyCascade';
import { 
  FederationMatch, 
  FederationSelection, 
  CandidateQuery,
  UploaderSelections,
  BatchResolveResponse,
  CompetitionScope,
  formatDefinedTeam
} from '@/types/federation';

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
  venue: string | null;
  country: string | null;
  organizer?: string | null;
  athleteCount: number;
  clubCount: number;
  sampleTeams?: string[];
  formatVersion: string;
  rawFederation: string | null;
  explicitFederation?: string | null;
  candidateQueries?: (CandidateQuery | string)[];
  selectedFederation: FederationSelection | null;
  suggestedFederation?: FederationSelection | null;
  uploaderSelections: UploaderSelections;
  geographyInference?: BatchResolveResponse | null;
  hasFederationError?: boolean;
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

function formatMeetDates(startDate: string | null, endDate: string | null): string | null {
  if (!startDate) return null;
  if (!endDate || startDate === endDate) {
    const d = new Date(startDate + 'T00:00:00');
    return isNaN(d.getTime()) ? startDate : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const s = new Date(startDate + 'T00:00:00');
  const e = new Date(endDate + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${startDate} – ${endDate}`;
  const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
  const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
  const sDay = s.getDate();
  const eDay = e.getDate();
  if (sMonth === eMonth && s.getFullYear() === e.getFullYear()) {
    return `${sMonth} ${sDay}–${eDay}, ${s.getFullYear()}`;
  }
  return `${sMonth} ${sDay}, ${s.getFullYear()} – ${eMonth} ${eDay}, ${s.getFullYear()}`;
}

function extractCountryCandidate(country?: string | null, city?: string | null): string | null {
  if (country && country.trim()) return country.trim();
  if (city && city.includes(',')) {
    const parts = city.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts[parts.length - 1];
  }
  if (city && city.trim()) return city.trim();
  return null;
}

function extractFederationFromPayload(comp: any, json: any): string | null {
  const targetKeys = ['federation', 'governingfederation', 'competitionfederation', 'sanctioningfederation'];

  if (comp && typeof comp === 'object') {
    for (const [k, v] of Object.entries(comp)) {
      if (targetKeys.includes(k.toLowerCase()) && v) {
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'object' && (v as any).name) return String((v as any).name).trim();
      }
    }
  }

  if (json && typeof json === 'object') {
    for (const [k, v] of Object.entries(json)) {
      if (targetKeys.includes(k.toLowerCase()) && v) {
        if (typeof v === 'string' && v.trim()) return v.trim();
        if (typeof v === 'object' && (v as any).name) return String((v as any).name).trim();
      }
    }
  }

  const org = (comp?.competitionOrganizer || json?.competitionOrganizer || '')?.toString().trim();
  if (org && (/^(fhq|usaw|wch|iwf|ewf|owa|awa|bcwa)\b/i.test(org) || /fédération|federation/i.test(org))) {
    return org;
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
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);


  // Prevent browser default drop behavior (which reloads the page or navigates away)
  useEffect(() => {
    const preventDragDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith('.json'));
        if (files.length > 0) {
          processFiles(files);
        }
      }
    };

    window.addEventListener('dragenter', preventDragDefaults, false);
    window.addEventListener('dragover', preventDragDefaults, false);
    window.addEventListener('drop', handleGlobalDrop, false);
    document.addEventListener('dragenter', preventDragDefaults, false);
    document.addEventListener('dragover', preventDragDefaults, false);
    document.addEventListener('drop', handleGlobalDrop, false);
    return () => {
      window.removeEventListener('dragenter', preventDragDefaults);
      window.removeEventListener('dragover', preventDragDefaults);
      window.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragenter', preventDragDefaults);
      document.removeEventListener('dragover', preventDragDefaults);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragActive(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
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
      setGlobalError('No valid .json files selected. Please select owlcms JSON exports.');
      return;
    }

    // Filter out duplicates already in queue
    const nonDuplicateFiles = validJsonFiles.filter((f) => {
      const isDupe = queue.some((q) => q.fileName === f.name && q.fileSize === f.size);
      return !isDupe;
    });

    if (nonDuplicateFiles.length < validJsonFiles.length) {
      const skippedCount = validJsonFiles.length - nonDuplicateFiles.length;
      setGlobalError(`${skippedCount} duplicate file(s) already staged in queue and skipped.`);
      setTimeout(() => {
        setGlobalError((prev) => (prev?.includes('already staged') ? null : prev));
      }, 4000);
    }

    if (nonDuplicateFiles.length === 0) {
      return;
    }

    setIsAnalyzing(true);
    let remainingFiles = nonDuplicateFiles.length;

    // Process each file and construct queue items
    nonDuplicateFiles.forEach((file) => {
      const itemId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const reader = new FileReader();

      reader.onload = async (event) => {
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
          const venue = comp.competitionSite || json.venue || null;
          const country = comp.country || json.country || null;
          const athletes = json.athletes || json.competitors || [];
          const teams = json.teams || [];
          const sampleTeams = teams.map((t: any) => t?.name).filter(Boolean);
          const formatVersion = (json.formatVersion || json.version || '1.0').toString();
          const explicitFederation = extractFederationFromPayload(comp, json);
          const organizer = (comp.competitionOrganizer || json.competitionOrganizer || null)?.toString().trim() || null;
          const compName = (comp.competitionName || comp.name || json.competitionName || '').toString().trim();
          const compCountry = (comp.country || json.country || null)?.toString().trim() || null;

          // Candidate query extraction for automatic federation guessing with exact source field provenance
          const candidateList: CandidateQuery[] = [];
          if (organizer) {
            candidateList.push({
              sourceField: 'competition.competitionOrganizer',
              fieldLabel: 'Competition Organizer',
              value: organizer
            });
          }
          if (compName) {
            candidateList.push({
              sourceField: 'competition.competitionName',
              fieldLabel: 'Meet Name',
              value: compName
            });
          }
          if (compCountry) {
            candidateList.push({
              sourceField: 'competition.country',
              fieldLabel: 'Host Country',
              value: compCountry
            });
          }

          // Extract state/province from city (e.g. "Chambly, Québec" -> "Québec", "Austin, TX" -> "TX")
          if (city && city.includes(',')) {
            const parts = city.split(',').map((p: string) => p.trim()).filter(Boolean);
            if (parts.length > 1) {
              candidateList.push({
                sourceField: 'competition.competitionCity',
                fieldLabel: 'City State/Province',
                value: parts[parts.length - 1]
              });
            }
          }

          // Extract acronym/prefix from federation email (e.g. "fhq.owlcms@gmail.com" -> "fhq")
          const fedEmail = (comp.federationEMail || json.federationEMail || '')?.toString().trim();
          if (fedEmail && fedEmail.includes('@')) {
            const emailPrefix = fedEmail.split('@')[0].split('.')[0].trim();
            if (emailPrefix.length >= 2) {
              candidateList.push({
                sourceField: 'competition.federationEMail',
                fieldLabel: 'Federation Contact Email',
                value: emailPrefix
              });
            }
          }

          // Extract national keywords if present in meet name
          if (/canadien|canada/i.test(compName)) {
            candidateList.push({
              sourceField: 'competition.competitionName',
              fieldLabel: 'National Keyword in Meet Name',
              value: 'Canada'
            });
          }
          if (/usa|american|national/i.test(compName)) {
            candidateList.push({
              sourceField: 'competition.competitionName',
              fieldLabel: 'National Keyword in Meet Name',
              value: 'USA Weightlifting'
            });
          }
          if (/québec|quebec/i.test(compName)) {
            candidateList.push({
              sourceField: 'competition.competitionName',
              fieldLabel: 'State / Provincial Keyword in Meet Name',
              value: 'Québec'
            });
          }
          if (/ontario/i.test(compName)) {
            candidateList.push({
              sourceField: 'competition.competitionName',
              fieldLabel: 'State / Provincial Keyword in Meet Name',
              value: 'Ontario'
            });
          }

          // Extract tokens from filename (e.g., FHQ, USAW, WCH)
          const fileNameUpper = file.name.toUpperCase();
          if (fileNameUpper.includes('FHQ')) {
            candidateList.push({
              sourceField: 'file.name',
              fieldLabel: 'File Name',
              value: 'FHQ'
            });
          }
          if (fileNameUpper.includes('USAW')) {
            candidateList.push({
              sourceField: 'file.name',
              fieldLabel: 'File Name',
              value: 'USAW'
            });
          }
          if (fileNameUpper.includes('WCH') || fileNameUpper.includes('CWFHC')) {
            candidateList.push({
              sourceField: 'file.name',
              fieldLabel: 'File Name',
              value: 'WCH'
            });
          }

          const rawFederation = explicitFederation || organizer || null;

          // Execute Batch Resolve against owlanalytics.org gateway
          let geographyInference: BatchResolveResponse | null = null;
          let defaultSelections: UploaderSelections = {
            international_id: null,
            continent_id: null,
            regional_id: null,
            country_id: null,
            organizer_id: null,
            host_country_code: null,
            competition_scope: 'local',
            cleared: []
          };

          const rawRecordFeds = Array.isArray(json.records)
            ? json.records.map((r: any) => r?.recordFederation).filter(Boolean)
            : [];
          const rawTeamNames = Array.isArray(json.teams)
            ? json.teams.map((t: any) => t?.name).filter(Boolean)
            : [];
          const rawAthleteCountries = athletes
            .map((a: any) => a?.country || a?.nation || a?.fed)
            .filter((c: any) => typeof c === 'string' && c.trim().length >= 2);

          try {
            const resolveRes = await fetch('/api/federations/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organizer_text: organizer,
                federation_text: explicitFederation || organizer,
                competition_name: compName,
                host_country_text: compCountry,
                city_text: city,
                venue_text: venue,
                record_federations: rawRecordFeds,
                team_names: rawTeamNames,
                athlete_countries: rawAthleteCountries,
                competition_date: startDate
              })
            });
            const contentType = resolveRes.headers.get('content-type') || '';
            const resolveData = resolveRes.ok && contentType.includes('application/json')
              ? await resolveRes.json()
              : null;
            if (resolveData?.success) {
              geographyInference = resolveData;
              const fedMatch = resolveData.federation?.match;
              const orgMatch = resolveData.organizer?.match;

              let internationalId: string | null = null;
              let continentId: string | null = null;
              let regionalId: string | null = null;
              let countryId: string | null = null;
              let organizerId: string | null = null;
              const suggestedScope = resolveData.suggested_scope || 'unknown';
              const isMultiNationScope = suggestedScope === 'continental' || suggestedScope === 'international' || suggestedScope === 'regional';
              const isNationalScope = suggestedScope === 'national';
              const isStateProvincialScope = suggestedScope === 'state_provincial';

              if (fedMatch?.level === 'global_international' || fedMatch?.level === 'international') {
                internationalId = fedMatch.id;
              } else if (fedMatch?.level === 'continental') {
                continentId = fedMatch.id;
              } else if (fedMatch?.level === 'intercontinental_regional' || fedMatch?.level === 'regional') {
                regionalId = fedMatch.id;
              } else if (fedMatch?.level === 'national' && !isMultiNationScope) {
                countryId = fedMatch.id;
              } else if (fedMatch?.level === 'regional_state_wso' && !isMultiNationScope && !isNationalScope) {
                organizerId = fedMatch.id;
              }

              // Infer international apex federation if detected
              if (suggestedScope === 'international' && !internationalId && resolveData.inferred_international_federation) {
                internationalId = resolveData.inferred_international_federation.id;
              }

              // Infer continental confederation if detected
              if (suggestedScope === 'continental' && !continentId && resolveData.inferred_continental_federation) {
                continentId = resolveData.inferred_continental_federation.id;
              }

              if (orgMatch && !isMultiNationScope) {
                if (orgMatch.level === 'national' && !countryId && !isStateProvincialScope) {
                  countryId = orgMatch.id;
                } else if (orgMatch.level === 'regional_state_wso' && !isNationalScope) {
                  organizerId = orgMatch.id;
                }
              }

              // Infer national federation from host country or inferred_national_federation
              if (!countryId && resolveData.inferred_national_federation) {
                countryId = resolveData.inferred_national_federation.id;
              } else if (!countryId && (suggestedScope === 'national' || suggestedScope === 'state_provincial') && resolveData.host_country?.match?.level === 'national' && !resolveData.host_country.match.id.startsWith('country:')) {
                countryId = resolveData.host_country.match.id;
              }

              // Infer regional federation if detected for regional meets
              if (suggestedScope === 'regional' && !regionalId && resolveData.inferred_regional_federation && (resolveData.inferred_regional_federation.level === 'regional' || resolveData.inferred_regional_federation.level === 'intercontinental_regional')) {
                regionalId = resolveData.inferred_regional_federation.id;
              }

              // Infer state / provincial federation if detected for state_provincial or local meets
              if ((suggestedScope === 'state_provincial' || suggestedScope === 'local' || suggestedScope === 'unknown') && (!organizerId || suggestedScope === 'state_provincial') && resolveData.inferred_regional_federation && resolveData.inferred_regional_federation.level === 'regional_state_wso') {
                organizerId = resolveData.inferred_regional_federation.id;
              }

              let customInternationalName: string | null = null;
              if (suggestedScope === 'international' && !internationalId && resolveData.inferred_international_name) {
                customInternationalName = resolveData.inferred_international_name;
              }

              // Strict Governance Isolation:
              // International / Continental / Regional: Cross-border multi-nation; strictly NO National Fed (unless co-sanctioned) and NO State/Provincial Fed
              // National: Domestic country-wide; National Fed required/inferred; strictly NO State/Provincial Fed
              if (isMultiNationScope) {
                if (resolveData.inferred_national_federation) {
                  countryId = resolveData.inferred_national_federation.id;
                } else {
                  countryId = null;
                }
                organizerId = null;
              } else if (isNationalScope) {
                organizerId = null;
              }

              const hostCode =
                resolveData.host_country?.match?.country_code ||
                resolveData.host_country?.match?.short_code ||
                fedMatch?.country_code ||
                orgMatch?.country_code ||
                null;

              defaultSelections = {
                international_id: internationalId,
                continent_id: continentId,
                regional_id: regionalId,
                country_id: countryId,
                organizer_id: organizerId,
                custom_international_name: customInternationalName,
                custom_regional_name: null,
                host_country_code: hostCode,
                competition_scope: suggestedScope,
                cleared: []
              };
            }
          } catch (err) {
            console.error('Batch resolve error:', err);
          }

          let resolvedFederation: FederationSelection | null = geographyInference?.federation?.match || geographyInference?.organizer?.match || null;
          let suggestedFederation: FederationSelection | null = resolvedFederation ? {
            ...resolvedFederation,
            isGuessed: true,
            guessedFrom: organizer || explicitFederation || '',
            guessedFromField: organizer ? 'competition.competitionOrganizer' : 'competition.federation'
          } : null;

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
            venue,
            country,
            organizer,
            sampleTeams,
            rawFederation,
            explicitFederation,
            candidateQueries: candidateList,
            selectedFederation: resolvedFederation,
            suggestedFederation: suggestedFederation,
            uploaderSelections: defaultSelections,
            geographyInference: geographyInference,
            hasFederationError: false,
            athleteCount: athletes.length,
            clubCount: teams.length,
            formatVersion,
            status: 'queued',
            steps: CREATE_INITIAL_STEPS(),
            isExpanded: false
          };

          setQueue((prev) => [newItem, ...prev]);
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
            venue: null,
            country: null,
            rawFederation: null,
            selectedFederation: null,
            uploaderSelections: { cleared: [] },
            athleteCount: 0,
            clubCount: 0,
            formatVersion: 'Unknown',
            status: 'error',
            errorMessage: `Invalid JSON: ${err.message}`,
            steps: CREATE_INITIAL_STEPS(),
            isExpanded: false
          };
          setQueue((prev) => [failedItem, ...prev]);
        } finally {
          remainingFiles--;
          if (remainingFiles <= 0) {
            setIsAnalyzing(false);
          }
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
            batchMode: true,
            federationId: currentItem.uploaderSelections?.country_id || currentItem.uploaderSelections?.regional_id || currentItem.uploaderSelections?.continent_id || currentItem.uploaderSelections?.international_id || currentItem.uploaderSelections?.organizer_id || currentItem.selectedFederation?.id || null,
            federationName: currentItem.selectedFederation?.canonical_name || null,
            revisionNotes: currentItem.uploaderSelections?.additional_notes || null,
            uploaderSelections: currentItem.uploaderSelections,
            submitterName: submitterName.trim() || null,
            submitterEmail: submitterEmail.trim() || null
          })
        });

        let data: any = null;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            data = await res.json();
          } catch {}
        } else {
          const errText = await res.text();
          data = { success: false, error: `Server error (${res.status}): ${errText.slice(0, 100)}` };
        }
        if (!data) {
          data = { success: false, error: `Failed to parse response (${res.status})` };
        }

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

    // 1. Validate Submitter Name & Contact Email (only required for live ingestion)
    if (!dryRun) {
      if (!submitterName.trim()) {
        setNameError('Submitter name is required.');
        setGlobalError('Please provide a submitter name before proceeding.');
        return;
      }
      setNameError(null);

      if (!submitterEmail.trim()) {
        setEmailError('Contact email is required.');
        setGlobalError('Please provide a contact email address before proceeding.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(submitterEmail.trim())) {
        setEmailError('Please enter a valid email address.');
        setGlobalError('Please provide a valid contact email address.');
        return;
      }
      setEmailError(null);
    } else {
      setNameError(null);
      setEmailError(null);
    }

    // 3. Validate Federation Selection for all meets in queue
    const hasMissingFederation = queue.some((item) => {
      const scope = item.uploaderSelections?.competition_scope;
      if (scope === 'national') {
        return !item.uploaderSelections?.country_id && !item.selectedFederation;
      }
      if (scope === 'state_provincial') {
        return !item.uploaderSelections?.organizer_id && !item.uploaderSelections?.country_id && !item.selectedFederation;
      }
      if (scope === 'continental') {
        return !item.uploaderSelections?.continent_id && !item.selectedFederation;
      }
      if (scope === 'regional') {
        return !item.uploaderSelections?.regional_id && !item.uploaderSelections?.host_country_code && !item.selectedFederation;
      }
      if (scope === 'international') {
        return !item.uploaderSelections?.international_id && !item.uploaderSelections?.custom_international_name && !item.selectedFederation && !item.uploaderSelections?.host_country_code;
      }
      return false;
    });
    if (hasMissingFederation) {
      setQueue((prev) =>
        prev.map((item) => {
          const scope = item.uploaderSelections?.competition_scope;
          let isMissing = false;
          if (scope === 'national') {
            isMissing = !item.uploaderSelections?.country_id && !item.selectedFederation;
          } else if (scope === 'state_provincial') {
            isMissing = !item.uploaderSelections?.organizer_id && !item.uploaderSelections?.country_id && !item.selectedFederation;
          } else if (scope === 'continental') {
            isMissing = !item.uploaderSelections?.continent_id && !item.selectedFederation;
          } else if (scope === 'regional') {
            isMissing = !item.uploaderSelections?.regional_id && !item.uploaderSelections?.host_country_code && !item.selectedFederation;
          } else if (scope === 'international') {
            isMissing = !item.uploaderSelections?.international_id && !item.uploaderSelections?.custom_international_name && !item.selectedFederation && !item.uploaderSelections?.host_country_code;
          }
          return isMissing ? { ...item, hasFederationError: true } : item;
        })
      );
      setGlobalError('Jurisdiction selection is required for all staged meets. Please select the governing body or scope.');
      return;
    }

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

  // Pre-conditions for enabling the Import button
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isNameValid = Boolean(submitterName.trim());
  const isEmailValid = Boolean(submitterEmail.trim()) && emailRegex.test(submitterEmail.trim());
  const unselectedFedCount = queue.filter(
    (item) => !item.uploaderSelections?.country_id && !item.uploaderSelections?.organizer_id && !item.uploaderSelections?.continent_id && !item.selectedFederation
  ).length;
  const isFederationComplete = unselectedFedCount === 0;

  const missingRequirements: string[] = [];
  if (queue.length === 0) {
    missingRequirements.push('Drop JSON meet files');
  } else {
    if (!dryRun && !isNameValid) missingRequirements.push('Submitter Name');
    if (!dryRun && !isEmailValid) missingRequirements.push('Valid Contact Email');
    if (!isFederationComplete) {
      missingRequirements.push(
        unselectedFedCount === 1 ? 'Jurisdiction / Federation for 1 staged meet' : `Jurisdiction / Federation for ${unselectedFedCount} staged meets`
      );
    }
  }

  const isReadyToImport = queue.length > 0 && (dryRun || (isNameValid && isEmailValid)) && isFederationComplete && !isProcessing;

  return (
    <div className="w-full p-6 sm:p-8 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl text-slate-100">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <Database className="w-3.5 h-3.5" />
          owlcms Ingestion
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          owlcms JSON Importer
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-xl mx-auto">
          Upload one or more owlcms competition export files (.json). Meets are checked for duplicate sessions, validated against the federation registry, and staged for ingestion.
        </p>
      </div>

      {/* Global / Duplicate Notice Banner */}
      {globalError && (
        <div className="mb-4 max-w-3xl mx-auto py-2 px-3.5 bg-slate-900/90 border border-slate-700/80 rounded-lg flex items-center justify-between text-xs text-slate-300 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="truncate">{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="text-slate-400 hover:text-white ml-2 p-0.5 rounded cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Fixed File Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`mb-5 max-w-3xl mx-auto w-full rounded-2xl border bg-slate-950/50 p-3.5 transition-all ${
          dragActive
            ? 'border-sky-400 bg-sky-500/10 ring-2 ring-sky-500/30'
            : 'border-slate-800'
        }`}
      >
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
            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all border-slate-700/80 hover:border-slate-500 hover:bg-slate-900/40 min-h-[160px]"
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
                <span className="text-sm font-semibold text-sky-300 animate-pulse">
                  Analyzing meet file &amp; inferring details...
                </span>
              </div>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-sky-400 mb-2" />
                <span className="text-sm font-semibold text-slate-200">
                  Drop owlcms competition export files here
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  or click to browse files • Supports multi-file (.json)
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-400" />
                {queue.length} {queue.length === 1 ? 'file loaded' : 'files loaded'}
              </span>
              <div className="flex items-center gap-2">
                {isAnalyzing ? (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-500/40 text-[11px] text-sky-300 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                    <span>Analyzing file...</span>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {isAnalyzing && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-xs text-sky-300 animate-pulse shadow-sm">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 flex-shrink-0" />
                  <span className="font-medium">Reading file &amp; inferring governance scope...</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1.5 space-y-2.5 pr-1 text-xs">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Meet Name
                      </span>
                      <h4 className="text-sm sm:text-base font-bold text-white break-words whitespace-normal leading-snug">
                        {item.meetName}
                      </h4>
                      <ul className="mt-2 space-y-1 text-xs">
                        {item.startDate && (
                          <li className="flex items-baseline gap-2">
                            <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Dates:</span>
                            <span className="text-slate-200">{formatMeetDates(item.startDate, item.endDate)}</span>
                          </li>
                        )}
                        {item.city && (
                          <li className="flex items-baseline gap-2">
                            <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Location:</span>
                            <span className="text-slate-200">{item.city}</span>
                          </li>
                        )}
                        {item.venue && (
                          <li className="flex items-baseline gap-2">
                            <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Venue:</span>
                            <span className="text-slate-200">{item.venue}</span>
                          </li>
                        )}
                        {item.athleteCount > 0 && (
                          <li className="flex items-baseline gap-2">
                            <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Participants:</span>
                            <span className="text-slate-200">
                              {item.athleteCount} athletes
                              {item.clubCount > 0 && ` across ${item.clubCount} teams${item.sampleTeams && item.sampleTeams.length > 0 ? ` (e.g., ${item.sampleTeams.slice(0, 3).map(formatDefinedTeam).join(', ')}${item.sampleTeams.length > 3 ? ', etc.' : ''})` : ''}`}
                            </span>
                          </li>
                        )}
                        {item.organizer && (
                          <li className="flex items-baseline gap-2">
                            <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Organizer:</span>
                            <span className="text-slate-200">{item.organizer}</span>
                          </li>
                        )}
                        <li className="flex items-baseline gap-2">
                          <span className="w-24 flex-shrink-0 text-slate-400 font-medium">File Format:</span>
                          <span className="font-mono text-slate-400">owlcms JSON Export v{item.formatVersion}</span>
                        </li>
                      </ul>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          item.status === 'completed'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : item.status === 'active'
                            ? 'bg-sky-950/80 text-sky-400 border border-sky-800/60'
                            : item.status === 'staged_revision'
                            ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                            : item.status === 'exact_duplicate'
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : item.status === 'error'
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                            : 'bg-slate-800/80 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {item.status === 'completed'
                          ? '✓ Ingested'
                          : item.status === 'active'
                          ? 'Ingesting...'
                          : item.status === 'staged_revision'
                          ? 'Held for Review'
                          : item.status === 'exact_duplicate'
                          ? 'Already in Database (Skipped)'
                          : item.status === 'error'
                          ? 'Failed'
                          : 'Staged in Queue'}
                      </span>
                      {!isProcessing && item.status !== 'active' && item.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => removeQueueItem(item.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Remove this meet from queue"
                          aria-label="Remove meet"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Geography, Organizer & Scope Cascade */}
                  <GeographyCascade
                    asOfDate={item.startDate}
                    uploaderSelections={item.uploaderSelections}
                    geographyInference={item.geographyInference}
                    onChange={(newSelections) => {
                      setQueue((prev) =>
                        prev.map((q) => (q.id === item.id ? { ...q, uploaderSelections: newSelections, hasFederationError: false } : q))
                      );
                    }}
                    hasError={item.hasFederationError}
                    disabled={isProcessing || item.status === 'completed' || item.status === 'exact_duplicate'}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Submitter Contact Details & Ingestion Options (Positioned below drop zone) */}
      <div className="p-4 mb-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
          <span className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-sky-400" />
            Submitter Contact Details
          </span>
          <span className="text-[11px] text-slate-500 font-normal">Audit tracking &amp; confirmation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                Submitter Name {dryRun ? <span className="text-slate-500 font-normal">(optional for test)</span> : <span className="text-rose-400 font-bold">*</span>}
              </span>
              <span className={`text-[10px] font-medium ${dryRun ? 'text-amber-400/80' : 'text-rose-400/80'}`}>
                {dryRun ? 'Optional for Dry Run' : 'Required'}
              </span>
            </label>
            <input
              type="text"
              required={!dryRun}
              placeholder="Submitter name"
              value={submitterName}
              onChange={(e) => {
                setSubmitterName(e.target.value);
                if (nameError) setNameError(null);
              }}
              disabled={isProcessing}
              className={`px-3 py-2 text-xs rounded-xl bg-slate-900 border ${
                nameError
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-slate-700 focus:border-sky-500'
              } text-white placeholder-slate-500 focus:outline-none transition`}
            />
            {nameError && (
              <span className="text-[11px] text-rose-400 mt-0.5">{nameError}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-500" />
                Contact Email {dryRun ? <span className="text-slate-500 font-normal">(optional for test)</span> : <span className="text-rose-400 font-bold">*</span>}
              </span>
              <span className={`text-[10px] font-medium ${dryRun ? 'text-amber-400/80' : 'text-rose-400/80'}`}>
                {dryRun ? 'Optional for Dry Run' : 'Required'}
              </span>
            </label>
            <input
              type="email"
              required={!dryRun}
              placeholder="your.email@example.com"
              value={submitterEmail}
              onChange={(e) => {
                setSubmitterEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              disabled={isProcessing}
              className={`px-3 py-2 text-xs rounded-xl bg-slate-900 border ${
                emailError
                  ? 'border-rose-500 focus:border-rose-400'
                  : 'border-slate-700 focus:border-sky-500'
              } text-white placeholder-slate-500 focus:outline-none transition`}
            />
            {emailError && (
              <span className="text-[11px] text-rose-400 mt-0.5">{emailError}</span>
            )}
          </div>
        </div>

      </div>

      {/* 3. Ingestion Pipeline Steps Indicator */}
      <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          Ingestion Pipeline
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CREATE_INITIAL_STEPS().map((step, idx) => {
            const currentStep = queue[0]?.steps?.find((s) => s.id === step.id);
            const sComplete = currentStep?.status === 'completed';
            const sInProg = currentStep?.status === 'in_progress';
            return (
              <div
                key={step.id}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  sComplete
                    ? 'border-emerald-500/30 bg-emerald-950/10 text-emerald-300'
                    : sInProg
                    ? 'border-sky-500/40 bg-sky-950/20 text-sky-300 animate-pulse'
                    : 'border-slate-800/80 bg-slate-900/40 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-semibold truncate">{step.title}</span>
                </div>
                <span className="text-[10px] font-mono flex-shrink-0">
                  {sComplete ? `✓ ${formatDuration(currentStep.recordedMs)}` : sInProg ? 'Running...' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Action Controls Bar (Fixed at bottom) */}
      <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {queue.length === 0 ? (
              <span>Load JSON meet exports above to begin</span>
            ) : (
              <span>
                {queue.length} {queue.length === 1 ? 'meet' : 'meets'} staged •{' '}
                {dryRun ? 'Dry run mode (no database writes)' : 'Live database ingestion'}
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {/* Dry Run (Test Mode) toggle — proximate to the import button
                it modifies, so the mode switch and its action are one unit */}
            <label
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition select-none ${
                dryRun
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Test the files and check for duplicate sessions without saving anything to the database."
            >
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setDryRun(isChecked);
                  if (isChecked) {
                    setNameError(null);
                    setEmailError(null);
                  }
                }}
                disabled={isProcessing}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-600 flex-shrink-0"
              />
              <span className="font-semibold whitespace-nowrap">Dry Run (Test Mode)</span>
            </label>

            <button
              onClick={handleRunClick}
              disabled={!isReadyToImport}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-6 font-semibold text-sm rounded-xl shadow-lg transition-all ${
                !isReadyToImport
                  ? 'bg-slate-800/80 text-slate-500 border border-slate-700/80 cursor-not-allowed opacity-60 shadow-none'
                  : dryRun
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20 text-white cursor-pointer'
                  : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30 text-white cursor-pointer'
              }`}
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

        {/* Incomplete / Missing Requirements Instructions */}
        {!isReadyToImport && queue.length > 0 && missingRequirements.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800/80 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              Information Required to Report:
            </span>
            {missingRequirements.map((req, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] font-medium text-amber-300"
              >
                {req}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OwlcmsUploader;
