"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Trophy, Calendar, Weight, TrendingUp, Medal, User, Building, MapPin, ExternalLink, ArrowLeft, BarChart3, Dumbbell } from 'lucide-react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveScatterPlot } from '@nivo/scatterplot';

const LiftAttempts = ({ lift1, lift2, lift3, best, type }) => {
  const attempts = [lift1, lift2, lift3];
  
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-gray-300">{type}</div>
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
                  ? 'bg-green-600 text-white' 
                  : isGood 
                    ? 'bg-gray-600 text-white'
                    : value < 0
                      ? 'bg-red-900 text-red-300'
                      : 'bg-gray-800 text-gray-500'
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
      <div className="text-lg font-bold text-white">
        Best: {best && parseInt(best) > 0 ? `${best}kg` : '-'}
      </div>
    </div>
  );
};

export default function AthletePage({ params }: { params: Promise<{ id: string }> }) {
  const [athlete, setAthlete] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          .select('*')
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

  // Calculate personal bests from results
  const personalBests = results.length > 0 ? {
    best_snatch: Math.max(...results.map(r => parseInt(r.best_snatch || '0')).filter(v => v > 0)),
    best_cj: Math.max(...results.map(r => parseInt(r.best_cj || '0')).filter(v => v > 0)),
    best_total: Math.max(...results.map(r => parseInt(r.total || '0')).filter(v => v > 0)),
    best_qpoints: Math.max(...results.map(r => r.qpoints || 0).filter(v => v > 0))
  } : { best_snatch: 0, best_cj: 0, best_total: 0, best_qpoints: 0 };

  // Prepare main line chart data for performance progress
  const mainChartData = React.useMemo(() => {
    const validResults = results
      .filter(r => r.date && (r.best_snatch || r.best_cj || r.total))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (validResults.length === 0) return [];

    // Create a complete timeline with all competitions
    const allCompetitions = validResults.map(r => ({
      date: r.date,
      dateLabel: r.competition_age 
        ? `${new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${r.competition_age})`
        : new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      meet: r.meet_name || 'Unknown Meet',
      competitionAge: r.competition_age,
      snatch: r.best_snatch && parseInt(r.best_snatch) > 0 ? parseInt(r.best_snatch) : null,
      cleanJerk: r.best_cj && parseInt(r.best_cj) > 0 ? parseInt(r.best_cj) : null,
      total: r.total && parseInt(r.total) > 0 ? parseInt(r.total) : null
    }));

    const series = [];

    // Snatch series - include nulls to maintain timeline
    const snatchData = allCompetitions.map(comp => ({
      x: comp.dateLabel,
      y: comp.snatch,
      meet: comp.meet,
      date: comp.date,
      competitionAge: comp.competitionAge
    }));

    series.push({
      id: "Snatch",
      color: "#3B82F6",
      data: snatchData
    });

    // Clean & Jerk series - include nulls to maintain timeline
    const cleanJerkData = allCompetitions.map(comp => ({
      x: comp.dateLabel,
      y: comp.cleanJerk,
      meet: comp.meet,
      date: comp.date,
      competitionAge: comp.competitionAge
    }));

    series.push({
      id: "Clean & Jerk",
      color: "#10B981",
      data: cleanJerkData
    });

    // Total series - include nulls to maintain timeline
    const totalData = allCompetitions.map(comp => ({
      x: comp.dateLabel,
      y: comp.total,
      meet: comp.meet,
      date: comp.date,
      competitionAge: comp.competitionAge
    }));

    series.push({
      id: "Total",
      color: "#F59E0B",
      data: totalData
    });

    return series;
  }, [results]);

  // Prepare scatter plot data for individual attempts
  const attemptData = React.useMemo(() => {
    const validResults = results
      .filter(r => r.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const scatterData = [];

    // Process each competition result
    validResults.forEach((result, resultIndex) => {
      const dateLabel = new Date(result.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Snatch attempts
      [result.snatch_lift_1, result.snatch_lift_2, result.snatch_lift_3].forEach((attempt, attemptIndex) => {
        if (attempt && attempt !== '0') {
          const weight = parseInt(attempt);
          const isGood = weight > 0;
          
          scatterData.push({
            id: `snatch-${resultIndex}-${attemptIndex}`,
            data: [{
              x: resultIndex,
              y: Math.abs(weight),
              lift: 'Snatch',
              attempt: attemptIndex + 1,
              success: isGood,
              meet: result.meet_name,
              date: dateLabel,
              weight: Math.abs(weight)
            }]
          });
        }
      });

      // Clean & Jerk attempts
      [result.cj_lift_1, result.cj_lift_2, result.cj_lift_3].forEach((attempt, attemptIndex) => {
        if (attempt && attempt !== '0') {
          const weight = parseInt(attempt);
          const isGood = weight > 0;
          
          scatterData.push({
            id: `cj-${resultIndex}-${attemptIndex}`,
            data: [{
              x: resultIndex,
              y: Math.abs(weight),
              lift: 'Clean & Jerk',
              attempt: attemptIndex + 1,
              success: isGood,
              meet: result.meet_name,
              date: dateLabel,
              weight: Math.abs(weight)
            }]
          });
        }
      });
    });

    return scatterData;
  }, [results]);

  // Q-Points chart data
  const qPointsData = React.useMemo(() => {
    const validResults = results
      .filter(r => r.date && (r.qpoints || r.q_youth || r.q_masters))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (validResults.length === 0) return [];

    // Create timeline for Q-scores using actual dates
    const allCompetitions = validResults.map(r => ({
      date: r.date,
      dateObj: new Date(r.date),
      dateLabel: r.competition_age 
        ? `${new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} (${r.competition_age})`
        : new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      meet: r.meet_name || 'Unknown Meet',
      competitionAge: r.competition_age,
      qpoints: r.qpoints && r.qpoints > 0 ? r.qpoints : null,
      qYouth: r.q_youth && r.q_youth > 0 ? r.q_youth : null,
      qMasters: r.q_masters && r.q_masters > 0 ? r.q_masters : null
    }));

    const series = [];

    // Check if we have any valid data for each series
    const hasQPoints = allCompetitions.some(comp => comp.qpoints !== null);
    const hasQYouth = allCompetitions.some(comp => comp.qYouth !== null);
    const hasQMasters = allCompetitions.some(comp => comp.qMasters !== null);

    // Q-Points series
    if (hasQPoints) {
      const qPointsArray = allCompetitions.map(comp => ({
        x: comp.dateObj,
        y: comp.qpoints,
        meet: comp.meet,
        date: comp.date,
        dateLabel: comp.dateLabel,
        competitionAge: comp.competitionAge
      }));

      series.push({
        id: "Q-Points",
        color: "#8B5CF6",
        data: qPointsArray
      });
    }

    // Q-Youth series
    if (hasQYouth) {
      const qYouthArray = allCompetitions.map(comp => ({
        x: comp.dateObj,
        y: comp.qYouth,
        meet: comp.meet,
        date: comp.date,
        dateLabel: comp.dateLabel,
        competitionAge: comp.competitionAge
      }));

      series.push({
        id: "Q-Youth",
        color: "#06B6D4",
        data: qYouthArray
      });
    }

    // Q-Masters series
    if (hasQMasters) {
      const qMastersArray = allCompetitions.map(comp => ({
        x: comp.dateObj,
        y: comp.qMasters,
        meet: comp.meet,
        date: comp.date,
        dateLabel: comp.dateLabel,
        competitionAge: comp.competitionAge
      }));

      series.push({
        id: "Q-Masters",
        color: "#F97316",
        data: qMastersArray
      });
    }

    return series;
  }, [results]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-lg text-gray-300">Loading athlete data...</p>
        </div>
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Loading Athlete</h1>
          <p className="text-gray-300 mb-4">{error || 'Athlete not found'}</p>
          <button 
            onClick={() => window.history.back()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Search</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button className="flex items-center space-x-2 text-gray-300 hover:text-blue-400 transition-colors">
                <ExternalLink className="h-4 w-4" />
                <span>External Profile</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Athlete Header */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8 border border-gray-700">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between">
            <div className="flex items-start space-x-6">
              <div className="bg-gray-700 rounded-full p-4">
                <User className="h-12 w-12 text-gray-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{athlete.athlete_name}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                  {athlete.wso && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>WSO: {athlete.wso}</span>
                    </div>
                  )}
                  {athlete.club_name && (
                    <div className="flex items-center space-x-1">
                      <Dumbbell className="h-4 w-4" />
                      <span>Club: {athlete.club_name}</span>
                    </div>
                  )}
                  {athlete.national_rank && (
                    <div className="flex items-center space-x-1">
                      <Medal className="h-4 w-4" />
                      <span>National Rank: #{athlete.national_rank}</span>
                    </div>
                  )}
                  {athlete.membership_number && (
                    <div className="flex items-center space-x-1">
                      <span>Member #{athlete.membership_number}</span>
                    </div>
                  )}
                  {athlete.gender && (
                    <div className="flex items-center space-x-1">
                      <span>{athlete.gender === 'M' ? 'Male' : 'Female'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Charts */}
        {mainChartData.length > 0 && (
          <div className="space-y-8 mb-8">
            {/* Progress Over Time Chart - Full Width */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Performance Progress
              </h3>
              <div style={{ height: '600px' }}>
                <ResponsiveLine
                  data={mainChartData}
                  margin={{ top: 50, right: 130, bottom: 100, left: 80 }}
                  xScale={{ type: 'point' }}
                  yScale={{
                    type: 'linear',
                    min: 'auto',
                    max: 'auto',
                    stacked: false,
                    reverse: false
                  }}
                  curve="monotoneX"
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    legend: 'Competition Date (Competition Age)',
                    legendOffset: 80,
                    legendPosition: 'middle',
                    tickValues: mainChartData[0]?.data.length > 12 
                      ? mainChartData[0].data
                          .filter((_, index) => index % Math.ceil(mainChartData[0].data.length / 10) === 0)
                          .map(d => d.x)
                      : undefined
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Weight (kg)',
                    legendOffset: -60,
                    legendPosition: 'middle'
                  }}
                  pointSize={10}
                  pointBorderWidth={0}
                  colors={["#3B82F6", "#10B981", "#F59E0B"]}
                  pointLabelYOffset={-12}
                  enablePoints={true}
                  enablePointLabel={false}
                  useMesh={true}
                  enableSlices="x"
                  lineWidth={3}
                  tooltip={({ point }) => {
                    const { data } = point;
                    if (!data.y || data.y === null) return null;
                    
                    return (
                      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                        <div className="text-white font-medium mb-1">
                          {data.meet} - {data.x}
                        </div>
                        <div style={{ color: point.serieColor }}>
                          {point.serieId}: {data.yFormatted}kg
                        </div>
                        {data.competitionAge && (
                          <div className="text-gray-300 text-sm">
                            Age: {data.competitionAge}
                          </div>
                        )}
                      </div>
                    );
                  }}
                  sliceTooltip={({ slice }) => {
                    return (
                      <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                        <div className="text-white font-medium mb-2">
                          {slice.points[0]?.data?.meet} - {slice.points[0]?.data?.dateLabel}
                        </div>
                        {slice.points.map((point, index) => {
                          if (!point.data.y || point.data.y === null) return null;
                          return (
                            <div key={index} style={{ color: point.serieColor }} className="flex justify-between">
                              <span>{point.serieId}:</span>
                              <span className="ml-2 font-bold">{point.data.yFormatted}kg</span>
                            </div>
                          );
                        }).filter(Boolean)}
                        {slice.points[0]?.data?.competitionAge && (
                          <div className="text-gray-300 text-sm mt-1">
                            Age: {slice.points[0].data.competitionAge}
                          </div>
                        )}
                      </div>
                    );
                  }}
                  legends={[
                    {
                      anchor: 'bottom-right',
                      direction: 'column',
                      justify: false,
                      translateX: 100,
                      translateY: 0,
                      itemsSpacing: 8,
                      itemDirection: 'left-to-right',
                      itemWidth: 80,
                      itemHeight: 20,
                      itemOpacity: 0.75,
                      symbolSize: 14,
                      symbolShape: 'circle',
                      symbolBorderColor: 'rgba(0, 0, 0, .5)',
                      effects: [
                        {
                          on: 'hover',
                          style: {
                            itemBackground: 'rgba(0, 0, 0, .03)',
                            itemOpacity: 1
                          }
                        }
                      ]
                    }
                  ]}
                  theme={{
                    background: 'transparent',
                    text: { fill: '#9CA3AF', fontSize: 12 },
                    axis: {
                      domain: { line: { stroke: '#374151', strokeWidth: 1 } },
                      ticks: { line: { stroke: '#374151', strokeWidth: 1 } }
                    },
                    grid: { line: { stroke: '#374151', strokeDasharray: '3 3' } },
                    tooltip: {
                      container: {
                        background: '#1F2937',
                        color: '#F3F4F6',
                        fontSize: '14px',
                        borderRadius: '8px',
                        border: '1px solid #374151'
                      }
                    },
                    legends: {
                      text: { fill: '#9CA3AF' }
                    }
                  }}
                />
              </div>
            </div>

            {/* Q-Points Chart - Full Width */}
            {qPointsData.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Q-Scores Over Time
                </h3>
                <div style={{ height: '600px' }}>
                  <ResponsiveLine
                    data={qPointsData}
                    margin={{ top: 50, right: 130, bottom: 100, left: 80 }}
                    xScale={{ type: 'point' }}
                    yScale={{
                      type: 'linear',
                      min: 'auto',
                      max: 'auto',
                      stacked: false,
                      reverse: false
                    }}
                    curve="monotoneX"
                    axisTop={null}
                    axisRight={null}
                    axisBottom={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: -45,
                      legend: 'Competition Date (Competition Age)',
                      legendOffset: 80,
                      legendPosition: 'middle',
                      tickValues: qPointsData[0]?.data.length > 12 
                        ? qPointsData[0].data
                            .filter((_, index) => index % Math.ceil(qPointsData[0].data.length / 10) === 0)
                            .map(d => d.x)
                        : undefined
                    }}
                    axisLeft={{
                      tickSize: 5,
                      tickPadding: 5,
                      tickRotation: 0,
                      legend: 'Q-Score',
                      legendOffset: -60,
                      legendPosition: 'middle'
                    }}
                    pointSize={10}
                    pointBorderWidth={0}
                    colors={(serie) => {
                      if (serie.id === "Q-Points") return "#8B5CF6";
                      if (serie.id === "Q-Youth") return "#06B6D4";
                      if (serie.id === "Q-Masters") return "#F97316";
                      return "#8B5CF6";
                    }}
                    pointLabelYOffset={-12}
                    enablePoints={true}
                    enablePointLabel={false}
                    useMesh={true}
                    enableSlices="x"
                    lineWidth={3}
                    tooltip={({ point }) => {
                      const { data } = point;
                      if (!data.y || data.y === null) return null;
                      
                      return (
                        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                          <div className="text-white font-medium mb-1">
                            {data.meet} - {data.x}
                          </div>
                          <div style={{ color: point.serieColor }}>
                            {point.serieId}: {data.yFormatted}
                          </div>
                          {data.competitionAge && (
                            <div className="text-gray-300 text-sm">
                              Age: {data.competitionAge}
                            </div>
                          )}
                        </div>
                      );
                    }}
                    sliceTooltip={({ slice }) => {
                      return (
                        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3">
                          <div className="text-white font-medium mb-2">
                            {slice.points[0]?.data?.meet} - {slice.points[0]?.data?.dateLabel}
                          </div>
                          {slice.points.map((point, index) => {
                            if (!point.data.y || point.data.y === null) return null;
                            return (
                              <div key={index} style={{ color: point.serieColor }} className="flex justify-between">
                                <span>{point.serieId}:</span>
                                <span className="ml-2 font-bold">{point.data.yFormatted}</span>
                              </div>
                            );
                          }).filter(Boolean)}
                          {slice.points[0]?.data?.competitionAge && (
                            <div className="text-gray-300 text-sm mt-1">
                              Age: {slice.points[0].data.competitionAge}
                            </div>
                          )}
                        </div>
                      );
                    }}
                    legends={[
                      {
                        anchor: 'bottom-right',
                        direction: 'column',
                        justify: false,
                        translateX: 100,
                        translateY: 0,
                        itemsSpacing: 8,
                        itemDirection: 'left-to-right',
                        itemWidth: 80,
                        itemHeight: 20,
                        itemOpacity: 0.75,
                        symbolSize: 14,
                        symbolShape: 'circle',
                        symbolBorderColor: 'rgba(0, 0, 0, .5)',
                        effects: [
                          {
                            on: 'hover',
                            style: {
                              itemBackground: 'rgba(0, 0, 0, .03)',
                              itemOpacity: 1
                            }
                          }
                        ]
                      }
                    ]}
                    theme={{
                      background: 'transparent',
                      text: { fill: '#9CA3AF', fontSize: 12 },
                      axis: {
                        domain: { line: { stroke: '#374151', strokeWidth: 1 } },
                        ticks: { line: { stroke: '#374151', strokeWidth: 1 } }
                      },
                      grid: { line: { stroke: '#374151', strokeDasharray: '3 3' } },
                      tooltip: {
                        container: {
                          background: '#1F2937',
                          color: '#F3F4F6',
                          fontSize: '14px',
                          borderRadius: '8px',
                          border: '1px solid #374151'
                        }
                      },
                      legends: {
                        text: { fill: '#9CA3AF' }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Personal Bests Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-300">Best Snatch</h3>
              <Weight className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {personalBests.best_snatch > 0 ? `${personalBests.best_snatch}kg` : 'N/A'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-300">Best C&J</h3>
              <Weight className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {personalBests.best_cj > 0 ? `${personalBests.best_cj}kg` : 'N/A'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-300">Best Total</h3>
              <Trophy className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {personalBests.best_total > 0 ? `${personalBests.best_total}kg` : 'N/A'}
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-300">Best Q-Points</h3>
              <TrendingUp className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {personalBests.best_qpoints > 0 ? personalBests.best_qpoints.toFixed(1) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Competition Results */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Competition Results
            </h2>
          </div>
          
          <div className="p-6">
            {results.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No competition results found for this athlete.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {results.map((result, index) => (
                  <div key={index} className="bg-gray-700 rounded-xl p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{result.meet_name || 'Unknown Competition'}</h3>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-300 mt-1">
                          {result.date && <span>{result.date}</span>}
                          {result.weight_class && <span>{result.weight_class}</span>}
                          {result.body_weight_kg && <span>Body Weight: {result.body_weight_kg}kg</span>}
                          {result.qpoints && <span>Q-Points: {result.qpoints}</span>}
                          {result.age_category && <span>{result.age_category}</span>}
                        </div>
                      </div>
                      <div className="text-right mt-4 lg:mt-0">
                        <div className="text-2xl font-bold text-white">{result.total || '-'}kg</div>
                        <div className="text-sm text-gray-400">Total</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <LiftAttempts 
                        lift1={result.snatch_lift_1}
                        lift2={result.snatch_lift_2} 
                        lift3={result.snatch_lift_3}
                        best={result.best_snatch}
                        type="Snatch"
                      />
                      <LiftAttempts
                        lift1={result.cj_lift_1}
                        lift2={result.cj_lift_2}
                        lift3={result.cj_lift_3} 
                        best={result.best_cj}
                        type="Clean & Jerk"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}