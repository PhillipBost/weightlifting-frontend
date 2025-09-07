'use client';

import React, { useMemo } from 'react';
import { TrendingUp, Target, Zap, KeyRound, Brain, Percent, Activity, Lightbulb, Crosshair, Scale, TrendingDown, ArrowRight, CheckCircle, AlertCircle, XCircle, Flame, Shield } from 'lucide-react';
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

const calculateSuccessRate = (attempts: (string | null | undefined)[]): number => {
  const validAttempts = attempts.filter(attempt => parseAttempt(attempt) !== null);
  if (validAttempts.length === 0) return 0;
  
  const successful = validAttempts.filter(isSuccessfulAttempt);
  return (successful.length / validAttempts.length) * 100;
};

const calculateConsistencyMetrics = (values: number[]): { score: number; coefficientOfVariation: number } => {
  if (values.length < 2) return { score: 100, coefficientOfVariation: 0 };
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  
  const coefficientOfVariation = (standardDeviation / mean) * 100;
  const score = Math.max(0, 100 - coefficientOfVariation);
  
  return { score: Math.round(score), coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10 };
};

const calculateClutchPerformance = (results: CompetitionResult[]): number => {
  let clutchSituations = 0;
  let clutchSuccesses = 0;

  results.forEach(result => {
    // Snatch clutch situations - must-make 3rd attempts when first two failed (final chance to avoid bombing)
    const sn1Success = isSuccessfulAttempt(result.snatch_lift_1);
    const sn2Success = isSuccessfulAttempt(result.snatch_lift_2);
    const sn3Success = isSuccessfulAttempt(result.snatch_lift_3);
    
    if (!sn1Success && !sn2Success && parseAttempt(result.snatch_lift_3) !== null) {
      clutchSituations++;
      if (sn3Success) clutchSuccesses++;
    }

    // Clean & Jerk clutch situations - must-make 3rd attempts when first two failed (final chance to avoid bombing)
    const cj1Success = isSuccessfulAttempt(result.cj_lift_1);
    const cj2Success = isSuccessfulAttempt(result.cj_lift_2);
    const cj3Success = isSuccessfulAttempt(result.cj_lift_3);
    
    if (!cj1Success && !cj2Success && parseAttempt(result.cj_lift_3) !== null) {
      clutchSituations++;
      if (cj3Success) clutchSuccesses++;
    }
  });

  return clutchSituations > 0 ? (clutchSuccesses / clutchSituations) * 100 : 0;
};

const calculateBounceBackRate = (results: CompetitionResult[]): { snatch: number; cleanJerk: number } => {
  let snatchBounceBackSituations = 0;
  let snatchBounceBackSuccesses = 0;
  let cjBounceBackSituations = 0;
  let cjBounceBackSuccesses = 0;

  results.forEach(result => {
    // Snatch bounce-back (miss first, success second)
    const sn1Success = isSuccessfulAttempt(result.snatch_lift_1);
    const sn2Success = isSuccessfulAttempt(result.snatch_lift_2);
    
    if (!sn1Success && parseAttempt(result.snatch_lift_2) !== null) {
      snatchBounceBackSituations++;
      if (sn2Success) snatchBounceBackSuccesses++;
    }

    // Clean & Jerk bounce-back
    const cj1Success = isSuccessfulAttempt(result.cj_lift_1);
    const cj2Success = isSuccessfulAttempt(result.cj_lift_2);
    
    if (!cj1Success && parseAttempt(result.cj_lift_2) !== null) {
      cjBounceBackSituations++;
      if (cj2Success) cjBounceBackSuccesses++;
    }
  });

  return {
    snatch: snatchBounceBackSituations > 0 ? (snatchBounceBackSuccesses / snatchBounceBackSituations) * 100 : 0,
    cleanJerk: cjBounceBackSituations > 0 ? (cjBounceBackSuccesses / cjBounceBackSituations) * 100 : 0
  };
};

