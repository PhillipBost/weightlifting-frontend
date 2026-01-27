import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

const CURRENT_YEAR = new Date().getFullYear();

// Prioritize CLI argument over environment variable
const TARGET_YEAR_ARG = process.argv[2];
const TARGET_YEAR_ENV = process.env.RANKINGS_YEAR;

// Helper to validate year is a 4-digit number
const isValidYear = (val: any): val is number => {
    const num = Number(val);
    return Number.isFinite(num) && num >= 1900 && num <= 2100;
};

// Try CLI arg first, then env var, then fall back to current year
let TARGET_YEAR = CURRENT_YEAR;

if (TARGET_YEAR_ARG && isValidYear(TARGET_YEAR_ARG)) {
    TARGET_YEAR = Number(TARGET_YEAR_ARG);
    console.log(`Using year from CLI argument: ${TARGET_YEAR}`);
} else if (TARGET_YEAR_ENV && isValidYear(TARGET_YEAR_ENV)) {
    TARGET_YEAR = Number(TARGET_YEAR_ENV);
    console.log(`Using year from RANKINGS_YEAR env: ${TARGET_YEAR}`);
} else {
    console.log(`Using current year: ${TARGET_YEAR}`);
}

interface USAWRankingResult {
    result_id: number;
    meet_id: number;
    lifter_id: number;
    internal_id: number | null; // Added internal_id
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
    // Added lift attempts
    snatch_1: string | null;
    snatch_2: string | null;
    snatch_3: string | null;
    cj_1: string | null;
    cj_2: string | null;
    cj_3: string | null;
    club_name: string | null;
    wso: string | null;
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
    // Added lift attempts
    snatch_1: string | null;
    snatch_2: string | null;
    snatch_3: string | null;
    cj_1: string | null;
    cj_2: string | null;
    cj_3: string | null;
    country_code: string;
    country_name: string;
}

interface WSOData {
    wso_id: number;
    name: string;
    active_status: boolean | null;
    geographic_type: string | null;
    states: string[] | null;
    counties: string[] | null;
    estimated_population: number | null;
    population_estimate: number | null;
    geographic_center_lat: number | null;
    geographic_center_lng: number | null;
    territory_geojson: any;
    active_lifters_count: number | null;
    recent_meets_count: number | null;
    barbell_clubs_count: number | null;
    activity_factor: number | null;
    total_participations: number | null;
    contact_email: string | null;
    official_url: string | null;
    notes: string | null;
    analytics_updated_at: string | null;
}

interface ClubData {
    club_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    wso_geography: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    geocode_display_name: string | null;
    geocode_success: boolean | null;
    geocode_strategy_used: string | null;
    geocode_precision_score: number | null;
    active_lifters_count: number | null;
    recent_meets_count: number | null;
    activity_factor: number | null;
    total_participations: number | null;
    elevation_meters: number | null;
    elevation_source: string | null;
    analytics_updated_at: string | null;
}

