import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import AthleteSkeleton from '../../[id]/components/AthleteSkeleton';
import { AthleteProfileWrapper } from '../../[id]/components/AthleteProfileWrapper';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/athlete/owlcms-${id}`);
    if (res.ok) {
      const data = await res.json();
      const name = data.athlete_name || `Athlete owlcms-${id}`;
      return { title: `${name} | owlcms` };
    }
  } catch (err) {
    console.error("owlcms Metadata fetch error:", err);
  }

  return { title: "Competitor | owlcms" };
}

/**
 * PRODUCTION OWLCMS ATHLETE PAGE
 * -----------------------------------
 * High-performance App Shell architecture with server-side pre-fetching.
 * Mirrors existing /athlete/iwf/[id] boilerplate with full AthleteProfileWrapper integration.
 */
export default async function OwlcmsAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Server-Side Data Pre-fetching (Eliminate Waterfall)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  let initialData = null;
  try {
    // We use the owlcms- prefix to explicitly route to the owlcms Database resolution path
    const res = await fetch(`${baseUrl}/api/athlete/owlcms-${id}`, {
      next: { revalidate: 0 },
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
    
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (err) {
    console.error(`[OWLCMS PRODUCTION SERVER FETCH ERROR for athlete ${id}]:`, err);
  }

  return (
    <div className="min-h-screen bg-app-gradient">
      <Suspense fallback={<AthleteSkeleton />}>
        {/* Unified Orchestrator handles owlcms logic natively */}
        <AthleteProfileWrapper id={`owlcms-${id}`} initialData={initialData} forceOwlcmsMode={true} />
      </Suspense>
    </div>
  );
}
