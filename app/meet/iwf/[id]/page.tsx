'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseIWF } from '../../../../lib/supabaseIWF';
import { adaptIWFResults } from '../../../../lib/adapters/iwfAdapter';
import { ArrowLeft, Calendar, MapPin, Trophy, Users, ExternalLink, ChevronDown, ChevronRight, Mountain, Database, Medal } from 'lucide-react';
import { ThemeSwitcher } from '../../../components/ThemeSwitcher';

interface MeetResult {
  result_id: number;
  lifter_name: string;
  lifter_id: number;
  weight_class: string;
  best_snatch: string | null;
  best_cj: string | null;
  total: string | null;
  snatch_lift_1: string | null;
  snatch_lift_2: string | null;
  snatch_lift_3: string | null;
  cj_lift_1: string | null;
  cj_lift_2: string | null;
  cj_lift_3: string | null;
  body_weight_kg: string | null;
  gender: string;
  age_category: string;
  competition_age: number | null;
  wso: string;
  club_name: string;
  lifters?: {
    membership_number?: string;
  } | {
    membership_number?: string;
  }[];
  isDuplicateForAge?: boolean;
  ageAppropriateDivisionName?: string;
  // IWF-specific fields
  iwf_lifter_id?: number | null;
  competition_group?: string | null;
  rank?: number | null;
}

interface Meet {
  meet_name: string;
  date: string;
  location: string;
  level: string;
  elevation?: number | null;
  iwf_url?: string | null;
}

// Helper function to convert country code to emoji flag
// Generates flags programmatically from 2-letter ISO codes
const countryCodeToFlag = (code: string): string => {
  if (!code) return '';

  // Reverse mapping from 3-letter to 2-letter codes
  const threeToTwoMapping: Record<string, string> = {
    'AND': 'AD', 'ARE': 'AE', 'AFG': 'AF', 'ATG': 'AG', 'AIA': 'AI', 'ALB': 'AL',
    'ARM': 'AM', 'AGO': 'AO', 'ATA': 'AQ', 'ARG': 'AR', 'ASM': 'AS', 'AUT': 'AT',
    'AUS': 'AU', 'ABW': 'AW', 'ALA': 'AX', 'AZE': 'AZ', 'BIH': 'BA', 'BRB': 'BB',
    'BGD': 'BD', 'BEL': 'BE', 'BFA': 'BF', 'BGR': 'BG', 'BHR': 'BH', 'BDI': 'BI',
    'BEN': 'BJ', 'BLM': 'BL', 'BMU': 'BM', 'BRN': 'BN', 'BOL': 'BO', 'BES': 'BQ',
    'BRA': 'BR', 'BHS': 'BS', 'BTN': 'BT', 'BVT': 'BV', 'BWA': 'BW', 'BLR': 'BY',
    'BLZ': 'BZ', 'CAN': 'CA', 'CCK': 'CC', 'COD': 'CD', 'CAF': 'CF', 'COG': 'CG',
    'CHE': 'CH', 'CIV': 'CI', 'COK': 'CK', 'CHL': 'CL', 'CMR': 'CM', 'CHN': 'CN',
    'COL': 'CO', 'CRI': 'CR', 'CUB': 'CU', 'CPV': 'CV', 'CUW': 'CW', 'CXR': 'CX',
    'CYP': 'CY', 'CZE': 'CZ', 'DEU': 'DE', 'DJI': 'DJ', 'DNK': 'DK', 'DMA': 'DM',
    'DOM': 'DO', 'DZA': 'DZ', 'ECU': 'EC', 'EST': 'EE', 'EGY': 'EG', 'ESH': 'EH',
    'ERI': 'ER', 'ESP': 'ES', 'ETH': 'ET', 'FIN': 'FI', 'FJI': 'FJ', 'FLK': 'FK',
    'FSM': 'FM', 'FRO': 'FO', 'FRA': 'FR', 'GAB': 'GA', 'GBR': 'GB', 'GRD': 'GD',
    'GEO': 'GE', 'GUF': 'GF', 'GGY': 'GG', 'GHA': 'GH', 'GIB': 'GI', 'GRL': 'GL',
    'GMB': 'GM', 'GIN': 'GN', 'GLP': 'GP', 'GNQ': 'GQ', 'GRC': 'GR', 'SGS': 'GS',
    'GTM': 'GT', 'GUM': 'GU', 'GNB': 'GW', 'GUY': 'GY', 'HKG': 'HK', 'HMD': 'HM',
    'HND': 'HN', 'HRV': 'HR', 'HTI': 'HT', 'HUN': 'HU', 'IDN': 'ID', 'IRL': 'IE',
    'ISR': 'IL', 'IMN': 'IM', 'IND': 'IN', 'IOT': 'IO', 'IRQ': 'IQ', 'IRN': 'IR',
    'ISL': 'IS', 'ITA': 'IT', 'JEY': 'JE', 'JAM': 'JM', 'JOR': 'JO', 'JPN': 'JP',
    'KEN': 'KE', 'KGZ': 'KG', 'KHM': 'KH', 'KIR': 'KI', 'COM': 'KM', 'KNA': 'KN',
    'PRK': 'KP', 'KOR': 'KR', 'KWT': 'KW', 'CYM': 'KY', 'KAZ': 'KZ', 'LAO': 'LA',
    'LBN': 'LB', 'LCA': 'LC', 'LIE': 'LI', 'LKA': 'LK', 'LBR': 'LR', 'LSO': 'LS',
    'LTU': 'LT', 'LUX': 'LU', 'LVA': 'LV', 'LBY': 'LY', 'MAR': 'MA', 'MCO': 'MC',
    'MDA': 'MD', 'MNE': 'ME', 'MAF': 'MF', 'MDG': 'MG', 'MHL': 'MH', 'MKD': 'MK',
    'MLI': 'ML', 'MMR': 'MM', 'MNG': 'MN', 'MAC': 'MO', 'MNP': 'MP', 'MTQ': 'MQ',
    'MRT': 'MR', 'MSR': 'MS', 'MLT': 'MT', 'MUS': 'MU', 'MDV': 'MV', 'MWI': 'MW',
    'MEX': 'MX', 'MYS': 'MY', 'MOZ': 'MZ', 'NAM': 'NA', 'NCL': 'NC', 'NER': 'NE',
    'NFK': 'NF', 'NGA': 'NG', 'NIC': 'NI', 'NLD': 'NL', 'NOR': 'NO', 'NPL': 'NP',
    'NRU': 'NR', 'NIU': 'NU', 'NZL': 'NZ', 'OMN': 'OM', 'PAN': 'PA', 'PER': 'PE',
    'PYF': 'PF', 'PNG': 'PG', 'PHL': 'PH', 'PAK': 'PK', 'POL': 'PL', 'SPM': 'PM',
    'PCN': 'PN', 'PRI': 'PR', 'PSE': 'PS', 'PRT': 'PT', 'PLW': 'PW', 'PRY': 'PY',
    'QAT': 'QA', 'REU': 'RE', 'ROU': 'RO', 'SRB': 'RS', 'RUS': 'RU', 'RWA': 'RW',
    'SAU': 'SA', 'SLB': 'SB', 'SYC': 'SC', 'SDN': 'SD', 'SWE': 'SE', 'SGP': 'SG',
    'SHN': 'SH', 'SVN': 'SI', 'SJM': 'SJ', 'SVK': 'SK', 'SLE': 'SL', 'SMR': 'SM',
    'SEN': 'SN', 'SOM': 'SO', 'SUR': 'SR', 'SSD': 'SS', 'STP': 'ST', 'SLV': 'SV',
    'SXM': 'SX', 'SYR': 'SY', 'SWZ': 'SZ', 'TCA': 'TC', 'TCD': 'TD', 'ATF': 'TF',
    'TGO': 'TG', 'THA': 'TH', 'TJK': 'TJ', 'TKL': 'TK', 'TLS': 'TL', 'TKM': 'TM',
    'TUN': 'TN', 'TON': 'TO', 'TUR': 'TR', 'TTO': 'TT', 'TUV': 'TV', 'TWN': 'TW',
    'TZA': 'TZ', 'UKR': 'UA', 'UGA': 'UG', 'UMI': 'UM', 'USA': 'US', 'URY': 'UY',
    'UZB': 'UZ', 'VAT': 'VA', 'VCT': 'VC', 'VEN': 'VE', 'VGB': 'VG', 'VIR': 'VI',
    'VNM': 'VN', 'VUT': 'VU', 'WLF': 'WF', 'WSM': 'WS', 'YEM': 'YE', 'MYT': 'YT',
    'ZAF': 'ZA', 'ZMB': 'ZM', 'ZWE': 'ZW',
  };

  const normalizedCode = code.toUpperCase().trim();

  // Special cases
  if (normalizedCode === 'AIN' || normalizedCode === 'ROC') {
    return '🏳️';
  }

  // Get 2-letter code
  let twoLetterCode = normalizedCode;
  if (normalizedCode.length === 3) {
    twoLetterCode = threeToTwoMapping[normalizedCode] || normalizedCode;
  }

  // Generate flag emoji from 2-letter code
  if (twoLetterCode.length === 2) {
    return twoLetterCode
      .toUpperCase()
      .split('')
      .map(char => String.fromCodePoint(0x1F1E6 + char.charCodeAt(0) - 65))
      .join('');
  }

  return '';
};

