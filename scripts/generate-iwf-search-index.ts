
import { createClient } from '@supabase/supabase-js';
import MiniSearch from 'minisearch';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
// If not (e.g., in GitHub Actions), environment variables are already set
dotenv.config({ path: '.env.local' });

const IWF_URL = process.env.NEXT_PUBLIC_SUPABASE_IWF_URL;
const IWF_KEY = process.env.NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY;

if (!IWF_URL || !IWF_KEY) {
    console.error('Missing IWF Supabase environment variables (NEXT_PUBLIC_SUPABASE_IWF_URL, NEXT_PUBLIC_SUPABASE_IWF_ANON_KEY)');
    process.exit(1);
}

const supabase = createClient(IWF_URL, IWF_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

interface IWFAthleteIndex {
    id: number;  // db_lifter_id
    iwfId: number | null; // iwf_lifter_id
    name: string;  // Full athlete name
    country: string;  // Country name
    gender: 'M' | 'F';
    totalResults: number;
    latestResultDate: string;
    bestTotal: number;
    searchableText: string;
    displaySlug: string;
}

async function generateIWFAthleteIndex() {
    console.log('Starting IWF athlete index generation...');

    try {
        // Ensure public/data directory exists
        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        let allAthletes: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log('Fetching athletes from Supabase...');

        while (hasMore) {
            const { data, error } = await supabase
                .from('iwf_lifters')
                .select(`
          db_lifter_id,
          athlete_name,
          country_name,
          country_code,
          gender,
          iwf_lifter_id,
          recent_results:iwf_meet_results(
            date,
            total
          )
        `)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching athletes: ${error.message}`);
            }

            if (data && data.length > 0) {
                allAthletes = [...allAthletes, ...data];
                console.log(`Fetched ${allAthletes.length} athletes...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`Total athletes fetched: ${allAthletes.length}`);
        console.log('Processing data for index...');

        const indexData: IWFAthleteIndex[] = allAthletes.map(athlete => {
            // Calculate stats from recent results
            const results = athlete.recent_results || [];
            const totalResults = results.length;

            // Find latest date
            const latestResultDate = results.length > 0
                ? results.reduce((latest: string, curr: any) => (curr.date > latest ? curr.date : latest), '')
                : '';

            // Find best total
            const bestTotal = results.length > 0
                ? Math.max(...results.map((r: any) => {
                    const t = parseFloat(r.total);
                    return isNaN(t) ? 0 : t;
                }))
                : 0;

            return {
                id: athlete.db_lifter_id,
                iwfId: athlete.iwf_lifter_id,
                name: athlete.athlete_name,
                country: athlete.country_name || '',
                gender: athlete.gender,
                totalResults,
                latestResultDate,
                bestTotal,
                // Searchable text: name + country + country code
                searchableText: `${athlete.athlete_name} ${athlete.country_name || ''} ${athlete.country_code || ''}`.toLowerCase(),
                // Simple slug for display/routing if needed
                displaySlug: athlete.athlete_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            };
        });

        console.log('Building MiniSearch index...');

        const miniSearch = new MiniSearch({
            fields: ['name', 'country', 'searchableText'], // Fields to index for full-text search
            storeFields: ['id', 'iwfId', 'name', 'country', 'gender', 'totalResults', 'bestTotal', 'displaySlug'], // Fields to return in results
            searchOptions: {
                prefix: true,
                fuzzy: 0.2,
                boost: { name: 2 }
            }
        });

        miniSearch.addAll(indexData);

        console.log('Compressing and saving index...');

        const indexJson = JSON.stringify(miniSearch.toJSON());
        const compressed = gzipSync(indexJson);

        const outputPath = path.join(dataDir, 'iwf-athlete-search-index.json.gz');
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`Index saved to ${outputPath}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);

    } catch (err) {
        console.error('Failed to generate index:', err);
        process.exit(1);
    }
}

generateIWFAthleteIndex();
