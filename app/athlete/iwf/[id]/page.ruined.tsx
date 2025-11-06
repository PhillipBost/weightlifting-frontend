'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabaseIWF, type IWFLifter } from '../../../../lib/supabaseIWF';
import {
  adaptIWFAthlete,
  adaptIWFResultsWithMeetData,
  type AdaptedAthlete,
  type AdaptedResult
} from '../../../../lib/adapters/iwfAdapter';
import { getSourceBadge } from '../../../../lib/types/dataSource';
import { ThemeSwitcher } from '../../../components/ThemeSwitcher';
import { AthleteCard } from '../../../components/AthleteCard';
import { AuthGuard } from '../../../components/AuthGuard';
import { ROLES } from '../../../../lib/roles';
import {
  Trophy, Calendar, Weight, TrendingUp, User, MapPin, ExternalLink,
  ArrowLeft, ChevronLeft, ChevronRight, Globe, BarChart3
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Brush
} from 'recharts';
import Papa from 'papaparse';

interface IWFAthletePageProps {
  params: Promise<{ id: string }>;
}

// Helper to get best Q-score
const getBestQScore = (result: any) => {
  const qYouth = result.q_youth || 0;
  const qPoints = result.qpoints || 0;
  const qMasters = result.q_masters || 0;

  if (qPoints >= qYouth && qPoints >= qMasters && qPoints > 0) {
    return { value: qPoints, type: 'qpoints', style: { color: 'var(--chart-qpoints)' } };
  }
  if (qYouth >= qMasters && qYouth > 0) {
    return { value: qYouth, type: 'qyouth', style: { color: 'var(--chart-qyouth)' } };
  }
  if (qMasters > 0) {
    return { value: qMasters, type: 'qmasters', style: { color: 'var(--chart-qmasters)' } };
  }

  return { value: null, type: 'none', style: { color: 'var(--chart-qpoints)' } };
};

