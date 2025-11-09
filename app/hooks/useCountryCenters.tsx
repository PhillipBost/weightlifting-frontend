import { useState, useEffect } from 'react';

interface CountryCenter {
  lat: number;
  lng: number;
  capital: string;
}

interface Spoke {
  code: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
}

export function useCountryCenters(countryCodes: string[]) {
  const [spokes, setSpokes] = useState<Spoke[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!countryCodes || countryCodes.length === 0) {
      setSpokes([]);
      setLoading(false);
      return;
    }

    fetch('/data/country-centers.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch country centers');
        }
        return response.json();
      })
      .then((data: Record<string, CountryCenter>) => {
        const uniqueCodes = [...new Set(countryCodes)];
        const computedSpokes: Spoke[] = uniqueCodes
          .map((code) => {
            const center = data[code.toUpperCase()];
            if (center) {
              return {
                code,
                name: center.capital, // Use capital as label
                lat: center.lat,
                lng: center.lng,
                count: 0, // Count will be set externally
              };
            }
            return null;
          })
          .filter(Boolean) as Spoke[];

        setSpokes(computedSpokes);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading country centers:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [countryCodes]);

  return { spokes, loading, error };
}
