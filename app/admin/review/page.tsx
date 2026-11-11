"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Users, ShieldAlert } from 'lucide-react';
import { AuthGuard } from '../../components/AuthGuard';
import { ROLES } from '../../../lib/roles';
import { AthleteReviewQueue } from '../../components/owlcms/AthleteReviewQueue';
import { QuarantineReviewQueue } from '../../components/owlcms/QuarantineReviewQueue';

export default function AdminReviewSuitePage() {
  const [activeTab, setActiveTab] = useState<'athlete_review' | 'meet_review'>('athlete_review');
  const [athleteReviewCount, setAthleteReviewCount] = useState<number>(0);
  const [meetReviewCount, setMeetReviewCount] = useState<number>(0);

  const fetchCounts = async () => {
    try {
      const reviewRes = await fetch('/api/admin/review-queue?limit=1');
      const reviewData = await reviewRes.json();
      if (reviewData.success && typeof reviewData.counts?.total === 'number') {
        setAthleteReviewCount(reviewData.counts.total);
      }

      const meetRes = await fetch('/api/owlcms/pending-count');
      const meetData = await meetRes.json();
      if (meetData.success && typeof meetData.count === 'number') {
        setMeetReviewCount(meetData.count);
      }
    } catch {
      // Ignore background counter errors
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'meet_review' || tab === 'meets') {
        setActiveTab('meet_review');
      } else if (tab === 'athlete_review' || tab === 'athletes') {
        setActiveTab('athlete_review');
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
          <div className="text-center max-w-md p-8 card-primary">
            <Shield className="h-16 w-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-app-primary mb-2">Access Denied</h1>
            <p className="text-app-secondary text-sm mb-6">
              Admin access is required to access the data quality and review suite.
            </p>
            <Link
              href="/"
              className="px-5 py-2.5 bg-accent-primary hover:bg-accent-primary-hover text-white font-medium rounded-xl transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-app-gradient py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-medium text-app-tertiary hover:text-app-primary transition group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Admin Dashboard</span>
            </Link>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 p-1 card-primary flex-wrap">
                <button
                  onClick={() => setActiveTab('athlete_review')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'athlete_review'
                      ? 'bg-accent-secondary text-white shadow'
                      : 'text-app-secondary hover:text-app-primary hover:bg-app-hover'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Athlete Identity Review</span>
                  {athleteReviewCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-300 text-indigo-950 animate-pulse">
                      {athleteReviewCount.toLocaleString()}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('meet_review')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'meet_review'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-app-secondary hover:text-app-primary hover:bg-app-hover'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Meet Collision Review</span>
                  {meetReviewCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 animate-pulse">
                      {meetReviewCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className={activeTab === 'athlete_review' ? 'block' : 'hidden'}>
              <AthleteReviewQueue
                onCountChange={(newCount) => setAthleteReviewCount(newCount)}
              />
            </div>
            <div className={activeTab === 'meet_review' ? 'block' : 'hidden'}>
              <QuarantineReviewQueue
                onCountChange={(newCount) => setMeetReviewCount(newCount)}
              />
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