async function generateUSAWCurrentYear() {
    console.log(`\nGenerating USAW rankings for ${TARGET_YEAR}...`);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing USAW Supabase environment variables');
        throw new Error('Missing USAW credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        let allResults: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        // Fetch all results with club_name and wso_geography
        while (hasMore) {
            const { data, error } = await supabase
                .from('usaw_meet_results')
                .select(`
                    result_id,
                    meet_id,
                    lifter_id,
                    lifter_name,
                    gender,
                    weight_class,
                    age_category,
                    date,
                    meet_name,
                    body_weight_kg,
                    competition_age,
                    best_snatch,
                    best_cj,
                    total,
                    qpoints,
                    q_youth,
                    q_masters,
                    snatch_lift_1,
                    snatch_lift_2,
                    snatch_lift_3,
                    cj_lift_1,
                    cj_lift_2,
                    cj_lift_3,
                    club_name,
                    wso
                `)
                .gte('date', `${TARGET_YEAR}-01-01`)
                .lte('date', `${TARGET_YEAR}-12-31`)
                .order('result_id', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching results for ${TARGET_YEAR}: ${error.message}`);
            }

            if (data && data.length > 0) {
                allResults.push(...data);
                console.log(`  Fetched ${allResults.length} results...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`  Total results: ${allResults.length}`);

        // Get unique lifter IDs and fetch membership numbers AND internal_id
        console.log('  Fetching membership numbers and internal IDs...');
        const uniqueLifterIds = [...new Set(allResults.map(r => r.lifter_id))];
        const lifterMap = new Map<string, { membership_number: number | null, internal_id: number | null }>();

        // Fetch membership numbers in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < uniqueLifterIds.length; i += BATCH_SIZE) {
            const batch = uniqueLifterIds.slice(i, i + BATCH_SIZE);
            const { data: lifters, error } = await supabase
                .from('usaw_lifters')
                .select('lifter_id, membership_number, internal_id')
                .in('lifter_id', batch);

            if (!error && lifters) {
                lifters.forEach(l => lifterMap.set(String(l.lifter_id), {
                    membership_number: l.membership_number,
                    internal_id: l.internal_id
                }));
            }
        }

        console.log(`  Fetched membership data for ${lifterMap.size} lifters. Unique IDs in results: ${uniqueLifterIds.length}.`);

        console.log(`  Total results: ${allResults.length}`);

        if (allResults.length === 0) {
            console.log(`  No results for ${TARGET_YEAR}, skipping file creation`);
            return;
        }

        let matchCount = 0;
        let missCount = 0;

        const processedResults: USAWRankingResult[] = allResults.map(result => {
            const resultLifterIdStr = String(result.lifter_id);
            const lifterData = lifterMap.get(resultLifterIdStr);

            if (lifterData) {
                matchCount++;
            } else {
                missCount++;
                if (missCount <= 5) {
                    console.log(`  [WARN] Missing lifter data for ID: ${result.lifter_id} (Type: ${typeof result.lifter_id})`);
                }
            }

            const membershipNumber = lifterData ? lifterData.membership_number : null;
            const internalId = lifterData ? lifterData.internal_id : null;

            return {
                result_id: result.result_id,
                meet_id: result.meet_id,
                lifter_id: result.lifter_id,
                internal_id: internalId,
                membership_number: membershipNumber,
                lifter_name: result.lifter_name,
                gender: result.gender,
                weight_class: result.weight_class,
                age_category: result.age_category,
                date: result.date,
                meet_name: result.meet_name,
                body_weight_kg: result.body_weight_kg,
                competition_age: result.competition_age,
                best_snatch: parseFloat(result.best_snatch) || 0,
                best_cj: parseFloat(result.best_cj) || 0,
                total: parseFloat(result.total) || 0,
                qpoints: parseFloat(result.qpoints) || 0,
                q_youth: result.q_youth ? parseFloat(result.q_youth) : null,
                q_masters: result.q_masters ? parseFloat(result.q_masters) : null,
                snatch_1: result.snatch_lift_1 || null,
                snatch_2: result.snatch_lift_2 || null,
                snatch_3: result.snatch_lift_3 || null,
                cj_1: result.cj_lift_1 || null,
                cj_2: result.cj_lift_2 || null,
                cj_3: result.cj_lift_3 || null,
                club_name: result.club_name || null,
                wso: result.wso || null
            };
        });

        console.log(`  Ranking Generation Stats: ${matchCount} Matches, ${missCount} Misses.`);

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `usaw-rankings-${TARGET_YEAR}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  ✓ Saved to public/data/usaw-rankings-${TARGET_YEAR}.json.gz`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${processedResults.length} results)`);

    } catch (err) {
        console.error(`Failed to generate USAW rankings for ${TARGET_YEAR}:`, err);
        throw err;
    }
}

async function generateIWFCurrentYear() {
    console.log(`\nGenerating IWF rankings for ${TARGET_YEAR}...`);

    // After database migration, IWF and USAW data are in the same database
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing IWF Supabase environment variables');
        throw new Error('Missing IWF credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        let allResults: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        // First fetch all results without join (faster)
        while (hasMore) {
            const { data, error } = await supabase
                .from('iwf_meet_results')
                .select(`
                    db_result_id,
                    db_meet_id,
                    db_lifter_id,
                    lifter_name,
                    gender,
                    weight_class,
                    age_category,
                    date,
                    meet_name,
                    body_weight_kg,
                    competition_age,
                    best_snatch,
                    best_cj,
                    total,
                    qpoints,
                    q_youth,
                    q_masters,
                    snatch_lift_1,
                    snatch_lift_2,
                    snatch_lift_3,
                    cj_lift_1,
                    cj_lift_2,
                    cj_lift_3,
                    country_code,
                    country_name
                `)
                .order('db_result_id', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching results: ${error.message}`);
            }

            if (data && data.length > 0) {
                // Filter by year - parse dates like "Nov 10, 1998"
                const yearResults = data.filter(result => {
                    if (!result.date) return false;
                    const dateYear = result.date.trim().slice(-4);
                    return dateYear === TARGET_YEAR.toString();
                });

                allResults.push(...yearResults);
                console.log(`  Fetched ${allResults.length} results for ${TARGET_YEAR}...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`  Total results: ${allResults.length}`);

        // Get unique lifter IDs and fetch IWF lifter IDs
        console.log('  Fetching IWF lifter IDs...');
        const uniqueLifterIds = [...new Set(allResults.map(r => r.db_lifter_id))];
        const lifterMap = new Map();

        // Fetch IWF lifter IDs in batches
        for (let i = 0; i < uniqueLifterIds.length; i += 1000) {
            const batch = uniqueLifterIds.slice(i, i + 1000);
            const { data: lifters, error } = await supabase
                .from('iwf_lifters')
                .select('db_lifter_id, iwf_lifter_id')
                .in('db_lifter_id', batch);

            if (!error && lifters) {
                lifters.forEach(l => lifterMap.set(l.db_lifter_id, l.iwf_lifter_id));
            }
        }

        console.log(`  Fetched IWF lifter data for ${lifterMap.size} lifters`);

        console.log(`  Total results: ${allResults.length}`);

        if (allResults.length === 0) {
            console.log(`  No results for ${TARGET_YEAR}, skipping file creation`);
            return;
        }

        const processedResults: IWFRankingResult[] = allResults.map(result => {
            const iwfLifterId = lifterMap.get(result.db_lifter_id) || null;

            return {
                db_result_id: result.db_result_id,
                db_meet_id: result.db_meet_id,
                db_lifter_id: result.db_lifter_id,
                iwf_lifter_id: iwfLifterId,
                lifter_name: result.lifter_name,
                gender: result.gender,
                weight_class: result.weight_class,
                age_category: result.age_category,
                date: result.date,
                meet_name: result.meet_name,
                body_weight_kg: result.body_weight_kg,
                competition_age: result.competition_age,
                best_snatch: parseFloat(result.best_snatch) || 0,
                best_cj: parseFloat(result.best_cj) || 0,
                total: parseFloat(result.total) || 0,
                qpoints: parseFloat(result.qpoints) || 0,
                q_youth: result.q_youth ? parseFloat(result.q_youth) : null,
                q_masters: result.q_masters ? parseFloat(result.q_masters) : null,
                snatch_1: result.snatch_lift_1 || null,
                snatch_2: result.snatch_lift_2 || null,
                snatch_3: result.snatch_lift_3 || null,
                cj_1: result.cj_lift_1 || null,
                cj_2: result.cj_lift_2 || null,
                cj_3: result.cj_lift_3 || null,
                country_code: result.country_code || "",
                country_name: result.country_name || ""
            };
        });

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `iwf-rankings-${TARGET_YEAR}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  ✓ Saved to public/data/iwf-rankings-${TARGET_YEAR}.json.gz`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${processedResults.length} results)`);

    } catch (err) {
        console.error(`Failed to generate IWF rankings for ${TARGET_YEAR}:`, err);
        throw err;
    }
}

