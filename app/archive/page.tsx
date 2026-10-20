import React from "react";
import { ResultsArchiveContent, Meet } from "./components/ResultsArchiveContent";
import { createClient } from '@supabase/supabase-js';
import { supabaseIWF } from "../../lib/supabaseIWF"; // We can still use this for IWF or just use the admin client for both if they are same DB.
import { CANONICAL_COUNTRY_NAMES } from "../../types/federation";

// Enable ISR with 1-hour passive fallback revalidation (instant on-demand revalidation on upload)
export const revalidate = 3600;

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

        // 3. Fetch OWLCMS Meets from 'owlcms_meets' table with participant counts and governing federation
        const { data: owlcmsData, error: owlcmsError } = await supabase
            .from('owlcms_meets')
            .select(`
                meet_id,
                meet_name,
                start_date,
                city,
                country,
                venue,
                host_country_code,
                competition_scope,
                federation_id,
                federation:federation_registry!federation_id (
                    id,
                    canonical_name,
                    short_code,
                    level,
                    country_code
                ),
                owlcms_meet_results(count)
            `)
            .order('start_date', { ascending: false });

        if (owlcmsError) {
            console.error('Error fetching owlcms meets for archive:', owlcmsError);
        }

        const US_STATES = [
            'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
            'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
            'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
            'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
            'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
            'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
            'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
            'Wisconsin', 'Wyoming'
        ];

        // Map USAW to unified interface
        const usawMeets: Meet[] = (usawData || []).map((m: any) => {
            let loc = m.location_text;
            if (!loc && (m.city || m.state)) {
                loc = [m.city, m.state].filter(Boolean).join(', ');
            }

            // Derive State if m.state is unpopulated in recent scraping batches
            let state = (m.state || '').trim();
            if (!state && m.location_text && m.location_text.includes(',')) {
                const parts = m.location_text.split(',');
                const candidate = parts[parts.length - 1].trim();
                const matched = US_STATES.find(s => s.toLowerCase() === candidate.toLowerCase());
                if (matched) state = matched;
            }
            if (!state && m.Meet) {
                const matched = US_STATES.find(s => new RegExp(`\\b${s}\\b`, 'i').test(m.Meet));
                if (matched) state = matched;
            }
            if (!state && m.wso_geography) {
                const matched = US_STATES.find(s => s.toLowerCase() === m.wso_geography.toLowerCase());
                if (matched) state = matched;
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
                state: state || undefined,
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
                athleteCount: m.results || 0,
                country: locData?.country || 'International',
                level: 'International',
                state: undefined,
                wso: undefined
            };
        });

        // Map OWLCMS to unified interface
        const owlcmsMeets: Meet[] = (owlcmsData || []).map((m: any) => {
            const fed = m.federation;
            const fedLevel = (fed?.level || '').toLowerCase();
            const scope = (m.competition_scope || '').toLowerCase();

            // Determine canonical Level from competition scope and registered federation tier
            let level = 'Local';
            if (
                scope === 'international' ||
                scope === 'continental' ||
                fedLevel === 'continental' ||
                fedLevel === 'global_international' ||
                fedLevel === 'international' ||
                fedLevel === 'intercontinental_regional'
            ) {
                level = 'International';
            } else if (scope === 'national' || fedLevel === 'national') {
                level = 'National';
            } else if (scope === 'state_provincial' || scope === 'regional' || fedLevel === 'regional_state_wso') {
                level = 'State/Provincial';
            }

            // Derive authentic Country
            const countryCode = m.host_country_code || fed?.country_code || 'CAN';
            const countryName = CANONICAL_COUNTRY_NAMES[countryCode] || countryCode;

            // Derive State / Province (conforming to Defined Acronym Standard)
            let state: string | undefined = undefined;
            const cityLower = (m.city || '').toLowerCase();
            const venueLower = (m.venue || m.country || '').toLowerCase();
            const fedName = fed?.canonical_name || '';

            if (cityLower.includes('québec') || cityLower.includes('quebec') || venueLower.includes('québec') || venueLower.includes('quebec') || fedName.includes('Québec')) {
                state = 'Québec (QC)';
            } else if (cityLower.includes('ontario') || venueLower.includes('ontario') || fedName.includes('Ontario')) {
                state = 'Ontario (ON)';
            } else if (cityLower.includes('columbia') || fedName.includes('Columbia')) {
                state = 'British Columbia (BC)';
            } else if (cityLower.includes('alberta') || fedName.includes('Alberta')) {
                state = 'Alberta (AB)';
            }

            // Derive WSO / PSO (State / Provincial Governing Body)
            let wso: string | undefined = undefined;
            if (fedLevel === 'regional_state_wso') {
                if (fed?.canonical_name) {
                    const acronym = fed.short_code || (fed.canonical_name.includes('Québec') ? 'FHQ' : undefined);
                    wso = acronym ? `${fed.canonical_name} (${acronym})` : fed.canonical_name;
                }
            }

            // Clean up Location string
            let locCity = (m.city || '').trim();
            if (locCity.toLowerCase() === 'ecuador' && m.country?.toLowerCase() === 'guayaquil') {
                locCity = 'Guayaquil';
            }
            let loc = locCity;
            if (countryName && !loc.includes(countryName)) {
                loc = loc ? `${loc}, ${countryName}` : countryName;
            }

            const countItem = Array.isArray(m.owlcms_meet_results) ? m.owlcms_meet_results[0] : m.owlcms_meet_results;
            const athleteCount = countItem?.count || 0;

            return {
                id: `owlcms_${m.meet_id}`,
                datasetId: m.meet_id,
                name: m.meet_name,
                date: m.start_date,
                location: loc || 'Unknown Location',
                federation: 'OWLCMS',
                athleteCount,
                country: countryName,
                level,
                state,
                wso
            };
        });

        // 4. Combine and Sort
        const combinedMeets = [...usawMeets, ...iwfMeets, ...owlcmsMeets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
