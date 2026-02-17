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
export interface Meet {
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
    level?: string;
}

interface FilterState {
    searchTerm: string;
    selectedSources: string[]; // 'USAW', 'IWF'
    selectedYears: number[];
    selectedWSO: string[];
    selectedStates: string[];
    selectedCountries: string[];
    selectedLevels: string[];
    startDate?: string;
    endDate?: string;
}

export function ResultsArchiveContent({ initialMeets = [] }: { initialMeets?: Meet[] }) {
    const supabase = createClient();

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [meets, setMeets] = useState<Meet[]>(initialMeets);

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
        selectedCountries: [],
        selectedLevels: [],
        startDate: '',
        endDate: ''
    });

    const [showFilters, setShowFilters] = useState(false);
    const [showYearDropdown, setShowYearDropdown] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Meet; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // Column Visibility State
    const [showColumnVisibility, setShowColumnVisibility] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        date: true,
        name: true,
        location: true,
        federation: true,
        state: true,
        wso: true,
        level: true,
        athleteCount: true,
        link: false
    });

    // Extract filter options when meets data changes
    useEffect(() => {
        if (!meets.length) return;

        // Extract WSO Options (USAW only)
        const wsos = Array.from(new Set(
            meets
                .filter(m => m.federation === 'USAW')
                .map(m => m.wso)
                .filter(Boolean) as string[]
        )).sort();
        setWsoOptions(wsos);

        // Extract State Options (USAW only)
        const states = Array.from(new Set(
            meets
                .filter(m => m.federation === 'USAW')
                .map(m => m.state)
                .filter(Boolean) as string[]
        )).sort();
        setStateOptions(states);

        // Extract Country Options
        const countries = Array.from(new Set([
            'USA',
            ...meets
                .filter(m => m.federation === 'IWF')
                .map(m => m.country)
                .filter(Boolean) as string[]
        ])).sort();
        setCountryOptions(countries);
    }, [meets]);

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
            selectedCountries: [],
            selectedLevels: []
        });
        setCurrentPage(1);
    };

    // Filter Logic
    const filteredMeets = useMemo(() => {
        return meets.filter(meet => {
            // 1. Search Term
            if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                if (!meet.name.toLowerCase().includes(term) && !meet.location.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // 2. Date Range
            if (filters.startDate) {
                const meetDate = new Date(meet.date).getTime();
                const startDate = new Date(filters.startDate).getTime();
                if (meetDate < startDate) return false;
            }
            if (filters.endDate) {
                const meetDate = new Date(meet.date).getTime();
                const endDate = new Date(filters.endDate).getTime();
                if (meetDate > endDate) return false;
            }

            // 3. Source (Federation)
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

            // 7. Level
            if (filters.selectedLevels.length > 0) {
                if (!meet.level || !filters.selectedLevels.includes(meet.level)) return false;
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
        sortableItems.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            // Special handling for date sorting
            if (sortConfig.key === 'date') {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
            }

            if (aValue === undefined && bValue === undefined) return 0;
            if (aValue === undefined) return 1;
            if (bValue === undefined) return -1;

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
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
        if (sortConfig.key !== columnName) {
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
                    <div className="flex items-start space-x-4">
                        <div className="bg-gray-700 rounded-2xl p-3 flex items-center justify-center">
                            <Archive className="h-7 w-7 text-accent-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-app-primary">Results Archive</h1>
                            <p className="text-sm text-app-secondary mt-1">
                                Explore national and international meets filtered by federation, year, location, and more.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                                    {filteredMeets.length.toLocaleString()} meets
                                </span>

                                {filters.searchTerm && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                                        Search: "{filters.searchTerm}"
                                    </span>
                                )}

                                {filters.selectedSources.length > 0 && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                                        Source: {filters.selectedSources.join(", ")}
                                    </span>
                                )}

                                {filters.selectedLevels.length > 0 && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                                        Level: {filters.selectedLevels.join(", ")}
                                    </span>
                                )}

                                {filters.selectedYears.length > 0 && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                                        Years: {filters.selectedYears.sort((a, b) => b - a).join(", ")}
                                    </span>
                                )}

                                {(filters.selectedCountries.length > 0 || filters.selectedStates.length > 0 || filters.selectedWSO.length > 0) && (
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                                        Location: {[
                                            ...filters.selectedCountries,
                                            ...filters.selectedStates,
                                            ...filters.selectedWSO
                                        ].join(", ")}
                                    </span>
                                )}

                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                                    Sorted by: {sortConfig.key === 'date' ? 'Date' :
                                        sortConfig.key === 'name' ? 'Name' :
                                            sortConfig.key === 'location' ? 'Location' :
                                                sortConfig.key === 'federation' ? 'Source' :
                                                    sortConfig.key === 'athleteCount' ? 'Athlete Count' :
                                                        sortConfig.key} ({sortConfig.direction === 'asc' ? 'Asc' : 'Desc'})
                                </span>

                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-muted">
                                    Last updated: {new Date().toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Filter className="h-4 w-4" />
                            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setShowColumnVisibility(!showColumnVisibility)}
                                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                <ChevronDown className="h-4 w-4" />
                                <span>Columns</span>
                            </button>

                            {showColumnVisibility && (
                                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                                    <div className="p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-gray-300">Column Visibility</span>
                                            <button
                                                onClick={() => setVisibleColumns({
                                                    date: true,
                                                    name: true,
                                                    location: true,
                                                    federation: true,
                                                    state: true,
                                                    wso: true,
                                                    level: true,
                                                    athleteCount: true,
                                                    link: true
                                                })}
                                                className="text-xs text-blue-400 hover:text-blue-300"
                                            >
                                                Show All
                                            </button>
                                        </div>
                                        {[
                                            { key: 'date', label: 'Date' },
                                            { key: 'name', label: 'Meet Name' },
                                            { key: 'location', label: 'Location' },
                                            { key: 'federation', label: 'Source' },
                                            { key: 'state', label: 'State' },
                                            { key: 'wso', label: 'WSO' },
                                            { key: 'level', label: 'Level' },
                                            { key: 'athleteCount', label: 'Participants' },
                                            { key: 'link', label: 'Ext. Link' },
                                        ].map(({ key, label }) => (
                                            <label key={key} className="flex items-center space-x-2 py-1.5 hover:bg-gray-700/50 px-2 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleColumns[key as keyof typeof visibleColumns]}
                                                    onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                                                    className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                                                />
                                                <span className="text-xs text-gray-300">{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {showColumnVisibility && (
                                <div className="fixed inset-0 z-10" onClick={() => setShowColumnVisibility(false)} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters Section (Search bar moved inside) */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-app-primary">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Search */}
                            <div>
                                <label className="block text-sm font-medium text-app-tertiary mb-1">
                                    Search
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-tertiary" />
                                    <input
                                        type="text"
                                        placeholder="Search meets..."
                                        value={filters.searchTerm}
                                        onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                        className="w-full h-10 pl-10 pr-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary placeholder:text-app-tertiary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all outline-none text-sm"
                                    />
                                </div>
                            </div>
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
                                    disableSearch={true}
                                />
                            </div>
                            {/* Level */}
                            <div>
                                <SearchableDropdown
                                    label="Level"
                                    options={['Local', 'National', 'International']}
                                    selected={filters.selectedLevels}
                                    onSelect={(s: string[]) => handleFilterChange('selectedLevels', s)}
                                    placeholder="All Levels"
                                    getValue={(opt: string) => opt}
                                    getLabel={(opt: string) => opt}
                                    disableSearch={true}
                                />
                            </div>
                            {/* Year - Custom Grid Dropdown matching Rankings Page */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-app-tertiary mb-1">
                                    Years
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowYearDropdown((prev) => !prev)}
                                    className="w-full flex items-center justify-between h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <span className="truncate">
                                        {filters.selectedYears.length > 0
                                            ? `${filters.selectedYears.length} selected`
                                            : "All Years"}
                                    </span>
                                    <span className="ml-2 text-xs text-app-tertiary flex-shrink-0">
                                        {showYearDropdown ? <ChevronDown className="h-4 w-4 rotate-180 transition-transform" /> : <ChevronDown className="h-4 w-4 transition-transform" />}
                                    </span>
                                </button>

                                {showYearDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowYearDropdown(false)} />
                                        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-app-surface border border-app-primary rounded-xl shadow-lg p-2">
                                            <div className="flex justify-between items-center mb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const allYears = yearOptions;
                                                        handleFilterChange('selectedYears', allYears);
                                                    }}
                                                    className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleFilterChange('selectedYears', [])}
                                                    className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1">
                                                {yearOptions.map((year) => {
                                                    const checked = filters.selectedYears.includes(year);
                                                    return (
                                                        <label
                                                            key={year}
                                                            className="flex items-center space-x-2 text-sm p-1 rounded transition-colors text-app-secondary cursor-pointer hover:bg-app-hover"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(e) => {
                                                                    const newSelected = e.target.checked
                                                                        ? [...filters.selectedYears, year]
                                                                        : filters.selectedYears.filter(y => y !== year);
                                                                    handleFilterChange('selectedYears', newSelected);
                                                                }}
                                                                className="accent-blue-500"
                                                            />
                                                            <span>{year}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Date Range */}
                            {/* Date Range - Spans 2 cols to fit inputs */}
                            {/* Date Range */}
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-gray-300 mb-1">Date Range</label>
                                <div className="flex items-center space-x-1">
                                    <input
                                        type="date"
                                        value={filters.startDate || ''}
                                        onChange={(e) => handleFilterChange("startDate", e.target.value)}
                                        className="w-32 h-10 px-1.5 text-xs bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-gray-400 text-xs">–</span>
                                    <input
                                        type="date"
                                        value={filters.endDate || ''}
                                        onChange={(e) => handleFilterChange("endDate", e.target.value)}
                                        className="w-32 h-10 px-1.5 text-xs bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
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
                                    disabled={filters.selectedSources.includes('IWF') && !filters.selectedSources.includes('USAW') || (filters.selectedCountries.length > 0 && !filters.selectedCountries.includes('USA'))}
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
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={clearFilters}
                                className="text-xs text-app-tertiary hover:text-accent-primary flex items-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Clear Filters
                            </button>
                        </div>
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
                                        {visibleColumns.date && (
                                            <th className="px-2 py-1 w-[90px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('date')}>
                                                Date {getSortIcon('date')}
                                            </th>
                                        )}
                                        {visibleColumns.name && (
                                            <th className="px-2 py-1 w-[25%] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('name')}>
                                                Meet Name {getSortIcon('name')}
                                            </th>
                                        )}
                                        {visibleColumns.location && (
                                            <th className="px-2 py-1 w-[20%] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('location')}>
                                                Location {getSortIcon('location')}
                                            </th>
                                        )}
                                        {visibleColumns.federation && (
                                            <th className="px-2 py-1 w-[70px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('federation')}>
                                                SOURCE {getSortIcon('federation')}
                                            </th>
                                        )}
                                        {/* State - Hidden if IWF selected AND no USAW */}
                                        {visibleColumns.state && (!(filters.selectedSources.includes('IWF') && !filters.selectedSources.includes('USAW'))) && (
                                            <th className="px-2 py-1 w-[60px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('state')}>
                                                State {getSortIcon('state')}
                                            </th>
                                        )}
                                        {/* WSO - Hidden if IWF selected AND no USAW */}
                                        {visibleColumns.wso && (!(filters.selectedSources.includes('IWF') && !filters.selectedSources.includes('USAW'))) && (
                                            <th className="px-2 py-1 w-[150px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('wso')}>
                                                WSO {getSortIcon('wso')}
                                            </th>
                                        )}
                                        {visibleColumns.level && (
                                            <th className="px-2 py-1 w-[100px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('level')}>
                                                Level {getSortIcon('level')}
                                            </th>
                                        )}
                                        {visibleColumns.athleteCount && (
                                            <th className="px-2 py-1 w-[100px] text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none group whitespace-nowrap" onClick={() => handleSort('athleteCount')}>
                                                Participants {getSortIcon('athleteCount')}
                                            </th>
                                        )}
                                        {visibleColumns.link && (
                                            <th className="px-2 py-1 w-[80px] text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider whitespace-nowrap">
                                                Ext. Link
                                            </th>
                                        )}
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
                                                {visibleColumns.date && (
                                                    <td className="px-2 py-1 whitespace-nowrap text-xs">
                                                        {new Date(meet.date).toLocaleDateString(undefined, {
                                                            year: 'numeric',
                                                            month: 'numeric',
                                                            day: 'numeric'
                                                        })}
                                                    </td>
                                                )}
                                                {visibleColumns.name && (
                                                    <td className="px-2 py-1 font-medium truncate text-xs" title={meet.name}>
                                                        <Link
                                                            href={destinationUrl}
                                                            className="text-blue-400 hover:text-blue-300 hover:underline"
                                                        >
                                                            {meet.name}
                                                        </Link>
                                                    </td>
                                                )}
                                                {visibleColumns.location && (
                                                    <td className="px-2 py-1 truncate text-xs" title={meet.location}>
                                                        {meet.location}
                                                    </td>
                                                )}
                                                {visibleColumns.federation && (
                                                    <td className="px-2 py-1 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${meet.federation === 'USAW'
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                                            }`}>
                                                            {meet.federation}
                                                        </span>
                                                    </td>
                                                )}
                                                {/* State - Hidden if IWF selected AND no USAW */}
                                                {visibleColumns.state && (!(filters.selectedSources.includes('IWF') && !filters.selectedSources.includes('USAW'))) && (
                                                    <td className="px-2 py-1 text-xs truncate">
                                                        {meet.state || '-'}
                                                    </td>
                                                )}
                                                {/* WSO - Hidden if IWF selected AND no USAW */}
                                                {visibleColumns.wso && (!(filters.selectedSources.includes('IWF') && !filters.selectedSources.includes('USAW'))) && (
                                                    <td className="px-2 py-1 text-xs truncate">
                                                        {meet.wso ? (
                                                            <Link
                                                                href={`/WSO/${meet.wso.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim()}`}
                                                                className="text-blue-400 hover:text-blue-300 hover:underline"
                                                            >
                                                                {meet.wso}
                                                            </Link>
                                                        ) : '-'}
                                                    </td>
                                                )}
                                                {visibleColumns.level && (
                                                    <td className="px-2 py-1 text-xs truncate">
                                                        {meet.level || '-'}
                                                    </td>
                                                )}
                                                {visibleColumns.athleteCount && (
                                                    <td className="px-2 py-1 text-xs">
                                                        {meet.athleteCount ? meet.athleteCount.toLocaleString() : '-'}
                                                    </td>
                                                )}
                                                {visibleColumns.link && (
                                                    <td className="px-2 py-1 text-right">
                                                        {meet.url ? (
                                                            <Link
                                                                href={meet.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center justify-center text-gray-400 hover:text-blue-400 transition-colors"
                                                                title="View External Results"
                                                                aria-label={`View external results for ${meet.name}`}
                                                            >
                                                                <ExternalLink className="w-4 h-4 ml-1" />
                                                            </Link>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                )}
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
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-app-primary">
                        {/* Items Per Page Selector */}
                        <div className="flex items-center gap-2 text-sm text-app-secondary">
                            <span>Show:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1); // Reset to page 1
                                }}
                                className="bg-app-tertiary border border-app-primary rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-primary"
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            <span>per page</span>
                        </div>

                        {/* Page Navigation */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
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
        </div>
    );
}
