'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useUpcomingMeetClubLocations } from '../../hooks/useUpcomingMeetClubLocations';

const MeetHubSpokeMap = dynamic(() => import('../../components/MeetHubSpokeMap'), { ssr: false });

interface UpcomingMeetMapWrapperProps {
    datasetId: number;
    latitude: number | null;
    longitude: number | null;
}

export function UpcomingMeetMapWrapper({ datasetId, latitude, longitude }: UpcomingMeetMapWrapperProps) {
    const { spokes, loading, error } = useUpcomingMeetClubLocations(datasetId.toString());

    if (!latitude || !longitude) {
        return null;
    }

    return (
        <div className="card-primary mb-8">
            <h2 className="text-2xl font-bold text-app-primary mb-4">Participant Locations</h2>
            <MeetHubSpokeMap
                meetLat={latitude}
                meetLng={longitude}
                spokes={spokes}
                type="club"
                loading={loading}
                error={error}
            />
        </div>
    );
}
