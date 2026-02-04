"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin, User, CalendarDays, Dumbbell, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MiniSearch from 'minisearch';
import { DataSource, buildAthleteUrl, buildMeetUrl } from '@/lib/types/dataSource';
import { iwfAthleteSearch } from '@/lib/search/iwfAthleteSearch';
import { usawAthleteSearch } from '@/lib/search/usawAthleteSearch';
import { usawMeetSearch } from '@/lib/search/usawMeetSearch';
import { iwfMeetSearch } from '@/lib/search/iwfMeetSearch';
import { wsoClubSearch } from '@/lib/search/wsoClubSearch';
import { generateAthleteSearchTerms, stripPunctuation } from '@/lib/search/searchUtils';

// --- Types ---

interface UnifiedSearchProps {
    placeholder?: string;
}

type SearchCategory = 'Athletes' | 'Meets' | 'Clubs' | 'WSO' | 'Countries' | 'Filters';

interface SuggestionItem {
    id: string;
    label: string;
    subLabel?: string;
    category: SearchCategory;
    icon?: React.ReactNode;
    data?: any; // Original result object
    score?: number;
}

// --- Component ---

// --- Placeholder Cycling Configuration ---
// Each category has its own list of examples that will cycle within that category
const PLACEHOLDER_EXAMPLES = {
    athletes: [
        "Martha Rogers",
        "Lasha Talakhadze",
        "Christopher Yandle",
        // "Daniel Dodd",       
        "Karlos Nasar",
        "Li Fabin",
        "Olivia Reeves",
        "Caine Wilkes",
        "Hampton Morris",
        "Mary Theisen-Lappen",
        "Kolbi Ferguson",
        "Caden Cahoy",
        "Aaron Williams",
        "Ryan Grimsland",
        "Gabe Chhum",
        "Ella Nicholson",
        "Katie Estep",
        "Miranda Ulrey",
        "Sophia Shaft",
        "Anna McElderry"
    ],
    meets: [
        "IWF World Championships",
        "Pan American Championships",
        "American Open Series",
        "Junior Nationals",
        "Olympic Games",
        "Queen City Classic",
        "Charlotte Team Cup"
    ],
    wsos: [
        "Alabama",
        "California North Central",
        "California South",
        "Carolina",
        "DMV",
        "Florida",
        "Georgia",
        "Hawaii and International",
        "Illinois",
        "Indiana",
        "Iowa-Nebraska",
        "Michigan",
        "Minnesota-Dakotas",
        "Missouri Valley",
        "Mountain North",
        "Mountain South",
        "New England",
        "New Jersey",
        "New York",
        "Ohio",
        "Pacific Northwest",
        "Pennsylvania-West Virginia",
        "Southern",
        "Tennessee-Kentucky",
        "Texas-Oklahoma",
        "Wisconsin"
    ],
    clubs: [
        "Heavy Metal Barbell Club"  // Static - only one example
    ]
};

const PLACEHOLDER_CATEGORIES = ["athletes", "meets", "wsos", "clubs"] as const;

