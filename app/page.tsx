"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, TrendingUp, Trophy, Users, Calendar, CalendarDays, CalendarFold, MapPinned, Weight, Dumbbell, Database, Filter, ArrowRight, Github, Heart, X, User, MapPin, Loader2 } from 'lucide-react';


import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { UserMenu } from './components/UserMenu';
import { LoginModal } from './components/LoginModal';
import { DataSource, getSourceBadge, getSourceColor, buildAthleteUrl, buildMeetUrl } from '../lib/types/dataSource';

import { useAuth } from './components/AuthProvider';
import { ROLES } from '../lib/roles';
import { iwfAthleteSearch } from '../lib/search/iwfAthleteSearch';
import { usawAthleteSearch } from '../lib/search/usawAthleteSearch';
import { usawMeetSearch } from '../lib/search/usawMeetSearch';
import { iwfMeetSearch } from '../lib/search/iwfMeetSearch';
import { generateAthleteSearchTerms, stripPunctuation } from '../lib/search/searchUtils';

// Types for our search results
interface SearchResult {
  athlete_name?: string;
  club_name?: string;
  wso?: string;
  membership_number?: string;
  lifter_id?: string;
  // IWF-specific fields
  country?: string;
  country_name?: string;
  iwf_lifter_id?: string | number;
  db_lifter_id?: string | number;
  type?: string;
  gender?: string;
  // Meet fields
  meet_name?: string;
  date?: string;
  level?: string;
  meet_id?: string;
  db_meet_id?: string | number;
  // Meet location fields
  location_text?: string;
  // Source identifier
  source?: DataSource;
}



// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Helper to get country name from code
const getCountryName = (code: string | undefined) => {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

export default function WeightliftingLandingPage() {

  const [searchQuery, setSearchQuery] = useState('');
  const [meetSearchQuery, setMeetSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('lifters');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [meetSearchResults, setMeetSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMeetSearching, setIsMeetSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMeetResults, setShowMeetResults] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const meetSearchInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const meetAbortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const [placeholderName, setPlaceholderName] = useState('');
  const [placeholderMeet, setPlaceholderMeet] = useState('');

  useEffect(() => {
    // Initialize search indices
    iwfAthleteSearch.init().catch(console.error);
    usawAthleteSearch.init().catch(console.error);
    usawMeetSearch.init().catch(console.error);
    iwfMeetSearch.init().catch(console.error);
  }, []);

  const athleteNames = [
    'Caine Wilkes',
    'Jourdan Delacruz',
    'Wes Kitts',
    'Hampton Morris',
    'Mary Theisen-Lappen',
    'Olivia Reeves',
    'Sarah Robles',
    'Martha Rogers',
    'Harrison Maurus',
    'Katherine Vibert',
    'Clarence Cummings',
    'Jenny Arthur',
    'Kendrick Farris',
    'Holley Mangold',
    'Christopher Yandle'
  ];

  const meetNames = [
    // TODO: Fill in with actual meet names
    'National Championships',
    'International',
    '2017',
    'American Open',
    'University Championships',
    'Youth Championships',
    'Masters National Championships',
    'Queen City Classic'
  ];

  const getSearchIcon = (resultType: string) => {
    switch (resultType) {
      case 'athlete': return User;
      case 'meet': return CalendarDays;      // for meet/competition results
      case 'wso': return MapPinned;         // for WSO/regional results  
      case 'club': return Dumbbell;         // for barbell club results
      default: return User;
    }
  };

  // Debounced search function with fuzzy search for athlete names (USAW + IWF)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Debounced search function with fuzzy search for athlete names (USAW + IWF)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setIsSearching(false);
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      // Cancel previous search if still running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsSearching(true);
      setShowResults(true); // Show results immediately (loading state)

      try {
        const searchTerms = generateAthleteSearchTerms(query);
        const cleanSearchTerms = searchTerms.map(term => stripPunctuation(term));

        // --- IWF Search (MiniSearch) ---
        // Use the new client-side MiniSearch index for IWF results
        // This replaces the complex Supabase query logic for IWF
        const iwfSearchResults = iwfAthleteSearch.search(query, { limit: 50 });

        const iwfAthletes: SearchResult[] = iwfSearchResults.map(result => ({
          athlete_name: result.name,
          country: result.country, // Country code
          country_name: getCountryName(result.country),
          iwf_lifter_id: result.iwfId,
          db_lifter_id: result.id,
          gender: result.gender,
          type: 'athlete',
          source: 'IWF' as DataSource
        }));

        // --- USAW Search (MiniSearch) ---
        // Use the new client-side MiniSearch index for USAW results
        const usawSearchResults = usawAthleteSearch.search(query, { limit: 50 });

        const usawAthletes: SearchResult[] = usawSearchResults.map(result => ({
          lifter_id: result.id.toString(),
          athlete_name: result.name,
          membership_number: result.membership_number,
          wso: result.wso,
          club_name: result.club,
          gender: result.gender,
          type: 'athlete',
          source: 'USAW' as DataSource
        }));

        // Combine and Deduplicate
        // We want to show both USAW and IWF results.
        // If an athlete exists in both (e.g. by name match), we might want to show both or link them.
        // For now, we'll show them as separate entries but sort them intelligently.

        const allAthletes = [...usawAthletes, ...iwfAthletes];

        // Deduplicate by ID + Source (should be unique already, but good safety)
        const deduplicatedAthletes = Array.from(
          new Map(allAthletes.map(a => {
            const id = a.source === 'USAW' ? a.lifter_id : a.db_lifter_id;
            return [`${a.source}_${id}`, a];
          })).values()
        );

        // Sort results
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/);
        const firstWord = queryWords[0];

        deduplicatedAthletes.sort((a, b) => {
          const aNameLower = a.athlete_name!.toLowerCase();
          const bNameLower = b.athlete_name!.toLowerCase();

          // Check if either is an exact match
          const aExact = aNameLower === queryLower;
          const bExact = bNameLower === queryLower;

          // Exact matches come first
          if (aExact && !bExact) return -1;
          if (bExact && !aExact) return 1;

          // For multi-word queries, check if either name contains ALL query words
          if (queryWords.length > 1) {
            const aContainsAll = queryWords.every(word => aNameLower.includes(word));
            const bContainsAll = queryWords.every(word => bNameLower.includes(word));

            if (aContainsAll && !bContainsAll) return -1;
            if (bContainsAll && !aContainsAll) return 1;
          }

          // For single-word queries, prioritize names that START with the query
          if (queryWords.length === 1 && firstWord) {
            const aStartsWithQuery = aNameLower.startsWith(firstWord);
            const bStartsWithQuery = bNameLower.startsWith(firstWord);
            if (aStartsWithQuery && !bStartsWithQuery) return -1;
            if (bStartsWithQuery && !aStartsWithQuery) return 1;
          }

          // Check if names contain the full query string
          const aContainsQuery = aNameLower.includes(queryLower);
          const bContainsQuery = bNameLower.includes(queryLower);
          if (aContainsQuery && !bContainsQuery) return -1;
          if (bContainsQuery && !aContainsQuery) return 1;

          // If match quality is equal, sort by source (USAW first) as a tie-breaker
          if (a.source !== b.source) {
            return a.source === 'USAW' ? -1 : 1;
          }

          // Same source and match quality, sort alphabetically
          return aNameLower.localeCompare(bNameLower);
        });

        const finalResults = deduplicatedAthletes.slice(0, 100) || [];
        setSearchResults(finalResults);
      } catch (err) {
        // Don't show error if search was aborted (user typed again)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[SEARCH] Search aborted - user typed again');
          return;
        }

        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[SEARCH] Error:', errorMsg);

        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Strip punctuation from search terms
  // Imported from searchUtils


  // Simple fuzzy search helper for meets
  const fuzzySearchTerms = (query: string) => {
    const terms = [stripPunctuation(query)];
    const cleaned = query.toLowerCase().trim();

    // Add variations for common typos and abbreviations
    const variations: Record<string, string[]> = {
      'national': ['nationals', 'natl', 'nats'],
      'nationals': ['national', 'natl', 'nats'],
      'championship': ['championships', 'champ', 'champs'],
      'championships': ['championship', 'champ', 'champs'],
      'american': ['america', 'amer'],
      'open': ['opn'],
      'university': ['univ', 'college'],
      'youth': ['jr', 'junior'],
      'masters': ['master', 'mstr'],
      'classic': ['classik', 'clasic'],
      'international': ['intl', 'int'],
      // Common colloquial terms people use
      'youth nationals': ['youth national championships', 'youth championships', 'youth national'],
      'youth national': ['youth nationals', 'youth national championships', 'youth championships'],
      'masters nationals': ['masters national championships', 'masters championships', 'masters national'],
      'masters national': ['masters nationals', 'masters national championships', 'masters championships'],
      'university nationals': ['university national championships', 'university championships', 'university national'],
      'university national': ['university nationals', 'university national championships', 'university championships'],
      'junior nationals': ['junior national championships', 'junior championships', 'junior national'],
      'junior national': ['junior nationals', 'junior national championships', 'junior championships'],
      // And the reverse - if they search for the full name, also find the short version
      'youth national championships': ['youth nationals', 'youth national', 'youth championships'],
      'masters national championships': ['masters nationals', 'masters national', 'masters championships'],
      'university national championships': ['university nationals', 'university national', 'university championships'],
      'junior national championships': ['junior nationals', 'junior national', 'junior championships']
    };

    // Add variations if any key words match
    Object.entries(variations).forEach(([key, alts]) => {
      // Use word boundary matching for more precise matching
      const keyRegex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (keyRegex.test(cleaned)) {
        alts.forEach(alt => {
          terms.push(query.replace(keyRegex, alt));
        });
      }
    });



    return [...new Set(terms)]; // Remove duplicates
  };

  // Generate fuzzy search terms for athlete names
  // Imported from searchUtils


  // Debounced meet search function
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedMeetSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setIsMeetSearching(false);
        setMeetSearchResults([]);
        setShowMeetResults(false);
        return;
      }

      // Cancel previous search if still running
      if (meetAbortControllerRef.current) {
        meetAbortControllerRef.current.abort();
      }
      meetAbortControllerRef.current = new AbortController();

      setIsMeetSearching(true);
      try {
        // --- USAW Meet Search (MiniSearch) ---
        const usawMeetResults = usawMeetSearch.search(query, { limit: 50 });
        const transformedUsawMeets = usawMeetResults.map(result => ({
          meet_name: result.name,
          date: result.date,
          level: result.level,
          meet_id: result.id.toString(),
          location_text: result.city && result.state ? `${result.city}, ${result.state}` : result.city || result.state || '',
          type: 'meet',
          source: 'USAW' as DataSource
        }));

        // --- IWF Meet Search (MiniSearch) ---
        const iwfMeetResults = iwfMeetSearch.search(query, { limit: 50 });
        const transformedIwfMeets = iwfMeetResults.map(result => ({
          meet_name: result.name,
          date: result.date,
          level: result.level,
          db_meet_id: result.id,
          location_text: result.city && result.country ? `${result.city}, ${result.country}` : result.city || result.country || '',
          type: 'meet',
          source: 'IWF' as DataSource
        }));

        // Merge all results
        const allMeets = [...transformedUsawMeets, ...transformedIwfMeets];

        if (allMeets.length === 0) {
          setMeetSearchResults([]);
          setShowMeetResults(true);
          return;
        }

        // Sort by date (most recent first), then by source (USAW first)
        allMeets.sort((a, b) => {
          const aDate = new Date(a.date).getTime();
          const bDate = new Date(b.date).getTime();

          if (aDate !== bDate) {
            return bDate - aDate; // Most recent first
          }

          // Same date, sort by source (USAW first)
          if (a.source !== b.source) {
            return a.source === 'USAW' ? -1 : 1;
          }

          return 0;
        });

        const finalResults = allMeets.slice(0, 50);
        setMeetSearchResults(finalResults);
        setShowMeetResults(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[MEET_SEARCH] Error:', errorMsg);
        setMeetSearchResults([]);
        setShowMeetResults(false);
      } finally {
        setIsMeetSearching(false);
      }

    }, 300),
    []
  );

  // Handle search input changes
  useEffect(() => {
    if (searchQuery) {
      // Clear meet search when athlete search is active
      setMeetSearchQuery('');
      setMeetSearchResults([]);
      setShowMeetResults(false);
    }
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    if (meetSearchQuery) {
      // Clear athlete search when meet search is active
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
    }
    debouncedMeetSearch(meetSearchQuery);
  }, [meetSearchQuery, debouncedMeetSearch]);

  // Set random placeholder name on mount
  useEffect(() => {
    const randomName = athleteNames[Math.floor(Math.random() * athleteNames.length)];
    setPlaceholderName(randomName);
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;

      // Don't close if clicking on a search result or its children
      const isClickingOnResult = target.closest('[data-search-result]');
      if (isClickingOnResult) {
        return;
      }

      // Close athlete search dropdown if clicking outside
      if (showResults && searchInputRef.current && !searchInputRef.current.closest('.relative')?.contains(target)) {
        setShowResults(false);
      }

      // Close meet search dropdown if clicking outside
      if (showMeetResults && meetSearchInputRef.current && !meetSearchInputRef.current.closest('.relative')?.contains(target)) {
        setShowMeetResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showResults, showMeetResults]);

  // Handle search form submission (currently just lifters)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2 && !isSearching) {
      setIsSearching(true);
      debouncedSearch(searchQuery);
    }
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    setSearchQuery(result.athlete_name!);
    setShowResults(false);

    const source: DataSource = result.source || 'USAW';

    // Determine athlete ID based on source
    let athleteId: string;

    if (source === 'USAW') {
      // USAW: prefer membership number, fallback to name slug
      if (result.membership_number && result.membership_number !== 'null') {
        athleteId = result.membership_number.toString();
      } else if (result.lifter_id) {
        // Fallback to internal ID if membership number is missing
        athleteId = `u-${result.lifter_id}`;
      } else {
        athleteId = result.athlete_name!
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .trim();
      }
    } else {
      // IWF: use iwf_lifter_id (preferred) or db_lifter_id as fallback
      athleteId = (result.iwf_lifter_id || result.db_lifter_id)!.toString();
    }

    // Use helper to build correct URL based on source
    const url = buildAthleteUrl(athleteId, source);
    router.push(url);
  };

  // Handle meet result selection
  const handleMeetResultSelect = (result: SearchResult) => {
    setMeetSearchQuery(result.meet_name!);
    setShowMeetResults(false);

    const source: DataSource = result.source || 'USAW';

    // Determine meet ID based on source
    const meetId = source === 'USAW' ? result.meet_id : result.db_meet_id;

    // Use helper to build correct URL based on source
    const url = buildMeetUrl(meetId!.toString(), source);
    router.push(url);
  };

  // Handle popular search clicks (for future implementation)
  const handlePopularSearch = (searchTerm: string) => {
    setSearchQuery(searchTerm);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  const clearMeetSearch = () => {
    setMeetSearchQuery('');
    setMeetSearchResults([]);
    setShowMeetResults(false);
    meetSearchInputRef.current?.focus();
  };

  const { user } = useAuth();
  const canViewRankings =
    !!user &&
    (user.role === ROLES.ADMIN ||
      user.role === ROLES.COACH ||
      user.role === ROLES.USAW_NATIONAL_TEAM_COACH);

  return (
    <div className="min-h-screen bg-app-gradient">
      {/* Header */}
      <header className="bg-header-blur border-b border-app-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="WeightliftingDB Logo"
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-app-primary">WeightliftingDB</h1>
                <p className="text-sm text-app-tertiary">USA Weightlifting Results Database</p>
              </div>
            </Link>

            {/* Add Theme Switcher and User Menu (only when logged in) */}
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              <UserMenu onLoginClick={() => setShowLoginModal(true)} showOnlyWhenLoggedIn />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Search */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-app-primary mb-6">
            USA Weightlifting
            <span className="block text-blue-400">Results Database</span>
          </h2>
          <p className="text-lg text-app-secondary mb-12 max-w-2xl mx-auto">
            Search through thousands of competition results and
            analyze performance trends from USA Weightlifting athletes.
          </p>

          {/* Search Interface */}
          <div className="relative space-y-6">
            {/* Athlete Search Bar */}
            <div className="relative">
              <form onSubmit={handleSearch} className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center">
                  {isSearching ? (
                    <Loader2 className="animate-spin h-4 w-4 text-blue-400" />
                  ) : (
                    <Search className="h-4 w-4 text-app-muted" />
                  )}
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  id="athlete-search"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(value);
                    if (value.length >= 2) {
                      setIsSearching(true);
                    } else {
                      setIsSearching(false);
                      setSearchResults([]);
                      setShowResults(false);
                    }
                  }}
                  onFocus={() => {
                    setShowMeetResults(false);
                  }}
                  placeholder={`Search athletes... (e.g., ${placeholderName})`}
                  className={`pl-12 input-primary ${isSearching ? 'animate-pulse border-blue-400' : ''}`}
                  aria-busy={isSearching}
                  autoComplete="off"
                />

                {/* Clear button */}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-16 top-1/2 transform -translate-y-1/2 text-app-muted hover:text-app-primary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center space-x-2"
                >
                  <span className="hidden sm:inline">Search</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {/* Athlete Search Results Dropdown */}
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-app-secondary border border-app-primary rounded-xl shadow-xl z-20 max-h-96 overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-app-muted">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto mb-2"></div>
                      Searching...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="py-2">
                      {searchResults.map((result) => {
                        const source: DataSource = result.source || 'USAW';
                        const sourceColors = getSourceColor(source);
                        const resultKey = `${source}_${source === 'USAW' ? result.lifter_id : result.db_lifter_id}`;


                        // Build display info based on source
                        const displayInfo = source === 'IWF'
                          ? [result.gender, result.country_name, result.iwf_lifter_id ? `#${result.iwf_lifter_id}` : (result.db_lifter_id ? `#${result.db_lifter_id}` : null)]
                          : [result.gender, result.club_name, result.membership_number && result.membership_number !== 'null' ? `#${result.membership_number}` : (result.lifter_id ? `Ref #${result.lifter_id}` : null)];

                        const athleteUrl = buildAthleteUrl(
                          result.source === 'IWF'
                            ? (result.iwf_lifter_id || result.db_lifter_id)!.toString()
                            : (result.membership_number && result.membership_number !== 'null'
                              ? result.membership_number.toString()
                              : (result.lifter_id ? `u-${result.lifter_id}` : result.athlete_name!
                                .toLowerCase()
                                .replace(/[^\w\s-]/g, '')
                                .replace(/\s+/g, '-')
                                .trim())),
                          result.source || 'USAW'
                        );
                        return (
                          <Link
                            key={resultKey}
                            href={athleteUrl}
                            data-search-result="athlete"
                            onClick={() => setShowResults(false)}
                            className="w-full px-4 py-3 text-left bg-interactive transition-colors flex items-center space-x-3 hover:bg-blue-500/10"
                          >
                            {React.createElement(getSearchIcon(result.type || 'athlete'), {
                              className: "h-5 w-5 text-app-muted"
                            })}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-app-primary font-medium">{result.athlete_name}</div>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${sourceColors.bg} ${sourceColors.text} ${sourceColors.border}`}>
                                  {getSourceBadge(source)}
                                </span>
                              </div>
                              <div className="text-sm text-app-tertiary">
                                {displayInfo.filter(Boolean).join(' • ')}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <div className="p-4 text-center text-app-muted">
                      No results found for &apos;{searchQuery}&apos;
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Meet Search Bar */}
            <div className="relative">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (meetSearchQuery.trim().length >= 2 && !isMeetSearching) {
                    setIsMeetSearching(true);
                    debouncedMeetSearch(meetSearchQuery);
                  }
                }}
                className="relative"
              >
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center">
                  {isMeetSearching ? (
                    <Loader2 className="animate-spin h-4 w-4 text-blue-400" />
                  ) : (
                    <CalendarDays className="h-4 w-4 text-app-muted" />
                  )}
                </div>
                <input
                  ref={meetSearchInputRef}
                  type="text"
                  id="meet-search"
                  name="meetSearch"
                  value={meetSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMeetSearchQuery(value);
                    if (value.length >= 2) {
                      setIsMeetSearching(true);
                    } else {
                      setIsMeetSearching(false);
                      setMeetSearchResults([]);
                      setShowMeetResults(false);
                    }
                  }}
                  onFocus={() => {
                    setShowResults(false);
                  }}
                  placeholder={`Search meets... (e.g., ${placeholderMeet})`}
                  className={`pl-12 input-primary ${isMeetSearching ? 'animate-pulse border-blue-400' : ''}`}
                  aria-busy={isMeetSearching}
                  autoComplete="off"
                />

                {/* Clear button */}
                {meetSearchQuery && (
                  <button
                    type="button"
                    onClick={clearMeetSearch}
                    className="absolute right-16 top-1/2 transform -translate-y-1/2 text-app-muted hover:text-app-primary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center space-x-2"
                >
                  <span className="hidden sm:inline">Search</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {/* Meet Search Results Dropdown */}
              {showMeetResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-app-secondary border border-app-primary rounded-xl shadow-xl z-20 max-h-96 overflow-y-auto">
                  {isMeetSearching ? (
                    <div className="p-4 text-center text-app-muted">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto mb-2"></div>
                      Searching...
                    </div>
                  ) : meetSearchResults.length > 0 ? (
                    <div className="py-2">
                      {meetSearchResults.map((result) => {
                        const source: DataSource = result.source || 'USAW';
                        const sourceColors = getSourceColor(source);
                        const resultKey = `${source}_${source === 'USAW' ? result.meet_id : result.db_meet_id}`;

                        return (
                          <Link
                            key={resultKey}
                            href={buildMeetUrl((result.source === 'USAW' ? result.meet_id : result.db_meet_id)!.toString(), result.source || 'USAW')}
                            data-search-result="meet"
                            onClick={() => setShowMeetResults(false)}
                            className="w-full px-4 py-3 text-left bg-interactive transition-colors flex items-center space-x-3 hover:bg-blue-500/10"
                          >
                            <CalendarDays className="h-5 w-5 text-app-muted" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-app-primary font-medium">{result.meet_name}</div>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${sourceColors.bg} ${sourceColors.text} ${sourceColors.border}`}>
                                  {getSourceBadge(source)}
                                </span>
                              </div>
                              <div className="text-sm text-app-tertiary">
                                {[
                                  result.date ? new Date(result.date).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  }) : null,
                                  result.level,
                                  result.location_text
                                ].filter(Boolean).join(' • ')}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : meetSearchQuery.length >= 2 ? (
                    <div className="p-4 text-center text-app-muted">
                      No results found for &apos;{meetSearchQuery}&apos;
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Cards Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* WSO Navigation Card */}
            <Link href="/WSO" className="group">
              <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-500/10 rounded-full p-3 group-hover:bg-blue-500/20 transition-colors">
                    <MapPin className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-app-primary group-hover:text-blue-400 transition-colors">
                      WSO Directory
                    </h3>
                    <p className="text-sm text-app-tertiary mt-1">
                      Explore Weightlifting State Organizations
                    </p>
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm text-blue-500 group-hover:text-blue-400 transition-colors">
                  <span>View interactive map</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Barbell Clubs Navigation Card */}
            <Link href="/club" className="group">
              <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105">
                <div className="flex items-center space-x-4">
                  <div className="bg-orange-500/10 rounded-full p-3 group-hover:bg-orange-500/20 transition-colors">
                    <Dumbbell className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-app-primary group-hover:text-orange-400 transition-colors">
                      Barbell Clubs
                    </h3>
                    <p className="text-sm text-app-tertiary mt-1">
                      Discover registered weightlifting clubs
                    </p>
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm text-orange-500 group-hover:text-orange-400 transition-colors">
                  <span>Explore club locations</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Rankings Navigation Card - visible only to authorized roles */}
            {canViewRankings && (
              <Link href="/rankings" className="group">
                <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105">
                  <div className="flex items-center space-x-4">
                    <div className="bg-emerald-500/10 rounded-full p-3 group-hover:bg-emerald-500/20 transition-colors">
                      <Trophy className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-app-primary group-hover:text-emerald-400 transition-colors">
                        Rankings
                      </h3>
                      <p className="text-sm text-app-tertiary mt-1">
                        Explore athlete qualification rankings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center mt-4 text-sm text-emerald-400 group-hover:text-emerald-300 transition-colors">
                    <span>View rankings</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            )}

            {/* Upcoming Meets Navigation Card - visible only to Admin */}
            {user?.role === ROLES.ADMIN && (
              <Link href="/upcoming-meets" className="group">
                <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105">
                  <div className="flex items-center space-x-4">
                    <div className="bg-purple-500/10 rounded-full p-3 group-hover:bg-purple-500/20 transition-colors">
                      <CalendarFold className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-app-primary group-hover:text-purple-400 transition-colors">
                        Upcoming Meets
                      </h3>
                      <p className="text-sm text-app-tertiary mt-1">
                        Browse upcoming competition schedules
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center mt-4 text-sm text-purple-400 group-hover:text-purple-300 transition-colors">
                    <span>View upcoming meets</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-app-tertiary/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Stats content can be added here later */}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-app-secondary text-app-primary py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          {/* Mobile: Centered vertical layout, Desktop: Two columns */}
          <div className="flex flex-col items-center md:grid md:grid-cols-2 gap-6 md:gap-8 md:items-start">
            {/* Logo and description */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 mb-4">
                <Image
                  src="/logo.png"
                  alt="WeightliftingDB Logo"
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
                <span className="font-bold">WeightliftingDB</span>
              </div>
              <p className="text-app-tertiary text-sm">
                Open source project, MIT License. Data sourced from official competition results.
              </p>
            </div>

            {/* User menu and GitHub link */}
            <div className="flex flex-col items-center md:items-end md:justify-end gap-4">
              <UserMenu onLoginClick={() => setShowLoginModal(true)} />
              <a
                href="https://github.com/PhillipBost/weightlifting-frontend"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-app-tertiary hover:text-app-primary transition-colors"
                title="View source code on GitHub"
              >
                <Github className="h-4 w-4" />
                <span className="text-sm">GitHub</span>
              </a>
            </div>
          </div>

          {/* Copyright - always centered */}
          <div className="border-t border-app-secondary mt-8 pt-8 text-center text-sm text-app-tertiary">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
              <span className="whitespace-nowrap">2025 WeightliftingDB.</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                Built with <Heart className="h-4 w-4 text-blue-400" fill="currentColor" /> for
              </span>
              <span className="whitespace-nowrap">the weightlifting community.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
