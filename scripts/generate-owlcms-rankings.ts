import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

export interface OWLCMSRankingResult {
    result_id: number;
    meet_id: number;
    lifter_id: number;
    membership_number: string | null;
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
    gamx_sm: number | null;
    gamx_jm: number | null;
    country_code?: string | null;
    club_name?: string | null;
    snatch_1?: string | number | null;
    snatch_2?: string | number | null;
    snatch_3?: string | number | null;
    cj_1?: string | number | null;
    cj_2?: string | number | null;
    cj_3?: string | number | null;
}

interface OWLCMSMeetRow {
    meet_id: number;
    meet_name: string;
    start_date: string;
}

function parseNumeric(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return Number.isFinite(n) ? n : null;
}

export async function generateOWLCMSRankingsForYear(
    year: number,
    preloadedMeets?: OWLCMSMeetRow[]
): Promise<void> {
    console.log(`\nGenerating OWLCMS rankings for ${year}...`);

    try {
        let meetsForYear = preloadedMeets;
        if (!meetsForYear) {
            const { data: meetsData, error: meetsError } = await supabase
                .from('owlcms_meets')
                .select('meet_id, meet_name, start_date')
                .gte('start_date', `${year}-01-01`)
                .lte('start_date', `${year}-12-31`);

            if (meetsError) throw meetsError;
            meetsForYear = (meetsData || []) as OWLCMSMeetRow[];
        }

        if (meetsForYear.length === 0) {
            console.log(`  No OWLCMS meets found for ${year}, skipping.`);
            return;
        }

        const meetMap = new Map<number, OWLCMSMeetRow>();
        meetsForYear.forEach(m => meetMap.set(m.meet_id, m));
        const meetIds = Array.from(meetMap.keys());

        let allResults: any[] = [];
        const MEET_BATCH_SIZE = 50;
        const PAGE_SIZE = 1000;

        for (let i = 0; i < meetIds.length; i += MEET_BATCH_SIZE) {
            const meetBatch = meetIds.slice(i, i + MEET_BATCH_SIZE);
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('owlcms_meet_results')
                    .select(`
                        result_id,
                        meet_id,
                        lifter_id,
                        body_weight_kg,
                        category,
                        snatch_1,
                        snatch_2,
                        snatch_3,
                        best_snatch,
                        cj_1,
                        cj_2,
                        cj_3,
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
                        gamx_sm,
                        gamx_jm,
                        lifter:owlcms_lifters (
                            athlete_name,
                            gender,
                            birth_year,
                            country_code,
                            club_name,
                            membership_number
                        )
                    `)
                    .in('meet_id', meetBatch)
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allResults = allResults.concat(data);
                    page++;
                    hasMore = data.length === PAGE_SIZE;
                } else {
                    hasMore = false;
                }
            }
        }

        console.log(`  Total OWLCMS results fetched for ${year}: ${allResults.length}`);

        const processedResults: OWLCMSRankingResult[] = allResults.map(result => {
            const meet = meetMap.get(result.meet_id);
            const lifter = Array.isArray(result.lifter) ? result.lifter[0] : result.lifter;
            const startDate = meet?.start_date || `${year}-01-01`;
            const compAge = lifter?.birth_year
                ? year - Number(lifter.birth_year)
                : null;

            return {
                result_id: result.result_id,
                meet_id: result.meet_id,
                lifter_id: result.lifter_id,
                membership_number: lifter?.membership_number || null,
                lifter_name: lifter?.athlete_name || 'Unknown',
                gender: lifter?.gender || '',
                weight_class: result.category || '',
                age_category: '',
                date: startDate,
                meet_name: meet?.meet_name || `Meet #${result.meet_id}`,
                body_weight_kg: result.body_weight_kg != null ? String(result.body_weight_kg) : '',
                competition_age: compAge,
                best_snatch: parseNumeric(result.best_snatch) || 0,
                best_cj: parseNumeric(result.best_cj) || 0,
                total: parseNumeric(result.total) || 0,
                qpoints: parseNumeric(result.qpoints) || 0,
                q_youth: parseNumeric(result.q_youth),
                q_masters: parseNumeric(result.q_masters),
                gamx_u: parseNumeric(result.gamx_u),
                gamx_a: parseNumeric(result.gamx_a),
                gamx_masters: parseNumeric(result.gamx_masters),
                gamx_total: parseNumeric(result.gamx_total),
                gamx_s: parseNumeric(result.gamx_s),
                gamx_j: parseNumeric(result.gamx_j),
                gamx_sm: parseNumeric(result.gamx_sm),
                gamx_jm: parseNumeric(result.gamx_jm),
                country_code: lifter?.country_code || null,
                club_name: lifter?.club_name || null,
                snatch_1: result.snatch_1 ?? null,
                snatch_2: result.snatch_2 ?? null,
                snatch_3: result.snatch_3 ?? null,
                cj_1: result.cj_1 ?? null,
                cj_2: result.cj_2 ?? null,
                cj_3: result.cj_3 ?? null
            };
        });

        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const jsonData = JSON.stringify(processedResults);
        const compressed = gzipSync(jsonData);

        const outputPath = path.join(dataDir, `owlcms-rankings-${year}.json.gz`);
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`  Saved to ${outputPath}`);
        console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB (${processedResults.length} results)`);
    } catch (err) {
        console.error(`Failed to generate OWLCMS rankings for ${year}:`, err);
        throw err;
    }
}

async function generateAllOWLCMSRankings() {
    console.log('Starting OWLCMS rankings generation (all years)...');

    try {
        const { data: meets, error } = await supabase
            .from('owlcms_meets')
            .select('meet_id, meet_name, start_date');

        if (error) throw error;

        const meetsByYear = new Map<number, OWLCMSMeetRow[]>();
        (meets || []).forEach((meet: any) => {
            if (!meet.start_date) return;
            const year = new Date(meet.start_date).getFullYear();
            if (Number.isNaN(year)) return;
            const list = meetsByYear.get(year) || [];
            list.push(meet as OWLCMSMeetRow);
            meetsByYear.set(year, list);
        });

        const years = Array.from(meetsByYear.keys()).sort((a, b) => a - b);
        console.log(`Found OWLCMS meets in years: ${years.join(', ') || 'none'}`);

        for (const year of years) {
            await generateOWLCMSRankingsForYear(year, meetsByYear.get(year));
        }

        console.log('\n✓ OWLCMS rankings generation complete!');
    } catch (err) {
        console.error('\n✗ OWLCMS rankings generation failed:', err);
        process.exit(1);
    }
}

const isDirectRun = process.argv[1]?.includes('generate-owlcms-rankings');
if (isDirectRun) {
    generateAllOWLCMSRankings();
}
