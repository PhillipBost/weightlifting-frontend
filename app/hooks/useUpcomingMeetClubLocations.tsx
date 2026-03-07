import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const normalizeName = (name: string): string => {
    return name ? name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9\s]/g, '') : '';
};

interface Spoke {
    name: string;
    lat: number;
    lng: number;
    count: number;
}

export function useUpcomingMeetClubLocations(listingId: string) {
    const [spokes, setSpokes] = useState<Spoke[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!listingId) {
            setSpokes([]);
            setLoading(false);
            return;
        }

        const fetchClubLocations = async () => {
            try {
                setLoading(true);
                console.log(`[useUpcomingMeetClubLocations] Starting fetch for listingId: ${listingId}`);

                // Step 1: Fetch all entries for the upcoming meet
                const { data: entriesData, error: entriesError } = await (supabase as any)
                    .from('usaw_meet_entries')
                    .select('club, wso')
                    .eq('listing_id', parseInt(listingId));

                if (entriesError) throw entriesError;

                console.log(`[useUpcomingMeetClubLocations] Fetched ${entriesData?.length || 0} entries`);

                if (!entriesData || entriesData.length === 0) {
                    console.log(`[useUpcomingMeetClubLocations] No entries found for listingId: ${listingId}`);
                    setSpokes([]);
                    setLoading(false);
                    return;
                }

                // Step 2: Group by club (priority) or wso fallback, count athletes
                const clubCounts: Record<string, { originalName: string, count: number }> = {};
                entriesData.forEach((row: any) => {
                    let name = row.club;
                    if (!name || name.trim() === '') {
                        name = row.wso || 'Unknown';
                    }
                    if (name && name !== 'Unknown') {
                        const norm = normalizeName(name);
                        if (!clubCounts[norm]) {
                            clubCounts[norm] = { originalName: name, count: 0 };
                        }
                        clubCounts[norm].count += 1;
                    }
                });

                const uniqueEntries = Object.entries(clubCounts).map(([norm, data]) => ({
                    name: data.originalName,
                    count: data.count,
                    normalized: norm,
                }));

                // Step 3: Fetch coords from clubs table via API
                let clubCoords: Record<string, { lat: number, lng: number }> = {};
                console.log(`[useUpcomingMeetClubLocations] Fetching club coordinates via API...`);

                // Get unique club names from entries
                const uniqueClubNames = Array.from(
                    new Set(uniqueEntries.map((entry: any) => entry.name))
                );

                try {
                    const response = await fetch('/api/clubs/coordinates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clubNames: uniqueClubNames })
                    });

                    if (!response.ok) {
                        throw new Error(`API error: ${response.statusText}`);
                    }

                    const coordinatesMap = await response.json();
                    console.log(`[useUpcomingMeetClubLocations] Received coordinates:`, coordinatesMap);

                    // Build clubCoords from API response
                    uniqueClubNames.forEach((clubName: string) => {
                        const coords = coordinatesMap[clubName];
                        if (coords && coords.lat && coords.lng) {
                            clubCoords[clubName] = {
                                lat: coords.lat,
                                lng: coords.lng
                            };
                        }
                    });

                    console.log(`[useUpcomingMeetClubLocations] Matched ${Object.keys(clubCoords).length} clubs from API`);
                } catch (err: any) {
                    console.error(`[useUpcomingMeetClubLocations] Error calling API:`, err);
                    throw err;
                }

                // Step 4: For unmatched clubs, try WSO fallback
                const unmatchedEntries = uniqueEntries.filter((entry: any) => !clubCoords[entry.name]);

                let wsoCoords: Record<string, { lat: number, lng: number }> = {};
                if (unmatchedEntries.length > 0) {
                    console.log(`[useUpcomingMeetClubLocations] ${unmatchedEntries.length} clubs not matched, trying WSO fallback...`);

                    const { data: wsoData, error: wsoError } = await supabase
                        .from('usaw_wso_information')
                        .select('name, geographic_center_lat, geographic_center_lng')
                        .not('geographic_center_lat', 'is', null)
                        .not('geographic_center_lng', 'is', null);

                    if (wsoError) throw wsoError;

                    const normalizedWsoMap: Record<string, { originalName: string, lat: number, lng: number }> = {};
                    wsoData.forEach((wso: any) => {
                        if (wso.geographic_center_lat && wso.geographic_center_lng) {
                            const norm = normalizeName(wso.name);
                            if (norm) {
                                normalizedWsoMap[norm] = {
                                    originalName: wso.name,
                                    lat: wso.geographic_center_lat,
                                    lng: wso.geographic_center_lng
                                };
                            }
                        }
                    });

                    // Match unmatched entries to normalized WSO map
                    unmatchedEntries.forEach((entry: any) => {
                        const norm = entry.normalized;
                        if (normalizedWsoMap[norm]) {
                            wsoCoords[entry.name] = {
                                lat: normalizedWsoMap[norm].lat,
                                lng: normalizedWsoMap[norm].lng
                            };
                            console.log(`[useUpcomingMeetClubLocations] Matched WSO: ${entry.name} -> ${normalizedWsoMap[norm].originalName}`);
                        } else {
                            console.warn(`[useUpcomingMeetClubLocations] No WSO match for: ${entry.name}`);
                        }
                    });
                }

                // Step 5: Combine and filter valid coords
                const computedSpokes: Spoke[] = uniqueEntries
                    .map((entry: any) => {
                        const coords = clubCoords[entry.name] || wsoCoords[entry.name];
                        if (coords) {
                            return {
                                name: entry.name,
                                lat: coords.lat,
                                lng: coords.lng,
                                count: entry.count,
                            };
                        }
                        console.warn(`No coordinates found for club/WSO: ${entry.name} (normalized: ${entry.normalized})`);
                        return null;
                    })
                    .filter(Boolean) as Spoke[];

                console.log(`[useUpcomingMeetClubLocations] USAW Upcoming Meet ${listingId}: Found coordinates for ${computedSpokes.length} out of ${uniqueEntries.length} clubs/WSOs`);
                console.log(`[useUpcomingMeetClubLocations] Spokes data:`, computedSpokes);
                setSpokes(computedSpokes);
            } catch (err: any) {
                console.error('Error fetching upcoming meet club locations:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchClubLocations();
    }, [listingId]);

    return { spokes, loading, error };
}
