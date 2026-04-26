'use client';

import { useState, useEffect } from 'react';

export interface PopulationMetric {
  percentile25: number;
  percentile50: number;
  percentile75: number;
  mean: number;
  sampleSize: number;
  distribution: number[]; // Full data array for accurate percentile calculation
  confidence: 'high' | 'moderate' | 'low';
  demographicDescription: string;
}

export interface PopulationStats {
  successRate: PopulationMetric;
  snatchSuccessRate: PopulationMetric;
  cleanJerkSuccessRate: PopulationMetric;
  consistencyScore: PopulationMetric;
  clutchPerformance: PopulationMetric;
  bounceBackRate: PopulationMetric;
  snatchBounceBackRate: PopulationMetric;
  cleanJerkBounceBackRate: PopulationMetric;
  competitionFrequency: PopulationMetric;
  qScorePerformance: PopulationMetric;
  openingStrategyRaw?: number;
  jumpPercentageRaw?: number;
}

interface DemographicFilter {
  ageCategory?: string;
  gender?: 'M' | 'F';
  competitionLevel?: string;
  weightClassRange?: string;
  dataSource?: 'usaw' | 'iwf';
}

function normalizeAgeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lc = raw.toLowerCase();
  if (lc.includes('age group') || lc.includes('youth') || lc.includes('under')) return 'Youth';
  if (lc.includes('junior')) return 'Junior';
  if (lc.includes('master')) return 'Masters';
  if (lc.includes('senior') || lc.includes('open')) return 'Senior';
  return null;
}

/**
 * usePopulationStats Hook
 * 
 * Performance Optimized (v7.0): 
 * This hook now prioritizes pre-computed 'population_percentiles' embedded directly 
 * in the athlete's JSON shard. This eliminates the need for the browser to fetch
 * and process the heavy 7MB distribution file.
 */
