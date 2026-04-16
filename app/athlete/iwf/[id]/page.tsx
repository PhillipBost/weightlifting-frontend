"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const PerformanceChart = dynamic(() => import('../../../components/charts/PerformanceChart'), { ssr: false });
const QScoreChart = dynamic(() => import('../../../components/charts/QScoreChart'), { ssr: false });
const GamxChart = dynamic(() => import('../../../components/charts/GamxChart'), { ssr: false });
import Image from 'next/image';
import { supabaseIWF, type IWFLifter, type IWFMeetResult } from '../../../../lib/supabaseIWF';
import { createClient } from '../../../../lib/supabase/client';
import { adaptIWFAthlete, adaptIWFResult } from '../../../../lib/adapters/iwfAdapter';
import { Trophy, Calendar, Weight, TrendingUp, Medal, User, Building, MapPin, ExternalLink, ArrowLeft, BarChart3, Dumbbell, ChevronLeft, ChevronRight, Database, Activity } from 'lucide-react';
import Papa from 'papaparse';
import { ThemeSwitcher } from '../../../components/ThemeSwitcher';
import { AthleteCard } from '../../../components/AthleteCard';
import { AuthGuard } from '../../../components/AuthGuard';
import { ROLES } from '../../../../lib/roles';

const getBestQScore = (result: any) => {
  const qYouth = result.q_youth || 0;
  const qPoints = result.qpoints || 0;
  const qMasters = result.q_masters || 0;

  if (qPoints >= qYouth && qPoints >= qMasters && qPoints > 0) {
    return { value: qPoints.toFixed(2), type: 'qpoints', style: { color: 'var(--chart-qpoints)' } };
  }
  if (qYouth >= qMasters && qYouth > 0) {
    return { value: qYouth.toFixed(2), type: 'qyouth', style: { color: 'var(--chart-qyouth)' } };
  }
  if (qMasters > 0) {
    return { value: qMasters.toFixed(2), type: 'qmasters', style: { color: 'var(--chart-qmasters)' } };
  }

  return { value: null, type: 'none', style: { color: 'var(--chart-qpoints)' } };
};

const getBestGamx = (result: any) => {
  const scores = [
    { value: result.gamx_total, color: 'var(--chart-gamx-total)' },
    { value: result.gamx_u, color: 'var(--chart-gamx-u)' },
    { value: result.gamx_a, color: 'var(--chart-gamx-a)' },
    { value: result.gamx_masters, color: 'var(--chart-gamx-masters)' }
  ].filter(s => s.value !== null && s.value !== undefined && s.value > 0);

  if (scores.length === 0) return { value: '-', style: {} };

  const maxScore = scores.reduce((prev, current) => (prev.value > current.value) ? prev : current);
  return {
    value: maxScore.value.toFixed(0),
    style: { color: maxScore.color, fontWeight: 'bold' }
  };
};

const exportTableToCSV = (results: any[], athleteName: string, showAllColumns: boolean) => {
  try {
    const csvData = results.map(result => {
      if (showAllColumns) {
        return {
          'Date': new Date(result.date).toLocaleDateString('en-US'),
          'Meet': result.meet_name || '',
          'Level': result.meets?.Level || '',
          'WSO': result.wso || '',
          'Club': result.club_name || '',
          'Age Category': result.age_category || '',
          'Weight Class': result.weight_class || '',
          'Body Weight (kg)': result.body_weight_kg || '',
          'Competition Age': result.competition_age || '',
          'Snatch Lift 1': result.snatch_lift_1 || '',
          'Snatch Lift 2': result.snatch_lift_2 || '',
          'Snatch Lift 3': result.snatch_lift_3 || '',
          'Best Snatch (kg)': result.best_snatch || '',
          'C&J Lift 1': result.cj_lift_1 || '',
          'C&J Lift 2': result.cj_lift_2 || '',
          'C&J Lift 3': result.cj_lift_3 || '',
          'Best C&J (kg)': result.best_cj || '',
          'Total (kg)': result.total || '',
          'Q-Youth': result.q_youth || '',
          'Q-Points': result.qpoints || '',
          'Q-Masters': result.q_masters || ''
        };
      } else {
        const bestQScore = getBestQScore(result);
        return {
          'Date': new Date(result.date).toLocaleDateString('en-US'),
          'Meet': result.meet_name || '',
          'Weight Class': result.weight_class || '',
          'Best Snatch (kg)': result.best_snatch || '',
          'Best C&J (kg)': result.best_cj || '',
          'Total (kg)': result.total || '',
          'Best Q-Score': bestQScore.value || ''
        };
      }
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${athleteName.replace(/\s+/g, '_')}_competition_results.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Failed to export CSV. Please try again.');
  }
};

const LiftAttempts = ({ lift1, lift2, lift3, best, type }: {
  lift1: string | null;
  lift2: string | null;
  lift3: string | null;
  best: string | null;
  type: string;
}) => {
  const attempts = [lift1, lift2, lift3];

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-app-tertiary">{type}</div>
      <div className="flex space-x-2">
        {attempts.map((attempt, index) => {
          const value = parseInt(attempt || '0');
          const isGood = value > 0;
          const isBest = attempt === best;
          const attemptWeight = Math.abs(value);

          return (
            <span
              key={index}
              className={`px-2 py-1 rounded text-xs font-mono ${isBest
                ? 'bg-green-600 text-app-primary'
                : isGood
                  ? 'bg-app-surface text-app-primary'
                  : value < 0
                    ? 'bg-red-900 text-red-300'
                    : 'bg-app-tertiary text-app-muted'
                }`}
            >
              {value === 0
                ? '-'
                : isGood
                  ? `${value}kg`
                  : `${attemptWeight}kg X`
              }
            </span>
          );
        })}
      </div>
      <div className="text-lg font-bold text-app-primary">
        Best: {best && parseInt(best) > 0 ? `${best}kg` : '-'}
      </div>
    </div>
  );
};

// Custom Pagination Component
const Pagination = ({ currentPage, totalPages, totalResults, onPageChange }: {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  const resultsPerPage = 20;
  const startResult = (currentPage - 1) * resultsPerPage + 1;
  const endResult = Math.min(currentPage * resultsPerPage, totalResults);

  const getPageNumbers = () => {
    const delta = 2;
    const pages = [];
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-6">
      <div className="text-sm text-app-muted">
        Showing {startResult} to {endResult} of {totalResults} results
      </div>

      <div className="flex items-center space-x-2">
        {currentPage > 1 && (
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>
        )}

        <div className="flex space-x-1">
          {getPageNumbers().map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' && onPageChange(page)}
              disabled={page === '...'}
              className={`px-3 py-2 text-sm font-medium rounded-lg ${page === currentPage
                ? 'bg-accent-primary text-white border border-accent-primary'
                : page === '...'
                  ? 'text-app-muted cursor-default'
                  : 'text-app-secondary bg-app-tertiary border border-app-secondary hover:bg-app-surface'
                }`}
            >
              {page}
            </button>
          ))}
        </div>

        {currentPage < totalPages && (
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        )}
      </div>
    </div>
  );
};

