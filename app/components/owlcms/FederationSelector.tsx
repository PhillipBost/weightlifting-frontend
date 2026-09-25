'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FederationMatch, FederationSelection, CandidateQuery, formatDefinedFederation, FEDERATION_LEVEL_LABELS } from '@/types/federation';
import { 
  Search, 
  X, 
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Check,
  Building2,
  Sparkles
} from 'lucide-react';

interface FederationSelectorProps {
  explicitFederation?: string | null;
  candidateQueries?: (CandidateQuery | string)[];
  asOfDate?: string | null;
  selectedFederation: FederationSelection | null;
  suggestedFederation?: FederationSelection | null;
  onSelect: (federation: FederationSelection | null) => void;
  disabled?: boolean;
  hasError?: boolean;
}



export function FederationSelector({
  explicitFederation,
  candidateQueries = [],
  asOfDate = null,
  selectedFederation,
  suggestedFederation = null,
  onSelect,
  disabled = false,
  hasError = false
}: FederationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<FederationMatch[]>([]);
  const [defaultList, setDefaultList] = useState<FederationMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [internalSuggestion, setInternalSuggestion] = useState<FederationSelection | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUpward: boolean } | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);
  // Stable signature for candidate queries — prevents the resolution effect from
  // re-firing when the parent re-renders with an equivalent (fresh) candidate array.
  const candidateSignature = (candidateQueries || [])
    .map((q) => (typeof q === 'string' ? q : q?.value || ''))
    .join('|');
  // Initial Auto-resolve & Guessing Flow
  // Runs once per staged meet (mount / identity-prop change) and NEVER re-fires on
  // selection changes — clearing the pill must never resurrect the auto-applied guess.
  useEffect(() => {
    if (selectedFederation) return;

    let active = true;

    async function resolveOrGuess() {
      const dateParam = asOfDate ? `&as_of_date=${encodeURIComponent(asOfDate)}` : '';

      // 1. If explicitFederation exists in the JSON file
      if (explicitFederation && explicitFederation.trim()) {
        const cleanExplicit = explicitFederation.trim();
        try {
          setLoading(true);
          const res = await fetch(`/api/federations/search?q=${encodeURIComponent(cleanExplicit)}${dateParam}`);
          const data = await res.json();
          let topMatch = data.success && data.matches && data.matches.length > 0 ? data.matches[0] : null;

          // If composite string rank is below 80 and begins with an acronym token (e.g. "FHQ Fédération..."),
          // query the acronym token directly for exact 100-rank resolution
          if (!topMatch || topMatch.match_rank < 80) {
            const acronymMatch = cleanExplicit.match(/^([A-Za-z]{2,10})\b/);
            if (acronymMatch) {
              const token = acronymMatch[1];
              const tokenRes = await fetch(`/api/federations/search?q=${encodeURIComponent(token)}${dateParam}`);
              const tokenData = await tokenRes.json();
              if (tokenData.success && tokenData.matches && tokenData.matches.length > 0) {
                if (!topMatch || tokenData.matches[0].match_rank > topMatch.match_rank) {
                  topMatch = tokenData.matches[0];
                }
              }
            }
          }

          if (active) {
            if (topMatch && topMatch.match_rank >= 50) {
              // Confirmed or high similarity match in existing database registry
              onSelect(topMatch);
              return;
            } else {
              // Autopopulate with unconfirmed note
              onSelect({
                id: null,
                canonical_name: cleanExplicit,
                isNewUnconfirmed: true,
                note: 'Will be included in the Federation Registry once confirmed upon import'
              });
              return;
            }
          }
        } catch (err) {
          console.error('Federation explicit search error:', err);
          if (active) {
            onSelect({
              id: null,
              canonical_name: cleanExplicit,
              isNewUnconfirmed: true,
              note: 'Will be included in the Federation Registry once confirmed upon import'
            });
          }
          return;
        } finally {
          if (active) setLoading(false);
        }
      }

      // 2. If NOT explicitly under federation, try pre-selected candidate fields for an ~~like guess
      if (candidateQueries && candidateQueries.length > 0) {
        try {
          setLoading(true);
          for (const query of candidateQueries) {
            const queryValue = typeof query === 'string' ? query : query?.value;
            const queryField = typeof query === 'string' ? 'competition details' : query?.sourceField;
            const queryLabel = typeof query === 'string' ? 'Competition Details' : query?.fieldLabel;
            if (!queryValue || queryValue.trim().length < 2) continue;
            const res = await fetch(`/api/federations/search?q=${encodeURIComponent(queryValue.trim())}${dateParam}`);
            const data = await res.json();
            if (active && data.success && data.matches && data.matches.length > 0) {
              const topMatch = data.matches[0];
              if (topMatch.match_rank >= 50) {
                const guessedFed = {
                  ...topMatch,
                  isGuessed: true,
                  guessedFrom: queryValue.trim(),
                  guessedFromField: queryField,
                  guessedFromFieldLabel: queryLabel
                };
                setInternalSuggestion(guessedFed);
                onSelect(guessedFed);
                return;
              }
            }
          }
        } catch (err) {
          console.error('Federation guess search error:', err);
        } finally {
          if (active) setLoading(false);
        }
      }
    }

    resolveOrGuess();
    return () => { active = false; };
  }, [explicitFederation, asOfDate, candidateSignature]);

  // Load default/popular federations on first open if search query is empty
  useEffect(() => {
    if (!isOpen || defaultList.length > 0) return;

    let isMounted = true;
    async function loadDefaults() {
      try {
        const dateParam = asOfDate ? `&as_of_date=${encodeURIComponent(asOfDate)}` : '';
        const res = await fetch(`/api/federations/search?q=a${dateParam}`);
        const data = await res.json();
        if (isMounted && data.success) {
          setDefaultList(data.matches || []);
        }
      } catch {
        // Ignore default list error
      }
    }
    loadDefaults();
    return () => { isMounted = false; };
  }, [isOpen, defaultList.length, asOfDate]);

  // Debounced search when dropdown is open and user types
  useEffect(() => {
    if (!isOpen) return;

    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const dateParam = asOfDate ? `&as_of_date=${encodeURIComponent(asOfDate)}` : '';
        const res = await fetch(`/api/federations/search?q=${encodeURIComponent(q)}${dateParam}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.matches || []);
        }
      } catch (err) {
        console.error('Federation search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, asOfDate]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const outsideTrigger = dropdownRef.current && !dropdownRef.current.contains(target);
      const outsidePanel = !panelRef.current || !panelRef.current.contains(target);
      if (outsideTrigger && outsidePanel) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Portal positioning: anchor the dropdown to the trigger button using fixed
  // viewport coordinates so it escapes the queue card's overflow-y-auto scroll
  // container (no layout shift, no in-card scrolling). Flips upward when the
  // viewport lacks room below the trigger.
  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedPanelHeight = 340;
    const openUpward = rect.bottom + estimatedPanelHeight > window.innerHeight && rect.top - estimatedPanelHeight > 0;
    setDropdownPos({
      top: openUpward ? rect.top - 6 : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      openUpward
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDropdownPos(null);
      return;
    }
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    document.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      document.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleSelectUnknown = () => {
    onSelect({
      id: null,
      canonical_name: "I don't know",
      isUnknown: true
    });
    setIsOpen(false);
  };

  const displayList = searchQuery.trim() ? results : defaultList;
  const effectiveSuggestion = suggestedFederation || internalSuggestion || (selectedFederation?.isGuessed ? selectedFederation : null);

  return (
    <div className="w-full relative" ref={dropdownRef}>
      {/* Label matching Submitter Name & Contact Email */}
      <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between mb-1">
        <span className="flex items-center gap-1">
          Federation <span className="text-rose-400 font-bold">*</span>
        </span>
        <span className="text-[10px] text-rose-400/80 font-medium">Required</span>
      </label>

      {/* Fillable Pill Selector matching Submitter Name & Contact Email inputs */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border flex items-center justify-between transition cursor-pointer text-left ${
          hasError && !selectedFederation
            ? 'border-rose-500 ring-1 ring-rose-500/30'
            : isOpen
            ? 'border-sky-500 ring-1 ring-sky-500/30'
            : selectedFederation
            ? 'border-slate-700 text-white'
            : 'border-slate-700 text-slate-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="min-w-0 flex-1 truncate">
          {selectedFederation?.isUnknown ? (
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              I don&apos;t know / Unaffiliated
            </span>
          ) : selectedFederation?.isNewUnconfirmed ? (
            <span className="text-amber-300 font-semibold">
              {selectedFederation.canonical_name} (New from file)
            </span>
          ) : selectedFederation ? (
            <span className="text-white font-medium">
              {formatDefinedFederation(selectedFederation.canonical_name, selectedFederation.matched_acronym || selectedFederation.short_code)}
            </span>
          ) : (
            <span className="text-slate-500 italic">Select Federation...</span>
          )}
        </div>

        {/* Suggested badge lives in the pill — not duplicated in the card below */}
        {selectedFederation?.isGuessed && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-2.5 h-2.5" />
            Suggested
          </span>
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-400 ml-2">
          {selectedFederation && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Longitudinal / Historical Sanction Notice (Rule 10 Compliant) */}
      {selectedFederation?.matched_name_type === 'historical' && (selectedFederation.matched_name || selectedFederation.matched_acronym) && (
        <div className="text-[11px] text-amber-300/90 pt-1 select-text">
          Historical Sanction: <span className="text-white font-medium">{selectedFederation.matched_name || selectedFederation.canonical_name}</span>
          {selectedFederation.matched_acronym ? ` (${selectedFederation.matched_acronym})` : ''}
        </div>
      )}

      {/* Subtitle notes */}
      {selectedFederation?.isNewUnconfirmed && (
        <div className="text-[11px] text-amber-400/90 pt-1 select-text">
          Note: Will be included in the Federation Registry once confirmed upon import.
        </div>
      )}

      {/* Suggestion Provenance (compact single-line; the "Suggested" badge lives in
          the pill above, not here). Full provenance sits behind the Details
          expander. A skeleton reserves this slot while resolving so the card
          never shifts after file load. */}
      {effectiveSuggestion ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30 text-[11px] select-text cursor-text"
        >
          <div className="flex items-center gap-1.5 px-2.5 h-[30px]">
            <Sparkles className="w-3 h-3 text-sky-400 flex-shrink-0" />
            <p
              className="flex-1 min-w-0 truncate text-slate-300 leading-[16px]"
              title={`Suggested from ${effectiveSuggestion.guessedFromField || 'competition.competitionOrganizer'}: "${effectiveSuggestion.guessedFrom || ''}"`}
            >
              Suggested from <code className="text-sky-300 font-mono">{effectiveSuggestion.guessedFromField || 'competition.competitionOrganizer'}</code>
              {': "'}<span className="text-white font-medium">{effectiveSuggestion.guessedFrom}</span>{'"'}
            </p>
            {selectedFederation?.id !== effectiveSuggestion.id && (
              <button
                type="button"
                onClick={() => onSelect(effectiveSuggestion)}
                className="px-2 py-0.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-medium text-[11px] transition cursor-pointer flex items-center gap-1 flex-shrink-0"
              >
                <Check className="w-3 h-3" />
                Re-apply
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowProvenance(!showProvenance)}
              className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5 flex-shrink-0 transition"
            >
              Details
              <ChevronDown className={`w-3 h-3 transition-transform ${showProvenance ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showProvenance && (
            <div className="mx-2 mb-2 p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
              <p className="font-semibold text-sky-300">
                Suggested Federation (not present within JSON file)
              </p>
              <p className="text-slate-300 leading-relaxed">
                This meet file does <span className="font-semibold text-amber-300">not</span> have a dedicated <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded font-mono text-[10px]">federation</code> field. This suggestion was inferred from the source below.
              </p>
              <p className="text-slate-400">
                Source Field: <code className="text-sky-300 font-mono">{effectiveSuggestion.guessedFromField || 'competition.competitionOrganizer'}</code>
              </p>
              <p className="text-slate-300 break-words whitespace-normal leading-relaxed">
                Value: &quot;<span className="text-white font-medium">{effectiveSuggestion.guessedFrom}</span>&quot;
              </p>
              <p className="text-[10px] text-slate-400 italic">
                This suggestion has been selected by default. Click the field above to change or clear it if needed.
              </p>
            </div>
          )}
        </div>
      ) : ((explicitFederation && explicitFederation.trim()) || (candidateQueries && candidateQueries.length > 0)) && !selectedFederation ? (
        <div className="mt-1.5 px-2.5 h-[30px] flex items-center rounded-lg border border-slate-800 bg-slate-900/40 animate-pulse" aria-hidden="true">
          <div className="h-4 rounded bg-slate-800 w-2/3" />
        </div>
      ) : null}

      {/* Dropdown Menu Panel — rendered via portal so it floats above the
          queue card's scroll container instead of stretching it */}
      {isOpen && dropdownPos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: dropdownPos.openUpward ? undefined : `${dropdownPos.top}px`,
            bottom: dropdownPos.openUpward ? `${window.innerHeight - dropdownPos.top}px` : undefined,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            zIndex: 50
          }}
          className="rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden divide-y divide-slate-800"
        >
          {/* Search Bar (omnisearch-style: icon + inline input + clear, focus ring on container) */}
          <div className="p-2.5 bg-slate-950/80">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700/80 focus-within:ring-2 focus-within:ring-sky-500/40 transition">
              <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search federations (e.g. USA Weightlifting, FHQ)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowAllResults(false);
                }}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowAllResults(false);
                  }}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* "I don't know" — prominent action button directly under the search bar,
                always visible even while typing (omnisearch filter-pill affordance) */}
            <button
              type="button"
              onClick={handleSelectUnknown}
              className={`w-full mt-2 px-3 py-2 rounded-lg border transition flex items-center gap-3 text-left group/unknown ${
                selectedFederation?.isUnknown
                  ? 'border-amber-400/60 bg-amber-400/10'
                  : 'border-slate-700 bg-slate-900 hover:border-amber-400/40 hover:bg-slate-800'
              }`}
            >
              <span className="p-1.5 rounded-lg bg-slate-800 group-hover/unknown:bg-amber-400/10 text-slate-400 group-hover/unknown:text-amber-400 transition-colors flex-shrink-0">
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-slate-200 group-hover/unknown:text-amber-300 transition-colors">
                  I don&apos;t know / Unaffiliated
                </span>
                <span className="block text-[10px] text-slate-500 truncate">
                  Select if no federation applies to this meet
                </span>
              </span>
              {selectedFederation?.isUnknown && (
                <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              )}
            </button>
          </div>

          {/* Results (omnisearch-style grouped list with show more/fewer toggle) */}
          <div className="max-h-56 overflow-y-auto py-2">
            <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/80 rounded mb-1 mx-2">
              {searchQuery.trim() ? 'Search Results' : 'Registered Federations'}
            </div>
            {loading ? (
              <div className="p-4 text-center text-slate-400 text-xs">Searching...</div>
            ) : displayList.length > 0 ? (
              <div>
                {(showAllResults ? displayList : displayList.slice(0, 4)).map((item: FederationMatch) => {
                  const isSelected = selectedFederation?.id === item.id;
                  const isHistoricalMatch = item.matched_name_type === 'historical';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-800/80 flex items-center gap-3 transition-colors group"
                    >
                      <span className="p-2 rounded-lg bg-slate-800 group-hover:bg-sky-500/10 group-hover:text-sky-400 text-slate-400 transition-colors flex-shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="block text-xs font-medium text-white truncate group-hover:text-sky-300 transition-colors">
                            {formatDefinedFederation(item.canonical_name, item.matched_acronym || item.short_code)}
                          </span>
                          {item.level && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide bg-slate-800 text-sky-400 border border-slate-700/80 flex-shrink-0">
                              {FEDERATION_LEVEL_LABELS[item.level] || item.level}
                            </span>
                          )}
                        </div>
                        {isHistoricalMatch && (item.matched_name || item.matched_acronym) && (
                          <span className="block text-[10px] text-amber-400/90 truncate">
                            Historical: {item.matched_name || item.canonical_name}
                            {item.matched_acronym ? ` (${item.matched_acronym})` : ''}
                          </span>
                        )}
                        {item.parent_name && !isHistoricalMatch && (
                          <span className="block text-[10px] text-slate-500 truncate">
                            {item.parent_name}
                          </span>
                        )}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                    </button>
                  );
                })}
                {displayList.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllResults(!showAllResults)}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-sky-400 hover:bg-sky-500/5 transition-colors flex items-center gap-1 pl-12"
                  >
                    {showAllResults ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Show fewer
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show {displayList.length - 4} more result{displayList.length - 4 === 1 ? '' : 's'}
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">
                {searchQuery ? 'No matching federations found' : 'Type to search federations...'}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

