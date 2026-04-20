"use client";

import React from 'react';
import dynamic from 'next/dynamic';

import { PerformanceSkeleton, QScoreSkeleton, GamxSkeleton } from './AthleteSkeleton';

const PerformanceChart = dynamic(() => import('../../../components/charts/PerformanceChart'), { 
  ssr: false,
  loading: () => <PerformanceSkeleton />
});
const QScoreChart = dynamic(() => import('../../../components/charts/QScoreChart'), { 
  ssr: false,
  loading: () => <QScoreSkeleton />
});
const GamxChart = dynamic(() => import('../../../components/charts/GamxChart'), { 
  ssr: false,
  loading: () => <GamxSkeleton />
});

interface AthleteChartsProps {
  chartData: any[];
  athlete: any;
  legendFlags: any;
}

export function AthleteCharts({ chartData, athlete, legendFlags }: AthleteChartsProps) {
  if (!chartData || chartData.length <= 1) return null;

  return (
    <div className="max-w-[1200px]">
      <div className="space-y-8">
        <PerformanceChart chartData={chartData} athlete={athlete} />
        <QScoreChart chartData={chartData} athlete={athlete} legendFlags={legendFlags} />
        <GamxChart chartData={chartData} athlete={athlete} legendFlags={legendFlags} />
      </div>
    </div>
  );
}
