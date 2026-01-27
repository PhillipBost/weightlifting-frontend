
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    console.log('[Stats API] Initializing...');

    try {
        const supabase = await createClient();
        console.log('[Stats API] Client created matches');

        // Helper for safe counting
        const getCount = async (table: string) => {
            try {
                const { count, error } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                if (error) {
                    console.error(`[Stats API] Error counting ${table}:`, error);
                    return 0;
                }
                return count || 0;
            } catch (e) {
                console.error(`[Stats API] Exception counting ${table}:`, e);
                return 0;
            }
        };

        // Run in parallel
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

        const stats = {
            results: usawResults + iwfResults,
            athletes: usawAthletes + iwfAthletes,
            meets: usawMeets + iwfMeets,
            breakdown: {
                usawResults, iwfResults, usawAthletes, iwfAthletes, usawMeets, iwfMeets
            }
        };

        console.log('[Stats API] Success:', stats);
        return NextResponse.json(stats);

    } catch (error) {
        console.error('[Stats API] Fatal Error:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
