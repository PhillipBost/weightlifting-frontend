"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const PerformanceChart = dynamic(() => import('../../components/charts/PerformanceChart'), { ssr: false });
const QScoreChart = dynamic(() => import('../../components/charts/QScoreChart'), { ssr: false });
const GamxChart = dynamic(() => import('../../components/charts/GamxChart'), { ssr: false });

import Image from 'next/image';
import { createClient } from '../../../lib/supabase/client';
import { supabaseIWF, type IWFMeetResult } from '../../../lib/supabaseIWF';
import { adaptIWFResult } from '../../../lib/adapters/iwfAdapter';

import Trophy from 'lucide-react/dist/esm/icons/trophy';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Weight from 'lucide-react/dist/esm/icons/weight';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Medal from 'lucide-react/dist/esm/icons/medal';
import User from 'lucide-react/dist/esm/icons/user';
import Building from 'lucide-react/dist/esm/icons/building';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Dumbbell from 'lucide-react/dist/esm/icons/dumbbell';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import Database from 'lucide-react/dist/esm/icons/database';
import Activity from 'lucide-react/dist/esm/icons/activity';

import Papa from 'papaparse';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { AthleteCard } from '../../components/AthleteCard';
import { AuthGuard } from '../../components/AuthGuard';
import { ROLES } from '../../../lib/roles';

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

