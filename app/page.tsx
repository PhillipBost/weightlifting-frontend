"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, TrendingUp, Trophy, Users, Calendar, CalendarDays, MapPinned, Weight, Dumbbell, Database, Filter, ArrowRight, Github, Heart, X, User, MapPin, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { supabaseIWF } from '../lib/supabaseIWF';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { UserMenu } from './components/UserMenu';
import { LoginModal } from './components/LoginModal';
import { DataSource, getSourceBadge, getSourceColor, buildAthleteUrl, buildMeetUrl } from '../lib/types/dataSource';
import { queryWithTimeout } from '../lib/supabase-utils';
import { useAuth } from './components/AuthProvider';
import { ROLES } from '../lib/roles';

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

// Country code to name mapping
const COUNTRY_CODE_MAP: Record<string, string> = {
  'CHN': 'China',
  'THA': 'Thailand',
  'USA': 'United States',
  'NGR': 'Nigeria',
  'GBR': 'United Kingdom',
  'AUS': 'Australia',
  'CAN': 'Canada',
  'JPN': 'Japan',
  'KOR': 'South Korea',
  'RUS': 'Russia',
  'UKR': 'Ukraine',
  'POL': 'Poland',
  'GER': 'Germany',
  'ITA': 'Italy',
  'FRA': 'France',
  'ESP': 'Spain',
  'MEX': 'Mexico',
  'BRA': 'Brazil',
  'ARG': 'Argentina',
  'IND': 'India'
};

const getCountryName = (countryCode: string): string => {
  // If it's already a full name (contains space or is longer than 3 chars), return as is
  if (!countryCode || countryCode.length > 3 || countryCode.includes(' ')) {
    return countryCode;
  }
  // Try to map code to name, otherwise return the code
  return COUNTRY_CODE_MAP[countryCode.toUpperCase()] || countryCode;
};

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

