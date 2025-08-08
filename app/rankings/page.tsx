"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Trophy, 
  Filter, 
  Download, 
  Printer, 
  Search, 
  Calendar,
  Users,
  Weight,
  TrendingUp,
  X,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface AthleteRanking {
  lifter_id: string;
  lifter_name: string;
  gender: string;
  weight_class?: string;
  age_category?: string;
  best_snatch: number;
  best_cj: number;
  best_total: number;
  best_qpoints: number;
  competition_count: number;
  last_competition: string;
  competition_age?: number;
  trueRank?: number;
}

export default function RankingsPage() {
  const [rankings, setRankings] = useState<AthleteRanking[]>([]);
  const [filteredRankings, setFilteredRankings] = useState<AthleteRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [filters, setFilters] = useState({
    searchTerm: '',
    gender: 'all',
    weightClass: 'all',
    ageCategory: 'all',
    rankBy: 'best_total',
    sortBy: 'best_total',
    sortOrder: 'desc',
    minCompetitions: 1,
    yearRange: 'all-time'
  });

  // UI states
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Get unique values for filter dropdowns
  const [filterOptions, setFilterOptions] = useState({
    weightClasses: [] as string[],
    ageCategories: [] as string[]
  });

  // Store inactive weight classes from CSV
  const [inactiveWeightClasses, setInactiveWeightClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    initializeData();
  }, []);

  async function initializeData() {
    await loadInactiveDivisions();
    await fetchRankingsData();
  }

  useEffect(() => {
    applyFilters();
  }, [rankings, filters]);

  async function loadInactiveDivisions() {
    try {
      // Fetch the CSV file from the public folder
      const response = await fetch('/all-divisions.csv');
      if (!response.ok) {
        throw new Error('Failed to fetch divisions CSV');
      }
      
      const csvContent = await response.text();
      console.log('CSV loaded, total length:', csvContent.length);
      console.log('First 500 chars:', csvContent.slice(0, 500));
      
      // Look for first inactive entry
      const firstInactiveIndex = csvContent.indexOf('(Inactive)');
      console.log('First (Inactive) found at position:', firstInactiveIndex);
      if (firstInactiveIndex > -1) {
        console.log('Context around first inactive:', csvContent.slice(firstInactiveIndex - 50, firstInactiveIndex + 100));
      }
      
      const lines = csvContent.split('\n').slice(1); // Skip header
      console.log('Total lines after header:', lines.length);
      
      const inactiveSet = new Set<string>();
      let inactiveCount = 0;
      let totalProcessed = 0;
      
      lines.forEach((line, index) => {
        const division = line.trim().replace('\r', '');
        totalProcessed++;
        
        if (division.startsWith('(Inactive)')) {
          inactiveCount++;
          const cleanDivision = division.replace('(Inactive) ', '');
          
          // Extract gender and weight class
          let gender = '';
          if (cleanDivision.includes("Women's")) gender = "Women's";
          else if (cleanDivision.includes("Men's")) gender = "Men's";
          
          // Extract weight class (the last part after the last space)
          const parts = cleanDivision.split(' ');
          const weightClass = parts[parts.length - 1];
          
          if (gender && weightClass && weightClass.includes('kg')) {
            const genderWeightClass = `${gender} ${weightClass}`;
            inactiveSet.add(genderWeightClass);
            
            // Log first few for debugging
            if (inactiveCount <= 5) {
              console.log(`Inactive ${inactiveCount}:`, division, '->', genderWeightClass);
            }
          }
        }
      });
      
      console.log('Total lines processed:', totalProcessed);
      console.log('Found inactive divisions:', inactiveCount);
      console.log('Inactive weight class combinations:', Array.from(inactiveSet).slice(0, 10));
      console.log('Full inactive set size:', inactiveSet.size);
      
      setInactiveWeightClasses(inactiveSet);
    } catch (error) {
      console.error('Error loading inactive divisions:', error);
      // Continue without inactive divisions if file can't be loaded
    }
  }

  async function fetchRankingsData(inactiveWeightClassesSet: Set<string>) {
    console.log('=== fetchRankingsData called ===');
    console.log('Received inactive set size:', inactiveWeightClassesSet ? inactiveWeightClassesSet.size : 'null/undefined');
    
    try {
      setLoading(true);
      setError(null);
      
      // Ensure we have a valid set
      const inactiveSet = inactiveWeightClassesSet instanceof Set ? inactiveWeightClassesSet : new Set<string>();
      console.log('Using inactive set with size:', inactiveSet.size);
      console.log('Sample inactive classes:', Array.from(inactiveSet).slice(0, 5));

      // Fetch all data from meet_results table
      const { data: resultsData, error: resultsError } = await supabase
        .from('meet_results')
        .select(`
          result_id,
          lifter_id,
          lifter_name,
          date,
          meet_name,
          weight_class,
          age_category,
          body_weight_kg,
          best_snatch,
          best_cj,
          total,
          qpoints,
          q_youth,
          q_masters,
          competition_age
        `)
        .order('date', { ascending: false });

      if (resultsError) throw resultsError;

      // Fetch all lifters data to get gender and other info
      const { data: liftersData, error: liftersError } = await supabase
        .from('lifters')
        .select(`
          lifter_id,
          athlete_name,
          gender,
          wso,
          club_name,
          membership_number
        `);

      if (liftersError) throw liftersError;

      // Create a map of lifter info for quick lookup
      const lifterInfoMap = new Map();
      liftersData.forEach(lifter => {
        lifterInfoMap.set(lifter.lifter_id, lifter);
      });

      // Group results by lifter_id to create athlete rankings
      const lifterGroups = resultsData.reduce((groups: { [key: string]: any[] }, result) => {
        const lifterId = result.lifter_id;
        if (!groups[lifterId]) {
          groups[lifterId] = [];
        }
        groups[lifterId].push(result);
        return groups;
      }, {});

      // Process each lifter's data to create rankings
      const athleteRankings: AthleteRanking[] = Object.entries(lifterGroups).map(([lifterId, athleteResults]) => {
        // Get lifter info from the lifters table
        const lifterInfo = lifterInfoMap.get(parseInt(lifterId));
        
        // Safely parse numeric values with fallbacks
        const validSnatches = athleteResults
          .map(r => {
            const value = r.best_snatch;
            if (!value || value === '0' || value === '') return 0;
            const parsed = parseInt(String(value));
            return isNaN(parsed) ? 0 : Math.abs(parsed);
          })
          .filter(v => v > 0);

        const validCJs = athleteResults
          .map(r => {
            const value = r.best_cj;
            if (!value || value === '0' || value === '') return 0;
            const parsed = parseInt(String(value));
            return isNaN(parsed) ? 0 : Math.abs(parsed);
          })
          .filter(v => v > 0);

        const validTotals = athleteResults
          .map(r => {
            const value = r.total;
            if (!value || value === '0' || value === '') return 0;
            const parsed = parseInt(String(value));
            return isNaN(parsed) ? 0 : parsed;
          })
          .filter(v => v > 0);

        const validQPoints = athleteResults
          .map(r => {
            const qpoints = r.qpoints ? parseFloat(String(r.qpoints)) : 0;
            const qYouth = r.q_youth ? parseFloat(String(r.q_youth)) : 0;
            const qMasters = r.q_masters ? parseFloat(String(r.q_masters)) : 0;
            return Math.max(qpoints, qYouth, qMasters);
          })
          .filter(v => v > 0);

        // Get the most recent result for current info
        const mostRecentResult = athleteResults[0];

        return {
          lifter_id: lifterId,
          lifter_name: lifterInfo?.athlete_name || mostRecentResult?.lifter_name || 'Unknown',
          gender: lifterInfo?.gender || '', // Use gender from lifters table
          weight_class: mostRecentResult?.weight_class || '',
          age_category: mostRecentResult?.age_category || '',
          best_snatch: validSnatches.length > 0 ? Math.max(...validSnatches) : 0,
          best_cj: validCJs.length > 0 ? Math.max(...validCJs) : 0,
          best_total: validTotals.length > 0 ? Math.max(...validTotals) : 0,
          best_qpoints: validQPoints.length > 0 ? Math.max(...validQPoints) : 0,
          competition_count: athleteResults.length,
          last_competition: mostRecentResult?.date || '',
          competition_age: mostRecentResult?.competition_age || undefined
        };
      });

      // Filter out athletes with no valid competition results
      const rankedAthletes = athleteRankings.filter(athlete => 
        athlete.competition_count > 0 && 
        (athlete.best_snatch > 0 || athlete.best_cj > 0 || athlete.best_total > 0)
      );

      setRankings(rankedAthletes);

      // Create weight class options (gender + weight only)
      const weightClassCombinations = new Set();
      rankedAthletes.forEach(athlete => {
        if (athlete.age_category && athlete.weight_class) {
          // Extract just the gender from age_category (e.g., "Junior Women's" -> "Women's")
          let gender = '';
          if (athlete.age_category.includes("Women's")) gender = "Women's";
          else if (athlete.age_category.includes("Men's")) gender = "Men's";
          
          if (gender) {
            const weightClassOnly = `${gender} ${athlete.weight_class}`;
            weightClassCombinations.add(weightClassOnly);
          }
        }
      });

      // Extract age categories (without gender) from age_category field
      const extractedAgeCategories = new Set();
      rankedAthletes.forEach(athlete => {
        const ageCategory = athlete.age_category || '';
        
        // Extract the age portion from "Gender's Age" format
        if (ageCategory.includes('11 Under')) extractedAgeCategories.add('11 Under Age Group');
        else if (ageCategory.includes('13 Under')) extractedAgeCategories.add('13 Under Age Group');
        else if (ageCategory.includes('14-15')) extractedAgeCategories.add('14-15 Age Group');
        else if (ageCategory.includes('16-17')) extractedAgeCategories.add('16-17 Age Group');
        else if (ageCategory.includes('Junior')) extractedAgeCategories.add('Junior');
        else if (ageCategory.includes('Masters (35-39)')) extractedAgeCategories.add('Masters (35-39)');
        else if (ageCategory.includes('Masters (40-44)')) extractedAgeCategories.add('Masters (40-44)');
        else if (ageCategory.includes('Masters (45-49)')) extractedAgeCategories.add('Masters (45-49)');
        else if (ageCategory.includes('Masters (50-54)')) extractedAgeCategories.add('Masters (50-54)');
        else if (ageCategory.includes('Masters (55-59)')) extractedAgeCategories.add('Masters (55-59)');
        else if (ageCategory.includes('Masters (60-64)')) extractedAgeCategories.add('Masters (60-64)');
        else if (ageCategory.includes('Masters (65-69)')) extractedAgeCategories.add('Masters (65-69)');
        else if (ageCategory.includes('Masters (70-74)')) extractedAgeCategories.add('Masters (70-74)');
        else if (ageCategory.includes('Masters (75-79)')) extractedAgeCategories.add('Masters (75-79)');
        else if (ageCategory.includes('Masters (75+)')) extractedAgeCategories.add('Masters (75+)');
        else if (ageCategory.includes('Masters (80+)')) extractedAgeCategories.add('Masters (80+)');
        else if (ageCategory.includes('Open')) extractedAgeCategories.add('Open');
      });

      // Create weight class ordering function (now just gender + weight)
      function getWeightClassOrder(weightClass) {
        // Women's classes first, then Men's
        if (weightClass.includes("Women's")) return 1;
        if (weightClass.includes("Men's")) return 2;
        return 3;
      }

      // Sort weight classes: Active first, then inactive, maintaining gender and weight ordering
      const activeWeightClasses = [];
      const inactiveWeightClassesList = [];
      
      console.log('Processing weight classes with inactive set size:', inactiveSet.size);
      console.log('Weight class combinations found:', Array.from(weightClassCombinations));
      
      Array.from(weightClassCombinations).forEach(wc => {
        if (inactiveSet.has(wc)) {
          console.log('✓ MATCH! Marking as inactive:', wc);
          inactiveWeightClassesList.push(`(Inactive) ${wc}`);
        } else {
          activeWeightClasses.push(wc);
        }
      });

      console.log('Active weight classes:', activeWeightClasses.length);
      console.log('Inactive weight classes:', inactiveWeightClassesList.length);

      // Sort each group separately
      const sortWeightClasses = (classes) => {
        return classes.sort((a, b) => {
          // Remove (Inactive) prefix for sorting
          const cleanA = a.replace('(Inactive) ', '');
          const cleanB = b.replace('(Inactive) ', '');
          
          const aOrder = getWeightClassOrder(cleanA);
          const bOrder = getWeightClassOrder(cleanB);
          
          if (aOrder !== bOrder) return aOrder - bOrder;
          
          // Within same gender, sort by weight
          const aWeight = parseFloat(cleanA.split(' ').pop().replace(/[^\d.]/g, '')) || 0;
          const bWeight = parseFloat(cleanB.split(' ').pop().replace(/[^\d.]/g, '')) || 0;
          
          return aWeight - bWeight;
        });
      };

      const sortedActiveWeightClasses = sortWeightClasses(activeWeightClasses);
      const sortedInactiveWeightClasses = sortWeightClasses(inactiveWeightClassesList);
      const sortedWeightClasses = [...sortedActiveWeightClasses, ...sortedInactiveWeightClasses];

      // Define proper age category ordering (no gender)
      const ageCategoryOrder = [
        "11 Under Age Group", "13 Under Age Group", "14-15 Age Group", "16-17 Age Group", 
        "Junior", "Open", "Masters (35-39)", "Masters (40-44)", "Masters (45-49)", 
        "Masters (50-54)", "Masters (55-59)", "Masters (60-64)", "Masters (65-69)", 
        "Masters (70-74)", "Masters (75-79)", "Masters (75+)", "Masters (80+)"
      ];

      // Sort age categories by the defined order
      const sortedAgeCategories = Array.from(extractedAgeCategories).sort((a, b) => {
        const aIndex = ageCategoryOrder.indexOf(a);
        const bIndex = ageCategoryOrder.indexOf(b);
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      setFilterOptions({
        weightClasses: sortedWeightClasses,
        ageCategories: sortedAgeCategories
      });

    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching rankings data:', err);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...rankings];

    // Search term filter
    if (filters.searchTerm) {
      filtered = filtered.filter(athlete =>
        athlete.lifter_name.toLowerCase().includes(filters.searchTerm.toLowerCase())
      );
    }

    // Gender filter
    if (filters.gender !== 'all') {
      filtered = filtered.filter(athlete => athlete.gender === filters.gender);
    }

    // Weight class filter (now uses gender + weight format, handles inactive)
    if (filters.weightClass !== 'all') {
      filtered = filtered.filter(athlete => {
        // Extract gender from age_category
        let gender = '';
        if (athlete.age_category && athlete.age_category.includes("Women's")) gender = "Women's";
        else if (athlete.age_category && athlete.age_category.includes("Men's")) gender = "Men's";
        
        const genderWeightClass = `${gender} ${athlete.weight_class || ''}`.trim();
        
        // Check both active and inactive versions
        return genderWeightClass === filters.weightClass || 
               genderWeightClass === filters.weightClass.replace('(Inactive) ', '');
      });
    }

    // Age category filter
    if (filters.ageCategory !== 'all') {
      filtered = filtered.filter(athlete => {
        const weightClass = athlete.weight_class || '';
        // Check if the weight class contains the selected age category
        return weightClass.includes(filters.ageCategory) || athlete.age_category === filters.ageCategory;
      });
    }

    // Minimum competitions filter
    filtered = filtered.filter(athlete => athlete.competition_count >= filters.minCompetitions);

    // Year range filter
    if (filters.yearRange !== 'all-time') {
      const currentYear = new Date().getFullYear();
      const yearCutoff = filters.yearRange === 'last-year' ? currentYear - 1 : currentYear - 2;
      filtered = filtered.filter(athlete => {
        if (!athlete.last_competition) return false;
        const competitionYear = new Date(athlete.last_competition).getFullYear();
        return competitionYear >= yearCutoff;
      });
    }

    // First, establish the "true" ranking based on the selected rankBy criteria
    const rankingCriteria = filters.rankBy;
    let rankedForTrueRank = [...filtered];
    
    // Sort by the ranking criteria
    rankedForTrueRank.sort((a, b) => {
      let aValue = a[rankingCriteria as keyof AthleteRanking] as number;
      let bValue = b[rankingCriteria as keyof AthleteRanking] as number;
      
      if (rankingCriteria === 'lifter_name') {
        aValue = a.lifter_name as any;
        bValue = b.lifter_name as any;
        return aValue.localeCompare(bValue); // Names always A-Z for ranking
      }
      
      // For numeric values, always rank highest first for true ranking
      return bValue - aValue;
    });

    // Create the permanent rank map
    const athleteRanks = new Map();
    rankedForTrueRank.forEach((athlete, index) => {
      athleteRanks.set(athlete.lifter_id, index + 1);
    });

    // Then sort by the current sort criteria for display order
    filtered.sort((a, b) => {
      let aValue = a[filters.sortBy as keyof AthleteRanking] as number;
      let bValue = b[filters.sortBy as keyof AthleteRanking] as number;
      
      if (filters.sortBy === 'lifter_name') {
        aValue = a.lifter_name as any;
        bValue = b.lifter_name as any;
        return filters.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (filters.sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    // Add the true rank to each athlete for display
    const rankedFiltered = filtered.map(athlete => ({
      ...athlete,
      trueRank: athleteRanks.get(athlete.lifter_id)
    }));

    setFilteredRankings(rankedFiltered.slice(0, 50)); // Limit to top 50
  }

  function handleFilterChange(key: string, value: any) {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }

  function handleColumnSort(column: string) {
    if (filters.sortBy === column) {
      // If clicking the same column, toggle sort order
      handleFilterChange('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a different column, set new column and default to desc (except for name)
      handleFilterChange('sortBy', column);
      handleFilterChange('sortOrder', column === 'lifter_name' ? 'asc' : 'desc');
    }
  }

  function getSortIcon(column: string) {
    if (filters.sortBy !== column) {
      return null; // No icon if not the active sort column
    }
    return filters.sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  }

  function clearFilters() {
    setFilters({
      searchTerm: '',
      gender: 'all',
      weightClass: 'all',
      ageCategory: 'all',
      rankBy: 'best_total',
      sortBy: 'best_total',
      sortOrder: 'desc',
      minCompetitions: 1,
      yearRange: 'all-time'
    });
  }

  function exportToCSV() {
    const headers = [
      'Rank',
      'Athlete Name',
      'Gender',
      'Weight Class',
      'Age Category',
      'Best Snatch (kg)',
      'Best C&J (kg)',
      'Best Total (kg)',
      'Best Q-Points',
      'Competitions',
      'Last Competition'
    ];

    const csvData = filteredRankings.map((athlete) => [
      athlete.trueRank || 'N/A',
      athlete.lifter_name,
      athlete.gender,
      athlete.weight_class || '',
      athlete.age_category || '',
      athlete.best_snatch || '',
      athlete.best_cj || '',
      athlete.best_total || '',
      athlete.best_qpoints || '',
      athlete.competition_count,
      athlete.last_competition || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weightlifting-rankings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function printTable() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>USA Weightlifting Ranking Tables</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .rank { font-weight: bold; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Weightlifting Rankings</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Athlete</th>
                <th>Gender</th>
                <th>Weight Class</th>
                <th>Age Category</th>
                <th>Best Snatch</th>
                <th>Best C&J</th>
                <th>Best Total</th>
                <th>Q-Points</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRankings.map((athlete) => `
                <tr>
                  <td class="rank">${athlete.trueRank || 'N/A'}</td>
                  <td>${athlete.lifter_name}</td>
                  <td>${athlete.gender}</td>
                  <td>${athlete.weight_class || ''}</td>
                  <td>${athlete.age_category || ''}</td>
                  <td>${athlete.best_snatch || '-'}</td>
                  <td>${athlete.best_cj || '-'}</td>
                  <td>${athlete.best_total || '-'}</td>
                  <td>${athlete.best_qpoints ? athlete.best_qpoints.toFixed(1) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.print();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-lg text-gray-300">Loading rankings data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Loading Rankings</h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={fetchRankingsDataWithInactive}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-gray-800 rounded-2xl p-8 mb-8 border border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="bg-gray-700 rounded-full p-3">
                <Trophy className="h-8 w-8 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Weightlifting Rankings</h1>
                <p className="text-gray-300">
                  {filteredRankings.length} athletes • Last updated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
                
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => { exportToCSV(); setShowExportMenu(false); }}
                      className="flex items-center space-x-2 w-full text-left px-4 py-2 text-white hover:bg-gray-600 rounded-t-lg"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Download CSV</span>
                    </button>
                    <button
                      onClick={() => { printTable(); setShowExportMenu(false); }}
                      className="flex items-center space-x-2 w-full text-left px-4 py-2 text-white hover:bg-gray-600 rounded-b-lg"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Print Table</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={filters.searchTerm}
                      onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                      placeholder="Athlete name"
                      className="w-full pl-10 pr-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Gender</label>
                  <select
                    value={filters.gender}
                    onChange={(e) => handleFilterChange('gender', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Genders</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>

                {/* Weight Class */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Weight Class</label>
                  <select
                    value={filters.weightClass}
                    onChange={(e) => handleFilterChange('weightClass', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Weight Classes</option>
                    {filterOptions.weightClasses.map(wc => (
                      <option key={wc} value={wc}>{wc}</option>
                    ))}
                  </select>
                </div>

                {/* Age Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Age Category</label>
                  <select
                    value={filters.ageCategory}
                    onChange={(e) => handleFilterChange('ageCategory', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Age Categories</option>
                    {filterOptions.ageCategories.map(ac => (
                      <option key={ac} value={ac}>{ac}</option>
                    ))}
                  </select>
                </div>

                {/* Rank By */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Rank By</label>
                  <select
                    value={filters.rankBy}
                    onChange={(e) => handleFilterChange('rankBy', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="best_total">Best Total</option>
                    <option value="best_snatch">Best Snatch</option>
                    <option value="best_cj">Best Clean & Jerk</option>
                    <option value="best_qpoints">Best Q-Points</option>
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Sort By</label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="best_total">Best Total</option>
                    <option value="best_snatch">Best Snatch</option>
                    <option value="best_cj">Best Clean & Jerk</option>
                    <option value="best_qpoints">Best Q-Points</option>
                    <option value="lifter_name">Name</option>
                    <option value="competition_count">Competition Count</option>
                  </select>
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Order</label>
                  <select
                    value={filters.sortOrder}
                    onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="desc">Highest First</option>
                    <option value="asc">Lowest First</option>
                  </select>
                </div>

                {/* Time Period */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Time Period</label>
                  <select
                    value={filters.yearRange}
                    onChange={(e) => handleFilterChange('yearRange', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all-time">All Time</option>
                    <option value="last-year">Last Year</option>
                    <option value="last-2-years">Last 2 Years</option>
                  </select>
                </div>

                {/* Min Competitions */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Min Competitions</label>
                  <input
                    type="number"
                    min="1"
                    value={filters.minCompetitions}
                    onChange={(e) => handleFilterChange('minCompetitions', parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={clearFilters}
                  className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>Clear Filters</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rankings Table */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-gray-300 font-semibold">Rank</th>
                  <th 
                    className="px-6 py-4 text-gray-300 font-semibold cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleColumnSort('lifter_name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Athlete</span>
                      {getSortIcon('lifter_name')}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-gray-300 font-semibold">Gender</th>
                  <th className="px-6 py-4 text-gray-300 font-semibold">Weight Class</th>
                  <th className="px-6 py-4 text-gray-300 font-semibold">Age Category</th>
                  <th 
                    className="px-6 py-4 text-gray-300 font-semibold cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleColumnSort('best_snatch')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Snatch</span>
                      {getSortIcon('best_snatch')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-gray-300 font-semibold cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleColumnSort('best_cj')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>C&J</span>
                      {getSortIcon('best_cj')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-gray-300 font-semibold cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleColumnSort('best_total')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Total</span>
                      {getSortIcon('best_total')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-gray-300 font-semibold cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleColumnSort('best_qpoints')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Q-Points</span>
                      {getSortIcon('best_qpoints')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-gray-300 font-semibold cursor-pointer hover:bg-gray-600 transition-colors"
                    onClick={() => handleColumnSort('competition_count')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Comps</span>
                      {getSortIcon('competition_count')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRankings.map((athlete, index) => (
                  <tr 
                    key={athlete.lifter_id} 
                    className={`border-t border-gray-700 hover:bg-gray-700/50 transition-colors ${
                      (athlete.trueRank || index + 1) <= 3 ? 'bg-gradient-to-r from-yellow-900/20 to-transparent' : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`font-bold text-lg ${
                          (athlete.trueRank || index + 1) === 1 ? 'text-yellow-400' : 
                          (athlete.trueRank || index + 1) === 2 ? 'text-gray-300' : 
                          (athlete.trueRank || index + 1) === 3 ? 'text-orange-400' : 'text-white'
                        }`}>
                          {athlete.trueRank || index + 1}
                        </span>
                        {(athlete.trueRank || index + 1) <= 3 && <Trophy className={`h-4 w-4 ${
                          (athlete.trueRank || index + 1) === 1 ? 'text-yellow-400' : 
                          (athlete.trueRank || index + 1) === 2 ? 'text-gray-300' : 'text-orange-400'
                        }`} />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{athlete.lifter_name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{athlete.gender}</td>
                    <td className="px-6 py-4 text-gray-300">{athlete.weight_class || '-'}</td>
                    <td className="px-6 py-4 text-gray-300">{athlete.age_category || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="text-blue-400 font-medium">
                        {athlete.best_snatch || '-'}
                        {athlete.best_snatch ? 'kg' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-green-400 font-medium">
                        {athlete.best_cj || '-'}
                        {athlete.best_cj ? 'kg' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-yellow-400 font-bold text-lg">
                        {athlete.best_total || '-'}
                        {athlete.best_total ? 'kg' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-purple-400 font-medium">
                        {athlete.best_qpoints ? athlete.best_qpoints.toFixed(1) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{athlete.competition_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredRankings.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No athletes found matching your criteria</p>
                <button 
                  onClick={clearFilters}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {filteredRankings.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-300">Total Athletes</h3>
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{filteredRankings.length}</div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-300">Highest Total</h3>
                <Weight className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {filteredRankings.length > 0 ? Math.max(...filteredRankings.map(a => a.best_total).filter(t => t > 0)) : 0}kg
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-300">Avg Competitions</h3>
                <Calendar className="h-5 w-5 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {filteredRankings.length > 0 ? (filteredRankings.reduce((sum, a) => sum + a.competition_count, 0) / filteredRankings.length).toFixed(1) : 0}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-300">Top Q-Score</h3>
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {filteredRankings.length > 0 ? Math.max(...filteredRankings.map(a => a.best_qpoints).filter(q => q > 0)).toFixed(1) : 0}
              </div>
            </div>
          </div>
        )}

        {/* Click outside handler for export menu */}
        {showExportMenu && (
          <div 
            className="fixed inset-0 z-5" 
            onClick={() => setShowExportMenu(false)}
          />
        )}
      </div>
    </div>
  );
}