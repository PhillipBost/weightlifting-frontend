'use client';

import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  Zap, 
  KeyRound, 
  Brain, 
  Percent, 
  Activity, 
  Lightbulb, 
  Crosshair, 
  Scale, 
  TrendingDown, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Flame, 
  Shield, 
  History, 
  ChevronDown,
  Users,
  RotateCcw,
  Calendar,
  ShieldCheck
} from 'lucide-react';
import { MetricTooltip } from './MetricTooltip';
import { usePopulationStats } from '../hooks/usePopulationStats';

interface AttemptData {
  lift1?: string | null;
  lift2?: string | null;
  lift3?: string | null;
  best?: string | null;
}

interface CompetitionResult {
  date: string;
  meet_name?: string;
  meets?: { Level?: string };
  snatch_lift_1?: string | null;
  snatch_lift_2?: string | null;
  snatch_lift_3?: string | null;
  best_snatch?: string | null;
  cj_lift_1?: string | null;
  cj_lift_2?: string | null;
  cj_lift_3?: string | null;
  best_cj?: string | null;
  total?: string | null;
  qpoints?: number | null;
  q_youth?: number | null;
  q_masters?: number | null;
  best_snatch_ytd?: number | null;
  best_cj_ytd?: number | null;
  best_total_ytd?: number | null;
  gender?: string | null;
  age_category?: string | null;
  competition_age?: number | null;
}

interface AthleteCardProps {
  athleteName: string;
  results: CompetitionResult[];
  dataSource?: 'usaw' | 'iwf';
  population_percentiles?: Record<string, any>;
  historical_stats?: Record<string, any>;
}

// Helper functions for analytics calculations
const parseAttempt = (attempt: string | null | undefined): number | null => {
  if (!attempt || attempt === '0') return null;
  const parsed = parseInt(attempt);
  return isNaN(parsed) ? null : parsed;
};

const isSuccessfulAttempt = (attempt: string | null | undefined): boolean => {
  const parsed = parseAttempt(attempt);
  return parsed !== null && parsed > 0;
};

const calculateSuccessRate = (attempts: (string | null | undefined)[]) => {
  const validAttempts = attempts.filter(attempt => parseAttempt(attempt) !== null);
  if (validAttempts.length === 0) return { percentage: 0, successes: 0, total: 0 };
  
  const successful = validAttempts.filter(isSuccessfulAttempt);
  return {
    percentage: Math.round((successful.length / validAttempts.length) * 100),
    successes: successful.length,
    total: validAttempts.length
  };
};


const formatPerspectiveLabel = (key: string) => {
  const parts = key.split('_');
  if (parts.length < 3) return key;
  const fed = parts[0].toUpperCase();
  const gender = parts[1] === 'F' ? 'Female' : 'Male';
  const ageGroup = parts[2];
  return `${fed} ${gender} ${ageGroup}`;
};

const calculateClutchPerformance = (results: CompetitionResult[]): { 
  percentage: number; successes: number; total: number;
} => {
  let clutchSituations = 0;
  let clutchSuccesses = 0;

  results.forEach(result => {
    // Snatch clutch situations - must-make 3rd attempts when first two failed (final chance to avoid bombing)
    const sn1Success = isSuccessfulAttempt(result.snatch_lift_1);
    const sn2Success = isSuccessfulAttempt(result.snatch_lift_2);
    const sn3Success = isSuccessfulAttempt(result.snatch_lift_3);
    
    if (parseAttempt(result.snatch_lift_1) !== null && !sn1Success && 
        parseAttempt(result.snatch_lift_2) !== null && !sn2Success && 
        parseAttempt(result.snatch_lift_3) !== null) {
      clutchSituations++;
      if (sn3Success) clutchSuccesses++;
    }

    // Clean & Jerk clutch situations - must-make 3rd attempts when first two failed (final chance to avoid bombing)
    const cj1Success = isSuccessfulAttempt(result.cj_lift_1);
    const cj2Success = isSuccessfulAttempt(result.cj_lift_2);
    const cj3Success = isSuccessfulAttempt(result.cj_lift_3);
    
    if (parseAttempt(result.cj_lift_1) !== null && !cj1Success && 
        parseAttempt(result.cj_lift_2) !== null && !cj2Success && 
        parseAttempt(result.cj_lift_3) !== null) {
      clutchSituations++;
      if (cj3Success) clutchSuccesses++;
    }
  });

  return {
    percentage: clutchSituations > 0 ? (clutchSuccesses / clutchSituations) * 100 : 0,
    successes: clutchSuccesses,
    total: clutchSituations
  };
};


const calculateBounceBackRate = (results: CompetitionResult[]): { 
  snatch: number; snatchSuccesses: number; snatchTotal: number;
  cleanJerk: number; cleanJerkSuccesses: number; cleanJerkTotal: number;
} => {
  let snatchBounceBackSituations = 0;
  let snatchBounceBackSuccesses = 0;
  let cjBounceBackSituations = 0;
  let cjBounceBackSuccesses = 0;

  results.forEach(result => {
    // Snatch bounce-back (miss first, success second)
    const sn1Success = isSuccessfulAttempt(result.snatch_lift_1);
    const sn2Success = isSuccessfulAttempt(result.snatch_lift_2);
    
    if (parseAttempt(result.snatch_lift_1) !== null && !sn1Success && parseAttempt(result.snatch_lift_2) !== null) {
      snatchBounceBackSituations++;
      if (sn2Success) snatchBounceBackSuccesses++;
    }

    // Clean & Jerk bounce-back
    const cj1Success = isSuccessfulAttempt(result.cj_lift_1);
    const cj2Success = isSuccessfulAttempt(result.cj_lift_2);
    
    if (parseAttempt(result.cj_lift_1) !== null && !cj1Success && parseAttempt(result.cj_lift_2) !== null) {
      cjBounceBackSituations++;
      if (cj2Success) cjBounceBackSuccesses++;
    }
  });

  return {
    snatch: snatchBounceBackSituations > 0 ? Math.round((snatchBounceBackSuccesses / snatchBounceBackSituations) * 100) : 0,
    snatchSuccesses: snatchBounceBackSuccesses,
    snatchTotal: snatchBounceBackSituations,
    cleanJerk: cjBounceBackSituations > 0 ? Math.round((cjBounceBackSuccesses / cjBounceBackSituations) * 100) : 0,
    cleanJerkSuccesses: cjBounceBackSuccesses,
    cleanJerkTotal: cjBounceBackSituations
  };
};

const calculateAttemptJumps = (results: CompetitionResult[]) => {
  const relevantResults = results.length >= 4 
    ? results.slice(0, Math.max(4, Math.round(results.length * 0.25)))
    : results;
  
  const snatchJumps = { 
    first_to_second: [] as number[], 
    second_to_third: [] as number[], 
    ranges: [] as number[],
    first_to_second_percent: [] as number[],
    second_to_third_percent: [] as number[]
  };
  const cjJumps = { 
    first_to_second: [] as number[], 
    second_to_third: [] as number[], 
    ranges: [] as number[],
    first_to_second_percent: [] as number[],
    second_to_third_percent: [] as number[]
  };
  
  relevantResults.forEach(result => {
    const sn1 = parseAttempt(result.snatch_lift_1);
    const sn2 = parseAttempt(result.snatch_lift_2);
    const sn3 = parseAttempt(result.snatch_lift_3);
    
    if (sn1 && sn2 && sn1 > 0 && sn2 > 0) {
      snatchJumps.first_to_second.push(sn2 - sn1);
      snatchJumps.first_to_second_percent.push(((sn2 - sn1) / sn1) * 100);
    }
    if (sn2 && sn3 && sn2 > 0 && sn3 > 0) {
      snatchJumps.second_to_third.push(sn3 - sn2);
      snatchJumps.second_to_third_percent.push(((sn3 - sn2) / sn2) * 100);
    }
    
    const cj1 = parseAttempt(result.cj_lift_1);
    const cj2 = parseAttempt(result.cj_lift_2);
    const cj3 = parseAttempt(result.cj_lift_3);
    
    if (cj1 && cj2 && cj1 > 0 && cj2 > 0) {
      cjJumps.first_to_second.push(cj2 - cj1);
      cjJumps.first_to_second_percent.push(((cj2 - cj1) / cj1) * 100);
    }
    if (cj2 && cj3 && cj2 > 0 && cj3 > 0) {
      cjJumps.second_to_third.push(cj3 - cj2);
      cjJumps.second_to_third_percent.push(((cj3 - cj2) / cj2) * 100);
    }
  });
  
  const getStats = (arr: number[]) => {
    if (arr.length === 0) return { avg: 0, min: 0, max: 0 };
    return {
      avg: Math.round(arr.reduce((sum, val) => sum + val, 0) / arr.length),
      min: Math.min(...arr),
      max: Math.max(...arr)
    };
  };

  const getPercentStats = (arr: number[]) => {
    if (arr.length === 0) return { avg: 0, min: 0, max: 0 };
    return {
      avg: Math.round((arr.reduce((sum, val) => sum + val, 0) / arr.length) * 10) / 10,
      min: Math.round(Math.min(...arr) * 10) / 10,
      max: Math.round(Math.max(...arr) * 10) / 10
    };
  };
  
  return {
    snatch: {
      firstToSecond: getStats(snatchJumps.first_to_second),
      firstToSecondPercent: getPercentStats(snatchJumps.first_to_second_percent),
      secondToThird: getStats(snatchJumps.second_to_third),
      secondToThirdPercent: getPercentStats(snatchJumps.second_to_third_percent)
    },
    cleanJerk: {
      firstToSecond: getStats(cjJumps.first_to_second),
      firstToSecondPercent: getPercentStats(cjJumps.first_to_second_percent),
      secondToThird: getStats(cjJumps.second_to_third),
      secondToThirdPercent: getPercentStats(cjJumps.second_to_third_percent)
    }
  };
};

const calculateDetailedSuccessRates = (results: CompetitionResult[]) => {
  const snatch = { first: [] as (string | null | undefined)[], second: [] as (string | null | undefined)[], third: [] as (string | null | undefined)[] };
  const cj = { first: [] as (string | null | undefined)[], second: [] as (string | null | undefined)[], third: [] as (string | null | undefined)[] };
  
  results.forEach(result => {
    // Collect snatch attempts by attempt number
    if (parseAttempt(result.snatch_lift_1) !== null) {
      snatch.first.push(result.snatch_lift_1);
    }
    if (parseAttempt(result.snatch_lift_2) !== null) {
      snatch.second.push(result.snatch_lift_2);
    }
    if (parseAttempt(result.snatch_lift_3) !== null) {
      snatch.third.push(result.snatch_lift_3);
    }
    
    // Collect C&J attempts by attempt number
    if (parseAttempt(result.cj_lift_1) !== null) {
      cj.first.push(result.cj_lift_1);
    }
    if (parseAttempt(result.cj_lift_2) !== null) {
      cj.second.push(result.cj_lift_2);
    }
    if (parseAttempt(result.cj_lift_3) !== null) {
      cj.third.push(result.cj_lift_3);
    }
  });
  
  return {
    snatch: {
      first: calculateSuccessRate(snatch.first),
      second: calculateSuccessRate(snatch.second),
      third: calculateSuccessRate(snatch.third)
    },
    cj: {
      first: calculateSuccessRate(cj.first),
      second: calculateSuccessRate(cj.second),
      third: calculateSuccessRate(cj.third)
    }
  };
};