// Export to CSV function
const exportTableToCSV = (results: AdaptedResult[], athleteName: string, showAllColumns: boolean = false) => {
  const csvData = results.map(result => {
    if (showAllColumns) {
      return {
        'Date': result.date,
        'Meet': result.meet_name || '',
        'Age Category': result.age_category || '',
        'Weight Class': result.weight_class || '',
        'Body Weight (kg)': result.body_weight_kg || '',
        'Snatch Lift 1': result.snatch_lift_1 || '',
        'Snatch Lift 2': result.snatch_lift_2 || '',
        'Snatch Lift 3': result.snatch_lift_3 || '',
        'Best Snatch (kg)': result.best_snatch || '',
        'C&J Lift 1': result.cj_lift_1 || '',
        'C&J Lift 2': result.cj_lift_2 || '',
        'C&J Lift 3': result.cj_lift_3 || '',
        'Best C&J (kg)': result.best_cj || '',
        'Total (kg)': result.total || '',
        'Q-Points': result.qpoints || '',
      };
    } else {
      return {
        'Date': result.date,
        'Meet': result.meet_name || '',
        'Weight Class': result.weight_class || '',
        'Best Snatch (kg)': result.best_snatch || '',
        'Best C&J (kg)': result.best_cj || '',
        'Total (kg)': result.total || '',
        'Q-Points': result.qpoints || '',
      };
    }
  });

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${athleteName}_IWF_Results.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


// Export chart to PDF
const exportChartToPDF = async (chartRef: React.RefObject<HTMLDivElement>, filename: string) => {
  if (!chartRef.current) return;

  try {
    const canvas = await html2canvas(chartRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageHeight = pdf.internal.pageSize.getHeight();
    let heightLeft = imgHeight;
    let position = 10;

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
  }
};

// Export table to PDF
const exportTableToPDF = async (tableRef: React.RefObject<HTMLDivElement>, filename: string, athleteName: string) => {
  if (!tableRef.current) return;

  try {
    const element = tableRef.current;
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageHeight = pdf.internal.pageSize.getHeight();
    let heightLeft = imgHeight;
    let position = 10;

    // Add title
    pdf.setFontSize(14);
    pdf.text(`${athleteName} - Competition Results`, 10, 10);
    position = 20;

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting PDF:', error);
  }
};


// LiftAttempts Component
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
              className={`px-2 py-1 rounded text-xs font-mono ${
                isBest 
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

// SortIcon Component
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

// Pagination Component
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
              className={`px-3 py-2 text-sm font-medium rounded-lg ${
                page === currentPage
                  ? 'bg-accent-primary text-app-primary border border-accent-primary'
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

export default function IWFAthletePage({ params }: IWFAthletePageProps) {
  const resolvedParams = React.use(params);
  const router = useRouter();

  // State
  const [athlete, setAthlete] = useState<AdaptedAthlete | null>(null);
  const [results, setResults] = useState<AdaptedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc',
  });

  // Chart toggles
  const [showSnatch, setShowSnatch] = useState(true);
  const [showCleanJerk, setShowCleanJerk] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [showAttempts, setShowAttempts] = useState(true);
  const [showBodyweight, setShowBodyweight] = useState(true);
  const [showQPoints, setShowQPoints] = useState(true);
  const [showQYouth, setShowQYouth] = useState(false);
  const [showQMasters, setShowQMasters] = useState(false);

  const [autoScalePerformance, setAutoScalePerformance] = useState(true);
  const [showPerformanceBrush, setShowPerformanceBrush] = useState(false);
  const [autoScaleQScores, setAutoScaleQScores] = useState(true);
  const [showQScoresBrush, setShowQScoresBrush] = useState(false);
  const [performanceMouseX, setPerformanceMouseX] = useState<number | null>(null);
  const [qScoresMouseX, setQScoresMouseX] = useState<number | null>(null);

  const [showAllColumns, setShowAllColumns] = useState(false);

  // Chart refs
  const performanceChartRef = useRef<HTMLDivElement>(null);
  const qScoresChartRef = useRef<HTMLDivElement>(null);
  const resultsTableRef = useRef<HTMLDivElement>(null);

  const resultsPerPage = 20;
  const athleteId = parseInt(resolvedParams.id, 10);

  useEffect(() => {
    async function fetchAthleteData() {
      try {
        setLoading(true);
        setError(null);

        if (isNaN(athleteId)) {
          setError('Invalid athlete ID');
          setLoading(false);
          return;
        }

        // Fetch athlete profile
        const { data: athleteData, error: athleteError } = await supabaseIWF
          .from('iwf_lifters')
          .select('*')
          .eq('db_lifter_id', athleteId)
          .single();

        if (athleteError || !athleteData) {
          setError('Athlete not found');
          setLoading(false);
          return;
        }

        // Adapt athlete data
        const adaptedAthlete = adaptIWFAthlete(athleteData);
        setAthlete(adaptedAthlete);

        // Fetch competition results
        const { data: resultsData, error: resultsError } = await supabaseIWF
          .from('iwf_meet_results')
          .select(`
            *,
            iwf_meets (
              meet,
              level,
              date,
              url
            )
          `)
          .eq('db_lifter_id', athleteId)
          .order('date', { ascending: false });

        if (resultsError) {
          console.error('Error fetching results:', resultsError);
          setError('Failed to load competition results');
          setLoading(false);
          return;
        }

        // Adapt results data
        const adaptedResults = adaptIWFResultsWithMeetData(resultsData || []);
        setResults(adaptedResults);
        setLoading(false);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    }

    fetchAthleteData();
  }, [athleteId]);

  // Calculate personal bests
  const personalBests = useMemo(() => {
    if (results.length === 0) return { best_snatch: 0, best_cj: 0, best_total: 0, best_qpoints: 0 };

    return {
      best_snatch: Math.max(...results.map(r => parseInt(String(r.best_snatch)) || 0)),
      best_cj: Math.max(...results.map(r => parseInt(String(r.best_cj)) || 0)),
      best_total: Math.max(...results.map(r => parseInt(String(r.total)) || 0)),
      best_qpoints: Math.max(...results.map(r => r.qpoints || 0)),
    };
  }, [results]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return results
      .slice()
          .reverse()
    .map(result => {
      const date = new Date(result.date);
      const timestamp = date.getTime();
      
      // Parse attempt data for markers
      const snatchLifts = [
        parseInt(String(result.snatch_lift_1)) || 0,
        parseInt(String(result.snatch_lift_2)) || 0,
        parseInt(String(result.snatch_lift_3)) || 0
      ];
      const cjLifts = [
        parseInt(String(result.cj_lift_1)) || 0,
        parseInt(String(result.cj_lift_2)) || 0,
        parseInt(String(result.cj_lift_3)) || 0
      ];
      
      // Create attempt markers (positive = successful, negative = miss)
      const chartObj: any = {
        date: result.date,
        timestamp: timestamp,
        meet: result.meet_name,
        dateWithAge: result.competition_age 
          ? `${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${result.competition_age})`
          : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        snatch: parseInt(String(result.best_snatch)) || null,
        cleanJerk: parseInt(String(result.best_cj)) || null,
        total: parseInt(String(result.total)) || null,
        bodyweight: parseFloat(String(result.body_weight_kg)) || null,
        qpoints: result.qpoints || null,
        qyouth: result.q_youth || null,
        qmasters: result.q_masters || null,
        qpointsBackground: result.qpoints || null,
        qyouthBackground: result.q_youth || null,
        qmastersBackground: result.q_masters || null,
      };
      
      // Add snatch attempt markers
      [1, 2, 3].forEach((num, idx) => {
        const lift = snatchLifts[idx];
        if (lift > 0) {
          chartObj[`snatchGood${num}`] = lift;
        } else if (lift < 0) {
          chartObj[`snatchMiss${num}`] = Math.abs(lift);
        }
      });
      
      // Add C&J attempt markers
      [1, 2, 3].forEach((num, idx) => {
        const lift = cjLifts[idx];
        if (lift > 0) {
          chartObj[`cjGood${num}`] = lift;
        } else if (lift < 0) {
          chartObj[`cjMiss${num}`] = Math.abs(lift);
        }
      });
      
      return chartObj;
    })
        .sort((a, b) => a.timestamp - b.timestamp);
  }, [results]);

  // Calculate legend flags for Q-scores
  const legendFlags = useMemo(() => ({
    hasQYouth: chartData?.some(d => d.qyouth && d.qyouth > 0) || false,
    hasQMasters: chartData?.some(d => d.qmasters && d.qmasters > 0) || false
  }), [chartData]);

  // Auto-enable Q-Youth and Q-Masters toggles when data exists
  useEffect(() => {
    setShowQYouth(legendFlags.hasQYouth);
    setShowQMasters(legendFlags.hasQMasters);
  }, [legendFlags.hasQYouth, legendFlags.hasQMasters]);

  // Sorting logic
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const sortedResults = useMemo(() => {
    if (!sortConfig.key) return results;

    return [...results].sort((a, b) => {
      let aVal: any = a[sortConfig.key as keyof AdaptedResult];
      let bVal: any = b[sortConfig.key as keyof AdaptedResult];

      // Handle date sorting
      if (sortConfig.key === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      // Handle numeric values
      if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
        aVal = parseFloat(aVal);
      }
      if (typeof bVal === 'string' && !isNaN(parseFloat(bVal))) {
        bVal = parseFloat(bVal);
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, sortConfig]);

  // Pagination
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedResults.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedResults, currentPage]);

  const totalPages = Math.ceil(sortedResults.length / resultsPerPage);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-app-secondary">Loading IWF athlete data...</div>
      </div>
    );
  }

  // Error state
  if (error || !athlete) {
    return (
      <div className="min-h-screen bg-app-gradient">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-app-primary mb-4">{error || 'Athlete Not Found'}</h2>
            <Link href="/" className="btn-primary">Return to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  // Render
  return (
    <div className="min-h-screen bg-app-gradient">
      <header className="bg-header-blur border-b border-app-secondary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.png"
                  alt="WeightliftingDB Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <div className="text-lg font-bold text-app-primary">WeightliftingDB</div>
                  <div className="text-xs text-app-tertiary">USA Weightlifting Results Database</div>
                </div>
              </Link>
              <button
                onClick={() => router.push('/')}
                className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Search</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              {athlete.iwf_athlete_url && (
                <a
                  href={athlete.iwf_athlete_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>External Profile</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* AthleteCard Component */}
        {results.length > 0 && (
          <AuthGuard
            requireAnyRole={[ROLES.ADMIN, ROLES.COACH, ROLES.USAW_NATIONAL_TEAM_COACH]}
            fallback={null}
          >
            <AthleteCard athleteName={athlete.athlete_name} results={results as any} />
          </AuthGuard>
        )}

        {/* Personal Bests Cards */}
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

        {/* Competition Results Table */}
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

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-app-secondary/20 dark:bg-app-secondary/40">
                <tr>
                  {showAllColumns ? (
                    <>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('date')}
                      >
                        Date
                        <SortIcon column="date" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('meet_name')}
                      >
                        Meet
                        <SortIcon column="meet_name" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('age_category')}
                      >
                        Age Category
                        <SortIcon column="age_category" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('weight_class')}
                      >
                        Weight Class
                        <SortIcon column="weight_class" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('body_weight_kg')}
                      >
                        Body Weight
                        <SortIcon column="body_weight_kg" sortConfig={sortConfig} />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider">Sn 1</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider">Sn 2</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider">Sn 3</th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('best_snatch')}
                      >
                        Best Sn
                        <SortIcon column="best_snatch" sortConfig={sortConfig} />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider">CJ 1</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider">CJ 2</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider">CJ 3</th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('best_cj')}
                      >
                        Best CJ
                        <SortIcon column="best_cj" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('total')}
                      >
                        Total
                        <SortIcon column="total" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('qpoints')}
                      >
                        Q-Points
                        <SortIcon column="qpoints" sortConfig={sortConfig} />
                      </th>
                    </>
                  ) : (
                    <>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('date')}
                      >
                        Date
                        <SortIcon column="date" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('meet_name')}
                      >
                        Meet
                        <SortIcon column="meet_name" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('weight_class')}
                      >
                        Weight Class
                        <SortIcon column="weight_class" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('best_snatch')}
                      >
                        Best Sn
                        <SortIcon column="best_snatch" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('best_cj')}
                      >
                        Best CJ
                        <SortIcon column="best_cj" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('total')}
                      >
                        Total
                        <SortIcon column="total" sortConfig={sortConfig} />
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-1 text-left text-xs font-medium text-app-primary uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                        onClick={() => handleSort('qpoints')}
                      >
                        Best Q-Score
                        <SortIcon column="qpoints" sortConfig={sortConfig} />
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((result, index) => {
                  const bestQScore = getBestQScore(result);

                  return showAllColumns ? (
                    <tr key={index} className="border-t first:border-t-0 dark:even:bg-app-secondary/10 even:bg-app-secondary/5 hover:bg-app-secondary/20 transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td className="px-2 py-1 max-w-20 text-xs">{result.meet_name}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.age_category || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.weight_class || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-bodyweight)' }}>{result.body_weight_kg ? `${result.body_weight_kg}kg` : '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.snatch_lift_1 || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.snatch_lift_2 || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.snatch_lift_3 || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-snatch)' }}>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.cj_lift_1 || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.cj_lift_2 || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.cj_lift_3 || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-cleanjerk)' }}>{result.best_cj ? `${result.best_cj}kg` : '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs font-bold" style={{ color: 'var(--chart-total)' }}>{result.total ? `${result.total}kg` : '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-qpoints)' }}>{result.qpoints ? result.qpoints.toFixed(1) : '-'}</td>
                    </tr>
                  ) : (
                    <tr key={index} className="border-t first:border-t-0 dark:even:bg-app-secondary/10 even:bg-app-secondary/5 hover:bg-app-secondary/20 transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td className="px-2 py-1 max-w-xs text-xs">{result.meet_name}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs">{result.weight_class || '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-snatch)' }}>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-cleanjerk)' }}>{result.best_cj ? `${result.best_cj}kg` : '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs font-bold" style={{ color: 'var(--chart-total)' }}>{result.total ? `${result.total}kg` : '-'}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-xs" style={bestQScore.style}>{bestQScore.value ? bestQScore.value.toFixed(1) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-6 border-t border-app-secondary">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              totalResults={results.length}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}