import { useState, useEffect } from 'react';
import { supabaseIWF } from '../../lib/supabaseIWF';

interface Spoke {
  name: string;
  lat: number;
  lng: number;
  count: number;
  code?: string;
}

export function useMeetCountryLocations(meetId: string) {
  const [spokes, setSpokes] = useState<Spoke[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meetId) {
      setSpokes([]);
      setLoading(false);
      return;
    }

    const fetchCountryLocations = async () => {
      try {
        setLoading(true);

        // Step 1: Fetch all results for the meet from IWF table
        const { data: resultsData, error: resultsError } = await supabaseIWF
          .from('iwf_meet_results')
          .select('country_code, country_name')
          .eq('db_meet_id', parseInt(meetId));

        if (resultsError) throw resultsError;

        if (!resultsData || resultsData.length === 0) {
          setSpokes([]);
          setLoading(false);
          return;
        }

        // Step 2: Group by country_code, count athletes, map to name
        const countryMap: Record<string, { name: string; count: number }> = {};
        resultsData.forEach((row: any) => {
          const code = row.country_code;
          const name = row.country_name || code || 'Unknown';
          if (code && code !== 'Unknown') {
            if (!countryMap[code]) {
              countryMap[code] = { name, count: 0 };
            }
            countryMap[code].count += 1;
          }
        });

        const uniqueCodes = Object.keys(countryMap);

        if (uniqueCodes.length === 0) {
          setSpokes([]);
          setLoading(false);
          return;
        }

        // Step 3: Fetch coordinates from country-centers.json
        const response = await fetch('/data/country-centers.json');
        if (!response.ok) {
          throw new Error('Failed to fetch country centers');
        }
        const data: Record<string, { lat: number; lng: number; capital: string }> = await response.json();

        // Step 4: Combine with coordinates
        const computedSpokes: Spoke[] = uniqueCodes
          .map((code) => {
            const center = data[code.toUpperCase()];
            if (center) {
              return {
                name: countryMap[code].name,
                lat: center.lat,
                lng: center.lng,
                count: countryMap[code].count,
                code: code,
              };
            }
            // Log unmatched for debugging
            console.warn(`No coordinates found for country code: ${code} (${countryMap[code].name})`);
            return null;
          })
          .filter(Boolean) as Spoke[];

        console.log(`IWF Meet ${meetId}: Matched ${computedSpokes.length} countries out of ${uniqueCodes.length}`);
        setSpokes(computedSpokes);
      } catch (err: any) {
        console.error('Error fetching meet country locations:', err);
        setError(err.message);
        setSpokes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCountryLocations();
  }, [meetId]);

  return { spokes, loading, error };
}