const SortIcon = ({ column, sortConfig, division }: {
  column: string;
  sortConfig: { division: string; key: keyof MeetResult | 'place'; direction: 'asc' | 'desc' } | null;
  division: string;
}) => {
  // If no sort is active and this is the "place" column, show it as the default sort (asc)
  if (!sortConfig || sortConfig.division !== division) {
    if (column === 'place') {
      return <span className="text-accent-primary ml-1">↑</span>;
    }
    return <span className="text-app-disabled ml-1">↕</span>;
  }

  if (sortConfig.key !== column) {
    return <span className="text-app-disabled ml-1">↕</span>;
  }

  return (
    <span className="text-accent-primary ml-1">
      {sortConfig.direction === 'asc' ? '↑' : '↓'}
    </span>
  );
};

export default function MeetPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [meet, setMeet] = useState<Meet | null>(null);
  const [results, setResults] = useState<MeetResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    division: string;
    key: keyof MeetResult | 'place';
    direction: 'asc' | 'desc';
  } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;
    
    const fetchMeetData = async () => {
      try {
        setLoading(true);
        
        // Debug logging for environment and connection
        console.log('Environment check:', {
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
          supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
          meetId: resolvedParams.id,
          parsedMeetId: parseInt(resolvedParams.id)
        });
        
        // First, fetch meet information (convert string ID to integer)
        console.log('Fetching meet data for ID:', parseInt(resolvedParams.id));
        const { data: meetData, error: meetError } = await supabaseIWF
          .from('iwf_meets')
          .select('iwf_meet_id, meet, date, level, url')
          .eq('db_meet_id', parseInt(resolvedParams.id))
          .single();

        if (meetError) {
          console.error('Meet fetch error:', meetError);
          console.error('Meet error details:', {
            code: meetError.code,
            message: meetError.message,
            details: meetError.details,
            hint: meetError.hint
          });
          setError(`Meet not found: ${meetError.message}`);
          return;
        }

        console.log('Meet data retrieved:', meetData);

        // Fetch location data using iwf_meet_id
        console.log('Fetching location data for meet ID:', meetData?.iwf_meet_id);
        const { data: locationData, error: locationError } = await supabaseIWF
          .from('iwf_meet_locations')
          .select('*')
          .eq('iwf_meet_id', meetData?.iwf_meet_id);

        // Debug logging for meet 6187
        if (resolvedParams.id === '6187') {
          console.log('Meet data for 6187:', meetData);
          console.log('Searching for meet_id:', parseInt(resolvedParams.id), 'type:', typeof parseInt(resolvedParams.id));
          console.log('Location query error:', locationError);
          console.log('Location data array:', locationData);
          console.log('Location data length:', locationData?.length);
        }

        // Build location string from available data
        let locationStr = 'Location TBD';
        if (locationData && locationData.length > 0 && !locationError) {
          const loc = locationData[0]; // Take the first location record
          console.log('Processing location data:', loc); // Debug all meets
          
          // Prefer location_text if available, then build from components
          if (loc.location_text) {
            locationStr = loc.location_text;
          } else if (loc.venue_name && loc.city && loc.country) {
            locationStr = `${loc.venue_name}, ${loc.city}, ${loc.country}`;
          } else if (loc.city && loc.country) {
            locationStr = `${loc.city}, ${loc.country}`;
          } else if (loc.address) {
            locationStr = loc.address;
          } else if (loc.country) {
            locationStr = loc.country;
          }
        } else {
          console.log('No location data found or query error:', locationError);
          if (locationError) {
            console.error('Location error details:', {
              code: locationError.code,
              message: locationError.message,
              details: locationError.details,
              hint: locationError.hint
            });
          }
        }

        setMeet({
          meet_name: meetData.meet,
          date: meetData.date,
          location: locationStr,
          level: meetData.level || 'International',
          elevation: locationData && locationData.length > 0 ? locationData[0].elevation_meters : null,
          iwf_url: meetData.url || null
        });

        // Fetch results from IWF table (no join needed - data is denormalized)
        console.log('Fetching results data for meet ID:', parseInt(resolvedParams.id));
        const { data: rawIWFResults, error: resultsError } = await supabaseIWF
          .from('iwf_meet_results')
          .select(`
            db_result_id,
            db_lifter_id,
            lifter_name,
            weight_class,
            best_snatch,
            best_cj,
            total,
            snatch_lift_1,
            snatch_lift_2,
            snatch_lift_3,
            cj_lift_1,
            cj_lift_2,
            cj_lift_3,
            body_weight_kg,
            gender,
            age_category,
            competition_age,
            country_code,
            country_name,
            competition_group,
            rank,
            qpoints,
            q_youth,
            q_masters,
            best_snatch_ytd,
            best_cj_ytd,
            best_total_ytd,
            snatch_successful_attempts,
            cj_successful_attempts,
            total_successful_attempts,
            bounce_back_snatch_2,
            bounce_back_snatch_3,
            bounce_back_cj_2,
            bounce_back_cj_3,
            iwf_lifters!inner(iwf_lifter_id)
          `)
          .eq('db_meet_id', parseInt(resolvedParams.id));

        if (resultsError) {
          console.error('Results fetch error:', resultsError);
          console.error('Results error details:', {
            code: resultsError.code,
            message: resultsError.message,
            details: resultsError.details,
            hint: resultsError.hint
          });
          setError(`Error loading meet results: ${resultsError.message}`);
          return;
        }

        console.log('Results data retrieved:', {
          count: rawIWFResults?.length || 0,
          sample: rawIWFResults?.slice(0, 2) || []
        });
        
        // Apply adapter to transform IWF results to USAW-compatible structure
        const adaptedResults = adaptIWFResults(rawIWFResults || []);
        setResults(adaptedResults);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMeetData();
  }, [resolvedParams]);

  const getAgeAppropriateDivision = (result: MeetResult, officialWeightClass: string): string | null => {
    if (!result.competition_age || !officialWeightClass) return null;
    
    const age = result.competition_age;
    const weightClass = officialWeightClass; // Use the same weight class as official division
    
    // Better gender detection - check for "Women's" first, then fallback to gender field or assume male
    let isMale = true;
    if (result.age_category?.toLowerCase().includes("women's")) {
      isMale = false;
    } else if (result.gender === 'F') {
      isMale = false;
    }
    
    const genderPrefix = isMale ? "Men's" : "Women's";
    
    // Youth (13-17) - ONLY show youth division, don't compete against adults
    if (age <= 17) {
      if (age >= 16 && age <= 17) return `${genderPrefix} 16-17 Age Group ${weightClass}`;
      if (age >= 14 && age <= 15) return `${genderPrefix} 14-15 Age Group ${weightClass}`;
      if (age <= 13) return `${genderPrefix} 13 Under Age Group ${weightClass}`;
    }
    
    // Masters (35+) - additional division for masters athletes competing in Open
    if (age >= 35) {
      if (age >= 35 && age <= 39) return `${genderPrefix} Masters (35-39) ${weightClass}`;
      if (age >= 40 && age <= 44) return `${genderPrefix} Masters (40-44) ${weightClass}`;
      if (age >= 45 && age <= 49) return `${genderPrefix} Masters (45-49) ${weightClass}`;
      if (age >= 50 && age <= 54) return `${genderPrefix} Masters (50-54) ${weightClass}`;
      if (age >= 55 && age <= 59) return `${genderPrefix} Masters (55-59) ${weightClass}`;
      if (age >= 60 && age <= 64) return `${genderPrefix} Masters (60-64) ${weightClass}`;
      if (age >= 65 && age <= 69) return `${genderPrefix} Masters (65-69) ${weightClass}`;
      if (age >= 70 && age <= 74) return `${genderPrefix} Masters (70-74) ${weightClass}`;
      if (age >= 75 && age <= 79) return `${genderPrefix} Masters (75-79) ${weightClass}`;
      if (age >= 80) return `${genderPrefix} Masters (80+) ${weightClass}`;
    }
    
    // Junior (15-20) - additional division for junior athletes competing in Open
    if (age >= 15 && age <= 20) return `Junior ${genderPrefix} ${weightClass}`;
    
    // Open/Senior (18+) - primary category, no additional division needed
    return null;
  };

  const groupResultsByDivision = (results: MeetResult[]) => {
    const uniqueCategories = [...new Set(results.map(r => r.age_category))];
    const isMastersOnlyMeet = uniqueCategories.every(cat => cat?.includes('Masters'));
    
    if (isMastersOnlyMeet) {
      // For Masters-only meets, create synthetic Open divisions as parents
      const syntheticOpenGroups: Record<string, MeetResult[]> = {};
      const mastersDivisions: Record<string, MeetResult[]> = {};
      
      results.forEach(result => {
        const weightClass = result.weight_class || 'Unknown';
        const isFemale = result.age_category?.toLowerCase().includes("women's") || result.gender === 'F';
        const syntheticOpenKey = `Open ${isFemale ? "Women's" : "Men's"} ${weightClass}`;
        
        // Add to synthetic open division
        if (!syntheticOpenGroups[syntheticOpenKey]) {
          syntheticOpenGroups[syntheticOpenKey] = [];
        }
        syntheticOpenGroups[syntheticOpenKey].push(result);
        
        // Also track the original Masters division as a sub-division
        const originalKey = `${result.age_category} ${weightClass}`;
        if (!mastersDivisions[originalKey]) {
          mastersDivisions[originalKey] = [];
        }
        mastersDivisions[originalKey].push({
          ...result,
          isDuplicateForAge: true,
          ageAppropriateDivisionName: originalKey
        });
      });
      
      // Create ordered structure: Open division + its Masters sub-divisions
      const orderedGroups: Record<string, MeetResult[]> = {};
      
      Object.entries(syntheticOpenGroups).forEach(([openKey, openResults]) => {
        // Add synthetic open division
        orderedGroups[openKey] = openResults;
        
        // Find and add corresponding Masters divisions
        Object.entries(mastersDivisions).forEach(([mastersKey, mastersResults]) => {
          const mastersWeightClass = mastersKey.split(' ').pop();
          const openWeightClass = openKey.split(' ').pop();
          const mastersGender = mastersKey.toLowerCase().includes("women's") ? "women" : "men";
          const openGender = openKey.toLowerCase().includes("women's") ? "women" : "men";
          
          if (mastersWeightClass === openWeightClass && mastersGender === openGender) {
            orderedGroups[mastersKey] = mastersResults;
          }
        });
      });
      
      // Sort athletes within each division by total (highest first)  
      Object.keys(orderedGroups).forEach(divisionKey => {
        orderedGroups[divisionKey].sort((a, b) => {
          const aTotal = parseFloat(a.total || '0');
          const bTotal = parseFloat(b.total || '0');
          
          // If totals are equal, use bodyweight as tiebreaker (lighter wins)
          if (aTotal === bTotal) {
            const aBodyweight = parseFloat(a.body_weight_kg || '999');
            const bBodyweight = parseFloat(b.body_weight_kg || '999');
            return aBodyweight - bBodyweight;
          }
          
          return bTotal - aTotal; // Higher total first
        });
      });
      
      // Sort the ordered groups by gender and weight class
      return sortDivisionsByPattern(orderedGroups);
    }
    
    // New logic: Establish proper Open parent → child hierarchy
    const allGroups: Record<string, MeetResult[]> = {};
    const ageAppropriateGroups: Record<string, MeetResult[]> = {};
    
    // Helper function to determine age-appropriate division from age
    const getDefaultDivisionFromAge = (age: number | null, gender: string): string => {
      if (!age) return 'Open'; // Default to Open if no age
      
      const genderPrefix = gender === 'F' ? "Women's" : "Men's";
      
      // Youth categories
      if (age <= 13) return `${genderPrefix} 13 Under Age Group`;
      if (age >= 14 && age <= 15) return `${genderPrefix} 14-15 Age Group`;
      if (age >= 16 && age <= 17) return `${genderPrefix} 16-17 Age Group`;
      
      // Junior (15-20)
      if (age >= 15 && age <= 20) return `Junior ${genderPrefix}`;
      
      // Masters (35+)
      if (age >= 35) {
        if (age >= 35 && age <= 39) return `${genderPrefix} Masters (35-39)`;
        if (age >= 40 && age <= 44) return `${genderPrefix} Masters (40-44)`;
        if (age >= 45 && age <= 49) return `${genderPrefix} Masters (45-49)`;
        if (age >= 50 && age <= 54) return `${genderPrefix} Masters (50-54)`;
        if (age >= 55 && age <= 59) return `${genderPrefix} Masters (55-59)`;
        if (age >= 60 && age <= 64) return `${genderPrefix} Masters (60-64)`;
        if (age >= 65 && age <= 69) return `${genderPrefix} Masters (65-69)`;
        if (age >= 70 && age <= 74) return `${genderPrefix} Masters (70-74)`;
        if (age >= 75 && age <= 79) return `${genderPrefix} Masters (75-79)`;
        if (age >= 80) return `${genderPrefix} Masters (80+)`;
      }
      
      // Default to Open for adults
      return `Open ${genderPrefix}`;
    };

    // First pass: collect all divisions with data completion
    results.forEach(result => {
      let officialCategory = result.age_category?.trim();
      let weightClass = result.weight_class?.trim();
      
      // Debug Grant specifically
      if (result.lifter_name === 'Grant Fristo') {
        console.log(`GRANT DEBUG - Original data:`, {
          age_category: `"${result.age_category}"`,
          weight_class: `"${result.weight_class}"`,
          age_category_length: result.age_category?.length,
          weight_class_length: result.weight_class?.length
        });
        console.log(`GRANT DEBUG - After trim:`, {
          officialCategory: `"${officialCategory}"`,
          weightClass: `"${weightClass}"`
        });
      }
      
      // Fill in missing data using age-appropriate defaults
      let updatedResult = { ...result };
      
      // Check for invalid age_category values
      if (!officialCategory || officialCategory === 'Unknown' || officialCategory === '-' || officialCategory === 'null') {
        const defaultCategory = getDefaultDivisionFromAge(result.competition_age, result.gender);
        officialCategory = defaultCategory;
        updatedResult.age_category = defaultCategory; // Update the result object
        console.log(`Filled missing age_category for ${result.lifter_name}: ${defaultCategory}`);
      }
      
      // Check for invalid weight_class values  
      if (!weightClass || weightClass === 'Unknown' || weightClass === '-' || weightClass === 'null') {
        // For now, use a default weight class - could be improved with body weight logic
        weightClass = result.gender === 'F' ? '63kg' : '77kg'; // Common middle weight classes
        updatedResult.weight_class = weightClass; // Update the result object
        console.log(`Filled missing weight_class for ${result.lifter_name}: ${weightClass}`);
      }
      
      const officialKey = `${officialCategory} ${weightClass}`;
      console.log(`DEBUG for ${result.lifter_name}: officialCategory="${officialCategory}", weightClass="${weightClass}", officialKey="${officialKey}"`);
      
      if (!allGroups[officialKey]) {
        allGroups[officialKey] = [];
      }
      allGroups[officialKey].push(updatedResult); // Use updated result
      
      // Create age-appropriate divisions for athletes competing in Open
      const ageAppropriateDivision = getAgeAppropriateDivision(updatedResult, weightClass);
      console.log(`Lifter: ${updatedResult.lifter_name}, Age: ${updatedResult.competition_age}, Official: ${officialKey}, Age-appropriate: ${ageAppropriateDivision}`);
      if (ageAppropriateDivision && ageAppropriateDivision !== officialKey) {
        if (!ageAppropriateGroups[ageAppropriateDivision]) {
          ageAppropriateGroups[ageAppropriateDivision] = [];
        }
        ageAppropriateGroups[ageAppropriateDivision].push({
          ...updatedResult,
          isDuplicateForAge: true,
          ageAppropriateDivisionName: ageAppropriateDivision
        });
      }
    });
    
    // Second pass: Establish parent-child relationships
    const combinedGroups: Record<string, MeetResult[]> = {};
    const processedWeightClasses = new Set<string>();
    
    // Extract weight class from division key and normalize for comparison
    const getWeightClassFromDivision = (divisionKey: string): string => {
      const weightMatch = divisionKey.match(/(\+?\d+\+?)\s*[Kk]g$/i);
      if (weightMatch) {
        // Normalize: convert to lowercase and ensure consistent spacing
        return weightMatch[0].toLowerCase().replace(/\s+/g, ' ').trim();
      }
      return 'Unknown';
    };
    
    // Find all weight classes that have Open divisions
    const openDivisions = new Set<string>();
    Object.keys(allGroups).forEach(divisionKey => {
      if (divisionKey.includes('Open')) {
        const weightClass = getWeightClassFromDivision(divisionKey);
        openDivisions.add(weightClass);
      }
    });
    
    // Helper function to check if lifters from one division also appear in another
    const getDivisionLifterIds = (divisionKey: string): Set<number> => {
      const division = allGroups[divisionKey];
      return new Set(division ? division.map(result => result.lifter_id) : []);
    };
    
    // Process in two phases: 1) Open parents and their eligible children, 2) Standalone divisions
    const assignedAsChildren = new Set<string>();
    
    // Phase 1: Process ONLY Open divisions first (force priority)
    const openDivisionKeys = Object.keys(allGroups).filter(key => key.includes('Open'));
    
    openDivisionKeys.forEach(divisionKey => {
      const results = allGroups[divisionKey];
      // Open divisions are always parents
      combinedGroups[divisionKey] = results;
      const weightClass = getWeightClassFromDivision(divisionKey);
      processedWeightClasses.add(weightClass);
      
      console.log(`Processing Open division: ${divisionKey} with weight class: ${weightClass}`);
      
      // Find all OTHER divisions with same weight class and check for lifter overlap
      Object.entries(allGroups).forEach(([otherDivisionKey, otherResults]) => {
        if (otherDivisionKey !== divisionKey && 
            !otherDivisionKey.includes('Open') && // Don't process other Open divisions as children
            getWeightClassFromDivision(otherDivisionKey) === weightClass &&
            !assignedAsChildren.has(otherDivisionKey)) { // Don't reassign already assigned children
          
          const openLifterIds = getDivisionLifterIds(divisionKey);
          const otherLifterIds = getDivisionLifterIds(otherDivisionKey);
          
          // Check if any lifters appear in both divisions
          const hasOverlap = [...otherLifterIds].some(id => openLifterIds.has(id));
          
          if (hasOverlap) {
            // Some lifters competed in both - this becomes a child of the Open division
            console.log(`  Assigning ${otherDivisionKey} as child (overlap found)`);
            combinedGroups[otherDivisionKey] = otherResults.map(result => ({
              ...result,
              isDuplicateForAge: true,
              ageAppropriateDivisionName: otherDivisionKey
            }));
            assignedAsChildren.add(otherDivisionKey);
          } else {
            console.log(`  ${otherDivisionKey} remains standalone (no overlap)`);
          }
        }
      });
    });
    
    // Phase 2: Process remaining divisions as standalone parents (no children allowed)
    Object.entries(allGroups).forEach(([divisionKey, results]) => {
      if (!divisionKey.includes('Open') && !assignedAsChildren.has(divisionKey)) {
        // Non-Open divisions become standalone parents but can never have children
        // Make sure they are NOT marked as age-appropriate (which would make them children)
        combinedGroups[divisionKey] = results;
        console.log(`Creating standalone parent: ${divisionKey} (no children allowed)`);
      }
    });
    
    // Add age-appropriate groups - but ONLY if they're not already processed
    Object.entries(ageAppropriateGroups).forEach(([divisionKey, results]) => {
      if (!combinedGroups[divisionKey]) {
        combinedGroups[divisionKey] = results;
        console.log(`Adding age-appropriate group: ${divisionKey}`);
      }
    });
    
    console.log('Open divisions found for weight classes:', Array.from(openDivisions));
    console.log('All combined groups:', Object.keys(combinedGroups));
    
    // Sort athletes within each division by total (highest first)
    Object.keys(combinedGroups).forEach(divisionKey => {
      combinedGroups[divisionKey].sort((a, b) => {
        const aTotal = parseFloat(a.total || '0');
        const bTotal = parseFloat(b.total || '0');
        
        // If totals are equal, use bodyweight as tiebreaker (lighter wins)
        if (aTotal === bTotal) {
          const aBodyweight = parseFloat(a.body_weight_kg || '999');
          const bBodyweight = parseFloat(b.body_weight_kg || '999');
          return aBodyweight - bBodyweight;
        }
        
        return bTotal - aTotal; // Higher total first
      });
    });
    
    // Don't use sortDivisionsByPattern as it destroys parent-child relationships
    // Instead, we already have the correct structure from our grouping logic
    const orderedGroups: Record<string, MeetResult[]> = combinedGroups;
    
    // Sort the division keys manually while preserving parent-child relationships
    const parentDivisions: string[] = [];
    const childDivisions: Record<string, string[]> = {}; // parent -> children mapping
    
    // Identify parents and children
    Object.keys(orderedGroups).forEach(divisionKey => {
      try {
        const results = orderedGroups[divisionKey];
        const hasChildrenMarked = results && results.some && results.some(result => result && result.isDuplicateForAge);
        
        console.log(`DIVISION ANALYSIS: ${divisionKey} - hasChildrenMarked: ${hasChildrenMarked}`);
        
        if (hasChildrenMarked) {
          // This is a child division
          // Find its parent (should be an Open division with same weight class AND gender)
          const weightClass = getWeightClassFromDivision(divisionKey);
          const isFemaleChild = divisionKey.toLowerCase().includes("women's");
          const parentKey = Object.keys(orderedGroups).find(key => {
            const isOpen = key.includes('Open');
            const sameWeightClass = getWeightClassFromDivision(key) === weightClass;
            const isFemaleParent = key.toLowerCase().includes("women's");
            const sameGender = isFemaleChild === isFemaleParent;
            return isOpen && sameWeightClass && sameGender;
          });
          
          console.log(`${divisionKey} -> CHILD (weightClass: ${weightClass}) -> looking for Open parent: ${parentKey}`);
          
          if (parentKey) {
            if (!childDivisions[parentKey]) {
              childDivisions[parentKey] = [];
            }
            childDivisions[parentKey].push(divisionKey);
          }
        } else {
          // This is a parent division
          console.log(`${divisionKey} -> PARENT`);
          parentDivisions.push(divisionKey);
        }
      } catch (error) {
        console.error(`Error processing division ${divisionKey}:`, error);
        // Default to parent if there's an error
        parentDivisions.push(divisionKey);
      }
    });
    
    // Sort parents by weight class and gender (simplified sorting)
    const sortedParents = parentDivisions.sort((a, b) => {
      // Extract basic sorting info without getSortKey
      const aFemale = a.toLowerCase().includes("women's");
      const bFemale = b.toLowerCase().includes("women's");
      
      // Gender first (men before women)
      if (aFemale !== bFemale) {
        return aFemale ? 1 : -1;
      }
      
      // Then by weight class (heaviest first)
      const aWeightMatch = a.match(/(\+?\d+\+?)\s*[Kk]g$/i);
      const bWeightMatch = b.match(/(\+?\d+\+?)\s*[Kk]g$/i);
      
      if (aWeightMatch && bWeightMatch) {
        const aWeight = parseFloat(aWeightMatch[1].replace('+', '')) + (aWeightMatch[0].includes('+') ? 0.1 : 0);
        const bWeight = parseFloat(bWeightMatch[1].replace('+', '')) + (bWeightMatch[0].includes('+') ? 0.1 : 0);
        return bWeight - aWeight; // Descending (heaviest first)
      }
      
      return 0;
    });
    
    // Rebuild ordered structure: parent followed by its children
    const finalOrderedGroups: Record<string, MeetResult[]> = {};
    
    sortedParents.forEach(parentKey => {
      // Add parent
      finalOrderedGroups[parentKey] = orderedGroups[parentKey];
      
      // Add its children (if any) in sorted order
      if (childDivisions[parentKey]) {
        const sortedChildren = childDivisions[parentKey].sort((a, b) => {
          // Simple comparison for children
          if (a < b) return -1;
          if (a > b) return 1;
          return 0;
        });
        
        sortedChildren.forEach(childKey => {
          finalOrderedGroups[childKey] = orderedGroups[childKey];
        });
      }
    });
    
    console.log('Parent divisions:', parentDivisions);
    console.log('Child mapping:', childDivisions);
    
    return finalOrderedGroups;
  };

  const sortDivisionsByPattern = (groups: Record<string, MeetResult[]>): Record<string, MeetResult[]> => {
    console.log('All division keys before sorting:', Object.keys(groups));
    
    // Parse weight class to numeric value for sorting (heaviest to lightest)
    const parseWeightClass = (weightClass: string): number => {
      // Handle plus symbol - these are always the heaviest (unlimited) weight classes
      if (weightClass.startsWith('+')) {
        const weight = parseFloat(weightClass.substring(1).replace('kg', ''));
        return weight + 1000; // Add 1000 to ensure plus classes sort first (heaviest)
      }
      
      // Handle regular weight classes - extract numeric value
      const weight = parseFloat(weightClass.replace('kg', ''));
      return isNaN(weight) ? -1 : weight; // Unknown weights go to end
    };
    
    const getWeightClassValue = (weightClass: string): number => {
      const weight = parseWeightClass(weightClass);
      console.log(`Weight class ${weightClass} -> parsed weight ${weight}`);
      return weight === -1 ? 9999 : -weight; // Negative for descending sort (heaviest first), unknown at end
    };
    
    const getSortKey = (divisionKey: string) => {
      const isFemale = divisionKey.toLowerCase().includes("women's");
      
      // Extract weight class - handle all variations: 63+kg, 110+kg, +58 Kg, +105 kg, +87kg, etc.
      const weightMatch = divisionKey.match(/(\+?\d+\+?)\s*[Kk]g$/i);
      const weightClass = weightMatch ? weightMatch[0] : 'Unknown';
      
      // Parse weight class directly for sorting
      let weightValue = 0;
      if (weightClass !== 'Unknown') {
        // Extract just the numeric part and check for plus signs
        const numericPart = weightClass.match(/(\d+)/);
        const hasPlus = weightClass.includes('+');
        
        if (numericPart) {
          const baseWeight = parseFloat(numericPart[1]);
          // Plus classes are slightly heavier than their base weight
          weightValue = hasPlus ? baseWeight + 0.1 : baseWeight;
        }
      }
      
      // Determine division type priority: Open < Junior < Masters age groups
      let divisionPriority = 0;
      let ageGroup = 0;
      
      if (divisionKey.includes('Open') || (!divisionKey.includes('Masters') && !divisionKey.includes('Junior'))) {
        divisionPriority = 0; // Open/main divisions first
      } else if (divisionKey.includes('Junior')) {
        divisionPriority = 1; // Junior second
      } else if (divisionKey.includes('Masters')) {
        divisionPriority = 2; // Masters last
        // Extract age range for Masters sorting (oldest first)
        if (divisionKey.includes('(80+)')) ageGroup = 0;
        else if (divisionKey.includes('(75-79)')) ageGroup = 1;
        else if (divisionKey.includes('(70-74)')) ageGroup = 2;
        else if (divisionKey.includes('(65-69)')) ageGroup = 3;
        else if (divisionKey.includes('(60-64)')) ageGroup = 4;
        else if (divisionKey.includes('(55-59)')) ageGroup = 5;
        else if (divisionKey.includes('(50-54)')) ageGroup = 6;
        else if (divisionKey.includes('(45-49)')) ageGroup = 7;
        else if (divisionKey.includes('(40-44)')) ageGroup = 8;
        else if (divisionKey.includes('(35-39)')) ageGroup = 9;
      }
      
      const sortKey = {
        gender: isFemale ? 1 : 0, // Men first (0), then Women (1)
        weight: -weightValue, // Negative for descending sort (heaviest first)
        divisionType: divisionPriority, // Open, then Junior, then Masters
        ageGroup: ageGroup // For Masters: oldest to youngest
      };
      
      console.log(`Division: ${divisionKey} -> WeightClass: ${weightClass}, ParsedWeight: ${weightValue}, SortWeight: ${sortKey.weight}, Gender: ${sortKey.gender} (${isFemale ? 'Female' : 'Male'}), Type: ${sortKey.divisionType}`);
      return sortKey;
    };
    
    // Sort division keys according to pattern
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const aKey = getSortKey(a);
      const bKey = getSortKey(b);
      
      // First sort by gender (men first)
      if (aKey.gender !== bKey.gender) {
        return aKey.gender - bKey.gender;
      }
      
      // Then by weight class (heaviest first)
      if (aKey.weight !== bKey.weight) {
        return aKey.weight - bKey.weight;
      }
      
      // Then by division type (Open, Junior, Masters)
      if (aKey.divisionType !== bKey.divisionType) {
        return aKey.divisionType - bKey.divisionType;
      }
      
      // Finally by age group for Masters (oldest to youngest)
      return aKey.ageGroup - bKey.ageGroup;
    });
    
    // Rebuild the ordered object
    const sortedGroups: Record<string, MeetResult[]> = {};
    sortedKeys.forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  };

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const groupResultsByGenderAndDivision = (orderedGroups: Record<string, MeetResult[]>) => {
    // Use ordered objects to preserve the sort order established by sortDivisionsByPattern
    const mensResults: [string, MeetResult[]][] = [];
    const womensResults: [string, MeetResult[]][] = [];

    // Maintain the order by iterating through the already-sorted orderedGroups
    Object.entries(orderedGroups).forEach(([division, results]) => {
      // Check the actual gender field of the results, not just the division name
      const isFemale = results.length > 0 && results[0].gender === 'F';
      if (isFemale) {
        womensResults.push([division, results]);
      } else {
        mensResults.push([division, results]);
      }
    });

    // Convert back to objects while preserving order
    const genderSections: Record<string, Record<string, MeetResult[]>> = {
      "Men's Results": Object.fromEntries(mensResults),
      "Women's Results": Object.fromEntries(womensResults)
    };

    return genderSections;
  };

  const getAthleteUrl = (result: MeetResult) => {
    // IWF results use iwf_lifter_id for athlete pages
    return `/athlete/iwf/${result.iwf_lifter_id}`;
  };

  const handleSort = (division: string, key: keyof MeetResult | 'place') => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.division === division && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ division, key, direction });
  };

  const getSortedResults = (divisionResults: MeetResult[], division: string) => {
    if (!sortConfig || sortConfig.division !== division) {
      return divisionResults;
    }

    return [...divisionResults].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortConfig.key === 'place') {
        // Calculate place based on position in division array (ignore database rank which may be incorrect)
        aValue = divisionResults.indexOf(a) + 1;
        bValue = divisionResults.indexOf(b) + 1;
      } else if (sortConfig.key === 'lifter_name') {
        aValue = a.lifter_name.toLowerCase();
        bValue = b.lifter_name.toLowerCase();
      } else if (sortConfig.key === 'club_name') {
        aValue = (a.club_name || '').toLowerCase();
        bValue = (b.club_name || '').toLowerCase();
      } else if (sortConfig.key === 'best_snatch' || sortConfig.key === 'best_cj' || sortConfig.key === 'total' || sortConfig.key === 'body_weight_kg') {
        aValue = parseFloat(a[sortConfig.key] || '0');
        bValue = parseFloat(b[sortConfig.key] || '0');
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-lg text-app-secondary">Loading meet results...</p>
        </div>
      </div>
    );
  }

  if (error || !meet) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-app-primary mb-4">Error Loading Meet</h1>
          <p className="text-app-secondary mb-4">{error || 'Meet not found'}</p>
          <button 
            onClick={() => router.back()}
            className="bg-accent-primary hover:bg-accent-primary-hover text-app-primary px-6 py-2 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const groupedResults = groupResultsByDivision(results);
  const genderGroupedResults = groupResultsByGenderAndDivision(groupedResults);

  return (
    <div className="min-h-screen bg-app-gradient">
      {/* Header */}
      <header className="bg-header-blur border-b border-app-secondary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <Image
                  src="/logo.png"
                  alt="WeightliftingDB Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
                <div>
                  <div className="text-lg font-bold text-app-primary">WeightliftingDB</div>
                  <div className="text-xs text-app-tertiary">International Weightlifting Federation Results</div>
                </div>
              </Link>
              <button
                onClick={() => router.back()}
                className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              {meet?.iwf_url && (
                <button
                  onClick={() => window.open(meet.iwf_url, '_blank')}
                  className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>IWF Official Results</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Meet Header */}
        <div className="card-primary mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-app-primary mb-2">
                {meet.meet_name}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-app-secondary">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(meet.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>{meet.location}</span>
                </div>
                {meet.elevation && (
                  <div className="flex items-center space-x-2">
                    <Mountain className="h-4 w-4" />
                    <span>{meet.elevation.toLocaleString()}m elevation</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Trophy className="h-4 w-4" />
                  <span>{meet.level}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>{results.length} Athletes</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results by Gender Section */}
        {Object.entries(genderGroupedResults).map(([genderSection, divisionsInSection]) => {
          const isCollapsed = collapsedSections.has(genderSection);
          const hasDivisions = Object.keys(divisionsInSection).length > 0;
          
          if (!hasDivisions) return null;

          return (
            <div key={genderSection} className="mb-4">
              {/* Gender Section Header */}
              <div className="mb-3">
                <button
                  onClick={() => toggleSection(genderSection)}
                  className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
                >
                  {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  <h2 className="text-2xl font-bold">
                    {genderSection}
                  </h2>
                  <span className="text-sm text-app-muted ml-2">
                    ({Object.values(divisionsInSection).reduce((total, divisionResults) => total + divisionResults.length, 0)} athletes)
                  </span>
                </button>
              </div>

              {/* Divisions within Gender Section */}
              {!isCollapsed && Object.entries(divisionsInSection).map(([division, divisionResults]) => {
                const isAgeAppropriate = divisionResults.some(result => result.isDuplicateForAge);
                const isDivisionCollapsed = collapsedSections.has(division);
                
                return (
                  <div key={division} className={`card-primary mb-2 ${isAgeAppropriate ? 'ml-6 border-l-4 border-accent-primary bg-app-tertiary' : ''}`}>
                    <div 
                      onClick={() => toggleSection(division)}
                      className="cursor-pointer hover:bg-app-hover transition-colors"
                    >
                      <h3 className={`text-lg font-bold p-2 flex items-center ${isAgeAppropriate ? 'text-app-primary' : 'text-app-primary'}`}>
                        {isDivisionCollapsed ? <ChevronRight className="h-5 w-5 mr-2" /> : <ChevronDown className="h-5 w-5 mr-2" />}
                        {isAgeAppropriate && (
                          <span className="mr-2 text-app-muted">↳</span>
                        )}
                        {division}
                        {isAgeAppropriate && (
                          <span className="ml-2 text-sm font-normal text-app-muted">(Age Group Rankings)</span>
                        )}
                        <span className="ml-auto text-sm text-app-muted">{divisionResults.length} athletes</span>
                      </h3>
                    </div>
                    
                    {!isDivisionCollapsed && (
                      <div className="overflow-x-auto">
                        <table className="border-separate" style={{borderSpacing: 0, width: 'auto'}}>
                          <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                            <tr className="border-b-2 border-gray-400 dark:border-gray-500">
                              <th
                                onClick={() => handleSort(division, 'place')}
                                className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{width: '60px'}}
                              >
                                <div className="flex items-center justify-start space-x-1">
                                  <span>Place</span>
                                  <SortIcon column="place" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'lifter_name')}
                                className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{minWidth: '200px'}}
                              >
                                <div className="flex items-center justify-start space-x-1">
                                  <span>Athlete</span>
                                  <SortIcon column="lifter_name" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none"
                                style={{minWidth: '80px'}}
                              >
                                <div className="flex items-center justify-start space-x-1">
                                  <span>Group</span>
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'club_name')}
                                className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{minWidth: '120px'}}
                              >
                                <div className="flex items-center justify-start space-x-1">
                                  <span>Country</span>
                                  <SortIcon column="club_name" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th className="w-full"></th>
                              <th
                                onClick={() => handleSort(division, 'best_snatch')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{width: '80px'}}
                              >
                                <div className="flex items-center justify-end space-x-1">
                                  <span>Snatch</span>
                                  <SortIcon column="best_snatch" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'best_cj')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{width: '80px'}}
                              >
                                <div className="flex items-center justify-end space-x-1">
                                  <span>C&J</span>
                                  <SortIcon column="best_cj" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'total')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{width: '80px'}}
                              >
                                <div className="flex items-center justify-end space-x-1">
                                  <span>Total</span>
                                  <SortIcon column="total" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'body_weight_kg')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{width: '100px'}}
                              >
                                <div className="flex items-center justify-end space-x-1">
                                  <span>Bodyweight</span>
                                  <SortIcon column="body_weight_kg" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSortedResults(divisionResults, division).map((result, index) => {
                              const originalIndex = divisionResults.indexOf(result);
                              const displayPlace = originalIndex + 1;
                              
                              return (
                              <tr key={result.result_id} className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors group" style={{ borderTopColor: 'var(--border-secondary)' }}>
                                <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-app-primary">
                                  <div className="flex items-center gap-1">
                                    <span>{displayPlace}</span>
                                    {displayPlace === 1 && <Medal className="h-4 w-4" style={{ color: '#FFD700' }} />}
                                    {displayPlace === 2 && <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />}
                                    {displayPlace === 3 && <Medal className="h-4 w-4" style={{ color: '#CD7F32' }} />}
                                  </div>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap">
                                  <button
                                    onClick={() => router.push(getAthleteUrl(result))}
                                    className="flex items-center space-x-1 text-accent-primary group-hover:text-accent-primary-hover transition-colors"
                                  >
                                    <span className="font-medium text-sm">{result.lifter_name}</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                  <div className="text-xs text-app-muted">
                                    {result.competition_age && `Age ${result.competition_age}`}
                                    {(() => {
                                      return (
                                        <>
                                          {result.iwf_lifter_id && result.competition_age && " • "}
                                          {result.iwf_lifter_id && `#${result.iwf_lifter_id}`}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-app-secondary">
                                  {result.competition_group ? (
                                    <span className="inline-block px-2 py-0.5 bg-accent-primary/20 text-accent-primary rounded font-semibold text-xs">
                                      {result.competition_group}
                                    </span>
                                  ) : (
                                    <span className="text-app-muted">-</span>
                                  )}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-app-secondary">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{countryCodeToFlag(result.wso || '')}</span>
                                    <span className="text-sm">{result.club_name || '-'}</span>
                                  </div>
                                </td>
                                <td></td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-left" style={{ color: 'var(--chart-snatch)' }}>
                                  <div className="font-medium">{result.best_snatch ? `${result.best_snatch}kg` : '-'}</div>
                                  <div className="text-xs text-app-muted">
                                    {[result.snatch_lift_1, result.snatch_lift_2, result.snatch_lift_3]
                                      .filter(attempt => attempt && attempt !== '0')
                                      .map((attempt, i) => {
                                        const weight = parseInt(attempt!);
                                        return (
                                          <span key={i} className={weight > 0 ? '' : 'text-red-500'} style={weight > 0 ? { color: 'var(--chart-snatch)' } : {}}>
                                            {Math.abs(weight)}
                                            {i < 2 ? '/' : ''}
                                          </span>
                                        );
                                      })}
                                  </div>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-left" style={{ color: 'var(--chart-cleanjerk)' }}>
                                  <div className="font-medium">{result.best_cj ? `${result.best_cj}kg` : '-'}</div>
                                  <div className="text-xs text-app-muted">
                                    {[result.cj_lift_1, result.cj_lift_2, result.cj_lift_3]
                                      .filter(attempt => attempt && attempt !== '0')
                                      .map((attempt, i) => {
                                        const weight = parseInt(attempt!);
                                        return (
                                          <span key={i} className={weight > 0 ? '' : 'text-red-500'} style={weight > 0 ? { color: 'var(--chart-cleanjerk)' } : {}}>
                                            {Math.abs(weight)}
                                            {i < 2 ? '/' : ''}
                                          </span>
                                        );
                                      })}
                                  </div>
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm font-bold text-left" style={{ color: 'var(--chart-total)' }}>
                                  {result.total ? `${result.total}kg` : '-'}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-sm text-app-secondary text-left">
                                  {result.body_weight_kg ? `${result.body_weight_kg}kg` : '-'}
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}