export default function WeightliftingLandingPage() {
  const supabase = createClient();
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
      try {
        const searchTerms = generateAthleteSearchTerms(query);
        const usawResults: any[] = [];
        const iwfResults: any[] = [];

        // Search with each term variation using staged parallel strategy
        for (const term of searchTerms.slice(0, 3)) {
          // Batch 1: Stage 1 queries (Starts-with) - High relevance
          const stage1Promises = [
            // USAW Stage 1
            queryWithTimeout(
              supabase
                .from('lifters')
                .select('lifter_id, athlete_name, membership_number')
                .ilike('athlete_name', `${term}%`)
                .order('athlete_name')
                .limit(100) as any,
              15000,
              `USAW Stage 1 (${term})`
            ).then((res: any) => ({ type: 'USAW_1', data: res.data, error: res.error }))
              .catch(err => ({ type: 'USAW_1', data: null, error: err })),

            // IWF Stage 1
            queryWithTimeout(
              supabaseIWF
                .from('iwf_lifters')
                .select('db_lifter_id, athlete_name, gender, country_name, iwf_lifter_id')
                .ilike('athlete_name', `${term}%`)
                .order('athlete_name')
                .limit(100) as any,
              15000,
              `IWF Stage 1 (${term})`
            ).then((res: any) => ({ type: 'IWF_1', data: res.data, error: res.error }))
              .catch(err => ({ type: 'IWF_1', data: null, error: err }))
          ];

          // Wait for Stage 1 to complete
          const stage1Results = await Promise.all(stage1Promises);

          // Process Stage 1 results
          stage1Results.forEach(result => {
            if (result.error) {
              console.error(`[SEARCH] ${result.type} error:`, result.error?.message || result.error);
            } else if (result.data) {
              if (result.type === 'USAW_1') usawResults.push(...result.data);
              if (result.type === 'IWF_1') iwfResults.push(...result.data);
            }
          });

          // Batch 2: Stage 2 queries (Contains) - Lower relevance
          // Only run if we haven't found too many results yet to save resources? 
          // For now, run unconditionally as per requirements, but parallelized
          const stage2Promises = [
            // USAW Stage 2
            queryWithTimeout(
              supabase
                .from('lifters')
                .select('lifter_id, athlete_name, membership_number')
                .ilike('athlete_name', `%${term}%`)
                .not('athlete_name', 'ilike', `${term}%`)
                .order('athlete_name')
                .limit(200) as any,
              15000,
              `USAW Stage 2 (${term})`
            ).then((res: any) => ({ type: 'USAW_2', data: res.data, error: res.error }))
              .catch(err => ({ type: 'USAW_2', data: null, error: err })),

            // IWF Stage 2
            queryWithTimeout(
              supabaseIWF
                .from('iwf_lifters')
                .select('db_lifter_id, athlete_name, gender, country_name, iwf_lifter_id')
                .ilike('athlete_name', `%${term}%`)
                .not('athlete_name', 'ilike', `${term}%`)
                .order('athlete_name')
                .limit(200) as any,
              15000,
              `IWF Stage 2 (${term})`
            ).then((res: any) => ({ type: 'IWF_2', data: res.data, error: res.error }))
              .catch(err => ({ type: 'IWF_2', data: null, error: err }))
          ];

          // Wait for Stage 2 to complete
          const stage2Results = await Promise.all(stage2Promises);

          // Process Stage 2 results
          stage2Results.forEach(result => {
            if (result.error) {
              console.error(`[SEARCH] ${result.type} error:`, result.error?.message || result.error);
            } else if (result.data) {
              if (result.type === 'USAW_2') usawResults.push(...result.data);
              if (result.type === 'IWF_2') iwfResults.push(...result.data);
            }
          });
        }

        // Remove USAW duplicates by lifter_id
        const uniqueUsawLifters = Array.from(
          new Map(usawResults.map(lifter => [lifter.lifter_id, lifter])).values()
        );

        // Remove IWF duplicates by db_lifter_id
        const uniqueIwfLifters = Array.from(
          new Map(iwfResults.map(lifter => [lifter.db_lifter_id, lifter])).values()
        );

        // Get USAW athlete data with meet results (optimized with single batch query)
        let usawAthletes: SearchResult[] = [];
        if (uniqueUsawLifters.length > 0) {
          const lifterIds = uniqueUsawLifters.map(l => l.lifter_id);

          // Fetch recent results for all lifters in one query
          const { data: allRecentResults } = await supabase
            .from('meet_results')
            .select('lifter_id, wso, club_name, gender, date')
            .in('lifter_id', lifterIds)
            .order('date', { ascending: false });

          // Group results by lifter_id
          const resultsByLifter = new Map<number, any[]>();
          allRecentResults?.forEach(result => {
            if (!resultsByLifter.has(result.lifter_id)) {
              resultsByLifter.set(result.lifter_id, []);
            }
            resultsByLifter.get(result.lifter_id)!.push(result);
          });

          // Map lifters with their recent data
          usawAthletes = uniqueUsawLifters.map(lifter => {
            const results = resultsByLifter.get(lifter.lifter_id) || [];
            const recentWso = results.find(r => r.wso && r.wso.trim() !== '')?.wso;
            const recentClub = results.find(r => r.club_name && r.club_name.trim() !== '')?.club_name;
            const recentGender = results.find(r => r.gender && r.gender.trim() !== '')?.gender;

            return {
              lifter_id: lifter.lifter_id,
              athlete_name: lifter.athlete_name,
              membership_number: lifter.membership_number,
              wso: recentWso,
              club_name: recentClub,
              gender: recentGender,
              type: 'athlete',
              source: 'USAW' as DataSource
            };
          });
        }

        // Transform IWF athlete data
        const iwfAthletes = uniqueIwfLifters.map(lifter => ({
          db_lifter_id: lifter.db_lifter_id,
          athlete_name: lifter.athlete_name,
          gender: lifter.gender,
          country_name: lifter.country_name,
          iwf_lifter_id: lifter.iwf_lifter_id,
          type: 'athlete',
          source: 'IWF' as DataSource
        }));

        // Merge all results
        const allAthletes: SearchResult[] = [...usawAthletes, ...iwfAthletes];

        // Deduplicate by (id, source) pair - preserves same-name athletes from different sources
        const deduplicatedAthletes = Array.from(
          new Map(
            allAthletes.map(athlete => {
              const id = 'lifter_id' in athlete
                ? athlete.lifter_id
                : 'db_lifter_id' in athlete
                  ? athlete.db_lifter_id
                  : athlete.athlete_name?.replace(/[^a-zA-Z0-9]/g, '_');
              return [
                `${String(id)}_${athlete.source}`,
                athlete
              ];
            })
          ).values()
        );



        // Sort results to prioritize exact matches, then by name matching quality
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/);
        const firstWord = queryWords[0];
        const lastWord = queryWords[queryWords.length - 1];

        deduplicatedAthletes.sort((a, b) => {
          const aNameLower = a.athlete_name!.toLowerCase();
          const bNameLower = b.athlete_name!.toLowerCase();

          // Check if either is an exact match
          const aExact = aNameLower === queryLower;
          const bExact = bNameLower === queryLower;

          // Exact matches come first
          if (aExact && !bExact) return -1;
          if (bExact && !aExact) return 1;

          // For single-word queries, prioritize names that START with the query (likely first name)
          if (queryWords.length === 1 && firstWord) {
            const aStartsWithQuery = aNameLower.startsWith(firstWord);
            const bStartsWithQuery = bNameLower.startsWith(firstWord);
            if (aStartsWithQuery && !bStartsWithQuery) return -1;
            if (bStartsWithQuery && !aStartsWithQuery) return 1;
          }

          // If both exact or both partial, sort by source (USAW first)
          if (a.source !== b.source) {
            return a.source === 'USAW' ? -1 : 1;
          }

          // Same source, sort alphabetically
          return aNameLower.localeCompare(bNameLower);
        });



        const finalResults = deduplicatedAthletes.slice(0, 100) || [];
        setSearchResults(finalResults);
        setShowResults(true);
      } catch (err) {
        // Don't show error if search was aborted (user typed again)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[SEARCH] Search aborted - user typed again');
          return;
        }

        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[SEARCH] Error:', errorMsg);

        // Show user-friendly error message
        if (errorMsg.includes('timeout')) {
          console.warn('[SEARCH] Search timed out - database may be slow');
        } else if (errorMsg.includes('network')) {
          console.warn('[SEARCH] Network error - check your connection');
        }

        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Strip punctuation from search terms
  const stripPunctuation = (term: string): string => {
    return term.replace(/[^\w\s-]/g, '').trim();
  };

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
  const generateAthleteSearchTerms = (query: string) => {
    const terms = [query];
    const cleaned = query.toLowerCase().trim();

    // Handle common typos in names
    let fuzzyQuery = cleaned;

    // Remove extra letters (e.g., "Philllip" -> "Philip")
    fuzzyQuery = fuzzyQuery.replace(/([a-z])\1{2,}/g, '$1$1'); // Reduce 3+ repeated letters to 2
    fuzzyQuery = fuzzyQuery.replace(/([a-z])\1{1,}/g, '$1'); // Then reduce 2+ to single

    // Add the cleaned version if it's different
    if (fuzzyQuery !== cleaned) {
      terms.push(query.replace(new RegExp(cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), fuzzyQuery));
    }

    // Handle multi-word queries to support names with middle names
    // For "olivia reeves", also generate "olivia%reeves" pattern to match "Olivia Lynn REEVES"
    const words = cleaned.trim().split(/\s+/);
    if (words.length === 2) {
      // Two-word query: add a pattern that allows for middle names
      const twoWordPattern = `${words[0]}%${words[1]}`;
      terms.push(twoWordPattern);
    } else if (words.length > 2) {
      // Three+ word query: generate patterns for first + last word combinations
      // Example: "olivia lynn reeves" -> "olivia%reeves"
      const firstWord = words[0];
      const lastWord = words[words.length - 1];
      if (firstWord !== lastWord) {
        terms.push(`${firstWord}%${lastWord}`);
      }
    }

    // Common name variations
    const nameVariations: Record<string, string[]> = {
      // Philip variations
      'philip': ['phillip', 'filip', 'phil'],
      'phillip': ['philip', 'filip', 'phil'],
      'filip': ['philip', 'phillip', 'phil'],
      'phil': ['philip', 'phillip', 'filip'],

      // Catherine variations
      'catherine': ['katherine', 'kathryn', 'cathy', 'kate', 'katie', 'cat'],
      'katherine': ['catherine', 'kathryn', 'kathy', 'kate', 'katie', 'kat'],
      'kathryn': ['catherine', 'katherine', 'kathy', 'kate', 'katie'],
      'cathy': ['catherine', 'kathy', 'kate'],
      'kathy': ['katherine', 'kathryn', 'cathy', 'kate'],
      'kate': ['katherine', 'kathryn', 'catherine', 'katie', 'cathy'],
      'katie': ['katherine', 'kathryn', 'catherine', 'kate'],

      // John variations
      'john': ['jon', 'johnny', 'johnathan', 'jonathan', 'jack'],
      'jon': ['john', 'johnny', 'johnathan', 'jonathan'],
      'johnny': ['john', 'jon'],
      'johnathan': ['john', 'jon', 'jonathan'],
      'jonathan': ['john', 'jon', 'johnathan'],
      'jack': ['john', 'jackson'],

      // Michael variations
      'michael': ['mike', 'mick', 'mickey', 'mikey'],
      'mike': ['michael', 'mick'],
      'mick': ['michael', 'mike'],
      'mickey': ['michael', 'mike'],
      'mikey': ['michael', 'mike'],

      // William variations
      'william': ['bill', 'will', 'billy', 'willy', 'willie'],
      'bill': ['william', 'billy'],
      'will': ['william', 'willy', 'willie'],
      'billy': ['william', 'bill'],
      'willy': ['william', 'will', 'willie'],
      'willie': ['william', 'will', 'willy'],

      // Robert variations
      'robert': ['rob', 'bob', 'robbie', 'bobby', 'bert'],
      'rob': ['robert', 'robbie'],
      'bob': ['robert', 'bobby'],
      'robbie': ['robert', 'rob'],
      'bobby': ['robert', 'bob'],
      'bert': ['robert', 'albert'],

      // Richard variations
      'richard': ['rick', 'dick', 'rich', 'richie', 'ricky'],
      'rick': ['richard', 'ricky'],
      'dick': ['richard'],
      'rich': ['richard', 'richie'],
      'richie': ['richard', 'rich'],
      'ricky': ['richard', 'rick'],

      // Christopher variations
      'christopher': ['chris', 'christy', 'christie'],
      'chris': ['christopher', 'christian', 'christine'],
      'christy': ['christopher', 'christie'],
      'christie': ['christopher', 'christy'],

      // Nicholas variations
      'nicholas': ['nick', 'nicky', 'nicolas'],
      'nick': ['nicholas', 'nicky'],
      'nicky': ['nicholas', 'nick'],
      'nicolas': ['nicholas', 'nick'],

      // Anthony variations
      'anthony': ['tony', 'anton'],
      'tony': ['anthony', 'antonio'],
      'anton': ['anthony', 'antonio'],
      'antonio': ['anthony', 'tony', 'anton'],

      // Matthew variations
      'matthew': ['matt', 'matty'],
      'matt': ['matthew', 'matty'],
      'matty': ['matthew', 'matt'],

      // Andrew variations
      'andrew': ['andy', 'drew'],
      'andy': ['andrew', 'anderson'],
      'drew': ['andrew'],

      // Daniel variations
      'daniel': ['dan', 'danny', 'dane'],
      'dan': ['daniel', 'danny'],
      'danny': ['daniel', 'dan'],
      'dane': ['daniel'],

      // David variations
      'david': ['dave', 'davey', 'davy'],
      'dave': ['david', 'davey'],
      'davey': ['david', 'dave', 'davy'],
      'davy': ['david', 'davey'],

      // Elizabeth variations
      'elizabeth': ['liz', 'beth', 'betsy', 'betty', 'eliza', 'lisa'],
      'liz': ['elizabeth', 'lisa'],
      'beth': ['elizabeth', 'bethany'],
      'betsy': ['elizabeth', 'betty'],
      'betty': ['elizabeth', 'betsy'],
      'eliza': ['elizabeth'],
      'lisa': ['elizabeth', 'liz'],

      // Jennifer variations
      'jennifer': ['jen', 'jenny', 'jenn'],
      'jen': ['jennifer', 'jenny'],
      'jenny': ['jennifer', 'jen'],
      'jenn': ['jennifer', 'jen'],

      // Jessica variations
      'jessica': ['jess', 'jessie'],
      'jess': ['jessica', 'jessie'],
      'jessie': ['jessica', 'jess'],

      // James variations
      'james': ['jim', 'jimmy', 'jamie'],
      'jim': ['james', 'jimmy'],
      'jimmy': ['james', 'jim'],
      'jamie': ['james'],

      // Joseph variations
      'joseph': ['joe', 'joey', 'jos'],
      'joe': ['joseph', 'joey'],
      'joey': ['joseph', 'joe'],
      'jos': ['joseph'],

      // Thomas variations
      'thomas': ['tom', 'tommy', 'thom'],
      'tom': ['thomas', 'tommy'],
      'tommy': ['thomas', 'tom'],
      'thom': ['thomas'],

      // Charles variations
      'charles': ['charlie', 'chuck', 'chas'],
      'charlie': ['charles', 'charlotte'],
      'chuck': ['charles'],
      'chas': ['charles'],

      // Patricia variations
      'patricia': ['pat', 'patty', 'trish', 'patsy'],
      'pat': ['patricia', 'patrick', 'patty'],
      'patty': ['patricia', 'pat'],
      'trish': ['patricia'],
      'patsy': ['patricia'],

      // Patrick variations
      'patrick': ['pat', 'paddy', 'rick'],
      'paddy': ['patrick'],

      // Additional common names
      'alexander': ['alex', 'xander', 'sandy'],
      'alex': ['alexander', 'alexandra', 'alexis'],
      'xander': ['alexander'],
      'sandy': ['alexander', 'sandra'],

      'benjamin': ['ben', 'benny', 'benji'],
      'ben': ['benjamin', 'benny'],
      'benny': ['benjamin', 'ben'],
      'benji': ['benjamin'],

      'gregory': ['greg', 'gregg'],
      'greg': ['gregory', 'gregg'],
      'gregg': ['gregory', 'greg'],

      'joshua': ['josh'],
      'josh': ['joshua'],

      'steven': ['steve', 'stevie'],
      'stephen': ['steve', 'stevie'],
      'steve': ['steven', 'stephen', 'stevie'],
      'stevie': ['steven', 'stephen', 'steve'],

      'timothy': ['tim', 'timmy'],
      'tim': ['timothy', 'timmy'],
      'timmy': ['timothy', 'tim'],

      'edward': ['ed', 'eddie', 'ted'],
      'ed': ['edward', 'eddie'],
      'eddie': ['edward', 'ed'],
      'ted': ['edward', 'theodore'],

      'ronald': ['ron', 'ronnie'],
      'ron': ['ronald', 'ronnie'],
      'ronnie': ['ronald', 'ron'],

      'harley': ['harv'],
      'harv': ['harley'],

      'martha': ['mattie'],
      'mattie': ['martha'],

      'wesley': ['wes'],
      'wes': ['wesley']
    };

    // Athletes who competed under different names (former names, married names, etc.)
    // Check this BEFORE individual name variations to avoid conflicts
    const athleteNameChanges: Record<string, string[]> = {
      'kate nye': ['katherine vibert'],
      'katherine vibert': ['kate nye'],
      // Add more athlete name changes here as needed
    };

    // Check for full name matches (exact athlete name changes)
    Object.entries(athleteNameChanges).forEach(([formerName, currentNames]) => {
      const formerNameLower = formerName.toLowerCase();
      if (cleaned === formerNameLower) {
        currentNames.forEach(currentName => {
          terms.push(currentName);
        });
      }
    });

    // Only apply individual name variations if we haven't found a specific athlete name change
    const hasSpecificNameMatch = Object.keys(athleteNameChanges).some(
      key => cleaned === key.toLowerCase()
    );

    if (!hasSpecificNameMatch) {
      // Add name variations for individual words
      Object.entries(nameVariations).forEach(([key, alts]) => {
        const keyRegex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (keyRegex.test(cleaned)) {
          alts.forEach(alt => {
            terms.push(query.replace(keyRegex, alt));
          });
        }
      });
    }



    // Also try partial matches for name changes (in case the exact name format is different)
    if (cleaned.includes('kate') && cleaned.includes('nye')) {
      // Add various combinations for Katherine Vibert specifically
      terms.push('vibert');
      terms.push('katherine vibert');
      terms.push('kate vibert');
      terms.push('vibert, katherine');
      terms.push('vibert, kate');
    }

    return [...new Set(terms)]; // Remove duplicates
  };

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

      setIsMeetSearching(true);
      try {
        const searchTerms = fuzzySearchTerms(query);
        const cleanSearchTerms = searchTerms.map(term => stripPunctuation(term));
        const usawResults: any[] = [];
        const iwfResults: any[] = [];

        // For multi-word searches, we want to find meets that contain ALL words
        const queryWords = stripPunctuation(query).split(/\s+/);
        const isMultiWordSearch = queryWords.length > 1;

        if (isMultiWordSearch) {
          // USAW Multi-word search (includes location columns)
          let supabaseQuery = supabase
            .from('meets')
            .select('meet_id, Meet, Date, Level, city, state, address');

          queryWords.forEach(word => {
            supabaseQuery = supabaseQuery.ilike('Meet', `%${word}%`);
          });

          let exactMatches, exactError;
          try {
            const result = await queryWithTimeout(
              supabaseQuery
                .order('Date', { ascending: false })
                .limit(30) as any,
              10000,
              'USAW meet exact match'
            ) as any;
            exactMatches = result.data;
            exactError = result.error;
          } catch (err) {
            exactError = err;
            exactMatches = null;
          }
          if (exactError) {
            console.error('[MEET_SEARCH] USAW exact match error:', exactError?.message || exactError);
          }

          if (!exactError && exactMatches) {
            usawResults.push(...exactMatches);
          }

          // Also try with fuzzy variations
          for (const term of searchTerms.slice(0, 2)) {
            const termWords = term.toLowerCase().trim().split(/\s+/);
            if (termWords.length > 1) {
              let fuzzyQuery = supabase
                .from('meets')
                .select('meet_id, Meet, Date, Level, city, state, address');

              termWords.forEach(word => {
                fuzzyQuery = fuzzyQuery.ilike('Meet', `%${word}%`);
              });

              const { data: fuzzyMatches, error: fuzzyError } = await fuzzyQuery
                .order('Date', { ascending: false })
                .limit(20);

              if (!fuzzyError && fuzzyMatches) {
                usawResults.push(...fuzzyMatches);
              }
            }
          }

          // IWF Multi-word search
          let iwfQuery = supabaseIWF
            .from('iwf_meets')
            .select('db_meet_id, meet, date, level, iwf_meet_id, iwf_meet_locations(city, country, location_text)');

          queryWords.forEach(word => {
            iwfQuery = iwfQuery.ilike('meet', `%${word}%`);
          });

          const { data: iwfMatches, error: iwfError } = await iwfQuery
            .order('date', { ascending: false })
            .limit(30);

          if (!iwfError && iwfMatches) {
            iwfResults.push(...iwfMatches);
          }

          // IWF Multi-word location search
          for (const term of cleanSearchTerms.slice(0, 2)) {
            const { data: locationMatches } = await supabaseIWF
              .from('iwf_meet_locations')
              .select('iwf_meet_id')
              .or(`location_text.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`)
              .limit(50);

            if (locationMatches && locationMatches.length > 0) {
              const iwfMeetIds = locationMatches.map(loc => loc.iwf_meet_id);
              const { data: matchedMeets } = await supabaseIWF
                .from('iwf_meets')
                .select('db_meet_id, meet, date, level, iwf_meet_id, iwf_meet_locations(city, country, location_text)')
                .in('iwf_meet_id', iwfMeetIds);

              if (matchedMeets) {
                iwfResults.push(...matchedMeets);
              }
            }
          }
        } else {
          // USAW Single word search (includes location columns)
          for (const term of cleanSearchTerms.slice(0, 3)) {
            const { data: meets, error: meetsError } = await supabase
              .from('meets')
              .select('meet_id, Meet, Date, Level, city, state, address')
              .ilike('Meet', `%${term}%`)
              .order('Date', { ascending: false })
              .limit(20);

            if (!meetsError && meets) {
              usawResults.push(...meets);
            }
          }

          // USAW location search (search in public.meets columns directly)
          for (const term of cleanSearchTerms.slice(0, 2)) {
            const { data: locationMatches, error: locError } = await supabase
              .from('meets')
              .select('meet_id, Meet, Date, Level, city, state, address')
              .or(`city.ilike.%${term}%,state.ilike.%${term}%,address.ilike.%${term}%`)
              .limit(50);

            if (!locError && locationMatches) {
              usawResults.push(...locationMatches);
            }
          }

          // IWF Single word search
          for (const term of cleanSearchTerms.slice(0, 3)) {
            const { data: iwfMeets, error: iwfError } = await supabaseIWF
              .from('iwf_meets')
              .select('db_meet_id, meet, date, level, iwf_meet_id, iwf_meet_locations(city, country, location_text)')
              .ilike('meet', `%${term}%`)
              .order('date', { ascending: false })
              .limit(20);

            if (!iwfError && iwfMeets) {
              iwfResults.push(...iwfMeets);
            }
          }

          // IWF location search - use two-step pattern (query locations first, then meets)
          for (const term of cleanSearchTerms.slice(0, 2)) {
            const { data: locationMatches } = await supabaseIWF
              .from('iwf_meet_locations')
              .select('iwf_meet_id')
              .or(`location_text.ilike.%${term}%,city.ilike.%${term}%,country.ilike.%${term}%`)
              .limit(50);

            if (locationMatches && locationMatches.length > 0) {
              const iwfMeetIds = locationMatches.map(loc => loc.iwf_meet_id);
              const { data: matchedMeets } = await supabaseIWF
                .from('iwf_meets')
                .select('db_meet_id, meet, date, level, iwf_meet_id, iwf_meet_locations(city, country, location_text)')
                .in('iwf_meet_id', iwfMeetIds);

              if (matchedMeets) {
                iwfResults.push(...matchedMeets);
              }
            }
          }
        }

        // Remove USAW duplicates
        const uniqueUsawMeets = Array.from(
          new Map(usawResults.map(meet => [meet.meet_id, meet])).values()
        );

        // Remove IWF duplicates
        const uniqueIwfMeets = Array.from(
          new Map(iwfResults.map(meet => [meet.db_meet_id, meet])).values()
        );

        // DEBUG: Inspect raw IWF unique meets and nested locations
        console.log(
          '[IWF_UNIQUE_MEETS_SAMPLE]',
          uniqueIwfMeets.slice(0, 5).map(m => ({
            db_meet_id: m.db_meet_id,
            iwf_meet_id: m.iwf_meet_id,
            meet: m.meet,
            iwf_meet_locations: m.iwf_meet_locations
          }))
        );

        // Transform USAW results
        const transformedUsawMeets = uniqueUsawMeets.map((meet) => {
          // Build a clean, user-friendly location string from meet columns
          let locationText = '';

          const rawAddress = (meet.address || '').trim();

          // Treat long geocoded strings as noise for search display
          const hasGeocodeNoise =
            /united states/i.test(rawAddress) ||
            /\b\d{5}(?:-\d{4})?\b/.test(rawAddress);

          if (meet.city && meet.state) {
            // Prefer "City, State" for USAW search results
            locationText = `${meet.city}, ${meet.state}`;
          } else if (!hasGeocodeNoise && rawAddress && meet.city && !meet.state) {
            // If we only have city + a short address (no country/zip), show both
            locationText = `${rawAddress}, ${meet.city}`;
          } else if (meet.city) {
            locationText = meet.city;
          } else if (meet.state) {
            locationText = meet.state;
          } else if (!hasGeocodeNoise && rawAddress) {
            // Only fall back to address if it doesn't look like full geocode noise
            locationText = rawAddress;
          }

          return {
            meet_id: meet.meet_id,
            meet_name: meet.Meet,
            date: meet.Date,
            level: meet.Level,
            location_text: locationText,
            type: 'meet',
            source: 'USAW' as DataSource
          };
        });

        // Transform IWF results
        const transformedIwfMeets = uniqueIwfMeets.map((meet, index) => {
          // Extract location from nested iwf_meet_locations using schema:
          // iwf_meet_locations(location_text, city, country, ...)
          let locationText = '';

          const rawLoc = (meet as any).iwf_meet_locations;

          // Normalize: handle both single-object and array shapes from Supabase
          const loc =
            Array.isArray(rawLoc) && rawLoc.length > 0
              ? rawLoc[0]
              : rawLoc && !Array.isArray(rawLoc)
                ? rawLoc
                : null;

          if (loc) {
            if (loc.location_text && loc.location_text.trim() !== '') {
              // Preferred: ready-made "Paris, France" style string
              locationText = loc.location_text.trim();
            } else if (loc.city && loc.country) {
              locationText = `${loc.city}, ${loc.country}`;
            } else if (loc.city) {
              locationText = loc.city;
            } else if (loc.country) {
              locationText = loc.country;
            }
          }

          if (index < 5) {
            console.log('[IWF_TRANSFORM_SAMPLE]', {
              db_meet_id: meet.db_meet_id,
              iwf_meet_id: meet.iwf_meet_id,
              meet: meet.meet,
              iwf_meet_locations: meet.iwf_meet_locations,
              locationText
            });
          }

          return {
            db_meet_id: meet.db_meet_id,
            meet_name: meet.meet,
            date: meet.date,
            level: meet.level,
            location_text: locationText,
            type: 'meet',
            source: 'IWF' as DataSource
          };
        });

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const randomName = athleteNames[Math.floor(Math.random() * athleteNames.length)];
    setPlaceholderName(randomName);

    const randomMeet = meetNames[Math.floor(Math.random() * meetNames.length)];
    setPlaceholderMeet(randomMeet);
  }, []);

  useEffect(() => {
    const testIWF = async () => {
      try {
        const { data, error } = await supabaseIWF
          .from('iwf_lifters')
          .select('athlete_name, country_name')
          .eq('athlete_name', 'Lasha TALAKHADZE')
          .single();
        if (error) console.error('Sample fetch error:', error);
      } catch (e) {
        console.error('Sample fetch exception:', e);
      }
    };
    testIWF();
  }, []);

  // Close dropdowns when clicking outside
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
      if (result.membership_number) {
        athleteId = result.membership_number.toString();
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
                          : [result.gender, result.club_name, result.membership_number ? `#${result.membership_number}` : null];

                        const athleteUrl = buildAthleteUrl(
                          result.source === 'IWF'
                            ? (result.iwf_lifter_id || result.db_lifter_id)!.toString()
                            : (result.membership_number?.toString() || result.athlete_name!
                              .toLowerCase()
                              .replace(/[^\w\s-]/g, '')
                              .replace(/\s+/g, '-')
                              .trim()),
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
