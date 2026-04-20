"use client";

import React from 'react';
import { Weight, Trophy, TrendingUp } from 'lucide-react';

interface AthleteBestsProps {
  personalBests: {
    best_snatch: number;
    best_cj: number;
    best_total: number;
    best_qpoints: number;
  };
}

export function AthleteBests({ personalBests }: AthleteBestsProps) {
  return (
    <div className="max-w-[1200px]">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
    </div>
  );
}
