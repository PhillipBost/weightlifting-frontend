import React, { Suspense } from 'react';
import AthleteSkeleton from '../../[id]/components/AthleteSkeleton';
import { AthleteProfileWrapper } from '../../[id]/components/AthleteProfileWrapper';

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
