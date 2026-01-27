
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function updateStats() {
    console.log('Starting DB Stats Update...');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
    });

    const getCount = async (table: string) => {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.warn(`Warning: Could not count ${table}: ${error.message}`);
                // Fallback: if table doesn't exist, return 0
                return 0;
            }
            return count || 0;
        } catch (err) {
            console.warn(`Error counting ${table}:`, err);
            return 0;
        }
    };

    try {
        console.log('Fetching counts parallel...');
        const [
            usawResults,
            iwfResults,
            usawAthletes,
            iwfAthletes,
            usawMeets,
            iwfMeets
        ] = await Promise.all([
            getCount('usaw_meet_results'),
            getCount('iwf_meet_results'),
            getCount('usaw_lifters'),
            getCount('iwf_lifters'),
            getCount('usaw_meets'),
            getCount('iwf_meets')
        ]);

        const totalResults = usawResults + iwfResults;
        const totalAthletes = usawAthletes + iwfAthletes;
        const totalMeets = usawMeets + iwfMeets;

        console.log('Stats gathered:');
        console.log(`  Results: ${totalResults.toLocaleString()} (USAW: ${usawResults}, IWF: ${iwfResults})`);
        console.log(`  Athletes: ${totalAthletes.toLocaleString()} (USAW: ${usawAthletes}, IWF: ${iwfAthletes})`);
        console.log(`  Meets: ${totalMeets.toLocaleString()} (USAW: ${usawMeets}, IWF: ${iwfMeets})`);

        const statsData = {
            results: totalResults,
            athletes: totalAthletes,
            meets: totalMeets,
            lastUpdated: new Date().toISOString(),
            breakdown: {
                usawResults, iwfResults, usawAthletes, iwfAthletes, usawMeets, iwfMeets
            }
        };

        const outputPath = path.join(process.cwd(), 'public', 'data', 'stats.json');

        // Ensure directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        await fs.writeFile(outputPath, JSON.stringify(statsData, null, 2));
        console.log(`✓ Stats saved to ${outputPath}`);

    } catch (error) {
        console.error('Fatal error updating stats:', error);
        process.exit(1);
    }
}

updateStats();