async function generateWSOCurrentYear() {
    console.log(`\nGenerating WSO data for ${TARGET_YEAR}...`);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing USAW Supabase environment variables');
        throw new Error('Missing USAW credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Fetch all WSO information
        const { data: wsoData, error: wsoError } = await supabase
            .from('usaw_wso_information')
            .select(`
                wso_id,
                name,
                active_status,
                geographic_type,
                states,
                counties,
                estimated_population,
                population_estimate,
                geographic_center_lat,
                geographic_center_lng,
                territory_geojson,
                active_lifters_count,
                recent_meets_count,
                barbell_clubs_count,
                activity_factor,
                total_participations,
                contact_email,
                official_url,
                notes,
                analytics_updated_at
            `)
            .order('name', { ascending: true });

        if (wsoError) {
            throw new Error(`Error fetching WSO data: ${wsoError.message}`);
        }

        console.log(`  Total WSO records: ${wsoData?.length || 0}`);

        if (!wsoData || wsoData.length === 0) {
            console.log(`  No WSO data available, skipping file creation`);
            return;
        }

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(wsoData);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `wso-data-${TARGET_YEAR}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  ✓ Saved to public/data/wso-data-${TARGET_YEAR}.json.gz`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${wsoData.length} WSO records)`);

    } catch (err) {
        console.error(`Failed to generate WSO data for ${TARGET_YEAR}:`, err);
        throw err;
    }
}

async function generateClubsCurrentYear() {
    console.log(`\nGenerating Barbell Club data for ${TARGET_YEAR}...`);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing USAW Supabase environment variables');
        throw new Error('Missing USAW credentials');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        let allClubs: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        // Fetch all club data in batches
        while (hasMore) {
            const { data, error } = await supabase
                .from('usaw_clubs')
                .select(`
                    club_name,
                    address,
                    phone,
                    email,
                    wso_geography,
                    state,
                    latitude,
                    longitude,
                    geocode_display_name,
                    geocode_success,
                    geocode_strategy_used,
                    geocode_precision_score,
                    active_lifters_count,
                    recent_meets_count,
                    activity_factor,
                    total_participations,
                    elevation_meters,
                    elevation_source,
                    analytics_updated_at
                `)
                .order('club_name', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching clubs: ${error.message}`);
            }

            if (data && data.length > 0) {
                allClubs.push(...data);
                console.log(`  Fetched ${allClubs.length} clubs...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`  Total clubs: ${allClubs.length}`);

        if (allClubs.length === 0) {
            console.log(`  No club data available, skipping file creation`);
            return;
        }

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(allClubs);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `barbell-clubs-${TARGET_YEAR}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  ✓ Saved to public/data/barbell-clubs-${TARGET_YEAR}.json.gz`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${allClubs.length} clubs)`);

        // Also generate active clubs only (clubs with recent activity)
        const activeClubs = allClubs.filter(club =>
            club.active_lifters_count && club.active_lifters_count > 0
        );

        if (activeClubs.length > 0) {
            const activeJsonData = JSON.stringify(activeClubs);
            const activeCompressed = gzipSync(activeJsonData);

            const activeOutputPath = path.join(dataDir, `active-barbell-clubs-${TARGET_YEAR}.json.gz`);
            await fs.writeFile(activeOutputPath, activeCompressed);

            const activeStats = await fs.stat(activeOutputPath);
            console.log(`  ✓ Saved to public/data/active-barbell-clubs-${TARGET_YEAR}.json.gz`);
            console.log(`  Size: ${(activeStats.size / 1024).toFixed(2)} KB (${activeClubs.length} active clubs)`);
        }

    } catch (err) {
        console.error(`Failed to generate club data for ${TARGET_YEAR}:`, err);
        throw err;
    }
}

async function main() {
    console.log(`🚀 Generating rankings and organizational data for target year (${TARGET_YEAR})...`);
    console.log('━'.repeat(50));

    try {
        await generateUSAWCurrentYear();
        await generateIWFCurrentYear();
        await generateWSOCurrentYear();
        await generateClubsCurrentYear();

        console.log('\n' + '━'.repeat(50));
        console.log(`✓ Current year data generation complete!`);
        console.log(`  Files created:`);
        console.log(`    - public/data/usaw-rankings-${TARGET_YEAR}.json.gz`);
        console.log(`    - public/data/iwf-rankings-${TARGET_YEAR}.json.gz`);
        console.log(`    - public/data/wso-data-${TARGET_YEAR}.json.gz`);
        console.log(`    - public/data/barbell-clubs-${TARGET_YEAR}.json.gz`);
        console.log(`    - public/data/active-barbell-clubs-${TARGET_YEAR}.json.gz`);
    } catch (err) {
        console.error('\n✗ Data generation failed:', err);
        process.exit(1);
    }
}

main();
