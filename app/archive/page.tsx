import React from "react";
import { ResultsArchiveContent, Meet } from "./components/ResultsArchiveContent";
import { createClient } from '@supabase/supabase-js';
import { supabaseIWF } from "../../lib/supabaseIWF"; // We can still use this for IWF or just use the admin client for both if they are same DB.

// Enable ISR with 24-hour revalidation
export const revalidate = 86400;

// Initialize Supabase Admin client for server-side fetching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getArchiveData(): Promise<Meet[]> {
    try {
        // 1. Fetch USAW Meets from 'usaw_meets' table
        const { data: usawData, error: usawError } = await supabase
            .from('usaw_meets')
            .select('meet_id, Meet, Date, location_text, city, state, URL, wso_geography, elevation_meters, Results, Level')
            .order('Date', { ascending: false });

        if (usawError) throw usawError;

        // 2. Fetch IWF Meets from 'iwf_meets' table
        // We can use the same admin client if tables are in same DB, but let's stick to the pattern if not sure.
        // Actually, previous code used supabaseIWF client. Let's assume same DB and use admin client for both to ensure access.
        const { data: iwfData, error: iwfError } = await supabase
            .from('iwf_meets')
            .select(`
                iwf_meet_id,
                db_meet_id,
                meet,
                date,
                url,
                results,
                iwf_meet_locations (
                    location_text,
                    city,
                    country
                )
            `)
            .order('date', { ascending: false });

        if (iwfError) throw iwfError;

        // Map USAW to unified interface
        const usawMeets: Meet[] = (usawData || []).map((m: any) => {
            let loc = m.location_text;
            if (!loc && (m.city || m.state)) {
                loc = [m.city, m.state].filter(Boolean).join(', ');
            }

            // Level Inference
            let level = m.Level;
            if (!level) {
                const nameLower = m.Meet.toLowerCase();
                if (nameLower.includes('national') ||
                    nameLower.includes('american open') ||
                    nameLower.includes('north american')) {
                    level = 'National';
                } else {
                    level = 'Local';
                }
            }

            return {
                id: `usaw_${m.meet_id}`,
                datasetId: m.meet_id,
                name: m.Meet,
                date: m.Date,
                location: loc || 'Unknown Location',
                federation: 'USAW',
                url: m.URL,
                elevation: m.elevation_meters,
                wso: m.wso_geography,
                athleteCount: m.Results,
                state: m.state,
                country: 'USA',
                level: level
            };
        });

        // Map IWF to unified interface
        const iwfMeets: Meet[] = (iwfData || []).map((m: any) => {
            // Handle 1:1 or 1:Many relationship gracefully
            const locDataRaw = m.iwf_meet_locations;
            const locData = Array.isArray(locDataRaw) ? locDataRaw[0] : locDataRaw;

            let loc = locData?.location_text;
            if (!loc && (locData?.city || locData?.country)) {
                loc = [locData.city, locData.country].filter(Boolean).join(', ');
            }

            return {
                id: `iwf_${m.iwf_meet_id}`,
                datasetId: m.iwf_meet_id, // Use iwf_meet_id as datasetId
                name: m.meet,
                date: m.date,
                location: loc || 'Unknown Location',
                federation: 'IWF',
                url: m.url,
                athleteCount: m.results ? JSON.parse(m.results).length : 0,
                country: locData?.country || 'International',
                level: 'International',
                state: undefined,
                wso: undefined
            };
        });

        // 3. Combine and Sort
        const combinedMeets = [...usawMeets, ...iwfMeets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return combinedMeets;

    } catch (err) {
        console.error('Error fetching archive data during ISR generation:', err);
        return [];
    }
}

export default async function ResultsArchivePage() {
    const initialMeets = await getArchiveData();

    return (
        <div className="min-h-screen bg-app-primary">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-[1200px] mx-auto">
                    <ResultsArchiveContent initialMeets={initialMeets} />
                </div>
            </div>
        </div>
    );
}
