"use client";

import React from 'react';
import Link from 'next/link';
import { Medal, Trophy, Award, MapPin, Globe } from 'lucide-react';
import { AthleteAchievementsData, AchievementMedal } from './types';

interface AchievementProps {
  achievements: AthleteAchievementsData | null;
  athleteName: string;
  results?: any[];
}

const formatSimpleDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const getOrdinal = (n: number) => {
  if (!n || n < 1) return '—';
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function AthleteAchievements({ achievements, athleteName, results }: AchievementProps) {
  if (!achievements || (achievements.summary.gold === 0 && achievements.summary.silver === 0 && achievements.summary.bronze === 0)) {
    return null;
  }

  const { medals } = achievements;

  const countMedalsInSet = (data: AchievementMedal[]) => {
    return data.reduce((acc, m) => {
      let count = 0;
      if (m.ranks.snatch >= 1 && m.ranks.snatch <= 3) count++;
      if (m.ranks.cj >= 1 && m.ranks.cj <= 3) count++;
      if (m.ranks.total_lift >= 1 && m.ranks.total_lift <= 3) count++;
      return acc + count;
    }, 0);
  };

  const tier1_intl = medals.filter(m => m.level?.toLowerCase() === 'international');
  const tier2_nat = medals.filter(m => m.level?.toLowerCase() === 'national' && m.level?.toLowerCase() !== 'international');
  const tier3_wso = medals.filter(m => m.meet_name.toUpperCase().includes('WSO') && m.level?.toLowerCase() !== 'international' && m.level?.toLowerCase() !== 'national');
  const tier4_local = medals.filter(m => !tier1_intl.includes(m) && !tier2_nat.includes(m) && !tier3_wso.includes(m));

  const tiers = [
    { title: 'International Honors', data: tier1_intl, medalCount: countMedalsInSet(tier1_intl) },
    { title: 'National Medals', data: tier2_nat, medalCount: countMedalsInSet(tier2_nat) },
    { title: 'WSO Championships', data: tier3_wso, medalCount: countMedalsInSet(tier3_wso) },
    { title: 'Local & Club Medals', data: tier4_local, medalCount: countMedalsInSet(tier4_local) }
  ].filter(t => t.data.length > 0);

  const totalGold = medals.reduce((acc, m) => acc + (m.ranks.snatch === 1 ? 1 : 0) + (m.ranks.cj === 1 ? 1 : 0) + (m.ranks.total_lift === 1 ? 1 : 0), 0);
  const totalSilver = medals.reduce((acc, m) => acc + (m.ranks.snatch === 2 ? 1 : 0) + (m.ranks.cj === 2 ? 1 : 0) + (m.ranks.total_lift === 2 ? 1 : 0), 0);
  const totalBronze = medals.reduce((acc, m) => acc + (m.ranks.snatch === 3 ? 1 : 0) + (m.ranks.cj === 3 ? 1 : 0) + (m.ranks.total_lift === 3 ? 1 : 0), 0);

  return (
    <div className="card-primary overflow-hidden p-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="p-6 border-b border-app-secondary">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Trophy className="h-5 w-5 text-accent-primary" />
            <h2 className="text-xl font-bold text-app-primary tracking-tight">{athleteName} Achievements</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tiers.map(tier => (
              <AchievementBadge 
                key={tier.title}
                icon={tier.title.includes('International') ? Globe : tier.title.includes('National') ? Award : MapPin} 
                label={`${tier.medalCount} ${tier.title.replace('Honors', '').replace('Medals', '').replace('Championships', '').trim()}`} 
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-app-secondary/30">
        <div className="mb-6">
          <h3 className="text-[10px] font-black text-app-muted uppercase tracking-[0.2em]">Career Medal Totals (All Levels)</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 flex items-center justify-around gap-4">
            <TallyOrb count={totalGold} label="Gold" colorClass="bg-medal-gold" delay="0ms" />
            <TallyOrb count={totalSilver} label="Silver" colorClass="bg-medal-silver" delay="100ms" />
            <TallyOrb count={totalBronze} label="Bronze" colorClass="bg-medal-bronze" delay="200ms" />
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="grid grid-cols-4 text-center text-[10px] font-black text-app-muted uppercase tracking-widest mb-3">
              <div className="text-left pl-2">Lift</div>
              <div className="text-medal-gold opacity-80">Gold</div>
              <div className="text-medal-silver opacity-80">Silver</div>
              <div className="text-medal-bronze opacity-80">Bronze</div>
            </div>
            <div className="space-y-3">
              {['total_lift', 'snatch', 'cj'].map((key) => (
                <div key={key} className="grid grid-cols-4 items-center text-center">
                  <div className="text-xs font-bold text-app-secondary text-left pl-2">
                    {key === 'total_lift' ? 'Total' : key === 'snatch' ? 'Snatch' : 'Clean & Jerk'}
                  </div>
                  <div className="text-lg font-black text-app-primary">{medals.reduce((acc, m) => acc + (m.ranks[key as keyof AchievementMedal['ranks']] === 1 ? 1 : 0), 0) || '—'}</div>
                  <div className="text-lg font-black text-app-primary">{medals.reduce((acc, m) => acc + (m.ranks[key as keyof AchievementMedal['ranks']] === 2 ? 1 : 0), 0) || '—'}</div>
                  <div className="text-lg font-black text-app-primary">{medals.reduce((acc, m) => acc + (m.ranks[key as keyof AchievementMedal['ranks']] === 3 ? 1 : 0), 0) || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-0">
        {tiers.map((tier, tierIdx) => (
          <div key={tier.title} className={tierIdx > 0 ? "border-t border-app-secondary/30" : ""}>
            <div className="px-6 py-3 bg-app-surface/5 flex items-center justify-between">
              <h3 className="font-bold text-app-primary uppercase tracking-[0.1em] text-[10px]">{tier.title}</h3>
              <span className="text-[10px] font-bold text-app-muted">{tier.medalCount} Medal{tier.medalCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="p-6 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                    <tr>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Meet</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Division</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Best Sn</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Best CJ</th>
                      <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tier.data.map((medal, idx) => {
                      // Fix: If meet_id is missing, try to find it in the main results array
                      let meetId = medal.meet_id;
                      if (!meetId && results) {
                        const matchingResult = results.find(r => 
                          (r.result_id && String(r.result_id) === String(medal.result_id)) ||
                          (r.id && String(r.id) === String(medal.result_id))
                        );
                        if (matchingResult) meetId = matchingResult.meet_id;
                      }

                      return (
                        <tr 
                          key={`${medal.result_id}-${idx}`} 
                          className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors"
                          style={{ borderTopColor: 'var(--border-secondary)' }}
                        >
                          <td className="px-2 py-1 whitespace-nowrap text-xs text-app-muted">{formatSimpleDate(medal.date)}</td>
                          <td className="px-2 py-1">
                            <div className="flex flex-col">
                              <Link 
                                href={meetId ? `/meet/${meetId}` : '#'}
                                className={`text-xs ${meetId ? 'text-accent-primary hover:underline' : 'text-app-primary'} transition-colors leading-tight`}
                              >
                                {medal.meet_name}
                              </Link>
                              <span className="text-[10px] text-app-muted uppercase font-medium mt-0.5">{medal.level}</span>
                            </div>
                          </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs text-app-secondary">{medal.division}</td>
                        <td className="px-2 py-1 text-left"><RankMedal rank={medal.ranks.snatch} /></td>
                        <td className="px-2 py-1 text-left"><RankMedal rank={medal.ranks.cj} /></td>
                        <td className="px-2 py-1 text-left"><RankMedal rank={medal.ranks.total_lift} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AchievementBadge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-app-tertiary/20 border border-app-primary/5">
      <Icon className="h-3 w-3 text-app-muted opacity-70" />
      <span className="text-[10px] font-bold text-app-secondary uppercase tracking-wider">{label}</span>
    </div>
  );
}

function TallyOrb({ count, label, colorClass, delay }: { count: number; label: string; colorClass: string; delay: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full ${colorClass} flex items-center justify-center mb-2 animate-achievement-pop shadow-sm`} style={{ animationDelay: delay }}>
        <Medal className="h-6 w-6 md:h-8 md:w-8 text-white" />
      </div>
      <span className="text-xl md:text-2xl font-bold text-app-primary leading-none">{count}</span>
      <span className="text-[10px] uppercase tracking-wider text-app-muted font-bold mt-1">{label}</span>
    </div>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank < 1) return <span className="text-app-muted text-xs opacity-30">—</span>;
  
  const ordinal = getOrdinal(rank);
  const colors = { 1: 'text-medal-gold', 2: 'text-medal-silver', 3: 'text-medal-bronze' };
  
  if (rank >= 1 && rank <= 3) {
    return (
      <div className={`flex items-center justify-start space-x-1 ${colors[rank as 1|2|3]}`}>
        <Medal className="h-3 w-3 fill-current" />
        <span className="text-[10px] font-bold tracking-tight">{ordinal}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-start">
      <span className="text-xs font-medium text-app-muted">{ordinal}</span>
    </div>
  );
}
