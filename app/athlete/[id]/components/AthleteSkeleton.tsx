"use client";

import React from 'react';
import { User, Calendar, TrendingUp, BarChart3, Medal, Activity, Database } from 'lucide-react';

/**
 * CALIBRATED BONES (Zero-Shifting Logic)
 * -------------------------------------
 * These components use exact pixel heights measured from production
 * to ensure that when the actual data hydrates, the page does not shift.
 */

const SkeletonBone = ({ className }: { className: string }) => (
  <div className={`bg-app-tertiary animate-pulse rounded ${className}`} />
);

export function HeaderSkeleton() {
  return (
    <div 
      className="card-primary mb-8 overflow-hidden" 
      style={{ minHeight: '288px' }} // Exact measured header height
    >
      <div className="flex flex-col md:flex-row items-center md:items-start p-8 space-y-6 md:space-y-0 md:space-x-8">
        <div className="bg-app-tertiary rounded-full p-4 flex-shrink-0 animate-pulse">
          <User className="h-12 w-12 text-app-secondary/30" />
        </div>
        <div className="flex-1 space-y-4">
          <SkeletonBone className="h-9 w-72" /> {/* Name Bone */}
          <div className="flex gap-4">
            <SkeletonBone className="h-5 w-40" />
            <SkeletonBone className="h-5 w-40" />
          </div>
          <div className="flex gap-4 pt-2">
            <SkeletonBone className="h-5 w-48" />
            <SkeletonBone className="h-5 w-48" />
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end space-y-4">
          <SkeletonBone className="h-10 w-48" />
          <SkeletonBone className="h-10 w-48" />
        </div>
      </div>
    </div>
  );
}

export function PerformanceSkeleton() {
  return (
    <div className="card-results p-6" style={{ height: '500px' }}>
      <div className="flex items-center mb-6">
        <BarChart3 className="h-5 w-5 mr-2 text-app-tertiary" />
        <SkeletonBone className="h-6 w-48" />
      </div>
      <div className="h-[400px] bg-app-tertiary/10 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-app-disabled text-sm">Loading performance...</div>
      </div>
    </div>
  );
}

export function QScoreSkeleton() {
  return (
    <div className="card-results p-6" style={{ height: '500px' }}>
      <div className="flex items-center mb-6">
        <Activity className="h-5 w-5 mr-2 text-app-tertiary" />
        <SkeletonBone className="h-6 w-48" />
      </div>
      <div className="h-[400px] bg-app-tertiary/10 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-app-disabled text-sm">Loading analysis...</div>
      </div>
    </div>
  );
}

export function GamxSkeleton() {
  return (
    <div className="card-results p-6" style={{ height: '700px' }}>
      <div className="flex items-center mb-6">
        <Database className="h-5 w-5 mr-2 text-app-tertiary" />
        <SkeletonBone className="h-6 w-48" />
      </div>
      <div className="h-[600px] bg-app-tertiary/10 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-app-disabled text-sm">Loading advanced metrics...</div>
      </div>
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="flex flex-col space-y-8 mb-8 max-w-[1200px]">
      <PerformanceSkeleton />
      <QScoreSkeleton />
      <GamxSkeleton />
    </div>
  );
}

export function BestsSkeleton() {
  return (
    <div 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      style={{ minHeight: '130px' }} // Exact measured bests height
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card-results p-5 flex flex-col justify-between" style={{ height: '130px' }}>
          <div className="flex items-center justify-between">
            <SkeletonBone className="h-4 w-24" />
            <Medal className="h-4 w-4 text-app-tertiary" />
          </div>
          <SkeletonBone className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="card-results mt-8">
      <div className="p-6 border-b border-app-secondary flex justify-between items-center">
        <SkeletonBone className="h-6 w-64" />
        <SkeletonBone className="h-9 w-32" />
      </div>
      <div className="p-6">
        <div className="space-y-4">
          <div className="flex space-x-4 border-b border-app-secondary pb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <SkeletonBone key={i} className="h-4 flex-1" />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex space-x-4 py-3 border-b border-app-secondary/50 last:border-0">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(j => (
                <SkeletonBone key={j} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * THE REBUILD SKELETON (Full Deck)
 */
export default function AthleteSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <HeaderSkeleton />
        <ChartsSkeleton />
        <BestsSkeleton />
        <ResultsSkeleton />
      </div>
    </div>
  );
}
