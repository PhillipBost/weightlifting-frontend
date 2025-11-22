import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

const CURRENT_YEAR = new Date().getFullYear();

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
}

async function generateUSAWCurrentYear() {
    console.log(`\nGenerating USAW rankings for ${CURRENT_YEAR}...`);

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

        // First fetch all results without join (faster)
        while (hasMore) {
            const { data, error } = await supabase
                .from('meet_results')
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
                    q_masters
                `)
                .gte('date', `${CURRENT_YEAR}-01-01`)
                .lte('date', `${CURRENT_YEAR}-12-31`)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching results for ${CURRENT_YEAR}: ${error.message}`);
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

        // Get unique lifter IDs and fetch membership numbers
        console.log('  Fetching membership numbers...');
        const uniqueLifterIds = [...new Set(allResults.map(r => r.lifter_id))];
        const lifterMap = new Map();

        // Fetch membership numbers in batches
        for (let i = 0; i < uniqueLifterIds.length; i += 1000) {
            const batch = uniqueLifterIds.slice(i, i + 1000);
            const { data: lifters, error } = await supabase
                .from('lifters')
                .select('lifter_id, membership_number')
                .in('lifter_id', batch);

            if (!error && lifters) {
                lifters.forEach(l => lifterMap.set(l.lifter_id, l.membership_number));
            }
        }

        console.log(`  Fetched membership data for ${lifterMap.size} lifters`);

        console.log(`  Total results: ${allResults.length}`);

        if (allResults.length === 0) {
            console.log(`  No results for ${CURRENT_YEAR}, skipping file creation`);
            return;
        }

        const processedResults: USAWRankingResult[] = allResults.map(result => {
            const membershipNumber = lifterMap.get(result.lifter_id) || null;

            return {
                result_id: result.result_id,
                meet_id: result.meet_id,
                lifter_id: result.lifter_id,
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
                q_masters: result.q_masters ? parseFloat(result.q_masters) : null
            };
        });

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `usaw-rankings-${CURRENT_YEAR}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  ✓ Saved to public/data/usaw-rankings-${CURRENT_YEAR}.json.gz`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${processedResults.length} results)`);

    } catch (err) {
        console.error(`Failed to generate USAW rankings for ${CURRENT_YEAR}:`, err);
        throw err;
    }
}

async function generateIWFCurrentYear() {
    console.log(`\nGenerating IWF rankings for ${CURRENT_YEAR}...`);

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY;

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
                    q_masters
                `)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching results: ${error.message}`);
            }

            if (data && data.length > 0) {
                // Filter by year - parse dates like "Nov 10, 1998"
                const yearResults = data.filter(result => {
                    if (!result.date) return false;
                    const dateYear = result.date.trim().slice(-4);
                    return dateYear === CURRENT_YEAR.toString();
                });

                allResults.push(...yearResults);
                console.log(`  Fetched ${allResults.length} results for ${CURRENT_YEAR}...`);
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
            console.log(`  No results for ${CURRENT_YEAR}, skipping file creation`);
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
                q_masters: result.q_masters ? parseFloat(result.q_masters) : null
            };
        });

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `iwf-rankings-${CURRENT_YEAR}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  ✓ Saved to public/data/iwf-rankings-${CURRENT_YEAR}.json.gz`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${processedResults.length} results)`);

    } catch (err) {
        console.error(`Failed to generate IWF rankings for ${CURRENT_YEAR}:`, err);
        throw err;
    }
}

async function main() {
    console.log(`🚀 Generating rankings for current year (${CURRENT_YEAR})...`);
    console.log('━'.repeat(50));

    try {
        await generateUSAWCurrentYear();
        await generateIWFCurrentYear();

        console.log('\n' + '━'.repeat(50));
        console.log(`✓ Current year rankings generation complete!`);
        console.log(`  Files created:`);
        console.log(`    - public/data/usaw-rankings-${CURRENT_YEAR}.json.gz`);
        console.log(`    - public/data/iwf-rankings-${CURRENT_YEAR}.json.gz`);
    } catch (err) {
        console.error('\n✗ Rankings generation failed:', err);
        process.exit(1);
    }
}

main();
