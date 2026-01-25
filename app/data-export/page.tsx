"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AuthGuard } from "../components/AuthGuard";
import { ROLES } from "../../lib/roles";
import { createClient } from "@/lib/supabase/client";
import {
    Filter,
    Download,
    Database,
    Search,
    CheckCircle,
    AlertCircle,
    FileSpreadsheet,
    ArrowLeft,
    Loader2,
    RefreshCw,
    Info,
    ChevronDown,
    X,
} from "lucide-react";
import { getCountryFlagComponent } from "../utils/countryFlags";
import { SearchableDropdown } from "../components/SearchableDropdown";
import { matchesAthleteName } from "../../lib/search/searchUtils";
import { MetricTooltip } from "../components/MetricTooltip";

// Custom ROC (Russian Olympic Committee) flag component




// Reuse interfaces from Rankings (simplified where possible, but keeping structure for compatibility)
interface AthleteRanking {
    lifter_id: string;
    lifter_name: string;
    gender: string;
    federation: "usaw" | "iwf";
    year: number;
    weight_class?: string;
    age_category?: string;
    best_snatch: number;
    best_cj: number;
    best_total: number;
    best_qpoints: number;
    q_youth?: number;
    q_masters?: number;
    qpoints?: number;
    competition_count: number;
    last_competition: string;
    last_meet_name: string;
    last_body_weight?: string;
    competition_age?: number;
    country_code?: string;
    country_name?: string;
    wso?: string;
    club_name?: string;
    membership_number?: string;
    meet_id?: number | string;
    unique_id: string;
}

interface USAWRankingResult {
    result_id: number;
    meet_id: number;
    lifter_id: number;
    membership_number: number | null;
    lifter_name: string;
    gender: string;
    weight_class: string;
    age_category: string;
    date: string;
    meet_name: string;
    body_weight_kg: string;
    competition_age: number | null;
    best_snatch: number;
    best_cj: number;
    total: number;
    qpoints: number;
    q_youth: number | null;
    q_masters: number | null;
    wso?: string | null;
    club_name?: string | null;
}

interface IWFRankingResult {
    db_result_id: number;
    db_meet_id: number | null;
    db_lifter_id: number;
    iwf_lifter_id: number | null;
    lifter_name: string;
    gender: string;
    weight_class: string;
    age_category: string;
    date: string;
    meet_name: string;
    body_weight_kg: string;
    competition_age: number | null;
    best_snatch: number;
    best_cj: number;
    total: number;
    qpoints: number;
    q_youth: number | null;
    q_masters: number | null;
    country_code?: string;
    country_name?: string;
}

