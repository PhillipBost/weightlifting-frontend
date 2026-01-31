import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

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
    gamx_u: number | null;
    gamx_a: number | null;
    gamx_masters: number | null;
    gamx_total: number | null;
    gamx_s: number | null;
    gamx_j: number | null;
    wso: string | null;
    club_name: string | null;
}

async function generateUSAWRankingsForYear(year: number) {
    console.log(`\nGenerating USAW rankings for ${year}...`);

    try {
        let allResults: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        // Fetch all meet_results for this year (WITHOUT JOIN for performance)
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
                    gamx_u,
                    gamx_a,
                    gamx_masters,
                    gamx_total,
                    gamx_s,
                    gamx_j,
                    wso,
                    club_name
                `)
                .gte('date', `${year}-01-01`)
                .lte('date', `${year}-12-31`)
                .order('result_id', { ascending: true })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching results for ${year}: ${error.message}`);
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

        if (allResults.length === 0) {
            console.log(`  No results for ${year}, skipping file creation`);
            return;
        }

        // Fetch membership numbers separately in batches
        console.log('  Fetching membership numbers...');
        const uniqueLifterIds = [...new Set(allResults.map(r => r.lifter_id))];
        const lifterMap = new Map<number, { membership_number: number | null, wso: string | null, club_name: string | null }>();

        for (let i = 0; i < uniqueLifterIds.length; i += 1000) {
            const batch = uniqueLifterIds.slice(i, i + 1000);
            const { data: lifters, error } = await supabase
                .from('usaw_lifters')
                .select('lifter_id, membership_number, wso, club_name')
                .in('lifter_id', batch);

            if (!error && lifters) {
                lifters.forEach(l => lifterMap.set(l.lifter_id, {
                    membership_number: l.membership_number,
                    wso: l.wso,
                    club_name: l.club_name
                }));
            }
        }

        console.log(`  Fetched membership data for ${lifterMap.size} lifters`);

        // Process and clean up data
        const processedResults: USAWRankingResult[] = allResults.map(result => {
            // Get membership number from the lifterMap
            const lifterData = lifterMap.get(result.lifter_id);
            const membershipNumber = lifterData?.membership_number || null;
            const fallbackWso = lifterData?.wso || null;
            const fallbackClub = lifterData?.club_name || null;

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
                // Convert text fields to numbers
                best_snatch: parseFloat(result.best_snatch) || 0,
                best_cj: parseFloat(result.best_cj) || 0,
                total: parseFloat(result.total) || 0,
                qpoints: parseFloat(result.qpoints) || 0,
                q_youth: result.q_youth ? parseFloat(result.q_youth) : null,
                q_masters: result.q_masters ? parseFloat(result.q_masters) : null,
                gamx_u: result.gamx_u ? parseFloat(result.gamx_u) : null,
                gamx_a: result.gamx_a ? parseFloat(result.gamx_a) : null,
                gamx_masters: result.gamx_masters ? parseFloat(result.gamx_masters) : null,
                gamx_total: result.gamx_total ? parseFloat(result.gamx_total) : null,
                gamx_s: result.gamx_s ? parseFloat(result.gamx_s) : null,
                gamx_j: result.gamx_j ? parseFloat(result.gamx_j) : null,
                wso: result.wso || fallbackWso || null,
                club_name: result.club_name || fallbackClub || null,
            };
        });

        // Compress and save
        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `usaw-rankings-${year}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  Saved to ${outputPath}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${processedResults.length} results)`);

    } catch (err) {
        console.error(`Failed to generate rankings for ${year}:`, err);
        throw err;
    }
}

async function generateAllUSAWRankings() {
    console.log('Starting USAW rankings generation (2012-2025)...');

    const startYear = 2012;
    const endYear = 2025;

    try {
        for (let year = startYear; year <= endYear; year++) {
            await generateUSAWRankingsForYear(year);
        }

        console.log('\n✓ USAW rankings generation complete!');
    } catch (err) {
        console.error('\n✗ USAW rankings generation failed:', err);
        process.exit(1);
    }
}

generateAllUSAWRankings();
