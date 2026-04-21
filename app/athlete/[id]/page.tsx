import React, { Suspense } from 'react';
import AthleteSkeleton from './components/AthleteSkeleton';
import { AthleteProfileWrapper } from './components/AthleteProfileWrapper';

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
      next: { revalidate: 3600 },
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=59'
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
