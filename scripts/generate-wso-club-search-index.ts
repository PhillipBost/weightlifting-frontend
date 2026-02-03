
import { createClient } from '@supabase/supabase-js';
import MiniSearch from 'minisearch';
import { gzipSync } from 'zlib';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const USAW_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const usawClient = createClient(USAW_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

interface SearchIndexParams {
    id: string;
    name: string;
    type: 'WSO' | 'Club' | 'Country';
    location: string;
    slug: string;
    state: string;
    searchableText: string;
}

function createSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function parseLocation(club: { geocode_display_name?: string | null; address?: string | null }): { city: string; state: string } {
    const displayName = club.geocode_display_name || club.address || '';
    const parts = displayName.split(',').map(p => p.trim());

    if (parts.length >= 2) {
        const state = parts[parts.length - 1];
        const city = parts[parts.length - 2];

        if (state && !state.match(/^\d/) && state.length <= 20) {
            return { city, state };
        }
    }

    return { city: '', state: '' };
}

async function generateWsoClubIndex() {
    console.log('🚀 Starting WSO/Club/Country index generation...');
    const documents: SearchIndexParams[] = [];

    try {
        // 1. Fetch WSOs
        console.log('Fetching WSOs from wso_information...');
        const { data: wsos, error: wsoError } = await usawClient
            .from('usaw_wso_information')
            .select('wso_id, name, states');

        if (wsoError) throw new Error(`WSO fetch error: ${wsoError.message}`);

        if (wsos) {
            wsos.forEach((wso: any) => {
                const slug = createSlug(wso.name || 'unknown');
                const location = wso.states && Array.isArray(wso.states) ? wso.states.join(', ') : 'USA';

                documents.push({
                    id: `wso-${wso.wso_id || Math.random()}`,
                    name: wso.name || 'Unknown WSO',
                    type: 'WSO',
                    location: location,
                    slug: slug,
                    state: wso.states?.[0] || '',
                    searchableText: `${wso.name || ''} WSO weightlifting ${location}`.toLowerCase()
                });
            });
            console.log(`✅ Added ${wsos.length} WSOs`);
        }

        // 2. Fetch Clubs
        console.log('Fetching Clubs from clubs...');
        const { data: clubs, error: clubError } = await usawClient
            .from('usaw_clubs')
            .select('club_name, address, latitude, longitude, geocode_display_name');

        if (clubError) throw new Error(`Club fetch error: ${clubError.message}`);

        if (clubs) {
            clubs.forEach((club: any, index: number) => {
                const { city, state } = parseLocation(club);
                const location = city && state ? `${city}, ${state}` : (club.address || '');
                const name = club.club_name || 'Unknown Club';

                documents.push({
                    id: `club-${index}`,
                    name: name,
                    type: 'Club',
                    location: location,
                    slug: createSlug(name),
                    state: state || '',
                    searchableText: `${name} ${location}`.toLowerCase()
                });
            });
            console.log(`✅ Added ${clubs.length} Clubs`);
        }

        // 3. Fetch Countries
        console.log('Fetching Countries from iwf_lifters (distinct)...');

        const { data: lifters, error: countryError } = await usawClient
            .from('iwf_lifters')
            .select('country_name, country_code')
            .range(0, 4999); // Fetch first 5000 to get a good sample of countries

        if (!countryError && lifters) {
            const countryMap = new Map<string, { name: string, code: string }>();

            lifters.forEach((l: any) => {
                const name = l.country_name;
                const code = l.country_code;
                if (name && !countryMap.has(name)) {
                    countryMap.set(name, { name, code });
                }
            });

            countryMap.forEach(({ name, code }) => {
                documents.push({
                    id: `country-${code || name}`,
                    name: name,
                    type: 'Country',
                    location: 'International',
                    slug: createSlug(name),
                    state: '',
                    searchableText: `${name} ${code || ''}`.toLowerCase()
                });
            });
            console.log(`✅ Added ${countryMap.size} Countries`);
        } else {
            console.warn(`Could not fetch countries from iwf_lifters: ${countryError?.message}.`);
        }

        // Build Index
        console.log(`Building MiniSearch index with ${documents.length} items...`);
        const miniSearch = new MiniSearch({
            fields: ['name', 'location', 'searchableText'],
            storeFields: ['id', 'name', 'type', 'location', 'slug', 'state'],
            searchOptions: {
                prefix: true,
                fuzzy: 0.2,
                boost: { name: 2, type: 1.5 }
            }
        });

        miniSearch.addAll(documents);

        // Save
        const dataDir = path.join(process.cwd(), 'public', 'data');
        await fs.mkdir(dataDir, { recursive: true });

        const indexJson = JSON.stringify(miniSearch.toJSON());
        const compressed = gzipSync(indexJson);
        const outputPath = path.join(dataDir, 'wso-club-search-index.json.gz');

        await fs.writeFile(outputPath, compressed);

        const stats = await fs.stat(outputPath);
        console.log(`🎉 Index saved to ${outputPath}`);
        console.log(`Size: ${(stats.size / 1024).toFixed(2)} KB`);

    } catch (err: any) {
        console.error('❌ Failed to generate WSO/Club index:', err.message);
        process.exit(1);
    }
}

generateWsoClubIndex();
