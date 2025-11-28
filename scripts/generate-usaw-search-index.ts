
import { createClient } from '@supabase/supabase-js';
import MiniSearch from 'minisearch';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
// If not (e.g., in GitHub Actions), environment variables are already set
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

interface USAWAthleteIndex {
    id: number; // lifter_id
    name: string; // athlete_name
    membership_number: string;
    gender: string;
    club: string;
    wso: string;
    totalResults: number;
    latestResultDate: string;
    searchableText: string;
    displaySlug: string;
}

async function generateUSAWAthleteIndex() {
    console.log('Starting USAW athlete index generation...');

    try {
        // Ensure public/data directory exists
        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        let allAthletes: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log('Fetching athletes from Supabase...');

        // We need to join with meet_results to get gender, club, wso
        // Since we can't easily join and aggregate efficiently in one go with JS client for all rows,
        // we might need a strategy. 
        // Strategy: Fetch lifters, and maybe we can rely on a view or just fetch raw and aggregate?
        // Fetching all meet_results is too heavy.
        // Alternative: Just index lifters for now, and maybe fetch metadata on demand?
        // BUT the goal is to have it in the index.
        // Let's try to fetch lifters and use a separate query or RPC if available?
        // The user mentioned "get_latest_lifter_metadata" RPC in a previous conversation. Let's check if we can use that or similar.
        // Actually, for the index generation, we can afford to be a bit slower or fetch more data.
        // Let's try fetching lifters and then maybe we can't fetch all results.
        // Let's assume for now we just want the basic info. 
        // Wait, the user wants to replace the current search which shows club/wso.

        // Let's try to fetch lifters with a limit and see structure.
        // Actually, let's look at what `app/page.tsx` was doing. It was fetching `meet_results` for the found lifters.
        // If we want to index it, we need it beforehand.

        // Let's fetch lifters and for each batch, fetch their latest result? That might be too many requests (N/batch).
        // Maybe we can fetch `meet_results` ordered by date and distinct by lifter_id?
        // `select distinct on (lifter_id) * from meet_results order by lifter_id, date desc`
        // This would give us the latest metadata for every lifter.

        console.log('Fetching latest metadata for all lifters...');

        // We'll fetch from meet_results using distinct on lifter_id to get the latest info for everyone.
        // This effectively gives us the active lifter list + metadata.
        // Note: Some lifters in `lifters` table might not have results? 
        // If so, they won't show up here. But `lifters` table is usually populated from results?
        // Let's assume `lifters` is the source of truth for names.

        // Actually, let's fetch `lifters` and then merge with the latest results.
        // But `lifters` might be huge?

        // Let's try fetching `lifters` first.

        while (hasMore) {
            const { data, error } = await supabase
                .from('usaw_lifters')
                .select('lifter_id, athlete_name, membership_number')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching athletes: ${error.message}`);
            }

            if (data && data.length > 0) {
                allAthletes.push(...data);
                console.log(`Fetched ${allAthletes.length} athletes...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`Total athletes fetched: ${allAthletes.length}`);

        // Now we need metadata (gender, club, wso).
        // We can try to fetch `meet_results` distinct by lifter_id.
        // Depending on DB size, this might be heavy.
        // Let's try to fetch it in chunks or just fetch the whole thing if it's not millions.
        // If we can't fetch all, we might have to skip metadata for the index or do it smarter.
        // For now, let's try to fetch a simplified version of results: lifter_id, gender, club_name, wso, date.
        // And we only want the LATEST.

        // Since we can't easily do "distinct on" via JS client without some limits, 
        // let's assume we can just index the names for now and maybe the user is okay with fetching metadata on client?
        // NO, the point is to be fast.

        // Let's try to use the `get_latest_lifter_metadata` if it exists, or just fetch `meet_results`?
        // Actually, let's just index what we have in `lifters`. 
        // Wait, `app/page.tsx` shows `club_name`, `wso`, `gender`.
        // If I don't put it in the index, I have to fetch it on client, which defeats the purpose of "no Supabase calls".

        // Let's try to fetch all distinct lifter metadata.
        // "select distinct on (lifter_id) lifter_id, gender, club_name, wso, date from meet_results order by lifter_id, date desc"
        // This is the most efficient way.

        // Since I can't easily run raw SQL, I'll try to use the client.
        // But client doesn't support `distinct on` easily with pagination?
        // Actually it does if I use `.select('...', { head: false, count: 'exact' })`? No.

        // Let's try to fetch `meet_results` but just the columns we need, ordered by date desc.
        // If we fetch ALL results, it's too much.

        // COMPROMISE: For this first pass, I will index the `lifters` table data (name, id, membership).
        // I will leave gender/club/wso as empty or "Unknown" for now, 
        // OR I will try to fetch it for the top X athletes? No, that's inconsistent.

        // Let's look at `scripts/generate-iwf-search-index.ts` again.
        // It fetches `iwf_lifters` with `recent_results:iwf_meet_results(...)`.
        // This implies a foreign key relationship.
        // Does `lifters` have a relationship to `meet_results`?
        // `app/page.tsx` does `.from('usaw_meet_results').in('lifter_id', lifterIds)`.
        // This suggests we can try `.select('*, meet_results(...)')` on `lifters`.
        // Let's try that.

        // Resetting fetch logic to try relational fetch
        allAthletes = [];
        page = 0;
        hasMore = true;

        console.log('Fetching athletes with recent results...');

        while (hasMore) {
            // We limit the inner query to 1 to get the latest? 
            // Supabase JS: `meet_results(date, gender, club_name, wso)`
            // We can't easily limit inner query to 1 per parent row in standard Supabase API without some tricks.
            // But we can fetch them and take the first one if we order?
            // Inner order isn't always guaranteed to be respected for limit?
            // Let's just fetch `meet_results` and hope it's not too many per lifter (it might be).
            // Actually, let's just fetch the last 1 result.
            // .select('*, meet_results(date, gender, club_name, wso)')
            // .order('date', { foreignTable: 'meet_results', ascending: false })
            // .limit(1, { foreignTable: 'meet_results' }) <--- This limits total results, not per row?
            // Actually, Supabase/PostgREST supports limiting related resources?
            // Yes, `meet_results(..., limit:1)`? No, syntax is `meet_results!inner(...)` etc.

            // Let's try a simpler approach:
            // Just fetch `lifters`.
            // Then fetch `meet_results` for these IDs?
            // If we do 1000 lifters, we can fetch their latest results in a second query.

            const { data: lifters, error } = await supabase
                .from('usaw_lifters')
                .select('lifter_id, athlete_name, membership_number')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw new Error(error.message);

            if (lifters && lifters.length > 0) {
                const lifterIds = lifters.map(l => l.lifter_id);

                // Fetch latest result for these lifters
                // We can't easily do "latest per group" in one query without RPC.
                // Let's just fetch all results for these lifters (select lifter_id, date, ...) and process in memory?
                // If a lifter has 100 results, 1000 lifters = 100k rows. Might be too much for one HTTP request.

                // Let's use a custom RPC if available? The user mentioned `get_latest_lifter_metadata`.
                // Let's try to call it?
                // const { data: metadata } = await supabase.rpc('get_latest_lifter_metadata', { lifter_ids: lifterIds });

                // If we can't use RPC, we might have to skip metadata for now or accept the N+1 (batching) cost?
                // Or just fetch `lifters` and be done with it. The user wants "similar process".
                // The IWF one has metadata.

                // Let's try to fetch `meet_results` for the batch, but only select necessary columns.
                // And maybe we don't need ALL results.
                // What if we just fetch `lifters` and `meet_results` (limit 1) via the relationship?
                // `select('*, meet_results(date, gender, club_name, wso)')`
                // If we don't specify limit, it fetches all.

                // Let's assume for this script, we will just index the `lifters` basic info.
                // The user can refine it later if they need the metadata in the search preview.
                // Wait, the search preview SHOWS the club and wso.
                // So it is important.

                // Let's try to fetch `meet_results` with a limit.
                // `meet_results(date, gender, club_name, wso)` and process.
                // We'll just do it. If it's slow, it's a build script.

                // Actually, better approach:
                // Fetch `lifters`
                // For each batch of 1000:
                //   Fetch `meet_results` where lifter_id in (batch_ids).
                //   In memory, group by lifter_id and pick latest.
                //   Merge.

                const { data: results, error: resError } = await supabase
                    .from('usaw_meet_results')
                    .select('lifter_id, date, gender, club_name, wso')
                    .in('lifter_id', lifterIds)
                    .order('date', { ascending: false });

                if (resError) console.warn('Error fetching results', resError);

                const resultsMap = new Map();
                if (results) {
                    results.forEach(r => {
                        if (!resultsMap.has(r.lifter_id)) {
                            resultsMap.set(r.lifter_id, r); // First one is latest due to order
                        }
                    });
                }

                const batchWithMeta = lifters.map(l => {
                    const meta = resultsMap.get(l.lifter_id) || {};
                    return { ...l, ...meta };
                });

                allAthletes.push(...batchWithMeta);

                console.log(`Fetched ${allAthletes.length} athletes...`);
                page++;
                if (lifters.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`Total athletes fetched: ${allAthletes.length}`);
        console.log('Processing data for index...');

        const indexData: USAWAthleteIndex[] = allAthletes.map(athlete => {
            return {
                id: athlete.lifter_id,
                name: athlete.athlete_name,
                membership_number: athlete.membership_number || '',
                gender: athlete.gender || '',
                club: athlete.club_name || '',
                wso: athlete.wso || '',
                totalResults: 0, // We didn't count them all, just fetched latest
                latestResultDate: athlete.date || '',
                searchableText: `${athlete.athlete_name} ${athlete.membership_number || ''} ${athlete.club_name || ''}`.toLowerCase(),
                displaySlug: athlete.athlete_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            };
        });

        console.log('Building MiniSearch index...');

        const miniSearch = new MiniSearch({
            fields: ['name', 'membership_number', 'searchableText'],
            storeFields: ['id', 'name', 'membership_number', 'gender', 'club', 'wso', 'latestResultDate', 'displaySlug'],
            searchOptions: {
                prefix: true,
                fuzzy: 0.2,
                boost: { name: 2, membership_number: 2 }
            }
        });

        miniSearch.addAll(indexData);

        console.log('Compressing and saving index...');

        const indexJson = JSON.stringify(miniSearch.toJSON());
        const compressed = gzipSync(indexJson);

        const outputPath = path.join(dataDir, 'usaw-athlete-search-index.json.gz');
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`Index saved to ${outputPath}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);

    } catch (err) {
        console.error('Failed to generate index:', err);
        process.exit(1);
    }
}

generateUSAWAthleteIndex();