export function usePopulationStats(
  filter?: DemographicFilter, 
  precomputed?: any, 
  mode: 'career' | 'recent' = 'career',
  federation: 'usaw' | 'iwf' = 'usaw',
  perspective: string = 'age_group'
) {
  const [stats, setStats] = useState<PopulationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveStats() {
      // Support both new nested federation structure (v8.0) and legacy flat/dual objects
      let data = precomputed;
      let context = precomputed; // Parent context for sampleSize/bucket
      
      if (precomputed) {
        if (precomputed[federation]) {
          // New v8.0 structure: precomputed.usaw[perspective][mode]
          const fedData = precomputed[federation];
          if (fedData[perspective]) {
            context = fedData[perspective];
            data = fedData[perspective][mode] || fedData[perspective];
          } else {
            // Fallback to old structure if perspective keys are missing
            context = fedData;
            data = fedData[mode] || fedData;
          }
        } else if (precomputed[perspective]) {
          // Perspective-first structure
          context = precomputed[perspective];
          data = precomputed[perspective][mode] || precomputed[perspective];
        } else if (precomputed[mode]) {
          // Dual-mode structure: precomputed.career
          data = precomputed[mode];
          context = precomputed;
        }
      }

      const getMetricValue = (obj: any, key: string) => {
        if (!obj) return undefined;
        
        // Case 1: Nested metrics object (Historical)
        if (obj.metrics && obj.metrics[key]) {
          const m = obj.metrics[key];
          return typeof m === 'object' && m.percentile !== undefined ? m.percentile : m;
        }
        
        // Case 2: Direct property (Career/Recent)
        const val = obj[key];
        if (val !== undefined) {
          if (val && typeof val === 'object' && val.percentile !== undefined) {
            return val.percentile;
          }
          return val;
        }
        
        return undefined;
      };

      const hasData = getMetricValue(data, 'successRate') !== undefined;

      if (data && hasData) {
        const dummyMetric = (key: string): PopulationMetric => {
          const val = getMetricValue(data, key) || 0;
          return {
            percentile25: 0,
            percentile50: val, // We use p50 as the "actual" rank in this mode
            percentile75: 0,
            mean: 0,
            sampleSize: data.sampleSize || context.sampleSize || 0,
            distribution: [], // No distribution needed for direct ranks
            confidence: (data.sampleSize > 100 || context.sampleSize > 100) ? 'high' : 
                       (data.sampleSize > 25 || context.sampleSize > 25) ? 'moderate' : 'low',
            demographicDescription: (data.bucket || context.bucket || 'athletes')
              .split('_')
              .map(part => {
                if (part === 'usaw') return 'USAW';
                if (part === 'iwf') return 'IWF';
                if (part === 'M') return 'Male';
                if (part === 'F') return 'Female';
                return part;
              })
              .join(' ')
          };
        };

        setStats({
          successRate: dummyMetric('successRate'),
          snatchSuccessRate: dummyMetric('snatchSuccessRate'),
          cleanJerkSuccessRate: dummyMetric('cleanJerkSuccessRate'),
          consistencyScore: dummyMetric('consistencyScore'),
          clutchPerformance: dummyMetric('clutchPerformance'),
          bounceBackRate: dummyMetric('bounceBackRate'),
          snatchBounceBackRate: dummyMetric('snatchBounceBackRate'),
          cleanJerkBounceBackRate: dummyMetric('cleanJerkBounceBackRate'),
          competitionFrequency: dummyMetric('competitionFrequency'),
          qScorePerformance: dummyMetric('qScorePerformance'),
          openingStrategyRaw: data.openingStrategyRaw,
          jumpPercentageRaw: data.jumpPercentageRaw,
        });
        setLoading(false);
        return;
      }

      // MODE 2: Legacy Distribution Fetching (Safeguard / Fallback)
      // Note: This is preserved for local development or if shards are missing percentile data.
      /*
      const dataSource = filter?.dataSource || 'usaw';
      const normalizedAge = normalizeAgeCategory(filter?.ageCategory);
      let demographicKey = `${dataSource}_all`;
      if (filter?.gender && normalizedAge) {
        demographicKey = `${dataSource}_${filter.gender}_${normalizedAge}`;
      } else if (filter?.gender) {
        demographicKey = `${dataSource}_${filter.gender}`;
      } else if (normalizedAge) {
        demographicKey = `${dataSource}_${normalizedAge}`;
      }

      try {
        setLoading(true);
        const res = await fetch('/data/population_stats.json');
        if (res.ok) {
          const allStats = await res.json();
          const demographicStats = allStats[demographicKey] || allStats[`${dataSource}_all`] || allStats['usaw_all'];
          if (demographicStats) {
            setStats(demographicStats);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Fallback fetch failed');
      }
      */

      // MODE 3: Static Heuristic Fallback
      const means = filter?.dataSource === 'iwf' ? {
        successRate: 78, snatchSuccessRate: 75, cleanJerkSuccessRate: 81,
        consistencyScore: 77, clutchPerformance: 50, bounceBackRate: 64,
        snatchBounceBackRate: 60, cleanJerkBounceBackRate: 67,
        competitionFrequency: 2.8, qScorePerformance: 58
      } : {
        successRate: 76, snatchSuccessRate: 73, cleanJerkSuccessRate: 79,
        consistencyScore: 75, clutchPerformance: 47, bounceBackRate: 61,
        snatchBounceBackRate: 57, cleanJerkBounceBackRate: 64,
        competitionFrequency: 3.4, qScorePerformance: 54
      };

      const fallbackMetric = (mean: number): PopulationMetric => ({
        percentile25: 0, percentile50: 0, percentile75: 0, mean,
        sampleSize: 0, distribution: [], confidence: 'low',
        demographicDescription: 'athletes'
      });

      setStats({
        successRate: fallbackMetric(means.successRate),
        snatchSuccessRate: fallbackMetric(means.snatchSuccessRate),
        cleanJerkSuccessRate: fallbackMetric(means.cleanJerkSuccessRate),
        consistencyScore: fallbackMetric(means.consistencyScore),
        clutchPerformance: fallbackMetric(means.clutchPerformance),
        bounceBackRate: fallbackMetric(means.bounceBackRate),
        snatchBounceBackRate: fallbackMetric(means.snatchBounceBackRate),
        cleanJerkBounceBackRate: fallbackMetric(means.cleanJerkBounceBackRate),
        competitionFrequency: fallbackMetric(means.competitionFrequency),
        qScorePerformance: fallbackMetric(means.qScorePerformance)
      });
      setLoading(false);
    }

    resolveStats();
  }, [filter?.ageCategory, filter?.gender, filter?.dataSource, precomputed, mode, perspective]);

  return { stats, loading, error };
}
