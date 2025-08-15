"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, TrendingUp, Trophy, Users, Calendar, Weight, Database, Filter, ArrowRight, Github, Heart, X, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import type { Metadata } from 'next';
import { ThemeSwitcher } from './components/ThemeSwitcher';

// Types for our search results
interface SearchResult {
  lifter_id: number;
  athlete_name: string;
  membership_number?: number;
  gender?: string;
  club_name?: string;
  wso?: string;
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function WeightliftingLandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('lifters');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .rpc('search_athletes', { search_term: query });

        if (error) {
          console.error('Search error:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          return;
        }

        setSearchResults(data || []);
        setShowResults(true);
      } catch (err) {
        console.error('Unexpected search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  // Handle search input changes (only for lifters now)
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Handle search form submission (currently just lifters)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission handled by real-time search
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    setSearchQuery(result.athlete_name);
    setShowResults(false);
    
    // Navigate to athlete page - prefer membership number, fallback to name slug
    let athleteId: string;
    
    if (result.membership_number) {
      athleteId = result.membership_number.toString();
    } else {
      // Convert name to URL slug (e.g., "John Doe" -> "john-doe")
      athleteId = result.athlete_name
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')     // Replace spaces with hyphens
        .trim();
    }
    
    router.push(`/athlete/${athleteId}`);
  };

  // Handle popular search clicks (for future implementation)
  const handlePopularSearch = (searchTerm: string) => {
    setSearchQuery(searchTerm);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-app-gradient">
      {/* Header */}
      <header className="bg-header-blur border-b border-app-secondary">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="bg-app-tertiary rounded-full p-3">
                <Weight className="h-8 w-8 text-app-secondary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-app-primary">WeightliftingDB</h1>
                <p className="text-sm text-app-tertiary">USA Weightlifting Results Database</p>
              </div>
            </div>
            
            {/* Add Theme Switcher */}
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Search */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-app-primary mb-6">
            USA Weightlifting
            <span className="block text-blue-400">Results Database</span>
          </h2>
          <p className="text-lg text-app-secondary mb-12 max-w-2xl mx-auto">
            Search through thousands of competition results and 
            analyze performance trends from USA Weightlifting athletes.
          </p>

          {/* Search Interface */}
          <div className="relative space-y-6">
            {/* Main Search Bar */}
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-app-muted" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search athletes... (e.g., Caine Wilkes)"
                className="input-primary"
              />
              
              {/* Clear button */}
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-16 top-1/2 transform -translate-y-1/2 text-app-muted hover:text-app-primary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-accent-primary hover:bg-accent-primary-hover text-app-primary px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <span className="hidden sm:inline">Search</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Search Results Dropdown */}
            {showResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-app-secondary border border-app-primary rounded-xl shadow-xl z-10 max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-app-muted">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto mb-2"></div>
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="py-2">
                    {searchResults.map((result) => (
                      <button
                        key={result.lifter_id}
                        onClick={() => handleResultSelect(result)}
                        className="w-full px-4 py-3 text-left bg-interactive transition-colors flex items-center space-x-3"
                      >
                        <User className="h-5 w-5 text-app-muted" />
                        <div className="flex-1">
                          <div className="text-app-primary font-medium">{result.athlete_name}</div>
                          <div className="text-sm text-app-tertiary">
                            {[
                              result.gender,
                              result.club_name,
                              result.membership_number ? `#${result.membership_number}` : null
                            ].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <div className="p-4 text-center text-app-muted">
                    No athletes found for "{searchQuery}"
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-app-tertiary/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Stats content can be added here later */}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-app-secondary text-app-primary py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Database className="h-6 w-6" />
                <span className="font-bold">WeightliftingDB</span>
              </div>
              <p className="text-app-tertiary text-sm">
                Open source project, MIT License. Data sourced from official competition results.
              </p>
            </div>
            <div className="flex justify-end items-end">
              <a 
                href="https://github.com/PhillipBost/weightlifting-frontend"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-app-tertiary hover:text-app-primary transition-colors"
                title="View source code on GitHub"
              >
                <Github className="h-4 w-4" />
                <span className="text-sm">GitHub</span>
              </a>
            </div>
          </div>
          <div className="border-t border-app-secondary mt-8 pt-8 text-center text-sm text-app-tertiary">
            <span className="inline-flex items-center gap-1">
              2025 WeightliftingDB. Built with <Heart className="h-4 w-4 text-blue-400" fill="currentColor" /> for the weightlifting community.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}