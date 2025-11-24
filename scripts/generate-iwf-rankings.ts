import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing IWF Supabase environment variables (NEXT_PUBLIC_SUPABASE_IWF_URL, NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

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

async function generateIWFRankingsForYear(year: number) {
    console.log(`\nGenerating IWF rankings for ${year}...`);

    try {
        let allResults: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        // Fetch all iwf_meet_results for this year
        // IWF dates are formatted like "Nov 10, 1998" so we need to filter differently
        // We'll fetch all results and filter by year in JavaScript since the date format makes SQL filtering complex

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
                    country_code,
                    country_name,
                    iwf_lifters!inner(iwf_lifter_id)
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

                    // Extract year from date string (last 4 characters)
                    const dateYear = result.date.trim().slice(-4);
                    return dateYear === year.toString();
                });

                allResults.push(...yearResults);
                console.log(`  Fetched ${allResults.length} results for ${year}...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`  Total results: ${allResults.length}`);

        if (allResults.length === 0) {
            console.log(`  No results for ${year}, skipping file creation`);
            return;
        }

        // Process and clean up data
        const processedResults: IWFRankingResult[] = allResults.map(result => {
            // Handle nested iwf_lifters object
            const iwfLifterId = result.iwf_lifters?.iwf_lifter_id || null;

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
                // Convert text fields to numbers
                best_snatch: parseFloat(result.best_snatch) || 0,
                best_cj: parseFloat(result.best_cj) || 0,
                total: parseFloat(result.total) || 0,
                qpoints: parseFloat(result.qpoints) || 0,
                q_youth: result.q_youth ? parseFloat(result.q_youth) : null,
                q_masters: result.q_masters ? parseFloat(result.q_masters) : null,
                country_code: result.country_code,
                country_name: result.country_name
            };
        });

        // Compress and save
        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `iwf-rankings-${year}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  Saved to ${outputPath}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${processedResults.length} results)`);

    } catch (err) {
        console.error(`Failed to generate rankings for ${year}:`, err);
        throw err;
    }
}

async function generateAllIWFRankings() {
    console.log('Starting IWF rankings generation (1998-2025)...');

    const startYear = 1998;
    const endYear = 2025;

    try {
        for (let year = startYear; year <= endYear; year++) {
            await generateIWFRankingsForYear(year);
        }

        console.log('\n✓ IWF rankings generation complete!');
    } catch (err) {
        console.error('\n✗ IWF rankings generation failed:', err);
        process.exit(1);
    }
}

generateAllIWFRankings();
