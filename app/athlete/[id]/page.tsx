import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import AthleteSkeleton from './components/AthleteSkeleton';
import { AthleteProfileWrapper } from './components/AthleteProfileWrapper';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/athlete/${encodeURIComponent(id)}`);
    if (res.ok) {
      const data = await res.json();
      const name = data.usaw_athlete_name || data.athlete_name || `Athlete ${id}`;
      return { title: `${name} | USAW` };
    }
  } catch (err) {
    console.error("Metadata fetch error:", err);
  }

  return { title: "Athlete Profile | USAW" };
}

/**
 * PRODUCTION USAW ATHLETE PAGE (v7.0)
 * -----------------------------------
 * High-performance App Shell architecture with server-side pre-fetching.
 * Enforces zero-shift hydration and top-to-bottom loading order.
 */
export default async function AthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Server-Side Data Pre-fetching (Eliminate Waterfall)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  let initialData = null;
  try {
    const res = await fetch(`${baseUrl}/api/athlete/${encodeURIComponent(id)}`, {
      next: { revalidate: 0 },
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
    
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (err) {
    console.error(`[PRODUCTION SERVER FETCH ERROR for athlete ${id}]:`, err);
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <Suspense fallback={<AthleteSkeleton />}>
        {/* Unified Orchestrator for stable, shift-free loading */}
        <AthleteProfileWrapper id={id} initialData={initialData} />
      </Suspense>
    </div>
  );
}
