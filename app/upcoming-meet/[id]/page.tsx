import React from "react";
import { AuthGuard } from "../../components/AuthGuard";
import { ROLES } from "../../../lib/roles";
import { createClient } from '@supabase/supabase-js';
import { PredictionEngineContent, MeetEntry } from "../components/PredictionEngineContent";
import { UpcomingMeetMapWrapper } from "../components/UpcomingMeetMapWrapper";
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const revalidate = 3600; // Refetch predictions every hour roughly

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function UpcomingMeetPredictionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Parse the id to find the listing_id. We expect it to be a number (the USAW listing ID)
    const datasetId = parseInt(id, 10);

    if (isNaN(datasetId)) {
        return (
            <div className="min-h-screen bg-app-primary flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 border-b pb-2 mb-4 dark:text-gray-100">Invalid Meet ID</h1>
                    <Link href="/upcoming-meets" className="text-blue-500 hover:underline inline-flex items-center">
                        <ChevronLeft className="w-4 h-4 mr-1" /> Back to Upcoming Meets
                    </Link>
                </div>
            </div>
        );
    }

    // Fetch entries
    const { data: entriesData, error } = await supabase
        .from('usaw_meet_entries')
        .select('*')
        .eq('listing_id', datasetId);

    if (error) {
        console.error("Error fetching meet entries:", error);
    }

    const entries: MeetEntry[] = entriesData || [];

    // --- Best Q-Points Logic (Last 2 Years relative to Meet Start Date) ---
    const lifterIds = [...new Set(entries.map(e => e.lifter_id).filter((id): id is number => id !== null))];

    // Fetch start_date from usaw_meet_listings to use as our prediction ceiling
    const { data: listingData, error: listingError } = await supabase
        .from('usaw_meet_listings')
        .select('start_date, meet_name, latitude, longitude')
        .eq('listing_id', datasetId)
        .single();

    if (listingError) {
        console.error("Error fetching listing data:", listingError);
    }

    let cutoffDate = new Date();
    if (listingData?.start_date) {
        // We use the start_date to define the "present moment" for this meet
        // ensuring we don't use results from AFTER this meet occurred to predict its outcome.
        cutoffDate = new Date(listingData.start_date);
    }

    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    const twoYearsAgo = new Date(cutoffDate);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const twoYearsAgoStr = twoYearsAgo.toISOString().split('T')[0];

    const bestQYouthMap: Record<number, number> = {};
    const bestQPointsMap: Record<number, number> = {};
    const bestQMastersMap: Record<number, number> = {};

    // GAMX maps
    const bestGamxTotalMap: Record<number, number> = {};
    const bestGamxSMap: Record<number, number> = {};
    const bestGamxJMap: Record<number, number> = {};
    const bestGamxUMap: Record<number, number> = {};
    const bestGamxAMap: Record<number, number> = {};
    const bestGamxMastersMap: Record<number, number> = {};

    // Fetch in batches to avoid extremely long URL/query params
    const batchSize = 200;
    for (let i = 0; i < lifterIds.length; i += batchSize) {
        const batch = lifterIds.slice(i, i + batchSize);
        if (batch.length === 0) continue;

        const { data: qpointsData, error: qpointsError } = await supabase
            .from('usaw_meet_results')
            .select('lifter_id, q_youth, qpoints, q_masters, gamx_total, gamx_s, gamx_j, gamx_u, gamx_a, gamx_masters')
            .in('lifter_id', batch)
            .gte('date', twoYearsAgoStr)
            .lt('date', cutoffDateStr);

        if (!qpointsError && qpointsData) {
            for (const row of qpointsData) {
                if (row.lifter_id) {
                    if (row.q_youth) {
                        const currentBestYouth = bestQYouthMap[row.lifter_id] || 0;
                        if (row.q_youth > currentBestYouth) {
                            bestQYouthMap[row.lifter_id] = row.q_youth;
                        }
                    }
                    if (row.qpoints) {
                        const currentBest = bestQPointsMap[row.lifter_id] || 0;
                        if (row.qpoints > currentBest) {
                            bestQPointsMap[row.lifter_id] = row.qpoints;
                        }
                    }
                    if (row.q_masters) {
                        const currentBestMasters = bestQMastersMap[row.lifter_id] || 0;
                        if (row.q_masters > currentBestMasters) {
                            bestQMastersMap[row.lifter_id] = row.q_masters;
                        }
                    }
                    if (row.gamx_total) {
                        const currentBestGamx = bestGamxTotalMap[row.lifter_id] || 0;
                        if (row.gamx_total > currentBestGamx) {
                            bestGamxTotalMap[row.lifter_id] = row.gamx_total;
                        }
                    }
                    if (row.gamx_s) {
                        const currentBest = bestGamxSMap[row.lifter_id] || 0;
                        if (row.gamx_s > currentBest) bestGamxSMap[row.lifter_id] = row.gamx_s;
                    }
                    if (row.gamx_j) {
                        const currentBest = bestGamxJMap[row.lifter_id] || 0;
                        if (row.gamx_j > currentBest) bestGamxJMap[row.lifter_id] = row.gamx_j;
                    }
                    if (row.gamx_u) {
                        const currentBest = bestGamxUMap[row.lifter_id] || 0;
                        if (row.gamx_u > currentBest) bestGamxUMap[row.lifter_id] = row.gamx_u;
                    }
                    if (row.gamx_a) {
                        const currentBest = bestGamxAMap[row.lifter_id] || 0;
                        if (row.gamx_a > currentBest) bestGamxAMap[row.lifter_id] = row.gamx_a;
                    }
                    if (row.gamx_masters) {
                        const currentBest = bestGamxMastersMap[row.lifter_id] || 0;
                        if (row.gamx_masters > currentBest) bestGamxMastersMap[row.lifter_id] = row.gamx_masters;
                    }
                }
            }
        }
    }

    const enhancedEntries: MeetEntry[] = entries.map(entry => ({
        ...entry,
        best_q_youth: entry.lifter_id ? (bestQYouthMap[entry.lifter_id] || null) : null,
        best_qpoints: entry.lifter_id ? (bestQPointsMap[entry.lifter_id] || null) : null,
        best_q_masters: entry.lifter_id ? (bestQMastersMap[entry.lifter_id] || null) : null,
        best_gamx_total: entry.lifter_id ? (bestGamxTotalMap[entry.lifter_id] || null) : null,
        best_gamx_s: entry.lifter_id ? (bestGamxSMap[entry.lifter_id] || null) : null,
        best_gamx_j: entry.lifter_id ? (bestGamxJMap[entry.lifter_id] || null) : null,
        best_gamx_u: entry.lifter_id ? (bestGamxUMap[entry.lifter_id] || null) : null,
        best_gamx_a: entry.lifter_id ? (bestGamxAMap[entry.lifter_id] || null) : null,
        best_gamx_masters: entry.lifter_id ? (bestGamxMastersMap[entry.lifter_id] || null) : null
    }));

    // Extract basic meet info from the first entry if available
    const fallbackMeetName = entries.length > 0 && entries[0].meet_name ? entries[0].meet_name : `Meet ${datasetId}`;
    const fallbackMeetDate = entries.length > 0 && entries[0].event_date ? entries[0].event_date : "Unknown Date";

    const finalMeetName = listingData?.meet_name || fallbackMeetName;
    const finalMeetDate = listingData?.start_date ? new Date(listingData.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }) : fallbackMeetDate;

    console.log(`[UpcomingMeetPage] Rendering datasetId ${datasetId} | DB listingData returning lat/lng:`, listingData?.latitude, listingData?.longitude);
    const meetLat = listingData?.latitude || null;
    const meetLng = listingData?.longitude || null;

    return (
        <AuthGuard requireAnyRole={[ROLES.ADMIN, ROLES.USAW_NATIONAL_TEAM_COACH, ROLES.VIP]}>
            <div className="min-h-screen bg-app-primary">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="mb-6 flex items-center space-x-4">
                        <Link
                            href="/upcoming-meets"
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-app-tertiary text-app-secondary hover:bg-app-hover hover:text-accent-primary transition-all shadow-sm group"
                        >
                            <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-app-primary">{finalMeetName}</h1>
                            <p className="text-sm text-app-secondary mt-1">
                                Event Date: {finalMeetDate} • {entries.length} Entrants
                            </p>
                        </div>
                    </div>

                    <UpcomingMeetMapWrapper
                        datasetId={datasetId}
                        latitude={meetLat}
                        longitude={meetLng}
                    />

                    {entries.length === 0 ? (
                        <div className="bg-app-surface border border-app-primary rounded-2xl shadow-sm p-12 text-center text-app-secondary">
                            <p>No entries found for this meet yet.</p>
                        </div>
                    ) : (
                        <PredictionEngineContent entries={enhancedEntries} />
                    )}
                </div>
            </div>
        </AuthGuard>
    );
}
