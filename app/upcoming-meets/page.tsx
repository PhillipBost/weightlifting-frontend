import React from "react";
import { UpcomingMeetsContent } from "./components/UpcomingMeetsContent";
import { Meet } from "./components/UpcomingMeetsContent";
import { createClient } from '@supabase/supabase-js';
import { AuthGuard } from "../components/AuthGuard";
import { ROLES } from "../../lib/roles";

// Enable ISR with 24-hour revalidation
export const revalidate = 86400;

// Initialize Supabase Admin client for server-side fetching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getUpcomingMeetsData(): Promise<Meet[]> {
  try {
    // Fetch USAW Meet Entries to aggregate into Meets
    // We select the fields we need to group by listing_id
    const { data: entriesData, error: entriesError } = await supabase
      .from('usaw_meet_entries')
      .select('listing_id, meet_name, event_date, state, wso');

    if (entriesError) throw entriesError;

    // Group by listing_id
    const meetsMap = new Map<number, any>();

    (entriesData || []).forEach((entry: any) => {
      const { listing_id, meet_name, event_date, state, wso } = entry;

      if (!meetsMap.has(listing_id)) {
        meetsMap.set(listing_id, {
          listing_id,
          meet_name,
          event_date,
          state,
          wso,
          athleteCount: 1
        });
      } else {
        const existing = meetsMap.get(listing_id);
        existing.athleteCount += 1;
        // Update with latest info if needed (usually all entries for a listing have the same meet info)
        if (!existing.meet_name && meet_name) existing.meet_name = meet_name;
        if (!existing.event_date && event_date) existing.event_date = event_date;
        if (!existing.state && state) existing.state = state;
        if (!existing.wso && wso) existing.wso = wso;
      }
    });

    const usawMeets: Meet[] = Array.from(meetsMap.values()).map(m => {
      let isoDate = new Date().toISOString().split('T')[0];
      let endDateStr: string | undefined = undefined;
      let dateRange: string | undefined = m.event_date;

      if (m.event_date) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(m.event_date)) {
          isoDate = m.event_date;
        } else {
          // E.g., "February 1st 2026 - February 5th 2026", "May 20th - 22nd 2026"
          let temp = m.event_date.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1');
          const parts = temp.split(/ - | to |–/).map((p: string) => p.trim());

          if (parts.length > 0) {
            let startDStr = parts[0];

            // If parts[0] is just "May 20", it lacks a year. If parts[1] has a year, append it.
            if (parts.length > 1 && !/\d{4}/.test(parts[0]) && /\d{4}/.test(parts[1])) {
              const yearMatch = parts[1].match(/\d{4}/);
              if (yearMatch) startDStr += ` ${yearMatch[0]}`;
            }

            const startD = new Date(startDStr);
            if (!isNaN(startD.getTime())) {
              const year = startD.getFullYear();
              const month = String(startD.getMonth() + 1).padStart(2, '0');
              const day = String(startD.getDate()).padStart(2, '0');
              isoDate = `${year}-${month}-${day}`;
            }

            if (parts.length > 1) {
              // Process the end date.
              let endDStr = parts[1];
              // If endDStr doesn't contain letters, it probably lacks a month.
              if (!/[a-zA-Z]/.test(endDStr) && /[a-zA-Z]/.test(startDStr)) {
                const monthMatch = startDStr.match(/[a-zA-Z]+/);
                if (monthMatch) endDStr = `${monthMatch[0]} ${endDStr}`;
              }

              const endD = new Date(endDStr);
              if (!isNaN(endD.getTime())) {
                const year = endD.getFullYear();
                const month = String(endD.getMonth() + 1).padStart(2, '0');
                const day = String(endD.getDate()).padStart(2, '0');
                endDateStr = `${year}-${month}-${day}`;
              }
            }
          }
        }
      }

      const filtersObj = { event_from_date: isoDate };
      const base64Filters = Buffer.from(JSON.stringify(filtersObj)).toString('base64');

      return {
        id: `usaw_${m.listing_id}`,
        datasetId: m.listing_id,
        name: m.meet_name || `Meet ${m.listing_id}`,
        date: isoDate,
        endDate: endDateStr,
        dateRange: dateRange,
        location: m.state ? `${m.state}, USA` : 'USA', // Simple location string
        federation: 'USAW',
        url: `https://usaweightlifting.sport80.com/public/widget/1?filters=${base64Filters}`,
        elevation: undefined,
        wso: m.wso,
        athleteCount: m.athleteCount,
        state: m.state,
        country: 'USA',
        level: 'Local' // Default to local, could refine based on meet_name
      };
    });

    // 3. Combine and Sort (currently only USAW, sorted ascending by default)
    const combinedMeets = [...usawMeets].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return combinedMeets;

  } catch (err) {
    console.error('Error fetching upcoming meets data during ISR generation:', err);
    return [];
  }
}

export default async function UpcomingMeetsPage() {
  const initialMeets = await getUpcomingMeetsData();

  return (
    <AuthGuard requireAnyRole={[ROLES.ADMIN, ROLES.USAW_NATIONAL_TEAM_COACH, ROLES.VIP]}>
      <div className="min-h-screen bg-app-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-[1200px] mx-auto">
            <UpcomingMeetsContent initialMeets={initialMeets} />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
