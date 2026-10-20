"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, UploadCloud, ShieldAlert, Users, RefreshCw } from 'lucide-react';
import { AuthGuard } from '../../components/AuthGuard';
import { ROLES } from '../../../lib/roles';
import { OwlcmsUploader } from '../../components/owlcms/OwlcmsUploader';
import { QuarantineReviewQueue } from '../../components/owlcms/QuarantineReviewQueue';
import { AthleteReviewQueue } from '../../components/owlcms/AthleteReviewQueue';

export default function OwlcmsAdminPage() {
  const [activeTab, setActiveTab] = useState<'importer' | 'meet_review' | 'athlete_review'>('importer');
  const [meetReviewCount, setMeetReviewCount] = useState<number>(0);
  const [athleteReviewCount, setAthleteReviewCount] = useState<number>(0);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [revalidateNotice, setRevalidateNotice] = useState<string | null>(null);

  const handleRevalidateArchive = async () => {
    setIsRevalidating(true);
    setRevalidateNotice(null);
    try {
      const res = await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/archive' })
      });
      const data = await res.json();
      if (data.success) {
        setRevalidateNotice('Archive cache successfully refreshed! Fresh meets will now load immediately.');
        setTimeout(() => setRevalidateNotice(null), 5000);
      } else {
        setRevalidateNotice(data.error || 'Failed to refresh cache');
        setTimeout(() => setRevalidateNotice(null), 5000);
      }
    } catch {
      setRevalidateNotice('Failed to refresh cache');
      setTimeout(() => setRevalidateNotice(null), 5000);
    } finally {
      setIsRevalidating(false);
    }
  };

  const fetchCounts = async () => {
    try {
      // 1. Fetch quarantined meets count
      const meetRes = await fetch('/api/owlcms/pending-count');
      const meetData = await meetRes.json();
      if (meetData.success && typeof meetData.count === 'number') {
        setMeetReviewCount(meetData.count);
      }

      // 2. Fetch pending athlete review count across all 4 categories
      const reviewRes = await fetch('/api/admin/review-queue?limit=1');
      const reviewData = await reviewRes.json();
      if (reviewData.success && typeof reviewData.counts?.total === 'number') {
        setAthleteReviewCount(reviewData.counts.total);
      }
    } catch {
      // Ignore background counter errors
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'athlete_review' || tab === 'meet_review' || tab === 'importer') {
        setActiveTab(tab);
      }
    }
  }, []);

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
              Admin access is required to access the owlcms competition importer.
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

            {/* Navigation Tabs (3 distinct workflows) and Cache Action */}
            <div className="flex items-center gap-2 flex-wrap">
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

              {/* Cache Purge / Revalidate Action Button */}
              <button
                onClick={handleRevalidateArchive}
                disabled={isRevalidating}
                title="Purge Vercel Edge CDN cache for /archive to immediately reflect newly ingested competitions without re-deploying"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-sky-300 hover:border-sky-500/40 transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isRevalidating ? 'animate-spin' : ''}`} />
                <span>{isRevalidating ? 'Refreshing Cache...' : 'Refresh Archive Cache'}</span>
              </button>
            </div>
          </div>

          {revalidateNotice && (
            <div className="p-3 rounded-xl bg-sky-950/60 border border-sky-500/40 text-xs text-sky-200 flex items-center justify-between shadow-lg">
              <span>{revalidateNotice}</span>
              <button
                onClick={() => setRevalidateNotice(null)}
                className="text-sky-400 hover:text-white text-xs font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Tab View - Preserved with CSS display to prevent unmounting and state loss */}
          <div className="w-full">
            <div className={activeTab === 'importer' ? 'block' : 'hidden'}>
              <OwlcmsUploader />
            </div>
            <div className={activeTab === 'meet_review' ? 'block' : 'hidden'}>
              <QuarantineReviewQueue
                onCountChange={(newCount) => setMeetReviewCount(newCount)}
              />
            </div>
            <div className={activeTab === 'athlete_review' ? 'block' : 'hidden'}>
              <AthleteReviewQueue
                onCountChange={(newCount) => setAthleteReviewCount(newCount)}
              />
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