export function UnifiedSearch({ placeholder }: UnifiedSearchProps) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [categoryIndex, setCategoryIndex] = useState(0);
    // Initialize with 0 to avoid hydration mismatch (server vs client)
    const [exampleIndices, setExampleIndices] = useState({
        athletes: 0,
        meets: 0,
        wsos: 0,
        clubs: 0
    });

    // Active filters (chips)
    const [activeFilters, setActiveFilters] = useState<{ type: string; value: string }[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Randomize initial examples on mount (client-side only)
    useEffect(() => {
        setExampleIndices({
            athletes: Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.athletes.length),
            meets: Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.meets.length),
            wsos: Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.wsos.length),
            clubs: Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.clubs.length)
        });
    }, []);

    // Cycle through placeholder categories and examples
    useEffect(() => {
        const interval = setInterval(() => {
            setCategoryIndex((prevCategoryIndex) => {
                const nextCategoryIndex = (prevCategoryIndex + 1) % PLACEHOLDER_CATEGORIES.length;
                const nextCategory = PLACEHOLDER_CATEGORIES[nextCategoryIndex];

                // Pick a random example for the NEXT category so it's fresh when displayed
                setExampleIndices((prev) => ({
                    ...prev,
                    [nextCategory]: Math.floor(Math.random() * PLACEHOLDER_EXAMPLES[nextCategory].length)
                }));

                return nextCategoryIndex;
            });
        }, 3000); // Change every 3 seconds

        return () => clearInterval(interval);
    }, []);

    // Generate current placeholder text
    const currentCategory = PLACEHOLDER_CATEGORIES[categoryIndex];
    const currentExample = PLACEHOLDER_EXAMPLES[currentCategory][exampleIndices[currentCategory as keyof typeof exampleIndices]];
    const currentPlaceholder = `Search for ${currentCategory === 'athletes' ? 'athlete names' : currentCategory === 'meets' ? 'meets' : currentCategory === 'wsos' ? 'WSOs' : 'barbell clubs'} (e.g. ${currentExample})`;

    // --- Search Logic ---

    const performSearch = useCallback(async (currentQuery: string) => {
        if (!currentQuery.trim() || currentQuery.length < 2) {
            setSuggestions([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const allSuggestions: SuggestionItem[] = [];
        const cleanedQuery = stripPunctuation(currentQuery);

        try {
            // 1. Add Default Filters (Always visible unless active)
            const defaultFilters = [
                { id: 'filter-gender-male', label: 'Gender: Male', type: 'gender', value: 'male', category: 'Filters' },
                { id: 'filter-gender-female', label: 'Gender: Female', type: 'gender', value: 'female', category: 'Filters' },
                { id: 'filter-fed-usaw', label: 'Federation: USAW', type: 'federation', value: 'USAW', category: 'Filters' },
                { id: 'filter-fed-iwf', label: 'Federation: IWF', type: 'federation', value: 'IWF', category: 'Filters' },
                { id: 'filter-country-usa', label: 'Country: United States', type: 'country', value: 'United States', category: 'Countries' } // Keep explicitly as Countries or group under Filters? Logic below uses 'Countries' category.
            ] as const;

            defaultFilters.forEach(f => {
                const isActive = activeFilters.some(af => af.type === f.type && af.value === f.value);
                if (!isActive) {
                    allSuggestions.push({
                        id: f.id,
                        label: f.label,
                        category: f.category,
                        icon: <Filter className="h-4 w-4" />,
                        data: { type: f.type, value: f.value }
                    });
                }
            });


            // Determine active federation filter
            const fedFilter = activeFilters.find(f => f.type === 'federation');
            const isIwfOnly = fedFilter?.value?.toLowerCase() === 'iwf';
            const isUsawOnly = fedFilter?.value?.toLowerCase() === 'usaw';

            // Determine active gender filter
            const genderFilter = activeFilters.find(f => f.type === 'gender');
            const targetGender = genderFilter?.value; // 'male' or 'female'

            // Determine active country filters (Multi-select OR logic)
            const targetCountries = activeFilters
                .filter(f => f.type === 'country')
                .map(f => f.value.toLowerCase());
            // const targetCountry = countryFilter?.value; // Old logic

            // 2. Search Athletes (Combined)
            // TODO: Ensure search indices are initialized. They are likely init'd in page.tsx or global context.
            // For safety, we can try initing here or rely on them being ready.
            await Promise.all([
                iwfAthleteSearch.init(),
                usawAthleteSearch.init(),
                usawMeetSearch.init(),
                iwfMeetSearch.init(),
                wsoClubSearch.init()
            ]);

            // Search Options
            const searchOptions = {
                prefix: true,
                fuzzy: 0.2, // Slightly stricter for omni search
                limit: 20 // Limit per category to avoid clutter but allow expansion
            };

            // USAW Athletes (Skip if IWF only or Country filter is set (unless USA))
            // USAW is effectively USA only, so if targetCountries is set and 'USA'/'United States' is NOT in it, skip USAW.
            const isUsaFilter = targetCountries.length > 0 && targetCountries.some(c => ['usa', 'united states', 'us'].includes(c));
            // If countries ARE selected, but none of them are USA, then we skip USAW.
            // If NO countries are selected, we show USAW (unless IWF only).
            const skipUsaw = isIwfOnly || (targetCountries.length > 0 && !isUsaFilter);

            // 2b. Search Athletes (Combined & Ranked)
            // We search both indices (if allowed), combine results, sort by relevance, and then limit.
            // This ensures the best matches appear first regardless of federation source.

            const combinedAthletes: SuggestionItem[] = [];

            if (!skipUsaw) {
                const usawResults = usawAthleteSearch.search(cleanedQuery, searchOptions);
                usawResults.forEach(r => {
                    // Filter Logic: Gender
                    if (targetGender) {
                        const recGender = r.gender.toLowerCase();
                        const isRecFemale = recGender.startsWith('f') || recGender === 'women';
                        const targetIsFemale = targetGender === 'female';
                        if (isRecFemale !== targetIsFemale) return;
                    }

                    combinedAthletes.push({
                        id: `usaw-${r.id}`,
                        label: r.name,
                        subLabel: `${r.gender} • ${r.club || r.state || 'N/A'} • #${r.membership_number || ''}`,
                        category: 'Athletes',
                        icon: <User className="h-4 w-4" />,
                        data: { ...r, source: 'USAW', type: 'athlete' },
                        score: r.score
                    });
                });
            }

            if (!isUsawOnly) {
                const iwfResults = iwfAthleteSearch.search(cleanedQuery, searchOptions);
                iwfResults.forEach(r => {
                    // Filter Logic: Gender & Country
                    if (targetGender) {
                        const recGender = r.gender.toLowerCase();
                        const isRecFemale = recGender.startsWith('f') || recGender === 'women';
                        const targetIsFemale = targetGender === 'female';
                        if (isRecFemale !== targetIsFemale) return;
                    }
                    if (targetCountries.length > 0) {
                        const rCountry = (r.country_name || r.country || '').toLowerCase();
                        if (!targetCountries.includes(rCountry)) return;
                    }

                    combinedAthletes.push({
                        id: `iwf-${r.id}`,
                        label: r.name,
                        subLabel: `${r.gender} • ${r.country} • #${r.id}`,
                        category: 'Athletes',
                        icon: <User className="h-4 w-4" />,
                        data: { ...r, source: 'IWF', type: 'athlete' },
                        score: r.score
                    });
                });
            }

            // Sort by Score Descending -> Push Top 10 to allSuggestions
            combinedAthletes
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .slice(0, 10)
                .forEach(item => allSuggestions.push(item));

            // 3. Search Meets
            if (!skipUsaw) {
                const usawMeets = usawMeetSearch.search(cleanedQuery, searchOptions);
                usawMeets.slice(0, 3).forEach(r => {
                    allSuggestions.push({
                        id: `usaw-meet-${r.id}`,
                        label: r.name,
                        subLabel: `${new Date(r.date).getFullYear()} • ${r.city}, ${r.state}`,
                        category: 'Meets',
                        icon: <CalendarDays className="h-4 w-4" />,
                        data: { ...r, source: 'USAW', type: 'meet' },
                        score: r.score
                    });
                });
            }

            if (!isUsawOnly) {
                const iwfMeets = iwfMeetSearch.search(cleanedQuery, searchOptions);
                // Filter IWF meets by country if needed? Usually meets are in a country.
                const filteredIwfMeets = iwfMeets.filter(r => {
                    // Check if targetCountry matches the meet's country
                    if (targetCountries.length > 0) {
                        const rCountry = (r.country || '').toLowerCase();
                        // Logic: if meet doesn't have country, maybe we skip or allow?
                        // Let's strict filter if country is known.
                        if (rCountry && targetCountries.includes(rCountry)) return true;
                        return false;
                    }
                    return true;
                });

                filteredIwfMeets.slice(0, 8).forEach(r => {
                    const locationParts = [r.city, r.country].filter(Boolean);
                    const location = locationParts.length > 0 ? locationParts.join(', ') : 'Location Unknown';

                    allSuggestions.push({
                        id: `iwf-meet-${r.id}`,
                        label: r.name,
                        subLabel: `${new Date(r.date).getFullYear()} • ${location}`,
                        category: 'Meets',
                        icon: <CalendarDays className="h-4 w-4" />,
                        data: { ...r, source: 'IWF', type: 'meet' },
                        score: r.score
                    });
                });
            }

            // 4. Search Clubs/WSOs/Countries
            // We search this index for Countries too.
            const wsoClubResults = wsoClubSearch.search(cleanedQuery, searchOptions);


            wsoClubResults.forEach(r => {
                // Determine Category & Type
                let category: SearchCategory = 'Clubs'; // default
                let type = 'club';
                let icon = <Dumbbell className="h-4 w-4" />;

                if (r.type === 'WSO') {
                    category = 'WSO';
                    type = 'wso';
                    icon = <MapPin className="h-4 w-4" />;
                } else if (r.type === 'Country' || r.type === 'Nation') { // Adjust based on actual data
                    category = 'Filters';
                    type = 'country';
                    icon = <Filter className="h-4 w-4" />;
                }


                // Filtering Logic
                // If it's a Club/WSO, only show if NOT IWF-only AND NOT a non-USA country filter
                // (User Rule: "IF any country other than the United states is selected... clubs and WSOs should be excluded")
                const hasNonUsaCountry = targetCountries.length > 0 && targetCountries.some(c => !['usa', 'united states', 'us'].includes(c));

                if ((type === 'club' || type === 'wso') && (isIwfOnly || hasNonUsaCountry)) {
                    return;
                }

                // If it's a Country, show it (as a filter suggestion)
                // Limit counts manually
                if (type === 'country') {
                    const currentCount = allSuggestions.filter(s => s.data.type === 'country').length;
                    if (currentCount >= 4) return;
                }

                allSuggestions.push({
                    id: `${type}-${r.id}`,
                    label: type === 'country' ? `Country: ${r.name}` : r.name,
                    subLabel: type === 'country' ? undefined : r.location,
                    category: category,
                    icon: icon,
                    data: { ...r, type: type, value: r.name }, // Value for filter
                    score: r.score
                });
            });


        } catch (e) {
            console.error("Unified Search Error:", e);
        }

        // Sort combined suggestions by score? Or keep categorized?
        // Let's keep categorized blocks for better UX (FullStory style).
        // Categories order: Filters, WSO, Clubs, Meets, Athletes

        setSuggestions(allSuggestions);
        setIsSearching(false);
    }, [activeFilters, router]);

    // Reset expansion when query changes
    useEffect(() => {
        setExpandedCategories({});
    }, [query]);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                performSearch(query);
            } else {
                setSuggestions([]); // Clear suggestions if query is empty or too short
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [query, performSearch]);


    // --- Navigation / Selection Logic ---

    const handleSelect = (item: SuggestionItem) => {
        if (item.category === 'Filters' || item.category === 'Countries') {
            // Add filter chip
            setActiveFilters(prev => {
                let newFilters = [...prev];

                // Enforce mutual exclusivity for Federation filters
                if (item.data.type === 'federation') {
                    newFilters = newFilters.filter(f => f.type !== 'federation');
                }
                // Enforce mutual exclusivity for Gender filters
                if (item.data.type === 'gender') {
                    newFilters = newFilters.filter(f => f.type !== 'gender');
                }

                // Check if already exists
                if (!newFilters.some(f => f.type === item.data.type && f.value === item.data.value)) {
                    newFilters.push(item.data);
                }

                return newFilters;
            });

            // Smart Clear: ONLY clear query if it matches the filter label exactly (Intent: "I searched for this filter").
            // If the user typed a query and added a filter via sidebar, we should preserve the query.
            const isExactMatch = item.label.toLowerCase() === query.trim().toLowerCase();

            if (isExactMatch) {
                setQuery('');
            }
            // Else keep the query (e.g. "Genadi blr" -> keeps "Genadi blr" after adding filter)
        } else {
            // Navigate based on type
            const { data } = item;

            if (data.type === 'athlete') {
                const source = data.source || 'USAW';
                // Logic borrowed from page.tsx handleResultSelect
                let athleteId: string;
                if (source === 'USAW') {
                    if (data.membership_number && data.membership_number !== 'null') {
                        athleteId = data.membership_number.toString();
                    } else if (data.id) { // MiniSearch returns 'id' which is lifter_id equivalent
                        athleteId = `u-${data.id}`;
                    } else {
                        // Fallback slug logic if needed
                        athleteId = data.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
                    }
                } else {
                    athleteId = (data.iwfId || data.id).toString();
                }
                router.push(buildAthleteUrl(athleteId, source));

            } else if (data.type === 'meet') {
                const source = data.source || 'USAW';
                router.push(buildMeetUrl(data.id.toString(), source));

            } else if (data.type === 'club') {
                router.push(`/club/${data.slug}`);
            } else if (data.type === 'wso') {
                router.push(`/WSO/${data.slug}`);
            }

            setIsOpen(false);
        }
    };


    // --- Render Helpers ---

    const groupedSuggestions = suggestions.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, SuggestionItem[]>);

    const categoryOrder: SearchCategory[] = ['Filters', 'Countries', 'WSO', 'Clubs', 'Meets', 'Athletes'];


    return (
        <div className="relative w-full max-w-4xl mx-auto z-50 pointer-events-auto" ref={containerRef}>
            {/* Search Bar Container */}
            <div className={`
                flex flex-wrap items-center gap-2 p-2 
                bg-app-surface/95 backdrop-blur-sm border border-app-primary 
                rounded-2xl shadow-2xl transition-all duration-300
                focus-within:ring-2 focus-within:ring-blue-500/50
            `}>
                <Search className="h-5 w-5 text-app-tertiary ml-2" />

                {/* Active Filters Chips */}
                {activeFilters.map((filter, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-transparent border border-app-tertiary px-2 py-1 rounded-full text-xs font-medium text-app-primary animate-in fade-in zoom-in duration-200">
                        <span className="capitalize">{filter.type}: {filter.value}</span>
                        <button
                            onClick={() => setActiveFilters(activeFilters.filter((_, i) => i !== idx))}
                            className="hover:text-red-400 transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}

                {/* Input Input */}
                <input
                    ref={inputRef}
                    className="flex-1 bg-transparent border-none outline-none text-app-primary placeholder:text-app-tertiary/50 min-w-[120px] p-2"
                    placeholder={activeFilters.length > 0 ? "Add more filters or search..." : currentPlaceholder}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === 'Backspace' && query === '' && activeFilters.length > 0) {
                            // Remove last filter on backspace if empty
                            setActiveFilters(prev => prev.slice(0, -1));
                        }
                    }}
                />

                {query && (
                    <button onClick={() => setQuery('')} className="p-1 hover:text-app-primary text-app-tertiary transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && (query.length >= 2 || suggestions.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-app-surface/95 backdrop-blur-md border border-app-primary rounded-xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
                    {isSearching ? (
                        <div className="p-4 text-center text-app-tertiary text-sm">Searching...</div>
                    ) : suggestions.length === 0 ? (
                        <div className="p-4 text-center text-app-tertiary text-sm">No results found.</div>
                    ) : (
                        <div className="flex flex-col sm:flex-row relative">
                            {/* Left Column: Search Results */}
                            <div className="flex-1 min-w-0 py-2">
                                {['Athletes', 'Meets', 'Clubs', 'WSO'].map(cat => {
                                    const items = groupedSuggestions[cat];
                                    if (!items || items.length === 0) return null;

                                    const isExpanded = expandedCategories[cat];
                                    const visibleItems = isExpanded ? items : items.slice(0, 4);
                                    const hasMore = items.length > 4;

                                    return (
                                        <div key={cat} className="mb-4 last:mb-0">
                                            <div className="px-4 py-1.5 text-xs font-bold text-app-tertiary uppercase tracking-wider bg-app-tertiary/5 rounded mb-1">
                                                {cat}
                                            </div>
                                            {visibleItems.map(item => {
                                                // Helper to build URL (duplicated logic, but necessary in render)
                                                let href = '#';
                                                const { data } = item;
                                                if (data.type === 'athlete') {
                                                    const source = data.source || 'USAW';
                                                    let athleteId = '';
                                                    if (source === 'USAW') {
                                                        if (data.membership_number && data.membership_number !== 'null') athleteId = data.membership_number.toString();
                                                        else if (data.id) athleteId = `u-${data.id}`;
                                                        else athleteId = data.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').trim();
                                                    } else {
                                                        athleteId = (data.iwfId || data.id).toString();
                                                    }
                                                    href = buildAthleteUrl(athleteId, source);
                                                } else if (data.type === 'meet') {
                                                    href = buildMeetUrl(data.id.toString(), data.source || 'USAW');
                                                } else if (data.type === 'club') {
                                                    href = `/club/${data.slug}`;
                                                } else if (data.type === 'wso') {
                                                    href = `/WSO/${data.slug}`;
                                                }

                                                return (
                                                    <Link
                                                        key={item.id}
                                                        href={href}
                                                        onClick={() => setIsOpen(false)}
                                                        className="block w-full text-left px-4 py-2 hover:bg-app-hover flex items-center gap-3 transition-colors group"
                                                    >
                                                        <div className="p-2 rounded-lg bg-app-tertiary/10 group-hover:bg-blue-500/10 group-hover:text-blue-500 text-app-secondary transition-colors">
                                                            {item.icon}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-app-primary flex items-center gap-2 group-hover:text-blue-500 transition-colors">
                                                                <span className="truncate">{item.label}</span>
                                                                {item.data?.source && (
                                                                    <span className={item.data.source === 'USAW'
                                                                        ? "text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
                                                                        : "text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800"
                                                                    }>
                                                                        {item.data.source}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {item.subLabel && (
                                                                <div className="text-xs text-app-tertiary truncate">
                                                                    {item.subLabel}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Link>
                                                );
                                            })}

                                            {/* Show More Button */}
                                            {hasMore && (
                                                <button
                                                    onClick={() => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                                                    className="w-full text-left px-4 py-2 text-xs font-medium text-blue-500 hover:bg-blue-500/5 transition-colors flex items-center gap-1 pl-12"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronUp className="h-3 w-3" />
                                                            Show fewer
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="h-3 w-3" />
                                                            Show {items.length - 4} more result{items.length - 4 === 1 ? '' : 's'}
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Partial state where only filters match */}
                                {suggestions.every(s => ['Filters', 'Countries'].includes(s.category)) && (
                                    <div className="p-12 text-center text-app-tertiary text-sm italic">
                                        Use filters on the right to narrow your search
                                    </div>
                                )}
                            </div>

                            {/* Right Column: Filters (Sticky Sidebar) */}
                            <div className="block w-full sm:w-[260px] border-t sm:border-t-0 sm:border-l border-[#374151]/30 bg-app-tertiary/5 py-2 sticky top-0 h-fit">
                                <div className="px-4 py-2 text-xs font-bold text-app-tertiary uppercase tracking-wider mb-2">
                                    Filter Options
                                </div>
                                {['Filters', 'Countries'].map(cat => {
                                    const items = groupedSuggestions[cat];
                                    if (!items || items.length === 0) return null;
                                    return (
                                        <div key={cat}>
                                            <div className="flex flex-wrap gap-2 px-3 mb-2">
                                                {items.map(item => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleSelect(item)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-app-primary/10 bg-app-surface/50 hover:bg-app-primary/5 hover:border-app-primary/30 transition-all group"
                                                    >
                                                        <div className="text-app-tertiary group-hover:text-app-primary transition-colors">
                                                            {item.icon}
                                                        </div>
                                                        <span className="text-app-secondary group-hover:text-app-primary truncate max-w-[150px]">
                                                            {item.label}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="my-2 h-px bg-app-primary/5 mx-4 last:hidden" />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Mobile Filters Fallback (if needed, simplified for now to strict column behavior requested) */}
                        </div>
                    )}
                </div>
            )}

            {/* Simple Backdrop to close */}
            {isOpen && (
                <div className="fixed inset-0 z-[-1]" onClick={() => setIsOpen(false)} />
            )}
        </div>
    );
}
