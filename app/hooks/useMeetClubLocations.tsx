import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Spoke {
  name: string;
  lat: number | null;
  lng: number | null;
  count: number;
}

export function useMeetClubLocations(meetId: string) {
  const [spokes, setSpokes] = useState<Spoke[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetId) {
      setSpokes([]);
      setLoading(false);
      return;
    }

    const fetchClubLocations = async () => {
      try {
        setLoading(true);

        // Step 1: Fetch all results for the meet
        const { data: resultsData, error: resultsError } = await supabase
          .from('meet_results')
          .select('club_name, wso')
          .eq('meet_id', parseInt(meetId));

        if (resultsError) throw resultsError;

        if (!resultsData || resultsData.length === 0) {
          setSpokes([]);
          setLoading(false);
          return;
        }

        // Step 2: Group by club_name (priority) or wso fallback, count athletes
        const clubCounts: Record<string, number> = {};
        resultsData.forEach((row: any) => {
          let name = row.club_name;
          if (!name || name.trim() === '') {
            name = row.wso || 'Unknown';
          }
          if (name && name !== 'Unknown') {
            clubCounts[name] = (clubCounts[name] || 0) + 1;
          }
        });

        const uniqueEntries = Object.entries(clubCounts).map(([name, count]) => ({
          name,
          count,
        }));

        // Step 3: Fetch coords from clubs table for club_names
        const clubNames = uniqueEntries
          .filter((entry: any) => entry.name !== 'Unknown')
          .map((entry: any) => entry.name);

        let clubCoords: Record<string, {lat: number, lng: number}> = {};
        if (clubNames.length > 0) {
          const { data: clubsData, error: clubsError } = await supabase
            .from('clubs')
            .select('club_name, latitude, longitude')
            .in('club_name', clubNames);

          if (clubsError) throw clubsError;

          clubCoords = clubsData.reduce((acc: Record<string, any>, club: any) => {
            if (club.latitude && club.longitude) {
              acc[club.club_name] = { lat: club.latitude, lng: club.longitude };
            }
            return acc;
          }, {});
        }

        // Step 4: For unmatched (fallback to wso_information)
        const unmatchedNames = uniqueEntries
          .filter((entry: any) => !clubCoords[entry.name])
          .map((entry: any) => entry.name);

        let wsoCoords: Record<string, {lat: number, lng: number}> = {};
        if (unmatchedNames.length > 0) {
          const { data: wsoData, error: wsoError } = await supabase
            .from('wso_information')
            .select('name, geographic_center_lat, geographic_center_lng')
            .in('name', unmatchedNames);

          if (wsoError) throw wsoError;

          wsoCoords = wsoData.reduce((acc: Record<string, any>, wso: any) => {
            if (wso.geographic_center_lat && wso.geographic_center_lng) {
              acc[wso.name] = {
                lat: wso.geographic_center_lat,
                lng: wso.geographic_center_lng,
              };
            }
            return acc;
          }, {});
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
            return null;
          })
          .filter(Boolean) as Spoke[];

        setSpokes(computedSpokes);
      } catch (err: any) {
        console.error('Error fetching meet club locations:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClubLocations();
  }, [meetId]);

  return { spokes, loading, error };
}
