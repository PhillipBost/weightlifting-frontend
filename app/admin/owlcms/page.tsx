"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, UploadCloud, ShieldAlert, Users } from 'lucide-react';
import { AuthGuard } from '../../components/AuthGuard';
import { ROLES } from '../../../lib/roles';
import { OwlcmsUploader } from '../../components/owlcms/OwlcmsUploader';
import { QuarantineReviewQueue } from '../../components/owlcms/QuarantineReviewQueue';
import { AthleteReviewQueue } from '../../components/owlcms/AthleteReviewQueue';

export default function OwlcmsAdminPage() {
  const [activeTab, setActiveTab] = useState<'importer' | 'meet_review' | 'athlete_review'>('importer');
  const [meetReviewCount, setMeetReviewCount] = useState<number>(0);
  const [athleteReviewCount, setAthleteReviewCount] = useState<number>(0);

  const fetchCounts = async () => {
    try {
      // 1. Fetch quarantined meets count
      const meetRes = await fetch('/api/owlcms/pending-count');
      const meetData = await meetRes.json();
      if (meetData.success && typeof meetData.count === 'number') {
        setMeetReviewCount(meetData.count);
      }

      // 2. Fetch pending athlete review count
      const athleteRes = await fetch('/api/owlcms/reviews');
      const athleteData = await athleteRes.json();
      if (athleteData.success && typeof athleteData.count === 'number') {
        setAthleteReviewCount(athleteData.count);
      }
    } catch {
      // Ignore background counter errors
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [activeTab]);

  return (
    <AuthGuard
      requireRole={ROLES.ADMIN}
      fallback={
        <div className="min-h-screen bg-app-gradient flex items-center justify-center p-6">
          <div className="text-center max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl">
            <Shield className="h-16 w-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-slate-400 text-sm mb-6">
              Admin access is required to access the OWLCMS competition importer.
            </p>
            <Link
              href="/"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-xl transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-app-gradient py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto space-y-6">
          {/* Top Bar with Back Navigation and Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Admin Dashboard</span>
            </Link>

            {/* Navigation Tabs (3 distinct workflows) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl flex-wrap">
              {/* Tab 1: Importer */}
              <button
                onClick={() => setActiveTab('importer')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'importer'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Meets</span>
              </button>

              {/* Tab 2: Meet Collisions Review Queue */}
              <button
                onClick={() => setActiveTab('meet_review')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'meet_review'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Meet Review</span>
                {meetReviewCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 animate-pulse">
                    {meetReviewCount}
                  </span>
                )}
              </button>

              {/* Tab 3: Athlete Matching Review Queue */}
              <button
                onClick={() => setActiveTab('athlete_review')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'athlete_review'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Athlete Review</span>
                {athleteReviewCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-300 text-indigo-950 animate-pulse">
                    {athleteReviewCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          <div className="w-full">
            {activeTab === 'importer' && <OwlcmsUploader />}
            {activeTab === 'meet_review' && (
              <QuarantineReviewQueue
                onCountChange={(newCount) => setMeetReviewCount(newCount)}
              />
            )}
            {activeTab === 'athlete_review' && (
              <AthleteReviewQueue
                onCountChange={(newCount) => setAthleteReviewCount(newCount)}
              />
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
