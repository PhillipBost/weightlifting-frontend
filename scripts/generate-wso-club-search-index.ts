
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

if (!USAW_URL || !SERVICE_KEY) {
    console.error('Missing USAW Supabase environment variables');
    process.exit(1);
}

const usawClient = createClient(USAW_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Log which database we're connecting to (mask for security)
const urlMask = USAW_URL ? `${USAW_URL.substring(0, 30)}...` : 'undefined';
console.log(`[DB Connection] Connecting to: ${urlMask}`);

interface SearchIndexParams {
    id: string;
    name: string;
    type: 'WSO' | 'Club' | 'Country' | 'University';
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
        // Test: Verify service role can access data (should bypass RLS)
        console.log('🔍 Testing database access with service role...');
        const { data: testResults, error: testError, count: testCount } = await usawClient
            .from('usaw_meet_results')
            .select('result_id', { count: 'exact', head: true });

        if (testError) {
            console.error('❌ Service role test failed:', testError);
        } else {
            console.log(`✅ Service role working - usaw_meet_results has ${testCount} rows`);
        }

        // 1. Fetch WSOs
        console.log('Fetching WSOs from usaw_wso_information...');
        const { data: wsos, error: wsoError, count } = await usawClient
            .from('usaw_wso_information')
            .select('wso_id, name, states', { count: 'exact' });

        if (wsoError) {
            console.error('WSO fetch error:', wsoError);
            throw new Error(`WSO fetch error: ${wsoError.message}`);
        }

        console.log(`Query returned: ${wsos?.length || 0} rows (count: ${count})`);

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
            if (wsos.length === 0) {
                console.warn('⚠️  WARNING: No WSOs found in usaw_wso_information table!');
                console.warn('⚠️  This might be due to:');
                console.warn('   - Row-Level Security (RLS) policies blocking access');
                console.warn('   - Service role key lacking permissions');
                console.warn('   - Empty table in this environment');
            }
        }

        // 1b. Fetch University Programs (linked -> canonical club slug; unlinked -> /club directory)
        console.log('Fetching University Programs from usaw_university_programs...');
        const { data: universityPrograms, error: universityError } = await usawClient
            .from('usaw_university_programs')
            .select('program_id, school_name, state, city, associated_usaw_club');

        // Docs are pushed AFTER the clubs fetch so we only route to club pages
        // that actually exist (profile pages require geocoded coordinates).
        const linkedClubNames = new Set<string>();
        if (universityError) {
            console.warn('University programs fetch error:', universityError.message);
        } else {
            (universityPrograms || []).forEach((program: any) => {
                if (program.associated_usaw_club) {
                    linkedClubNames.add(program.associated_usaw_club);
                }
            });
            console.log(`Fetched ${universityPrograms?.length || 0} University Programs (${linkedClubNames.size} linked to clubs)`);
        }

        // 2. Fetch Clubs
        console.log('Fetching Clubs from usaw_clubs...');
        const { data: clubs, error: clubError, count: clubCount } = await usawClient
            .from('usaw_clubs')
            .select('club_name, address, latitude, longitude, geocode_display_name, community_designation', { count: 'exact' });

        if (clubError) {
            console.error('Club fetch error:', clubError);
            throw new Error(`Club fetch error: ${clubError.message}`);
        }

        console.log(`Query returned: ${clubs?.length || 0} rows (count: ${clubCount})`);

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
                    // community_designation indexed verbatim so specialty searches
                    // ("lgbtqia", "black owned", ...) find designated clubs, and
                    // collegiate clubs match "collegiate"/"university" queries.
                    searchableText: `${name} ${location} ${club.community_designation || ''} ${linkedClubNames.has(club.club_name) ? 'collegiate program university' : ''}`.toLowerCase()
                });
            });
            console.log(`✅ Added ${clubs.length} Clubs`);
            if (clubs.length === 0) {
                console.warn('⚠️  WARNING: No Clubs found in usaw_clubs table!');
                console.warn('⚠️  This might be due to:');
                console.warn('   - Row-Level Security (RLS) policies blocking access');
                console.warn('   - Service role key lacking permissions');
                console.warn('   - Empty table in this environment');
            }
        }

        // 2b. Push University Program docs (after clubs so slug routing is safe:
        //     /club/[slug] 404s for clubs without geocoded coordinates, so those
        //     linked programs fall back to the /club University Programs section.)
        const geocodedClubSlugs = new Set<string>();
        (clubs || []).forEach((club: any) => {
            if (club.latitude && club.longitude) {
                geocodedClubSlugs.add(createSlug(club.club_name || ''));
            }
        });

        if (!universityError) {
            let routedToClub = 0;
            (universityPrograms || []).forEach((program: any) => {
                const location = [program.city, program.state].filter(Boolean).join(', ');
                const clubSlug = program.associated_usaw_club ? createSlug(program.associated_usaw_club) : '';
                const routableSlug = clubSlug && geocodedClubSlugs.has(clubSlug) ? clubSlug : '';
                if (routableSlug) routedToClub++;
                documents.push({
                    id: `university-${program.program_id}`,
                    name: program.school_name,
                    type: 'University',
                    location,
                    slug: routableSlug,
                    state: program.state || '',
                    searchableText: `${program.school_name} ${location} ${program.associated_usaw_club || ''} university college collegiate weightlifting`.toLowerCase()
                });
            });
            console.log(`✅ Added ${universityPrograms?.length || 0} University Programs (${routedToClub} routed to club pages, ${universityPrograms!.length - routedToClub} to /club section)`);
        }

        // 3. Fetch Countries
        console.log('Fetching Countries from iwf_lifters (distinct)...');

        const countryMap = new Map<string, { name: string, code: string }>();
        let offset = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: lifters, error: countryError } = await usawClient
                .from('iwf_lifters')
                .select('country_name, country_code')
                .range(offset, offset + batchSize - 1);

            if (countryError) {
                console.warn(`Error fetching countries at offset ${offset}: ${countryError.message}`);
                break;
            }

            if (!lifters || lifters.length === 0) {
                hasMore = false;
                break;
            }

            lifters.forEach((l: any) => {
                const name = l.country_name;
                const code = l.country_code;
                if (name && !countryMap.has(name)) {
                    countryMap.set(name, { name, code });
                }
            });

            console.log(`  Processed ${offset + lifters.length} lifters, found ${countryMap.size} unique countries so far...`);

            if (lifters.length < batchSize) {
                hasMore = false;
            } else {
                offset += batchSize;
            }
        }

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