export function AthletePageUI({ params, initialData = null }: { params: { id: string }, initialData?: any }) {
  const router = useRouter();
  const supabase = createClient();
  const [selectedTab, setSelectedTab] = useState('overview');
  const [athlete, setAthlete] = useState<any>(initialData || null);
  const [usawResults, setUsawResults] = useState<any[]>(initialData?.usaw_results || []);
  const [iwfResults, setIwfResults] = useState<any[]>(initialData?.iwf_results || []);
  const [showIwfResults, setShowIwfResults] = useState(false);
  
  const results = useMemo(() => {
    if (!showIwfResults) return usawResults;
    const combined = [...usawResults, ...iwfResults];
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [usawResults, iwfResults, showIwfResults]);

  const [loading, setLoading] = useState(initialData ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [duplicateAthletes, setDuplicateAthletes] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  
  const [showAllColumns, setShowAllColumns] = useState(false);
  
  
  
  
  
  
  
  
  
  
  
  
  
  const [iwfProfiles, setIwfProfiles] = useState<{ id: string; url: string | null }[]>(initialData?.iwf_profiles || []);

  // GAMX State
  
  
  
  

  
  
  
  
  
  
  
  

  // Add sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const resultsPerPage = 20;

  // Refs for export functionality
  
  
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
  const resolvedParams = params;

  useEffect(() => {
    // Log hydration result for diagnostics
    if (initialData) {
      console.log(`[DATA FACTORY] Hydrated with pre-calculated data for: ${athlete?.athlete_name}`);
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    async function fetchAthleteData(attempt = 0) {
      // Increased timeout from 15s to 30s to accommodate database cold starts
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Data fetch timed out')), 30000)
      );

      try {
        setLoading(true);
        setError(null);

        const fetchData = async () => {
          let athleteData = null;
          let athleteError = null;

          if (!isNaN(Number(resolvedParams.id))) {
            const result = await supabase
              .from('usaw_lifters')
              .select('lifter_id, athlete_name, membership_number, created_at, updated_at, internal_id, internal_id_2, internal_id_3, internal_id_4, internal_id_5, internal_id_6, internal_id_7, internal_id_8')
              .eq('membership_number', parseInt(resolvedParams.id));

            if (result.data && result.data.length > 0) {
              // Check for unique internal IDs to detect if this is actually different people
              // or just multiple rows for the same person.
              // We filter out nulls just in case, though internal_id is usually the PK equivalent in logic.
              const uniqueInternalIds = new Set(
                result.data.map(a => a.internal_id).filter(id => id !== null && id !== undefined)
              );

              if (uniqueInternalIds.size > 1) {
                // Determine if we have a collision of identities
                // Fetch recent info for disambiguation
                const athletesWithRecentInfo = await Promise.all(
                  result.data.map(async (athlete) => {
                    const { data: recentResults } = await supabase
                      .from('usaw_meet_results')
                      .select('wso, club_name, date')
                      .eq('lifter_id', athlete.lifter_id)
                      .order('date', { ascending: false })
                      .limit(10);

                    const recentWso = recentResults?.find(r => r.wso && r.wso.trim() !== '')?.wso;
                    const recentClub = recentResults?.find(r => r.club_name && r.club_name.trim() !== '')?.club_name;

                    return {
                      ...athlete,
                      recent_wso: recentWso,
                      recent_club_name: recentClub
                    };
                  })
                );

                if (isMounted) {
                  setDuplicateAthletes(athletesWithRecentInfo);
                }
                setLoading(false);
                return;
              }

              // Single identity case: Use the first record (or most relevant)
              // If multiple rows exist but share internal_id, they are the same person.
              // Just pick one for metadata.
              athleteData = result.data[0];
              athleteError = null;
            } else {
              athleteError = result.error || { message: 'Athlete not found' };
            }
          } else if (resolvedParams.id.startsWith('u-')) {
            // Handle internal ID fallback
            const internalId = parseInt(resolvedParams.id.substring(2));
            if (!isNaN(internalId)) {
              const result = await supabase
                .from('usaw_lifters')
                .select('lifter_id, athlete_name, membership_number, created_at, updated_at, internal_id, internal_id_2, internal_id_3, internal_id_4, internal_id_5, internal_id_6, internal_id_7, internal_id_8')
                .eq('lifter_id', internalId)
                .single();

              athleteData = result.data;
              athleteError = result.error;
            }
          }

          if (!athleteData) {
            // Handle both hyphenated and space-separated names in URLs
            let decodedName = decodeURIComponent(resolvedParams.id);

            // First, try searching with the decoded name as-is (preserves legitimate hyphens)
            const formattedName1 = decodedName
              .split(/\s+/) // Split on spaces only
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(' ');

            let result = await supabase
              .from('usaw_lifters')
              .select('lifter_id, athlete_name, membership_number, created_at, updated_at, internal_id, internal_id_2, internal_id_3, internal_id_4, internal_id_5, internal_id_6, internal_id_7, internal_id_8')
              .ilike('athlete_name', formattedName1);

            let matchingAthletes = result.data || [];

            // If not found and no spaces in original, try converting hyphens to spaces
            if (matchingAthletes.length === 0 && !decodedName.includes(' ')) {
              const formattedName2 = decodedName
                .replace(/-/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

              result = await supabase
                .from('usaw_lifters')
                .select('lifter_id, athlete_name, membership_number, created_at, updated_at, internal_id, internal_id_2, internal_id_3, internal_id_4, internal_id_5, internal_id_6, internal_id_7, internal_id_8')
                .ilike('athlete_name', formattedName2);

              matchingAthletes = result.data || [];
            }

            // Handle results: single match, multiple matches, or no matches
            if (matchingAthletes.length === 1) {
              athleteData = matchingAthletes[0];
              athleteError = null;
            } else if (matchingAthletes.length > 1) {
              // For multiple matches, get recent club info for each athlete
              const athletesWithRecentInfo = await Promise.all(
                matchingAthletes.map(async (athlete) => {
                  const { data: recentResults } = await supabase
                    .from('usaw_meet_results')
                    .select('wso, club_name, date')
                    .eq('lifter_id', athlete.lifter_id)
                    .order('date', { ascending: false })
                    .limit(10);

                  const recentWso = recentResults?.find(r => r.wso && r.wso.trim() !== '')?.wso;
                  const recentClub = recentResults?.find(r => r.club_name && r.club_name.trim() !== '')?.club_name;

                  return {
                    ...athlete,
                    recent_wso: recentWso,
                    recent_club_name: recentClub
                  };
                })
              );

              if (isMounted) {
                setDuplicateAthletes(athletesWithRecentInfo);
              }
              return; // Exit early to show disambiguation
            } else {
              athleteError = { message: 'Athlete not found' };
            }
          }

          if (athleteError || !athleteData) {
            throw new Error('Athlete not found');
          }

          // Fetch all IWF aliases (may be multiple)
          const { data: aliasRows } = await supabase
            .from('athlete_aliases')
            .select('iwf_db_lifter_id')
            .eq('usaw_lifter_id', athleteData.lifter_id);

          const fetchedIwfProfiles: { id: string; url: string | null }[] = [];

          if (aliasRows && aliasRows.length > 0) {
            await Promise.all(aliasRows.map(async (alias: { iwf_db_lifter_id: number }) => {
              const { data: iwfData } = await supabaseIWF
                .from('iwf_lifters')
                .select('iwf_lifter_id, iwf_athlete_url')
                .eq('db_lifter_id', alias.iwf_db_lifter_id)
                .maybeSingle();
              if (iwfData?.iwf_lifter_id != null) {
                fetchedIwfProfiles.push({
                  id: String(iwfData.iwf_lifter_id),
                  url: iwfData.iwf_athlete_url ?? null,
                });
              }
            }));
          }

          const { data: resultsData, error: resultsError } = await supabase
            .from('usaw_meet_results')
            .select(`
              *,
              meets:usaw_meets!inner("Level")
            `)
            .eq('lifter_id', athleteData.lifter_id)
            .order('date', { ascending: false });

          if (resultsError) throw resultsError;

          let iwfResultsData: any[] = [];
          if (aliasRows && aliasRows.length > 0) {
            const iwfDbIds = aliasRows.map((a: any) => a.iwf_db_lifter_id);
            if (iwfDbIds.length > 0) {
              const { data: iwfData, error: iwfError } = await supabaseIWF
                .from('iwf_meet_results')
                .select('*, iwf_meets(iwf_meet_id)')
                .in('db_lifter_id', iwfDbIds);
                
              if (!iwfError && iwfData) {
                iwfResultsData = (iwfData as IWFMeetResult[]).map(result => ({
                  ...adaptIWFResult(result),
                  _source: 'IWF'
                }));
              }
            }
          }
          
          const taggedUsawResults = (resultsData || []).map((r: any) => ({ ...r, _source: 'USAW' }));

          if (isMounted) {
            setAthlete(athleteData);
            setUsawResults(taggedUsawResults);
            setIwfResults(iwfResultsData);
            setIwfProfiles(fetchedIwfProfiles);
          }
        };

        await Promise.race([fetchData(), timeoutPromise]);

      } catch (err: any) {
        if (isMounted) {
          const isTimeout = err.message === 'Data fetch timed out';

          // Retry logic with exponential backoff
          if (isTimeout && attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt) * 2000; // 2s, 4s
            console.log(`[ATHLETE] Data fetch timed out, retrying in ${delay}ms (attempt ${attempt + 1} of ${MAX_RETRIES})...`);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));

            // Retry
            return fetchAthleteData(attempt + 1);
          }

          // Final error after all retries
          if (isTimeout) {
            setError('Unable to load athlete data. The database may be experiencing high load. Please try again in a moment.');
          } else {
            setError(err.message);
          }
          console.error('Error fetching athlete data:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAthleteData();

    return () => { isMounted = false; };
  }, [resolvedParams.id, initialData]);

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

  // Detect if athlete competed internationally in past 4 years
  const hasCompetedInternationally = useMemo(() => {
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

    return results.some(result => {
      const resultDate = new Date(result.date);
      const level = result.meets?.Level?.toLowerCase() || '';
      const isInternational = level.includes('international') || level.includes('world');
      return isInternational && resultDate >= fourYearsAgo;
    });
  }, [results]);

  // Prepare chart data
  const chartData = useMemo(() => results
    .filter(r => r.date && (r.best_snatch || r.best_cj || r.total || r.qpoints || r.q_youth || r.q_masters))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(r => {
      const baseData: any = {
        date: r.date,
        meet: r._source === 'IWF' ? `[IWF] ${r.meet_name || 'Unknown'}` : (r.meet_name || 'Unknown'),
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

    // GAMX Flags
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
        <div className="max-w-[1248px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card-primary mb-8">
            <h1 className="text-2xl font-bold text-app-primary mb-4">
              Multiple athletes found for "{searchName}"
            </h1>
            <p className="text-app-secondary mb-6">
              Please select the athlete you're looking for:
            </p>

            <div className="space-y-4">
              {duplicateAthletes.map((athlete, index) => {
                // Check if this athlete's membership number is shared with any other athlete in the list
                // trying to distinguish different people (different lifter_id) who share a membership number
                const isMembershipAmbiguous = duplicateAthletes.some(other =>
                  other.lifter_id !== athlete.lifter_id &&
                  other.membership_number &&
                  athlete.membership_number &&
                  other.membership_number === athlete.membership_number
                );

                const profileUrl = (athlete.membership_number && athlete.membership_number !== 'null' && !isMembershipAmbiguous)
                  ? `/athlete/${athlete.membership_number}`
                  : `/athlete/u-${athlete.lifter_id}`;

                return (
                  <Link
                    key={index}
                    href={profileUrl}
                    className="w-full text-left p-4 bg-app-tertiary hover:bg-app-surface border border-app-secondary rounded-lg transition-colors hover:shadow-md block"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-app-primary">{athlete.athlete_name}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-app-secondary mt-1">
                          {athlete.membership_number && (
                            <span>USAW #{athlete.membership_number}</span>
                          )}
                          {athlete.gender && (
                            <span>{athlete.gender === 'M' ? 'Male' : 'Female'}</span>
                          )}
                          {athlete.recent_wso && (
                            <span>WSO: {athlete.recent_wso}</span>
                          )}
                          {athlete.recent_club_name && (
                            <span>Club: {athlete.recent_club_name}</span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-app-muted" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold text-app-primary mb-4">Error Loading Athlete</h1>
          <p className="text-app-secondary mb-6">{error || 'Athlete not found'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-accent-primary hover:bg-accent-primary-hover text-app-primary px-6 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.history.back()}
              className="bg-app-tertiary hover:bg-app-surface text-app-secondary px-6 py-2 rounded-lg transition-colors border border-app-secondary"
            >
              Go Back
            </button>
          </div>
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
                  {athlete.membership_number && (
                    <div className="flex items-center space-x-1">
                      <span>USAW Membership #{athlete.membership_number}</span>
                    </div>
                  )}
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
                      <span>WSO: {recentInfo.wso}</span>
                    </div>
                  )}
                  {recentInfo.club && (
                    <div className="flex items-center space-x-1">
                      <Dumbbell className="h-4 w-4" />
                      <span>Barbell Club: {recentInfo.club}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Internal Navigation Links & Toggle */}
            {iwfProfiles.length > 0 && (
              <div className="flex flex-col gap-3 my-4 md:my-0 md:pt-2 items-start justify-center px-4">
                {iwfProfiles.map((p) => (
                  <Link
                    key={p.id}
                    href={`/athlete/iwf/${p.id}`}
                    className="inline-flex items-center space-x-2 px-3 py-1.5 bg-transparent hover:bg-app-tertiary border border-app-secondary rounded-md text-app-secondary hover:text-white transition-colors text-sm"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>View Linked IWF Results{iwfProfiles.length > 1 ? ` (${p.id})` : ''}</span>
                  </Link>
                ))}
                
                {/* IWF Results Toggle */}
                {iwfResults.length > 0 && (
                  <label className="flex items-center space-x-3 cursor-pointer mt-1">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={showIwfResults}
                        onChange={(e) => setShowIwfResults(e.target.checked)}
                      />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${showIwfResults ? 'bg-accent-primary' : 'bg-app-surface border border-app-secondary'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showIwfResults ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-sm font-medium text-app-secondary select-none text-nowrap">
                      Include IWF Results
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* External Profile Links */}
            <div className="flex flex-col mt-4 md:mt-0 md:items-end flex-1">
              <div className="flex flex-col gap-2 items-end">
                <p className="text-xs font-semibold text-app-secondary border-b border-app-secondary pb-0.5 mb-1 self-stretch text-right">External Links</p>
                {athlete.internal_id && (
                  <a
                    href={`https://usaweightlifting.sport80.com/public/rankings/member/${athlete.internal_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>USAW Official Profile{athlete.internal_id_2 ? ' 1' : ''}</span>
                  </a>
                )}
                {athlete.internal_id_2 && (
                  <a
                    href={`https://usaweightlifting.sport80.com/public/rankings/member/${athlete.internal_id_2}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>USAW Official Profile 2</span>
                  </a>
                )}
                {iwfProfiles.map((p) => p.url && (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>IWF Official Profile{iwfProfiles.filter(x => x.url).length > 1 ? ` (${p.id})` : ''}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Charts */}
        {chartData.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="card-chart">
              <div className="p-6 border-b border-app-secondary">
                <h2 className="text-xl font-bold text-app-primary flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Performance Progress
                </h2>
              </div>
              <div className="p-6 h-[400px]">
                <PerformanceChart chartData={chartData} athlete={athlete} />
              </div>
            </div>

            <div className="card-chart">
              <div className="p-6 border-b border-app-secondary">
                <h2 className="text-xl font-bold text-app-primary flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Q-Score Analysis
                </h2>
              </div>
              <div className="p-6 h-[400px]">
                <QScoreChart chartData={chartData} athlete={athlete} legendFlags={legendFlags} />
              </div>
            </div>

            <div className="card-chart lg:col-span-2">
              <div className="p-6 border-b border-app-secondary">
                <h2 className="text-xl font-bold text-app-primary flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  GAMX Advanced Analysis
                </h2>
              </div>
              <div className="p-6 h-[600px]">
                <GamxChart chartData={chartData} athlete={athlete} legendFlags={legendFlags} />
              </div>
            </div>
          </div>
        )}
        {/* Athlete Performance Profile Card */}
        {results.length > 0 && (
          hasCompetedInternationally ? (
            <AuthGuard
              requireAnyRole={[ROLES.ADMIN, ROLES.COACH, ROLES.USAW_NATIONAL_TEAM_COACH]}
              fallback={<></>}
            >
              <AthleteCard athleteName={athlete.athlete_name} results={results} />
            </AuthGuard>
          ) : (
            <AthleteCard athleteName={athlete.athlete_name} results={results} />
          )
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
            </div>
          </div>
        </div>

        {/* Competition Results */}
        <div className="card-results results-table min-h-[400px]">
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
                                    href={result._source === 'IWF' ? `/meet/iwf/${result.meet_id}` : `/meet/${result.meet_id}`}
                                    className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left hover:underline"
                                    title={result.meet_name}
                                  >
                                    {result.meet_name}
                                    {result._source === 'IWF' && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400 border border-red-800/50">
                                        IWF
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
                                    href={result._source === 'IWF' ? `/meet/iwf/${result.meet_id}` : `/meet/${result.meet_id}`}
                                    className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left hover:underline"
                                    title={result.meet_name}
                                  >
                                    {result.meet_name}
                                    {result._source === 'IWF' && (
                                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400 border border-red-800/50">
                                        IWF
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