export default function DataExportPage() {
    const supabase = createClient();

    // State for data
    const [usawRankings, setUsawRankings] = useState<AthleteRanking[]>([]);
    const [iwfRankings, setIwfRankings] = useState<AthleteRanking[]>([]);
    const [rankings, setRankings] = useState<AthleteRanking[]>([]);
    const [filteredRankings, setFilteredRankings] = useState<AthleteRanking[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Constants adapted from Rankings
    const CURRENT_WEIGHT_CLASSES = {
        Women: ["36kg", "40kg", "44kg", "48kg", "53kg", "58kg", "63kg", "63+kg", "69kg", "69+kg", "77kg", "77+kg", "86kg", "86+kg"],
        Men: ["40kg", "44kg", "48kg", "52kg", "56kg", "60kg", "65kg", "65+kg", "71kg", "79kg", "79+kg", "88kg", "94kg", "94+kg", "110kg", "110+kg"],
    };

    // Historical weight classes (November 2018-May 2025)
    const HISTORICAL_2018_2025_WEIGHT_CLASSES = {
        Women: ["30kg", "33kg", "36kg", "40kg", "45kg", "49kg", "55kg", "59kg", "64kg", "64+kg", "71kg", "76kg", "76+kg", "81kg", "81+kg", "87kg", "87+kg"],
        Men: ["32kg", "36kg", "39kg", "44kg", "49kg", "55kg", "61kg", "67kg", "73kg", "73+kg", "81kg", "89kg", "89+kg", "96kg", "102kg", "102+kg", "109kg", "109+kg"],
    };

    // Historical weight classes (January 1998-October 2018)
    const HISTORICAL_1998_2018_WEIGHT_CLASSES = {
        Women: ["31kg", "35kg", "39kg", "44kg", "48kg", "53kg", "58kg", "58+kg", "63kg", "69kg", "69+kg", "75kg", "75+kg", "90kg", "90+kg"],
        Men: ["31kg", "35kg", "39kg", "44kg", "50kg", "56kg", "62kg", "69kg", "69+kg", "77kg", "85kg", "85+kg", "94kg", "94+kg", "105kg", "105+kg"],
    };

    // State for filters
    const [filters, setFilters] = useState({
        gender: "all",
        ageCategory: "all",
        federation: "usaw" as "usaw" | "iwf",
        selectedYears: [2025] as number[],
        selectedCountries: [] as string[],
        selectedWeightClasses: [] as string[],
        selectedHistorical2018: [] as string[],
        selectedHistorical1998: [] as string[],
        startDate: "",
        endDate: "",
        selectedWSO: [] as string[],
        selectedClubs: [] as string[],
        bodyWeightMin: "",
        bodyWeightMax: "",
        searchTerm: "",
    });

    // Filter options (populated from data)
    const [filterOptions, setFilterOptions] = useState({
        weightClasses: [] as string[],
        ageCategories: [] as string[],
        countries: [] as { code: string; name: string }[],
        wsoCategories: [] as string[],
    });

    const [inactiveWeightClasses, setInactiveWeightClasses] = useState<Set<string>>(new Set());

    // UI States for filter dropdowns
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [showFederationDropdown, setShowFederationDropdown] = useState(false);
    const [showAgeCategoryDropdown, setShowAgeCategoryDropdown] = useState(false);
    const [showWeightClassDropdown, setShowWeightClassDropdown] = useState(false);
    const [showHistorical2018Dropdown, setShowHistorical2018Dropdown] = useState(false);
    const [showHistorical1998Dropdown, setShowHistorical1998Dropdown] = useState(false);

    // Initialize data on mount
    useEffect(() => {
        initializeData();
    }, []);

    // Re-run filters when data or filters change
    useEffect(() => {
        applyFilters();
    }, [rankings, filters]);

    // Handle year changes if date range changes
    useEffect(() => {
        const hasStartDate = Boolean(filters.startDate);
        const hasEndDate = Boolean(filters.endDate);

        if (hasStartDate || hasEndDate) {
            const startYear = hasStartDate ? new Date(filters.startDate).getFullYear() : 1998;
            const endYear = hasEndDate ? new Date(filters.endDate).getFullYear() : new Date().getFullYear();
            const yearsFromRange: number[] = [];
            for (let year = startYear; year <= endYear; year++) {
                yearsFromRange.push(year);
            }

            const currentYears = filters.selectedYears.slice().sort();
            const newYears = yearsFromRange.slice().sort();
            if (JSON.stringify(currentYears) !== JSON.stringify(newYears)) {
                setFilters(prev => ({ ...prev, selectedYears: yearsFromRange }));
            }
        }
    }, [filters.startDate, filters.endDate]);

    // Refetch if selected years change
    useEffect(() => {
        if (inactiveWeightClasses.size > 0 || !loading) {
            // Debounce slightly or just call fetch
            fetchRankingsData(inactiveWeightClasses);
        }
    }, [filters.selectedYears]);


    async function initializeData() {
        let inactiveSet: Set<string> = new Set();
        try {
            inactiveSet = await loadInactiveDivisions();
        } catch (e) {
            console.error("Inactive divisions load failed, continuing:", e);
        }
        await fetchRankingsData(inactiveSet);
    }

    async function loadInactiveDivisions(): Promise<Set<string>> {
        const response = await fetch("/all-divisions.csv");
        if (!response.ok) return new Set();

        const csvContent = await response.text();
        const lines = csvContent.split("\n").slice(1);
        const inactiveSet = new Set<string>();

        lines.forEach((line) => {
            const division = line.trim().replace("\r", "");
            if (division.startsWith("(Inactive)")) {
                const cleanDivision = division.replace("(Inactive) ", "");
                let gender = "";
                if (cleanDivision.includes("Women's")) gender = "Women's";
                else if (cleanDivision.includes("Men's")) gender = "Men's";
                const parts = cleanDivision.split(" ");
                const weightClass = parts[parts.length - 1];
                if (gender && weightClass && weightClass.includes("kg")) {
                    inactiveSet.add(`${gender} ${weightClass}`);
                }
            }
        });

        setInactiveWeightClasses(inactiveSet);
        return inactiveSet;
    }

    // --- DATA LOADING LOGIC (Simplified from Rankings) ---

    async function fetchAllInBatches(baseQuery: any, label: string) {
        const BATCH_SIZE = 1000;
        let allResults: any[] = [];
        let start = 0;
        let hasMore = true;
        let batchCount = 0;

        while (hasMore) {
            batchCount++;
            const { data, error } = await baseQuery.range(start, start + BATCH_SIZE - 1);
            if (error) throw error;

            if (data && data.length > 0) {
                allResults = allResults.concat(data);
                start += BATCH_SIZE;
                hasMore = data.length === BATCH_SIZE;
            } else {
                hasMore = false;
            }
        }
        return allResults;
    }

    async function loadUSAWRankingsFile(year: number): Promise<USAWRankingResult[]> {
        try {
            const response = await fetch(`/data/usaw-rankings-${year}.json.gz`);
            if (!response.ok) throw new Error("File not found");

            let json;
            const contentEncoding = response.headers.get('Content-Encoding');
            if (contentEncoding === 'gzip') {
                json = await response.text();
            } else {
                try {
                    const ds = new DecompressionStream('gzip');
                    const decompressedStream = response.body?.pipeThrough(ds);
                    json = decompressedStream ? await new Response(decompressedStream).text() : await response.text();
                } catch {
                    json = await response.text();
                }
            }
            return JSON.parse(json);
        } catch {
            return [];
        }
    }

    async function loadIWFRankingsFile(year: number): Promise<IWFRankingResult[]> {
        try {
            const response = await fetch(`/data/iwf-rankings-${year}.json.gz`);
            if (!response.ok) throw new Error("File not found");

            let json;
            const contentEncoding = response.headers.get('Content-Encoding');
            if (contentEncoding === 'gzip') {
                json = await response.text();
            } else {
                try {
                    const ds = new DecompressionStream('gzip');
                    const decompressedStream = response.body?.pipeThrough(ds);
                    json = decompressedStream ? await new Response(decompressedStream).text() : await response.text();
                } catch {
                    json = await response.text();
                }
            }
            return JSON.parse(json);
        } catch {
            return [];
        }
    }

    async function fetchRankingsData(inactiveWeightClassesSet: Set<string>) {
        setLoading(true);
        try {
            let yearsToFetch = filters.selectedYears;
            if (yearsToFetch.length === 0) {
                setRankings([]);
                setLoading(false);
                return;
            }

            // 1. USAW Data
            let usawResults: USAWRankingResult[] = [];
            let lifterInfoMap = new Map<number, any>();
            let usawDbFallbackNeeded = false;

            const usawPromises = yearsToFetch.map(year => loadUSAWRankingsFile(year));
            const usawYearData = await Promise.all(usawPromises);
            usawResults = usawYearData.flat();

            if (usawResults.length === 0 && yearsToFetch.length > 0) {
                usawDbFallbackNeeded = true;
            }

            if (usawDbFallbackNeeded) {
                // DB Fallback logic similar to Rankings
                let usawQuery = supabase
                    .from("usaw_meet_results")
                    .select(`
                    result_id, lifter_id, lifter_name, date, meet_name, meet_id,
                    weight_class, age_category, body_weight_kg, best_snatch, best_cj, total,
                    qpoints, q_youth, q_masters, competition_age, gender, wso, club_name
                `);

                const minYear = Math.min(...yearsToFetch);
                const maxYear = Math.max(...yearsToFetch);
                usawQuery = usawQuery.gte('date', `${minYear}-01-01`).lte('date', `${maxYear}-12-31`);

                const resultsData = await fetchAllInBatches(usawQuery, "USAW Export");
                const lifterIds = Array.from(new Set((resultsData || []).map((r: any) => r.lifter_id)));

                // Fetch lifter metadata in batches
                const LIFTER_BATCH_SIZE = 900;
                for (let i = 0; i < lifterIds.length; i += LIFTER_BATCH_SIZE) {
                    const batch = lifterIds.slice(i, i + LIFTER_BATCH_SIZE);
                    const { data: liftersData } = await supabase
                        .from("usaw_lifters")
                        .select(`lifter_id, athlete_name, wso, club_name, membership_number`)
                        .in('lifter_id', batch);
                    (liftersData || []).forEach((lifter: any) => lifterInfoMap.set(lifter.lifter_id, lifter));
                }
                usawResults = resultsData as unknown as USAWRankingResult[];
            }

            const usawRankingsLocal: AthleteRanking[] = usawResults.map((result, index) => {
                const lifterInfo = lifterInfoMap.get(result.lifter_id);
                return {
                    lifter_id: String(result.lifter_id),
                    lifter_name: lifterInfo?.athlete_name || result.lifter_name || "Unknown",
                    gender: result.gender || "",
                    federation: "usaw",
                    year: new Date(result.date).getFullYear(),
                    weight_class: result.weight_class || "",
                    age_category: result.age_category || "",
                    best_snatch: result.best_snatch || 0,
                    best_cj: result.best_cj || 0,
                    best_total: result.total || 0,
                    best_qpoints: Math.max(result.qpoints || 0, result.q_youth || 0, result.q_masters || 0),
                    q_youth: result.q_youth || undefined,
                    q_masters: result.q_masters || undefined,
                    qpoints: result.qpoints || undefined,
                    competition_count: 1,
                    last_competition: result.date || "",
                    last_meet_name: result.meet_name || "",
                    last_body_weight: result.body_weight_kg || "",
                    competition_age: result.competition_age || undefined,
                    membership_number: lifterInfo?.membership_number || result.membership_number || "",
                    meet_id: result.meet_id,
                    unique_id: `usaw-${result.result_id}-${index}`,
                    country_code: "USA",
                    country_name: "USA",
                    wso: result.wso || lifterInfo?.wso || "",
                    club_name: result.club_name || lifterInfo?.club_name || ""
                };
            });

            setUsawRankings(usawRankingsLocal);

            // 2. IWF Data (similar logic)
            let iwfResults: IWFRankingResult[] = [];
            const iwfPromises = yearsToFetch.map(year => loadIWFRankingsFile(year));
            const iwfYearData = await Promise.all(iwfPromises);
            iwfResults = iwfYearData.flat();

            // (Skipping IWF DB fallback for brevity/performance unless strictly needed - usually files exist)

            const iwfRankingsLocal: AthleteRanking[] = iwfResults.map((result, index) => ({
                lifter_id: String(result.db_lifter_id),
                lifter_name: result.lifter_name,
                gender: result.gender,
                federation: "iwf",
                year: new Date(result.date).getFullYear(),
                weight_class: result.weight_class,
                age_category: result.age_category,
                best_snatch: result.best_snatch,
                best_cj: result.best_cj,
                best_total: result.total,
                best_qpoints: result.qpoints,
                q_youth: result.q_youth || undefined,
                q_masters: result.q_masters || undefined,
                qpoints: result.qpoints || undefined,
                competition_count: 1,
                last_competition: result.date,
                last_meet_name: result.meet_name,
                last_body_weight: result.body_weight_kg,
                competition_age: result.competition_age || undefined,
                unique_id: `iwf-${result.db_result_id}-${index}`,
                country_code: result.country_code,
                country_name: result.country_name
            }));

            setIwfRankings(iwfRankingsLocal);
            setRankings([...usawRankingsLocal, ...iwfRankingsLocal]);

            // Populate Filter Options
            const wsoSet = new Set<string>();
            const clubSet = new Set<string>();
            const countryMap = new Map<string, string>();

            [...usawRankingsLocal, ...iwfRankingsLocal].forEach(r => {
                if (r.wso) wsoSet.add(r.wso);
                if (r.club_name) clubSet.add(r.club_name);
                if (r.country_code && r.country_code !== 'USA') {
                    countryMap.set(r.country_code, r.country_name || r.country_code);
                }
            });

            // Explicitly ensure USA is present
            countryMap.set('USA', 'United States');

            // --- FILTER OPTION EXTRACTION (Match Rankings Page Logic) ---
            const weightClassCombinations = new Set<string>();
            const wsoCategoriesSet = new Set<string>();
            const barbellClubsSet = new Set<string>();

            [...usawRankingsLocal, ...iwfRankingsLocal].forEach((athlete) => {
                if (athlete.age_category && athlete.weight_class) {
                    let gender = "";
                    if (athlete.age_category.includes("Women's")) gender = "Women's";
                    else if (athlete.age_category.includes("Men's")) gender = "Men's";

                    if (gender) {
                        weightClassCombinations.add(`${gender} ${athlete.weight_class}`);
                    }
                }

                if (athlete.wso) {
                    wsoCategoriesSet.add(athlete.wso);
                }

                if (athlete.club_name) {
                    barbellClubsSet.add(athlete.club_name);
                }
            });

            const extractedAgeCategories = new Set<string>();
            [...usawRankingsLocal, ...iwfRankingsLocal].forEach((athlete) => {
                const ageCategory = athlete.age_category || "";
                if (ageCategory.includes("11 Under")) extractedAgeCategories.add("11 Under Age Group");
                else if (ageCategory.includes("13 Under")) extractedAgeCategories.add("13 Under Age Group");
                else if (ageCategory.includes("14-15")) extractedAgeCategories.add("14-15 Age Group");
                else if (ageCategory.includes("16-17")) extractedAgeCategories.add("16-17 Age Group");
                else if (ageCategory.includes("Junior")) extractedAgeCategories.add("Junior (15-20)");
                else if (ageCategory.includes("Masters (35-39)")) extractedAgeCategories.add("Masters (35-39)");
                else if (ageCategory.includes("Masters (40-44)")) extractedAgeCategories.add("Masters (40-44)");
                else if (ageCategory.includes("Masters (45-49)")) extractedAgeCategories.add("Masters (45-49)");
                else if (ageCategory.includes("Masters (50-54)")) extractedAgeCategories.add("Masters (50-54)");
                else if (ageCategory.includes("Masters (55-59)")) extractedAgeCategories.add("Masters (55-59)");
                else if (ageCategory.includes("Masters (60-64)")) extractedAgeCategories.add("Masters (60-64)");
                else if (ageCategory.includes("Masters (65-69)")) extractedAgeCategories.add("Masters (65-69)");
                else if (ageCategory.includes("Masters (70-74)")) extractedAgeCategories.add("Masters (70-74)");
                else if (ageCategory.includes("Masters (75-79)")) extractedAgeCategories.add("Masters (75-79)");
                else if (ageCategory.includes("Masters (75+)")) extractedAgeCategories.add("Masters (75+)");
                else if (ageCategory.includes("Masters (80+)")) extractedAgeCategories.add("Masters (80+)");
                else if (ageCategory.includes("Open")) extractedAgeCategories.add("Open / Senior (15+)");
            });

            function getWeightClassOrder(weightClass: string) {
                if (weightClass.includes("Women's")) return 1;
                if (weightClass.includes("Men's")) return 2;
                return 3;
            }

            const activeWeightClasses: string[] = [];
            const inactiveWeightClassesList: string[] = [];

            // Helper set for inactive check (since we have it as inactiveWeightClassesSet param or state)
            // But we need to use the passed set or the state. The param `inactiveWeightClassesSet` is passed to this function.
            // We'll use that.

            Array.from(weightClassCombinations).forEach((wc) => {
                if (inactiveWeightClassesSet.has(wc)) {
                    inactiveWeightClassesList.push(`(Inactive) ${wc}`);
                } else {
                    activeWeightClasses.push(wc);
                }
            });

            const sortWeightClasses = (classes: string[]) => {
                return classes.sort((a, b) => {
                    const cleanA = a.replace("(Inactive) ", "");
                    const cleanB = b.replace("(Inactive) ", "");
                    const aOrder = getWeightClassOrder(cleanA);
                    const bOrder = getWeightClassOrder(cleanB);
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    const aWeight = parseFloat(cleanA.split(" ").pop()?.replace(/[^\d.]/g, "") || "0") || 0;
                    const bWeight = parseFloat(cleanB.split(" ").pop()?.replace(/[^\d.]/g, "") || "0") || 0;
                    return aWeight - bWeight;
                });
            };

            const sortedWeightClasses = [
                ...sortWeightClasses(activeWeightClasses),
                ...sortWeightClasses(inactiveWeightClassesList),
            ];

            const ageCategoryOrder = [
                "11 Under Age Group", "13 Under Age Group", "14-15 Age Group", "16-17 Age Group",
                "Junior (15-20)", "Open / Senior (15+)",
                "Masters (35-39)", "Masters (40-44)", "Masters (45-49)", "Masters (50-54)",
                "Masters (55-59)", "Masters (60-64)", "Masters (65-69)", "Masters (70-74)",
                "Masters (75-79)", "Masters (75+)", "Masters (80+)",
            ];

            const sortedAgeCategories = Array.from(extractedAgeCategories).sort((a, b) => {
                const aIndex = ageCategoryOrder.indexOf(a);
                const bIndex = ageCategoryOrder.indexOf(b);
                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                if (aIndex !== -1) return -1;
                if (bIndex !== -1) return 1;
                return a.localeCompare(b);
            });

            setFilterOptions(prev => ({
                ...prev,
                wsoCategories: Array.from(wsoSet).sort(),
                countries: Array.from(countryMap.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
                ageCategories: sortedAgeCategories,
                weightClasses: sortedWeightClasses,
            }));

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // --- FILTER Logic ---

    // Helper function to determine age categories from numeric age
    function determineAgeCategoriesFromAge(age: number): string[] {
        const categories: string[] = [];

        if (age <= 11) categories.push("11 Under Age Group");
        if (age <= 13) categories.push("13 Under Age Group");
        if (age >= 14 && age <= 15) categories.push("14-15 Age Group");
        if (age >= 16 && age <= 17) categories.push("16-17 Age Group");
        if (age >= 15 && age <= 20) categories.push("Junior (15-20)");
        if (age >= 15) categories.push("Open / Senior (15+)");

        // Masters categories
        if (age >= 35 && age <= 39) categories.push("Masters (35-39)");
        if (age >= 40 && age <= 44) categories.push("Masters (40-44)");
        if (age >= 45 && age <= 49) categories.push("Masters (45-49)");
        if (age >= 50 && age <= 54) categories.push("Masters (50-54)");
        if (age >= 55 && age <= 59) categories.push("Masters (55-59)");
        if (age >= 60 && age <= 64) categories.push("Masters (60-64)");
        if (age >= 65 && age <= 69) categories.push("Masters (65-69)");
        if (age >= 70 && age <= 74) categories.push("Masters (70-74)");
        if (age >= 75 && age <= 79) categories.push("Masters (75-79)");
        if (age >= 75) categories.push("Masters (75+)");
        if (age >= 80) categories.push("Masters (80+)");

        return categories;
    }

    // Helper function to format selected years for display
    function formatSelectedYears(years: number[]): string {
        if (years.length === 0) {
            return "All Years (1998–" + new Date().getFullYear() + ")";
        }

        const sorted = [...years].sort((a, b) => b - a);

        // If 6 or fewer years, show all
        if (sorted.length <= 6) {
            return sorted.join(", ");
        }

        // If more than 6, show first 2, ellipsis, and last 2
        return `${sorted[0]}, ${sorted[1]}, […], ${sorted[sorted.length - 2]}, ${sorted[sorted.length - 1]}`;
    }

    // Helper to normalize weight class strings for comparison
    function normalizeWeightClass(wc: string): string {
        if (!wc) return "";
        let normalized = wc.toLowerCase().replace(/kg/g, "").trim();
        if (normalized.startsWith("+")) {
            normalized = normalized.substring(1) + "+";
        }
        return normalized;
    }

    function applyFilters() {
        let filtered = [...rankings];

        // FEDERATION
        if (filters.federation !== 'all') {
            filtered = filtered.filter(a => a.federation === filters.federation);
        }

        // GENDER
        if (filters.gender !== 'all') {
            filtered = filtered.filter(a => a.gender === filters.gender);
        }

        // AGE CAT
        if (filters.ageCategory !== 'all') {
            filtered = filtered.filter((athlete) => {
                // Use competition_age as primary source
                if (athlete.competition_age !== null && athlete.competition_age !== undefined) {
                    const athleteCategories = determineAgeCategoriesFromAge(athlete.competition_age);
                    return athleteCategories.includes(filters.ageCategory);
                }
                // Fallback to age_category string
                if (athlete.age_category) {
                    return athlete.age_category === filters.ageCategory || athlete.age_category.includes(filters.ageCategory);
                }
                return false;
            });
        }

        // WEIGHT CLASSES (Current + Historical)
        const allSelectedWeightClasses = [
            ...filters.selectedWeightClasses,
            ...filters.selectedHistorical2018,
            ...filters.selectedHistorical1998,
        ].map(normalizeWeightClass);

        if (allSelectedWeightClasses.length > 0) {
            filtered = filtered.filter((athlete) => {
                const weightClass = normalizeWeightClass(athlete.weight_class || "");
                return allSelectedWeightClasses.includes(weightClass);
            });
        }

        // DATE
        if (filters.startDate) filtered = filtered.filter(a => new Date(a.last_competition) >= new Date(filters.startDate));
        if (filters.endDate) filtered = filtered.filter(a => new Date(a.last_competition) <= new Date(filters.endDate));

        // WSO (Only if not IWF)
        if (!['iwf', 'iwf_one_per_country'].includes(filters.federation)) {
            if (filters.selectedWSO.length > 0) {
                const wsoSet = new Set(filters.selectedWSO.map(w => w.toLowerCase().trim()));
                filtered = filtered.filter(a => a.federation === 'usaw' && wsoSet.has((a.wso || "").toLowerCase().trim()));
            }
        }

        // COUNTRY (IWF only)
        if (['iwf', 'iwf_one_per_country'].includes(filters.federation) && filters.selectedCountries.length > 0) {
            const countrySet = new Set(filters.selectedCountries);
            filtered = filtered.filter(a => countrySet.has(a.country_code || ""));
        }

        setFilteredRankings(filtered);
    }

    // EXPORT FUNCTION
    const handleExport = async () => {
        setExporting(true);
        try {
            const timestamp = new Date().toISOString().slice(0, 10);
            let allRows: any[] = [];

            // 1. Process USAW Data (Fetch full details from DB)
            const usawIds = filteredRankings
                .filter(r => r.federation === 'usaw')
                .map(r => r.unique_id.split('-')[1]) // unique_id is "usaw-{result_id}-{index}"
                .filter(id => id && !isNaN(Number(id)));

            if (usawIds.length > 0) {
                console.log(`Fetching details for ${usawIds.length} USAW records...`);
                const BATCH_SIZE = 1000;

                // We'll collect all results and lifter details separately to avoid join issues
                let resultsData: any[] = [];
                let lifterIdsToFetch = new Set<string>();

                // 1. Fetch Meet Results
                for (let i = 0; i < usawIds.length; i += BATCH_SIZE) {
                    const batchIds = usawIds.slice(i, i + BATCH_SIZE);
                    const { data, error } = await supabase
                        .from("usaw_meet_results")
                        .select("*")
                        .in('result_id', batchIds);

                    if (error) {
                        console.error("Supabase Error during USAW results fetch:", JSON.stringify(error, null, 2));
                        throw new Error(`Supabase Error (Results): ${error.message}`);
                    }
                    if (data) {
                        resultsData.push(...data);
                        data.forEach(r => {
                            if (r.lifter_id) lifterIdsToFetch.add(String(r.lifter_id));
                        });
                    }
                }

                // 2. Fetch Lifter Details
                const lifterInfoMap = new Map<string, any>();
                const lifterIds = Array.from(lifterIdsToFetch);

                for (let i = 0; i < lifterIds.length; i += BATCH_SIZE) {
                    const batch = lifterIds.slice(i, i + BATCH_SIZE);
                    const { data: liftersData, error: lifterError } = await supabase
                        .from("usaw_lifters")
                        .select(`lifter_id, membership_number, state`)
                        .in('lifter_id', batch);

                    if (lifterError) {
                        console.warn("Error fetching lifter details, continuing without them:", lifterError);
                    } else if (liftersData) {
                        liftersData.forEach((l: any) => lifterInfoMap.set(String(l.lifter_id), l));
                    }
                }

                // 3. Merge and Transform
                resultsData.forEach(r => {
                    const lifter = lifterInfoMap.get(String(r.lifter_id));
                    // Inject lifter info into the result object "usaw_lifters" property to match expected transform structure
                    // OR just pass both to the transform function. 
                    // Let's modify the result object to look like the join result expected by transformUsawForExport
                    r.usaw_lifters = lifter || {};
                    allRows.push(transformUsawForExport(r));
                });
            }

            // 2. Process IWF Data (Use existing data or fetch if table available)
            const iwfItems = filteredRankings.filter(r => r.federation === 'iwf');
            if (iwfItems.length > 0) {
                console.log(`Fetching details for ${iwfItems.length} IWF records...`);
                // Check if iwf_meet_results table exists by trying a small select
                // Or just try to select and fallback if error
                const iwfIds = iwfItems.map(r => r.unique_id.split('-')[1]);

                // Note: 'iwf_meet_results' might not exist or schema differs. 
                // Wrapping in try/catch to ensure fallback works.
                try {
                    const { data: iwfData, error: iwfError } = await supabase
                        .from("iwf_meet_results")
                        .select("*")
                        .in('result_id', iwfIds);

                    if (iwfError) throw iwfError;

                    if (iwfData) {
                        allRows.push(...iwfData.map(transformIwfForExport));
                    } else {
                        throw new Error("No IWF data returned");
                    }
                } catch (iwfErr) {
                    console.warn("Could not fetch detailed IWF data, falling back to basic info:", iwfErr);
                    allRows.push(...iwfItems.map(transformIwfFromState));
                }
            }

            console.log(`Generated ${allRows.length} rows for export.`);
            // GENERATE CSV
            generateCSV(allRows);

        } catch (e: any) {
            console.error("Export failed with error object:", e);
            // Attempt to extract meaningful message
            let msg = "Unknown error";
            if (e instanceof Error) msg = e.message;
            else if (typeof e === 'string') msg = e;
            else if (typeof e === 'object') msg = JSON.stringify(e);

            setError(`Export failed: ${msg}`);
        } finally {
            setExporting(false);
        }
    };

    const transformUsawForExport = (r: any) => ({
        "Source": "USAW",
        "Lifter Name": r.lifter_name,
        "Membership #": r.usaw_lifters?.membership_number || r.membership_number || "",
        "State": r.usaw_lifters?.state || "",
        "Date": new Date(r.date).toLocaleDateString(),
        "Meet Name": r.meet_name,
        "Meet Location": r.location || "",
        "Gender": r.gender,
        "Age Category": r.age_category,
        "Weight Class": r.weight_class,
        "Body Weight": r.body_weight_kg,
        "Snatch 1": r.snatch_lift_1 || "",
        "Snatch 2": r.snatch_lift_2 || "",
        "Snatch 3": r.snatch_lift_3 || "",
        "Best Snatch": r.best_snatch,
        "C&J 1": r.cj_lift_1 || "",
        "C&J 2": r.cj_lift_2 || "",
        "C&J 3": r.cj_lift_3 || "",
        "Best C&J": r.best_cj,
        "Total": r.total,
        "Q Points": r.qpoints?.toFixed(3) || "",
        "Q Youth": r.q_youth?.toFixed(3) || "",
        "Q Masters": r.q_masters?.toFixed(3) || "",
        "Comp Age": r.competition_age || "",
        "WSO": r.wso || "",
        "Club": r.club_name || ""
    });

    const transformIwfForExport = (r: any) => ({
        "Source": "IWF",
        "Lifter Name": r.lifter_name,
        "Membership #": "",
        "State": "",
        "Date": new Date(r.date).toLocaleDateString(),
        "Meet Name": r.meet_name,
        "Meet Location": "", // IWF might not have this column normalized
        "Gender": r.gender,
        "Age Category": r.age_category,
        "Weight Class": r.weight_class,
        "Body Weight": r.body_weight_kg,
        "Snatch 1": r.snatch_1 || "",
        "Snatch 2": r.snatch_2 || "",
        "Snatch 3": r.snatch_3 || "",
        "Best Snatch": r.best_snatch,
        "C&J 1": r.cj_1 || "",
        "C&J 2": r.cj_2 || "",
        "C&J 3": r.cj_3 || "",
        "Best C&J": r.best_cj,
        "Total": r.total,
        "Q Points": r.qpoints?.toFixed(3) || "",
        "Q Youth": "",
        "Q Masters": "",
        "Comp Age": r.competition_age || "",
        "WSO": "",
        "Club": "",
        "Country": r.nation || ""
    });

    const transformIwfFromState = (r: AthleteRanking) => ({
        "Source": "IWF",
        "Lifter Name": r.lifter_name,
        "Membership #": "",
        "State": "",
        "Date": new Date(r.last_competition).toLocaleDateString(),
        "Meet Name": r.last_meet_name,
        "Meet Location": "",
        "Gender": r.gender,
        "Age Category": r.age_category || "",
        "Weight Class": r.weight_class || "",
        "Body Weight": r.last_body_weight || "",
        "Snatch 1": "",
        "Snatch 2": "",
        "Snatch 3": "",
        "Best Snatch": r.best_snatch,
        "C&J 1": "",
        "C&J 2": "",
        "C&J 3": "",
        "Best C&J": r.best_cj,
        "Total": r.best_total,
        "Q Points": r.best_qpoints?.toFixed(3) || "",
        "Q Youth": "",
        "Q Masters": "",
        "Comp Age": r.competition_age || "",
        "WSO": "",
        "Club": "",
        "Country": r.country_code || ""
    });

    const generateCSV = (data: any[]) => {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(","),
            ...data.map(row => headers.map(header => {
                const val = row[header as keyof typeof row];
                return `"${String(val).replace(/"/g, '""')}"`;
            }).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `weightlifting-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AuthGuard requireAnyRole={[ROLES.ADMIN, ROLES.RESEARCHER, ROLES.USAW_NATIONAL_TEAM_COACH]}>
            <div className="min-h-screen bg-app-gradient">
                {/* Header */}
                <header className="bg-header-blur border-b border-app-secondary sticky top-0 z-10 backdrop-blur-md">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Link href="/" className="p-2 hover:bg-app-tertiary rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-app-primary" />
                                </Link>
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-xl">
                                        <Database className="h-6 w-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold text-app-primary">Data Export Hub</h1>
                                        <p className="text-xs text-app-tertiary">Admin Database Access</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="space-y-8">

                        {/* FILTERS PANEL */}
                        <div className="w-full">
                            <div className="bg-app-secondary rounded-xl p-5 border border-app-primary shadow-sm">
                                <h2 className="text-sm font-bold text-app-sidebar-header uppercase tracking-wider mb-4 flex items-center">
                                    <Filter className="h-4 w-4 mr-2" />
                                    Filters
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Federation */}
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Federation
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowFederationDropdown(!showFederationDropdown)}
                                            className="w-full h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                                        >
                                            <span>
                                                {filters.federation === "usaw" && "USAW"}
                                                {filters.federation === "iwf" && "IWF"}
                                            </span>
                                            <ChevronDown className={`h-4 w-4 transition-transform ${showFederationDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showFederationDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowFederationDropdown(false)} />
                                                <div className="absolute z-20 mt-1 w-full bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFilters(prev => ({ ...prev, federation: "usaw" }));
                                                            setShowFederationDropdown(false);
                                                        }}
                                                        className={`w-full px-3 py-2 text-left hover:bg-app-hover first:rounded-t-lg ${filters.federation === "usaw" ? "bg-app-tertiary" : ""
                                                            }`}
                                                    >
                                                        USAW
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFilters(prev => ({ ...prev, federation: "iwf", selectedWSO: [] }));
                                                            setShowFederationDropdown(false);
                                                        }}
                                                        className={`w-full px-3 py-2 text-left hover:bg-app-hover last:rounded-b-lg ${filters.federation === "iwf" ? "bg-app-tertiary" : ""
                                                            }`}
                                                    >
                                                        IWF
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Gender */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Gender
                                        </label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setShowGenderDropdown(!showGenderDropdown)}
                                                className="w-full h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                                            >
                                                <span>
                                                    {filters.gender === "all" && "All Genders"}
                                                    {filters.gender === "M" && "Male"}
                                                    {filters.gender === "F" && "Female"}
                                                </span>
                                                <ChevronDown className={`h-4 w-4 transition-transform ${showGenderDropdown ? 'rotate-180' : ''}`} />
                                            </button>

                                            {showGenderDropdown && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setShowGenderDropdown(false)} />
                                                    <div className="absolute z-20 mt-1 w-full bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({ ...prev, gender: "all" }));
                                                                setShowGenderDropdown(false);
                                                            }}
                                                            className={`w-full px-3 py-2 text-left hover:bg-app-hover first:rounded-t-xl ${filters.gender === "all" ? "bg-app-tertiary" : ""
                                                                }`}
                                                        >
                                                            All Genders
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({ ...prev, gender: "M" }));
                                                                setShowGenderDropdown(false);
                                                            }}
                                                            className={`w-full px-3 py-2 text-left hover:bg-app-hover ${filters.gender === "M" ? "bg-app-tertiary" : ""
                                                                }`}
                                                        >
                                                            Male
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({ ...prev, gender: "F" }));
                                                                setShowGenderDropdown(false);
                                                            }}
                                                            className={`w-full px-3 py-2 text-left hover:bg-app-hover last:rounded-b-xl ${filters.gender === "F" ? "bg-app-tertiary" : ""
                                                                }`}
                                                        >
                                                            Female
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Age Category */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Age Category
                                        </label>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setShowAgeCategoryDropdown(!showAgeCategoryDropdown)}
                                                className="w-full h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                                            >
                                                <span className="truncate">{filters.ageCategory === "all" ? "All Age Categories" : filters.ageCategory}</span>
                                                <ChevronDown className={`h-4 w-4 flex-shrink-0 ml-1 transition-transform ${showAgeCategoryDropdown ? 'rotate-180' : ''}`} />
                                            </button>

                                            {showAgeCategoryDropdown && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setShowAgeCategoryDropdown(false)} />
                                                    <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({ ...prev, ageCategory: "all" }));
                                                                setShowAgeCategoryDropdown(false);
                                                            }}
                                                            className={`w-full px-3 py-2 text-left hover:bg-app-hover first:rounded-t-xl ${filters.ageCategory === "all" ? "bg-app-tertiary" : ""
                                                                }`}
                                                        >
                                                            All Age Categories
                                                        </button>
                                                        {filterOptions.ageCategories.map((ac) => (
                                                            <button
                                                                key={ac}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, ageCategory: ac }));
                                                                    setShowAgeCategoryDropdown(false);
                                                                }}
                                                                className={`w-full px-3 py-2 text-left hover:bg-app-hover ${filters.ageCategory === ac ? "bg-app-tertiary" : ""
                                                                    }`}
                                                            >
                                                                {ac}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Current Weight Classes - Multi-select */}
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Current Weight Classes
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowWeightClassDropdown(!showWeightClassDropdown)}
                                            className="w-full h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                                        >
                                            <span>
                                                {filters.selectedWeightClasses.length === 0
                                                    ? "All Weight Classes"
                                                    : `${filters.selectedWeightClasses.length} selected`}
                                            </span>
                                            <ChevronDown className={`h-4 w-4 transition-transform ${showWeightClassDropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showWeightClassDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowWeightClassDropdown(false)} />
                                                <div className="absolute z-10 mt-1 w-full max-h-96 overflow-y-auto bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                    {/* Select/Deselect All */}
                                                    <div className="sticky top-0 bg-app-surface border-b border-app-primary p-2 flex justify-between items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    selectedWeightClasses: [
                                                                        ...CURRENT_WEIGHT_CLASSES.Women,
                                                                        ...CURRENT_WEIGHT_CLASSES.Men
                                                                    ]
                                                                }));
                                                            }}
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Select All
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    selectedWeightClasses: []
                                                                }));
                                                            }}
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>

                                                    {/* Two-column layout: Women | Men */}
                                                    <div className="grid grid-cols-2 gap-0 divide-x divide-app-primary">
                                                        {/* Women's Column */}
                                                        <div>
                                                            <div className="px-3 py-2 bg-app-tertiary text-xs font-semibold text-app-tertiary text-center">
                                                                Women
                                                            </div>
                                                            <div className="p-2">
                                                                {CURRENT_WEIGHT_CLASSES.Women.map((weight) => (
                                                                    <label
                                                                        key={`women-${weight}`}
                                                                        className="flex items-center px-2 py-1.5 hover:bg-app-hover rounded cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={filters.selectedWeightClasses.includes(weight)}
                                                                            onChange={(e) => {
                                                                                const newSelected = e.target.checked
                                                                                    ? [...filters.selectedWeightClasses, weight]
                                                                                    : filters.selectedWeightClasses.filter(w => w !== weight);
                                                                                setFilters(prev => ({
                                                                                    ...prev,
                                                                                    selectedWeightClasses: newSelected
                                                                                }));
                                                                            }}
                                                                            className="mr-2 accent-blue-500"
                                                                        />
                                                                        <span className="text-sm text-app-secondary">{weight}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Men's Column */}
                                                        <div>
                                                            <div className="px-3 py-2 bg-app-tertiary text-xs font-semibold text-app-tertiary text-center">
                                                                Men
                                                            </div>
                                                            <div className="p-2">
                                                                {CURRENT_WEIGHT_CLASSES.Men.map((weight) => (
                                                                    <label
                                                                        key={`men-${weight}`}
                                                                        className="flex items-center px-2 py-1.5 hover:bg-app-hover rounded cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={filters.selectedWeightClasses.includes(weight)}
                                                                            onChange={(e) => {
                                                                                const newSelected = e.target.checked
                                                                                    ? [...filters.selectedWeightClasses, weight]
                                                                                    : filters.selectedWeightClasses.filter(w => w !== weight);
                                                                                setFilters(prev => ({
                                                                                    ...prev,
                                                                                    selectedWeightClasses: newSelected
                                                                                }));
                                                                            }}
                                                                            className="mr-2 accent-blue-500"
                                                                        />
                                                                        <span className="text-sm text-app-secondary">{weight}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Historical Weight Classes (2018-2025) - Multi-select */}
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Historical Weight Classes (2018-2025)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowHistorical2018Dropdown(!showHistorical2018Dropdown)}
                                            className="w-full h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                                        >
                                            <span>
                                                {filters.selectedHistorical2018.length === 0
                                                    ? "All Weight Classes"
                                                    : `${filters.selectedHistorical2018.length} selected`}
                                            </span>
                                            <ChevronDown className={`h-4 w-4 transition-transform ${showHistorical2018Dropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showHistorical2018Dropdown && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowHistorical2018Dropdown(false)} />
                                                <div className="absolute z-10 mt-1 w-full max-h-96 overflow-y-auto bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                    {/* Select/Deselect All */}
                                                    <div className="sticky top-0 bg-app-surface border-b border-app-primary p-2 flex justify-between items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    selectedHistorical2018: [
                                                                        ...HISTORICAL_2018_2025_WEIGHT_CLASSES.Women,
                                                                        ...HISTORICAL_2018_2025_WEIGHT_CLASSES.Men
                                                                    ]
                                                                }));
                                                            }}
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Select All
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    selectedHistorical2018: []
                                                                }));
                                                            }}
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>

                                                    {/* Two-column layout: Women | Men */}
                                                    <div className="grid grid-cols-2 gap-0 divide-x divide-app-primary">
                                                        {/* Women's Column */}
                                                        <div>
                                                            <div className="px-3 py-2 bg-app-tertiary text-xs font-semibold text-app-tertiary text-center">
                                                                Women
                                                            </div>
                                                            <div className="p-2">
                                                                {HISTORICAL_2018_2025_WEIGHT_CLASSES.Women.map((weight) => (
                                                                    <label
                                                                        key={`hist2018-women-${weight}`}
                                                                        className="flex items-center px-2 py-1.5 hover:bg-app-hover rounded cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={filters.selectedHistorical2018.includes(weight)}
                                                                            onChange={(e) => {
                                                                                const newSelected = e.target.checked
                                                                                    ? [...filters.selectedHistorical2018, weight]
                                                                                    : filters.selectedHistorical2018.filter(w => w !== weight);
                                                                                setFilters(prev => ({
                                                                                    ...prev,
                                                                                    selectedHistorical2018: newSelected
                                                                                }));
                                                                            }}
                                                                            className="mr-2 accent-blue-500"
                                                                        />
                                                                        <span className="text-sm text-app-secondary">{weight}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Men's Column */}
                                                        <div>
                                                            <div className="px-3 py-2 bg-app-tertiary text-xs font-semibold text-app-tertiary text-center">
                                                                Men
                                                            </div>
                                                            <div className="p-2">
                                                                {HISTORICAL_2018_2025_WEIGHT_CLASSES.Men.map((weight) => (
                                                                    <label
                                                                        key={`hist2018-men-${weight}`}
                                                                        className="flex items-center px-2 py-1.5 hover:bg-app-hover rounded cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={filters.selectedHistorical2018.includes(weight)}
                                                                            onChange={(e) => {
                                                                                const newSelected = e.target.checked
                                                                                    ? [...filters.selectedHistorical2018, weight]
                                                                                    : filters.selectedHistorical2018.filter(w => w !== weight);
                                                                                setFilters(prev => ({
                                                                                    ...prev,
                                                                                    selectedHistorical2018: newSelected
                                                                                }));
                                                                            }}
                                                                            className="mr-2 accent-blue-500"
                                                                        />
                                                                        <span className="text-sm text-app-secondary">{weight}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Historical Weight Classes (1998-2018) - Multi-select */}
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Historical Weight Classes (1998-2018)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowHistorical1998Dropdown(!showHistorical1998Dropdown)}
                                            className="w-full h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                                        >
                                            <span>
                                                {filters.selectedHistorical1998.length === 0
                                                    ? "All Weight Classes"
                                                    : `${filters.selectedHistorical1998.length} selected`}
                                            </span>
                                            <ChevronDown className={`h-4 w-4 transition-transform ${showHistorical1998Dropdown ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showHistorical1998Dropdown && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowHistorical1998Dropdown(false)} />
                                                <div className="absolute z-10 mt-1 w-full max-h-96 overflow-y-auto bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                    {/* Select/Deselect All */}
                                                    <div className="sticky top-0 bg-app-surface border-b border-app-primary p-2 flex justify-between items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    selectedHistorical1998: [
                                                                        ...HISTORICAL_1998_2018_WEIGHT_CLASSES.Women,
                                                                        ...HISTORICAL_1998_2018_WEIGHT_CLASSES.Men
                                                                    ]
                                                                }));
                                                            }}
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Select All
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters(prev => ({
                                                                    ...prev,
                                                                    selectedHistorical1998: []
                                                                }));
                                                            }}
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>

                                                    {/* Two-column layout: Women | Men */}
                                                    <div className="grid grid-cols-2 gap-0 divide-x divide-app-primary">
                                                        {/* Women's Column */}
                                                        <div>
                                                            <div className="px-3 py-2 bg-app-tertiary text-xs font-semibold text-app-tertiary text-center">
                                                                Women
                                                            </div>
                                                            <div className="p-2">
                                                                {HISTORICAL_1998_2018_WEIGHT_CLASSES.Women.map((weight) => (
                                                                    <label
                                                                        key={`hist1998-women-${weight}`}
                                                                        className="flex items-center px-2 py-1.5 hover:bg-app-hover rounded cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={filters.selectedHistorical1998.includes(weight)}
                                                                            onChange={(e) => {
                                                                                const newSelected = e.target.checked
                                                                                    ? [...filters.selectedHistorical1998, weight]
                                                                                    : filters.selectedHistorical1998.filter(w => w !== weight);
                                                                                setFilters(prev => ({
                                                                                    ...prev,
                                                                                    selectedHistorical1998: newSelected
                                                                                }));
                                                                            }}
                                                                            className="mr-2 accent-blue-500"
                                                                        />
                                                                        <span className="text-sm text-app-secondary">{weight}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Men's Column */}
                                                        <div>
                                                            <div className="px-3 py-2 bg-app-tertiary text-xs font-semibold text-app-tertiary text-center">
                                                                Men
                                                            </div>
                                                            <div className="p-2">
                                                                {HISTORICAL_1998_2018_WEIGHT_CLASSES.Men.map((weight) => (
                                                                    <label
                                                                        key={`hist1998-men-${weight}`}
                                                                        className="flex items-center px-2 py-1.5 hover:bg-app-hover rounded cursor-pointer"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={filters.selectedHistorical1998.includes(weight)}
                                                                            onChange={(e) => {
                                                                                const newSelected = e.target.checked
                                                                                    ? [...filters.selectedHistorical1998, weight]
                                                                                    : filters.selectedHistorical1998.filter(w => w !== weight);
                                                                                setFilters(prev => ({
                                                                                    ...prev,
                                                                                    selectedHistorical1998: newSelected
                                                                                }));
                                                                            }}
                                                                            className="mr-2 accent-blue-500"
                                                                        />
                                                                        <span className="text-sm text-app-secondary">{weight}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Years dropdown with multi-select checkboxes */}
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">
                                            Years
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowYearDropdown((prev) => !prev)}
                                            className="w-full flex items-center justify-between h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <span className="truncate">
                                                {formatSelectedYears(filters.selectedYears)}
                                            </span>
                                            <span className="ml-2 text-xs text-gray-300 flex-shrink-0">
                                                {showYearDropdown ? "▲" : "▼"}
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
                                                                const currentYear = new Date().getFullYear();
                                                                const allYears = Array.from(
                                                                    { length: currentYear - 1998 + 1 },
                                                                    (_, i) => currentYear - i
                                                                );
                                                                setFilters((prev) => ({
                                                                    ...prev,
                                                                    selectedYears: allYears,
                                                                }));
                                                            }}
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Select All
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setFilters((prev) => ({
                                                                    ...prev,
                                                                    selectedYears: [],
                                                                }))
                                                            }
                                                            className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                        >
                                                            Clear
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {Array.from(
                                                            { length: new Date().getFullYear() - 1998 + 1 },
                                                            (_, i) => new Date().getFullYear() - i
                                                        ).map((year) => {
                                                            const checked =
                                                                filters.selectedYears.includes(year);
                                                            return (
                                                                <label
                                                                    key={year}
                                                                    className="flex items-center space-x-2 text-sm text-app-secondary cursor-pointer hover:bg-app-hover p-1 rounded transition-colors"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => {
                                                                            setFilters((prev) => {
                                                                                const exists =
                                                                                    prev.selectedYears.includes(year);
                                                                                return {
                                                                                    ...prev,
                                                                                    selectedYears: exists
                                                                                        ? prev.selectedYears.filter(
                                                                                            (y) => y !== year
                                                                                        )
                                                                                        : [...prev.selectedYears, year],
                                                                                };
                                                                            });
                                                                        }}
                                                                        className="h-3 w-3 accent-blue-500 flex-shrink-0 cursor-pointer"
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
                                    <div className="min-w-0">
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Date Range</label>
                                        <div className="flex items-center space-x-1">
                                            <input
                                                type="date"
                                                value={filters.startDate}
                                                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                                className="w-32 h-10 px-1.5 text-xs bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-gray-400 text-xs">–</span>
                                            <input
                                                type="date"
                                                value={filters.endDate}
                                                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                                className="w-32 h-10 px-1.5 text-xs bg-app-tertiary border border-app-primary rounded-xl text-app-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Countries Filter */}
                                    <SearchableDropdown
                                        label="Countries"
                                        placeholder="All Countries"
                                        options={
                                            filters.federation === 'usaw'
                                                ? filterOptions.countries.filter(c => c.code === 'USA')
                                                : filterOptions.countries
                                        }
                                        selected={
                                            filters.federation === 'usaw' ? ['USA'] : filters.selectedCountries
                                        }
                                        onSelect={(selected) => {
                                            if (filters.federation === 'usaw') return;
                                            setFilters(prev => ({ ...prev, selectedCountries: selected }))
                                        }}
                                        disabled={filters.federation === 'usaw'}
                                        getValue={(country) => country.code}
                                        getLabel={(country) => country.name}
                                        renderOption={(country) => {
                                            const FlagComponent = getCountryFlagComponent(country.code);
                                            return (
                                                <div className="flex items-center space-x-2 truncate">
                                                    {FlagComponent && (
                                                        <div className="flex-shrink-0 w-5">
                                                            <FlagComponent style={{ width: '100%', height: 'auto' }} />
                                                        </div>
                                                    )}
                                                    <span className="truncate">{country.name}</span>
                                                </div>
                                            );
                                        }}
                                    />

                                    {/* WSO Filter (USAW) */}
                                    <SearchableDropdown
                                        label="WSO (USAW)"
                                        placeholder="All WSOs"
                                        options={filterOptions.wsoCategories}
                                        selected={filters.selectedWSO}
                                        onSelect={(selected) => setFilters(prev => ({ ...prev, selectedWSO: selected }))}
                                        getValue={(wso) => wso}
                                        getLabel={(wso) => wso}
                                        disabled={['iwf', 'iwf_one_per_country'].includes(filters.federation)}
                                    />

                                    {/* Link to Rankings or other note if needed? */}
                                </div>

                                <div className="flex justify-end mt-4">
                                    <button
                                        onClick={() => setFilters({
                                            gender: "all", ageCategory: "all", federation: "usaw",
                                            selectedYears: [2025], selectedCountries: [], selectedWeightClasses: [],
                                            selectedHistorical2018: [], selectedHistorical1998: [],
                                            startDate: "", endDate: "", selectedWSO: [],
                                            selectedClubs: [], bodyWeightMin: "", bodyWeightMax: "", searchTerm: ""
                                        })}
                                        className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                        <span>Clear Filters</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* MAIN CONTENT Area */}
                        <div className="w-full space-y-6">
                            {/* Status Card */}
                            <div className="bg-app-secondary rounded-xl border border-app-primary p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-app-primary">Export Preview</h3>
                                        <p className="text-sm text-app-tertiary mt-1">
                                            {loading ? 'Analyzing data...' : `${filteredRankings.length.toLocaleString()} records matched`}
                                        </p>
                                    </div>

                                    {!loading && (
                                        <button
                                            onClick={handleExport}
                                            disabled={exporting || filteredRankings.length === 0}
                                            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-blue-900/20"
                                        >
                                            {exporting ? (
                                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                            ) : (
                                                <Download className="h-5 w-5 mr-2" />
                                            )}
                                            {exporting ? "Generating..." : "Download Export CSV"}
                                        </button>
                                    )}
                                </div>

                                {/* Info / Warning Box */}
                                <div className="mt-6 bg-app-tertiary/30 rounded-lg p-4 flex items-start space-x-3">
                                    <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                                    <div className="text-sm text-app-secondary">
                                        <p className="font-medium text-blue-400 mb-1">About Data Exports</p>
                                        <p>
                                            Exports generate a flattened CSV file containing all filtered result rows from the database.
                                            The export includes detailed fields (lift attempts, membership info) which are not shown in this preview.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Placeholder for no results */}
                            {!loading && filteredRankings.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-app-muted">
                                    <Search className="h-12 w-12 mb-4 opacity-20" />
                                    <p>No records found matching current filters.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </main>
            </div>
        </AuthGuard>
    );
}
