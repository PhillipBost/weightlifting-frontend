'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Trophy, Medal, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export interface MeetEntry {
    id: number;
    lifter_id: number | null;
    membership_number: string | null;
    first_name: string | null;
    last_name: string | null;
    state: string | null;
    birth_year: number | null;
    weightlifting_age: number | null;
    club: string | null;
    gender: string | null;
    division: string | null;
    weight_class: string | null;
    entry_total: number | null;
    meet_name: string | null;
    event_date: string | null;
    wso: string | null;
    listing_id: number;
    best_qpoints?: number | null;
    best_q_youth?: number | null;
    best_q_masters?: number | null;
    best_gamx_total?: number | null;
    best_gamx_s?: number | null;
    best_gamx_j?: number | null;
    best_gamx_u?: number | null;
    best_gamx_a?: number | null;
    best_gamx_masters?: number | null;
}

interface PredictionEngineContentProps {
    entries: MeetEntry[];
}

interface Subcategory {
    name: string;
    entries: MeetEntry[];
}

interface WeightClassGroup {
    weightClass: string;
    allEntries: MeetEntry[];
    subcategories: Record<string, Subcategory>;
}

export function PredictionEngineContent({ entries }: PredictionEngineContentProps) {
    // We want the gender level and weight class level collapsed by default
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set([
        "Men's Results Predictions by Division",
        "Women's Results Predictions by Division"
    ]));
    const [showMenQPoints, setShowMenQPoints] = useState(false);
    const [showWomenQPoints, setShowWomenQPoints] = useState(false);
    const [showGamx, setShowGamx] = useState(false);
    const [gamxSortConfig, setGamxSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'best_gamx_total', direction: 'desc' });

    // Sort configurations for Q-Points tables
    const [menSortConfig, setMenSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [womenSortConfig, setWomenSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const toggleSection = (sectionId: string) => {
        const newCollapsed = new Set(collapsedSections);
        if (newCollapsed.has(sectionId)) {
            newCollapsed.delete(sectionId);
        } else {
            newCollapsed.add(sectionId);
        }
        setCollapsedSections(newCollapsed);
    };



    const [menEntries, womenEntries] = useMemo(() => {
        const men: MeetEntry[] = [];
        const women: MeetEntry[] = [];
        entries.forEach(entry => {
            const isFemale = entry.gender?.toLowerCase() === 'f' ||
                entry.gender?.toLowerCase() === 'female' ||
                entry.gender?.toLowerCase() === 'women' ||
                (entry.division?.toLowerCase().includes("women's") ?? false);

            if (isFemale) women.push(entry);
            else men.push(entry);
        });
        return [men, women];
    }, [entries]);

    const genderGroups = useMemo(() => {
        const groups: Record<string, Record<string, WeightClassGroup>> = {
            "Men's Results Predictions by Division": {},
            "Women's Results Predictions by Division": {}
        };

        // First pass: Natively push everyone into their gender + weight class
        entries.forEach(entry => {
            // Determine Gender
            const isFemale = entry.gender?.toLowerCase() === 'f' ||
                entry.gender?.toLowerCase() === 'female' ||
                entry.gender?.toLowerCase() === 'women' ||
                (entry.division?.toLowerCase().includes("women's") ?? false);

            const genderKey = isFemale ? "Women's Results Predictions by Division" : "Men's Results Predictions by Division";

            // Determine Weight Class
            let rawWeight = entry.weight_class?.trim() || 'Unknown';
            if (rawWeight === '-' || rawWeight === 'null') rawWeight = 'Unknown';
            const weightClass = rawWeight !== 'Unknown' ? (rawWeight.toLowerCase().endsWith('kg') ? rawWeight : `${rawWeight}kg`) : 'Unknown';

            // Initialize structure
            if (!groups[genderKey][weightClass]) {
                groups[genderKey][weightClass] = {
                    weightClass,
                    allEntries: [],
                    subcategories: {}
                };
            }

            // Always add to the top-level weight class aggregation
            groups[genderKey][weightClass].allEntries.push(entry);

            // Determine Subcategory Strictly From USAW Data
            let subCat = entry.division?.trim();
            if (!subCat || subCat === 'Unknown' || subCat === '-' || subCat === 'null') {
                subCat = 'Open';
            }

            // Clean up subcategory names
            if (subCat.toLowerCase().includes('senior') || subCat.toLowerCase() === 'open') {
                subCat = 'Open';
            }

            // Clean out redundant gender descriptors from the subcategory name
            if (subCat !== 'Open') {
                subCat = subCat.replace(/\b(women's|women|men's|men)\b/gi, '').trim();
                // If stripping gender leaves it empty, they belong in the Open/All Ages pool
                if (!subCat) subCat = 'Open';
            }

            // Add native explicit groupings (avoid duplicating Open/All Ages into a standalone subcategory)
            if (subCat !== 'Open') {
                if (!groups[genderKey][weightClass].subcategories[subCat]) {
                    groups[genderKey][weightClass].subcategories[subCat] = { name: subCat, entries: [] };
                }
                groups[genderKey][weightClass].subcategories[subCat].entries.push(entry);
            }
        });

        // Setup Sorting Helpers
        const sortWeightClasses = (a: string, b: string) => {
            const parse = (w: string) => {
                const hasPlus = w.includes('+');
                const num = parseFloat(w.replace(/[^0-9.]/g, ''));
                if (isNaN(num)) return -1;
                return num + (hasPlus ? 0.1 : 0);
            };
            return parse(b) - parse(a); // Heaviest first
        };

        const sortEntries = (a: MeetEntry, b: MeetEntry) => {
            const aTotal = a.entry_total || 0;
            const bTotal = b.entry_total || 0;
            if (aTotal === bTotal) {
                const aName = a.last_name || '';
                const bName = b.last_name || '';
                return aName.localeCompare(bName);
            }
            return bTotal - aTotal; // Highest total first
        };

        const sortSubcategories = (a: string, b: string) => {
            // Juniors first, then age groups, then masters youngest to oldest
            if (a.includes('Junior') && !b.includes('Junior')) return -1;
            if (!a.includes('Junior') && b.includes('Junior')) return 1;
            if (a.includes('Under') && !b.includes('Under')) return -1;
            if (!a.includes('Under') && b.includes('Under')) return 1;

            return a.localeCompare(b);
        };

        // Second pass: Sort everything hierarchically
        const finalOrdered: Record<string, WeightClassGroup[]> = {};

        ['Men\'s Results Predictions by Division', 'Women\'s Results Predictions by Division'].forEach(gender => {
            const wcKeys = Object.keys(groups[gender]).sort(sortWeightClasses);

            finalOrdered[gender] = wcKeys.map(wc => {
                const group = groups[gender][wc];
                group.allEntries.sort(sortEntries);

                // Convert subcategories to sorted array internally if needed, or just sort keys
                Object.values(group.subcategories).forEach(sub => sub.entries.sort(sortEntries));

                return group;
            });

            // Initialize collapsed state for the weight classes explicitly so they are hidden by default
            wcKeys.forEach(wcStr => {
                collapsedSections.add(`${gender}-${wcStr}`);

                // Keep 'All Ages' and all subcategories collapsed by default as well inside the weight class
                collapsedSections.add(`${gender}-${wcStr}-All Ages`);

                Object.keys(groups[gender][wcStr].subcategories).forEach(subCat => {
                    collapsedSections.add(`${gender}-${wcStr}-${subCat}`);
                });
            });
        });

        return finalOrdered;
    }, [entries]);

    const getAthleteUrl = (entry: MeetEntry) => {
        if (entry.membership_number && entry.membership_number !== 'null') {
            return `/athlete/${entry.membership_number}`;
        }
        if (entry.lifter_id) {
            return `/athlete/u-${entry.lifter_id}`;
        }
        const nameForUrl = `${entry.first_name || ''} ${entry.last_name || ''}`.trim().toLowerCase().replace(/\s+/g, '-');
        return `/athlete/${nameForUrl}`;
    };

    const renderTable = (entriesList: MeetEntry[]) => (
        <div className="overflow-x-auto">
            <table className="border-separate" style={{ borderSpacing: 0, width: '100%' }}>
                <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                    <tr className="border-b-2 border-gray-400 dark:border-gray-500">
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none w-16">
                            Place
                        </th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none">
                            Athlete
                        </th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none hidden sm:table-cell">
                            Club / WSO
                        </th>
                        <th className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {entriesList.map((result, index) => {
                        const displayPlace = index + 1;
                        return (
                            <tr key={result.id || index} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors group" style={{ borderTopColor: 'var(--border-secondary)' }}>
                                <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-app-primary">
                                    <div className="flex items-center gap-1">
                                        <span>{displayPlace}</span>
                                        {displayPlace === 1 && <Medal className="h-4 w-4" style={{ color: '#FFD700' }} />}
                                        {displayPlace === 2 && <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />}
                                        {displayPlace === 3 && <Medal className="h-4 w-4" style={{ color: '#CD7F32' }} />}
                                    </div>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap">
                                    <Link
                                        href={getAthleteUrl(result)}
                                        className="flex items-center space-x-1 text-accent-primary hover:text-accent-primary-hover transition-colors hover:underline"
                                    >
                                        <span className="font-medium text-sm">{result.first_name} {result.last_name}</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </Link>
                                    <div className="text-xs text-app-muted">
                                        {result.weightlifting_age && `Age ${result.weightlifting_age}`}
                                        {result.membership_number && result.weightlifting_age && " • "}
                                        {result.membership_number && `#${result.membership_number}`}
                                    </div>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap text-sm text-app-secondary hidden sm:table-cell">
                                    <div className="text-sm">{result.club || '-'}</div>
                                    <div className="text-xs text-app-muted">{result.wso || result.state}</div>
                                </td>
                                <td className="px-2 py-2 whitespace-nowrap text-sm font-bold text-right" style={{ color: 'var(--chart-total)' }}>
                                    {result.entry_total ? `${result.entry_total}kg` : '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const getDominantCategory = (results: MeetEntry[]) => {
        let youthCount = 0;
        let openCount = 0;
        let mastersCount = 0;

        results.forEach(r => {
            if ((r.best_q_youth ?? 0) > 0) youthCount++;
            if ((r.best_qpoints ?? 0) > 0) openCount++;
            if ((r.best_q_masters ?? 0) > 0) mastersCount++;
        });

        if (youthCount >= openCount && youthCount >= mastersCount && youthCount > 0) return 'best_q_youth';
        if (mastersCount >= openCount && mastersCount > 0) return 'best_q_masters';
        return 'best_qpoints'; // Default
    };

    const getEffectiveSort = (gender: 'men' | 'women', list: MeetEntry[]) => {
        const config = gender === 'men' ? menSortConfig : womenSortConfig;
        if (config) return config;

        // Default: dominant category, desc
        const dom = getDominantCategory(list);
        return { key: dom, direction: 'desc' as const };
    };

    const handleSummarySort = (gender: 'men' | 'women', key: string) => {
        const currentConfig = gender === 'men' ? menSortConfig : womenSortConfig;
        let nextDirection: 'asc' | 'desc' = 'desc'; // Default to desc for stats
        if (key === 'lifter_name' || key === 'weight_class' || key === 'club') {
            nextDirection = 'asc';
        }

        if (currentConfig && currentConfig.key === key) {
            nextDirection = currentConfig.direction === 'asc' ? 'desc' : 'asc';
        }

        if (gender === 'men') setMenSortConfig({ key, direction: nextDirection });
        else setWomenSortConfig({ key, direction: nextDirection });
    };

    const renderQPointsTable = (title: string, data: MeetEntry[], gender: 'men' | 'women', show: boolean, toggle: () => void) => {
        // filter out athletes with no qpoints in any category
        const validData = data.filter(e =>
            (e.best_qpoints && e.best_qpoints > 0) ||
            (e.best_q_youth && e.best_q_youth > 0) ||
            (e.best_q_masters && e.best_q_masters > 0)
        );
        if (validData.length === 0) return null;

        const sortConfig = getEffectiveSort(gender, validData);

        // Sort data based on dynamic configuration
        const sortedData = [...validData].sort((a, b) => {
            const key = sortConfig.key;

            // Helper to get value securely
            const getVal = (item: MeetEntry, k: string) => {
                if (k === 'lifter_name') return `${item.last_name || ''} ${item.first_name || ''}`;
                if (k === 'best_qpoints') return item.best_qpoints ?? 0;
                if (k === 'best_q_youth') return item.best_q_youth ?? 0;
                if (k === 'best_q_masters') return item.best_q_masters ?? 0;
                if (k === 'entry_total') return item.entry_total ?? 0;
                return (item as any)[k];
            };

            const valA = getVal(a, key);
            const valB = getVal(b, key);

            // Special handling for Q-stats: 0/null goes to bottom
            const isQStat = ['best_qpoints', 'best_q_youth', 'best_q_masters'].includes(key);
            if (isQStat) {
                const aZero = !valA || valA === 0;
                const bZero = !valB || valB === 0;
                if (aZero && !bZero) return 1; // a bottom
                if (!aZero && bZero) return -1; // b bottom
                if (aZero && bZero) {
                    // Both zero, sort alphabetically
                    const nameA = `${a.last_name || ''} ${a.first_name || ''}`;
                    const nameB = `${b.last_name || ''} ${b.first_name || ''}`;
                    return nameA.localeCompare(nameB);
                }
            }

            let cmpA = valA;
            let cmpB = valB;

            if (typeof valA === 'string') cmpA = valA.toLowerCase();
            if (typeof valB === 'string') cmpB = valB.toLowerCase();

            if (['entry_total'].includes(key)) {
                cmpA = parseFloat(String(valA) || '0');
                cmpB = parseFloat(String(valB) || '0');
            }

            if (cmpA < cmpB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (cmpA > cmpB) return sortConfig.direction === 'asc' ? 1 : -1;

            return 0;
        });

        const isRankingSort = ['best_qpoints', 'best_q_youth', 'best_q_masters', 'entry_total'].includes(sortConfig.key);

        const dataWithDisplayRank = sortedData.map((item, idx) => {
            let displayRank: string | number = '-';
            if (isRankingSort) {
                const val = (item as any)[sortConfig.key];
                if (val && val > 0) {
                    displayRank = idx + 1;
                }
            }
            return { ...item, displayRank };
        });

        const SortIndicator = ({ col }: { col: string }) => {
            if (sortConfig.key !== col) {
                return <span className="text-app-disabled ml-1">↕</span>;
            }
            return <span className="text-accent-primary ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
        };

        const headerClass = "px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none";
        const qHeaderClass = (col: string) => `px-2 py-1 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none ${sortConfig.key === col ? 'text-accent-primary font-bold' : 'text-gray-900 dark:text-gray-200'}`;

        return (
            <div className="mb-4">
                <div className="mb-3">
                    <button
                        onClick={toggle}
                        className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
                    >
                        {show ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <h2 className="text-2xl font-bold">
                            {title}
                        </h2>
                        <span className="text-sm text-app-muted ml-2">
                            ({sortedData.length} athletes ranked)
                        </span>
                    </button>
                </div>

                {show && (
                    <div className="card-primary mb-8">
                        <div className="overflow-x-auto">
                            <table className="border-separate" style={{ borderSpacing: 0, width: '100%' }}>
                                <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                                    <tr className="border-b-2 border-gray-400 dark:border-gray-500">
                                        <th className={headerClass} onClick={() => handleSummarySort(gender, 'rank')}>Rank <SortIndicator col="rank" /></th>
                                        <th className={headerClass} onClick={() => handleSummarySort(gender, 'lifter_name')}>Name <SortIndicator col="lifter_name" /></th>
                                        <th className={`${headerClass} hidden sm:table-cell`} onClick={() => handleSummarySort(gender, 'club')}>Club / WSO <SortIndicator col="club" /></th>
                                        <th className={headerClass} onClick={() => handleSummarySort(gender, 'weight_class')}>Wt. Class <SortIndicator col="weight_class" /></th>
                                        <th className={`${headerClass} hidden sm:table-cell`} onClick={() => handleSummarySort(gender, 'division')}>Division <SortIndicator col="division" /></th>
                                        <th className={qHeaderClass('best_q_youth')} onClick={() => handleSummarySort(gender, 'best_q_youth')}>Best Q-Youth <SortIndicator col="best_q_youth" /></th>
                                        <th className={qHeaderClass('best_qpoints')} onClick={() => handleSummarySort(gender, 'best_qpoints')}>Best Q-Points <SortIndicator col="best_qpoints" /></th>
                                        <th className={qHeaderClass('best_q_masters')} onClick={() => handleSummarySort(gender, 'best_q_masters')}>Best Q-Masters <SortIndicator col="best_q_masters" /></th>
                                        <th className={`${qHeaderClass('entry_total')} hidden sm:table-cell`} onClick={() => handleSummarySort(gender, 'entry_total')}>Entry Total <SortIndicator col="entry_total" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dataWithDisplayRank.map((e, idx) => {
                                        return (
                                            <tr key={idx} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors group" style={{ borderTopColor: 'var(--border-secondary)' }}>
                                                <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-app-primary">
                                                    <div className="flex items-center gap-1">
                                                        <span>{e.displayRank}</span>
                                                        {e.displayRank === 1 && <Medal className="h-4 w-4" style={{ color: '#FFD700' }} />}
                                                        {e.displayRank === 2 && <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />}
                                                        {e.displayRank === 3 && <Medal className="h-4 w-4" style={{ color: '#CD7F32' }} />}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 max-w-[200px] truncate" title={`${e.first_name} ${e.last_name}`}>
                                                    <Link
                                                        href={getAthleteUrl(e)}
                                                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center space-x-1"
                                                    >
                                                        <span className="font-medium text-sm truncate">
                                                            {e.first_name} {e.last_name}
                                                        </span>
                                                    </Link>
                                                    <div className="text-xs text-app-muted">
                                                        {e.weightlifting_age && `Age ${e.weightlifting_age}`}
                                                        {e.membership_number && e.weightlifting_age && " • "}
                                                        {e.membership_number && `#${e.membership_number}`}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 whitespace-nowrap text-sm text-app-secondary hidden sm:table-cell max-w-[120px] truncate" title={`${e.club || '-'} / ${e.wso || e.state}`}>
                                                    <div className="text-sm truncate">{e.club || '-'}</div>
                                                    <div className="text-xs text-app-muted truncate">{e.wso || e.state}</div>
                                                </td>
                                                <td className="px-2 py-2 text-sm">{e.weight_class}</td>
                                                <td className="px-2 py-2 text-sm hidden sm:table-cell max-w-[120px] leading-tight" style={{ fontSize: '0.75rem', whiteSpace: 'normal', wordBreak: 'break-word' }} title={e.division || ''}>{e.division}</td>
                                                <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_q_youth && e.best_q_youth > 0 ? 'var(--chart-qyouth)' : 'inherit' }}>
                                                    {e.best_q_youth ? e.best_q_youth.toFixed(2) : '-'}
                                                </td>
                                                <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_qpoints && e.best_qpoints > 0 ? 'var(--chart-qpoints)' : 'inherit' }}>
                                                    {e.best_qpoints ? e.best_qpoints.toFixed(2) : '-'}
                                                </td>
                                                <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_q_masters && e.best_q_masters > 0 ? 'var(--chart-qmasters)' : 'inherit' }}>
                                                    {e.best_q_masters ? e.best_q_masters.toFixed(2) : '-'}
                                                </td>
                                                <td className="px-2 py-2 text-sm hidden sm:table-cell font-bold" style={{ color: 'var(--chart-total)' }}>
                                                    {e.entry_total ? `${e.entry_total}kg` : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleGamxSort = (key: string) => {
        setGamxSortConfig(prev =>
            prev.key === key
                ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: 'desc' }
        );
    };

    const renderGamxTable = (title: string, entriesList: MeetEntry[], isShowing: boolean, toggle: () => void) => {
        const validEntries = entriesList.filter(e => e.best_gamx_total != null && e.best_gamx_total > 0);
        if (validEntries.length === 0) return null;

        const sortedEntries = [...validEntries].sort((a, b) => {
            const aVal = (a as any)[gamxSortConfig.key] ?? 0;
            const bVal = (b as any)[gamxSortConfig.key] ?? 0;
            // Zeros to the bottom
            if (aVal === 0 && bVal !== 0) return 1;
            if (aVal !== 0 && bVal === 0) return -1;
            return gamxSortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        });

        const SortIndicator = ({ col }: { col: string }) => {
            if (gamxSortConfig.key !== col) return <span className="text-app-disabled ml-1">↕</span>;
            return <span className="text-accent-primary ml-1">{gamxSortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
        };

        const hClass = "px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none";
        const qHClass = (col: string) =>
            `px-2 py-1 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none ${gamxSortConfig.key === col ? 'text-accent-primary font-bold' : 'text-gray-900 dark:text-gray-200'
            }`;

        return (
            <div className="mb-4">
                <div className="mb-3">
                    <button
                        onClick={toggle}
                        className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
                    >
                        {isShowing ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <h2 className="text-2xl font-bold">{title}</h2>
                        <span className="text-sm text-app-muted ml-2">({sortedEntries.length} athletes ranked)</span>
                    </button>
                </div>

                {isShowing && (
                    <div className="card-primary mb-8">
                        <div className="overflow-x-auto">
                            <table className="border-separate" style={{ borderSpacing: 0, width: '100%' }}>
                                <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                                    <tr className="border-b-2 border-gray-400 dark:border-gray-500">
                                        <th className={hClass} onClick={() => handleGamxSort('rank')}>Rank <SortIndicator col="rank" /></th>
                                        <th className={hClass} onClick={() => handleGamxSort('lifter_name')}>Name <SortIndicator col="lifter_name" /></th>
                                        <th className={`${hClass} hidden sm:table-cell`} onClick={() => handleGamxSort('club')}>Club / WSO <SortIndicator col="club" /></th>
                                        <th className={hClass} onClick={() => handleGamxSort('weight_class')}>Wt. Class <SortIndicator col="weight_class" /></th>
                                        <th className={`${hClass} hidden sm:table-cell`} onClick={() => handleGamxSort('division')}>Division <SortIndicator col="division" /></th>
                                        <th className={`${qHClass('entry_total')} hidden sm:table-cell`} onClick={() => handleGamxSort('entry_total')}>Entry Total <SortIndicator col="entry_total" /></th>
                                        <th className={qHClass('best_gamx_total')} onClick={() => handleGamxSort('best_gamx_total')}>GAMX-Total <SortIndicator col="best_gamx_total" /></th>
                                        <th className={qHClass('best_gamx_s')} onClick={() => handleGamxSort('best_gamx_s')}>GAMX-S <SortIndicator col="best_gamx_s" /></th>
                                        <th className={qHClass('best_gamx_j')} onClick={() => handleGamxSort('best_gamx_j')}>GAMX-J <SortIndicator col="best_gamx_j" /></th>
                                        <th className={qHClass('best_gamx_u')} onClick={() => handleGamxSort('best_gamx_u')}>GAMX-U <SortIndicator col="best_gamx_u" /></th>
                                        <th className={qHClass('best_gamx_a')} onClick={() => handleGamxSort('best_gamx_a')}>GAMX-A <SortIndicator col="best_gamx_a" /></th>
                                        <th className={qHClass('best_gamx_masters')} onClick={() => handleGamxSort('best_gamx_masters')}>GAMX-M <SortIndicator col="best_gamx_masters" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedEntries.map((e, idx) => (
                                        <tr key={`gamx-${idx}`} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors group" style={{ borderTopColor: 'var(--border-secondary)' }}>
                                            <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-app-primary">
                                                <div className="flex items-center gap-1">
                                                    <span>{idx + 1}</span>
                                                    {idx === 0 && <Medal className="h-4 w-4" style={{ color: '#FFD700' }} />}
                                                    {idx === 1 && <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />}
                                                    {idx === 2 && <Medal className="h-4 w-4" style={{ color: '#CD7F32' }} />}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 max-w-[200px] truncate" title={`${e.first_name} ${e.last_name}`}>
                                                <Link href={getAthleteUrl(e)} className="text-accent-primary hover:text-accent-primary-hover hover:underline flex items-center space-x-1">
                                                    <span className="font-medium text-sm truncate">{e.first_name} {e.last_name}</span>
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                                <div className="text-xs text-app-muted">
                                                    {e.weightlifting_age && `Age ${e.weightlifting_age}`}
                                                    {e.membership_number && e.weightlifting_age && " • "}
                                                    {e.membership_number && `#${e.membership_number}`}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 whitespace-nowrap text-sm text-app-secondary hidden sm:table-cell max-w-[120px] truncate" title={`${e.club || '-'} / ${e.wso || e.state}`}>
                                                <div className="text-sm truncate">{e.club || '-'}</div>
                                                <div className="text-xs text-app-muted truncate">{e.wso || e.state}</div>
                                            </td>
                                            <td className="px-2 py-2 text-sm">{e.weight_class}</td>
                                            <td className="px-2 py-2 text-sm hidden sm:table-cell max-w-[120px] leading-tight" style={{ fontSize: '0.75rem', whiteSpace: 'normal', wordBreak: 'break-word' }} title={e.division || ''}>{e.division}</td>
                                            <td className="px-2 py-2 text-sm hidden sm:table-cell font-bold" style={{ color: 'var(--chart-total)' }}>
                                                {e.entry_total ? `${e.entry_total}kg` : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_gamx_total && e.best_gamx_total > 0 ? 'var(--chart-total)' : 'inherit' }}>
                                                {e.best_gamx_total ? e.best_gamx_total.toFixed(0) : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_gamx_s && e.best_gamx_s > 0 ? 'var(--chart-qpoints)' : 'inherit' }}>
                                                {e.best_gamx_s ? e.best_gamx_s.toFixed(0) : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_gamx_j && e.best_gamx_j > 0 ? 'var(--chart-qyouth)' : 'inherit' }}>
                                                {e.best_gamx_j ? e.best_gamx_j.toFixed(0) : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_gamx_u && e.best_gamx_u > 0 ? 'var(--chart-qpoints)' : 'inherit' }}>
                                                {e.best_gamx_u ? e.best_gamx_u.toFixed(0) : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_gamx_a && e.best_gamx_a > 0 ? 'var(--chart-qmasters)' : 'inherit' }}>
                                                {e.best_gamx_a ? e.best_gamx_a.toFixed(0) : '-'}
                                            </td>
                                            <td className="px-2 py-2 text-sm font-medium" style={{ color: e.best_gamx_masters && e.best_gamx_masters > 0 ? 'var(--chart-qmasters)' : 'inherit' }}>
                                                {e.best_gamx_masters ? e.best_gamx_masters.toFixed(0) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {renderGamxTable("Overall Rankings Predictions by GAMX", entries, showGamx, () => setShowGamx(!showGamx))}
            {renderQPointsTable("Men's Overall Rankings Predictions by Q-Points", menEntries, 'men', showMenQPoints, () => setShowMenQPoints(!showMenQPoints))}
            {renderQPointsTable("Women's Overall Rankings Predictions by Q-Points", womenEntries, 'women', showWomenQPoints, () => setShowWomenQPoints(!showWomenQPoints))}

            <div className="mb-4">
                {Object.entries(genderGroups).map(([genderSection, weightClassGroups]) => {
                    const isGenderCollapsed = collapsedSections.has(genderSection);
                    if (weightClassGroups.length === 0) return null;

                    return (
                        <div key={genderSection} className={isGenderCollapsed ? 'mb-2' : 'mb-6'}>
                            {/* Gender Section Header */}
                            <div className="mb-3">
                                <button
                                    onClick={() => toggleSection(genderSection)}
                                    className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
                                >
                                    {isGenderCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                    <h2 className="text-2xl font-bold">
                                        {genderSection}
                                    </h2>
                                    <span className="ml-2 text-sm font-normal text-app-muted">({weightClassGroups.reduce((acc, wc) => acc + wc.allEntries.length, 0)} athletes)</span>
                                </button>
                            </div>

                            {/* Weight Classes within Gender Section */}
                            {!isGenderCollapsed && weightClassGroups.map((wc) => {
                                const wcKey = `${genderSection}-${wc.weightClass}`;
                                const isWcCollapsed = collapsedSections.has(wcKey);
                                const hasSubcats = Object.keys(wc.subcategories).length > 0;

                                return (
                                    <div key={wc.weightClass} className="card-primary p-0 mb-1 max-w-[1150px] ml-7">
                                        <div
                                            onClick={() => toggleSection(wcKey)}
                                            className="cursor-pointer hover:bg-app-hover transition-colors rounded-t-lg"
                                        >
                                            <h3 className="text-xl font-bold px-3 py-1 flex items-center text-app-primary">
                                                {isWcCollapsed ? <ChevronRight className="h-5 w-5 mr-2" /> : <ChevronDown className="h-5 w-5 mr-2" />}
                                                <span>{wc.weightClass}</span>
                                                <span className="ml-auto text-sm text-app-muted">{wc.allEntries.length} total athletes</span>
                                            </h3>
                                        </div>

                                        {!isWcCollapsed && (
                                            <div className="border-t border-app-primary px-3 pb-3">
                                                <div className="mt-4 mb-2 space-y-2">

                                                    {/* Parent Table (Everyone in this Weight Class) wrapped in All Ages */}
                                                    <div className="ml-8 border-l-4 border-accent-secondary rounded-r-lg mr-2">
                                                        <div
                                                            onClick={() => toggleSection(`${genderSection}-${wc.weightClass}-All Ages`)}
                                                            className="cursor-pointer hover:bg-app-hover transition-colors rounded-tr-lg"
                                                        >
                                                            <h4 className="text-base font-bold p-2 flex items-center text-app-primary">
                                                                {collapsedSections.has(`${genderSection}-${wc.weightClass}-All Ages`) ? <ChevronRight className="h-4 w-4 mr-2 text-gray-400" /> : <ChevronDown className="h-4 w-4 mr-2 text-gray-400" />}
                                                                <span className="mr-2 text-app-muted">↳</span>
                                                                <span>All Ages</span>
                                                                <span className="ml-2 text-sm font-normal text-app-muted">(Overall Rankings)</span>
                                                                <span className="ml-auto text-sm text-app-muted">{wc.allEntries.length} athletes</span>
                                                            </h4>
                                                        </div>

                                                        {!collapsedSections.has(`${genderSection}-${wc.weightClass}-All Ages`) && (
                                                            <div className="border-t border-app-primary">
                                                                {renderTable(wc.allEntries)}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Staggered Subcategories */}
                                                    {hasSubcats && Object.values(wc.subcategories).sort((a, b) => a.name.localeCompare(b.name)).map((sub) => {
                                                        const subKey = `${genderSection}-${wc.weightClass}-${sub.name}`;
                                                        const isSubCollapsed = collapsedSections.has(subKey);

                                                        return (
                                                            <div key={sub.name} className="ml-8 border-l-4 border-accent-primary rounded-r-lg mr-2">
                                                                <div
                                                                    onClick={() => toggleSection(subKey)}
                                                                    className="cursor-pointer hover:bg-app-hover transition-colors rounded-tr-lg"
                                                                >
                                                                    <h4 className="text-base font-bold p-2 flex items-center text-app-primary">
                                                                        {isSubCollapsed ? <ChevronRight className="h-4 w-4 mr-2 text-gray-400" /> : <ChevronDown className="h-4 w-4 mr-2 text-gray-400" />}
                                                                        <span className="mr-2 text-app-muted">↳</span>
                                                                        <span>{sub.name}</span>
                                                                        <span className="ml-auto text-sm text-app-muted">{sub.entries.length} athletes</span>
                                                                    </h4>
                                                                </div>

                                                                {!isSubCollapsed && (
                                                                    <div className="border-t border-app-primary">
                                                                        {renderTable(sub.entries)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
