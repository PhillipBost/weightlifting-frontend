"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, TrendingUp, Trophy, Users, Calendar, CalendarDays, MapPinned, Weight, Dumbbell, Database, Filter, ArrowRight, Github, Heart, X, User, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { UserMenu } from './components/UserMenu';
import { LoginModal } from './components/LoginModal';

// Types for our search results
interface SearchResult {
  athlete_name?: string;
  club_name?: string;
  wso?: string;
  membership_number?: string;
  lifter_id?: string;
  type?: string;
  gender?: string;
  // Meet fields
  meet_name?: string;
  date?: string;
  level?: string;
  meet_id?: string;
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
    switch(resultType) {
      case 'athlete': return User;
      case 'meet': return CalendarDays;      // for meet/competition results
      case 'wso': return MapPinned;         // for WSO/regional results  
      case 'club': return Dumbbell;         // for barbell club results
      default: return User;
    }
  };

  // Debounced search function with fuzzy search for athlete names
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const searchTerms = generateAthleteSearchTerms(query);
        const allResults: any[] = [];
        
        // Search with each term variation
        for (const term of searchTerms.slice(0, 6)) { // Increase to 6 variations
          const { data: lifters, error: liftersError } = await supabase
            .from('lifters')
            .select('lifter_id, athlete_name, membership_number')
            .ilike('athlete_name', `%${term}%`)
            .order('athlete_name')
            .limit(50);

          // Debug logging for Kate Nye specifically
          if (query.toLowerCase().includes('kate') && query.toLowerCase().includes('nye')) {
            console.log(`Searching for term: "${term}"`);
            console.log(`Results count: ${lifters?.length || 0}`);
            if (lifters && lifters.length > 0) {
              console.log('Found athletes:', lifters.map(l => l.athlete_name));
            }
            if (liftersError) {
              console.log('Query error:', liftersError);
            }
          }

          if (!liftersError && lifters) {
            allResults.push(...lifters);
          }
        }

        if (allResults.length === 0) {
          setSearchResults([]);
          setShowResults(true);
          return;
        }

        // Remove duplicates by lifter_id
        const uniqueLifters = Array.from(
          new Map(allResults.map(lifter => [lifter.lifter_id, lifter])).values()
        );

        // Step 2: Get recent meet results for WSO/club info for each lifter
        const searchResults = await Promise.all(
          uniqueLifters.map(async (lifter) => {
            const { data: recentResults } = await supabase
              .from('meet_results')
              .select('wso, club_name, gender, date')
              .eq('lifter_id', lifter.lifter_id)
              .order('date', { ascending: false })
              .limit(10);

            const recentWso = recentResults?.find(r => r.wso && r.wso.trim() !== '')?.wso;
            const recentClub = recentResults?.find(r => r.club_name && r.club_name.trim() !== '')?.club_name;
            const recentGender = recentResults?.find(r => r.gender && r.gender.trim() !== '')?.gender;

            return {
              lifter_id: lifter.lifter_id,
              athlete_name: lifter.athlete_name,
              membership_number: lifter.membership_number,
              wso: recentWso,
              club_name: recentClub,
              gender: recentGender,
              type: 'athlete'
            };
          })
        );

        // Step 3: Sort results to prioritize exact matches, then alphabetically
        const queryLower = query.toLowerCase();
        searchResults.sort((a, b) => {
          const aNameLower = a.athlete_name!.toLowerCase();
          const bNameLower = b.athlete_name!.toLowerCase();
          
          // Check if either is an exact match
          const aExact = aNameLower === queryLower;
          const bExact = bNameLower === queryLower;
          
          // Exact matches come first
          if (aExact && !bExact) return -1;
          if (bExact && !aExact) return 1;
          
          // If both exact or both partial, sort alphabetically
          return aNameLower.localeCompare(bNameLower);
        });

        
        setSearchResults(searchResults.slice(0, 100) || []); // Limit to 100 results
        setShowResults(true);
      } catch (err) {
        console.error('Unexpected search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Simple fuzzy search helper for meets
  const fuzzySearchTerms = (query: string) => {
    const terms = [query];
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

    // Debug logging for development
    if (query.toLowerCase().includes('masters')) {
      console.log('Fuzzy search debug for:', query);
      console.log('Generated terms:', terms);
    }
    
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

    // Debug logging for name changes
    if (cleaned.includes('kate') && cleaned.includes('nye')) {
      console.log('Kate Nye search debug:');
      console.log('Query:', query);
      console.log('Cleaned:', cleaned);
      console.log('All terms:', terms);
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
  const debouncedMeetSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setMeetSearchResults([]);
        setShowMeetResults(false);
        return;
      }

      setIsMeetSearching(true);
      try {
        const searchTerms = fuzzySearchTerms(query);
        const allResults: any[] = [];
        
        // For multi-word searches, we want to find meets that contain ALL words
        const queryWords = query.toLowerCase().trim().split(/\s+/);
        const isMultiWordSearch = queryWords.length > 1;
        
        if (isMultiWordSearch) {
          // Multi-word search: build a query that requires all words to be present
          let supabaseQuery = supabase
            .from('meets')
            .select('meet_id, Meet, Date, Level');
          
          // Add each word as a separate ilike condition (AND logic)
          queryWords.forEach(word => {
            supabaseQuery = supabaseQuery.ilike('Meet', `%${word}%`);
          });
          
          const { data: exactMatches, error: exactError } = await supabaseQuery
            .order('Date', { ascending: false })
            .limit(30);
            
          if (!exactError && exactMatches) {
            allResults.push(...exactMatches);
          }
          
          // Also try with fuzzy variations of the full query
          for (const term of searchTerms.slice(0, 2)) {
            const termWords = term.toLowerCase().trim().split(/\s+/);
            if (termWords.length > 1) {
              let fuzzyQuery = supabase
                .from('meets')
                .select('meet_id, Meet, Date, Level');
              
              termWords.forEach(word => {
                fuzzyQuery = fuzzyQuery.ilike('Meet', `%${word}%`);
              });
              
              const { data: fuzzyMatches, error: fuzzyError } = await fuzzyQuery
                .order('Date', { ascending: false })
                .limit(20);
                
              if (!fuzzyError && fuzzyMatches) {
                allResults.push(...fuzzyMatches);
              }
            }
          }
        } else {
          // Single word search: use the original fuzzy search approach
          for (const term of searchTerms.slice(0, 3)) {
            const { data: meets, error: meetsError } = await supabase
              .from('meets')
              .select('meet_id, Meet, Date, Level')
              .ilike('Meet', `%${term}%`)
              .order('Date', { ascending: false })
              .limit(20);

            if (!meetsError && meets) {
              allResults.push(...meets);
            }
          }
        }

        if (allResults.length === 0) {
          setMeetSearchResults([]);
          setShowMeetResults(true);
          return;
        }

        // Remove duplicates and sort by date
        const uniqueMeets = Array.from(
          new Map(allResults.map(meet => [meet.meet_id, meet])).values()
        ).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

        const meetResults = uniqueMeets.slice(0, 50).map(meet => ({
          meet_id: meet.meet_id,
          meet_name: meet.Meet,
          date: meet.Date,
          level: meet.Level,
          type: 'meet'
        }));

        setMeetSearchResults(meetResults);
        setShowMeetResults(true);
      } catch (err) {
        console.error('Unexpected meet search error:', err);
        setMeetSearchResults([]);
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

  useEffect(() => {
    const randomName = athleteNames[Math.floor(Math.random() * athleteNames.length)];
    setPlaceholderName(randomName);
    
    const randomMeet = meetNames[Math.floor(Math.random() * meetNames.length)];
    setPlaceholderMeet(randomMeet);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Don't close if clicking on a search result button or its children
      const isClickingOnResult = target.closest('button[data-search-result]');
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
    // Form submission handled by real-time search
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    setSearchQuery(result.athlete_name!);
    setShowResults(false);
    
    // Navigate to athlete page - prefer membership number, fallback to name slug
    let athleteId: string;
    
    if (result.membership_number) {
      athleteId = result.membership_number.toString();
    } else {
      // Convert name to URL slug (e.g., "John Doe" -> "john-doe")
      athleteId = result.athlete_name!
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .trim();
    }
    
    router.push(`/athlete/${athleteId}`);
  };

  // Handle meet result selection
  const handleMeetResultSelect = (result: SearchResult) => {
    setMeetSearchQuery(result.meet_name!);
    setShowMeetResults(false);
    router.push(`/meet/${result.meet_id}`);
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

  return (
    <div className="min-h-screen bg-app-gradient">
      {/* Header */}
      <header className="bg-header-blur border-b border-app-secondary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <div className="bg-app-tertiary rounded-full p-3">
                <Database className="h-8 w-8 text-app-secondary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-app-primary">WeightliftingDB</h1>
                <p className="text-sm text-app-tertiary">USA Weightlifting Results Database</p>
              </div>
            </Link>
            
            {/* Add Theme Switcher */}
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              <UserMenu onLoginClick={() => setShowLoginModal(true)} />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Search */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
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
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-app-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  id="athlete-search"
                  name="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    setShowMeetResults(false);
                  }}
                  placeholder={`Search athletes... (e.g., ${placeholderName})`}
                  className="input-primary"
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
                          {searchResults.map((result) => (
                        <button
                          key={result.lifter_id}
                          onClick={() => handleResultSelect(result)}
                          data-search-result="athlete"
                          className="w-full px-4 py-3 text-left bg-interactive transition-colors flex items-center space-x-3"
                        >
                          {React.createElement(getSearchIcon(result.type || 'athlete'), { 
                      className: "h-5 w-5 text-app-muted" 
                      })}
                          <div className="flex-1">
                            <div className="text-app-primary font-medium">{result.athlete_name}</div>
                            <div className="text-sm text-app-tertiary">
                              {[
                                result.gender,
                                result.club_name,
                                result.membership_number ? `#${result.membership_number}` : null
                              ].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <div className="p-4 text-center text-app-muted">
                      No results found for "{searchQuery}"
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Meet Search Bar */}
            <div className="relative">
              <form onSubmit={(e) => e.preventDefault()} className="relative">
                <CalendarDays className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-app-muted" />
                <input
                  ref={meetSearchInputRef}
                  type="text"
                  id="meet-search"
                  name="meetSearch"
                  value={meetSearchQuery}
                  onChange={(e) => setMeetSearchQuery(e.target.value)}
                  onFocus={() => {
                    setShowResults(false);
                  }}
                  placeholder={`Search meets... (e.g., ${placeholderMeet})`}
                  className="input-primary"
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
                      {meetSearchResults.map((result) => (
                        <button
                          key={result.meet_id}
                          onClick={() => handleMeetResultSelect(result)}
                          data-search-result="meet"
                          className="w-full px-4 py-3 text-left bg-interactive transition-colors flex items-center space-x-3"
                        >
                          <CalendarDays className="h-5 w-5 text-app-muted" />
                          <div className="flex-1">
                            <div className="text-app-primary font-medium">{result.meet_name}</div>
                            <div className="text-sm text-app-tertiary">
                              {[
                                result.date ? new Date(result.date).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                }) : null,
                                result.level
                              ].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : meetSearchQuery.length >= 2 ? (
                    <div className="p-4 text-center text-app-muted">
                      No results found for "{meetSearchQuery}"
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
        <div className="max-w-4xl mx-auto">
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
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-app-tertiary/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Stats content can be added here later */}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-app-secondary text-app-primary py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Database className="h-6 w-6" />
                <span className="font-bold">WeightliftingDB</span>
              </div>
              <p className="text-app-tertiary text-sm">
                Open source project, MIT License. Data sourced from official competition results.
              </p>
            </div>
            <div className="flex justify-end items-end">
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
          <div className="border-t border-app-secondary mt-8 pt-8 text-center text-sm text-app-tertiary">
            <span className="inline-flex items-center gap-1">
              2025 WeightliftingDB. Built with <Heart className="h-4 w-4 text-blue-400" fill="currentColor" /> for the weightlifting community.
            </span>
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