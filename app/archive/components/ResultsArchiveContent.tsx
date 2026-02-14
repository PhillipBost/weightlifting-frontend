'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { supabaseIWF } from '../../../lib/supabaseIWF';
import {
    Loader2,
    Search,
    Filter,
    RefreshCw,
    AlertTriangle,
    MapPin,
    Calendar,
    ExternalLink,
    Trophy,
    Users,
    Mountain,
    Archive,
    ChevronLeft,
    ChevronRight,
    Download,
    Printer,
    FileSpreadsheet,
    X,
    ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { SearchableDropdown } from '../../components/SearchableDropdown';
import { getCountryFlagComponent } from '../../utils/countryFlags';

// Types
interface Meet {
    id: string;
    datasetId: string | number; // original ID
    name: string;
    date: string;
    location: string;
    federation: 'USAW' | 'IWF';
    url?: string;
    meetType?: string;
    athleteCount?: number;
    elevation?: number; // For USAW meets
    wso?: string; // stored as wso_geography in DB
    state?: string;
    country?: string;
}

interface FilterState {
    searchTerm: string;
    selectedSources: string[]; // 'USAW', 'IWF'
    selectedYears: number[];
    selectedWSO: string[];
    selectedStates: string[];
    selectedCountries: string[];
}

export function ResultsArchiveContent() {
    const supabase = createClient();

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [meets, setMeets] = useState<Meet[]>([]);

    // Filter Options
    const [wsoOptions, setWsoOptions] = useState<string[]>([]);
    const [stateOptions, setStateOptions] = useState<string[]>([]);
    const [countryOptions, setCountryOptions] = useState<string[]>([]);

    // Filters
    const [filters, setFilters] = useState<FilterState>({
        searchTerm: '',
        selectedSources: [],
        selectedYears: [],
        selectedWSO: [],
        selectedStates: [],
        selectedCountries: []
    });

    const [showFilters, setShowFilters] = useState(true);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Meet; direction: 'asc' | 'desc' } | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch USAW Meets from 'usaw_meets' table
            const { data: usawData, error: usawError } = await supabase
                .from('usaw_meets')
                .select('meet_id, Meet, Date, location_text, city, state, URL, wso_geography, elevation_meters, Results')
                .order('Date', { ascending: false });

            if (usawError) throw usawError;
            console.log('Raw USAW Data Sample:', usawData?.slice(0, 2));

            // 2. Fetch IWF Meets from 'iwf_meets' table
            console.log('Fetching IWF Data...');
            const { data: iwfData, error: iwfError } = await supabaseIWF
                .from('iwf_meets')
                .select(`
                    iwf_meet_id,
                    db_meet_id,
                    meet,
                    date,
                    url,
                    results,
                    iwf_meet_locations (
                        location_text,
                        city,
                        country
                    )
                `)
                .order('date', { ascending: false });

            if (iwfError) throw iwfError;
            console.log('Raw IWF Data Sample:', iwfData?.slice(0, 2));

            // Map USAW to unified interface
            const usawMeets: Meet[] = (usawData || []).map((m: any) => {
                let loc = m.location_text;
                if (!loc && (m.city || m.state)) {
                    loc = [m.city, m.state].filter(Boolean).join(', ');
                }
                return {
                    id: `usaw_${m.meet_id}`,
                    datasetId: m.meet_id,
                    name: m.Meet,
                    date: m.Date,
                    location: loc || 'Unknown Location',
                    federation: 'USAW',
                    url: m.URL,
                    elevation: m.elevation_meters,
                    wso: m.wso_geography,
                    athleteCount: m.Results,
                    state: m.state,
                    country: 'USA'
                };
            });

            // Map IWF to unified interface
            const iwfMeets: Meet[] = (iwfData || []).map((m: any) => {
                // Handle 1:1 or 1:Many relationship gracefully
                const locDataRaw = m.iwf_meet_locations;
                const locData = Array.isArray(locDataRaw) ? locDataRaw[0] : locDataRaw;

                let loc = locData?.location_text;
                if (!loc && (locData?.city || locData?.country)) {
                    loc = [locData.city, locData.country].filter(Boolean).join(', ');
                }

                return {
                    id: `iwf_${m.iwf_meet_id}`,
                    datasetId: m.db_meet_id,
                    name: m.meet,
                    date: m.date,
                    location: loc || 'Unknown Location',
                    federation: 'IWF',
                    url: m.url,
                    athleteCount: m.results,
                    country: locData?.country
                };
            });

            const allMeets = [...usawMeets, ...iwfMeets].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            setMeets(allMeets);

            // Debug: Check specific meet WSO issue
            const problemMeet = allMeets.find(m => m.name.includes('Handle Barbell'));
            if (problemMeet) {
                console.warn('DEBUG: Problem Meet Data:', {
                    name: problemMeet.name,
                    wso: problemMeet.wso,
                    state: problemMeet.state,
                    location: problemMeet.location
                });
            }

            // Extract WSO Options
            const wsos = Array.from(new Set(usawMeets.map(m => m.wso).filter(Boolean) as string[])).sort();
            setWsoOptions(wsos);

            // Extract State Options
            const states = Array.from(new Set(usawMeets.map(m => m.state).filter(Boolean) as string[])).sort();
            console.log('Extracted States:', states.slice(0, 10)); // Debug states
            setStateOptions(states);

            // Extract Country Options
            const countries = Array.from(new Set([
                'USA',
                ...iwfMeets.map(m => m.country).filter(Boolean) as string[]
            ])).sort();
            setCountryOptions(countries);

        } catch (err: any) {
            console.error('Error fetching archive data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // Handlers
    const handleFilterChange = (key: keyof FilterState, value: any) => {
        setFilters(prev => {
            const newState = { ...prev, [key]: value };
            // Interaction logic
            if (key === 'selectedSources') {
                if (value.includes('IWF') && !value.includes('USAW')) {
                    newState.selectedWSO = [];
                }
            }
            return newState;
        });
        setCurrentPage(1); // Reset page on filter change
    };

    const clearFilters = () => {
        setFilters({
            searchTerm: '',
            selectedSources: [],
            selectedYears: [],
            selectedWSO: [],
            selectedStates: [],
            selectedCountries: []
        });
        setCurrentPage(1);
    };

    // Filter Logic
    const filteredMeets = useMemo(() => {
        return meets.filter(meet => {
            // 1. Search Term
            if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                if (!meet.name.toLowerCase().includes(term) &&
                    !meet.location.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // 2. Source (Federation)
            if (filters.selectedSources.length > 0) {
                if (!filters.selectedSources.includes(meet.federation)) return false;
            }

            // 3. Year
            if (filters.selectedYears.length > 0) {
                const meetYear = new Date(meet.date).getFullYear();
                if (!filters.selectedYears.includes(meetYear)) return false;
            }

            // 4. WSO (USAW Only)
            if (filters.selectedWSO.length > 0) {
                if (meet.federation !== 'USAW') return false;
                if (!meet.wso || !filters.selectedWSO.includes(meet.wso)) return false;
            }

            // 5. State (USAW Only)
            if (filters.selectedStates.length > 0) {
                if (!meet.state || !filters.selectedStates.includes(meet.state)) return false;
            }

            // 6. Country
            if (filters.selectedCountries.length > 0) {
                if (!meet.country || !filters.selectedCountries.includes(meet.country)) return false;
            }

            return true;
        });
    }, [meets, filters]);

    // Sort Handler
    const handleSort = (key: keyof Meet) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Sort Logic Application
    const sortedFilteredMeets = useMemo(() => {
        let sortableItems = [...filteredMeets];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === undefined && bValue === undefined) return 0;
                if (aValue === undefined) return 1;
                if (bValue === undefined) return -1;

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredMeets, sortConfig]);

    // Pagination
    const totalPages = Math.ceil(filteredMeets.length / itemsPerPage);
    const paginatedMeets = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedFilteredMeets.slice(start, start + itemsPerPage);
    }, [sortedFilteredMeets, currentPage, itemsPerPage]);

    // Derived Lists for Dropdowns
    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear; y >= 1998; y--) {
            years.push(y);
        }
        return years;
    }, []);

    // Helper for Sort Icon
    const getSortIcon = (columnName: keyof Meet) => {
        if (sortConfig?.key !== columnName) {
            return <span className="ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>;
        }
        return sortConfig.direction === 'asc' ? (
            <span className="ml-1 text-accent-primary">↑</span>
        ) : (
            <span className="ml-1 text-accent-primary">↓</span>
        );
    };

    return (
        <div className="space-y-6">
            <div className={`card-primary transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-60' : ''}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Archive className="h-5 w-5 text-accent-primary" />
                            <h2 className="text-xl font-bold text-heading">Detailed Results Archive</h2>
                        </div>
                        <p className="text-sm text-app-tertiary">
                            {filteredMeets.length.toLocaleString()} meets found
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="btn-secondary text-sm flex items-center gap-2"
                        >
                            <Filter className="w-4 h-4" />
                            {showFilters ? 'Hide Filters' : 'Show Filters'}
                        </button>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="btn-secondary p-2"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="flex flex-col gap-4 mt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-tertiary" />
                        <input
                            type="text"
                            placeholder="Search meets by name, location..."
                            value={filters.searchTerm}
                            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-app-tertiary border border-transparent rounded-lg text-base text-app-primary placeholder:text-app-tertiary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all outline-none"
                        />
                    </div>
                </div>

                {/* Filters Section */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-app-primary">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Source */}
                            <div>
                                <SearchableDropdown
                                    label="Source"
                                    options={['USAW', 'IWF']}
                                    selected={filters.selectedSources}
                                    onSelect={(s: string[]) => handleFilterChange('selectedSources', s)}
                                    placeholder="All Sources"
                                    getValue={(opt: string) => opt}
                                    getLabel={(opt: string) => opt}
                                />
                            </div>
                            {/* Year */}
                            <div>
                                <SearchableDropdown
                                    label="Year"
                                    options={yearOptions}
                                    selected={filters.selectedYears.map(String)}
                                    onSelect={(s: string[]) => handleFilterChange('selectedYears', s.map(Number))}
                                    placeholder="All Years"
                                    getValue={(opt: number) => opt.toString()}
                                    getLabel={(opt: number) => opt.toString()}
                                />
                            </div>
                            {/* Country */}
                            <div>
                                <SearchableDropdown
                                    label="Country"
                                    options={countryOptions}
                                    selected={filters.selectedCountries}
                                    onSelect={(s: string[]) => handleFilterChange('selectedCountries', s)}
                                    placeholder="All Countries"
                                    getValue={(opt: string) => opt}
                                    getLabel={(opt: string) => opt}
                                />
                            </div>
                            {/* State */}
                            <div>
                                <SearchableDropdown
                                    label="State (USA Only)"
                                    options={stateOptions}
                                    selected={filters.selectedStates}
                                    onSelect={(s: string[]) => handleFilterChange('selectedStates', s)}
                                    placeholder="All States"
                                    disabled={filters.selectedCountries.length > 0 && !filters.selectedCountries.includes('USA')}
                                    getValue={(opt: string) => opt}
                                    getLabel={(opt: string) => opt}
                                />
                            </div>
                            {/* WSO */}
                            <div>
                                <SearchableDropdown
                                    label="WSO (USAW)"
                                    options={wsoOptions}
                                    selected={filters.selectedWSO}
                                    onSelect={(s: string[]) => handleFilterChange('selectedWSO', s)}
                                    placeholder="All WSOs"
                                    disabled={filters.selectedSources.includes('IWF') && !filters.selectedSources.includes('USAW')}
                                    getValue={(opt: string) => opt}
                                    getLabel={(opt: string) => opt}
                                />
                            </div>
                        </div>
                        {/* Clear Filters */}
                        {(filters.searchTerm || filters.selectedSources.length > 0 || filters.selectedYears.length > 0 || filters.selectedWSO.length > 0 || filters.selectedStates.length > 0 || filters.selectedCountries.length > 0) && (
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-app-tertiary hover:text-accent-primary flex items-center gap-1 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Results Table - Strictly Aligned with Rankings */}
            <div className="card-results results-table mb-8">
                <div className="p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-accent-primary mb-4" />
                            <p className="text-sm text-app-tertiary">Loading archive data...</p>
                        </div>
                    ) : filteredMeets.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-fixed">
                                <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                                    <tr>
                                        <th className="px-2 py-1 w-[90px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group" onClick={() => handleSort('date')}>
                                            Date {getSortIcon('date')}
                                        </th>
                                        <th className="px-2 py-1 w-[35%] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group" onClick={() => handleSort('name')}>
                                            Meet Name {getSortIcon('name')}
                                        </th>
                                        <th className="px-2 py-1 w-[20%] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group" onClick={() => handleSort('location')}>
                                            Location {getSortIcon('location')}
                                        </th>
                                        <th className="px-2 py-1 w-[70px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group" onClick={() => handleSort('federation')}>
                                            Src {getSortIcon('federation')}
                                        </th>
                                        <th className="px-2 py-1 w-[150px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group" onClick={() => handleSort('wso')}>
                                            WSO {getSortIcon('wso')}
                                        </th>
                                        <th className="px-2 py-1 w-[70px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group" onClick={() => handleSort('elevation')}>
                                            Elev {getSortIcon('elevation')}
                                        </th>
                                        <th className="px-2 py-1 w-[70px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group" onClick={() => handleSort('athleteCount')}>
                                            Athl {getSortIcon('athleteCount')}
                                        </th>
                                        <th className="px-2 py-1 w-[50px] text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">
                                            Link
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {paginatedMeets.map((meet) => {
                                        const destinationUrl = meet.federation === 'USAW'
                                            ? `/meet/${meet.datasetId}`
                                            : `/meet/iwf/${meet.datasetId}`;

                                        return (
                                            <tr
                                                key={meet.id}
                                                className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors"
                                                style={{ borderTopColor: 'var(--border-secondary)' }}
                                            >
                                                <td className="px-2 py-1 whitespace-nowrap text-xs">
                                                    {new Date(meet.date).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'numeric',
                                                        day: 'numeric'
                                                    })}
                                                </td>
                                                <td className="px-2 py-1 font-medium truncate text-xs" title={meet.name}>
                                                    <Link
                                                        href={destinationUrl}
                                                        className="text-blue-400 hover:text-blue-300 hover:underline"
                                                    >
                                                        {meet.name}
                                                    </Link>
                                                </td>
                                                <td className="px-2 py-1 truncate text-xs" title={meet.location}>
                                                    {meet.location}
                                                </td>
                                                <td className="px-2 py-1 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${meet.federation === 'USAW'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                                        }`}>
                                                        {meet.federation}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1 text-xs truncate">
                                                    {meet.wso || '-'}
                                                </td>
                                                <td className="px-2 py-1 text-xs">
                                                    {meet.elevation ? `${Math.round(meet.elevation)}m` : '-'}
                                                </td>
                                                <td className="px-2 py-1 text-xs">
                                                    {meet.athleteCount ? meet.athleteCount.toLocaleString() : '-'}
                                                </td>
                                                <td className="px-2 py-1 text-right">
                                                    <Link
                                                        href={destinationUrl}
                                                        className="inline-flex items-center justify-center text-gray-400 hover:text-blue-400 transition-colors"
                                                        title="View Results"
                                                        aria-label={`View results for ${meet.name}`}
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-app-tertiary">
                            <Archive className="h-12 w-12 mb-4 opacity-20" />
                            <p className="font-medium">No results found</p>
                            <p className="text-sm">Try adjusting your filters</p>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t border-app-primary">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                aria-label="Previous Page"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-medium text-app-secondary">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded hover:bg-app-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                aria-label="Next Page"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
