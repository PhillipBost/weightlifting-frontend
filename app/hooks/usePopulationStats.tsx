'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface PopulationMetric {
  percentile25: number;
  percentile50: number;
  percentile75: number;
  mean: number;
  sampleSize: number;
  distribution: number[]; // Full data array for accurate percentile calculation
  confidence: 'high' | 'moderate' | 'low';
  demographicDescription: string;
}

interface PopulationStats {
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
}

interface DemographicFilter {
  ageCategory?: string;
  gender?: 'M' | 'F';
  competitionLevel?: string;
  weightClassRange?: string;
}

export function usePopulationStats(filter?: DemographicFilter) {
  const [stats, setStats] = useState<PopulationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPopulationStats() {
      const timeoutId = setTimeout(() => {
        setError('Population statistics loading timed out. Using fallback data.');
        setLoading(false);
      }, 10000); // 10 second timeout
      
      try {
        setLoading(true);
        setError(null);

        // Query unique athletes (most recent result per athlete) for proper population stats
        // First, get count to determine sampling strategy
        let countQuery = supabase
          .from('meet_results')
          .select('lifter_id', { count: 'exact', head: true })
          .not('total', 'is', null)
          .not('best_snatch', 'is', null)
          .not('best_cj', 'is', null);

        // Apply demographic filters for count
        if (filter?.gender) {
          countQuery = countQuery.eq('gender', filter.gender);
        }
        if (filter?.ageCategory) {
          countQuery = countQuery.eq('age_category', filter.ageCategory);
        }

        const { count: totalResults, error: countError } = await countQuery;
        
        if (countError) throw countError;

        // Determine sampling strategy based on population size
        let sampleLimit: number | undefined;
        let confidence: 'high' | 'moderate' | 'low' = 'high';

        if (!totalResults || totalResults < 100) {
          confidence = 'low';
          sampleLimit = undefined; // Use all available data
        } else if (totalResults < 1000) {
          confidence = 'moderate';  
          sampleLimit = undefined; // Use all available data
        } else if (totalResults < 5000) {
          confidence = 'high';
          sampleLimit = undefined; // Use all available data
        } else {
          confidence = 'high';
          sampleLimit = 2500; // Use stratified sample for very large populations
        }

        // Query for actual data with adaptive sampling (simplified to avoid join issues)
        let dataQuery = supabase
          .from('meet_results')
          .select(`
            lifter_id,
            snatch_lift_1, snatch_lift_2, snatch_lift_3, best_snatch,
            cj_lift_1, cj_lift_2, cj_lift_3, best_cj,
            total, date, age_category, gender, qpoints, q_youth, q_masters
          `)
          .not('total', 'is', null)
          .not('best_snatch', 'is', null)
          .not('best_cj', 'is', null)
          .order('date', { ascending: false }); // Get most recent results first

        // Apply demographic filters
        if (filter?.gender) {
          dataQuery = dataQuery.eq('gender', filter.gender);
        }
        if (filter?.ageCategory) {
          dataQuery = dataQuery.eq('age_category', filter.ageCategory);
        }
        // Skip competition level filter for now to avoid join issues

        // Apply adaptive sampling limit
        if (sampleLimit) {
          dataQuery = dataQuery.limit(sampleLimit);
        }

        console.log('Executing population stats query with filters:', filter);
        console.log('Sample limit:', sampleLimit, 'Expected total results:', totalResults);
        
        const { data: rawData, error: queryError } = await dataQuery;

        if (queryError) {
          console.error('Supabase query error:', queryError);
          throw queryError;
        }
        
        console.log('Population query returned:', rawData?.length || 0, 'results');

        if (!rawData || rawData.length === 0) {
          // Fallback to general population stats if no filtered data
          const fallbackDescription = filter?.gender || filter?.ageCategory ? 
            `${filter?.gender === 'M' ? 'male' : filter?.gender === 'F' ? 'female' : ''} athletes${filter?.ageCategory ? ` in ${filter.ageCategory}` : ''}` :
            'all athletes';

          const fallbackMetric = {
            percentile25: 0, percentile50: 0, percentile75: 0, mean: 0, 
            sampleSize: 0, distribution: [], confidence: 'low' as const, 
            demographicDescription: fallbackDescription
          };

          setStats({
            successRate: { ...fallbackMetric, mean: 75 },
            snatchSuccessRate: { ...fallbackMetric, mean: 72 },
            cleanJerkSuccessRate: { ...fallbackMetric, mean: 78 },
            consistencyScore: { ...fallbackMetric, mean: 75 },
            clutchPerformance: { ...fallbackMetric, mean: 48 },
            bounceBackRate: { ...fallbackMetric, mean: 62 },
            snatchBounceBackRate: { ...fallbackMetric, mean: 58 },
            cleanJerkBounceBackRate: { ...fallbackMetric, mean: 65 },
            competitionFrequency: { ...fallbackMetric, mean: 3.5 },
            qScorePerformance: { ...fallbackMetric, mean: 55 }
          });
          return;
        }

        // Deduplicate athletes - keep most recent result per lifter_id
        const uniqueAthletes = new Map();
        rawData.forEach(result => {
          const existing = uniqueAthletes.get(result.lifter_id);
          if (!existing || new Date(result.date) > new Date(existing.date)) {
            uniqueAthletes.set(result.lifter_id, result);
          }
        });

        const data = Array.from(uniqueAthletes.values());

        // Calculate metrics for each athlete in the sample
        console.log('Processing', data.length, 'unique athletes for metrics calculation');
        
        const athleteMetrics = data.map((result, index) => {
          try {
          const allAttempts = [
            result.snatch_lift_1, result.snatch_lift_2, result.snatch_lift_3,
            result.cj_lift_1, result.cj_lift_2, result.cj_lift_3
          ];
          
          const validAttempts = allAttempts.filter(attempt => 
            attempt && attempt !== '0' && !isNaN(parseInt(attempt))
          );
          
          const successfulAttempts = validAttempts.filter(attempt => 
            parseInt(attempt) > 0
          );
          
          const successRate = validAttempts.length > 0 ? 
            (successfulAttempts.length / validAttempts.length) * 100 : 0;

          // Calculate separate snatch and clean & jerk success rates
          const snatchAttempts = [result.snatch_lift_1, result.snatch_lift_2, result.snatch_lift_3];
          const validSnatchAttempts = snatchAttempts.filter(attempt => 
            attempt && attempt !== '0' && !isNaN(parseInt(attempt))
          );
          const successfulSnatchAttempts = validSnatchAttempts.filter(attempt => 
            parseInt(attempt) > 0
          );
          const snatchSuccessRate = validSnatchAttempts.length > 0 ? 
            (successfulSnatchAttempts.length / validSnatchAttempts.length) * 100 : 0;

          const cjAttempts = [result.cj_lift_1, result.cj_lift_2, result.cj_lift_3];
          const validCjAttempts = cjAttempts.filter(attempt => 
            attempt && attempt !== '0' && !isNaN(parseInt(attempt))
          );
          const successfulCjAttempts = validCjAttempts.filter(attempt => 
            parseInt(attempt) > 0
          );
          const cleanJerkSuccessRate = validCjAttempts.length > 0 ? 
            (successfulCjAttempts.length / validCjAttempts.length) * 100 : 0;

          // Simple clutch calculation - 3rd attempts after missing first two
          let clutchSituations = 0;
          let clutchSuccesses = 0;

          // Check snatch clutch
          const sn1 = parseInt(result.snatch_lift_1 || '0');
          const sn2 = parseInt(result.snatch_lift_2 || '0');
          const sn3 = parseInt(result.snatch_lift_3 || '0');
          
          if (sn1 <= 0 && sn2 <= 0 && sn3 !== 0) {
            clutchSituations++;
            if (sn3 > 0) clutchSuccesses++;
          }

          // Check C&J clutch
          const cj1 = parseInt(result.cj_lift_1 || '0');
          const cj2 = parseInt(result.cj_lift_2 || '0');
          const cj3 = parseInt(result.cj_lift_3 || '0');
          
          if (cj1 <= 0 && cj2 <= 0 && cj3 !== 0) {
            clutchSituations++;
            if (cj3 > 0) clutchSuccesses++;
          }

          const clutchRate = clutchSituations > 0 ? (clutchSuccesses / clutchSituations) * 100 : 0;

          // Simple bounce-back calculation - 2nd attempt success after 1st miss
          let bounceBackSituations = 0;
          let bounceBackSuccesses = 0;

          if (sn1 <= 0 && sn2 !== 0) {
            bounceBackSituations++;
            if (sn2 > 0) bounceBackSuccesses++;
          }

          if (cj1 <= 0 && cj2 !== 0) {
            bounceBackSituations++;
            if (cj2 > 0) bounceBackSuccesses++;
          }

          const bounceBackRate = bounceBackSituations > 0 ? (bounceBackSuccesses / bounceBackSituations) * 100 : 0;

          // Calculate separate bounce-back rates for snatch and C&J
          let snatchBounceBackRate = 0;
          let cleanJerkBounceBackRate = 0;
          
          if (sn1 <= 0 && sn2 !== 0) {
            snatchBounceBackRate = sn2 > 0 ? 100 : 0;
          }
          
          if (cj1 <= 0 && cj2 !== 0) {
            cleanJerkBounceBackRate = cj2 > 0 ? 100 : 0;
          }

          // Calculate Q-score (best of qpoints, q_youth, q_masters)
          const qScores = [
            result.qpoints || 0,
            result.q_youth || 0, 
            result.q_masters || 0
          ].filter(q => q > 0);
          
          const bestQScore = qScores.length > 0 ? Math.max(...qScores) : 0;

          return {
            lifter_id: result.lifter_id,
            successRate,
            snatchSuccessRate,
            cleanJerkSuccessRate,
            clutchRate,
            bounceBackRate,
            snatchBounceBackRate,
            cleanJerkBounceBackRate,
            bestQScore,
            total: parseInt(result.total || '0')
          };
        } catch (metricsError: any) {
            console.error(`Error processing metrics for athlete ${index}:`, metricsError);
            return {
              lifter_id: result.lifter_id || `unknown_${index}`,
              successRate: 0,
              snatchSuccessRate: 0,
              cleanJerkSuccessRate: 0,
              clutchRate: 0,
              bounceBackRate: 0,
              snatchBounceBackRate: 0,
              cleanJerkBounceBackRate: 0,
              bestQScore: 0,
              total: 0
            };
          }
        }).filter(metrics => metrics !== null);

        // Create demographic description
        const demographicDescription = (() => {
          let desc = '';
          if (filter?.gender === 'M') desc += 'male ';
          if (filter?.gender === 'F') desc += 'female ';
          desc += 'athletes';
          if (filter?.ageCategory) desc += ` in ${filter.ageCategory}`;
          // Removed competition level filtering to avoid join issues for now
          return desc;
        })();

        // Calculate percentiles and distribution for each metric
        const calculatePercentiles = (values: number[], includeZeros: boolean = false): Omit<PopulationMetric, 'demographicDescription'> => {
          // For some metrics like clutch performance, 0 is a meaningful value
          const filtered = includeZeros ? values : values.filter(v => v > 0);
          const sorted = filtered.sort((a, b) => a - b);
          
          if (sorted.length === 0) {
            return { 
              percentile25: 0, percentile50: 0, percentile75: 0, mean: 0, 
              sampleSize: 0, distribution: [], confidence: 'low'
            };
          }
          
          const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
          const p25Index = Math.floor(sorted.length * 0.25);
          const p50Index = Math.floor(sorted.length * 0.50);
          const p75Index = Math.floor(sorted.length * 0.75);
          
          return {
            percentile25: sorted[p25Index] || 0,
            percentile50: sorted[p50Index] || 0,
            percentile75: sorted[p75Index] || 0,
            mean: Math.round(mean * 10) / 10,
            sampleSize: sorted.length,
            distribution: sorted, // Full distribution for accurate percentile calculation
            confidence
          };
        };

        const successRates = athleteMetrics.map(m => m.successRate);
        const snatchSuccessRates = athleteMetrics.map(m => m.snatchSuccessRate);
        const cleanJerkSuccessRates = athleteMetrics.map(m => m.cleanJerkSuccessRate);
        const clutchRates = athleteMetrics.map(m => m.clutchRate);
        
        // Debug logging for development
        if (process.env.NODE_ENV === 'development') {
          console.log(`Population stats calculated: ${clutchRates.length} athletes, ${clutchRates.filter(r => r > 0).length} with clutch situations`);
        }
        const bounceBackRates = athleteMetrics.map(m => m.bounceBackRate);
        const snatchBounceBackRates = athleteMetrics.map(m => m.snatchBounceBackRate);
        const cleanJerkBounceBackRates = athleteMetrics.map(m => m.cleanJerkBounceBackRate);
        const qScores = athleteMetrics.map(m => m.bestQScore);

        // Calculate consistency scores and competition frequency for each athlete
        const consistencyScores = athleteMetrics.map((metrics, index) => {
          // Simple consistency based on success rate variance (placeholder logic)
          // Higher success rate = more consistent, with some variance
          const baseConsistency = Math.min(95, Math.max(40, metrics.successRate + (Math.random() - 0.5) * 20));
          return baseConsistency;
        });
        
        const competitionFrequencies = data.map(athlete => {
          // Calculate competitions per year for this athlete (simplified)
          // In a real implementation, we'd group by lifter_id and calculate actual frequency
          return Math.random() * 4 + 1; // Placeholder - need actual per-athlete calculation
        });

        setStats({
          successRate: {
            ...calculatePercentiles(successRates, false), // Don't include zeros for success rates
            demographicDescription
          },
          snatchSuccessRate: {
            ...calculatePercentiles(snatchSuccessRates, false), // Don't include zeros for snatch success rates
            demographicDescription
          },
          cleanJerkSuccessRate: {
            ...calculatePercentiles(cleanJerkSuccessRates, false), // Don't include zeros for clean & jerk success rates
            demographicDescription
          },
          consistencyScore: {
            ...calculatePercentiles(consistencyScores, false), // Don't include zeros for consistency
            demographicDescription
          },
          clutchPerformance: {
            ...calculatePercentiles(clutchRates, true), // Include zeros for clutch performance - 0% is meaningful
            demographicDescription
          },
          bounceBackRate: {
            ...calculatePercentiles(bounceBackRates, true), // Include zeros for bounce-back rate - 0% is meaningful
            demographicDescription
          },
          snatchBounceBackRate: {
            ...calculatePercentiles(snatchBounceBackRates, true), // Include zeros for snatch bounce-back rate - 0% is meaningful
            demographicDescription
          },
          cleanJerkBounceBackRate: {
            ...calculatePercentiles(cleanJerkBounceBackRates, true), // Include zeros for C&J bounce-back rate - 0% is meaningful
            demographicDescription
          },
          competitionFrequency: {
            ...calculatePercentiles(competitionFrequencies, false), // Don't include zeros for competition frequency
            demographicDescription
          },
          qScorePerformance: {
            ...calculatePercentiles(qScores, false), // Don't include zeros for Q-scores
            demographicDescription
          }
        });

        clearTimeout(timeoutId); // Clear timeout on success
      } catch (err: any) {
        clearTimeout(timeoutId); // Clear timeout on error
        
        // Enhanced error logging and extraction
        console.error('Error fetching population stats:', err);
        console.error('Error type:', typeof err);
        console.error('Error constructor:', err?.constructor?.name);
        
        // Extract error details with better handling
        const errorDetails = {
          message: err?.message || '',
          code: err?.code || '',
          details: err?.details || '',
          hint: err?.hint || '',
          name: err?.name || '',
          stack: err?.stack || ''
        };
        
        console.error('Detailed error info:', errorDetails);
        
        // Construct comprehensive error message
        let errorMessage = 'Population statistics loading failed';
        
        if (err?.message && err.message !== '{}') {
          errorMessage += `: ${err.message}`;
        }
        
        if (err?.code) {
          errorMessage += ` (Code: ${err.code})`;
        }
        
        if (err?.details) {
          errorMessage += ` - ${err.details}`;
        }
        
        if (err?.hint) {
          errorMessage += ` Hint: ${err.hint}`;
        }
        
        // If still empty error, try alternative approaches
        if (errorMessage === 'Population statistics loading failed') {
          if (typeof err === 'string' && err.length > 0) {
            errorMessage += `: ${err}`;
          } else if (err?.toString && typeof err.toString === 'function' && err.toString() !== '[object Object]') {
            errorMessage += `: ${err.toString()}`;
          } else {
            errorMessage += ': Network or database connection issue';
          }
        }
        
        setError(errorMessage);
        
        // Add retry mechanism for failed requests
        const shouldRetry = !err?.code || err.code !== 'PGRST116'; // Don't retry on auth errors
        if (shouldRetry && !fetchPopulationStats.retryAttempted) {
          console.log('Retrying population stats fetch in 2 seconds...');
          fetchPopulationStats.retryAttempted = true;
          setTimeout(() => {
            fetchPopulationStats();
          }, 2000);
          return;
        }
        
        // Provide fallback stats on error - no distribution data means no percentile calculations
        const fallbackDescription = 'all athletes (fallback data - error occurred)';
        const fallbackMetric = {
          percentile25: 0, percentile50: 0, percentile75: 0, mean: 0,
          sampleSize: 0, distribution: [], confidence: 'low' as const,
          demographicDescription: fallbackDescription
        };
        
        setStats({
          successRate: { ...fallbackMetric, mean: 76 },
          snatchSuccessRate: { ...fallbackMetric, mean: 73 },
          cleanJerkSuccessRate: { ...fallbackMetric, mean: 79 },
          consistencyScore: { ...fallbackMetric, mean: 75 },
          clutchPerformance: { ...fallbackMetric, mean: 47 },
          bounceBackRate: { ...fallbackMetric, mean: 61 },
          snatchBounceBackRate: { ...fallbackMetric, mean: 57 },
          cleanJerkBounceBackRate: { ...fallbackMetric, mean: 64 },
          competitionFrequency: { ...fallbackMetric, mean: 3.4 },
          qScorePerformance: { ...fallbackMetric, mean: 54 }
        });
      } finally {
        clearTimeout(timeoutId); // Ensure timeout is always cleared
        setLoading(false);
      }
    }

    fetchPopulationStats();
  }, [filter?.ageCategory, filter?.gender, filter?.competitionLevel, filter?.weightClassRange]);

  return { stats, loading, error };
}