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
    Info
} from "lucide-react";
import { getCountryFlagComponent } from "../utils/countryFlags";
import { SearchableDropdown } from "../components/SearchableDropdown";

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

    // State for filters
    const [filters, setFilters] = useState({
        searchTerm: "",
        gender: "all",
        ageCategory: "all",
        federation: "usaw",
        selectedYears: [2025] as number[],
        selectedCountries: [] as string[],
        selectedWeightClasses: [] as string[],
        startDate: "",
        endDate: "",
        selectedWSO: [] as string[],
        selectedClubs: [] as string[],
    });

    // Filter options (populated from data)
    const [filterOptions, setFilterOptions] = useState({
        weightClasses: [] as string[],
        ageCategories: [] as string[],
        countries: [] as { code: string; name: string }[],
        wsoCategories: [] as string[],
        barbellClubs: [] as string[],
    });

    const [inactiveWeightClasses, setInactiveWeightClasses] = useState<Set<string>>(new Set());

    // UI States for filter dropdowns
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [showFederationDropdown, setShowFederationDropdown] = useState(false);

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

            setFilterOptions(prev => ({
                ...prev,
                wsoCategories: Array.from(wsoSet).sort(),
                barbellClubs: Array.from(clubSet).sort(),
                countries: Array.from(countryMap.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name))
            }));

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    // --- FILTER Logic ---
    function applyFilters() {
        let filtered = [...rankings];

        // SEARCH
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(a =>
                a.lifter_name.toLowerCase().includes(term) ||
                (a.club_name && a.club_name.toLowerCase().includes(term)) ||
                (a.meet_id && a.meet_id.toString().includes(term))
            );
        }

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
            filtered = filtered.filter(a => a.age_category === filters.ageCategory);
        }

        // DATE
        if (filters.startDate) filtered = filtered.filter(a => new Date(a.last_competition) >= new Date(filters.startDate));
        if (filters.endDate) filtered = filtered.filter(a => new Date(a.last_competition) <= new Date(filters.endDate));

        // WSO & CLUB
        if (filters.selectedWSO.length > 0) {
            const wsoSet = new Set(filters.selectedWSO.map(w => w.toLowerCase().trim()));
            filtered = filtered.filter(a => a.federation === 'usaw' && wsoSet.has((a.wso || "").toLowerCase().trim()));
        }

        if (filters.selectedClubs.length > 0) {
            const clubSet = new Set(filters.selectedClubs.map(c => c.toLowerCase()));
            filtered = filtered.filter(a => a.federation === 'usaw' && clubSet.has((a.club_name || "").toLowerCase()));
        }

        // COUNTRY (IWF only)
        if (filters.federation === 'iwf' && filters.selectedCountries.length > 0) {
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
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                        {/* FILTERS PANEL */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-app-secondary rounded-xl p-5 border border-app-primary shadow-sm sticky top-24">
                                <h2 className="text-sm font-bold text-app-sidebar-header uppercase tracking-wider mb-4 flex items-center">
                                    <Filter className="h-4 w-4 mr-2" />
                                    Filters
                                </h2>

                                <div className="space-y-4">
                                    {/* Years */}
                                    <div>
                                        <label className="text-xs font-semibold text-app-tertiary mb-1.5 block">Year(s)</label>
                                        <div className="space-y-2 relative">
                                            <div
                                                onClick={() => setShowYearDropdown(!showYearDropdown)}
                                                className="w-full px-3 py-2 bg-app-tertiary rounded-xl border border-app-primary text-sm text-app-primary cursor-pointer flex justify-between items-center"
                                            >
                                                <span>{filters.selectedYears.length > 5 ? `${filters.selectedYears.length} Years Selected` : filters.selectedYears.join(", ")}</span>
                                                <Filter className="h-3 w-3 opacity-50" />
                                            </div>

                                            {showYearDropdown && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onClick={() => setShowYearDropdown(false)}
                                                    />
                                                    <div className="absolute z-20 mt-1 w-full p-2 bg-app-surface border border-app-primary rounded-xl max-h-48 overflow-y-auto shadow-lg">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const allYears = Array.from({ length: 2026 - 1998 }, (_, i) => 2025 - i);
                                                                    setFilters(prev => ({ ...prev, selectedYears: allYears }));
                                                                }}
                                                                className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                            >
                                                                Select All
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setFilters(prev => ({ ...prev, selectedYears: [] }))
                                                                }
                                                                className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary"
                                                            >
                                                                Clear
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-1">
                                                            {Array.from({ length: 2026 - 1998 }, (_, i) => 2025 - i).map(year => (
                                                                <button
                                                                    key={year}
                                                                    onClick={() => {
                                                                        const exists = filters.selectedYears.includes(year);
                                                                        const newYears = exists
                                                                            ? filters.selectedYears.filter(y => y !== year)
                                                                            : [...filters.selectedYears, year];
                                                                        setFilters(prev => ({ ...prev, selectedYears: newYears.sort((a, b) => b - a) }));
                                                                    }}
                                                                    className={`px-2 py-1 text-xs rounded ${filters.selectedYears.includes(year) ? 'bg-blue-600 text-white' : 'hover:bg-app-hover text-app-secondary'}`}
                                                                >
                                                                    {year}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Gender */}
                                    <div>
                                        <label className="text-xs font-semibold text-app-tertiary mb-1.5 block">Gender</label>
                                        <div className="relative">
                                            <div
                                                onClick={() => setShowGenderDropdown(!showGenderDropdown)}
                                                className="w-full px-3 py-2 bg-app-tertiary rounded-xl border border-app-primary text-sm text-app-primary cursor-pointer flex justify-between items-center"
                                            >
                                                <span>
                                                    {filters.gender === "all" && "All Genders"}
                                                    {filters.gender === "Men's" && "Men"}
                                                    {filters.gender === "Women's" && "Women"}
                                                </span>
                                                <Filter className="h-3 w-3 opacity-50" />
                                            </div>

                                            {showGenderDropdown && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onClick={() => setShowGenderDropdown(false)}
                                                    />
                                                    <div className="absolute z-20 mt-1 w-full bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                        {[
                                                            { value: "all", label: "All Genders" },
                                                            { value: "Men's", label: "Men" },
                                                            { value: "Women's", label: "Women" }
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, gender: opt.value }));
                                                                    setShowGenderDropdown(false);
                                                                }}
                                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-app-hover first:rounded-t-xl last:rounded-b-xl ${filters.gender === opt.value ? 'bg-app-tertiary' : ''}`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Federation */}
                                    <div>
                                        <label className="text-xs font-semibold text-app-tertiary mb-1.5 block">Federation</label>
                                        <div className="relative">
                                            <div
                                                onClick={() => setShowFederationDropdown(!showFederationDropdown)}
                                                className="w-full px-3 py-2 bg-app-tertiary rounded-xl border border-app-primary text-sm text-app-primary cursor-pointer flex justify-between items-center"
                                            >
                                                <span>
                                                    {filters.federation === "usaw" && "USA Weightlifting (USAW)"}
                                                    {filters.federation === "iwf" && "International (IWF)"}
                                                </span>
                                                <Filter className="h-3 w-3 opacity-50" />
                                            </div>

                                            {showFederationDropdown && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onClick={() => setShowFederationDropdown(false)}
                                                    />
                                                    <div className="absolute z-20 mt-1 w-full bg-app-surface border border-app-primary rounded-xl shadow-lg">
                                                        {[
                                                            { value: "usaw", label: "USA Weightlifting (USAW)" },
                                                            { value: "iwf", label: "International (IWF)" }
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => {
                                                                    setFilters(prev => ({ ...prev, federation: opt.value }));
                                                                    setShowFederationDropdown(false);
                                                                }}
                                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-app-hover first:rounded-t-xl last:rounded-b-xl ${filters.federation === opt.value ? 'bg-app-tertiary' : ''}`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Country */}
                                    <div>
                                        {filters.federation === 'usaw' ? (
                                            <div className="w-full px-3 py-2 bg-app-tertiary/50 rounded-xl border border-app-primary/50 text-sm text-app-tertiary cursor-not-allowed flex items-center">
                                                United States
                                            </div>
                                        ) : (
                                            <SearchableDropdown
                                                label="Country"
                                                placeholder="All Countries"
                                                options={filterOptions.countries}
                                                selected={filters.selectedCountries}
                                                onSelect={(selected) => setFilters(prev => ({ ...prev, selectedCountries: selected }))}
                                                getValue={(item) => item.code}
                                                getLabel={(item) => item.name}
                                                renderOption={(item) => {
                                                    const FlagComponent = getCountryFlagComponent(item.code);
                                                    return (
                                                        <div className="flex items-center space-x-2 truncate">
                                                            {FlagComponent && (
                                                                <div className="flex-shrink-0 w-5">
                                                                    <FlagComponent style={{ width: '100%', height: 'auto' }} />
                                                                </div>
                                                            )}
                                                            <span className="truncate">{item.name}</span>
                                                        </div>
                                                    );
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Reset */}
                                    <button
                                        onClick={() => setFilters({
                                            searchTerm: "", gender: "all", ageCategory: "all", federation: "usaw",
                                            selectedYears: [2025], selectedCountries: [], selectedWeightClasses: [],
                                            startDate: "", endDate: "", selectedWSO: [], selectedClubs: []
                                        })}
                                        className="w-full py-2 flex items-center justify-center space-x-2 text-xs font-medium text-app-muted hover:text-red-400 transition-colors border border-dashed border-app-tertiary rounded-xl hover:border-red-400/30"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        <span>Reset Filters</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* MAIN CONTENT Area */}
                        <div className="lg:col-span-3 space-y-6">
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
