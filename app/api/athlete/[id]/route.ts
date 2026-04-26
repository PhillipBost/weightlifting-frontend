import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { promisify } from 'util';
import zlib from 'zlib';

const gunzip = promisify(zlib.gunzip);

/**
 * Athlete Data Proxy (v4.0 - BACK TO BASICS)
 * -------------------------------------------
 * Restoring stability using the project's native Supabase client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  
  // Robust decoding: Handle potential double-encoding from the frontend
  let decodedId = id;
  while (decodedId !== decodeURIComponent(decodedId)) {
    decodedId = decodeURIComponent(decodedId);
  }
  
  let athleteId = decodedId;
  let isNumeric = /^\d+$/.test(decodedId);

  // 1. Slug Resolution (Point Lookup & Disambiguation)
  if (!isNumeric && !decodedId.startsWith('u-') && !decodedId.startsWith('iwf-')) {
    try {
      const supabase = await createClient();
      const normalizedName = decodedId.replace(/-/g, ' ').trim();
      const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
      const target = normalize(normalizedName);

      // 1a. Search USAW
      const { data: usawRaw } = await supabase
        .from('usaw_lifters')
        .select('lifter_id, membership_number, athlete_name')
        .ilike('athlete_name', `%${normalizedName}%`)
        .limit(10);
      
      const usawCandidates = (usawRaw || []).filter(c => normalize(c.athlete_name) === target);

      // 1b. Search IWF
      const { data: iwfRaw } = await supabase
        .from('iwf_lifters')
        .select('db_lifter_id, iwf_lifter_id, athlete_name, country_code, country_name')
        .ilike('athlete_name', `%${normalizedName}%`)
        .limit(10);
      
      const iwfCandidates = (iwfRaw || []).filter(c => normalize(c.athlete_name) === target);

      const totalCandidatesCount = usawCandidates.length + iwfCandidates.length;

      if (totalCandidatesCount > 1) {
        // Disambiguation Logic
        const usawEnriched = await Promise.all(
          usawCandidates.map(async (c) => {
            const { data: results } = await supabase
              .from('usaw_meet_results')
              .select('date, wso, club_name, gender')
              .eq('lifter_id', c.lifter_id)
              .order('date', { ascending: false })
              .limit(10);

            return {
              source: 'USAW',
              lifter_id: c.lifter_id,
              membership_number: c.membership_number,
              gender: results?.find(r => r.gender)?.gender || null,
              athlete_name: c.athlete_name,
              recent_wso: results?.find(r => r.wso)?.wso || null,
              recent_club: results?.find(r => r.club_name)?.club_name || null,
              first_active: results?.length ? results[results.length - 1].date : null,
              last_active: results?.length ? results[0].date : null,
              result_count: (results || []).length
            };
          })
        );

        const iwfEnriched = await Promise.all(
          iwfCandidates.map(async (c) => {
            const { data: results } = await supabase
              .from('iwf_meet_results')
              .select('date, country_name, gender')
              .eq('db_lifter_id', c.db_lifter_id)
              .order('date', { ascending: false })
              .limit(10);

            return {
              source: 'IWF',
              lifter_id: c.db_lifter_id,
              membership_number: c.iwf_lifter_id?.toString() || null,
              gender: results?.find(r => r.gender)?.gender || null,
              athlete_name: c.athlete_name,
              recent_wso: c.country_name || results?.find(r => r.country_name)?.country_name || c.country_code || null,
              recent_club: 'International',
              first_active: results?.length ? results[results.length - 1].date : null,
              last_active: results?.length ? results[0].date : null,
              result_count: (results || []).length
            };
          })
        );

        return NextResponse.json({
          isAmbiguous: true,
          candidates: [...usawEnriched, ...iwfEnriched]
        });
      }

      // Single match logic
      if (totalCandidatesCount === 1) {
        if (usawCandidates.length === 1) {
          const c = usawCandidates[0];
          athleteId = c.membership_number ? c.membership_number.toString() : `u-${c.lifter_id}`;
          isNumeric = !!c.membership_number;
        } else {
          const c = iwfCandidates[0];
          // IWF athletes are handled via a different data path but for now we need a resolved ID
          // Usually IWF pages go through a different shard or direct lookup
          return NextResponse.redirect(`${request.nextUrl.origin}/athlete/iwf/${c.db_lifter_id}`);
        }
      } else {
        return NextResponse.json({ error: `Athlete "${normalizedName}" not found.` }, { status: 404 });
      }
    } catch (err) {
      console.error('[API IDENTITY ERROR]:', err);
    }
  }

  // Handle explicit internal ID lookup or resolved numeric ID
  const isInternal = athleteId.startsWith('u-');
  const isIwf = athleteId.startsWith('iwf-');
  const federation = isIwf ? 'iwf' : 'usaw';
  const cleanId = isInternal ? athleteId.replace('u-', '') : isIwf ? athleteId.replace('iwf-', '') : athleteId;

  // 1. Unified Shard Lookup (Check Federation-specific storage first)
  const shardId = (isNumeric || isInternal || isIwf) ? cleanId.padStart(2, '0').slice(-2) : '00';
  const baseUrlData = 'http://46.62.223.85:8888';
  const shardUrl = isNumeric || isIwf
    ? `${baseUrlData}/${federation}/${shardId}/${cleanId}.json.gz`
    : `${baseUrlData}/${federation}/00/${cleanId}.json.gz`;

  try {
    const res = await fetch(shardUrl, {
      next: { revalidate: 0 },
      headers: { 
        'Accept-Encoding': 'gzip',
        'Cache-Control': 'no-store'
      }
    });

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const decompressed = await gunzip(Buffer.from(arrayBuffer));
      return new NextResponse(new Uint8Array(decompressed), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'X-Shard-ID': shardId,
          'X-Federation': federation
        }
      });
    }
  } catch (err) {
    console.warn(`[SHARD FETCH FAILED for ${federation}/${cleanId}]:`, err);
  }

  // 2. Resilient Database Fallback (Direct fetch if shard is missing)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // We use a dedicated admin client to ensure 100% visibility for the backup path
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);

    if (federation === 'iwf') {
      const { data: lifter } = await supabaseAdmin
        .from('iwf_lifters')
        .select('*')
        .eq('db_lifter_id', cleanId)
        .single();
      
      if (lifter) {
        const { data: results } = await supabaseAdmin
          .from('iwf_meet_results')
          .select('*, iwf_meets(meet, level, iwf_meet_id)')
          .eq('db_lifter_id', cleanId)
          .order('date', { ascending: false });

        return NextResponse.json({
          lifter_id: lifter.db_lifter_id,
          athlete_name: lifter.athlete_name,
          iwf_results: results || [],
          usaw_results: [],
          source: 'IWF'
        }, { headers: { 'X-Response-Source': 'Direct-DB-Backup' } });
      }
    } else {
      // USAW Database extraction if shard is missing
      const { data: lifter } = await supabaseAdmin
        .from('usaw_lifters')
        .select('*')
        .eq(isNumeric ? 'membership_number' : 'lifter_id', cleanId)
        .single();

      if (lifter) {
        const { data: results } = await supabaseAdmin
          .from('usaw_meet_results')
          .select('*')
          .eq('lifter_id', lifter.lifter_id)
          .order('date', { ascending: false });

        return NextResponse.json({
          lifter_id: lifter.lifter_id,
          athlete_name: lifter.athlete_name,
          membership_number: lifter.membership_number,
          usaw_results: results || [],
          iwf_results: []
        }, { headers: { 'X-Response-Source': 'Direct-DB-Backup' } });
      }
    }
  } catch (fallbackErr) {
    console.error('[API FALLBACK ERROR]:', fallbackErr);
  }

  return NextResponse.json({ error: 'Athlete data not found.' }, { status: 404 });
}
