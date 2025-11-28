
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
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

interface USAWMeetIndex {
    id: number; // meet_id
    name: string; // Meet
    date: string; // Date
    level: string; // Level
    city: string;
    state: string;
    searchableText: string;
    displaySlug: string;
}

async function generateUSAWMeetIndex() {
    console.log('Starting USAW meet index generation...');

    try {
        // Ensure public/data directory exists
        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        let allMeets: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log('Fetching meets from Supabase...');

        while (hasMore) {
            const { data, error } = await supabase
                .from('usaw_meets')
                .select('meet_id, Meet, Date, Level, city, state, address')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                throw new Error(`Error fetching meets: ${error.message}`);
            }

            if (data && data.length > 0) {
                allMeets.push(...data);
                console.log(`Fetched ${allMeets.length} meets...`);
                page++;
                if (data.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`Total meets fetched: ${allMeets.length}`);
        console.log('Processing data for index...');

        const indexData: USAWMeetIndex[] = allMeets.map(meet => {
            return {
                id: meet.meet_id,
                name: meet.Meet,
                date: meet.Date,
                level: meet.Level || '',
                city: meet.city || '',
                state: meet.state || '',
                searchableText: `${meet.Meet} ${meet.city || ''} ${meet.state || ''} ${meet.address || ''}`.toLowerCase(),
                displaySlug: meet.Meet.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            };
        });

        console.log('Building MiniSearch index...');

        const miniSearch = new MiniSearch({
            fields: ['name', 'searchableText'],
            storeFields: ['id', 'name', 'date', 'level', 'city', 'state', 'displaySlug'],
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

        const outputPath = path.join(dataDir, 'usaw-meet-search-index.json.gz');
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`Index saved to ${outputPath}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);

    } catch (err) {
        console.error('Failed to generate index:', err);
        process.exit(1);
    }
}

generateUSAWMeetIndex();
