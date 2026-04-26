import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import AthleteSkeleton from '../../[id]/components/AthleteSkeleton';
import { AthleteProfileWrapper } from '../../[id]/components/AthleteProfileWrapper';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/athlete/iwf-${id}`);
    if (res.ok) {
      const data = await res.json();
      const name = data.iwf_athlete_name || data.athlete_name || `Athlete IWF-${id}`;
      return { title: `${name} | IWF` };
    }
  } catch (err) {
    console.error("IWF Metadata fetch error:", err);
  }

  return { title: "International Athlete | IWF" };
}

/**
 * PRODUCTION IWF ATHLETE PAGE (v7.0)
 * -----------------------------------
 * High-performance App Shell architecture with server-side pre-fetching.
 * Optimized for international performance and cross-link discovery.
 */
export default async function IWFAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Server-Side Data Pre-fetching (Eliminate Waterfall)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  let initialData = null;
  try {
    // Note: The API handler handles both IWF numeric IDs and USAW membership numbers
    // We use the iwf- prefix to explicitly route to the IWF Database resolution path
    const res = await fetch(`${baseUrl}/api/athlete/iwf-${id}`, {
      next: { revalidate: 3600 },
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=59'
      }
    });
    
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (err) {
    console.error(`[IWF PRODUCTION SERVER FETCH ERROR for athlete ${id}]:`, err);
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <Suspense fallback={<AthleteSkeleton />}>
        {/* Unified Orchestrator handles IWF logic natively */}
        <AthleteProfileWrapper id={`iwf-${id}`} initialData={initialData} forceIwfMode={true} />
      </Suspense>
    </div>
  );
}
