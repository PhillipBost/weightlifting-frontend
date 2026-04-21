"use client";

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { AthleteHeader } from './AthleteHeader';
import { AthleteBests } from './AthleteBests';
import { AthleteCharts } from './AthleteCharts';
import { AthleteResults } from './AthleteResults';
import { adaptIWFResult } from '@/lib/adapters/iwfAdapter';
import { HeaderSkeleton, BestsSkeleton, ChartsSkeleton, ResultsSkeleton } from './AthleteSkeleton';
import { DisambiguationUI } from './DisambiguationUI';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch athlete data');
  }
  return res.json();
};

interface AthleteProfileWrapperProps {
  id: string;
  initialData?: any;
  forceIwfMode?: boolean;
}

/**
 * DETERMINISTIC HYDRATION WRAPPER (Chunk 3 & 4)
 * -------------------------------------------
 * This component handles the high-performance hydration path.
 * It fetches the consolidated JSON and maps it to the UI components
 * using the production-verified data adapter logic.
 */
export function AthleteProfileWrapper({ id, initialData, forceIwfMode = false }: AthleteProfileWrapperProps) {
  const { data: athleteData, error, isLoading } = useSWR(`/api/athlete/${encodeURIComponent(id)}`, fetcher, {
    fallbackData: initialData,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateOnMount: !initialData,
    refreshInterval: 0,
    dedupingInterval: 60000,
    keepPreviousData: true,
  });

  const [showIwfResults, setShowIwfResults] = useState(forceIwfMode);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  const results = useMemo(() => {
    if (!athleteData) return [];
    
    const usaw = (athleteData.usaw_results || []).map((r: any, idx: number) => ({
      ...r,
      _source: 'USAW',
      // Phase 4.5 Shards now include native 'id' and 'meets'
      meets: r.meets || { Level: r.level || 'Unknown' },
      key: r.id || `usaw-${r.date}-${r.total}-${idx}`
    }));

    const iwf = (athleteData.iwf_results || []).map((r: any, idx: number) => ({
      ...adaptIWFResult(r),
      _source: 'IWF',
      // Phase 4.5 Shards provide native 'id', fallback to index-based key
      key: r.id || `iwf-${r.date}-${r.total}-${idx}`
    }));

    // Results are largely pre-merged by the Phase 4.5 Assembler,
    // so we just combine and Sort.
    const shouldShowCombined = forceIwfMode ? !showIwfResults : showIwfResults;

    if (!shouldShowCombined) {
      return forceIwfMode ? iwf : usaw;
    }
    
    return [...usaw, ...iwf].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [athleteData, showIwfResults, forceIwfMode]);

  // --- TOP-DOWN STABLE HYDRATION ORCHESTRATOR ---
  const [renderStep, setRenderStep] = React.useState(0);

  React.useEffect(() => {
    if (athleteData) {
      // Step 1: Header + Bests (Fast)
      const timer1 = setTimeout(() => {
        setRenderStep(prev => Math.max(prev, 1));
      }, 50);

      // Step 2: Charts Area (Mounts highcharts dynamic containers)
      const timer2 = setTimeout(() => {
        setRenderStep(prev => Math.max(prev, 2));
      }, 400);

      // Step 3: Results Table (Mounts long list at bottom)
      const timer3 = setTimeout(() => {
        setRenderStep(prev => Math.max(prev, 3));
      }, 800);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [athleteData]);

  // 2. Chart Transformation (Preserving Hover Logic)

  // 2. Chart Transformation (Preserving Hover Logic)
  const chartData = useMemo(() => {
    if (!results.length) return [];

    return results
      .filter((r: any) => r.date && (r.best_snatch || r.best_cj || r.total || r.qpoints))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((r: any) => {
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
          gamxTotal: r.gamx_total || null,
          gamxS: r.gamx_s || null,
          gamxJ: r.gamx_j || null,
          gamxU: r.gamx_u || null,
          gamxA: r.gamx_a || null,
          gamxMasters: r.gamx_masters || null,
          shortDate: new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          // Fidelity: Restore the competition age string for tooltips
          dateWithAge: r.competition_age
            ? `${new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${r.competition_age})`
            : new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          timestamp: new Date(r.date).getTime()
        };

        // Fidelity: Map Snatch Attempts (Good/Miss)
        [r.snatch_lift_1, r.snatch_lift_2, r.snatch_lift_3].forEach((att, i) => {
          if (att && att !== '0') {
            const w = parseInt(att);
            w > 0 ? (baseData[`snatchGood${i + 1}`] = w) : (baseData[`snatchMiss${i + 1}`] = Math.abs(w));
          }
        });

        // Fidelity: Map CJ Attempts (Good/Miss)
        [r.cj_lift_1, r.cj_lift_2, r.cj_lift_3].forEach((att, i) => {
          if (att && att !== '0') {
            const w = parseInt(att);
            w > 0 ? (baseData[`cjGood${i + 1}`] = w) : (baseData[`cjMiss${i + 1}`] = Math.abs(w));
          }
        });

        return baseData;
      });
  }, [results]);

  // 3. Metadata Extraction (High-Speed Initial Paint)
  const athlete = useMemo(() => {
    if (!athleteData) return null;
    return {
      athlete_name: athleteData.athlete_name,
      usaw_name: athleteData.usaw_name,
      iwf_name: athleteData.iwf_name,
      displayName: forceIwfMode ? (athleteData.iwf_name || athleteData.athlete_name) : (athleteData.usaw_name || athleteData.athlete_name),
      membership_number: athleteData.membership_number,
      gender: athleteData.gender,
      nation_code: athleteData.country_code,
      nation: athleteData.country_name,
      internal_id: athleteData.internal_id,
      internal_id_2: athleteData.internal_id_2,
      iwf_profiles: (athleteData.iwf_profiles || []).map((p: any) => ({
        ...p,
        url: p.url || `https://iwf.sport/weightlifting_/athletes-bios/?athlete_id=${p.id}`
      }))
    };
  }, [athleteData]);

  const personalBests = useMemo(() => {
    if (!results.length) return { 
      best_snatch: { value: 0, date: null }, 
      best_cj: { value: 0, date: null }, 
      best_total: { value: 0, date: null }, 
      best_q: { value: 0, label: 'N/A', color: 'var(--chart-qpoints)', date: null },
      best_gamx: { value: 0, label: 'N/A', color: 'var(--chart-gamx-total)', date: null }
    };

    const findBest = (list: any[], field: string) => {
      if (!list?.length) return null;
      return [...list]
        .filter(r => (parseFloat(r[field]) || 0) > 0)
        .sort((a, b) => {
          const valA = parseFloat(a[field]) || 0;
          const valB = parseFloat(b[field]) || 0;
          if (valB !== valA) return valB - valA;
          // Tie-break: most recent
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        })[0] || null;
    };

    const bestSnatchObj = findBest(results, 'best_snatch');
    const bestCJObj = findBest(results, 'best_cj');
    const bestTotalObj = findBest(results, 'total');

    // Q-Score Logic (Points, Youth, Masters)
    const qScores = results.flatMap((r: any) => [
      { value: parseFloat(r.qpoints) || 0, label: 'Q-Points', color: 'var(--chart-qpoints)', date: r.date },
      { value: parseFloat(r.q_youth) || 0, label: 'Q-Youth', color: 'var(--chart-qyouth)', date: r.date },
      { value: parseFloat(r.q_masters) || 0, label: 'Q-Masters', color: 'var(--chart-qmasters)', date: r.date }
    ]);
    const bestQ = qScores.reduce((prev: any, curr: any) => (curr.value > prev.value) ? curr : prev, { value: 0, label: 'N/A', color: 'var(--chart-qpoints)', date: null });

    // GAMX Logic (Total, S, J, U, A, Masters)
    const gamxScores = results.flatMap((r: any) => [
      { value: parseFloat(r.gamx_total) || 0, label: 'GAMX-Total', color: 'var(--chart-gamx-total)', date: r.date },
      { value: parseFloat(r.gamx_s) || 0, label: 'GAMX-S', color: 'var(--chart-gamx-s)', date: r.date },
      { value: parseFloat(r.gamx_j) || 0, label: 'GAMX-J', color: 'var(--chart-gamx-j)', date: r.date },
      { value: parseFloat(r.gamx_u) || 0, label: 'GAMX-U', color: 'var(--chart-gamx-u)', date: r.date },
      { value: parseFloat(r.gamx_a) || 0, label: 'GAMX-A', color: 'var(--chart-gamx-a)', date: r.date },
      { value: parseFloat(r.gamx_masters) || 0, label: 'GAMX-Masters', color: 'var(--chart-gamx-masters)', date: r.date }
    ]);
    const bestGamx = gamxScores.reduce((prev: any, curr: any) => (curr.value > prev.value) ? curr : prev, { value: 0, label: 'N/A', color: 'var(--chart-gamx-total)', date: null });

    return {
      best_snatch: { value: parseFloat(bestSnatchObj?.best_snatch) || 0, date: bestSnatchObj?.date || null },
      best_cj: { value: parseFloat(bestCJObj?.best_cj) || 0, date: bestCJObj?.date || null },
      best_total: { value: parseFloat(bestTotalObj?.total) || 0, date: bestTotalObj?.date || null },
      best_q: bestQ,
      best_gamx: bestGamx
    };
  }, [results]);

  const recentInfo = useMemo(() => {
    if (!athleteData) return { wso: null, club: null };
    // Production Fallback: JSON root metadata -> recent result array
    return {
      wso: athleteData.wso || results.find((r: any) => r.wso && r.wso.trim() !== '')?.wso || null,
      club: athleteData.club_name || results.find((r: any) => r.club_name && r.club_name.trim() !== '')?.club_name || null
    };
  }, [athleteData, results]);

  const legendFlags = useMemo(() => ({
    hasQYouth: chartData?.some((d: any) => d.qYouth && d.qYouth > 0) || false,
    hasQMasters: chartData?.some((d: any) => d.qMasters && d.qMasters > 0) || false,
    hasGamxTotal: chartData?.some((d: any) => d.gamxTotal !== null) || false,
    hasGamxS: chartData?.some((d: any) => d.gamxS !== null) || false,
    hasGamxJ: chartData?.some((d: any) => d.gamxJ !== null) || false,
    hasGamxU: chartData?.some((d: any) => d.gamxU !== null) || false,
    hasGamxA: chartData?.some((d: any) => d.gamxA !== null) || false,
    hasGamxMasters: chartData?.some((d: any) => d.gamxMasters !== null) || false,
  }), [chartData]);

  // 3. Sorting & Pagination Logic
  const getSortableValue = (result: any, key: string): any => {
    switch (key) {
      case 'date': return new Date(result.date).getTime();
      case 'meet_name': return result.meet_name?.toLowerCase() || '';
      case 'level': return result.meets?.Level?.toLowerCase() || '';
      case 'weight_class': {
        const weightMatch = result.weight_class?.toString().match(/(\d+)/);
        return weightMatch ? parseInt(weightMatch[1]) : 0;
      }
      case 'body_weight_kg': return parseFloat(result.body_weight_kg) || 0;
      case 'best_snatch': return parseInt(result.best_snatch) || 0;
      case 'best_cj': return parseInt(result.best_cj) || 0;
      case 'total': return parseInt(result.total) || 0;
      default: return '';
    }
  };

  const { displayResults, totalPages } = useMemo(() => {
    let sorted = [...results];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        const aVal = getSortableValue(a, sortConfig.key!);
        const bVal = getSortableValue(b, sortConfig.key!);
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    const startIndex = (currentPage - 1) * 20;
    return {
      displayResults: sorted.slice(startIndex, startIndex + 20),
      totalPages: Math.ceil(sorted.length / 20)
    };
  }, [currentPage, results, sortConfig]);

  // 1. DISAMBIGUATION PATH: Catch multiple matches immediately
  if (athleteData?.isAmbiguous) {
    return <DisambiguationUI name={id.replace(/-/g, ' ')} candidates={athleteData.candidates} />;
  }

  // 2. Final Fallback: Error or Invalid Data
  if (error || (athleteData === null && !isLoading)) return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="card-results p-12 text-center">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Profile Unavailable</h2>
        <p className="text-app-muted mb-6">We could not load this athlete profile. This may be due to a record naming mismatch or a temporary database connection issue.</p>
        <button onClick={() => window.location.reload()} className="btn-primary">Try Again</button>
      </div>
    </div>
  );

  // Data Readiness Guard: If data is arriving but the mapping isn't complete, show base skeleton
  if (isLoading || !athlete || !athleteData) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <HeaderSkeleton />
        <ChartsSkeleton />
        <BestsSkeleton />
        <ResultsSkeleton />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-app-gradient">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* STEP 1: HEADER & BESTS */}
          {renderStep >= 1 ? (
            <>
              <AthleteHeader 
                athlete={athlete} 
                recentInfo={recentInfo} 
                iwfProfiles={athlete.iwf_profiles || []}
                iwfResults={athleteData.iwf_results || []} 
                showIwfResults={showIwfResults} 
                setShowIwfResults={setShowIwfResults} 
                forceIwfMode={forceIwfMode}
                currentIwfId={id}
              />
              <AthleteBests personalBests={personalBests} />
            </>
          ) : (
            <>
              <HeaderSkeleton />
              <BestsSkeleton />
            </>
          )}
          
          {/* STEP 2: CHARTS (HEAVY RE-RENDER) */}
          {renderStep >= 2 ? (
            <AthleteCharts 
              chartData={chartData} 
              athlete={athlete} 
              legendFlags={legendFlags} 
            />
          ) : (
            <ChartsSkeleton />
          )}

          {/* STEP 3: RESULTS TABLE (THE HYDRATION TAX) */}
          {renderStep >= 3 ? (
            <AthleteResults 
              athlete={athlete} 
              results={results}
              displayResults={displayResults}
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={(page) => {
                setCurrentPage(page);
                document.querySelector('.results-table')?.scrollIntoView({ behavior: 'smooth' });
              }}
              sortConfig={sortConfig}
              handleSort={(key) => {
                const dir = (sortConfig.key === key && sortConfig.direction === 'asc') ? 'desc' : 'asc';
                setSortConfig({ key, direction: dir });
                setCurrentPage(1);
              }}
              showAllColumns={showAllColumns}
              setShowAllColumns={setShowAllColumns}
              isMixedResults={forceIwfMode ? !showIwfResults : showIwfResults}
            />
          ) : (
            <ResultsSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
