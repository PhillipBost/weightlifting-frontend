"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseIWF, type IWFLifter, type IWFMeetResult } from '../../../../lib/supabaseIWF';
import { adaptIWFAthlete, adaptIWFResult } from '../../../../lib/adapters/iwfAdapter';
import { Trophy, Calendar, Weight, TrendingUp, Medal, User, Building, MapPin, ExternalLink, ArrowLeft, BarChart3, Dumbbell, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, Brush, ReferenceLine } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

// Improved export functions
const exportChartToPDF = async (chartRef: React.RefObject<HTMLDivElement>, filename: string) => {
  if (!chartRef.current) return;
  
  try {
    const element = chartRef.current;
    const rect = element.getBoundingClientRect();
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#1f2937', // Use a fixed color for exports
      scale: 1,
      useCORS: true,
      allowTaint: true,
      width: rect.width,
      height: rect.height,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: 0,
      y: 0,
    });
    
    const imgData = canvas.toDataURL('image/png', 1.0);
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3' 
    });
    
    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (error: any) {
    console.error('Full error details:', error);
    alert(`Failed to export PDF: ${error.message}`);
  }
};

const exportTableToPDF = async (tableRef: React.RefObject<HTMLDivElement>, filename: string, athleteName: string) => {
  if (!tableRef.current) return;
  
  try {
    const element = tableRef.current;
    const table = element.querySelector('table');
    if (!table) {
      alert('No table found to export');
      return;
    }
    
    const originalStyles = {
      width: table.style.width,
      fontSize: table.style.fontSize,
      transform: table.style.transform,
      transformOrigin: table.style.transformOrigin
    };
    
    const tableWidth = table.scrollWidth;
    const viewportWidth = window.innerWidth - 100;
    const scale = Math.min(1, viewportWidth / tableWidth);
    
    table.style.transform = `scale(${scale})`;
    table.style.transformOrigin = 'top left';
    table.style.width = `${tableWidth}px`;
    table.style.fontSize = '10px';
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#1f2937', // Use fixed color for exports
      scale: 1,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: tableWidth * scale + 100,
      windowHeight: window.innerHeight,
      width: tableWidth * scale + 40,
      height: element.scrollHeight,
    });
    
    // Restore original styles
    Object.assign(table.style, originalStyles);
    
    const imgData = canvas.toDataURL('image/png', 1.0);
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [imgWidth + 40, imgHeight + 80]
    });
    
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${athleteName} - Competition Results`, 20, 40);
    pdf.addImage(imgData, 'PNG', 20, 60, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting table:', error);
    alert('Failed to export table. Please try again.');
  }
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
  const [selectedTab, setSelectedTab] = useState('overview');
  const [athlete, setAthlete] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
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

        const { data: resultsData, error: resultsError } = await supabaseIWF
          .from('iwf_meet_results')
          .select('*')
          .eq('db_lifter_id', athleteData.lifter_id)
          .order('date', { ascending: false });

        if (resultsError) throw resultsError;

        // Adapt results using the adapter
        const adaptedResults = (resultsData || []).map((result: IWFMeetResult) => adaptIWFResult(result));

        setAthlete(athleteData);
        setResults(adaptedResults);
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
  const chartData = results
    .filter(r => r.date && (r.best_snatch || r.best_cj || r.total || r.qpoints || r.q_youth || r.q_masters))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(r => {
      const baseData: any = {
        date: r.date,
        meet: r.meet_name || 'Unknown',
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
    });

  const legendFlags = useMemo(() => ({
	hasQYouth: chartData?.some(d => d.qYouth && d.qYouth > 0) || false,
	hasQMasters: chartData?.some(d => d.qMasters && d.qMasters > 0) || false
  }), [chartData]);
  
  useEffect(() => {
    setShowQYouth(legendFlags.hasQYouth);
    setShowQMasters(legendFlags.hasQMasters);
  }, [legendFlags.hasQYouth, legendFlags.hasQMasters]);
  
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
                <button
                  key={index}
                  onClick={() => router.push(`/athlete/iwf/${athlete.athlete_name.replace(/\s+/g, '-')}`)}
                  className="w-full text-left p-4 bg-app-tertiary hover:bg-app-surface border border-app-secondary rounded-lg transition-colors"
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
                </button>
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
          <div className="flex flex-col md:flex-row md:items-start md:justify-between">
            <div className="flex items-start space-x-6">
              <div className="bg-app-tertiary rounded-full p-4">
                <User className="h-12 w-12 text-app-secondary" />
              </div>
              <div>
                <div className="flex flex-col">
                  <h1 className="text-3xl font-bold text-app-primary mb-2">{athlete.athlete_name}</h1>
                  <div className="flex flex-wrap gap-4 text-sm text-app-secondary">
                    <div className="flex items-center space-x-1">
                      <span>IWF Athlete ID: {athlete.lifter_id}</span>
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
            </div>

            {/* External Profile Link */}
            {athlete.iwf_athlete_url && (
              <div className="flex flex-col gap-2 mt-4 md:mt-0">
                <a
                  href={athlete.iwf_athlete_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>IWF Profile</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Performance Charts */}
        {chartData.length > 1 && (
          <div className="max-w-[1200px]">
            <div className="space-y-8 mb-8">
            {/* Progress Over Time Chart */}
			<div className="chart-container" ref={performanceChartRef}>
				<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
				  <h3 className="text-lg font-semibold text-app-primary flex items-center">
					<TrendingUp className="h-5 w-5 mr-2" />
					{athlete.athlete_name} Performance Progress
				  </h3>
				  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
					{/* Performance toggles in their own bordered group */}
					<div className="flex gap-1 border border-app-secondary rounded-lg p-1 w-fit">
					  <button 
						onClick={() => setShowSnatch(!showSnatch)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showSnatch 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
						  }
						`}
					  >
						Snatch
					  </button>
					  <button 
						onClick={() => setShowCleanJerk(!showCleanJerk)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showCleanJerk 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
						  }
						`}
					  >
						C&J
					  </button>
					  <button 
						onClick={() => setShowTotal(!showTotal)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showTotal 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
						  }
						`}
					  >
						Total
					  </button>
					  <button 
						onClick={() => setShowAttempts(!showAttempts)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showAttempts 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
						  }
						`}
					  >
						Attempts
					  </button>
					  <button 
						onClick={() => setShowBodyweight(!showBodyweight)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showBodyweight 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
						  }
						`}
					  >
						Bodyweight
					  </button>
					</div>
					
					{/* Chart controls in their own separate group */}
					<div className="flex gap-2">
					<div className="flex space-x-2">
					<div className="flex space-x-1 border-app-secondary rounded-lg p-1">
					  <button 
						onClick={() => setAutoScalePerformance(!autoScalePerformance)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${autoScalePerformance 
						  ? 'bg-accent-primary text-app-primary'           // Blue when ON
						  : 'bg-app-surface text-app-secondary hover:bg-app-hover'  // Gray when OFF
						  }
						`}
					  >
						Auto Scale
					  </button>
					  <button
						onClick={() => setShowPerformanceBrush(!showPerformanceBrush)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showPerformanceBrush 
						  ? 'bg-accent-primary text-app-primary'           // Blue when ON
						  : 'bg-app-surface text-app-secondary hover:bg-app-hover'  // Gray when OFF
						  }
						`}
					  >
						Zoom
					  </button>
					</div>
					</div>
					</div>
				  </div>
				</div>
			  
			  <p className="text-sm text-app-muted mb-4">
				Lifting performance over time.
			  </p>
			  
              <ResponsiveContainer width="100%" height={500}>
			    <LineChart 
				  data={chartData} 
				  margin={{ top: 20, right: 50, left: 20, bottom: 20 }}
				  onMouseMove={(e) => {
				    if (e && e.activeLabel && !showPerformanceBrush) {
					  setPerformanceMouseX(Number(e.activeLabel));
				    }
				  }}
				  onMouseLeave={() => setPerformanceMouseX(null)}
			    >
				  {performanceMouseX && !showPerformanceBrush && (
				    <ReferenceLine 
					  x={performanceMouseX} 
					  stroke="var(--text-muted)" 
					  strokeWidth={1}
					  strokeDasharray="2 2"
					  strokeOpacity={0.6}
				    />
				  )}
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis 
                    type="number"
                    dataKey="timestamp"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    stroke="var(--chart-axis)"
                    fontSize={11}
                    tickFormatter={(timestamp) => {
                      const date = new Date(timestamp);
                      const year = date.getFullYear().toString().slice(-2);
                      return `Jan '${year}`;
                    }}
                    padding={{ left: 10, right: 10 }}
                    ticks={(() => {
                      if (chartData.length === 0) return [];
                      const minYear = new Date(Math.min(...chartData.map(d => d.timestamp))).getFullYear();
                      const maxYear = new Date(Math.max(...chartData.map(d => d.timestamp))).getFullYear();
                      const ticks = [];
                      for (let year = minYear - 1; year <= maxYear + 1; year++) {
                        ticks.push(new Date(year, 0, 1).getTime());
                      }
                      return ticks;
                    })()}
                    allowDataOverflow={true}
                    label={{ 
                      value: 'Competition Date (Competition Age)', 
                      position: 'insideBottom', 
                      offset: -5, 
                      style: { 
                        textAnchor: 'middle', 
                        fill: 'var(--chart-axis)',
                        fontSize: '12px'
                      } 
                    }}
                  />
                  <YAxis 
                    stroke="var(--chart-axis)"
                    fontSize={12}
                    domain={autoScalePerformance ? ['dataMin - 10', 'dataMax + 10'] : [0, 'dataMax + 5']}
                    allowDataOverflow={true}
                    label={{ 
                      value: 'Weight (kg)', 
                      angle: -90, 
                      position: 'insideLeft', 
                      style: { 
                        textAnchor: 'middle', 
                        fill: 'var(--chart-axis)',
                        fontSize: '12px'
                      } 
                    }}
                  />
                  {!showPerformanceBrush && (
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--chart-tooltip-bg)', 
                        border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      padding: '12px',
					  zIndex: 9999,
                    }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        
                        return (
                          <div className="bg-app-secondary border border-app-primary rounded-lg p-3">
                            <p className="text-app-primary font-medium mb-2">{`${data.meet} - ${data.dateWithAge}`}</p>
                            
                            {data.total && (
                              <p style={{ color: 'var(--chart-total)' }}>
                                Total: {data.total}kg
                              </p>
                            )}
							
                            <p style={{ color: 'var(--chart-cleanjerk)' }}>
                              Best Clean & Jerk: {data.cleanJerk ? `${data.cleanJerk}kg` : '-'}
                            </p>
                            
                            {[1, 2, 3].map(num => {
                              const good = data[`cjGood${num}`];
                              const miss = data[`cjMiss${num}`];
                              if (good || miss) {
                                return (
                                  <p key={`cj-${num}`} style={{ color: 'var(--text-primary)' }}>
                                    C&J Attempt {num} {good ? '✓' : '✗'}: {good || miss}kg
                                  </p>
                                );
                              }
                              return null;
                            })}
                            
                            <p style={{ color: 'var(--chart-snatch)' }}>
                              Best Snatch: {data.snatch ? `${data.snatch}kg` : '-'}
                            </p>
                            
                            {[1, 2, 3].map(num => {
                              const good = data[`snatchGood${num}`];
                              const miss = data[`snatchMiss${num}`];
                              if (good || miss) {
                                return (
                                  <p key={`snatch-${num}`} style={{ color: 'var(--text-primary)' }}>
                                    Snatch Attempt {num} {good ? '✓' : '✗'}: {good || miss}kg
                                  </p>
                                );
                              }
                              return null;
                            })}
                            
                            {data.bodyweight && (
                              <p style={{ color: 'var(--chart-bodyweight)' }}>
                                Bodyweight: {data.bodyweight}kg
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={false}
                    animationDuration={150}
                    allowEscapeViewBox={{ x: false, y: true }}
                    position={{ x: undefined, y: undefined }}
                  />
                  )}

                  {showSnatch && (
				  <>
				  <Line 
					dataKey="snatch"
					stroke="var(--chart-stroke)" 
					strokeWidth={3}
					dot={false}
					activeDot={false}
					legendType="none"
				  />
				  <Line 
					dataKey="snatch" 
					stroke="var(--chart-snatch)" 
					strokeWidth={2.5}
                    dot={{ 
                      fill: 'var(--chart-snatch)',
					  stroke: 'var(--chart-stroke)',
                      strokeWidth: 0.5, 
                      r: 5,
                      style: { cursor: 'pointer' }
                    }}
                    activeDot={{ 
                      r: 8, 
                      stroke: 'var(--chart-stroke)', 
                      strokeWidth: 2, 
                      fill: 'var(--chart-snatch)',
                      style: { cursor: 'pointer' }
                    }}
                    name="snatch"
                    connectNulls={false}
                  />
				  {showAttempts && (
				  <>
                  {[1, 2, 3].map(attemptNum => (
                    <Line
                      key={`snatch-good-${attemptNum}`}
                      type="monotone"
                      dataKey={`snatchGood${attemptNum}`}
                      stroke="none"
                      dot={{
                        fill: 'none',
                        stroke: 'var(--chart-snatch)',
                        strokeWidth: 1,
                        r: 2.5
                      }}
                      activeDot={false}
					  connectNulls={false}
                      legendType="none"
                    />
                  ))}
                  {[1, 2, 3].map(attemptNum => (
                    <Line
                      key={`snatch-miss-${attemptNum}`}
                      type="monotone"
                      dataKey={`snatchMiss${attemptNum}`}
                      stroke="none"
                      dot={{
                        fill: 'none',
                        stroke: 'var(--chart-failed)',
                        strokeWidth: 1,
                        r: 2.5
                      }}
                      activeDot={false}
					  connectNulls={false}
                      legendType="none"
                    />
				  ))}
				  </>
				  )}
				  </>
				  )}
				  
                  {showPerformanceBrush && (
                    <Brush 
                      key="performance-brush"
                      dataKey="timestamp" 
                      height={20}
                      y={500 - 20}
                      stroke="var(--text-disabled)"
                      fill="var(--chart-grid)"
                      fillOpacity={0.6}
                      tickFormatter={(timestamp) => {
                        const date = new Date(timestamp);
                        const year = date.getFullYear().toString().slice(-0);
                        return year;
                      }}
                    />
                  )}
				  
				  {showCleanJerk && (
				  <>
                  <Line 
					dataKey="cleanJerk" 
					stroke="var(--chart-stroke)" 
					strokeWidth={3}
					dot={false}
					activeDot={false}
				  />
                  <Line 
					dataKey="cleanJerk" 
					stroke="var(--chart-cleanjerk)" 
					strokeWidth={2.5}  
					dot={{ 
                      fill: 'var(--chart-cleanjerk)', 
					  stroke: 'var(--chart-stroke)',
                      strokeWidth: 0.5, 
                      r: 5,
                      style: { cursor: 'pointer' }
                    }}
                    activeDot={{ 
                      r: 8, 
                      stroke: 'var(--chart-stroke)', 
                      strokeWidth: 2, 
                      fill: 'var(--chart-cleanjerk)',
                      style: { cursor: 'pointer' }
                    }}
                    name="cleanJerk"
                    connectNulls={false}
                  />
				  {showAttempts && (
				  <>
                  {[1, 2, 3].map(attemptNum => (
                    <Line
                      key={`cj-good-${attemptNum}`}
                      type="monotone"
                      dataKey={`cjGood${attemptNum}`}
                      stroke="none"
                      dot={{
                        fill: 'none',
                        stroke: 'var(--chart-cleanjerk)',
                        strokeWidth: 1,
                        r: 2.5
                      }}
                      activeDot={false}
					  connectNulls={false}
                      legendType="none"
                    />
                  ))}
                  {[1, 2, 3].map(attemptNum => (
                    <Line
                      key={`cj-miss-${attemptNum}`}
                      type="monotone"
                      dataKey={`cjMiss${attemptNum}`}
                      stroke="none"
                      dot={{
                        fill: 'none',
                        stroke: 'var(--chart-failed)',
                        strokeWidth: 1,
                        r: 2.5
                      }}
                      activeDot={false}
					  connectNulls={false}
                      legendType="none"
                    />
				  ))}
				  </>
				  )}
				  </>
				  )}
				  
				  {showTotal && (
				  <>
                  <Line 
					dataKey="total" 
					stroke="var(--chart-stroke)" 
					strokeWidth={3}
					dot={false}
					activeDot={false}
				  />
				  
                  <Line 
					dataKey="total" 
					stroke="var(--chart-total)" 
					strokeWidth={2.5}  
					dot={{ 
                      fill: 'var(--chart-total)', 
					  stroke: 'var(--chart-stroke)',
                      strokeWidth: 0.5, 
                      r: 5,
                      style: { cursor: 'pointer' }
                    }}
                    activeDot={{ 
                      r: 8, 
                      stroke: 'var(--chart-stroke)', 
                      strokeWidth: 2, 
                      fill: 'var(--chart-total)',
                      style: { cursor: 'pointer' }
                    }}
                    name="total"
                    connectNulls={false}
                  />
				  </>
  				  )}
				  
                  {showBodyweight && (
				  <>
				  <Line 
					dataKey="bodyweight" 
					stroke="var(--chart-stroke)" 
					strokeWidth={3}
					dot={false}
					activeDot={false}
				  />
                  <Line 
					dataKey="bodyweight" 
					stroke="var(--chart-bodyweight)" 
					strokeWidth={2.5}  
					dot={{ 
                      fill: 'var(--chart-bodyweight)', 
					  stroke: 'var(--chart-stroke)',
                      strokeWidth: 0.5, 
                      r: 5,
                      style: { cursor: 'pointer' }
                    }}
                    activeDot={{ 
                      r: 8, 
                      stroke: 'var(--chart-stroke)', 
                      strokeWidth: 2, 
                      fill: 'var(--chart-bodyweight)',
                      style: { cursor: 'pointer' }
                    }}
                    name="bodyweight"
                    connectNulls={false}
                  />
				  </>
				  )}
                </LineChart>
              </ResponsiveContainer>
			  
			  <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-app-secondary">
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-snatch)]"></div>
					<span className="text-sm text-app-secondary">Snatch</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-cleanjerk)]"></div>
					<span className="text-sm text-app-secondary">Clean & Jerk</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-total)]"></div>
					<span className="text-sm text-app-secondary">Total</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-bodyweight)]"></div>
					<span className="text-sm text-app-secondary">Bodyweight</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-3 h-3 rounded-full bg-[var(--chart-snatch)] opacity-100 border border-[var(--chart-stroke)] border-opacity-50"></div>
					<span className="text-sm text-app-secondary">Best Snatch</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-3 h-3 rounded-full bg-[var(--chart-cleanjerk)] opacity-100 border border-[var(--chart-stroke)] border-opacity-50"></div>
					<span className="text-sm text-app-secondary">Best C&J</span>
				  </div>
			  </div>
			  
			  <div className="flex flex-wrap justify-center gap-4 mt-2 text-sm">
				  <div className="flex items-center space-x-2">
					<div className="w-1.5 h-1.5 rounded-full bg-[var(--chart-snatch)]/50 border border-[var(--chart-snatch)]"></div>
					<span className="text-app-secondary">Snatch attempts</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-1.5 h-1.5 rounded-full bg-[var(--chart-cleanjerk)]/50 border border-[var(--chart-cleanjerk)]"></div>
					<span className="text-app-secondary">C&J attempts</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-1.5 h-1.5 rounded-full bg-[var(--chart-failed)]/50 border border-[var(--chart-failed)]"></div>
					<span className="text-app-secondary">Failed attempts</span>
				  </div>
			  </div>
			</div>

            {/* Q-Points Chart */}
            <div className="chart-container" ref={qScoresChartRef}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
				<h3 className="text-lg font-semibold text-app-primary flex items-center">
				  <BarChart3 className="h-5 w-5 mr-2" />
                  {athlete.athlete_name} Q-Scores Over Time
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
				 {/* Q-score toggles */}
				 <div className="flex gap-1 border border-app-secondary rounded-lg p-1 w-fit">
				  <button 
					  onClick={() => setShowQPoints(!showQPoints)}
					  className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showQPoints 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
					  }`}
				  >
					  Q-Points
				  </button>
				  {legendFlags.hasQYouth && (
				    <button 
						onClick={() => setShowQYouth(!showQYouth)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showQYouth 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
						  }
						`}
				    >
						Q-Youth
				    </button>
				  )}
				  {legendFlags.hasQMasters && (
					<button 
						onClick={() => setShowQMasters(!showQMasters)}
						className={`
						  px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						  ${showQMasters 
							? 'bg-accent-primary text-app-primary' 
							: 'bg-app-surface text-app-secondary hover:bg-app-hover'
						  }
						`}
					>
						Q-Masters
					</button>
				  )}

                 </div>
				 {/* Chart controls */}
				 <div className="flex gap-2">
				 <div className="flex space-x-1 border-app-secondary rounded-lg p-1">
				  <button 
					  onClick={() => setAutoScaleQScores(!autoScaleQScores)}
					  className={`
						px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						${autoScaleQScores 
						  ? 'bg-accent-primary text-app-primary'           // Blue when ON
						  : 'bg-app-surface text-app-secondary hover:bg-app-hover'  // Gray when OFF
						}
					  `}
				  >
					  Auto Scale
				  </button>

				  <button 
					  onClick={() => setShowQScoresBrush(!showQScoresBrush)}
					  className={`
						px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
						${showQScoresBrush
						  ? 'bg-accent-primary text-app-primary'           // Blue when ON
						  : 'bg-app-surface text-app-secondary hover:bg-app-hover'  // Gray when OFF
						}
					  `}
				  >
					  Zoom
                  </button>
				 </div>
				 </div>
                </div>
              </div>
			  
			  <p className="text-sm text-app-muted mb-4">
			    <a
				  href="https://www.usaweightlifting.org/news/2024/november/19/q-points-q-youth-to-be-used-in-2025-to-determine-best-lifters"
				  target="_blank" 
				  rel="noopener noreferrer"
				  className="text-accent-primary hover:text-accent-primary-hover underline decoration-1 underline-offset-2"
				>
				  Q-Scores
				</a> normalize performance across age groups and weight classes. Higher scores indicate better performance.
			  </p>
			  
              <ResponsiveContainer width="100%" height={500}>
			    <LineChart 
				  data={chartData} 
				  margin={{ top: 20, right: 50, left: 20, bottom: 20 }}
				  onMouseMove={(e) => {
				    if (e && e.activeLabel && !showQScoresBrush) {
					  setQScoresMouseX(Number(e.activeLabel));
				    }
				  }}
				  onMouseLeave={() => setQScoresMouseX(null)}
			    >
				  {qScoresMouseX && !showQScoresBrush && (
				    <ReferenceLine 
					  x={qScoresMouseX} 
					  stroke="var(--text-muted)" 
					  strokeWidth={1}
					  strokeDasharray="2 2"
					  strokeOpacity={0.6}
				    />
				  )}
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis 
                    type="number"
                    dataKey="timestamp"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    stroke="var(--chart-axis)"
                    fontSize={11}
                    tickFormatter={(timestamp) => {
                      const date = new Date(timestamp);
                      const year = date.getFullYear().toString().slice(-2);
                      return `Jan '${year}`;
                    }}
                    padding={{ left: 10, right: 10 }}
                    ticks={(() => {
                      if (chartData.length === 0) return [];
                      const minYear = new Date(Math.min(...chartData.map(d => d.timestamp))).getFullYear();
                      const maxYear = new Date(Math.max(...chartData.map(d => d.timestamp))).getFullYear();
                      const ticks = [];
                      for (let year = minYear - 1; year <= maxYear + 1; year++) {
                        ticks.push(new Date(year, 0, 1).getTime());
                      }
                      return ticks;
                    })()}
                    allowDataOverflow={true}
                    label={{ 
                      value: 'Competition Date (Competition Age)', 
                      position: 'insideBottom', 
                      offset: -5, 
                      style: { 
                        textAnchor: 'middle', 
                        fill: 'var(--chart-axis)',
                        fontSize: '12px'
                      } 
                    }}
                  />
                  <YAxis 
                    stroke="var(--chart-axis)"
                    fontSize={12}
                    domain={autoScaleQScores ? ['dataMin - 10', 'dataMax + 10'] : [0, 'dataMax + 5']}
                    allowDataOverflow={true}
                    label={{ 
                      value: 'Q-Score', 
                      angle: -90, 
                      position: 'insideLeft', 
                      style: { 
                        textAnchor: 'middle', 
                        fill: 'var(--chart-axis)',
                        fontSize: '12px'
                      } 
                    }}
                  />
                  {!showQScoresBrush && (
                    <Tooltip 
					  contentStyle={{ 
						backgroundColor: 'var(--chart-tooltip-bg)', 
						border: '1px solid var(--chart-tooltip-border)',
						borderRadius: '8px',
						color: 'var(--text-primary)',
						fontSize: '14px',
						padding: '12px',
						boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', // Add shadow to create separation
						backdropFilter: 'blur(8px)', // Blur what's behind it
					}}
					wrapperStyle={{
						zIndex: 9999,
						backgroundColor: 'rgba(0, 0, 0, 0.1)', // Semi-transparent backdrop
						borderRadius: '12px',
						padding: '4px' // Padding around the tooltip
					}}
                    formatter={(value: any, name: string) => {
                      if (!value && value !== 0) return ['-', name];
                      if (typeof value === 'number') {
                        if (name === 'qpoints') return [value.toFixed(1), 'Q-Points'];
                        if (name === 'qYouth') return [value.toFixed(1), 'Q-Youth'];
                        if (name === 'qMasters') return [value.toFixed(1), 'Q-Masters'];
                        return [value.toFixed(1), name];
                      } else {
                        return [String(value), name];
                      }
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0] && payload[0].payload) {
                        const data = payload[0].payload;
                        return `${data.meet} - ${data.dateWithAge}`;
                      }
                      return `Competition: ${new Date(label).toLocaleDateString()}`;
                    }}
                    cursor={false}
                    animationDuration={150}
                    allowEscapeViewBox={{ x: false, y: true }}
                    position={{ x: undefined, y: undefined }}
                  />
                  )}
                  {showQPoints && (
					  <>
						<Line 
						  dataKey="qpointsBackground"
						  stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
						<Line dataKey="qpoints" stroke="var(--chart-qpoints)" strokeWidth={2.5} dot={{ 
						  fill: 'var(--chart-qpoints)', 
						  stroke: 'var(--chart-stroke)',
						  strokeWidth: 0.5, 
						  r: 5,
						  style: { cursor: 'pointer' }
						}}
						activeDot={{ 
						  r: 8, 
						  stroke: 'var(--chart-stroke)', 
						  strokeWidth: 2, 
						  fill: 'var(--chart-qpoints)',
						  style: { cursor: 'pointer' }
						}}
						name="qpoints"
						connectNulls={false}
                        />
					  </>
					)}

					{showQYouth && chartData.some(d => d.qYouth) && (
					  <>
						<Line 
						  dataKey="qYouthBackground"
						  stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
						<Line dataKey="qYouth" stroke="var(--chart-qyouth)" strokeWidth={2.5} dot={{ 
							  fill: 'var(--chart-qyouth)', 
							  stroke: 'var(--chart-stroke)',
							  strokeWidth: 0.5, 
							  r: 5,
							  style: { cursor: 'pointer' }
							}}
							activeDot={{ 
							  r: 8, 
							  stroke: 'var(--chart-stroke)', 
							  strokeWidth: 2, 
							  fill: 'var(--chart-qyouth)',
							  style: { cursor: 'pointer' }
							}}
							name="qYouth"
							connectNulls={false}
						/>
					  </>
					)}

					{showQMasters && chartData.some(d => d.qMasters) && (
					  <>
						<Line 
						  dataKey="qMastersBackground"
						  stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
						<Line dataKey="qMasters" stroke="var(--chart-qmasters)" strokeWidth={2.5} dot={{ 
							  fill: 'var(--chart-qmasters)', 
							  stroke: 'var(--chart-stroke)',
							  strokeWidth: 0.5, 
							  r: 5,
							  style: { cursor: 'pointer' }
							}}
							activeDot={{ 
							  r: 8, 
							  stroke: 'var(--chart-stroke)', 
							  strokeWidth: 2, 
							  fill: 'var(--chart-qmasters)',
							  style: { cursor: 'pointer' }
							}}
							name="qMasters"
							connectNulls={false}
						/>
					  </>
				    )}
                  {showQScoresBrush && (
                    <Brush 
                      key="q-scores-brush"
                      dataKey="timestamp" 
                      height={20}
                      y={500 - 20}
                      stroke="var(--text-disabled)"
                      fill="var(--chart-grid)"
                      fillOpacity={0.6}
                      tickFormatter={(timestamp) => {
                        const date = new Date(timestamp);
                        const year = date.getFullYear().toString().slice(-0);
                        return year;
                      }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
			  
			  <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-app-secondary">
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-qpoints)]"></div>
					<span className="text-sm text-app-secondary">Q-Points</span>
				  </div>
				  {legendFlags.hasQYouth && (
					<div className="flex items-center space-x-2">
					  <div className="w-4 h-0.5 bg-[var(--chart-qyouth)]"></div>
					  <span className="text-sm text-app-secondary">Q-Youth</span>
					</div>
				  )}
				  {legendFlags.hasQMasters && (
					<div className="flex items-center space-x-2">
					  <div className="w-4 h-0.5 bg-[var(--chart-qmasters)]"></div>
					  <span className="text-sm text-app-secondary">Q-Masters</span>
					</div>
				  )}
              </div>

            </div>
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
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {displayResults.map((result, index) => {
                        const bestQScore = getBestQScore(result);

                        return (
                          <tr key={index} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                            {showAllColumns ? (
                              <>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                <td className="px-2 py-1 max-w-20 text-xs">
                                  <button
                                    onClick={() => router.push(`/meet/iwf/${result.meet_id}`)}
                                    className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left"
                                    title={result.meet_name}
                                  >
                                    {result.meet_name}
                                  </button>
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
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-qyouth)' }}>{result.q_youth || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-qpoints)' }}>{result.qpoints || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={{ color: 'var(--chart-qmasters)' }}>{result.q_masters || '-'}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                <td className="px-2 py-1 max-w-xs text-xs">
                                  <button
                                    onClick={() => router.push(`/meet/iwf/${result.meet_id}`)}
                                    className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left"
                                    title={result.meet_name}
                                  >
                                    {result.meet_name}
                                  </button>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs">{result.weight_class || '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-snatch)' }}>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-semibold" style={{ color: 'var(--chart-cleanjerk)' }}>{result.best_cj ? `${result.best_cj}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs font-bold" style={{ color: 'var(--chart-total)' }}>{result.total ? `${result.total}kg` : '-'}</td>
                                <td className="px-2 py-1 whitespace-nowrap text-xs" style={bestQScore.style}>{bestQScore.value || '-'}</td>
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
