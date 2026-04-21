"use client";

import React from 'react';
import Link from 'next/link';
import { User, ChevronRight } from 'lucide-react';

interface Candidate {
  lifter_id: number;
  membership_number: string | null;
  gender: string | null;
  athlete_name: string;
  recent_wso: string | null;
  recent_club: string | null;
  first_active: string | null;
  last_active: string | null;
  result_count: number;
  source?: 'USAW' | 'IWF';
}

interface DisambiguationUIProps {
  name: string;
  candidates: Candidate[];
}

/**
 * PRODUCTION-DE-CLUTTERED DISAMBIGUATION INTERFACE
 * -----------------------------------------------
 * Resolves the "cluttered left side" by distributing information 
 * horizontally into dedicated columns. Supports cross-federation logic.
 */
export function DisambiguationUI({ name, candidates }: DisambiguationUIProps) {
  const decodedName = decodeURIComponent(name).replace(/-/g, ' ');
  const numberToWord = (n: number) => {
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
    return words[n] || n.toString();
  };

  const countWord = numberToWord(candidates.length);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      {/* Site-aligned Header block */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl font-bold text-app-primary tracking-tight">
          {countWord} records matching <span className="text-accent-primary">{decodedName}</span> were found.
        </h1>
        <p className="text-app-secondary mt-2">
          Please select the correct profile to continue.
        </p>
      </div>

      <div className="space-y-4">
        {/* De-cluttered Column Headers */}
        <div className="hidden md:grid md:grid-cols-[2.5fr_1.5fr_1fr_1.2fr_1.5fr_40px] gap-6 px-10 py-3 text-xs uppercase font-bold text-app-tertiary border-b border-white/5 opacity-60">
          <div>Athlete Name</div>
          <div>Federation ID</div>
          <div>Years Active</div>
          <div>Location / WSO</div>
          <div>Organization / Club</div>
          <div></div>
        </div>

        {candidates.map((athlete, idx) => {
          const isIWF = athlete.source === 'IWF';
          const profileUrl = isIWF 
            ? `/athlete/iwf/${athlete.lifter_id}`
            : (athlete.membership_number 
                ? `/athlete/${athlete.membership_number}` 
                : `/athlete/u-${athlete.lifter_id}`);

          const years = athlete.first_active && athlete.last_active
            ? `${new Date(athlete.first_active).getFullYear()} — ${new Date(athlete.last_active).getFullYear()}`
            : 'No activity';

          // Explicit labeling as requested
          const membershipLabel = isIWF 
            ? `IWF ID # ${athlete.membership_number || athlete.lifter_id}`
            : `USAW Membership # ${athlete.membership_number || 'N/A'}`;

          return (
            <Link 
              key={`${athlete.lifter_id}-${athlete.source}-${idx}`} 
              href={profileUrl}
              className="group block"
            >
              <div className="card-results hover:border-accent-primary/60 transition-all duration-200">
                <div className="grid grid-cols-1 md:grid-cols-[2.5fr_1.5fr_1fr_1.2fr_1.5fr_40px] items-center gap-4 md:gap-6 px-6 py-6">
                  
                  {/* Column 1: Clean Name (De-cluttered) */}
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-app-tertiary flex items-center justify-center shrink-0 border border-app-primary group-hover:bg-app-surface transition-colors">
                      <User className="h-5 w-5 text-app-secondary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-app-primary group-hover:text-accent-primary transition-colors">
                        {athlete.athlete_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-black px-1 py-0.5 rounded tracking-tighter uppercase ${isIWF ? 'bg-red-900/30 text-red-400 border border-red-800/40' : 'bg-blue-900/30 text-blue-400 border border-blue-800/40'}`}>
                          {athlete.source || 'USAW'}
                        </span>
                        <span className="text-[10px] text-app-muted uppercase font-bold tracking-wider">
                          {athlete.gender?.toLowerCase().startsWith('m') ? 'Male' : athlete.gender?.toLowerCase().startsWith('f') ? 'Female' : 'Gender Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Dedicated ID Column */}
                  <div className="flex flex-col md:block">
                    <span className="text-[10px] uppercase font-bold text-app-muted md:hidden mb-1">Identity:</span>
                    <div className="text-sm font-bold text-app-secondary">
                      {isIWF ? 'IWF ID #' : 'USAW Membership #'}
                      <span className="text-accent-primary ml-1">
                        {athlete.membership_number || (isIWF ? athlete.lifter_id : 'N/A')}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: Activity */}
                  <div className="flex flex-col md:block">
                    <span className="text-[10px] uppercase font-bold text-app-muted md:hidden mb-1">Years Active:</span>
                    <span className="text-sm font-semibold text-app-secondary whitespace-nowrap">
                      {years}
                    </span>
                  </div>

                  {/* Column 4: Location / WSO */}
                  <div className="flex flex-col md:block">
                    <span className="text-[10px] uppercase font-bold text-app-muted md:hidden mb-1">{isIWF ? 'Nation:' : 'WSO:'}</span>
                    <span className="text-sm font-semibold text-app-secondary block">
                      {athlete.recent_wso || '—'}
                    </span>
                  </div>

                  {/* Column 5: Organization / Barbell Club */}
                  <div className="flex flex-col md:block">
                    <span className="text-[10px] uppercase font-bold text-app-muted md:hidden mb-1">Org / Club:</span>
                    <span className="text-sm font-semibold text-app-secondary block">
                      {athlete.recent_club || 'Unattached'}
                    </span>
                  </div>

                  {/* Column 6: Action */}
                  <div className="hidden md:flex justify-end">
                    <ChevronRight className="w-5 h-5 text-app-muted group-hover:text-accent-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