const calculatePerformanceScaling = (results: CompetitionResult[]): { local: number; national: number; international: number } => {
  const levels: { local: number[]; national: number[]; international: number[] } = { 
    local: [], 
    national: [], 
    international: [] 
  };
  
  results.forEach(result => {
    const total = parseAttempt(result.total);
    if (!total) return;
    
    const level = result.meets?.Level?.toLowerCase() || '';
    if (level.includes('local') || level.includes('regional')) {
      levels.local.push(total);
    } else if (level.includes('national')) {
      levels.national.push(total);
    } else if (level.includes('international') || level.includes('world')) {
      levels.international.push(total);
    } else {
      levels.local.push(total); // Default to local for unknown levels
    }
  });

  return {
    local: levels.local.length > 0 ? levels.local.reduce((sum, val) => sum + val, 0) / levels.local.length : 0,
    national: levels.national.length > 0 ? levels.national.reduce((sum, val) => sum + val, 0) / levels.national.length : 0,
    international: levels.international.length > 0 ? levels.international.reduce((sum, val) => sum + val, 0) / levels.international.length : 0
  };
};

const calculate3YearConsistency = (results: CompetitionResult[]): {
  score: number;
  coefficientOfVariation: number;
  sampleSize: number;
} => {
  // Filter to last 3 years of competitions
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  
  const recentResults = results.filter(result => {
    const resultDate = new Date(result.date);
    return resultDate >= threeYearsAgo;
  });
  
  const totals = recentResults
    .map(result => parseAttempt(result.total))
    .filter((total): total is number => total !== null && total > 0);
  
  if (totals.length < 2) {
    return { score: 100, coefficientOfVariation: 0, sampleSize: totals.length };
  }
  
  const mean = totals.reduce((sum, val) => sum + val, 0) / totals.length;
  const variance = totals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totals.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? (standardDeviation / mean) * 100 : 0;
  const consistencyScore = Math.max(0, 100 - coefficientOfVariation);
  
  return {
    score: Math.round(consistencyScore),
    coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10,
    sampleSize: totals.length
  };
};

