"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OwlcmsLegacyRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'athlete_review') {
        router.replace('/admin/review?tab=athlete_review');
      } else if (tab === 'meet_review') {
        router.replace('/admin/review?tab=meet_review');
      } else if (tab === 'iwf_importer' || tab === 'iwf') {
        router.replace('/admin/importers?tab=iwf');
      } else {
        router.replace('/admin/importers?tab=owlcms');
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center p-6">
      <div className="text-center text-slate-400 text-sm">
        Redirecting to administrative hub...
      </div>
    </div>
  );
}
