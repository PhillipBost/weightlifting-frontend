"use client";

import React from 'react';
import Link from 'next/link';
import { User, MapPin, Dumbbell, ExternalLink, Globe } from 'lucide-react';

interface AthleteHeaderProps {
  athlete: any;
  recentInfo: { wso: string | null; club: string | null };
  iwfProfiles: { id: string; url: string | null }[];
  iwfResults: any[];
  showIwfResults: boolean;
  setShowIwfResults: (show: boolean) => void;
  forceIwfMode?: boolean;
  currentIwfId?: string;
}

export function AthleteHeader({
  athlete,
  recentInfo,
  iwfProfiles,
  iwfResults,
  showIwfResults,
  setShowIwfResults,
  forceIwfMode = false,
  currentIwfId
}: AthleteHeaderProps) {
  if (!athlete) return null;

  return (
    <div className="card-primary mb-8">
      <div className="flex flex-col md:flex-row md:items-start w-full">
        {/* Athlete Info */}
        <div className="flex items-start space-x-6 flex-1">
          <div className="bg-app-tertiary rounded-full p-4 flex-shrink-0">
            <User className="h-12 w-12 text-app-secondary" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-app-primary mb-2">{athlete.displayName}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-app-secondary">
              {forceIwfMode ? (
                <>
                  <div className="flex items-center space-x-1">
                    <span>IWF Athlete ID: {currentIwfId?.replace('iwf-', '')}</span>
                  </div>
                  {athlete.gender && (
                    <div className="flex items-center space-x-1">
                      <span>{athlete.gender === 'M' ? 'Male' : 'Female'}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {athlete.membership_number && (
                    <div className="flex items-center space-x-1">
                      <span>USAW Membership #{athlete.membership_number}</span>
                    </div>
                  )}
                  {athlete.gender && (
                    <div className="flex items-center space-x-1">
                      <span>{athlete.gender === 'M' ? 'Male' : 'Female'}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-app-secondary mt-2">
              {forceIwfMode ? (
                <>
                  {athlete.nation_code && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>Country Code: {athlete.nation_code}</span>
                    </div>
                  )}
                  {athlete.nation && (
                    <div className="flex items-center space-x-1">
                      <Dumbbell className="h-4 w-4" />
                      <span>Country: {athlete.nation}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {recentInfo.wso && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>WSO: {recentInfo.wso}</span>
                    </div>
                  )}
                  {recentInfo.club && (
                    <div className="flex items-center space-x-1">
                      <Dumbbell className="h-4 w-4" />
                      <span>Barbell Club: {recentInfo.club}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Internal Navigation Links & Toggle */}
        {(iwfProfiles.length > 0 || iwfResults.length > 0 || athlete.linked_usaw_id || athlete.linked_iwf_id) && (
          <div className="flex flex-col gap-3 my-4 md:my-0 md:pt-2 items-start justify-center px-4">
            {/* Link back to USAW Profile - Only if it exists */}
            {forceIwfMode && (athlete.linked_usaw_id || athlete.membership_number) && (
              <Link
                href={`/athlete/${athlete.linked_usaw_id || athlete.membership_number}`}
                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-transparent hover:bg-app-tertiary border border-app-secondary rounded-md text-app-secondary hover:text-white transition-colors text-sm"
              >
                <User className="h-3.5 w-3.5" />
                <span>View USAW Profile</span>
              </Link>
            )}

            {/* Primary IWF Forward-Link */}
            {!forceIwfMode && athlete.linked_iwf_id && (
              <Link
                href={`/athlete/iwf/${athlete.linked_iwf_id}`}
                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-transparent hover:bg-app-tertiary border border-app-secondary rounded-md text-app-secondary hover:text-white transition-colors text-sm"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>View IWF Profile</span>
              </Link>
            )}

            {/* Legacy IWF Profiles Array (if primary link is missing) */}
            {!forceIwfMode && !athlete.linked_iwf_id && iwfProfiles
              .filter(p => {
                const cleanCurrentId = currentIwfId?.replace('iwf-', '');
                const cleanProfileId = String(p.id).replace('iwf-', '');
                return !cleanCurrentId || cleanProfileId !== cleanCurrentId;
              })
              .map((p) => (
                <Link
                  key={p.id}
                  href={`/athlete/iwf/${p.id}`}
                  className="inline-flex items-center space-x-2 px-3 py-1.5 bg-transparent hover:bg-app-tertiary border border-app-secondary rounded-md text-app-secondary hover:text-white transition-colors text-sm"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>View Linked IWF Results{iwfProfiles.length > 1 ? ` (${p.id})` : ''}</span>
                </Link>
              ))}
            
            {/* Fallback link if results exist but profile metadata is missing */}
            {!forceIwfMode && !athlete.linked_iwf_id && iwfProfiles.length === 0 && iwfResults.length > 0 && (
              <Link
                href={`/athlete/iwf/${iwfResults[0].iwf_lifter_id || iwfResults[0].db_lifter_id || iwfResults[0].id}`}
                className="inline-flex items-center space-x-2 px-3 py-1.5 bg-transparent hover:bg-app-tertiary border border-app-secondary rounded-md text-app-secondary hover:text-white transition-colors text-sm"
              >
                <User className="h-3.5 w-3.5" />
                <span>View Linked IWF Results</span>
              </Link>
            )}
            
            {/* Results Toggle: Only show if there's a linked identity to toggle to */}
            {((forceIwfMode ? (athlete.linked_usaw_id || athlete.membership_number) : (athlete.linked_iwf_id || iwfResults.length > 0))) && (
              <label className="flex items-center space-x-3 cursor-pointer mt-1">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={forceIwfMode ? !showIwfResults : showIwfResults}
                    onChange={(e) => setShowIwfResults(forceIwfMode ? !e.target.checked : e.target.checked)}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${(forceIwfMode ? !showIwfResults : showIwfResults) ? 'bg-accent-primary' : 'bg-app-surface border border-app-secondary'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${(forceIwfMode ? !showIwfResults : showIwfResults) ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="text-sm font-medium text-app-secondary select-none text-nowrap">
                  {forceIwfMode ? 'Include USAW Results' : 'Include IWF Results'}
                </span>
              </label>
            )}
          </div>
        )}

        {/* External Profile Links */}
        <div className="flex flex-col mt-4 md:mt-0 md:items-end flex-1">
          <div className="flex flex-col gap-2 items-end">
            <p className="text-xs font-semibold text-app-secondary border-b border-app-secondary pb-0.5 mb-1 self-stretch text-right">External Links</p>
            {athlete.external_links && athlete.external_links.length > 0 ? (
              athlete.external_links.map((link: any, idx: number) => (
                <a
                  key={`ext-${idx}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>
                    {link.type === 'usaw' ? 'USAW Official Profile' : 
                     link.type === 'iwf' ? 'IWF Official Profile' : 
                     'External Link'}
                  </span>
                </a>
              ))
            ) : (
              <>
                {athlete.internal_id && (
                  <a
                    href={`https://usaweightlifting.sport80.com/public/rankings/member/${athlete.internal_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>USAW Official Profile{athlete.internal_id_2 ? ' 1' : ''}</span>
                  </a>
                )}
                {athlete.internal_id_2 && (
                  <a
                    href={`https://usaweightlifting.sport80.com/public/rankings/member/${athlete.internal_id_2}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>USAW Official Profile 2</span>
                  </a>
                )}
                {athlete.linked_iwf_id && (
                  <a
                    href={`https://iwf.sport/weightlifting_/athletes-bios/?athlete_id=${athlete.linked_iwf_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>IWF Official Profile</span>
                  </a>
                )}
                {!athlete.linked_iwf_id && iwfProfiles.map((p) => p.url && (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors text-sm"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>IWF Official Profile{iwfProfiles.filter(x => x.url).length > 1 ? ` (${p.id})` : ''}</span>
                  </a>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
