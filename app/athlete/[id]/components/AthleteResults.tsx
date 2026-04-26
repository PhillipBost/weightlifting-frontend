"use client";

import React, { useRef } from 'react';
import Link from 'next/link';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';

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
      link.setAttribute('download', `${athleteName?.replace(/\s+/g, '_')}_competition_results.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error export CSV:', error);
    alert('Failed to export CSV. Please try again.');
  }
};

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

interface AthleteResultsProps {
  athlete: any;
  results: any[];
  displayResults: any[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  sortConfig: any;
  handleSort: (key: string) => void;
  showAllColumns: boolean;
  setShowAllColumns: (show: boolean) => void;
  isMixedResults: boolean;
}

export function AthleteResults({
  athlete,
  results,
  displayResults,
  totalPages,
  currentPage,
  onPageChange,
  sortConfig,
  handleSort,
  showAllColumns,
  setShowAllColumns,
  isMixedResults
}: AthleteResultsProps) {
  const resultsTableRef = useRef<HTMLDivElement>(null);

  if (!athlete) return null;

  return (
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
                      <tr key={result.key} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors" style={{ borderTopColor: 'var(--border-secondary)' }}>
                        {showAllColumns ? (
                          <>
                            <td className="px-2 py-1 whitespace-nowrap text-xs">{new Date(result.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                            <td className="px-2 py-1 max-w-20 text-xs">
                              <Link
                                href={result._source === 'IWF' ? `/meet/iwf/${result.meet_id || result.db_meet_id || result.iwf_meet_id}` : `/meet/${result.meet_id}`}
                                className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left hover:underline"
                                title={result.meet_name}
                              >
                                {result.meet_name}
                                {isMixedResults && result._source === 'IWF' && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400 border border-red-800/50">
                                    IWF
                                  </span>
                                )}
                                {isMixedResults && result._source === 'USAW' && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/30 text-blue-400 border border-blue-800/50">
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
                                href={result._source === 'IWF' ? `/meet/iwf/${result.meet_id || result.db_meet_id || result.iwf_meet_id}` : `/meet/${result.meet_id}`}
                                className="text-accent-primary hover:text-accent-primary-hover transition-colors truncate max-w-full block text-left hover:underline"
                                title={result.meet_name}
                              >
                                {result.meet_name}
                                {isMixedResults && result._source === 'IWF' && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400 border border-red-800/50">
                                    IWF
                                  </span>
                                )}
                                {isMixedResults && result._source === 'USAW' && (
                                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-900/30 text-blue-400 border border-blue-800/50">
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
              onPageChange={onPageChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
