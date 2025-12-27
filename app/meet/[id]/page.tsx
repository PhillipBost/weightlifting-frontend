'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '../../../lib/supabase/client';
import { ArrowLeft, Calendar, MapPin, Trophy, Users, ExternalLink, ChevronDown, ChevronRight, Mountain, Database, Medal } from 'lucide-react';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { useMeetClubLocations } from '../../hooks/useMeetClubLocations';
import dynamic from 'next/dynamic';

const MeetHubSpokeMap = dynamic(() => import('../../components/MeetHubSpokeMap'), { ssr: false });

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
  qpoints?: number;
  q_youth?: number;
  q_masters?: number;
  rank?: number; // Static rank property
  lifters: {
    membership_number: string;
  } | {
    membership_number: string;
  }[];
  isDuplicateForAge?: boolean; // Flag for age-appropriate grouping
  ageAppropriateDivisionName?: string; // Name of the age-appropriate division
}

interface Meet {
  meet_name: string;
  date: string;
  location: string;
  level: string;
  elevation?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  URL?: string | null;
}

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
  const supabase = createClient();
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
  /* Updated to match new section titles */
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["Men's Results by Division", "Women's Results by Division"]));

  const [showMenSummary, setShowMenSummary] = useState(false);
  const [showWomenSummary, setShowWomenSummary] = useState(false);

  // Track sort config for each gender independently
  const [menSortConfig, setMenSortConfig] = useState<{
    key: keyof MeetResult | 'rank';
    direction: 'asc' | 'desc';
  } | null>(null);
  const [womenSortConfig, setWomenSortConfig] = useState<{
    key: keyof MeetResult | 'rank';
    direction: 'asc' | 'desc';
  } | null>(null);

  // Hook to fetch club/spoke data for the map
  const { spokes, loading: mapLoading, error: mapError } = useMeetClubLocations(resolvedParams?.id || '');

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

        // First, fetch meet information (convert string ID to integer)
        const { data: meetData, error: meetError } = await supabase
          .from('usaw_meets')
          .select('Meet, Date, Level, city, state, address, elevation_meters, latitude, longitude, URL')
          .eq('meet_id', parseInt(resolvedParams.id))
          .single();

        if (meetError || !meetData) {
          setError(`Meet not found: ${meetError?.message || 'No data returned'}`);
          return;
        }

        // Build location string directly from meets columns
        let locationStr = 'Location TBD';
        if (meetData.address && meetData.city && meetData.state) {
          locationStr = `${meetData.address}, ${meetData.city}, ${meetData.state}`;
        } else if (meetData.city && meetData.state) {
          locationStr = `${meetData.city}, ${meetData.state}`;
        } else if (meetData.city) {
          locationStr = meetData.city;
        } else if (meetData.state) {
          locationStr = meetData.state;
        } else if (meetData.address) {
          locationStr = meetData.address;
        }

        setMeet({
          meet_name: meetData.Meet,
          date: meetData.Date,
          location: locationStr,
          level: meetData.Level || 'Local',
          elevation: meetData.elevation_meters ?? null,
          latitude: meetData.latitude,
          longitude: meetData.longitude,
          URL: meetData.URL
        });

        // Then fetch all results for this meet - join with lifters table to get membership_number
        const { data: resultsData, error: resultsError } = await supabase
          .from('usaw_meet_results')
          .select(`
            result_id,
            lifter_name,
            lifter_id,
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
            wso,
            club_name,
            qpoints,
            q_youth,
            q_masters,
            lifters:usaw_lifters!inner(membership_number)
          `)
          .eq('meet_id', parseInt(resolvedParams.id));

        if (resultsError) {
          setError(`Error loading meet results: ${resultsError.message}`);
          return;
        }

        setResults(resultsData || []);
      } catch (err) {
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


      // Fill in missing data using age-appropriate defaults
      let updatedResult = { ...result };

      // Check for invalid age_category values
      if (!officialCategory || officialCategory === 'Unknown' || officialCategory === '-' || officialCategory === 'null') {
        const defaultCategory = getDefaultDivisionFromAge(result.competition_age, result.gender);
        officialCategory = defaultCategory;
        updatedResult.age_category = defaultCategory; // Update the result object

      }

      // Check for invalid weight_class values  
      if (!weightClass || weightClass === 'Unknown' || weightClass === '-' || weightClass === 'null') {
        // For now, use a default weight class - could be improved with body weight logic
        weightClass = result.gender === 'F' ? '63kg' : '77kg'; // Common middle weight classes
        updatedResult.weight_class = weightClass; // Update the result object

      }

      const officialKey = `${officialCategory} ${weightClass}`;

      if (!allGroups[officialKey]) {
        allGroups[officialKey] = [];
      }
      allGroups[officialKey].push(updatedResult); // Use updated result

      // Create age-appropriate divisions for athletes competing in Open
      const ageAppropriateDivision = getAgeAppropriateDivision(updatedResult, weightClass);

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

            combinedGroups[otherDivisionKey] = otherResults.map(result => ({
              ...result,
              isDuplicateForAge: true,
              ageAppropriateDivisionName: otherDivisionKey
            }));
            assignedAsChildren.add(otherDivisionKey);
          } else {

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

      }
    });

    // Add age-appropriate groups - but ONLY if they're not already processed
    Object.entries(ageAppropriateGroups).forEach(([divisionKey, results]) => {
      if (!combinedGroups[divisionKey]) {
        combinedGroups[divisionKey] = results;

      }
    });




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



          if (parentKey) {
            if (!childDivisions[parentKey]) {
              childDivisions[parentKey] = [];
            }
            childDivisions[parentKey].push(divisionKey);
          }
        } else {
          // This is a parent division

          parentDivisions.push(divisionKey);
        }
      } catch (error) {

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




    return finalOrderedGroups;
  };

  const sortDivisionsByPattern = (groups: Record<string, MeetResult[]>): Record<string, MeetResult[]> => {


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
      const isFemale = division.toLowerCase().includes("women's");
      if (isFemale) {
        womensResults.push([division, results]);
      } else {
        mensResults.push([division, results]);
      }
    });

    // Convert back to objects while preserving order
    const genderSections: Record<string, Record<string, MeetResult[]>> = {
      "Men's Results by Division": Object.fromEntries(mensResults),
      "Women's Results by Division": Object.fromEntries(womensResults)
    };

    return genderSections;
  };

  const getAthleteUrl = (result: MeetResult) => {
    // First choice: membership number if available and valid
    const membershipNumber = Array.isArray(result.lifters)
      ? result.lifters[0]?.membership_number
      : result.lifters?.membership_number;

    if (membershipNumber && membershipNumber !== 'null') {
      return `/athlete/${membershipNumber}`;
    }

    // Fallback 1: Internal lifter ID
    if (result.lifter_id) {
      return `/athlete/u-${result.lifter_id}`;
    }

    // Fallback 2: athlete name formatted for URL (legacy support)
    const nameForUrl = result.lifter_name.toLowerCase().replace(/\s+/g, '-');
    return `/athlete/${nameForUrl}`;
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
        // Place is based on index position
        aValue = divisionResults.indexOf(a);
        bValue = divisionResults.indexOf(b);
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

            {/* External Link */}
            {meet.URL && (
              <div className="flex flex-col gap-2">
                <a
                  href={meet.URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Official Results</span>
                </a>
              </div>
            )}
          </div>
        </div>
        {/* Hub and Spoke Map */}
        {meet.latitude && meet.longitude && (
          <div className="card-primary mb-8">
            <MeetHubSpokeMap
              meetLat={meet.latitude}
              meetLng={meet.longitude}
              spokes={spokes}
              type="club"
              loading={mapLoading}
              error={mapError}
            />
          </div>
        )}

        {/* NEW SUMMARY TABLES */}
        {(() => {
          // Helper: Get dominant category (most populated)
          const getDominantCategory = (list: MeetResult[]) => {
            let youthCount = 0;
            let openCount = 0;
            let mastersCount = 0;

            list.forEach(r => {
              if ((r.q_youth ?? 0) > 0) youthCount++;
              if ((r.qpoints ?? 0) > 0) openCount++;
              if ((r.q_masters ?? 0) > 0) mastersCount++;
            });

            if (youthCount >= openCount && youthCount >= mastersCount && youthCount > 0) return 'q_youth';
            if (mastersCount >= openCount && mastersCount > 0) return 'q_masters';
            return 'qpoints'; // Default to open/standard Q-points
          };

          const splitByGender = () => {
            const men: MeetResult[] = [];
            const women: MeetResult[] = [];
            results.forEach(r => {
              const isFemale = r.age_category?.toLowerCase().includes("women's") || r.gender === 'F';
              if (isFemale) women.push(r);
              else men.push(r);
            });
            return { men, women };
          };

          const { men, women } = splitByGender();

          // Initialize default sort if not set
          // We use a small side-effect here during render or just calculate defaults on the fly
          const getEffectiveSort = (gender: 'men' | 'women', list: MeetResult[]) => {
            const config = gender === 'men' ? menSortConfig : womenSortConfig;
            if (config) return config;

            // Default: dominant category, desc
            const dom = getDominantCategory(list);
            return { key: dom as any, direction: 'desc' as const };
          };

          const handleSummarySort = (gender: 'men' | 'women', key: keyof MeetResult | 'rank') => {
            const currentConfig = gender === 'men' ? menSortConfig : womenSortConfig;
            // Determine default direction for this new key if switching
            let nextDirection: 'asc' | 'desc' = 'desc'; // Default to desc for stats
            if (key === 'lifter_name' || key === 'weight_class' || key === 'competition_age' || key === 'age_category' || key === 'club_name') {
              nextDirection = 'asc';
            }

            if (currentConfig && currentConfig.key === key) {
              // Toggle
              nextDirection = currentConfig.direction === 'asc' ? 'desc' : 'asc';
            }

            if (gender === 'men') setMenSortConfig({ key, direction: nextDirection });
            else setWomenSortConfig({ key, direction: nextDirection });
          };

          const renderSummaryTable = (title: string, data: MeetResult[], gender: 'men' | 'women', show: boolean, toggle: () => void) => {
            if (data.length === 0) return null;

            const sortConfig = getEffectiveSort(gender, data);

            // Sort data
            const sortedData = [...data].sort((a, b) => {
              const key = sortConfig.key;

              // Helper to get value
              const getVal = (item: MeetResult, k: any) => {
                if (k === 'qpoints') return item.qpoints ?? 0;
                if (k === 'q_youth') return item.q_youth ?? 0;
                if (k === 'q_masters') return item.q_masters ?? 0;
                return item[k as keyof MeetResult];
              };

              const valA = getVal(a, key);
              const valB = getVal(b, key);

              // Special handling for Q-stats: 0/null goes to bottom
              const isQStat = ['qpoints', 'q_youth', 'q_masters'].includes(key as string);
              if (isQStat) {
                const aZero = !valA || valA === 0;
                const bZero = !valB || valB === 0;
                if (aZero && !bZero) return 1; // a bottom
                if (!aZero && bZero) return -1; // b bottom
                if (aZero && bZero) {
                  // Both zero, sort alphabetically
                  return a.lifter_name.localeCompare(b.lifter_name);
                }
              }

              // Normal sort comparison
              let cmpA: any = valA;
              let cmpB: any = valB;

              // String normalization
              if (typeof valA === 'string') cmpA = valA.toLowerCase();
              if (typeof valB === 'string') cmpB = valB.toLowerCase();

              // Numeric force
              if (['total', 'body_weight_kg', 'competition_age'].includes(key as string)) {
                cmpA = parseFloat(String(valA) || '0');
                cmpB = parseFloat(String(valB) || '0');
              }

              if (cmpA < cmpB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (cmpA > cmpB) return sortConfig.direction === 'asc' ? 1 : -1;

              return 0;
            });

            // Assign ranks if sorting by a Q-stat
            // If sort key is a Q-stat, and value > 0, assign rank. 
            // If NOT sorting by Q-stat, do we show rank? User: "Lifters should be re-ranked depending on which of the three columns is used to sort."
            // We will calculate rank based on the SORTED list order for valid scores if the sort key is a score type.
            const isRankingSort = ['qpoints', 'q_youth', 'q_masters', 'total'].includes(sortConfig.key as string);

            const dataWithDisplayRank = sortedData.map((item, idx) => {
              let displayRank: string | number = '-';
              if (isRankingSort) {
                // Only rank if they have a value > 0
                const val = (item as any)[sortConfig.key];
                if (val && val > 0) {
                  displayRank = idx + 1;
                }
              }
              return { ...item, displayRank };
            });

            const SortIndicator = ({ col }: { col: any }) => {
              if (sortConfig.key !== col) {
                return <span className="text-app-disabled ml-1">↕</span>;
              }
              return <span className="text-accent-primary ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
            };

            const headerClass = "px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none";
            const qHeaderClass = (col: string) => `px-2 py-1 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none ${sortConfig.key === col ? 'text-accent-primary font-bold' : 'text-gray-900 dark:text-gray-200'}`;

            return (
              <div className="mb-4">
                <div className="mb-3">
                  <button
                    onClick={toggle}
                    className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
                  >
                    {show ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    <h2 className="text-2xl font-bold">
                      {title}
                    </h2>
                    <span className="text-sm text-app-muted ml-2">
                      ({data.length} athletes)
                    </span>
                  </button>
                </div>

                {show && (
                  <div className="card-primary mb-8">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                          <tr>
                            <th className={headerClass} onClick={() => handleSummarySort(gender, 'rank')}>Rank <SortIndicator col="rank" /></th>
                            <th className={headerClass} onClick={() => handleSummarySort(gender, 'lifter_name')}>Name <SortIndicator col="lifter_name" /></th>
                            <th className={headerClass} onClick={() => handleSummarySort(gender, 'weight_class')}>Weight Class <SortIndicator col="weight_class" /></th>
                            <th className={headerClass} onClick={() => handleSummarySort(gender, 'competition_age')}>Comp Age <SortIndicator col="competition_age" /></th>
                            <th className={headerClass} onClick={() => handleSummarySort(gender, 'age_category')}>Cat <SortIndicator col="age_category" /></th>
                            <th className={headerClass} onClick={() => handleSummarySort(gender, 'total')}>Total <SortIndicator col="total" /></th>
                            {/* Three Q Columns */}
                            <th className={qHeaderClass('q_youth')} onClick={() => handleSummarySort(gender, 'q_youth')}>Q-Youth <SortIndicator col="q_youth" /></th>
                            <th className={qHeaderClass('qpoints')} onClick={() => handleSummarySort(gender, 'qpoints')}>Q-Points <SortIndicator col="qpoints" /></th>
                            <th className={qHeaderClass('q_masters')} onClick={() => handleSummarySort(gender, 'q_masters')}>Q-Masters <SortIndicator col="q_masters" /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataWithDisplayRank.map(r => (
                            <tr key={r.result_id} className="border-t border-gray-700/50 hover:bg-app-hover transition-colors">
                              <td className="px-2 py-2 text-sm font-semibold">{r.displayRank}</td>
                              <td className="px-2 py-2 text-sm max-w-[200px] truncate" title={r.lifter_name}>
                                <Link href={getAthleteUrl(r)} className="text-blue-400 hover:text-blue-300 hover:underline">
                                  {r.lifter_name}
                                </Link>
                              </td>
                              <td className="px-2 py-2 text-sm">{r.weight_class}</td>
                              <td className="px-2 py-2 text-sm">{r.competition_age}</td>
                              <td className="px-2 py-2 text-sm max-w-[150px] truncate" title={r.age_category}>{r.age_category}</td>
                              <td className="px-2 py-2 text-sm font-bold" style={{ color: 'var(--chart-total)' }}>{r.total}</td>

                              <td className="px-2 py-2 text-sm font-medium" style={{ color: (r.q_youth || 0) > 0 ? 'var(--chart-qyouth)' : 'inherit' }}>
                                {(r.q_youth && r.q_youth > 0) ? r.q_youth.toFixed(3) : '-'}
                              </td>
                              <td className="px-2 py-2 text-sm font-medium" style={{ color: (r.qpoints || 0) > 0 ? 'var(--chart-qpoints)' : 'inherit' }}>
                                {(r.qpoints && r.qpoints > 0) ? r.qpoints.toFixed(3) : '-'}
                              </td>
                              <td className="px-2 py-2 text-sm font-medium" style={{ color: (r.q_masters || 0) > 0 ? 'var(--chart-qmasters)' : 'inherit' }}>
                                {(r.q_masters && r.q_masters > 0) ? r.q_masters.toFixed(3) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          };

          return (
            <>
              {renderSummaryTable("Men's Overall Rankings by Q-Points", men, 'men', showMenSummary, () => setShowMenSummary(!showMenSummary))}
              {renderSummaryTable("Women's Overall Rankings by Q-Points", women, 'women', showWomenSummary, () => setShowWomenSummary(!showWomenSummary))}
            </>
          );
        })()}
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
                        <table className="border-separate" style={{ borderSpacing: 0, width: 'auto' }}>
                          <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                            <tr className="border-b-2 border-gray-400 dark:border-gray-500">
                              <th
                                onClick={() => handleSort(division, 'place')}
                                className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{ width: '60px' }}
                              >
                                <div className="flex items-center justify-start space-x-1">
                                  <span>Place</span>
                                  <SortIcon column="place" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'lifter_name')}
                                className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{ minWidth: '200px' }}
                              >
                                <div className="flex items-center justify-start space-x-1">
                                  <span>Athlete</span>
                                  <SortIcon column="lifter_name" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'club_name')}
                                className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{ minWidth: '120px' }}
                              >
                                <div className="flex items-center justify-start space-x-1">
                                  <span>Club</span>
                                  <SortIcon column="club_name" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th className="w-full"></th>
                              <th
                                onClick={() => handleSort(division, 'best_snatch')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{ width: '80px' }}
                              >
                                <div className="flex items-center justify-end space-x-1">
                                  <span>Snatch</span>
                                  <SortIcon column="best_snatch" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'best_cj')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{ width: '80px' }}
                              >
                                <div className="flex items-center justify-end space-x-1">
                                  <span>C&J</span>
                                  <SortIcon column="best_cj" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'total')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{ width: '80px' }}
                              >
                                <div className="flex items-center justify-end space-x-1">
                                  <span>Total</span>
                                  <SortIcon column="total" sortConfig={sortConfig} division={division} />
                                </div>
                              </th>
                              <th
                                onClick={() => handleSort(division, 'body_weight_kg')}
                                className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
                                style={{ width: '100px' }}
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
                                    <Link
                                      href={getAthleteUrl(result)}
                                      className="flex items-center space-x-1 text-accent-primary group-hover:text-accent-primary-hover transition-colors hover:underline"
                                    >
                                      <span className="font-medium text-sm">{result.lifter_name}</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                    <div className="text-xs text-app-muted">
                                      {result.competition_age && `Age ${result.competition_age}`}
                                      {(() => {
                                        const membershipNumber = Array.isArray(result.lifters)
                                          ? result.lifters[0]?.membership_number
                                          : result.lifters?.membership_number;
                                        return (
                                          <>
                                            {membershipNumber && result.competition_age && " • "}
                                            {membershipNumber && `#${membershipNumber}`}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                  <td className="px-2 py-1 whitespace-nowrap text-sm text-app-secondary">
                                    <div className="text-sm">{result.club_name || '-'}</div>
                                    <div className="text-xs text-app-muted">{result.wso}</div>
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