// Sort Icon Component
const SortIcon = ({ column, sortConfig }: {
  column: string;
  sortConfig: { key: string | null; direction: 'asc' | 'desc' }
}) => {
  if (sortConfig.key !== column) {
    return <span className="text-app-disabled ml-1">↕</span>;
  }

  return (
    <span className="text-accent-primary ml-1">
      {sortConfig.direction === 'asc' ? '↑' : '↓'}
    </span>
  );
};

export default function AthletePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const supabase = createClient();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [athlete, setAthlete] = useState<any>(null);
  const [iwfResults, setIwfResults] = useState<any[]>([]);
  const [usawResults, setUsawResults] = useState<any[]>([]);
  const [siblingIwfResults, setSiblingIwfResults] = useState<any[]>([]);
  const [showUsawResults, setShowUsawResults] = useState(false);
  
  const results = useMemo(() => {
    if (!showUsawResults) return iwfResults;
    const combined = [...iwfResults, ...usawResults, ...siblingIwfResults];
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [iwfResults, usawResults, siblingIwfResults, showUsawResults]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duplicateAthletes, setDuplicateAthletes] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [autoScalePerformance, setAutoScalePerformance] = useState(true);
  const [showPerformanceBrush, setShowPerformanceBrush] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [autoScaleQScores, setAutoScaleQScores] = useState(true);
  const [showQScoresBrush, setShowQScoresBrush] = useState(false);
  const [showSnatch, setShowSnatch] = useState(true);
  const [showCleanJerk, setShowCleanJerk] = useState(true);
  const [showAttempts, setShowAttempts] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [showBodyweight, setShowBodyweight] = useState(true);
  const [showQPoints, setShowQPoints] = useState(true);
  const [showQYouth, setShowQYouth] = useState(false);
  const [showQMasters, setShowQMasters] = useState(false);
  const [performanceMouseX, setPerformanceMouseX] = useState<number | null>(null);
  const [qScoresMouseX, setQScoresMouseX] = useState<number | null>(null);
  const [usawProfile, setUsawProfile] = useState<{ id: string | number; internalId: number | null } | null>(null);
  const [siblingIwfProfiles, setSiblingIwfProfiles] = useState<{ id: string; url: string | null }[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);

  // GAMX State
  const [autoScaleGamx, setAutoScaleGamx] = useState(true);
  const [showGamxBrush, setShowGamxBrush] = useState(false);
  const [gamxMouseX, setGamxMouseX] = useState<number | null>(null);

  const [showGamxTotal, setShowGamxTotal] = useState(true);
  const [showGamxS, setShowGamxS] = useState(true);
  const [showGamxJ, setShowGamxJ] = useState(true);
  const [showGamxU, setShowGamxU] = useState(false);
  const [showGamxA, setShowGamxA] = useState(false);
  const [showGamxMasters, setShowGamxMasters] = useState(false);
  const hasInitializedGamx = useRef(false);

  // Add sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: 'date', direction: 'desc' });

  const resultsPerPage = 20;

  // Refs for export functionality
  const performanceChartRef = useRef<HTMLDivElement>(null);
  const qScoresChartRef = useRef<HTMLDivElement>(null);
  const resultsTableRef = useRef<HTMLDivElement>(null);

  // Sorting functions
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';

    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortableValue = (result: any, key: string): any => {
    switch (key) {
      case 'date':
        return new Date(result.date).getTime();
      case 'meet_name':
        return result.meet_name?.toLowerCase() || '';
      case 'level':
        return result.meets?.Level?.toLowerCase() || '';
      case 'wso':
        return result.wso?.toLowerCase() || '';
      case 'club_name':
        return result.club_name?.toLowerCase() || '';
      case 'age_category':
        return result.age_category?.toLowerCase() || '';
      case 'weight_class':
        // Handle weight classes like "81", "81+", "87+", etc.
        const weightMatch = result.weight_class?.match(/(\d+)/);
        return weightMatch ? parseInt(weightMatch[1]) : 0;
      case 'body_weight_kg':
        return parseFloat(result.body_weight_kg) || 0;
      case 'competition_age':
        return parseInt(result.competition_age) || 0;
      case 'best_snatch':
        return parseInt(result.best_snatch) || 0;
      case 'best_cj':
        return parseInt(result.best_cj) || 0;
      case 'total':
        return parseInt(result.total) || 0;
      case 'best_q_score':
        const bestQScore = getBestQScore(result);
        return bestQScore.value || 0;
      case 'q_youth':
        return parseFloat(result.q_youth) || 0;
      case 'qpoints':
        return parseFloat(result.qpoints) || 0;
      case 'q_masters':
        return parseFloat(result.q_masters) || 0;
      default:
        return '';
    }
  };

  const { displayResults, totalPages } = useMemo(() => {
    let sortedResults = [...results];

    // Apply sorting if a sort config exists
    if (sortConfig.key) {
      sortedResults.sort((a, b) => {
        const aValue = getSortableValue(a, sortConfig.key!);
        const bValue = getSortableValue(b, sortConfig.key!);

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    const startIndex = (currentPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;

    return {
      displayResults: sortedResults.slice(startIndex, endIndex),
      totalPages: Math.ceil(sortedResults.length / resultsPerPage)
    };
  }, [currentPage, results, resultsPerPage, sortConfig]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    document.querySelector('.results-table')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Unwrap the params Promise
  const resolvedParams = React.use(params);

  useEffect(() => {
    async function fetchAthleteData() {
      try {
        setLoading(true);
        setError(null);

        let athleteData = null;
        let athleteError = null;

        const decodedId = decodeURIComponent(resolvedParams.id);
        let matchingAthletes: IWFLifter[] = [];
        const isNumericId = !isNaN(Number(decodedId));

        // First, try numeric ID lookup (IWF iwf_lifter_id)
        if (isNumericId) {
          console.log('IWF numeric ID lookup:', { decodedId, parsedId: parseInt(decodedId) });
          try {
            console.log('About to query Supabase IWF...');
            const numericResult = await supabaseIWF
              .from('iwf_lifters')
              .select('*')
              .eq('iwf_lifter_id', parseInt(decodedId))
              .single();
            console.log('Supabase query completed');

            console.log('IWF numeric ID result:', {
              hasError: !!numericResult.error,
              hasData: !!numericResult.data,
              error: numericResult.error,
              dataKeys: numericResult.data ? Object.keys(numericResult.data) : null
            });

            if (numericResult.error) {
              console.error('IWF numeric ID lookup failed:', numericResult.error);
              athleteError = { message: 'Athlete not found' };
            } else if (numericResult.data) {
              console.log('Adapting IWF athlete data...');
              athleteData = adaptIWFAthlete(numericResult.data);
              console.log('IWF athlete adapted successfully:', athleteData?.athlete_name);
              athleteError = null;
            }
          } catch (queryError) {
            console.error('IWF numeric ID query exception:', queryError);
            athleteError = { message: 'Query error: ' + String(queryError) };
          }
        }

        // If not found by ID and input was NOT numeric, try name search
        if (!athleteData && !isNumericId) {
          // First, try searching with the decoded name as-is (preserves legitimate hyphens)
          const formattedName1 = decodedId
            .split(/\s+/) // Split on spaces only
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

          let result = await supabaseIWF
            .from('iwf_lifters')
            .select('*')
            .ilike('athlete_name', formattedName1);

          matchingAthletes = result.data || [];

          // If not found and no spaces in original, try converting hyphens to spaces
          if (matchingAthletes.length === 0 && !decodedId.includes(' ')) {
            const formattedName2 = decodedId
              .replace(/-/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');

            result = await supabaseIWF
              .from('iwf_lifters')
              .select('*')
              .ilike('athlete_name', formattedName2);

            matchingAthletes = result.data || [];
          }
        }

        // Handle results: single match, multiple matches, or no matches
        // Skip this section if we already found the athlete via numeric lookup
        if (!athleteData && matchingAthletes.length === 1) {
          athleteData = adaptIWFAthlete(matchingAthletes[0]);
          athleteError = null;
        } else if (!athleteData && matchingAthletes.length > 1) {
          // For multiple matches, get recent country info for each athlete
          const athletesWithRecentInfo = await Promise.all(
            matchingAthletes.map(async (athlete: IWFLifter) => {
              const { data: recentResults } = await supabaseIWF
                .from('iwf_meet_results')
                .select('country_code, country_name, date')
                .eq('db_lifter_id', athlete.db_lifter_id)
                .order('date', { ascending: false })
                .limit(10);

              const recentCountryCode = recentResults?.find((r: any) => r.country_code && r.country_code.trim() !== '')?.country_code;
              const recentCountryName = recentResults?.find((r: any) => r.country_name && r.country_name.trim() !== '')?.country_name;

              const adapted = adaptIWFAthlete(athlete);
              return {
                ...adapted,
                recent_wso: recentCountryCode,
                recent_club_name: recentCountryName
              };
            })
          );

          setDuplicateAthletes(athletesWithRecentInfo);
          return; // Exit early to show disambiguation
        } else if (!athleteData) {
          athleteError = { message: 'Athlete not found' };
        }

        console.log('Before error check:', { hasError: !!athleteError, hasData: !!athleteData });
        if (athleteError || !athleteData) {
          console.error('About to throw athlete not found error');
          throw new Error('Athlete not found');
        }
        console.log('Athlete data validated, continuing...');

        // Fetch aliases: find this IWF athlete's USAW counterpart and sibling IWF profiles
        // Step 1: find alias row matching current IWF athlete's db_lifter_id (USAW-linked rows)
        const { data: myAliasRow } = await supabase
          .from('athlete_aliases')
          .select('usaw_lifter_id, usaw_lifters(membership_number, internal_id, lifter_id)')
          .eq('iwf_db_lifter_id', athleteData.lifter_id)
          .not('usaw_lifter_id', 'is', null)
          .limit(1)
          .maybeSingle() as any;

        let fetchedUsawProfile: { id: string | number; internalId: number | null } | null = null;
        const fetchedSiblings: { id: string; url: string | null; dbId: number }[] = [];

        if (myAliasRow?.usaw_lifters) {
          const usaw = Array.isArray(myAliasRow.usaw_lifters) ? myAliasRow.usaw_lifters[0] : myAliasRow.usaw_lifters;
          if (usaw) {
            fetchedUsawProfile = {
              id: usaw.membership_number ?? `u-${usaw.lifter_id}`,
              internalId: usaw.internal_id ?? null,
            };

            // Step 2: find all IWF aliases for the same USAW athlete (USAW-bridged siblings)
            const { data: allAliasRows } = await supabase
              .from('athlete_aliases')
              .select('iwf_db_lifter_id')
              .eq('usaw_lifter_id', myAliasRow.usaw_lifter_id);

            if (allAliasRows && allAliasRows.length > 0) {
              await Promise.all(allAliasRows.map(async (row: { iwf_db_lifter_id: number }) => {
                // Skip the current athlete's own db_lifter_id
                if (row.iwf_db_lifter_id === athleteData.lifter_id) return;
                const { data: sibData } = await supabaseIWF
                  .from('iwf_lifters')
                  .select('iwf_lifter_id, iwf_athlete_url')
                  .eq('db_lifter_id', row.iwf_db_lifter_id)
                  .maybeSingle();
                if (sibData?.iwf_lifter_id != null) {
                  fetchedSiblings.push({
                    id: String(sibData.iwf_lifter_id),
                    url: sibData.iwf_athlete_url ?? null,
                    dbId: row.iwf_db_lifter_id,
                  });
                }
              }));
            }
          }
        }

        // Step 3: find direct IWF-to-IWF alias links (iwf_db_lifter_id_2 rows).
        // These are rows where usaw_lifter_id IS NULL and the pairing is purely IWF↔IWF.
        // Query both columns since the current athlete could appear in either position.
        const seenSiblingIds = new Set(fetchedSiblings.map(s => s.id));

        const [{ data: iwfAliasAsMain }, { data: iwfAliasAsSecond }] = await Promise.all([
          // Current athlete is in iwf_db_lifter_id (primary slot), partner is in iwf_db_lifter_id_2
          supabase
            .from('athlete_aliases')
            .select('iwf_db_lifter_id_2')
            .eq('iwf_db_lifter_id', athleteData.lifter_id)
            .is('usaw_lifter_id', null)
            .not('iwf_db_lifter_id_2', 'is', null) as any,
          // Current athlete is in iwf_db_lifter_id_2 (secondary slot), partner is in iwf_db_lifter_id
          supabase
            .from('athlete_aliases')
            .select('iwf_db_lifter_id')
            .eq('iwf_db_lifter_id_2', athleteData.lifter_id)
            .is('usaw_lifter_id', null) as any,
        ]);

        // Collect all partner db_lifter_ids from IWF-to-IWF rows
        const iwfPartnerDbIds: number[] = [
          ...((iwfAliasAsMain || []).map((r: any) => r.iwf_db_lifter_id_2).filter(Boolean)),
          ...((iwfAliasAsSecond || []).map((r: any) => r.iwf_db_lifter_id).filter(Boolean)),
        ];

        if (iwfPartnerDbIds.length > 0) {
          await Promise.all(iwfPartnerDbIds.map(async (partnerDbId: number) => {
            const { data: partnerData } = await supabaseIWF
              .from('iwf_lifters')
              .select('iwf_lifter_id, iwf_athlete_url')
              .eq('db_lifter_id', partnerDbId)
              .maybeSingle();
            if (partnerData?.iwf_lifter_id != null) {
              const partnerId = String(partnerData.iwf_lifter_id);
              // Deduplicate against USAW-bridged siblings already found
              if (!seenSiblingIds.has(partnerId)) {
                fetchedSiblings.push({
                  id: partnerId,
                  url: partnerData.iwf_athlete_url ?? null,
                  dbId: partnerDbId,
                });
                seenSiblingIds.add(partnerId);
              }
            }
          }));
        }
        const { data: resultsData, error: resultsError } = await supabaseIWF
          .from('iwf_meet_results')
          .select('*, iwf_meets(iwf_meet_id)')
          .eq('db_lifter_id', athleteData.lifter_id)
          .order('date', { ascending: false });

        if (resultsError) throw resultsError;

        const adaptedResults = (resultsData || []).map((result: IWFMeetResult) => ({
          ...adaptIWFResult(result),
          _source: 'IWF'
        }));
        
        let fetchedUsawResults: any[] = [];
        if (myAliasRow?.usaw_lifter_id) {
          const { data: usawData, error: usawError } = await supabase
            .from('usaw_meet_results')
            .select(`
              *,
              meets:usaw_meets!inner("Level")
            `)
            .eq('lifter_id', myAliasRow.usaw_lifter_id);
            
          if (!usawError && usawData) {
            fetchedUsawResults = usawData.map((r: any) => ({ ...r, _source: 'USAW' }));
          }
        }

        // Fetch results for sibling IWF profiles (same person, different IWF profile)
        let fetchedSiblingIwfResults: any[] = [];
        if (fetchedSiblings.length > 0) {
          const siblingResults = await Promise.all(
            fetchedSiblings.map(async (sib) => {
              const { data: sibResultsData } = await supabaseIWF
                .from('iwf_meet_results')
                .select('*, iwf_meets(iwf_meet_id)')
                .eq('db_lifter_id', sib.dbId)
                .order('date', { ascending: false });
              return (sibResultsData || []).map((result: IWFMeetResult) => ({
                ...adaptIWFResult(result),
                _source: 'IWF',
                _siblingId: sib.id,
              }));
            })
          );
          fetchedSiblingIwfResults = siblingResults.flat();
        }

        setAthlete(athleteData);
        setIwfResults(adaptedResults);
        setUsawResults(fetchedUsawResults);
        setSiblingIwfResults(fetchedSiblingIwfResults);
        setUsawProfile(fetchedUsawProfile);
        setSiblingIwfProfiles(fetchedSiblings);
        setLinksLoading(false);
      } catch (err: any) {
        setError(err.message);
        console.error('Error fetching athlete data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAthleteData();
  }, [resolvedParams.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [results]);

  // Calculate personal bests from results
  const personalBests = results.length > 0 ? {
    best_snatch: Math.max(...results.map(r => parseInt(r.best_snatch || '0')).filter(v => v > 0)),
    best_cj: Math.max(...results.map(r => parseInt(r.best_cj || '0')).filter(v => v > 0)),
    best_total: Math.max(...results.map(r => parseInt(r.total || '0')).filter(v => v > 0)),
    best_qpoints: Math.max(...results.map(r => r.qpoints || 0).filter(v => v > 0))
  } : { best_snatch: 0, best_cj: 0, best_total: 0, best_qpoints: 0 };

  const getRecentInfo = () => {
    const sortedResults = [...results].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentWso = sortedResults.find(r => r.wso && typeof r.wso === 'string' && r.wso.trim() !== '')?.wso;
    const recentClub = sortedResults.find(r => r.club_name && typeof r.club_name === 'string' && r.club_name.trim() !== '')?.club_name;
    return { wso: recentWso, club: recentClub };
  };

  const recentInfo = athlete && results.length > 0 ? getRecentInfo() : { wso: null, club: null };

  // Prepare chart data
  const chartData = useMemo(() => results
    .filter(r => r.date && (r.best_snatch || r.best_cj || r.total || r.qpoints || r.q_youth || r.q_masters))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(r => {
      const baseData: any = {
        date: r.date,
        meet: r._source === 'USAW' ? `[USAW] ${r.meet_name || 'Unknown'}` : (r.meet_name || 'Unknown'),
        snatch: parseInt(r.best_snatch || '0') || null,
        cleanJerk: parseInt(r.best_cj || '0') || null,
        total: parseInt(r.total || '0') || null,
        bodyweight: parseFloat(r.body_weight_kg || '0') || null,
        qpoints: r.qpoints || null,
        qYouth: r.q_youth || null,
        qMasters: r.q_masters || null,
        qpointsBackground: r.qpoints || null,
        qYouthBackground: r.q_youth || null,
        qMastersBackground: r.q_masters || null,

        // GAMX Data
        gamxTotal: r.gamx_total || null,
        gamxS: r.gamx_s || null,
        gamxJ: r.gamx_j || null,
        gamxU: r.gamx_u || null,
        gamxA: r.gamx_a || null,
        gamxMasters: r.gamx_masters || null,

        // GAMX Backgrounds
        gamxTotalBackground: r.gamx_total || null,
        gamxSBackground: r.gamx_s || null,
        gamxJBackground: r.gamx_j || null,
        gamxUBackground: r.gamx_u || null,
        gamxABackground: r.gamx_a || null,
        gamxMastersBackground: r.gamx_masters || null,
        shortDate: new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        competitionAge: r.competition_age || null,
        dateWithAge: r.competition_age
          ? `${new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${r.competition_age})`
          : new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        timestamp: new Date(r.date).getTime()
      };

      // Add attempts data for tooltip
      const snatchAttempts = [r.snatch_lift_1, r.snatch_lift_2, r.snatch_lift_3];
      snatchAttempts.forEach((attempt, index) => {
        if (attempt && attempt !== '0') {
          const weight = parseInt(attempt);
          const isGood = weight > 0;
          if (isGood) {
            baseData[`snatchGood${index + 1}`] = Math.abs(weight);
          } else {
            baseData[`snatchMiss${index + 1}`] = Math.abs(weight);
          }
        }
      });

      const cjAttempts = [r.cj_lift_1, r.cj_lift_2, r.cj_lift_3];
      cjAttempts.forEach((attempt, index) => {
        if (attempt && attempt !== '0') {
          const weight = parseInt(attempt);
          const isGood = weight > 0;
          if (isGood) {
            baseData[`cjGood${index + 1}`] = Math.abs(weight);
          } else {
            baseData[`cjMiss${index + 1}`] = Math.abs(weight);
          }
        }
      });

      return baseData;
    }), [results]);

  const legendFlags = useMemo(() => ({
    hasQYouth: chartData?.some(d => d.qYouth && d.qYouth > 0) || false,
    hasQMasters: chartData?.some(d => d.qMasters && d.qMasters > 0) || false,
    hasGamxTotal: chartData?.some(d => d.gamxTotal !== null) || false,
    hasGamxS: chartData?.some(d => d.gamxS !== null) || false,
    hasGamxJ: chartData?.some(d => d.gamxJ !== null) || false,
    hasGamxU: chartData?.some(d => d.gamxU !== null) || false,
    hasGamxA: chartData?.some(d => d.gamxA !== null) || false,
    hasGamxMasters: chartData?.some(d => d.gamxMasters !== null) || false,
  }), [chartData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-lg text-app-secondary">Loading athlete data...</p>
        </div>
      </div>
    );
  }

  // Show disambiguation page if multiple athletes found
  if (duplicateAthletes.length > 1) {
    const searchName = decodeURIComponent(resolvedParams.id).replace(/-/g, ' ');

    return (
      <div className="min-h-screen bg-app-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card-primary mb-8">
            <h1 className="text-2xl font-bold text-app-primary mb-4">
              Multiple athletes found for "{searchName}"
            </h1>
            <p className="text-app-secondary mb-6">
              Please select the athlete you're looking for:
            </p>

            <div className="space-y-4">
              {duplicateAthletes.map((athlete, index) => (
                <Link
                  key={index}
                  href={`/athlete/iwf/${athlete.athlete_name.replace(/\s+/g, '-')}`}
                  className="w-full text-left p-4 bg-app-tertiary hover:bg-app-surface border border-app-secondary rounded-lg transition-colors hover:shadow-md block"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-app-primary">{athlete.athlete_name}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-app-secondary mt-1">
                        <span>IWF ID: {athlete.lifter_id}</span>
                        {athlete.gender && (
                          <span>{athlete.gender === 'M' ? 'Male' : 'Female'}</span>
                        )}
                        {athlete.recent_wso && (
                          <span>Country: {athlete.recent_wso}</span>
                        )}
                        {athlete.recent_club_name && (
                          <span>{athlete.recent_club_name}</span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-app-muted" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-app-primary mb-4">Error Loading Athlete</h1>
          <p className="text-app-secondary mb-4">{error || 'Athlete not found'}</p>
          <button
            onClick={() => window.history.back()}
            className="bg-accent-primary hover:bg-accent-primary-hover text-app-primary px-6 py-2 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Athlete Header */}
        <div className="card-primary mb-8">
          <div className="flex flex-col md:flex-row md:items-start w-full">
            {/* Athlete Info */}
            <div className="flex items-start space-x-6 flex-1">
              <div className="bg-app-tertiary rounded-full p-4 flex-shrink-0">
                <User className="h-12 w-12 text-app-secondary" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-app-primary mb-2">{athlete.athlete_name}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-app-secondary">
                  <div className="flex items-center space-x-1">
                    <span>IWF Athlete ID: {athlete.iwf_lifter_id || athlete.lifter_id}</span>
                  </div>
                  {athlete.gender && (
                    <div className="flex items-center space-x-1">
                      <span>{athlete.gender === 'M' ? 'Male' : 'Female'}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-app-secondary mt-2">
                  {recentInfo.wso && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>Country Code: {recentInfo.wso}</span>
                    </div>
                  )}
                  {recentInfo.club && (
                    <div className="flex items-center space-x-1">
                      <Dumbbell className="h-4 w-4" />
                      <span>Country: {recentInfo.club}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Internal Navigation Links & Toggle — always rendered to prevent layout shift */}
            <div className="flex flex-col gap-3 my-4 md:my-0 md:pt-2 items-start justify-center px-4 min-w-[180px]">
              {linksLoading ? (
                // Skeleton placeholder — same height as typical link block
                <div className="flex flex-col gap-1 animate-pulse">
                  <div className="h-8 w-48 bg-app-tertiary rounded-md"></div>
                </div>
              ) : (usawProfile || siblingIwfProfiles.length > 0) ? (
                <>
                  <div className="flex flex-col gap-1">
                    {usawProfile && (
                      <Link
                        href={`/athlete/${usawProfile.id}`}
                        className="inline-flex items-center space-x-2 px-3 py-1.5 bg-transparent hover:bg-app-tertiary border border-app-secondary rounded-md text-app-secondary hover:text-white transition-colors text-sm mb-1"
                      >
                        <User className="h-3.5 w-3.5" />
                        <span>View Linked USAW Results</span>
                      </Link>
                    )}
                    {siblingIwfProfiles.map((p) => (
                      <Link
                        key={p.id}
                        href={`/athlete/iwf/${p.id}`}
                        className="inline-flex items-center space-x-2 px-3 py-1.5 bg-transparent hover:bg-app-tertiary border border-app-secondary rounded-md text-app-secondary hover:text-white transition-colors text-sm"
                      >
                        <User className="h-3.5 w-3.5" />
                        <span>View Linked IWF Results ({p.id})</span>
                      </Link>
                    ))}
                  </div>

                  {/* Linked Results Toggle */}
                  {(usawResults.length > 0 || siblingIwfResults.length > 0) && (
                    <label className="flex items-center space-x-3 cursor-pointer mt-1">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={showUsawResults}
                          onChange={(e) => setShowUsawResults(e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${showUsawResults ? 'bg-accent-primary' : 'bg-app-surface border border-app-secondary'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showUsawResults ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-sm font-medium text-app-secondary select-none text-nowrap">
                        {usawResults.length > 0 && siblingIwfResults.length > 0
                          ? 'Include USAW and Linked IWF Results'
                          : usawResults.length > 0
                          ? 'Include USAW Results'
                          : 'Include Linked IWF Results'}
                      </span>
                    </label>
                  )}
                </>
              ) : (
                // No linked profiles — empty but space still reserved
                <div className="h-8"></div>
              )}
            </div>

            {/* External Profile Links */}
            <div className="flex flex-col mt-4 md:mt-0 md:items-end flex-1">
              <div className="flex flex-col gap-2 items-end">
                <p className="text-xs font-semibold text-app-secondary border-b border-app-secondary pb-0.5 mb-1 self-stretch text-right">External Links</p>
                {usawProfile?.internalId && (
                  <a
                    href={`https://usaweightlifting.sport80.com/public/rankings/member/${usawProfile.internalId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>USAW Official Profile</span>
                  </a>
                )}
                {athlete.iwf_athlete_url && (
                  <a
                    href={athlete.iwf_athlete_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>IWF Official Profile{siblingIwfProfiles.length > 0 ? ` (${athlete.iwf_lifter_id || athlete.lifter_id})` : ''}</span>
                  </a>
                )}
                {siblingIwfProfiles.map((p) => p.url && (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>IWF Official Profile ({p.id})</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Charts */}
        {chartData.length > 1 && (
          <div className="max-w-[1200px]">
            <div className="space-y-8 mb-8">
              <PerformanceChart chartData={chartData} athlete={athlete} />
              <QScoreChart chartData={chartData} athlete={athlete} legendFlags={legendFlags} />
              <GamxChart chartData={chartData} athlete={athlete} legendFlags={legendFlags} />
            </div>
          </div>
        )}

        {/* Athlete Performance Profile Card */}
        {results.length > 0 && (
          <AuthGuard
            requireAnyRole={[ROLES.ADMIN, ROLES.COACH, ROLES.USAW_NATIONAL_TEAM_COACH]}
            fallback={<></>}
          >
            <AthleteCard athleteName={athlete.athlete_name} results={results} dataSource="iwf" />
          </AuthGuard>
        )}

        {/* Personal Bests Cards */}
        <div className="max-w-[1200px]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card-secondary">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-label">Best Snatch</h3>
                <Weight className="h-5 w-5" style={{ color: 'var(--chart-snatch)' }} />
              </div>
              <div className="text-2xl text-heading">
                {personalBests.best_snatch > 0 ? `${personalBests.best_snatch}kg` : 'N/A'}
              </div>
            </div>

            <div className="card-secondary">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-label">Best C&J</h3>
                <Weight className="h-5 w-5" style={{ color: 'var(--chart-cleanjerk)' }} />
              </div>
              <div className="text-2xl text-heading">
                {personalBests.best_cj > 0 ? `${personalBests.best_cj}kg` : 'N/A'}
              </div>
            </div>

            <div className="card-secondary">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-label">Best Total</h3>
                <Trophy className="h-5 w-5" style={{ color: 'var(--chart-total)' }} />
              </div>
              <div className="text-2xl text-heading">
                {personalBests.best_total > 0 ? `${personalBests.best_total}kg` : 'N/A'}
              </div>
            </div>

            <div className="card-secondary">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-label">Best Q-Points</h3>
                <TrendingUp className="h-5 w-5" style={{ color: 'var(--chart-qpoints)' }} />
              </div>
              <div className="text-2xl text-heading">
                {personalBests.best_qpoints > 0 ? personalBests.best_qpoints.toFixed(1) : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Competition Results */}
        <div className="card-results results-table">
          <div className="p-6 border-b border-app-secondary">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-app-primary flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                {athlete.athlete_name} Competition Results ({results.length} total)
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAllColumns(!showAllColumns)}
                  className="btn-tertiary"
                >
                  {showAllColumns ? 'Compact View' : 'Show All Details'}
                </button>
                <button
                  onClick={() => exportTableToCSV(results, athlete.athlete_name, showAllColumns)}
                  className="btn-tertiary"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="p-6" ref={resultsTableRef}>
            {results.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-app-muted">No competition results found for this athlete.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                      <tr>
                        {showAllColumns ? (
                          <>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('date')}
                            >
                              Date
                              <SortIcon column="date" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('meet_name')}
                            >
                              Meet
                              <SortIcon column="meet_name" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('level')}
                            >
                              Level
                              <SortIcon column="level" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('wso')}
                            >
                              WSO
                              <SortIcon column="wso" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('club_name')}
                            >
                              Club
                              <SortIcon column="club_name" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('age_category')}
                            >
                              Age Category
                              <SortIcon column="age_category" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('weight_class')}
                            >
                              Weight Class
                              <SortIcon column="weight_class" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('body_weight_kg')}
                            >
                              Body Weight
                              <SortIcon column="body_weight_kg" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('competition_age')}
                            >
                              Comp Age
                              <SortIcon column="competition_age" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Sn 1</th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Sn 2</th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Sn 3</th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_snatch')}
                            >
                              Best Sn
                              <SortIcon column="best_snatch" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">CJ 1</th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">CJ 2</th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">CJ 3</th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_cj')}
                            >
                              Best CJ
                              <SortIcon column="best_cj" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('total')}
                            >
                              Total
                              <SortIcon column="total" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('q_youth')}
                            >
                              Q-Youth
                              <SortIcon column="q_youth" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('qpoints')}
                            >
                              Q-Points
                              <SortIcon column="qpoints" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('q_masters')}
                            >
                              Q-Masters
                              <SortIcon column="q_masters" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort('gamx_total')}>
                              GAMX-T
                              <SortIcon column="gamx_total" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort('gamx_s')}>
                              GAMX-S
                              <SortIcon column="gamx_s" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort('gamx_j')}>
                              GAMX-J
                              <SortIcon column="gamx_j" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort('gamx_u')}>
                              GAMX-U
                              <SortIcon column="gamx_u" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort('gamx_a')}>
                              GAMX-A
                              <SortIcon column="gamx_a" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort('gamx_masters')}>
                              GAMX-M
                              <SortIcon column="gamx_masters" sortConfig={sortConfig} />
                            </th>
                          </>
                        ) : (
                          <>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('date')}
                            >
                              Date
                              <SortIcon column="date" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('meet_name')}
                            >
                              Meet
                              <SortIcon column="meet_name" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('weight_class')}
                            >
                              Weight Class
                              <SortIcon column="weight_class" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_snatch')}
                            >
                              Best Sn
                              <SortIcon column="best_snatch" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_cj')}
                            >
                              Best CJ
                              <SortIcon column="best_cj" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('total')}
                            >
                              Total
                              <SortIcon column="total" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_q_score')}
                            >
                              Best Q-Score
                              <SortIcon column="best_q_score" sortConfig={sortConfig} />
                            </th>
                            <th
                              scope="col"
                              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_gamx_score')}
                            >
                              Best GAMX Score
                              <SortIcon column="best_gamx_score" sortConfig={sortConfig} />
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {displayResults.map((result, index) => {
                        const bestQScore = getBestQScore(result);
                        const bestGamx = getBestGamx(result);

                        return (
                          <tr key={index} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                            {showAllColumns ? (
                              <>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                <td className="px-2 py-1 max-w-20 text-xs">
                                  <Link
                                    href={result._source === 'USAW' ? `/meet/${result.meet_id}` : `/meet/iwf/${result.meet_id}`}
                                    className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left hover:underline"
                                    title={result.meet_name}
                                  >
                                    {result.meet_name}
                                    {result._source === 'USAW' && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-300 border border-blue-800/50">
                                        USAW
                                      </span>
                                    )}
                                  </Link>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.meets?.Level || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.wso || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.club_name || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.age_category || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.weight_class || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-bodyweight)' }}>{result.body_weight_kg ? `${result.body_weight_kg}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.competition_age || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.snatch_lift_1 || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.snatch_lift_2 || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.snatch_lift_3 || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-snatch)' }}>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.cj_lift_1 || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.cj_lift_2 || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.cj_lift_3 || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-cleanjerk)' }}>{result.best_cj ? `${result.best_cj}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-bold" style={{ color: 'var(--chart-total)' }}>{result.total ? `${result.total}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-qyouth)' }}>{result.q_youth ? Number(result.q_youth).toFixed(2) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-qpoints)' }}>{result.qpoints ? Number(result.qpoints).toFixed(2) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-qmasters)' }}>{result.q_masters ? Number(result.q_masters).toFixed(2) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-gamx-total)' }}>{result.gamx_total ? result.gamx_total.toFixed(0) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-gamx-s)' }}>{result.gamx_s ? result.gamx_s.toFixed(0) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-gamx-j)' }}>{result.gamx_j ? result.gamx_j.toFixed(0) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-gamx-u)' }}>{result.gamx_u ? result.gamx_u.toFixed(0) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-gamx-a)' }}>{result.gamx_a ? result.gamx_a.toFixed(0) : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-gamx-masters)' }}>{result.gamx_masters ? result.gamx_masters.toFixed(0) : '-'}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                <td className="px-2 py-1 max-w-xs text-xs">
                                  <Link
                                    href={result._source === 'USAW' ? `/meet/${result.meet_id}` : `/meet/iwf/${result.meet_id}`}
                                    className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left hover:underline"
                                    title={result.meet_name}
                                  >
                                    {result.meet_name}
                                    {result._source === 'USAW' && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/40 text-blue-300 border border-blue-800/50">
                                        USAW
                                      </span>
                                    )}
                                  </Link>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.weight_class || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-snatch)' }}>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-cleanjerk)' }}>{result.best_cj ? `${result.best_cj}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-bold" style={{ color: 'var(--chart-total)' }}>{result.total ? `${result.total}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={bestQScore.style}>{bestQScore.value || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={bestGamx.style}>{bestGamx.value || '-'}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalResults={results.length}
                  onPageChange={handlePageChange}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
