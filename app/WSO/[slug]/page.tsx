import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import WSODetailClient from '../../components/WSO/WSODetailClient'

// Initialize Supabase Admin client for server-side fetching
// Using Service Role key to bypass RLS and ensure complete data access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Enable ISR with 24-hour revalidation
export const revalidate = 86400

// Helper to convert slug to WSO name
function slugToWsoName(slug: string): string {
  const specialCases: { [key: string]: string } = {
    'dmv': 'DMV',
    'pennsylvania-west-virginia': 'Pennsylvania-West Virginia',
    'iowa-nebraska': 'Iowa-Nebraska',
    'minnesota-dakotas': 'Minnesota-Dakotas',
    'missouri-valley': 'Missouri Valley',
    'mountain-north': 'Mountain North',
    'mountain-south': 'Mountain South',
    'new-england': 'New England',
    'new-jersey': 'New Jersey',
    'new-york': 'New York',
    'pacific-northwest': 'Pacific Northwest',
    'tennessee-kentucky': 'Tennessee-Kentucky',
    'texas-oklahoma': 'Texas-Oklahoma',
    'california-north-central': 'California North Central',
    'california-south': 'California South',
    'hawaii-and-international': 'Hawaii and International'
  }

  if (specialCases[slug]) {
    return specialCases[slug]
  }

  return slug
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Data fetching function (server-side)
async function getWSOData(slug: string) {
  const wsoName = slugToWsoName(slug);

  // 1. Get WSO Information
  const { data: wsoInfo, error: wsoError } = await supabase
    .from('usaw_wso_information')
    .select('*')
    .eq('name', wsoName)
    .single();

  if (wsoError || !wsoInfo) {
    console.error(`Error fetching WSO info for ${wsoName}:`, wsoError);
    return null;
  }

  // 2. Get Clubs
  const { data: clubs } = await supabase
    .from('usaw_clubs')
    .select('club_name, wso_geography, phone, email, address, geocode_display_name, latitude, longitude, active_lifters_count')
    .eq('wso_geography', wsoName)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('club_name');

  const safeClubs = clubs || [];

  // 3. Get Recent Meets (Server-side fetch)
  // Calculate 12-month window
  const currentDate = new Date();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(currentDate.getMonth() - 12);
  const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0];

  const { data: recentMeetsData } = await supabase
    .from('usaw_meets')
    .select('meet_id, Meet, Date, wso_geography, latitude, longitude, address, city, state')
    .eq('wso_geography', wsoName)
    .gte('Date', cutoffDate)
    .not('meet_id', 'is', null)
    .order('Date', { ascending: false });

  // Process Meets (Fallback coordinates logic)
  const safeMeets = (recentMeetsData || []).map((meet: any) => {
    let latitude = meet.latitude;
    let longitude = meet.longitude;
    let usesFallback = false;

    // Format location
    let location = meet.city || meet.state || 'Location not available';
    if (meet.city && meet.state) {
      location = `${meet.city}, ${meet.state}`;
    }

    return {
      meet_id: meet.meet_id,
      meet_name: meet.Meet,
      date: meet.Date,
      wso: wsoName,
      latitude,
      longitude,
      venue: null,
      city: meet.city,
      state: meet.state,
      address: meet.address,
      location,
      uses_fallback_coordinates: usesFallback
    };
  });

  // 4. Calculate Stats
  const locations = safeClubs.map(club => {
    const displayName = club.geocode_display_name || club.address || '';
    const parts = displayName.split(',').map((p: string) => p.trim());
    return {
      city: parts.length >= 2 ? parts[parts.length - 2] : '',
      state: parts.length >= 1 ? parts[parts.length - 1] : ''
    };
  });

  const clubStats = {
    totalClubs: safeClubs.length,
    activeClubs: safeClubs.length,
    citiesCount: new Set(locations.map(l => l.city).filter(c => c)).size,
    statesCount: wsoInfo?.states?.length || 0
  };

  return {
    wsoName,
    wsoInfo,
    clubs: safeClubs,
    clubStats,
    recentMeets: safeMeets
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const wsoName = slugToWsoName(slug)

  return {
    title: `${wsoName} Weightlifting - Clubs, Meets & Records`,
    description: `Find weightlifting clubs, upcoming meets, and records in ${wsoName}. View the official territory map and club participation statistics.`,
  }
}

// Generate static params for all known WSOs to pre-render at build time
export async function generateStaticParams() {
  // Fetch all unique WSO names from usaw_wso_information
  const { data: wsos } = await supabase
    .from('usaw_wso_information')
    .select('name')

  if (!wsos) return []

  return wsos.map((wso) => ({
    slug: wso.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }))
}

export default async function WSODetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getWSOData(slug)

  if (!data) {
    notFound()
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-app-gradient flex items-center justify-center p-8 text-xl text-app-primary">Loading {data.wsoName} Data...</div>}>
      <WSODetailClient clubData={data} slug={slug} recentMeets={data.recentMeets} />
    </Suspense>
  )
}
