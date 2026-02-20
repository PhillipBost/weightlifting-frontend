"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, TrendingUp, Trophy, Users, Calendar, CalendarDays, CalendarFold, MapPinned, Weight, Dumbbell, Database, Filter, ArrowRight, Github, Heart, X, User, MapPin, Loader2, Shield, Archive } from 'lucide-react';



import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { UserMenu } from './components/UserMenu';
import { LoginModal } from './components/LoginModal';
import { UnifiedSearch } from './components/UnifiedSearch';

import { useAuth } from './components/AuthProvider';
import { ROLES } from '../lib/roles';
import { iwfAthleteSearch } from '../lib/search/iwfAthleteSearch';
import { usawAthleteSearch } from '../lib/search/usawAthleteSearch';
import { usawMeetSearch } from '../lib/search/usawMeetSearch';
import { iwfMeetSearch } from '../lib/search/iwfMeetSearch';
import { wsoClubSearch } from '../lib/search/wsoClubSearch';

export default function WeightliftingLandingPage() {

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [placeholderName, setPlaceholderName] = useState('');
  const [placeholderMeet, setPlaceholderMeet] = useState('');
  const [dbStats, setDbStats] = useState<{ results: number; athletes: number; meets: number } | null>(null);

  useEffect(() => {
    fetch('/data/stats.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[Homepage] Stats received:', data);
        if (data && typeof data.results === 'number') {
          setDbStats(data);
        }
      })
      .catch(err => console.error('[Homepage] Stats fetch error:', err));
  }, []);

  useEffect(() => {
    // Initialize search indices
    iwfAthleteSearch.init().catch(console.error);
    usawAthleteSearch.init().catch(console.error);
    usawMeetSearch.init().catch(console.error);
    iwfMeetSearch.init().catch(console.error);
    wsoClubSearch.init().catch(console.error);
  }, []);

  const athleteNames = [
    'Caine Wilkes',
    'Jourdan Delacruz',
    'Wes Kitts',
    'Hampton Morris',
    'Mary Theisen-Lappen',
    'Olivia Reeves',
    'Sarah Robles',
    'Martha Rogers',
    'Harrison Maurus',
    'Katherine Vibert',
    'Clarence Cummings',
    'Jenny Arthur',
    'Kendrick Farris',
    'Holley Mangold',
    'Christopher Yandle'
  ];

  const meetNames = [
    'IWF World Championships',
    'IWF World Cup',
    'North American Open Finals',
    'USAW National Championships'
  ];


  // Placeholder Rotation
  useEffect(() => {
    // Initial random value
    const randomAthlete = athleteNames[Math.floor(Math.random() * athleteNames.length)];
    const randomMeet = meetNames[Math.floor(Math.random() * meetNames.length)];
    setPlaceholderName(randomAthlete);
    setPlaceholderMeet(randomMeet);

    const interval = setInterval(() => {
      const nextAthlete = athleteNames[Math.floor(Math.random() * athleteNames.length)];
      const nextMeet = meetNames[Math.floor(Math.random() * meetNames.length)];
      setPlaceholderName(nextAthlete);
      setPlaceholderMeet(nextMeet);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const searchPlaceholder = `Search for ${placeholderName}, ${placeholderMeet}, or local clubs...`;

  const { user } = useAuth();
  const canViewRankings =
    !!user &&
    (user.role === ROLES.ADMIN ||
      user.role === ROLES.USAW_NATIONAL_TEAM_COACH ||
      user.role === ROLES.VIP);

  return (
    <div className="min-h-screen bg-app-gradient">
      {/* Header */}
      <header className="bg-header-blur border-b border-app-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center space-x-4 hover:opacity-80 transition-opacity">
              <Image
                src="/logo.png"
                alt="WeightliftingDB Logo"
                width={56}
                height={56}
                className="h-14 w-14 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-app-primary">WeightliftingDB</h1>
                <p className="text-sm text-app-tertiary">Olympic Weightlifting Results Database</p>
              </div>
            </Link>

            {/* Add Theme Switcher and User Menu (only when logged in) */}
            <div className="flex items-center space-x-4">
              <ThemeSwitcher />
              <UserMenu onLoginClick={() => setShowLoginModal(true)} showOnlyWhenLoggedIn />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Search */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-app-primary mb-6">
            Olympic Weightlifting
            <span className="block text-blue-400">Results Database</span>
          </h2>
          <p className="text-xl text-app-tertiary mb-8 leading-relaxed">
            Search through <span className="font-bold text-blue-500">{dbStats?.results ? dbStats.results.toLocaleString() : '394,908'}</span> competition results by <span className="font-bold text-blue-500">{dbStats?.athletes ? dbStats.athletes.toLocaleString() : '86,877'}</span> athletes across <span className="font-bold text-blue-500">{dbStats?.meets ? dbStats.meets.toLocaleString() : '7,720'}</span> meets from USA and International Olympic Weightlifting.
          </p>

          <div className="w-full max-w-4xl mx-auto mt-8">
            <UnifiedSearch placeholder={searchPlaceholder} />
          </div>


        </div>
      </section>

      {/* Navigation Cards Section */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* WSO Navigation Card */}
            <Link href="/WSO" className="group h-full">
              <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-500/10 rounded-full p-3 group-hover:bg-blue-500/20 transition-colors">
                    <MapPin className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-app-primary group-hover:text-blue-400 transition-colors">
                      WSO Directory
                    </h3>
                    <p className="text-sm text-app-tertiary mt-1">
                      Explore Weightlifting State Organizations
                    </p>
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm text-blue-500 group-hover:text-blue-400 transition-colors">
                  <span>View interactive map</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Barbell Clubs Navigation Card */}
            <Link href="/club" className="group h-full">
              <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-orange-500/10 rounded-full p-3 group-hover:bg-orange-500/20 transition-colors">
                    <Dumbbell className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-app-primary group-hover:text-orange-400 transition-colors">
                      Barbell Clubs
                    </h3>
                    <p className="text-sm text-app-tertiary mt-1">
                      Discover registered weightlifting clubs
                    </p>
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm text-orange-500 group-hover:text-orange-400 transition-colors">
                  <span>Explore club locations</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Rankings Navigation Card - visible only to authorized roles */}
            {canViewRankings && (
              <Link href="/rankings" className="group h-full">
                <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-emerald-500/10 rounded-full p-3 group-hover:bg-emerald-500/20 transition-colors">
                      <Trophy className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-app-primary group-hover:text-emerald-400 transition-colors">
                        Rankings
                      </h3>
                      <p className="text-sm text-app-tertiary mt-1">
                        Explore athlete qualification rankings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center mt-4 text-sm text-emerald-400 group-hover:text-emerald-300 transition-colors">
                    <span>View rankings</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            )}

            {/* Upcoming Meets Navigation Card - visible only to Admin and VIP */}
            {(user?.role === ROLES.ADMIN || user?.role === ROLES.VIP) && (
              <Link href="/upcoming-meets" className="group h-full">
                <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-purple-500/10 rounded-full p-3 group-hover:bg-purple-500/20 transition-colors">
                      <CalendarFold className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-app-primary group-hover:text-purple-400 transition-colors">
                        Upcoming Meets
                      </h3>
                      <p className="text-sm text-app-tertiary mt-1">
                        Browse upcoming competition schedules
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center mt-4 text-sm text-purple-400 group-hover:text-purple-300 transition-colors">
                    <span>View upcoming meets</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            )}

            {/* Results Archive Navigation Card - visible only to Admin and VIP */}
            <Link href="/archive" className="group h-full">
              <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-500/10 rounded-full p-3 group-hover:bg-indigo-500/20 transition-colors">
                    <Archive className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-app-primary group-hover:text-indigo-400 transition-colors">
                      Results Archive
                    </h3>
                    <p className="text-sm text-app-tertiary mt-1">
                      Browse historical meet results
                    </p>
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  <span>View archive</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Lift Til Ya Die Mirror - publicly visible */}
            <Link href="/LiftTilYaDie/index.html" className="group h-full" target="_blank">
              <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-yellow-500/10 rounded-full p-3 group-hover:bg-yellow-500/20 transition-colors">
                    <Weight className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-app-primary group-hover:text-yellow-400 transition-colors">
                      LiftTilYaDie.com Site Archive
                    </h3>
                    <p className="text-sm text-app-tertiary mt-1">
                      Mirror of Butch Curry's original site (1998-2020)
                    </p>
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm text-yellow-500 group-hover:text-yellow-400 transition-colors">
                  <span>Visit mirror</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Admin Dashboard Navigation Card - visible only to Admin */}
            {user?.role === ROLES.ADMIN && (
              <Link href="/admin" className="group h-full">
                <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-red-500/10 rounded-full p-3 group-hover:bg-red-500/20 transition-colors">
                      <Shield className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-app-primary group-hover:text-red-400 transition-colors">
                        Admin
                      </h3>
                      <p className="text-sm text-app-tertiary mt-1">
                        Manage user access settings
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center mt-4 text-sm text-red-500 group-hover:text-red-400 transition-colors">
                    <span>Go to dashboard</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            )}

            {/* Data Export Navigation Card - visible to Admin, Researcher, National Team Coach, and VIP */}
            {!!user && (user.role === ROLES.ADMIN || user.role === ROLES.RESEARCHER || user.role === ROLES.USAW_NATIONAL_TEAM_COACH || user.role === ROLES.VIP) && (
              <Link href="/data-export" className="group h-full">
                <div className="bg-app-secondary border border-app-primary rounded-xl p-6 hover:bg-app-hover transition-all duration-200 hover:shadow-lg hover:scale-105 h-full flex flex-col justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="bg-cyan-500/10 rounded-full p-3 group-hover:bg-cyan-500/20 transition-colors">
                      <Database className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-app-primary group-hover:text-cyan-400 transition-colors">
                        Data Export
                      </h3>
                      <p className="text-sm text-app-tertiary mt-1">
                        Download raw dataset CSVs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center mt-4 text-sm text-cyan-400 group-hover:text-cyan-300 transition-colors">
                    <span>Access database exports</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-app-tertiary/50">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Stats content can be added here later */}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-app-secondary text-app-primary py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          {/* Mobile: Centered vertical layout, Desktop: Two columns */}
          <div className="flex flex-col items-center md:grid md:grid-cols-2 gap-6 md:gap-8 md:items-start">
            {/* Logo and description */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start space-x-2 mb-4">
                <Image
                  src="/logo.png"
                  alt="WeightliftingDB Logo"
                  width={24}
                  height={24}
                  className="h-6 w-6 object-contain"
                />
                <span className="font-bold">WeightliftingDB</span>
              </div>
              <p className="text-app-tertiary text-sm">
                Open source project, MIT License. Data sourced from official competition results.
              </p>
            </div>

            {/* User menu and GitHub link */}
            <div className="flex flex-col items-center md:items-end md:justify-end gap-4">
              <UserMenu onLoginClick={() => setShowLoginModal(true)} />
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

          {/* Copyright - always centered */}
          <div className="border-t border-app-secondary mt-8 pt-8 text-center text-sm text-app-tertiary">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
              <span className="whitespace-nowrap">2025 WeightliftingDB.</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                Built with <Heart className="h-4 w-4 text-blue-400" fill="currentColor" /> for
              </span>
              <span className="whitespace-nowrap">the weightlifting community.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