// Skeleton loading component
function AthleteCardSkeleton() {
  // Calculate realistic height: header (60px) + 3 rows × 2 cards (120px each = 360px) + spacing/padding (100px) + context (120px)
  const expectedHeight = 60 + 360 + 100 + 120; // = 640px
  
  return (
    <div className="card-primary mb-8 animate-pulse" style={{ minHeight: `${expectedHeight}px` }}>
      <div className="p-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex justify-between items-center mb-6">
            <div className="h-6 bg-app-tertiary rounded w-64"></div>
            <div className="h-4 bg-app-tertiary rounded w-24"></div>
          </div>
          
          {/* Performance grid skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-secondary" style={{ minHeight: '140px' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-app-tertiary rounded w-24"></div>
                  <div className="h-3 bg-app-tertiary rounded w-8"></div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 bg-app-tertiary rounded w-20"></div>
                    <div className="h-3 bg-app-tertiary rounded w-16"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-app-tertiary rounded w-24"></div>
                    <div className="h-3 bg-app-tertiary rounded w-12"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-app-tertiary rounded w-20"></div>
                    <div className="h-3 bg-app-tertiary rounded w-14"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-app-tertiary rounded w-16"></div>
                    <div className="h-3 bg-app-tertiary rounded w-18"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Comparison context skeleton */}
          <div className="mt-6 pt-4 border-t border-app-secondary">
            <div className="space-y-2">
              <div className="h-3 bg-app-tertiary rounded w-80"></div>
              <div className="h-3 bg-app-tertiary rounded w-72"></div>
              <div className="h-3 bg-app-tertiary rounded w-96"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const getOrdinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function AthleteCard({ athleteName, results, dataSource, population_percentiles, historical_stats }: AthleteCardProps) {
  const [viewMode, setViewMode] = React.useState<'career' | 'recent'>('recent');
  const [selectedYear, setSelectedYear] = React.useState<string>('All-Time');
  const [perspective, setPerspective] = React.useState<string>('age_group');
  const [isEpochOpen, setIsEpochOpen] = React.useState(false);
  const [isDemographicOpen, setIsDemographicOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const demographicRef = React.useRef<HTMLDivElement>(null);

  const isHistorical = selectedYear !== 'All-Time';

  const availableYears = React.useMemo(() => {
    const history = historical_stats?.[dataSource || 'usaw'];
    if (!history) return [];
    const currentYear = new Date().getFullYear().toString();
    return Object.keys(history)
      .filter(year => year !== currentYear)
      .sort((a, b) => b.localeCompare(a));
  }, [historical_stats, dataSource]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsEpochOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get demographic info from most recent result for population comparison
  const recentResult = results.length > 0 ? results[0] : null;
  const demographicFilter = recentResult ? {
    gender: recentResult.gender as 'M' | 'F' | undefined,
    ageCategory: recentResult.age_category || undefined,
    competitionLevel: recentResult.meets?.Level,
    dataSource
  } : undefined;

  // --- Layer 1: Demographic Context Resolution ---
  const demographicContext = useMemo(() => {
    if (results.length === 0) return null;

    const snapshotAge = (() => {
      const recentAge = recentResult?.competition_age || null;
      if (!isHistorical || selectedYear === 'All-Time') return recentAge;
      
      const getYearFromDate = (dateStr: string) => {
        if (!dateStr) return null;
        const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
        const year = parseInt(parts[0].length === 4 ? parts[0] : parts[parts.length - 1]);
        return isNaN(year) ? null : year;
      };

      const targetYear = parseInt(selectedYear);
      const match = results.find(r => getYearFromDate(r.date) === targetYear);
      if (match?.competition_age) return match.competition_age;
      
      const recentYear = getYearFromDate(recentResult?.date || '');
      if (recentAge && recentYear && !isNaN(targetYear)) {
        return recentAge - (recentYear - targetYear);
      }
      return null;
    })();

    const historicalYearData = isHistorical ? historical_stats?.[dataSource || 'usaw']?.[selectedYear] : null;
    const contextData = isHistorical ? historicalYearData : population_percentiles?.[dataSource || 'usaw'];

    const getAvailableDemographicKeys = (data: any, age: number | null) => {
      if (!data) return [];
      const athleteGender = (results[0]?.gender || '').toString().toUpperCase().startsWith('F') ? 'F' : 'M';
      
      return Object.keys(data).filter(k => {
        const item = data[k];
        if (!item || typeof item !== 'object') return false;
        
        const parts = k.split('_');
        if (parts.length < 3) return false;
        
        // Gender Match
        if (parts[1] !== athleteGender) return false;
        
        // Age Eligibility Check
        if (age !== null && Number.isFinite(age)) {
          const ageCategory = parts[2].toLowerCase();
          if (age < 35 && ageCategory.includes('master')) return false;
          if ((age < 13 || age > 17) && ageCategory.includes('youth')) return false;
          if ((age < 15 || age > 20) && ageCategory.includes('junior')) return false;
          if (age < 15 && ageCategory.includes('senior')) return false;
        }

        return true;
      });
    };

    const availableKeys = getAvailableDemographicKeys(contextData, snapshotAge);

    const resolvePerspective = (p: string, age: number | null, keys: string[]) => {
      if (keys.includes(p)) return p;
      if (age !== null) {
        if (age >= 35) {
          const k = keys.find(k => k.toLowerCase().includes('master'));
          if (k) return k;
        }
        if (age >= 13 && age <= 17) {
          const k = keys.find(k => k.toLowerCase().includes('youth'));
          if (k) return k;
        }
        if (age >= 15 && age <= 20) {
          const k = keys.find(k => k.toLowerCase().includes('junior'));
          if (k) return k;
        }
        if (age >= 15) {
          const k = keys.find(k => k.toLowerCase().includes('senior'));
          if (k) return k;
        }
      }
      return keys[0] || p;
    };

    const resolvedPerspective = resolvePerspective(perspective, snapshotAge, availableKeys);

    return {
      snapshotAge,
      availableKeys,
      resolvedPerspective,
      historicalYearData,
      contextData
    };
  }, [results, selectedYear, dataSource, historical_stats, perspective, population_percentiles]);

  // --- Layer 2: Statistics Engine ---
  const { stats: populationStats, loading: statsLoading, error: statsError } = usePopulationStats(
    demographicFilter, 
    isHistorical ? demographicContext?.historicalYearData : population_percentiles, 
    viewMode,
    dataSource || 'usaw',
    demographicContext?.resolvedPerspective || perspective
  );

  // --- Layer 3: Comprehensive Analytics Engine ---
  const analytics = useMemo(() => {
    if (!demographicContext) return null;
    const { snapshotAge, availableKeys, resolvedPerspective, historicalYearData, contextData } = demographicContext;

    // Extract the metrics shard
    const historicalData = historicalYearData 
      ? (historicalYearData[resolvedPerspective] || historicalYearData.metrics || (historicalYearData[availableKeys[0]] ? historicalYearData[availableKeys[0]] : null)) 
      : null;

    const anchorDate = isHistorical 
      ? new Date(`${selectedYear}-12-31T23:59:59`) 
      : new Date();

    const resultsUpToAnchor = results.filter(r => new Date(r.date) <= anchorDate);
    
    let activeResults = resultsUpToAnchor;
    if (viewMode === 'recent') {
      const threeYearsBeforeAnchor = new Date(anchorDate);
      threeYearsBeforeAnchor.setFullYear(threeYearsBeforeAnchor.getFullYear() - 3);
      activeResults = resultsUpToAnchor.filter(r => new Date(r.date) >= threeYearsBeforeAnchor);
    }

    const targetResults = activeResults.length > 0 ? activeResults : (isHistorical ? activeResults : results);
    const isFallback = (viewMode === 'recent' || isHistorical) && activeResults.length === 0;

    const snatchAttempts: (string | null | undefined)[] = [];
    const cjAttempts: (string | null | undefined)[] = [];
    const totals: number[] = [];
    const qScores: number[] = [];

    targetResults.forEach(result => {
      snatchAttempts.push(result.snatch_lift_1, result.snatch_lift_2, result.snatch_lift_3);
      cjAttempts.push(result.cj_lift_1, result.cj_lift_2, result.cj_lift_3);
      
      const total = parseAttempt(result.total);
      if (total) totals.push(total);
      
      const qs = [result.qpoints, result.q_youth, result.q_masters].filter(v => v !== null && v !== undefined) as number[];
      if (qs.length > 0) qScores.push(Math.max(...qs));
    });

    const snatchSuccessRate = calculateSuccessRate(snatchAttempts);
    const cjSuccessRate = calculateSuccessRate(cjAttempts);
    const overallSuccessRate = calculateSuccessRate([...snatchAttempts, ...cjAttempts]);
    
    const consistencyMetrics = calculate3YearConsistency(targetResults);
    const clutchPerformance = calculateClutchPerformance(targetResults);
    const bounceBackRates = calculateBounceBackRate(targetResults);
    const attemptJumps = calculateAttemptJumps(targetResults);
    const detailedSuccessRates = calculateDetailedSuccessRates(targetResults);
    const performanceScaling = calculatePerformanceScaling(targetResults);
    
    // Calculate years active as the span from earliest to latest competition
    const competitionYears = targetResults.map(r => new Date(r.date).getFullYear());
    const minYear = Math.min(...competitionYears);
    const maxYear = Math.max(...competitionYears);
    const yearsActive = maxYear - minYear + 1;
    const uniqueYears = new Set(competitionYears);
    
    // Competition frequency based on unique calendar years within the target window
    const totalMeetsInWindow = targetResults.length;
    const competitionFrequency = yearsActive > 0 ? totalMeetsInWindow / yearsActive : 0;

    // Year-over-year performance trend using YTD best lifts
    const yearlyBests = new Map<number, { total: number, snatch: number, cj: number }>();
    
    targetResults.forEach(result => {
      const year = new Date(result.date).getFullYear();
      const total = result.best_total_ytd || parseAttempt(result.total);
      const snatch = result.best_snatch_ytd || parseAttempt(result.best_snatch);
      const cj = result.best_cj_ytd || parseAttempt(result.best_cj);
      
      if (total && snatch && cj) {
        const existing = yearlyBests.get(year);
        if (!existing || total > existing.total) {
          yearlyBests.set(year, { total, snatch, cj });
        }
      }
    });
    
    const sortedYears = Array.from(yearlyBests.keys()).sort();
    let performanceTrend = 0;
    let recentYoyTrend = 0;
    let improvementStreak = 0;
    let bestImprovementStreak = 0;
    
    if (sortedYears.length >= 2) {
      // Calculate year-over-year changes and average them
      const yoyChanges: number[] = [];
      
      for (let i = 1; i < sortedYears.length; i++) {
        const prevYear = yearlyBests.get(sortedYears[i - 1])!;
        const currentYear = yearlyBests.get(sortedYears[i])!;
        const change = ((currentYear.total - prevYear.total) / prevYear.total) * 100;
        yoyChanges.push(change);
      }
      
      // Average the year-over-year changes for overall trend
      performanceTrend = yoyChanges.reduce((sum, change) => sum + change, 0) / yoyChanges.length;
      
      // Recent YOY trend (last 2-3 years)
      const recentChanges = yoyChanges.slice(-2); // Last 2 year-over-year changes
      if (recentChanges.length > 0) {
        recentYoyTrend = recentChanges.reduce((sum, change) => sum + change, 0) / recentChanges.length;
      }
      
      // Calculate current improvement streak (consecutive years from most recent)
      for (let i = yoyChanges.length - 1; i >= 0; i--) {
        if (yoyChanges[i] > 0) {
          improvementStreak++;
        } else {
          break;
        }
      }
      
      // Calculate best-ever improvement streak (longest consecutive improvement period)
      let currentStreak = 0;
      
      for (let i = 0; i < yoyChanges.length; i++) {
        if (yoyChanges[i] > 0) {
          currentStreak++;
          bestImprovementStreak = Math.max(bestImprovementStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
    }

    // Calculate Q-score metrics - use recent competitions for athletes with 4+ meets
    const shouldUseRecentQScores = targetResults.length >= 4;
    const recentQScores = shouldUseRecentQScores 
      ? targetResults.slice(0, Math.round(targetResults.length * 0.25))
          .reduce((scores: number[], result) => {
            if (result.qpoints) scores.push(result.qpoints);
            if (result.q_youth) scores.push(result.q_youth);
            if (result.q_masters) scores.push(result.q_masters);
            return scores;
          }, [])
      : qScores;
    
    const bestQScore = recentQScores.length > 0 ? Math.max(...recentQScores) : 0;
    const averageQScore = qScores.length > 0 ? qScores.reduce((sum, score) => sum + score, 0) / qScores.length : 0;

    // Determine which Q-score type produced the best result
    let bestQScoreType = 'Q-points';
    if (qScores.length > 0) {
      const bestScore = Math.max(...qScores);
      // Find which type produced the best score by looking at latest result
      const latestResult = targetResults[0];
      if (latestResult) {
        if (latestResult.q_youth === bestScore) bestQScoreType = 'Q-youth';
        else if (latestResult.q_masters === bestScore) bestQScoreType = 'Q-masters';
        else if (latestResult.qpoints === bestScore) bestQScoreType = 'Q-points';
        // If none match exactly from latest, check all results for the best score
        else {
          for (const result of targetResults) {
            if (result.q_youth === bestScore) { bestQScoreType = 'Q-youth'; break; }
            if (result.q_masters === bestScore) { bestQScoreType = 'Q-masters'; break; }
            if (result.qpoints === bestScore) { bestQScoreType = 'Q-points'; break; }
          }
        }
      }
    }

    // Calculate opening attempt strategy metrics - compare each meet to previous meet
    const sortedResults = [...targetResults].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const snatchOpeningPercentages: number[] = [];
    const cjOpeningPercentages: number[] = [];
    
    // Start from second meet (index 1) since we need previous meet to compare
    for (let i = 1; i < sortedResults.length; i++) {
      const currentMeet = sortedResults[i];
      const previousMeet = sortedResults[i - 1];
      
      // Get opening attempts from current meet
      const currentSnatchOpener = parseAttempt(currentMeet.snatch_lift_1);
      const currentCjOpener = parseAttempt(currentMeet.cj_lift_1);
      
      // Get best lifts from previous meet
      const prevSnatchBest = parseAttempt(previousMeet.best_snatch);
      const prevCjBest = parseAttempt(previousMeet.best_cj);
      
      // Calculate percentages if we have valid data
      if (currentSnatchOpener && prevSnatchBest && prevSnatchBest > 0) {
        const snatchPercentage = (Math.abs(currentSnatchOpener) / prevSnatchBest) * 100;
        snatchOpeningPercentages.push(snatchPercentage);
      }
      
      if (currentCjOpener && prevCjBest && prevCjBest > 0) {
        const cjPercentage = (Math.abs(currentCjOpener) / prevCjBest) * 100;
        cjOpeningPercentages.push(cjPercentage);
      }
    }
    
    // Calculate averages
    const averageSnatchOpening = snatchOpeningPercentages.length > 0 
      ? snatchOpeningPercentages.reduce((sum, pct) => sum + pct, 0) / snatchOpeningPercentages.length 
      : 0;
    const averageCjOpening = cjOpeningPercentages.length > 0 
      ? cjOpeningPercentages.reduce((sum, pct) => sum + pct, 0) / cjOpeningPercentages.length 
      : 0;
    
    // Calculate overall strategy based on all valid percentages
    const allValidPercentages = [...snatchOpeningPercentages, ...cjOpeningPercentages];
    const avgOverallOpenerPercentage = allValidPercentages.length > 0 
      ? allValidPercentages.reduce((sum, p) => sum + p, 0) / allValidPercentages.length 
      : 0;
    
  const openerStrategy: 'conservative' | 'aggressive' | 'balanced' | 'insufficient data' =
      allValidPercentages.length === 0 ? 'insufficient data' :
      avgOverallOpenerPercentage <= 88 ? 'conservative' :
      avgOverallOpenerPercentage >= 93 ? 'aggressive' : 'balanced';
    
    // Check for masters achievements (lifetime PRs achieved as masters athlete)
    const mastersAchievements = targetResults.filter(result => {
      const age = result.competition_age || 0;
      if (age < 35) return false; // Masters categories typically start at 35
      
      const snatch = parseAttempt(result.best_snatch);
      const cj = parseAttempt(result.best_cj);
      const total = parseAttempt(result.total);
      
      if (!snatch || !cj || !total) return false;
      
      // Check if this competition result matches personal bests
      const maxSnatch = Math.max(...targetResults.map(r => parseAttempt(r.best_snatch) || 0));
      const maxCj = Math.max(...targetResults.map(r => parseAttempt(r.best_cj) || 0));
      const maxTotal = Math.max(...targetResults.map(r => parseAttempt(r.total) || 0));
      
      return snatch === maxSnatch || cj === maxCj || total === maxTotal;
    }).length > 0;
    
    // Check for young achiever (≤20 with strong recent YOY)
    // Find the first valid competition_age from any result to avoid defaulting to 0
    const getValidAge = (): number | null => {
      for (const result of targetResults) {
        if (result.competition_age && result.competition_age > 0) {
          return result.competition_age;
        }
      }
      return null;
    };
    
    const validAge = getValidAge();
    const isYoungAchiever = validAge !== null && validAge <= 20 && recentYoyTrend > 5;

    // Additional fun categories
    const isLateBloomer = validAge !== null && validAge >= 25 && recentYoyTrend > 8;
    const isSteadyEddie = consistencyMetrics.score >= 85 && yearsActive >= 3;
    const isIronWill = clutchPerformance.percentage >= 75 && (bounceBackRates.snatch + bounceBackRates.cleanJerk) / 2 >= 75;
    const isTechnicalWizard = overallSuccessRate.percentage >= 90;

    return {
      isFallback,
      recentCount: activeResults.length,
      overallSuccessRate: overallSuccessRate.percentage,
      overallSuccesses: overallSuccessRate.successes,
      overallTotal: overallSuccessRate.total,
      snatchSuccessRate: snatchSuccessRate.percentage,
      snatchSuccesses: snatchSuccessRate.successes,
      snatchTotal: snatchSuccessRate.total,
      cjSuccessRate: cjSuccessRate.percentage,
      cjSuccesses: cjSuccessRate.successes,
      cjTotal: cjSuccessRate.total,
      detailedSuccessRates,
      consistencyScore: consistencyMetrics.score,
      coefficientOfVariation: consistencyMetrics.coefficientOfVariation,
      consistencySampleSize: consistencyMetrics.sampleSize,
      clutchPerformance: Math.round(clutchPerformance.percentage),
      clutchSuccesses: clutchPerformance.successes,
      clutchTotal: clutchPerformance.total,
      bounceBackRates: {
        snatch: Math.round(bounceBackRates.snatch),
        snatchSuccesses: bounceBackRates.snatchSuccesses,
        snatchTotal: bounceBackRates.snatchTotal,
        cleanJerk: Math.round(bounceBackRates.cleanJerk),
        cleanJerkSuccesses: bounceBackRates.cleanJerkSuccesses,
        cleanJerkTotal: bounceBackRates.cleanJerkTotal
      },
      attemptJumps,
      competitionFrequency: Math.round(competitionFrequency * 10) / 10,
      performanceTrend: Math.round(performanceTrend),
      recentYoyTrend: Math.round(recentYoyTrend),
      improvementStreak,
      bestImprovementStreak,
      performanceScaling,
      totalCompetitions: targetResults.length,
      yearsActive,
      bestQScore: Math.round(bestQScore * 10) / 10,
      averageQScore: Math.round(averageQScore * 10) / 10,
      bestQScoreType,
      openerStrategy,
      averageSnatchOpening: Math.round(averageSnatchOpening),
      averageCjOpening: Math.round(averageCjOpening),
      mastersAchievements,
      isYoungAchiever,
      isLateBloomer,
      isSteadyEddie,
      isIronWill,
      isTechnicalWizard,
      snapshotAge,
      availableKeys,
      resolvedPerspective,
      historicalData,
      isHistorical,
      selectedYear,
      activeContext: contextData
    };
  }, [results, viewMode, selectedYear, dataSource, historical_stats, perspective, population_percentiles]);

  // SURGICAL: Force state reset when year changes and current selection is invalid
  React.useEffect(() => {
    if (analytics?.resolvedPerspective) {
      const isValid = analytics.availableKeys.includes(perspective);
      // If we've moved to a year where the current selection (Masters) is impossible, force reset to dynamic
      if (!isValid && perspective !== 'age_group') {
        setPerspective('age_group');
      }
    }
  }, [selectedYear, analytics?.availableKeys, perspective]);

  // Show skeleton loading while population stats are loading
  if (statsLoading) {
    return <AthleteCardSkeleton />;
  }

  if (!analytics) {
    return null;
  }

  // If stats error, log it but continue with fallback (already handled in hook)
  if (statsError) {
    console.warn('Population stats error in AthleteCard:', statsError);
  }

  // Get performance level based on percentile
  const getPerformanceLevel = (percentile: number): { level: string; color: string } => {
    if (percentile >= 95) return { level: "Elite", color: "text-yellow-400" };
    if (percentile >= 85) return { level: "Excellent", color: "text-blue-400" };
    if (percentile >= 75) return { level: "Strong", color: "text-green-400" };
    if (percentile >= 50) return { level: "Solid", color: "text-gray-400" };
    if (percentile >= 25) return { level: "Developing", color: "text-orange-400" };
    if (percentile >= 10) return { level: "Emerging", color: "text-red-400" };
    return { level: "Foundation", color: "text-red-500" };
  };

  // Calculate true percentile ranking for a given value against population stats
  const calculatePercentile = (value: number, popStats: any): number => {
    // MODE: Direct Pre-calculated Rank
    if (popStats && popStats.distribution && popStats.distribution.length === 0 && popStats.percentile50 > 0) {
      return popStats.percentile50;
    }

    // MODE: Distribution Calculation
    if (!popStats || !popStats.distribution || popStats.distribution.length === 0) {
      return 0;
    }
    
    // Count how many athletes this value is better than
    const worseCount = popStats.distribution.filter((v: number) => v < value).length;
    // Count how many athletes have the exact same value
    const sameCount = popStats.distribution.filter((v: number) => v === value).length;
    const totalCount = popStats.distribution.length;
    
    if (totalCount === 0) return 0;
    
    // Use midpoint method for general distribution, but use top-of-tie for ceiling/perfect scores
    const isCeiling = worseCount + sameCount === totalCount;
    const numerator = isCeiling ? (worseCount + sameCount) : (worseCount + sameCount / 2);
    const rawPercentile = Math.round((numerator / totalCount) * 100);
    
    // Cap at 99th percentile maximum to prevent misleading 100th+ percentiles
    return Math.min(99, Math.max(1, rawPercentile));
  };

  const getPerformanceIcon = (value: number, popStats: any, isHigherBetter: boolean = true) => {
    if (!popStats || !popStats.distribution || popStats.distribution.length === 0) {
      // Fallback to original logic if no real population data
      const isGood = isHigherBetter ? value >= 70 : value <= 30;
      return isGood ? (
        <CheckCircle className="h-3 w-3 text-green-400" />
      ) : value >= 50 ? (
        <AlertCircle className="h-3 w-3 text-yellow-400" />
      ) : (
        <XCircle className="h-3 w-3 text-red-400" />
      );
    }

    const percentile = calculatePercentile(value, popStats);
    
    if (percentile >= 75) return <CheckCircle className="h-3 w-3 text-green-400" />; // Top 25%
    if (percentile >= 25) return <AlertCircle className="h-3 w-3 text-yellow-400" />; // Middle 50% 
    return <XCircle className="h-3 w-3 text-red-400" />; // Bottom 25%
  };

  const getPercentileText = (value: number, popStats: any): string => {
    if (!popStats) return '';
    
    // MODE: Direct Pre-calculated Rank
    if (popStats.distribution && popStats.distribution.length === 0 && popStats.percentile50 > 0) {
      return ` (${getOrdinal(popStats.percentile50)} percentile)`;
    }

    // MODE: Distribution Calculation
    if (!popStats.distribution || popStats.distribution.length === 0 || popStats.sampleSize === 0) {
      return '';
    }
    
    // Also check if this looks like fallback data
    if (popStats.confidence === 'low' && popStats.sampleSize < 10) {
      return '';
    }
    
    const percentile = calculatePercentile(value, popStats);
    const confidenceIndicator = popStats.confidence === 'low' ? '*' : '';
    
    return ` (${getOrdinal(percentile)} percentile${confidenceIndicator})`;
  };

  const getConfidenceText = (confidence: 'high' | 'moderate' | 'low'): string => {
    switch (confidence) {
      case 'high': return 'High confidence - large sample size ensures reliable percentile comparisons';
      case 'moderate': return 'Moderate confidence - adequate sample size for meaningful comparisons';
      case 'low': return 'Low confidence - small sample size, percentiles may be less reliable';
      default: return '';
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-3 w-3 text-green-400" />;
    if (trend < -5) return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <ArrowRight className="h-3 w-3 text-app-muted" />;
  };

  return (
    <div className="card-primary mb-8">
      <div className="p-6">
        <div className="flex flex-col gap-4 mb-6">
          {/* Top Row: Title and Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-app-primary flex items-center">
              <Lightbulb className="h-5 w-5 mr-2" />
              {athleteName} {dataSource === 'iwf' ? 'IWF' : 'USAW'} Performance Profile
              {analytics.isFallback && (
                <span className="ml-3 text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  No recent data - showing career
                </span>
              )}
            </h2>

            {/* View Mode Toggle - Switch button matches IWF style */}
            <div className="flex items-center space-x-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${viewMode === 'career' ? 'text-app-primary' : 'text-app-muted'}`}>
                Career
              </span>
              <button
                onClick={() => setViewMode(viewMode === 'career' ? 'recent' : 'career')}
                className="relative cursor-pointer focus:outline-none"
                type="button"
                role="switch"
                aria-label="Toggle Career vs Recent view"
              >
                <div className="block w-10 h-6 rounded-full bg-app-surface border border-app-secondary transition-colors"></div>
                <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${viewMode === 'recent' ? 'transform translate-x-4' : ''}`}></div>
              </button>
              <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${viewMode === 'recent' ? 'text-app-primary' : 'text-app-muted'}`}>
                Recent {selectedYear !== 'All-Time' ? `(${parseInt(selectedYear)-2}-${selectedYear})` : '(3yr)'}
              </span>
            </div>
          </div>

          {/* Bottom Row: Both Selectors - Matching Profile Metadata style */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Demographic Selector */}
            {(() => {
              const { availableKeys, resolvedPerspective, snapshotAge, activeContext } = analytics;
              
              if (!activeContext) return null;
              
              const getFullLabel = (key: string) => {
                return formatPerspectiveLabel(key);
              };

              // Consolidate options by their formatted human labels
              const uniqueLabels = new Map<string, string>();
              availableKeys.forEach(key => {
                const label = getFullLabel(key);
                if (!uniqueLabels.has(label)) {
                  uniqueLabels.set(label, key);
                }
              });

              const keys = Array.from(uniqueLabels.values());
              if (keys.length === 0) return null;

              // Sync active label with population stats description (Zero-Lag prioritization)
              const activeLabel = getFullLabel(resolvedPerspective);
              
              const hasMultipleDemographics = keys.length > 1;

              return (
                <div className="relative" ref={demographicRef}>
                  <button
                    disabled={!hasMultipleDemographics}
                    onClick={() => hasMultipleDemographics && setIsDemographicOpen(!isDemographicOpen)}
                    className={`
                      flex items-center space-x-2 px-3 py-1.5 rounded border text-sm
                      ${hasMultipleDemographics 
                        ? (isDemographicOpen ? 'bg-app-tertiary border-white text-white transition-colors' : 'bg-transparent border-app-secondary text-app-secondary hover:bg-app-tertiary hover:text-white transition-colors') 
                        : 'bg-transparent border-app-secondary/50 text-app-muted cursor-default opacity-70'}
                    `}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Demographic group: {activeLabel}</span>
                    {hasMultipleDemographics && (
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isDemographicOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {hasMultipleDemographics && isDemographicOpen && (
                    <div className="absolute top-full left-0 mt-2 w-[320px] z-50 bg-app-surface/95 backdrop-blur-md border border-app-secondary rounded-md shadow-2xl overflow-hidden">
                      <div className="max-h-[300px] overflow-y-auto no-scrollbar py-1">
                        {keys.map(key => (
                          <button
                            key={key}
                            onClick={() => {
                              setPerspective(key);
                              setIsDemographicOpen(false);
                            }}
                            className={`
                              w-full text-left px-4 py-2 text-sm transition-colors
                              ${resolvedPerspective === key ? 'text-white bg-app-tertiary' : 'text-app-secondary hover:text-white hover:bg-app-tertiary/50'}
                            `}
                          >
                            {getFullLabel(key)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Time Span Selector */}
            {availableYears.length > 0 && (() => {
              const getAgeForYear = (yearStr: string) => {
                if (yearStr === 'All-Time') return null;
                const targetYear = parseInt(yearStr);
                // Look for an exact match in results
                const match = results.find(r => new Date(r.date).getFullYear() === targetYear);
                if (match?.competition_age) return match.competition_age;
                // Fallback: extrapolate from most recent result
                const latest = results[0];
                if (latest?.competition_age) {
                  const latestYear = new Date(latest.date).getFullYear();
                  return latest.competition_age - (latestYear - targetYear);
                }
                return null;
              };

              const currentAge = getAgeForYear(selectedYear);

              return (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsEpochOpen(!isEpochOpen)}
                    className={`
                      flex items-center space-x-2 px-3 py-1.5 rounded border transition-colors text-sm
                      ${isEpochOpen ? 'bg-app-tertiary border-white text-white' : 'bg-transparent border-app-secondary text-app-secondary hover:bg-app-tertiary hover:text-white'}
                    `}
                  >
                    <History className="h-3.5 w-3.5" />
                    <span>
                      {selectedYear === 'All-Time' 
                        ? 'Career Standings (All-Time)' 
                        : `Snapshot: ${selectedYear}${currentAge ? ` (Age ${currentAge})` : ''}`}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isEpochOpen ? 'rotate-180' : ''}`} />
                  </button>

                {isEpochOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[280px] z-50 bg-app-surface/95 backdrop-blur-md border border-app-secondary rounded-md shadow-2xl overflow-hidden">
                    <div className="max-h-[300px] overflow-y-auto no-scrollbar py-1">
                      <button
                        onClick={() => {
                          setSelectedYear('All-Time');
                          setIsEpochOpen(false);
                        }}
                        className={`
                          w-full text-left px-4 py-2 text-sm transition-colors
                          ${selectedYear === 'All-Time' ? 'text-white bg-app-tertiary' : 'text-app-secondary hover:text-white hover:bg-app-tertiary/50'}
                        `}
                      >
                        Career Standings (All-Time)
                      </button>
                      <div className="h-px bg-app-secondary/20 mx-2 my-1" />
                        {availableYears.map(year => {
                          const age = getAgeForYear(year);
                          return (
                            <button
                              key={year}
                              onClick={() => {
                                setSelectedYear(year);
                                setIsEpochOpen(false);
                              }}
                              className={`
                                w-full text-left px-4 py-2 text-sm transition-colors
                                ${selectedYear === year ? 'text-white bg-app-tertiary' : 'text-app-secondary hover:text-white hover:bg-app-tertiary/50'}
                              `}
                            >
                              Snapshot: {year}{age ? ` (Age ${age})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Detailed Success Rate Analysis */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title="Make Rate Breakdown"
                description="Success rates by attempt number for both lifts. Shows technical reliability and consistency across different attempt scenarios."
                methodology="Calculated as (successful attempts ÷ total attempts) × 100 for each attempt number (1st, 2nd, 3rd) separately."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Target className="h-4 w-4 mr-1" />
                  Make Rate Breakdown
                </h3>
              </MetricTooltip>
              <span className="text-xs text-app-muted">
                {getPerformanceIcon(analytics.overallSuccessRate, populationStats?.successRate)}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-app-secondary font-medium">Overall Make Rate:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.historicalData?.metrics?.successRate ? (
                    <>
                      {Math.round(analytics.historicalData.metrics.successRate.value)}%
                      <span className="text-app-muted ml-1 text-[10px]">
                        ({analytics.overallSuccesses}/{analytics.overallTotal})
                      </span>
                      {` (${getOrdinal(analytics.historicalData.metrics.successRate.percentile)} percentile)`}
                    </>
                  ) : (
                    <>
                      {analytics.overallSuccessRate}%
                      <span className="text-app-muted ml-1 text-[10px]">
                        ({analytics.overallSuccesses}/{analytics.overallTotal})
                      </span>
                      {getPercentileText(analytics.overallSuccessRate, populationStats?.successRate)}
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-app-muted" style={{ color: 'var(--chart-snatch)' }}>Snatch Overall Make Rate:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.historicalData?.metrics?.snatchSuccessRate ? (
                    <>
                      {Math.round(analytics.historicalData.metrics.snatchSuccessRate.value)}%
                      <span className="text-app-muted ml-1 text-[10px]">
                        ({analytics.snatchSuccesses}/{analytics.snatchTotal})
                      </span>
                      {` (${getOrdinal(analytics.historicalData.metrics.snatchSuccessRate.percentile)} percentile)`}
                    </>
                  ) : (
                    <>
                      {analytics.snatchSuccessRate}%
                      <span className="text-app-muted ml-1 text-[10px]">
                        ({analytics.snatchSuccesses}/{analytics.snatchTotal})
                      </span>
                      {getPercentileText(analytics.snatchSuccessRate, populationStats?.snatchSuccessRate)}
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-app-muted" style={{ color: 'var(--chart-cleanjerk)' }}>C&J Overall Make Rate:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.historicalData?.metrics?.cleanJerkSuccessRate ? (
                    <>
                      {Math.round(analytics.historicalData.metrics.cleanJerkSuccessRate.value)}%
                      <span className="text-app-muted ml-1 text-[10px]">
                        ({analytics.cjSuccesses}/{analytics.cjTotal})
                      </span>
                      {` (${getOrdinal(analytics.historicalData.metrics.cleanJerkSuccessRate.percentile)} percentile)`}
                    </>
                  ) : (
                    <>
                      {analytics.cjSuccessRate}%
                      <span className="text-app-muted ml-1 text-[10px]">
                        ({analytics.cjSuccesses}/{analytics.cjTotal})
                      </span>
                      {getPercentileText(analytics.cjSuccessRate, populationStats?.cleanJerkSuccessRate)}
                    </>
                  )}
                </span>
              </div>
              <div className="space-y-1 text-xs pt-2 border-t border-app-secondary">
                <div className="text-white font-medium mb-1 mt-1">Make Rate for Individual Attempts</div>
                <div className="flex justify-between">
                  <span className="text-app-muted" style={{ color: 'var(--chart-snatch)' }}>Snatch 1st/2nd/3rd:</span>
                  <span className="font-medium text-app-primary text-right">
                    {analytics.detailedSuccessRates.snatch.first.percentage}% / {analytics.detailedSuccessRates.snatch.second.percentage}% / {analytics.detailedSuccessRates.snatch.third.percentage}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-muted" style={{ color: 'var(--chart-cleanjerk)' }}>C&J 1st/2nd/3rd:</span>
                  <span className="font-medium text-app-primary text-right">
                    {analytics.detailedSuccessRates.cj.first.percentage}% / {analytics.detailedSuccessRates.cj.second.percentage}% / {analytics.detailedSuccessRates.cj.third.percentage}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Consistency & Mental Game */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title="Mental Game"
                description="Measures psychological aspects of competitive performance including trend-adjusted consistency, high-pressure situations, and recovery from misses."
                methodology="Performance Stability Score uses detrended analysis to separate systematic improvement/decline from random variation. Must-Make Success Rate measures success when final chance to avoid bombing out (3rd attempts after missing first two). Bounce-back measures recovery rate on follow-up attempts after a previous miss."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Brain className="h-4 w-4 mr-1" />
                  Mental Game
                </h3>
              </MetricTooltip>

            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="Performance Stability Score"
                  description="How consistent an athlete's performance is across recent competitions. Measures reliability and predictability of results within competitive windows."
                  methodology={`3-Year Coefficient of Variation analysis. Uses last 3 years of competition data (${analytics.consistencySampleSize} competitions) to calculate (standard deviation ÷ mean) × 100, then inverted to consistency score: 100 - CV%. Higher scores indicate lower variability and more predictable performance.`}
                >
                  <span className="text-app-secondary font-medium cursor-help flex-shrink-0 break-words">
                    Performance Stability:
                  </span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[120px] break-words leading-tight">
                  {analytics.consistencyScore}%
                </span>
              </div>
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="Clutch Performance"
                  description="Success rate on must-make 3rd attempts when the first two attempts failed. This is the final chance to avoid bombing out of the lift - the ultimate pressure situation."
                  methodology="(Successful 3rd attempts after missing both 1st and 2nd attempts) ÷ (Total must-make 3rd attempt situations) × 100"
                >
                  <span className="text-app-secondary font-medium cursor-help flex-shrink-0 break-words">Must-Make Success Rate:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[150px] break-words leading-tight">
                  {analytics.clutchTotal > 0 ? (
                    <>
                      {analytics.historicalData?.metrics?.clutchPerformance ? (
                        <>
                          {Math.round(analytics.historicalData.metrics.clutchPerformance.value)}%
                          <span className="text-app-muted ml-1 text-[10px]">
                            ({analytics.clutchSuccesses}/{analytics.clutchTotal})
                          </span>
                          {` (${getOrdinal(analytics.historicalData.metrics.clutchPerformance.percentile)} percentile)`}
                        </>
                      ) : (
                        <>
                          {analytics.clutchPerformance}%
                          <span className="text-app-muted ml-1 text-[10px]">
                            ({analytics.clutchSuccesses}/{analytics.clutchTotal})
                          </span>
                        </>
                      )}
                    </>
                  ) : <span className="text-app-muted">N/A</span>}
                </span>
              </div>
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="Snatch Bounce-Back"
                  description="Recovery rate after missing a snatch attempt. Shows mental resilience and technical adjustability for the snatch. Measures how often an athlete successfully makes their follow-up attempt after a previous miss."
                  methodology="Success rate on follow-up snatch attempts after missing the previous attempt"
                >
                  <span className="text-app-secondary font-medium cursor-help flex-shrink-0 break-words" style={{ color: 'var(--chart-snatch)' }}>Snatch Bounce-Back Make Rate:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[150px] break-words leading-tight">
                  {analytics.bounceBackRates.snatchTotal > 0 ? (
                    <>
                      {analytics.historicalData?.metrics?.snatchBounceBackRate ? (
                        <>
                          {Math.round(analytics.historicalData.metrics.snatchBounceBackRate.value)}%
                          <span className="text-app-muted ml-1 text-[10px]">
                            ({analytics.bounceBackRates.snatchSuccesses}/{analytics.bounceBackRates.snatchTotal})
                          </span>
                          {` (${getOrdinal(analytics.historicalData.metrics.snatchBounceBackRate.percentile)} percentile)`}
                        </>
                      ) : (
                        <>
                          {analytics.bounceBackRates.snatch}%
                          <span className="text-app-muted ml-1 text-[10px]">
                            ({analytics.bounceBackRates.snatchSuccesses}/{analytics.bounceBackRates.snatchTotal})
                          </span>
                        </>
                      )}
                    </>
                  ) : <span className="text-app-muted">N/A</span>}
                </span>
              </div>
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="C&J Bounce-Back"
                  description="Recovery rate after missing a clean & jerk attempt. Shows mental resilience and technical adjustability for the clean & jerk. Measures how often an athlete successfully makes their follow-up attempt after a previous miss."
                  methodology="Success rate on follow-up C&J attempts after missing the previous attempt"
                >
                  <span className="text-app-secondary font-medium cursor-help flex-shrink-0 break-words" style={{ color: 'var(--chart-cleanjerk)' }}>C&J Bounce-Back Make Rate:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[150px] break-words leading-tight">
                  {analytics.bounceBackRates.cleanJerkTotal > 0 ? (
                    <>
                      {analytics.historicalData?.metrics?.cleanJerkBounceBackRate ? (
                        <>
                          {Math.round(analytics.historicalData.metrics.cleanJerkBounceBackRate.value)}%
                          <span className="text-app-muted ml-1 text-[10px]">
                            ({analytics.bounceBackRates.cleanJerkSuccesses}/{analytics.bounceBackRates.cleanJerkTotal})
                          </span>
                          {` (${getOrdinal(analytics.historicalData.metrics.cleanJerkBounceBackRate.percentile)} percentile)`}
                        </>
                      ) : (
                        <>
                          {analytics.bounceBackRates.cleanJerk}%
                          <span className="text-app-muted ml-1 text-[10px]">
                            ({analytics.bounceBackRates.cleanJerkSuccesses}/{analytics.bounceBackRates.cleanJerkTotal})
                          </span>
                        </>
                      )}
                    </>
                  ) : <span className="text-app-muted">N/A</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Attempt Strategy & Jumps */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title="Opening Attempt Strategy & Jumps"
                description="Opening attempt selection patterns and jump sizes between attempts. Shows risk tolerance and strategic planning approach."
                methodology="Strategy based on weighted average opening percentages. Jumps calculated as differences between attempt weights."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Crosshair className="h-4 w-4 mr-1" />
                  Opening Attempt Strategy & Jumps
                </h3>
              </MetricTooltip>
              <span className="text-xs text-app-muted">
                {analytics.openerStrategy === 'aggressive' ? (
                  <Flame className="h-3 w-3 text-orange-400" />
                ) : analytics.openerStrategy === 'conservative' ? (
                  <Shield className="h-3 w-3 text-blue-400" />
                ) : (
                  <Scale className="h-3 w-3 text-app-secondary" />
                )}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between mb-1">
                <MetricTooltip
                  title="Open Attempt Strategy"
                  description="Overall approach to opening attempt selection based on comparison to previous competition results. Conservative athletes prioritize making their opener, aggressive athletes take bigger risks for better positioning."
                  methodology="Compares each competition's opening attempts to the best lifts from the previous competition, then averages the percentages. Conservative: ≤88%, Balanced: 89-92%, Aggressive: ≥93%"
                >
                  <span className="text-app-secondary font-medium cursor-help">Open Attempt Strategy:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary capitalize text-right">
                  {analytics.openerStrategy === 'insufficient data' ? 'Insufficient Data' : analytics.openerStrategy}
                </span>
              </div>

              {/* Snatch Section */}
              <div className="pt-2 border-t border-app-secondary/30">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="font-medium" style={{ color: 'var(--chart-snatch)' }}>Snatch</div>
                  <div className="text-app-primary font-medium">Opening: {analytics.averageSnatchOpening > 0 ? `${Math.round(analytics.averageSnatchOpening)}%` : 'N/A'}</div>
                </div>
                <div className="space-y-1 ml-1">
                  <div className="flex justify-between">
                    <span className="text-app-muted">1st→2nd Jump:</span>
                    <span className="font-medium text-app-primary">
                      {analytics.attemptJumps.snatch.firstToSecond.avg}kg <span className="text-app-muted ml-0.5">(Range: {analytics.attemptJumps.snatch.firstToSecond.min}-{analytics.attemptJumps.snatch.firstToSecond.max}kg)</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-app-muted">2nd→3rd Jump:</span>
                    <span className="font-medium text-app-primary">
                      {analytics.attemptJumps.snatch.secondToThird.avg}kg <span className="text-app-muted ml-0.5">(Range: {analytics.attemptJumps.snatch.secondToThird.min}-{analytics.attemptJumps.snatch.secondToThird.max}kg)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Clean & Jerk Section */}
              <div className="pt-2 border-t border-app-secondary/30">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="font-medium" style={{ color: 'var(--chart-cleanjerk)' }}>Clean & Jerk</div>
                  <div className="text-app-primary font-medium">Opening: {analytics.averageCjOpening > 0 ? `${Math.round(analytics.averageCjOpening)}%` : 'N/A'}</div>
                </div>
                <div className="space-y-1 ml-1">
                  <div className="flex justify-between">
                    <span className="text-app-muted">1st→2nd Jump:</span>
                    <span className="font-medium text-app-primary">
                      {analytics.attemptJumps.cleanJerk.firstToSecond.avg}kg <span className="text-app-muted ml-0.5">(Range: {analytics.attemptJumps.cleanJerk.firstToSecond.min}-{analytics.attemptJumps.cleanJerk.firstToSecond.max}kg)</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-app-muted">2nd→3rd Jump:</span>
                    <span className="font-medium text-app-primary">
                      {analytics.attemptJumps.cleanJerk.secondToThird.avg}kg <span className="text-app-muted ml-0.5">(Range: {analytics.attemptJumps.cleanJerk.secondToThird.min}-{analytics.attemptJumps.cleanJerk.secondToThird.max}kg)</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Competition Activity */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title={`${dataSource === 'iwf' ? 'IWF' : 'USAW'} Career Competition Profile${isHistorical ? ` (up to ${selectedYear})` : ''}`}
                description="Activity level and competitive experience. More frequent competition often correlates with higher performance levels and better competition management."
                methodology="Competitions per year = total meets ÷ active years. Years active calculated from date range of competition history."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Activity className="h-4 w-4 mr-1" />
                  {`${dataSource === 'iwf' ? 'IWF' : 'USAW'} Career Competition Profile${isHistorical ? ` (up to ${selectedYear})` : ''}`}
                </h3>
              </MetricTooltip>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-app-secondary">Competitions/Year:</span>
                <span className="font-medium text-app-primary">
                  {analytics.historicalData?.metrics?.competitionFrequency ? (
                    <>
                      {analytics.historicalData.metrics.competitionFrequency.value.toFixed(1)}
                      {` (${getOrdinal(analytics.historicalData.metrics.competitionFrequency.percentile)} percentile)`}
                    </>
                  ) : (
                    <>
                      {analytics.competitionFrequency}{getPercentileText(analytics.competitionFrequency, populationStats?.competitionFrequency)}
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary">Total Meets:</span>
                <span className="font-medium text-app-primary">{analytics.totalCompetitions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary">Years Active:</span>
                <span className="font-medium text-app-primary">{analytics.yearsActive}</span>
              </div>
            </div>
          </div>

          {/* Performance Trend */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title={`${dataSource === 'iwf' ? 'IWF' : 'USAW'} Career Performance Trends${isHistorical ? ` (up to ${selectedYear})` : ''}`}
                description="Overall and recent career trend analysis, including improvement streak tracking. Shows how an athlete's performance has evolved over their competitive career."
                methodology="Calculates year-over-year percentage changes in best totals. Career trend averages all YOY changes, recent trend uses last 2 years. Current streak counts consecutive improvement years from most recent, best streak is longest ever."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {`${dataSource === 'iwf' ? 'IWF' : 'USAW'} Career Performance Trends${isHistorical ? ` (up to ${selectedYear})` : ''}`}
                </h3>
              </MetricTooltip>
              <span className="text-xs text-app-muted">
                {getTrendIcon(analytics.performanceTrend)}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-app-secondary">Career Trend:</span>
                <span className={`font-medium text-right ${
                  analytics.performanceTrend > 0 ? 'text-green-400' : 
                  analytics.performanceTrend < 0 ? 'text-red-400' : 'text-app-primary'
                }`}>
                  {analytics.performanceTrend > 0 ? '+' : ''}{analytics.performanceTrend}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary">Recent Year-Over-Year Trend:</span>
                <span className={`font-medium text-right ${
                  analytics.recentYoyTrend > 0 ? 'text-green-400' : 
                  analytics.recentYoyTrend < 0 ? 'text-red-400' : 'text-app-primary'
                }`}>
                  {analytics.recentYoyTrend > 0 ? '+' : ''}{analytics.recentYoyTrend}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary">Current YOY Improvement Streak:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.improvementStreak} year{analytics.improvementStreak !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary">Best YOY Improvement Streak:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.bestImprovementStreak} year{analytics.bestImprovementStreak !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Performance Insights */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title="Key Insights"
                description="Automated analysis highlighting an athlete's standout characteristics. These insights are based on statistical thresholds and population comparisons."
                methodology="Highlights appear when metrics exceed specific percentile thresholds compared to similar athletes."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <KeyRound className="h-4 w-4 mr-1" />
                  Key Insights
                </h3>
              </MetricTooltip>
            </div>
            <div className="space-y-1 text-xs text-app-secondary">
              {(() => {
                const insights = [];
                
                // Consolidate percentile calculation for insights
                const getMetricPercentile = (value: number, popStats: any, historicalMetric?: { percentile: number }) => {
                  if (historicalMetric) return historicalMetric.percentile;
                  if (popStats) return calculatePercentile(value, popStats);
                  return 0;
                };

                // Elite insights (90th+ percentile)
                if (getMetricPercentile(analytics.overallSuccessRate, populationStats?.successRate, analytics.historicalData?.metrics?.successRate) >= 90) {
                  insights.push(
                    <MetricTooltip
                      key="elite-conversion"
                      title="Elite Attempt Conversion"
                      description="This athlete converts their attempts to successful lifts at an elite level, better than 90% of similar athletes."
                      methodology={`Success rate: ${analytics.overallSuccessRate.toFixed(1)}% (${getOrdinal(calculatePercentile(analytics.overallSuccessRate, populationStats.successRate))} percentile)`}
                    >
                      <div className="text-yellow-400 cursor-help">• Elite attempt conversion</div>
                    </MetricTooltip>
                  );
                } else if (getMetricPercentile(analytics.overallSuccessRate, populationStats?.successRate, analytics.historicalData?.metrics?.successRate) >= 75) {
                  insights.push(
                    <MetricTooltip
                      key="strong-conversion"
                      title="Strong Attempt Conversion"
                      description="Reliable attempt conversion rate, better than 75% of similar athletes."
                      methodology={`Success rate: ${analytics.overallSuccessRate.toFixed(1)}% (${getOrdinal(calculatePercentile(analytics.overallSuccessRate, populationStats.successRate))} percentile)`}
                    >
                      <div className="text-green-400 cursor-help">• Strong attempt conversion</div>
                    </MetricTooltip>
                  );
                } else if (getMetricPercentile(analytics.overallSuccessRate, populationStats?.successRate, analytics.historicalData?.metrics?.successRate) >= 60) {
                  insights.push(
                    <MetricTooltip
                      key="solid-conversion"
                      title="Solid Technical Foundation"
                      description="Above-average technical reliability with consistent attempt conversion."
                      methodology={`Success rate: ${analytics.overallSuccessRate.toFixed(1)}% (${getOrdinal(calculatePercentile(analytics.overallSuccessRate, populationStats.successRate))} percentile)`}
                    >
                      <div className="text-blue-400 cursor-help">• Solid technical foundation</div>
                    </MetricTooltip>
                  );
                }
                
                // Clutch performance insights with broader tiers
                if (getMetricPercentile(analytics.clutchPerformance, populationStats?.clutchPerformance, analytics.historicalData?.metrics?.clutchPerformance) >= 85 && analytics.clutchPerformance > 0) {
                  insights.push(
                    <MetricTooltip
                      key="elite-pressure"
                      title="Elite Under Pressure"
                      description="Exceptional performance in high-pressure must-make situations."
                      methodology={`Clutch success rate: ${analytics.clutchPerformance}% (${getOrdinal(calculatePercentile(analytics.clutchPerformance, populationStats.clutchPerformance))} percentile)`}
                    >
                      <div className="text-yellow-400 cursor-help">• Elite under pressure</div>
                    </MetricTooltip>
                  );
                } else if (getMetricPercentile(analytics.clutchPerformance, populationStats?.clutchPerformance, analytics.historicalData?.metrics?.clutchPerformance) >= 65 && analytics.clutchPerformance > 0) {
                  insights.push(
                    <MetricTooltip
                      key="good-pressure"
                      title="Good Under Pressure"
                      description="Above-average performance in high-pressure situations."
                      methodology={`Clutch success rate: ${analytics.clutchPerformance}% (${getOrdinal(calculatePercentile(analytics.clutchPerformance, populationStats.clutchPerformance))} percentile)`}
                    >
                      <div className="text-blue-400 cursor-help">• Good under pressure</div>
                    </MetricTooltip>
                  );
                }
                
                // Consistency insights with broader coverage
                if (getMetricPercentile(analytics.consistencyScore, populationStats?.consistencyScore, analytics.historicalData?.metrics?.consistencyScore) >= 85) {
                  insights.push(
                    <MetricTooltip
                      key="very-consistent"
                      title="Very Consistent Performer"
                      description="Shows stable, predictable performance across competitions with minimal variation."
                      methodology={`Consistency score: ${analytics.consistencyScore}% (${getOrdinal(calculatePercentile(analytics.consistencyScore, populationStats.consistencyScore))} percentile)`}
                    >
                      <div className="text-purple-400 cursor-help">• Very consistent performer</div>
                    </MetricTooltip>
                  );
                } else if (getMetricPercentile(analytics.consistencyScore, populationStats?.consistencyScore, analytics.historicalData?.metrics?.consistencyScore) >= 65) {
                  insights.push(
                    <MetricTooltip
                      key="reliable-performer"
                      title="Reliable Performer"
                      description="Above-average consistency with predictable competition results."
                      methodology={`Consistency score: ${analytics.consistencyScore}% (${getOrdinal(calculatePercentile(analytics.consistencyScore, populationStats.consistencyScore))} percentile)`}
                    >
                      <div className="text-green-400 cursor-help">• Reliable performer</div>
                    </MetricTooltip>
                  );
                }
                
                // Q-Score Performance insights (lowered threshold from >1000 to >500)
                if (getMetricPercentile(analytics.bestQScore, populationStats?.qScorePerformance, analytics.historicalData?.metrics?.qScorePerformance) >= 90) {
                  insights.push(
                    <MetricTooltip
                      key="elite-qscore"
                      title="Elite Q-Score Performance"
                      description="Exceptional competitive performance showing elite-level weightlifting ability. Based on recent performance for experienced athletes."
                      methodology={`Recent best Q-score: ${analytics.bestQScore} (${analytics.bestQScoreType}) - ${getOrdinal(calculatePercentile(analytics.bestQScore, populationStats.qScorePerformance))} percentile. Uses 25% most recent competitions for athletes with 4+ meets.`}
                    >
                      <div className="text-yellow-400 cursor-help">• Elite Q-score performance</div>
                    </MetricTooltip>
                  );
                } else if (getMetricPercentile(analytics.bestQScore, populationStats?.qScorePerformance, analytics.historicalData?.metrics?.qScorePerformance) >= 75) {
                  insights.push(
                    <MetricTooltip
                      key="strong-qscore"
                      title="Strong Q-Score Performance"
                      description="Above-average competitive performance demonstrating strong weightlifting ability. Based on recent performance for experienced athletes."
                      methodology={`Recent best Q-score: ${analytics.bestQScore} (${analytics.bestQScoreType}) - ${getOrdinal(calculatePercentile(analytics.bestQScore, populationStats.qScorePerformance))} percentile. Uses 25% most recent competitions for athletes with 4+ meets.`}
                    >
                      <div className="text-green-400 cursor-help">• Strong Q-score performance</div>
                    </MetricTooltip>
                  );
                } else if (populationStats && populationStats.qScorePerformance.sampleSize > 500 && calculatePercentile(analytics.bestQScore, populationStats.qScorePerformance) >= 60) {
                  insights.push(
                    <MetricTooltip
                      key="solid-qscore"
                      title="Solid Q-Score Performance"
                      description="Reliable competitive performance showing good weightlifting fundamentals. Based on recent performance for experienced athletes."
                      methodology={`Recent best Q-score: ${analytics.bestQScore} (${analytics.bestQScoreType}) - ${getOrdinal(calculatePercentile(analytics.bestQScore, populationStats.qScorePerformance))} percentile. Uses 25% most recent competitions for athletes with 4+ meets.`}
                    >
                      <div className="text-blue-400 cursor-help">• Solid Q-score performance</div>
                    </MetricTooltip>
                  );
                }
                
                // Bounce-back insights with multiple tiers
                if (populationStats && calculatePercentile(analytics.bounceBackRates.snatch, populationStats.snatchBounceBackRate) >= 90 && analytics.bounceBackRates.snatch > 0) {
                  insights.push(
                    <MetricTooltip
                      key="elite-snatch-bounce"
                      title="Elite Snatch Recovery"
                      description="Exceptional mental resilience for snatch attempts after misses."
                      methodology={`Snatch bounce-back: ${analytics.bounceBackRates.snatch}% (${getOrdinal(calculatePercentile(analytics.bounceBackRates.snatch, populationStats.snatchBounceBackRate))} percentile)`}
                    >
                      <div className="text-yellow-400 cursor-help">• Elite snatch recovery</div>
                    </MetricTooltip>
                  );
                } else if (populationStats && calculatePercentile(analytics.bounceBackRates.snatch, populationStats.snatchBounceBackRate) >= 70 && analytics.bounceBackRates.snatch > 0) {
                  insights.push(
                    <MetricTooltip
                      key="good-snatch-bounce"
                      title="Good Snatch Recovery"
                      description="Above-average ability to bounce back from snatch misses."
                      methodology={`Snatch bounce-back: ${analytics.bounceBackRates.snatch}% (${getOrdinal(calculatePercentile(analytics.bounceBackRates.snatch, populationStats.snatchBounceBackRate))} percentile)`}
                    >
                      <div className="text-green-400 cursor-help">• Good snatch recovery</div>
                    </MetricTooltip>
                  );
                }
                
                if (populationStats && calculatePercentile(analytics.bounceBackRates.cleanJerk, populationStats.cleanJerkBounceBackRate) >= 90 && analytics.bounceBackRates.cleanJerk > 0) {
                  insights.push(
                    <MetricTooltip
                      key="elite-cj-bounce"
                      title="Elite C&J Recovery"
                      description="Exceptional ability to recover from clean & jerk misses."
                      methodology={`C&J bounce-back: ${analytics.bounceBackRates.cleanJerk}% (${getOrdinal(calculatePercentile(analytics.bounceBackRates.cleanJerk, populationStats.cleanJerkBounceBackRate))} percentile)`}
                    >
                      <div className="text-yellow-400 cursor-help">• Elite C&J recovery</div>
                    </MetricTooltip>
                  );
                } else if (populationStats && calculatePercentile(analytics.bounceBackRates.cleanJerk, populationStats.cleanJerkBounceBackRate) >= 70 && analytics.bounceBackRates.cleanJerk > 0) {
                  insights.push(
                    <MetricTooltip
                      key="good-cj-bounce"
                      title="Good C&J Recovery"
                      description="Above-average ability to bounce back from C&J misses."
                      methodology={`C&J bounce-back: ${analytics.bounceBackRates.cleanJerk}% (${getOrdinal(calculatePercentile(analytics.bounceBackRates.cleanJerk, populationStats.cleanJerkBounceBackRate))} percentile)`}
                    >
                      <div className="text-green-400 cursor-help">• Good C&J recovery</div>
                    </MetricTooltip>
                  );
                }
                
                // Performance trend insights with broader thresholds
                if (analytics.recentYoyTrend > 10) {
                  insights.push(
                    <MetricTooltip
                      key="strong-trajectory"
                      title="Strong Upward Trajectory"
                      description="Significant recent improvement trend showing strong development."
                      methodology={`Recent YOY trend: +${analytics.recentYoyTrend}% average improvement`}
                    >
                      <div className="text-green-400 cursor-help">• Strong upward trajectory</div>
                    </MetricTooltip>
                  );
                } else if (analytics.recentYoyTrend > 5) {
                  insights.push(
                    <MetricTooltip
                      key="positive-trajectory"
                      title="Positive Development Trend"
                      description="Steady improvement trend showing consistent development."
                      methodology={`Recent YOY trend: +${analytics.recentYoyTrend}% average improvement`}
                    >
                      <div className="text-blue-400 cursor-help">• Positive development trend</div>
                    </MetricTooltip>
                  );
                }
                
                // Competition frequency insights
                if (populationStats && calculatePercentile(analytics.competitionFrequency, populationStats.competitionFrequency) >= 80) {
                  insights.push(
                    <MetricTooltip
                      key="high-activity"
                      title="High Competition Activity"
                      description="Competes more frequently than most athletes, showing strong competitive engagement."
                      methodology={`Competition frequency: ${analytics.competitionFrequency}/year (${getOrdinal(calculatePercentile(analytics.competitionFrequency, populationStats.competitionFrequency))} percentile)`}
                    >
                      <div className="text-orange-400 cursor-help">• High competition activity</div>
                    </MetricTooltip>
                  );
                }
                
                // Constructive lower-end insights split by experience level
                if (populationStats && calculatePercentile(analytics.overallSuccessRate, populationStats.successRate) <= 40 && analytics.recentYoyTrend > 0) {
                  // Split based on competition experience and opener strategy
                  const isExperienced = analytics.totalCompetitions >= 5;
                  const hasAggressiveOpeners = analytics.averageSnatchOpening >= 93 || analytics.averageCjOpening >= 93;
                  
                  if (isExperienced && hasAggressiveOpeners) {
                    insights.push(
                      <MetricTooltip
                        key="bold-strategy"
                        title="Bold Strategy"
                        description="Experienced competitor with aggressive attempt selection. Taking calculated risks for maximum results."
                        methodology={`${analytics.totalCompetitions} competitions with aggressive opener strategy but ${getOrdinal(calculatePercentile(analytics.overallSuccessRate, populationStats.successRate))} percentile success rate`}
                      >
                        <div className="text-orange-400 cursor-help">• Bold strategy</div>
                      </MetricTooltip>
                    );
                  } else if (!isExperienced) {
                    insights.push(
                      <MetricTooltip
                        key="building-foundation"
                        title="Building Foundation"
                        description="Developing technical skills with positive improvement trend. Every elite lifter started here!"
                        methodology={`Success rate improving despite current ${getOrdinal(calculatePercentile(analytics.overallSuccessRate, populationStats.successRate))} percentile with ${analytics.totalCompetitions} competitions`}
                      >
                        <div className="text-cyan-400 cursor-help">• Building foundation</div>
                      </MetricTooltip>
                    );
                  }
                }
                
                // Big swing attempts (percentage-based to avoid demographic bias)
                if (analytics.attemptJumps.snatch.avgSecondToThirdPercent >= 5 || analytics.attemptJumps.cleanJerk.avgSecondToThirdPercent >= 6) {
                  insights.push(
                    <MetricTooltip
                      key="big-swing"
                      title="Big Swing Attempts"
                      description="Takes large jumps on final attempts, showing aggressive risk-taking for maximum results."
                      methodology={`Large final jumps: Snatch ${analytics.attemptJumps.snatch.avgSecondToThirdPercent}%, C&J ${analytics.attemptJumps.cleanJerk.avgSecondToThirdPercent}%`}
                    >
                      <div className="text-orange-400 cursor-help">• Big swing attempts</div>
                    </MetricTooltip>
                  );
                }
                
                // Safety-first approach (very conservative)
                if (analytics.averageSnatchOpening > 0 && analytics.averageCjOpening > 0 && 
                    (analytics.averageSnatchOpening + analytics.averageCjOpening) / 2 <= 85) {
                  insights.push(
                    <MetricTooltip
                      key="safety-first"
                      title="Safety-First Approach"
                      description="Conservative opening strategy prioritizes making successful attempts over aggressive positioning."
                      methodology={`Average opening: ${Math.round((analytics.averageSnatchOpening + analytics.averageCjOpening) / 2)}% of previous best`}
                    >
                      <div className="text-blue-400 cursor-help">• Safety-first approach</div>
                    </MetricTooltip>
                  );
                }
                
                // Comeback story (recent improvement after decline)
                if (analytics.performanceTrend < -5 && analytics.recentYoyTrend > 8) {
                  insights.push(
                    <MetricTooltip
                      key="comeback-story"
                      title="Comeback Story"
                      description="Recent strong improvement after earlier challenges. Shows resilience and adaptation."
                      methodology={`Career trend ${analytics.performanceTrend}% but recent trend +${analytics.recentYoyTrend}%`}
                    >
                      <div className="text-purple-400 cursor-help">• Comeback story</div>
                    </MetricTooltip>
                  );
                }
                
                // Getting started (newer athletes)
                if (analytics.totalCompetitions <= 2 && analytics.yearsActive <= 1) {
                  insights.push(
                    <MetricTooltip
                      key="getting-started"
                      title="Getting Started"
                      description="Beginning their weightlifting competition journey. Every champion started with their first meet!"
                      methodology={`${analytics.totalCompetitions} competition${analytics.totalCompetitions !== 1 ? 's' : ''} in first year`}
                    >
                      <div className="text-cyan-400 cursor-help">• Getting started</div>
                    </MetricTooltip>
                  );
                }
                
                // Growth mindset (small but consistent improvements)
                if (analytics.improvementStreak >= 2 && analytics.recentYoyTrend > 2 && analytics.recentYoyTrend <= 8) {
                  insights.push(
                    <MetricTooltip
                      key="growth-mindset"
                      title="Growth Mindset"
                      description="Shows consistent improvement over time. Steady progress is the path to long-term success."
                      methodology={`${analytics.improvementStreak}-year improvement streak with +${analytics.recentYoyTrend}% recent trend`}
                    >
                      <div className="text-green-400 cursor-help">• Growth mindset</div>
                    </MetricTooltip>
                  );
                }
                
                // Experience-based insights
                if (analytics.yearsActive >= 8 && analytics.totalCompetitions >= 15) {
                  insights.push(
                    <MetricTooltip
                      key="veteran-athlete"
                      title="Veteran Competitor"
                      description="Experienced athlete with extensive competition history."
                      methodology={`${analytics.yearsActive} years active, ${analytics.totalCompetitions} competitions`}
                    >
                      <div className="text-purple-400 cursor-help">• Veteran competitor</div>
                    </MetricTooltip>
                  );
                } else if (analytics.yearsActive >= 4 && analytics.totalCompetitions >= 8) {
                  insights.push(
                    <MetricTooltip
                      key="experienced-athlete"
                      title="Experienced Competitor"
                      description="Well-established athlete with solid competition background."
                      methodology={`${analytics.yearsActive} years active, ${analytics.totalCompetitions} competitions`}
                    >
                      <div className="text-blue-400 cursor-help">• Experienced competitor</div>
                    </MetricTooltip>
                  );
                }
                
                // Fun personality-based categories from analytics
                if (analytics.mastersAchievements) {
                  insights.push(
                    <MetricTooltip
                      key="masters-achiever"
                      title="Masters Achiever"
                      description="Set lifetime personal records as a masters athlete (35+). Shows that age is just a number!"
                      methodology="Personal records achieved at age 35 or older"
                    >
                      <div className="text-yellow-400 cursor-help">• Masters achiever</div>
                    </MetricTooltip>
                  );
                }
                
                if (analytics.isYoungAchiever) {
                  insights.push(
                    <MetricTooltip
                      key="young-achiever"
                      title="Young Achiever"
                      description="Young athlete (≤20) with strong recent improvement trend. Future star potential!"
                      methodology="Age ≤20 with recent YOY improvement >5%"
                    >
                      <div className="text-cyan-400 cursor-help">• Young achiever</div>
                    </MetricTooltip>
                  );
                }
                
                if (analytics.isLateBloomer) {
                  insights.push(
                    <MetricTooltip
                      key="late-bloomer"
                      title="Late Bloomer"
                      description="Mature athlete (25+) experiencing strong recent performance growth. Proof that improvement never stops!"
                      methodology="Age ≥25 with recent YOY improvement >8%"
                    >
                      <div className="text-green-400 cursor-help">• Late bloomer</div>
                    </MetricTooltip>
                  );
                }
                
    if (analytics.isSteadyEddie) {
                  insights.push(
                    <MetricTooltip
                      key="steady-eddie"
                      title="Steady Eddie"
                      description="Reliable, consistent performer over multiple years. The dependable competitor you can count on."
                      methodology="Consistency score ≥85% and active for 3+ years"
                    >
                      <div className="text-purple-400 cursor-help">• Steady Eddie</div>
                    </MetricTooltip>
                  );
                }
                
                
                if (analytics.isIronWill) {
                  insights.push(
                    <MetricTooltip
                      key="iron-will"
                      title="Iron Will"
                      description="Exceptional mental toughness in pressure situations. Clutch performer who rarely cracks under pressure."
                      methodology="Clutch performance ≥75% and high bounce-back rates"
                    >
                      <div className="text-red-400 cursor-help">• Iron will</div>
                    </MetricTooltip>
                  );
                }
                
                if (analytics.isTechnicalWizard) {
                  insights.push(
                    <MetricTooltip
                      key="technical-wizard"
                      title="Technical Wizard"
                      description="Outstanding technical execution with exceptional success rates. Rarely misses attempts!"
                      methodology="Overall success rate ≥90%"
                    >
                      <div className="text-blue-400 cursor-help">• Technical wizard</div>
                    </MetricTooltip>
                  );
                }
                
                if (!populationStats) {
                  insights.push(
                    <div key="loading" className="text-app-muted italic">Loading population comparisons...</div>
                  );
                }
                
                // Return up to 8 insights, ensuring we show the most relevant ones
                return insights.slice(0, 8).map((insight, index) => (
                  <div key={index} className="w-full mb-1">{insight}</div>
                ));
              })()}
            </div>
          </div>
        </div>
        
        {/* Comparison Context */}
        {populationStats && !statsError && (
          <div className="mt-6 pt-4 border-t border-app-secondary">
            <div className="text-xs text-app-muted space-y-2">
              <div>
                <strong>Comparison Context:</strong> Percentiles based on{' '}
                {populationStats.successRate.sampleSize.toLocaleString()} unique {populationStats.successRate.demographicDescription}.{' '}
                {getConfidenceText(populationStats.successRate.confidence)}.
              </div>
              
              {populationStats.successRate.confidence === 'low' && (
                <div className="text-yellow-400 text-xs">
                  ⚠ Small sample size - percentiles may be less reliable. Use insights as general guidance rather than definitive comparisons.
                </div>
              )}
              
              <div>
                <strong>How to read percentiles:</strong> "85th percentile" means this athlete performs better than 85% of similar athletes in the same demographic group.
              </div>
            </div>
          </div>
        )}
        {statsError && (
          <div className="mt-6 pt-4 border-t border-app-secondary">
            <div className="text-xs text-yellow-400 space-y-1">
              <div className="flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                <strong>Stats Note:</strong> Unable to load detailed population statistics (using general benchmarks). {statsError}
              </div>
              <div className="text-app-muted">
                This may be due to data availability for international athletes. Core performance metrics are still calculated from competition history.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
