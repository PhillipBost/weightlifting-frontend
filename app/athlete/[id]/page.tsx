"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Trophy, Calendar, Weight, TrendingUp, Medal, User, Building, MapPin, ExternalLink, ArrowLeft, BarChart3, Dumbbell, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, Brush } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';

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
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </button>

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

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </button>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [autoScalePerformance, setAutoScalePerformance] = useState(true);
  const [showPerformanceBrush, setShowPerformanceBrush] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [autoScaleQScores, setAutoScaleQScores] = useState(true);
  const [showQScoresBrush, setShowQScoresBrush] = useState(false);
  
  // Add sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  
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

        if (!isNaN(Number(resolvedParams.id))) {
          const result = await supabase
            .from('lifters')
            .select('*')
            .eq('membership_number', parseInt(resolvedParams.id))
            .single();
          
          athleteData = result.data;
          athleteError = result.error;
        } 
        
        if (!athleteData) {
          const nameFromSlug = resolvedParams.id
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

          const result = await supabase
            .from('lifters')
            .select('*')
            .ilike('athlete_name', nameFromSlug)
            .single();
          
          athleteData = result.data;
          athleteError = result.error;
        }

        if (athleteError || !athleteData) {
          throw new Error('Athlete not found');
        }

        const { data: resultsData, error: resultsError } = await supabase
		  .from('meet_results')
		  .select(`
			*,
			meets!inner("Level")
		  `)
		  .eq('lifter_id', athleteData.lifter_id)
		  .order('date', { ascending: false });

        if (resultsError) throw resultsError;

        setAthlete(athleteData);
        setResults(resultsData || []);
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
    const recentWso = sortedResults.find(r => r.wso && typeof r.wso === 'string' && r.wso.trim() !== '')?.wso || athlete.wso;
    const recentClub = sortedResults.find(r => r.club_name && typeof r.club_name === 'string' && r.club_name.trim() !== '')?.club_name || athlete.club_name;
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
      {/* Header */}
      <header className="bg-header-blur border-b border-app-secondary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
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
              {athlete && athlete.internal_id && (
                <button
                  onClick={() => window.open(`https://usaweightlifting.sport80.com/public/rankings/member/${athlete.internal_id}`, '_blank')}
                  className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>External Profile</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            </div>
          </div>
        </div>

        {/* Performance Charts */}
        {chartData.length > 1 && (
          <div className="space-y-8 mb-8">
            {/* Progress Over Time Chart */}
            <div className="chart-container" ref={performanceChartRef}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-app-primary flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  {athlete.athlete_name} Performance Progress
                </h3>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setAutoScalePerformance(!autoScalePerformance)}
                    className={`btn-secondary ${
                      autoScalePerformance 
                        ? 'bg-app-surface text-app-secondary hover:bg-app-hover' 
                        : 'bg-accent-primary text-app-primary'
                    }`}
                  >
                    {autoScalePerformance ? 'Fixed Scale' : 'Auto Scale'}
                  </button>
                  <button
                    onClick={() => setShowPerformanceBrush(!showPerformanceBrush)}
                    className={`btn-secondary ${
                      showPerformanceBrush 
                        ? 'bg-accent-primary text-app-primary' 
                        : 'bg-app-surface text-app-secondary hover:bg-app-hover'
                    }`}
                  >
                    {showPerformanceBrush ? 'Hide Zoom' : 'Show Zoom'}
                  </button>
                </div>
              </div>
			  
			  <p className="text-sm text-app-muted mb-4">
				Lifting performance over time.
			  </p>
			  
              <ResponsiveContainer width="100%" height={500}>
                <LineChart 
                  data={chartData} 
                  margin={{ top: 20, right: 50, left: 20, bottom: 20 }}
                >
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
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--chart-tooltip-bg)', 
                      border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      padding: '12px'
                    }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        
                        return (
                          <div className="bg-app-secondary border border-app-primary rounded-lg p-3">
                            <p className="text-app-primary font-medium mb-2">{`${data.meet} - ${data.dateWithAge}`}</p>
                            
                            <p style={{ color: 'var(--chart-cleanjerk)' }}>
                              Clean & Jerk: {data.cleanJerk ? `${data.cleanJerk}kg` : '-'}
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
                              Snatch: {data.snatch ? `${data.snatch}kg` : '-'}
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
                            
                            {data.total && (
                              <p style={{ color: 'var(--chart-total)' }}>
                                Total: {data.total}kg
                              </p>
                            )}
                            
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
                  <Line 
					dataKey="snatch"
					stroke="var(--chart-stroke)" 
					strokeWidth={3}
					dot={false}
					activeDot={false}
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
                  {[1, 2, 3].map(attemptNum => (
                    <Line
                      key={`snatch-good-${attemptNum}`}
                      type="monotone"
                      dataKey={`snatchGood${attemptNum}`}
                      stroke="none"
                      dot={{
                        fill: 'var(--chart-snatch)',
                        fillOpacity: 0.5,
                        stroke: 'var(--chart-snatch)',
                        strokeOpacity: 0.7,
                        strokeWidth: 1,
                        r: 3
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
                        fill: 'var(--chart-failed)',
                        fillOpacity: 0.5,
                        stroke: 'var(--chart-failed)',
                        strokeOpacity: 0.7,
                        strokeWidth: 1,
                        r: 3
                      }}
                      activeDot={false}
					  connectNulls={false}
                      legendType="none"
                    />
                  ))}
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
                  {[1, 2, 3].map(attemptNum => (
                    <Line
                      key={`cj-good-${attemptNum}`}
                      type="monotone"
                      dataKey={`cjGood${attemptNum}`}
                      stroke="none"
                      dot={{
                        fill: 'var(--chart-cleanjerk)',
                        fillOpacity: 0.5,
                        stroke: 'var(--chart-cleanjerk)',
                        strokeOpacity: 0.7,
                        strokeWidth: 1,
                        r: 3
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
                        fill: 'var(--chart-failed)',
                        fillOpacity: 0.5,
                        stroke: 'var(--chart-failed)',
                        strokeOpacity: 0.7,
                        strokeWidth: 1,
                        r: 3
                      }}
                      activeDot={false}
					  connectNulls={false}
                      legendType="none"
                    />
                  ))}
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
					<div className="w-2 h-2 rounded-full bg-[var(--chart-snatch)] opacity-50 border border-[var(--chart-snatch)]"></div>
					<span className="text-app-secondary">Snatch attempts</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-2 h-2 rounded-full bg-[var(--chart-cleanjerk)] opacity-50 border border-[var(--chart-cleanjerk)]"></div>
					<span className="text-app-secondary">C&J attempts</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-2 h-2 rounded-full bg-[var(--chart-failed)] opacity-50 border border-[var(--chart-failed)]"></div>
					<span className="text-app-secondary">Failed attempts</span>
				  </div>
			  </div>
			  
            </div>

            {/* Q-Points Chart */}
            <div className="chart-container" ref={qScoresChartRef}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-app-primary flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  {athlete.athlete_name} Q-Scores Over Time
                </h3>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setAutoScaleQScores(!autoScaleQScores)}
                    className={`btn-secondary ${
                      autoScaleQScores 
                        ? 'bg-app-surface text-app-secondary hover:bg-app-hover' 
                        : 'bg-accent-primary text-app-primary'
                    }`}
                  >
                    {autoScaleQScores ? 'Fixed Scale' : 'Auto Scale'}
                  </button>
                  <button
                    onClick={() => setShowQScoresBrush(!showQScoresBrush)}
                    className={`btn-secondary ${
                      showQScoresBrush 
                        ? 'bg-accent-primary text-app-primary' 
                        : 'bg-app-surface text-app-secondary hover:bg-app-hover'
                    }`}
                  >
                    {showQScoresBrush ? 'Hide Zoom' : 'Show Zoom'}
                  </button>
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
                >
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
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--chart-tooltip-bg)', 
                      border: '1px solid var(--chart-tooltip-border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      padding: '12px'
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
                  <Line 
					dataKey="qpoints" 
					stroke="var(--chart-stroke)" 
					strokeWidth={3}
					dot={false}
					activeDot={false}
				  />
                  <Line 
					dataKey="qpoints" 
					stroke="var(--chart-qpoints)" 
					strokeWidth={2.5}  
					dot={{ 
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
                  {chartData.some(d => d.qYouth) && (
                    <>
						<Line 
							dataKey="qYouth" 
							stroke="var(--chart-stroke)" 
							strokeWidth={3}
							dot={false}
							activeDot={false}
						/>
						<Line 
							dataKey="qYouth" 
							stroke="var(--chart-qyouth)" 
							strokeWidth={2.5}  
							dot={{ 
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
                  {chartData.some(d => d.qMasters) && (
                    <>
						<Line 
							dataKey="qMasters" 
							stroke="var(--chart-stroke)" 
							strokeWidth={3}
							dot={false}
							activeDot={false}
						/>
						<Line 
							dataKey="qMasters" 
							stroke="var(--chart-qmasters)" 
							strokeWidth={2.5}  
							dot={{ 
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
                </LineChart>
              </ResponsiveContainer>
			  
			  <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-app-secondary">
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-qpoints)]"></div>
					<span className="text-sm text-app-secondary">Q-Points</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-qyouth)]"></div>
					<span className="text-sm text-app-secondary">Q-Youth</span>
				  </div>
				  <div className="flex items-center space-x-2">
					<div className="w-4 h-0.5 bg-[var(--chart-qmasters)]"></div>
					<span className="text-sm text-app-secondary">Q-Masters</span>
				  </div>
			  </div>
			  
            </div>
          </div>
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
                  <table className="w-full text-xs text-left text-app-secondary">
                    <thead className="text-xs text-app-muted uppercase bg-app-tertiary">
                      <tr>
                        {showAllColumns ? (
                          <>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('date')}
                            >
                              Date
                              <SortIcon column="date" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('meet_name')}
                            >
                              Meet
                              <SortIcon column="meet_name" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('level')}
                            >
                              Level
                              <SortIcon column="level" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('wso')}
                            >
                              WSO
                              <SortIcon column="wso" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('club_name')}
                            >
                              Club
                              <SortIcon column="club_name" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('age_category')}
                            >
                              Age Category
                              <SortIcon column="age_category" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('weight_class')}
                            >
                              Weight Class
                              <SortIcon column="weight_class" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('body_weight_kg')}
                            >
                              Body Weight
                              <SortIcon column="body_weight_kg" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('competition_age')}
                            >
                              Comp Age
                              <SortIcon column="competition_age" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-3">Sn 1</th>
                            <th scope="col" className="px-2 py-3">Sn 2</th>
                            <th scope="col" className="px-2 py-3">Sn 3</th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_snatch')}
                            >
                              Best Sn
                              <SortIcon column="best_snatch" sortConfig={sortConfig} />
                            </th>
                            <th scope="col" className="px-2 py-3">CJ 1</th>
                            <th scope="col" className="px-2 py-3">CJ 2</th>
                            <th scope="col" className="px-2 py-3">CJ 3</th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_cj')}
                            >
                              Best CJ
                              <SortIcon column="best_cj" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('total')}
                            >
                              Total
                              <SortIcon column="total" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('q_youth')}
                            >
                              Q-Youth
                              <SortIcon column="q_youth" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('qpoints')}
                            >
                              Q-Points
                              <SortIcon column="qpoints" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
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
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('date')}
                            >
                              Date
                              <SortIcon column="date" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('meet_name')}
                            >
                              Meet
                              <SortIcon column="meet_name" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('weight_class')}
                            >
                              Weight Class
                              <SortIcon column="weight_class" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_snatch')}
                            >
                              Best Sn
                              <SortIcon column="best_snatch" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_cj')}
                            >
                              Best CJ
                              <SortIcon column="best_cj" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('total')}
                            >
                              Total
                              <SortIcon column="total" sortConfig={sortConfig} />
                            </th>
                            <th 
                              scope="col" 
                              className="px-2 py-3 cursor-pointer hover:bg-app-surface transition-colors select-none"
                              onClick={() => handleSort('best_q_score')}
                            >
                              Best Q-Score
                              <SortIcon column="best_q_score" sortConfig={sortConfig} />
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {displayResults.map((result, index) => {
                        const bestQScore = getBestQScore(result);
                        
                        return (
                          <tr key={index} className="bg-app-secondary border-b border-app-secondary hover:bg-app-tertiary">
                            {showAllColumns ? (
                              <>
                                <td className="px-2 py-3 whitespace-nowrap">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                <td className="px-2 py-3 max-w-20 truncate" title={result.meet_name}>{result.meet_name}</td>
								<td className="px-2 py-3 whitespace-nowrap">{result.meets?.Level || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.wso || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.club_name || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.age_category || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.weight_class || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--chart-bodyweight)' }}>{result.body_weight_kg ? `${result.body_weight_kg}kg` : '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.competition_age || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.snatch_lift_1 || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.snatch_lift_2 || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.snatch_lift_3 || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--chart-snatch)' }}>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.cj_lift_1 || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.cj_lift_2 || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.cj_lift_3 || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--chart-cleanjerk)' }}>{result.best_cj ? `${result.best_cj}kg` : '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap font-bold" style={{ color: 'var(--chart-total)' }}>{result.total ? `${result.total}kg` : '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--chart-qyouth)' }}>{result.q_youth || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--chart-qpoints)' }}>{result.qpoints || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap" style={{ color: 'var(--chart-qmasters)' }}>{result.q_masters || '-'}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-3 whitespace-nowrap">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                <td className="px-2 py-3 max-w-xs truncate" title={result.meet_name}>{result.meet_name}</td>
                                <td className="px-2 py-3 whitespace-nowrap">{result.weight_class || '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--chart-snatch)' }}>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap font-semibold" style={{ color: 'var(--chart-cleanjerk)' }}>{result.best_cj ? `${result.best_cj}kg` : '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap font-bold" style={{ color: 'var(--chart-total)' }}>{result.total ? `${result.total}kg` : '-'}</td>
                                <td className="px-2 py-3 whitespace-nowrap" style={bestQScore.style}>{bestQScore.value || '-'}</td>
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