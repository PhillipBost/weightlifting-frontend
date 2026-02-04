
import { createClient } from '@supabase/supabase-js';
import MiniSearch from 'minisearch';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local if it exists
// If not (e.g., in GitHub Actions), environment variables are already set
dotenv.config({ path: '.env.local' });

const IWF_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const IWF_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!IWF_URL || !IWF_KEY) {
    console.error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    process.exit(1);
}

const supabase = createClient(IWF_URL, IWF_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

interface IWFMeetIndex {
    id: number; // db_meet_id
    iwfId: number; // iwf_meet_id
    name: string; // meet
    date: string;
    level: string;
    city: string;
    country: string;
    searchableText: string;
    displaySlug: string;
}

async function generateIWFMeetIndex() {
    console.log('Starting IWF meet index generation...');

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
            // Fetch meets (without join, as it seems unreliable or misconfigured)
            const { data: meets, error: meetsError } = await supabase
                .from('iwf_meets')
                .select('db_meet_id, meet, date, level, iwf_meet_id')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (meetsError) {
                throw new Error(`Error fetching meets: ${meetsError.message}`);
            }

            if (meets && meets.length > 0) {
                // Fetch corresponding locations
                const meetIds = meets.map(m => m.iwf_meet_id);
                const { data: locations, error: locError } = await supabase
                    .from('iwf_meet_locations')
                    .select('*')
                    .in('iwf_meet_id', meetIds);

                if (locError) {
                    console.error('Error fetching locations:', locError);
                    // Continue with empty locations
                }

                // Map locations to meets
                const locationsMap = new Map(locations?.map(l => [l.iwf_meet_id, l]));

                const enrichedMeets = meets.map(meet => {
                    const location = locationsMap.get(meet.iwf_meet_id) || {};
                    return {
                        ...meet,
                        iwf_meet_locations: [location] // Mock structure to match previous logic
                    };
                });

                allMeets.push(...enrichedMeets);
                console.log(`Fetched ${allMeets.length} meets...`);
                page++;
                if (meets.length < pageSize) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        console.log(`Total meets fetched: ${allMeets.length}`);
        console.log('Processing data for index...');

        const indexData: IWFMeetIndex[] = allMeets.map(meet => {
            const location = meet.iwf_meet_locations?.[0] || {};
            return {
                id: meet.db_meet_id,
                iwfId: meet.iwf_meet_id,
                name: meet.meet || '',
                date: meet.date || '',
                level: meet.level || '',
                city: location.city || '',
                country: location.country || '',
                searchableText: `${meet.meet || ''} ${location.city || ''} ${location.country || ''} ${location.location_text || ''}`.toLowerCase(),
                displaySlug: (meet.meet || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
            };
        });

        console.log('Building MiniSearch index...');

        const miniSearch = new MiniSearch({
            fields: ['name', 'searchableText'],
            storeFields: ['id', 'iwfId', 'name', 'date', 'level', 'city', 'country', 'displaySlug'],
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

        const outputPath = path.join(dataDir, 'iwf-meet-search-index.json.gz');
        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`Index saved to ${outputPath}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);

    } catch (err) {
        console.error('Failed to generate index:', err);
        process.exit(1);
    }
}

generateIWFMeetIndex();