const calculateAttemptJumps = (results: CompetitionResult[]) => {
  const snatchJumps = { first_to_second: [] as number[], second_to_third: [] as number[], ranges: [] as number[] };
  const cjJumps = { first_to_second: [] as number[], second_to_third: [] as number[], ranges: [] as number[] };
  
  results.forEach(result => {
    // Snatch jumps
    const sn1 = parseAttempt(result.snatch_lift_1);
    const sn2 = parseAttempt(result.snatch_lift_2);
    const sn3 = parseAttempt(result.snatch_lift_3);
    
    if (sn1 && sn2) {
      snatchJumps.first_to_second.push(Math.abs(sn2) - Math.abs(sn1));
    }
    if (sn2 && sn3) {
      snatchJumps.second_to_third.push(Math.abs(sn3) - Math.abs(sn2));
    }
    if (sn1 && sn3) {
      snatchJumps.ranges.push(Math.abs(sn3) - Math.abs(sn1));
    }
    
    // Clean & Jerk jumps
    const cj1 = parseAttempt(result.cj_lift_1);
    const cj2 = parseAttempt(result.cj_lift_2);
    const cj3 = parseAttempt(result.cj_lift_3);
    
    if (cj1 && cj2) {
      cjJumps.first_to_second.push(Math.abs(cj2) - Math.abs(cj1));
    }
    if (cj2 && cj3) {
      cjJumps.second_to_third.push(Math.abs(cj3) - Math.abs(cj2));
    }
    if (cj1 && cj3) {
      cjJumps.ranges.push(Math.abs(cj3) - Math.abs(cj1));
    }
  });
  
  const average = (arr: number[]) => arr.length > 0 ? arr.reduce((sum, val) => sum + val, 0) / arr.length : 0;
  
  return {
    snatch: {
      avgFirstToSecond: Math.round(average(snatchJumps.first_to_second)),
      avgSecondToThird: Math.round(average(snatchJumps.second_to_third)),
      avgRange: Math.round(average(snatchJumps.ranges))
    },
    cleanJerk: {
      avgFirstToSecond: Math.round(average(cjJumps.first_to_second)),
      avgSecondToThird: Math.round(average(cjJumps.second_to_third)),
      avgRange: Math.round(average(cjJumps.ranges))
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

// Skeleton loading component
function AthleteCardSkeleton() {
  return (
    <div className="card-primary mb-8 animate-pulse" style={{ minHeight: '650px' }}>
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

export function AthleteCard({ athleteName, results }: AthleteCardProps) {
  // Helper function for ordinal numbers
  const getOrdinal = (n: number): string => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Get demographic info from most recent result for population comparison
  const recentResult = results.length > 0 ? results[0] : null;
  const demographicFilter = recentResult ? {
    gender: recentResult.gender as 'M' | 'F' | undefined,
    ageCategory: recentResult.age_category || undefined,
    competitionLevel: recentResult.meets?.Level
  } : undefined;

  const { stats: populationStats, loading: statsLoading } = usePopulationStats(demographicFilter);

  const analytics = useMemo(() => {
    if (results.length === 0) return null;

    // Collect all attempts for success rate calculations
    const snatchAttempts: (string | null | undefined)[] = [];
    const cjAttempts: (string | null | undefined)[] = [];
    const totals: number[] = [];
    const qScores: number[] = [];

    results.forEach(result => {
      snatchAttempts.push(result.snatch_lift_1, result.snatch_lift_2, result.snatch_lift_3);
      cjAttempts.push(result.cj_lift_1, result.cj_lift_2, result.cj_lift_3);
      
      const total = parseAttempt(result.total);
      if (total) totals.push(total);
      
      // Collect all Q-score types for comprehensive analysis
      if (result.qpoints) qScores.push(result.qpoints);
      if (result.q_youth) qScores.push(result.q_youth);
      if (result.q_masters) qScores.push(result.q_masters);
    });

    const snatchSuccessRate = calculateSuccessRate(snatchAttempts);
    const cjSuccessRate = calculateSuccessRate(cjAttempts);
    const overallSuccessRate = calculateSuccessRate([...snatchAttempts, ...cjAttempts]);
    
    const consistencyMetrics = calculateConsistencyMetrics(totals);
    const clutchPerformance = calculateClutchPerformance(results);
    const bounceBackRates = calculateBounceBackRate(results);
    const attemptJumps = calculateAttemptJumps(results);
    const detailedSuccessRates = calculateDetailedSuccessRates(results);
    const performanceScaling = calculatePerformanceScaling(results);
    
    // Calculate years active as the span from earliest to latest competition
    const competitionYears = results.map(r => new Date(r.date).getFullYear());
    const minYear = Math.min(...competitionYears);
    const maxYear = Math.max(...competitionYears);
    const yearsActive = maxYear - minYear + 1;
    const uniqueYears = new Set(competitionYears);
    
    // Competition frequency based on unique calendar years
    const competitionFrequency = yearsActive > 0 ? results.length / yearsActive : 0;

    // Year-over-year performance trend using YTD best lifts
    const yearlyBests = new Map<number, { total: number, snatch: number, cj: number }>();
    
    results.forEach(result => {
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

    // Calculate Q-score metrics
    const bestQScore = qScores.length > 0 ? Math.max(...qScores) : 0;
    const averageQScore = qScores.length > 0 ? qScores.reduce((sum, score) => sum + score, 0) / qScores.length : 0;

    // Determine which Q-score type produced the best result
    let bestQScoreType = 'Q-points';
    if (qScores.length > 0) {
      const bestScore = Math.max(...qScores);
      // Find which type produced the best score by looking at latest result
      const latestResult = results[0];
      if (latestResult) {
        if (latestResult.q_youth === bestScore) bestQScoreType = 'Q-youth';
        else if (latestResult.q_masters === bestScore) bestQScoreType = 'Q-masters';
        else if (latestResult.qpoints === bestScore) bestQScoreType = 'Q-points';
        // If none match exactly from latest, check all results for the best score
        else {
          for (const result of results) {
            if (result.q_youth === bestScore) { bestQScoreType = 'Q-youth'; break; }
            if (result.q_masters === bestScore) { bestQScoreType = 'Q-masters'; break; }
            if (result.qpoints === bestScore) { bestQScoreType = 'Q-points'; break; }
          }
        }
      }
    }

    // Calculate opening attempt strategy metrics - compare each meet to previous meet
    const sortedResults = [...results].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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
    const mastersAchievements = results.filter(result => {
      const age = result.competition_age || 0;
      if (age < 35) return false; // Masters categories typically start at 35
      
      const snatch = parseAttempt(result.best_snatch);
      const cj = parseAttempt(result.best_cj);
      const total = parseAttempt(result.total);
      
      if (!snatch || !cj || !total) return false;
      
      // Check if this competition result matches personal bests
      const maxSnatch = Math.max(...results.map(r => parseAttempt(r.best_snatch) || 0));
      const maxCj = Math.max(...results.map(r => parseAttempt(r.best_cj) || 0));
      const maxTotal = Math.max(...results.map(r => parseAttempt(r.total) || 0));
      
      return snatch === maxSnatch || cj === maxCj || total === maxTotal;
    }).length > 0;
    
    // Check for young achiever (≤20 with strong recent YOY)
    // Find the first valid competition_age from any result to avoid defaulting to 0
    const getValidAge = (): number | null => {
      for (const result of results) {
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
    const isGlassCannon = bestQScore > 0 && consistencyMetrics.score <= 60 && recentYoyTrend < -5;
    const isIronWill = clutchPerformance >= 75 && (bounceBackRates.snatch + bounceBackRates.cleanJerk) / 2 >= 75;
    const isTechnicalWizard = overallSuccessRate >= 90;

    return {
      overallSuccessRate: Math.round(overallSuccessRate),
      snatchSuccessRate: Math.round(snatchSuccessRate),
      cjSuccessRate: Math.round(cjSuccessRate),
      detailedSuccessRates,
      consistencyScore: consistencyMetrics.score,
      coefficientOfVariation: consistencyMetrics.coefficientOfVariation,
      clutchPerformance: Math.round(clutchPerformance),
      bounceBackRates: {
        snatch: Math.round(bounceBackRates.snatch),
        cleanJerk: Math.round(bounceBackRates.cleanJerk)
      },
      attemptJumps,
      competitionFrequency: Math.round(competitionFrequency * 10) / 10,
      performanceTrend: Math.round(performanceTrend),
      recentYoyTrend: Math.round(recentYoyTrend),
      improvementStreak,
      bestImprovementStreak,
      performanceScaling,
      totalCompetitions: results.length,
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
      isGlassCannon,
      isIronWill,
      isTechnicalWizard
    };
  }, [results]);

  // Show skeleton loading while population stats are loading
  if (statsLoading) {
    return <AthleteCardSkeleton />;
  }

  if (!analytics) {
    return null;
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
    if (!popStats || !popStats.distribution || popStats.distribution.length === 0) {
      console.log('No distribution data available for percentile calculation');
      return 0;
    }
    
    // Count how many athletes this value is better than
    const worseCount = popStats.distribution.filter((v: number) => v < value).length;
    // Count how many athletes have the exact same value
    const sameCount = popStats.distribution.filter((v: number) => v === value).length;
    const totalCount = popStats.distribution.length;
    
    // Enhanced debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Percentile calc for value ${value}: worse=${worseCount}, same=${sameCount}, total=${totalCount}`);
      if (value >= 95) { // Focus debug on high values
        console.log(`High value distribution analysis:`, {
          value,
          distributionSample: popStats.distribution.slice(-20), // Last 20 values (highest)
          distributionLength: popStats.distribution.length,
          maxValue: Math.max(...popStats.distribution),
          valuesEqualOrHigher: popStats.distribution.filter((v: number) => v >= value).length,
          rawPercentileBeforeCap: Math.round(((worseCount + sameCount / 2) / totalCount) * 100)
        });
      }
    }
    
    if (totalCount === 0) return 0;
    
    // Use midpoint method: percentile = (number worse + half of same) / total * 100
    // This properly handles ties and prevents artificial capping
    const rawPercentile = Math.round(((worseCount + sameCount / 2) / totalCount) * 100);
    
    // Cap at 99th percentile maximum to prevent misleading 100th+ percentiles
    const percentile = Math.min(99, Math.max(1, rawPercentile));
    
    return percentile;
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
    if (!popStats || !popStats.distribution || popStats.distribution.length === 0 || popStats.sampleSize === 0) {
      // Don't show percentiles if we don't have real distribution data
      return '';
    }
    
    // Also check if this looks like fallback data (distribution might have placeholder values)
    if (popStats.confidence === 'low' && popStats.sampleSize < 10) {
      return '';
    }
    
    const percentile = calculatePercentile(value, popStats);
    const confidenceIndicator = popStats.confidence === 'low' ? '*' : '';
    
    // Use the component-level getOrdinal function
    
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
        <h2 className="text-xl font-bold text-app-primary mb-6 flex items-center">
          <Lightbulb className="h-5 w-5 mr-2" />
          {athleteName} Performance Profile
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Detailed Success Rate Analysis */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title="Success Rate Breakdown"
                description="Success rates by attempt number for both lifts. Shows technical reliability and consistency across different attempt scenarios."
                methodology="Calculated as (successful attempts ÷ total attempts) × 100 for each attempt number (1st, 2nd, 3rd) separately."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Target className="h-4 w-4 mr-1" />
                  Success Rate Breakdown
                </h3>
              </MetricTooltip>
              <span className="text-xs text-app-muted">
                {getPerformanceIcon(analytics.overallSuccessRate, populationStats?.successRate)}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-app-secondary font-medium">Overall:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.overallSuccessRate}%{getPercentileText(analytics.overallSuccessRate, populationStats?.successRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary font-medium" style={{ color: 'var(--chart-snatch)' }}>Snatch Overall:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.snatchSuccessRate}%{getPercentileText(analytics.snatchSuccessRate, populationStats?.successRate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary font-medium" style={{ color: 'var(--chart-cleanjerk)' }}>C&J Overall:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.cjSuccessRate}%{getPercentileText(analytics.cjSuccessRate, populationStats?.successRate)}
                </span>
              </div>
              <div className="space-y-1 text-xs pt-2 border-t border-app-secondary">
                <div className="flex justify-between">
                  <span className="text-app-muted" style={{ color: 'var(--chart-snatch)' }}>Snatch 1st/2nd/3rd:</span>
                  <span className="font-medium text-app-primary text-right">
                    {Math.round(analytics.detailedSuccessRates.snatch.first)}% / {Math.round(analytics.detailedSuccessRates.snatch.second)}% / {Math.round(analytics.detailedSuccessRates.snatch.third)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-muted" style={{ color: 'var(--chart-cleanjerk)' }}>C&J 1st/2nd/3rd:</span>
                  <span className="font-medium text-app-primary text-right">
                    {Math.round(analytics.detailedSuccessRates.cj.first)}% / {Math.round(analytics.detailedSuccessRates.cj.second)}% / {Math.round(analytics.detailedSuccessRates.cj.third)}%
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
                description="Measures psychological aspects of competitive performance including consistency, high-pressure situations, and recovery from misses."
                methodology="Performance Consistency Score is inverse of coefficient of variation. Clutch Performance measures success when final chance to avoid bombing out (3rd attempts after missing first two). Bounce-back measures recovery rate on follow-up attempts after a previous miss."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Brain className="h-4 w-4 mr-1" />
                  Mental Game
                </h3>
              </MetricTooltip>
              <span className="text-xs text-app-muted">
                {(() => {
                  const consistencyPercentile = populationStats?.consistencyScore ? calculatePercentile(analytics.consistencyScore, populationStats.consistencyScore) : 0;
                  const clutchPercentile = populationStats?.clutchPerformance && analytics.clutchPerformance > 0 ? calculatePercentile(analytics.clutchPerformance, populationStats.clutchPerformance) : 0;
                  const snatchBouncePercentile = populationStats?.snatchBounceBackRate && analytics.bounceBackRates.snatch > 0 ? calculatePercentile(analytics.bounceBackRates.snatch, populationStats.snatchBounceBackRate) : 0;
                  const cjBouncePercentile = populationStats?.cleanJerkBounceBackRate && analytics.bounceBackRates.cleanJerk > 0 ? calculatePercentile(analytics.bounceBackRates.cleanJerk, populationStats.cleanJerkBounceBackRate) : 0;
                  
                  const validPercentiles = [consistencyPercentile, clutchPercentile, snatchBouncePercentile, cjBouncePercentile].filter(p => p > 0);
                  const averagePercentile = validPercentiles.length > 0 ? validPercentiles.reduce((sum, p) => sum + p, 0) / validPercentiles.length : consistencyPercentile;
                  
                  if (averagePercentile >= 75) return <CheckCircle className="h-3 w-3 text-green-400" />;
                  if (averagePercentile >= 25) return <AlertCircle className="h-3 w-3 text-yellow-400" />;
                  return <XCircle className="h-3 w-3 text-red-400" />;
                })()}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="Performance Consistency Score"
                  description="How consistent an athlete's performance is across competitions. Higher scores indicate more predictable, stable results."
                  methodology="Calculated as 100 - (coefficient of variation). Higher scores = lower variability. For example, 85% means very consistent performance."
                >
                  <span className="text-app-secondary cursor-help flex-shrink-0 break-words">Consistency:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[120px] break-words leading-tight">
                  {analytics.consistencyScore}%{getPercentileText(analytics.consistencyScore, populationStats?.consistencyScore)}
                </span>
              </div>
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="Clutch Performance"
                  description="Success rate on must-make 3rd attempts when the first two attempts failed. This is the final chance to avoid bombing out of the lift - the ultimate pressure situation."
                  methodology="(Successful 3rd attempts after missing both 1st and 2nd attempts) ÷ (Total must-make 3rd attempt situations) × 100"
                >
                  <span className="text-app-secondary cursor-help flex-shrink-0 break-words">Clutch:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[120px] break-words leading-tight">
                  {analytics.clutchPerformance > 0 ? (
                    `${analytics.clutchPerformance}%${getPercentileText(analytics.clutchPerformance, populationStats?.clutchPerformance)}`
                  ) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="Snatch Bounce-Back"
                  description="Recovery rate after missing a snatch attempt. Shows mental resilience and technical adjustability for the snatch. Measures how often an athlete successfully makes their follow-up attempt after a previous miss."
                  methodology="Success rate on follow-up snatch attempts after missing the previous attempt"
                >
                  <span className="text-app-secondary cursor-help flex-shrink-0 break-words" style={{ color: 'var(--chart-snatch)' }}>Sn Bounce-Back:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[120px] break-words leading-tight">
                  {analytics.bounceBackRates.snatch > 0 ? (
                    `${analytics.bounceBackRates.snatch}%${getPercentileText(analytics.bounceBackRates.snatch, populationStats?.snatchBounceBackRate)}`
                  ) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-start min-w-0 gap-4">
                <MetricTooltip
                  title="C&J Bounce-Back"
                  description="Recovery rate after missing a clean & jerk attempt. Shows mental resilience and technical adjustability for the clean & jerk. Measures how often an athlete successfully makes their follow-up attempt after a previous miss."
                  methodology="Success rate on follow-up C&J attempts after missing the previous attempt"
                >
                  <span className="text-app-secondary cursor-help flex-shrink-0 break-words" style={{ color: 'var(--chart-cleanjerk)' }}>C&J Bounce-Back:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right max-w-[120px] break-words leading-tight">
                  {analytics.bounceBackRates.cleanJerk > 0 ? (
                    `${analytics.bounceBackRates.cleanJerk}%${getPercentileText(analytics.bounceBackRates.cleanJerk, populationStats?.cleanJerkBounceBackRate)}`
                  ) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Attempt Strategy & Jumps */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title="Attempt Strategy & Jumps"
                description="Opening attempt selection patterns and jump sizes between attempts. Shows risk tolerance and strategic planning approach."
                methodology="Strategy based on weighted average opening percentages. Jumps calculated as differences between attempt weights."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Crosshair className="h-4 w-4 mr-1" />
                  Attempt Strategy & Jumps
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
              <div className="flex justify-between">
                <MetricTooltip
                  title="Opening Attempt Strategy"
                  description="Overall approach to opening attempt selection based on comparison to previous competition results. Conservative athletes prioritize making their opener, aggressive athletes take bigger risks for better positioning."
                  methodology="Compares each competition's opening attempts to the best lifts from the previous competition, then averages the percentages. Conservative: ≤88%, Balanced: 89-92%, Aggressive: ≥93%"
                >
                  <span className="text-app-secondary font-medium cursor-help">Strategy:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary capitalize text-right">
                  {analytics.openerStrategy === 'insufficient data' ? 'Insufficient Data' : analytics.openerStrategy}
                </span>
              </div>
              <div className="flex justify-between">
                <MetricTooltip
                  title="Snatch Opening Percentage"
                  description="Average percentage of previous competition's best snatch used for opening attempts. Shows how conservatively or aggressively an athlete opens in the snatch."
                  methodology="For each competition, calculates (opening snatch attempt ÷ previous meet's best snatch) × 100, then averages across all competitions with previous data"
                >
                  <span className="text-app-muted cursor-help" style={{ color: 'var(--chart-snatch)' }}>Snatch Opening:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right">
                  {analytics.averageSnatchOpening > 0 ? `${Math.round(analytics.averageSnatchOpening)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <MetricTooltip
                  title="C&J Opening Percentage"
                  description="Average percentage of previous competition's best clean & jerk used for opening attempts. Shows how conservatively or aggressively an athlete opens in the clean & jerk."
                  methodology="For each competition, calculates (opening C&J attempt ÷ previous meet's best C&J) × 100, then averages across all competitions with previous data"
                >
                  <span className="text-app-muted cursor-help" style={{ color: 'var(--chart-cleanjerk)' }}>C&J Opening:</span>
                </MetricTooltip>
                <span className="font-medium text-app-primary text-right">
                  {analytics.averageCjOpening > 0 ? `${Math.round(analytics.averageCjOpening)}%` : 'N/A'}
                </span>
              </div>
              <div className="space-y-1 text-xs pt-2 border-t border-app-secondary">
                <div className="flex justify-between">
                  <MetricTooltip
                    title="Snatch Jump 1st→2nd Attempt"
                    description="Average weight increase between first and second snatch attempts. Shows how aggressively the athlete progresses in the snatch within a competition."
                    methodology="Calculated as average of (2nd snatch attempt - 1st snatch attempt) across all competitions"
                  >
                    <span className="text-app-muted cursor-help" style={{ color: 'var(--chart-snatch)' }}>Snatch Jump 1st→2nd:</span>
                  </MetricTooltip>
                  <span className="font-medium text-app-primary text-right">
                    {analytics.attemptJumps.snatch.avgFirstToSecond}kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <MetricTooltip
                    title="Snatch Jump 2nd→3rd Attempt"
                    description="Average weight increase between second and third snatch attempts. Shows final attempt aggressiveness and risk tolerance in the snatch."
                    methodology="Calculated as average of (3rd snatch attempt - 2nd snatch attempt) across all competitions"
                  >
                    <span className="text-app-muted cursor-help" style={{ color: 'var(--chart-snatch)' }}>Snatch Jump 2nd→3rd:</span>
                  </MetricTooltip>
                  <span className="font-medium text-app-primary text-right">
                    {analytics.attemptJumps.snatch.avgSecondToThird}kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <MetricTooltip
                    title="C&J Jump 1st→2nd Attempt"
                    description="Average weight increase between first and second clean & jerk attempts. Shows how aggressively the athlete progresses in the clean & jerk within a competition."
                    methodology="Calculated as average of (2nd C&J attempt - 1st C&J attempt) across all competitions"
                  >
                    <span className="text-app-muted cursor-help" style={{ color: 'var(--chart-cleanjerk)' }}>C&J Jump 1st→2nd:</span>
                  </MetricTooltip>
                  <span className="font-medium text-app-primary text-right">
                    {analytics.attemptJumps.cleanJerk.avgFirstToSecond}kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <MetricTooltip
                    title="C&J Jump 2nd→3rd Attempt"
                    description="Average weight increase between second and third clean & jerk attempts. Shows final attempt aggressiveness and risk tolerance in the clean & jerk."
                    methodology="Calculated as average of (3rd C&J attempt - 2nd C&J attempt) across all competitions"
                  >
                    <span className="text-app-muted cursor-help" style={{ color: 'var(--chart-cleanjerk)' }}>C&J Jump 2nd→3rd:</span>
                  </MetricTooltip>
                  <span className="font-medium text-app-primary text-right">
                    {analytics.attemptJumps.cleanJerk.avgSecondToThird}kg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Competition Activity */}
          <div className="card-secondary">
            <div className="flex items-center justify-between mb-3">
              <MetricTooltip
                title="Competition Profile"
                description="Activity level and competitive experience. More frequent competition often correlates with higher performance levels and better competition management."
                methodology="Competitions per year = total meets ÷ active years. Years active calculated from date range of competition history."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <Activity className="h-4 w-4 mr-1" />
                  Competition Profile
                </h3>
              </MetricTooltip>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-app-secondary">Competitions/Year:</span>
                <span className="font-medium text-app-primary">
                  {analytics.competitionFrequency}{getPercentileText(analytics.competitionFrequency, populationStats?.competitionFrequency)}
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
                title="Performance Trends"
                description="Overall and recent career trend analysis, including improvement streak tracking. Shows how an athlete's performance has evolved over their competitive career."
                methodology="Calculates year-over-year percentage changes in best totals. Career trend averages all YOY changes, recent trend uses last 2 years. Current streak counts consecutive improvement years from most recent, best streak is longest ever."
              >
                <h3 className="text-sm font-medium text-app-secondary flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Performance Trends
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
                <span className="text-app-secondary">Recent YOY:</span>
                <span className={`font-medium text-right ${
                  analytics.recentYoyTrend > 0 ? 'text-green-400' : 
                  analytics.recentYoyTrend < 0 ? 'text-red-400' : 'text-app-primary'
                }`}>
                  {analytics.recentYoyTrend > 0 ? '+' : ''}{analytics.recentYoyTrend}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary">Current Improvement Streak:</span>
                <span className="font-medium text-app-primary text-right">
                  {analytics.improvementStreak} year{analytics.improvementStreak !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-app-secondary">Best Streak:</span>
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
                
                // Elite insights (90th+ percentile)
                if (populationStats && calculatePercentile(analytics.overallSuccessRate, populationStats.successRate) >= 90) {
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
                } else if (populationStats && calculatePercentile(analytics.overallSuccessRate, populationStats.successRate) >= 75) {
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
                } else if (populationStats && calculatePercentile(analytics.overallSuccessRate, populationStats.successRate) >= 60) {
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
                if (populationStats && calculatePercentile(analytics.clutchPerformance, populationStats.clutchPerformance) >= 85 && analytics.clutchPerformance > 0) {
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
                } else if (populationStats && calculatePercentile(analytics.clutchPerformance, populationStats.clutchPerformance) >= 65 && analytics.clutchPerformance > 0) {
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
                if (populationStats && calculatePercentile(analytics.consistencyScore, populationStats.consistencyScore) >= 85) {
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
                } else if (populationStats && calculatePercentile(analytics.consistencyScore, populationStats.consistencyScore) >= 65) {
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
                
                // Constructive lower-end insights for newer/developing lifters
                if (populationStats && calculatePercentile(analytics.overallSuccessRate, populationStats.successRate) <= 40 && analytics.recentYoyTrend > 0) {
                  insights.push(
                    <MetricTooltip
                      key="learning-lifts"
                      title="Learning the Lifts"
                      description="Building technical foundation with positive improvement trend. Every elite lifter started here!"
                      methodology={`Success rate improving despite current ${getOrdinal(calculatePercentile(analytics.overallSuccessRate, populationStats.successRate))} percentile`}
                    >
                      <div className="text-cyan-400 cursor-help">• Learning the lifts</div>
                    </MetricTooltip>
                  );
                } else if (populationStats && calculatePercentile(analytics.overallSuccessRate, populationStats.successRate) <= 30 && analytics.totalCompetitions >= 3) {
                  insights.push(
                    <MetricTooltip
                      key="determined-competitor"
                      title="Determined Competitor"
                      description="Shows dedication by continuing to compete and improve despite current challenges."
                      methodology={`${analytics.totalCompetitions} competitions showing commitment to the sport`}
                    >
                      <div className="text-green-400 cursor-help">• Determined competitor</div>
                    </MetricTooltip>
                  );
                }
                
                // Big swing attempts (high variance strategy)
                if (analytics.attemptJumps.snatch.avgSecondToThird >= 8 || analytics.attemptJumps.cleanJerk.avgSecondToThird >= 12) {
                  insights.push(
                    <MetricTooltip
                      key="big-swing"
                      title="Big Swing Attempts"
                      description="Takes large jumps on final attempts, showing aggressive risk-taking for maximum results."
                      methodology={`Large final jumps: Snatch ${analytics.attemptJumps.snatch.avgSecondToThird}kg, C&J ${analytics.attemptJumps.cleanJerk.avgSecondToThird}kg`}
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
                
                if (analytics.isGlassCannon) {
                  insights.push(
                    <MetricTooltip
                      key="glass-cannon"
                      title="Glass Cannon"
                      description="High potential but inconsistent results. When they're on, they're really on!"
                      methodology="High Q-score potential with low consistency and recent decline"
                    >
                      <div className="text-orange-400 cursor-help">• Glass cannon</div>
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
        {populationStats && (
          <div className="mt-6 pt-4 border-t border-app-secondary">
            <div className="text-xs text-app-muted space-y-2">
              <div>
                <strong>Comparison Context:</strong> Percentiles based on{' '}
                {populationStats.successRate.sampleSize} unique {populationStats.successRate.demographicDescription}.{' '}
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
      </div>
    </div>
  );
}