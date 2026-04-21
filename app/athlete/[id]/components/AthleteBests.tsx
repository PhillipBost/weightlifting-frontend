"use client";

import React from 'react';
import { Weight, Trophy, TrendingUp } from 'lucide-react';

interface AthleteBestsProps {
  personalBests: {
    best_snatch: { value: number; date: string | null };
    best_cj: { value: number; date: string | null };
    best_total: { value: number; date: string | null };
    best_q: { value: number; label: string; color: string; date: string | null };
    best_gamx: { value: number; label: string; color: string; date: string | null };
  };
}

const formatLongDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr || '';
  
  // Custom abbreviated months with dots
  const months = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };
  
  return `${month} ${day}${getOrdinal(day)}, ${year}`;
};

export function AthleteBests({ personalBests }: AthleteBestsProps) {
  return (
    <div className="max-w-[1200px]">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-secondary flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-label">Best Snatch</h3>
              <Weight className="h-5 w-5" style={{ color: 'var(--chart-snatch)' }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--chart-snatch)' }}>
              {personalBests.best_snatch.value > 0 ? `${personalBests.best_snatch.value}kg` : 'N/A'}
            </div>
          </div>
          {personalBests.best_snatch.date && (
            <div className="text-xs text-app-muted mt-2">
              {formatLongDate(personalBests.best_snatch.date)}
            </div>
          )}
        </div>

        <div className="card-secondary flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-label">Best C&J</h3>
              <Weight className="h-5 w-5" style={{ color: 'var(--chart-cleanjerk)' }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--chart-cleanjerk)' }}>
              {personalBests.best_cj.value > 0 ? `${personalBests.best_cj.value}kg` : 'N/A'}
            </div>
          </div>
          {personalBests.best_cj.date && (
            <div className="text-xs text-app-muted mt-2">
              {formatLongDate(personalBests.best_cj.date)}
            </div>
          )}
        </div>

        <div className="card-secondary flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-label">Best Total</h3>
              <Trophy className="h-5 w-5" style={{ color: 'var(--chart-total)' }} />
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--chart-total)' }}>
              {personalBests.best_total.value > 0 ? `${personalBests.best_total.value}kg` : 'N/A'}
            </div>
          </div>
          {personalBests.best_total.date && (
            <div className="text-xs text-app-muted mt-2">
              {formatLongDate(personalBests.best_total.date)}
            </div>
          )}
        </div>

        <div className="card-secondary relative overflow-hidden flex flex-col justify-center py-4">
          <TrendingUp 
            className="absolute right-3 top-3 h-4 w-4" 
            style={{ color: personalBests.best_q.color }} 
          />

          <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1">
            <div className="flex justify-center">
              <h3 className="text-label">Best Q-Score</h3>
            </div>
            <div className="text-app-muted/30 px-2 text-[10px] flex items-center h-full">|</div>
            <div className="flex justify-center pr-4">
              <h3 className="text-label">Best GAMX</h3>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-start">
            <div className="flex flex-col items-center">
              <div className="text-2xl font-bold" style={{ color: personalBests.best_q.color }}>
                {personalBests.best_q.value > 0 ? personalBests.best_q.value.toFixed(1) : 'N/A'}
              </div>
              <div className="text-[10px] text-app-muted uppercase tracking-wider font-semibold">
                {personalBests.best_q.label}
              </div>
              {personalBests.best_q.date && (
                <div className="text-[9px] text-app-muted mt-1">
                  {formatLongDate(personalBests.best_q.date)}
                </div>
              )}
            </div>
            
            <div className="flex justify-center px-2 pt-2">
              <div className="h-6 w-[1px] bg-app-secondary/30" />
            </div>

            <div className="flex justify-center pr-4">
              <div className="flex flex-col items-end">
                <div className="text-2xl font-bold" style={{ color: personalBests.best_gamx.color }}>
                  {personalBests.best_gamx.value > 0 ? personalBests.best_gamx.value.toFixed(0) : 'N/A'}
                </div>
                <div className="text-[10px] text-app-muted uppercase tracking-wider font-semibold">
                  {personalBests.best_gamx.label}
                </div>
                {personalBests.best_gamx.date && (
                  <div className="text-[9px] text-app-muted mt-1">
                    {formatLongDate(personalBests.best_gamx.date)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
