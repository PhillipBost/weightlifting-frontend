import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { promisify } from 'util';
import zlib from 'zlib';

const gunzip = promisify(zlib.gunzip);

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;

  const customHeaders: Record<string, string> = {};
  if (basicAuthUser && basicAuthPass) {
    customHeaders['Proxy-Authorization'] = `Basic ${Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64')}`;
  }
  return createAdminClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: customHeaders }
  });
}

async function enrichWithOwlcms(data: any, usawLifterId?: number | null, iwfDbLifterId?: number | null) {
  if (!usawLifterId && !iwfDbLifterId) return data;
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase.from('athlete_aliases').select('owlcms_lifter_id');
    if (usawLifterId) {
      query = query.eq('usaw_lifter_id', usawLifterId);
    } else if (iwfDbLifterId) {
      query = query.eq('iwf_db_lifter_id', iwfDbLifterId);
    }
    const { data: alias } = await query.maybeSingle();

    if (alias?.owlcms_lifter_id) {
      data.linked_owlcms_id = alias.owlcms_lifter_id;
      const { data: owlcmsRes } = await supabase
        .from('owlcms_meet_results')
        .select(`
          result_id,
          meet_id,
          body_weight_kg,
          category,
          snatch_1,
          snatch_2,
          snatch_3,
          best_snatch,
          cj_1,
          cj_2,
          cj_3,
          best_cj,
          total,
          qpoints,
          gamx_total,
          gamx_s,
          gamx_j,
          gamx_u,
          gamx_a,
          gamx_masters,
          meet:owlcms_meets (
            meet_name,
            start_date
          )
        `)
        .eq('lifter_id', alias.owlcms_lifter_id);

      if (owlcmsRes && owlcmsRes.length > 0) {
        data.owlcms_results = owlcmsRes.map((r: any) => {
          const meet = Array.isArray(r.meet) ? r.meet[0] : r.meet;
          return {
            result_id: r.result_id,
            meet_id: r.meet_id,
            meet_name: meet?.meet_name || `Meet #${r.meet_id}`,
            date: meet?.start_date,
            category: r.category,
            weight_class: r.category,
            body_weight_kg: r.body_weight_kg,
            snatch_lift_1: r.snatch_1 ? String(r.snatch_1) : null,
            snatch_lift_2: r.snatch_2 ? String(r.snatch_2) : null,
            snatch_lift_3: r.snatch_3 ? String(r.snatch_3) : null,
            best_snatch: r.best_snatch ? String(r.best_snatch) : null,
            cj_lift_1: r.cj_1 ? String(r.cj_1) : null,
            cj_lift_2: r.cj_2 ? String(r.cj_2) : null,
            cj_lift_3: r.cj_3 ? String(r.cj_3) : null,
            best_cj: r.best_cj ? String(r.best_cj) : null,
            total: r.total ? String(r.total) : null,
            qpoints: r.qpoints,
            gamx_total: r.gamx_total,
            gamx_s: r.gamx_s,
            gamx_j: r.gamx_j,
            gamx_u: r.gamx_u,
            gamx_a: r.gamx_a,
            gamx_masters: r.gamx_masters,
            _source: 'OWLCMS'
          };
        });
      }
    }
  } catch (err) {
    console.error('[OWLCMS ENRICHMENT ERROR]:', err);
  }
  return data;
}

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
  // 1. Unified Shard Lookup (Check Federation-specific storage first)
  const isInternal = athleteId.startsWith('u-');
  const isIwf = athleteId.startsWith('iwf-');
  const cleanId = isInternal ? athleteId.replace('u-', '') : isIwf ? athleteId.replace('iwf-', '') : athleteId;
  const federation = isIwf ? 'iwf' : 'usaw';
  const shardFolder = isInternal ? 'internal' : federation;

  // Standardization: last two digits of the clean ID
  const shardId = cleanId.padStart(2, '0').slice(-2);
  const baseUrlData = 'http://46.62.223.85:8888';
  const shardUrl = (isNumeric || isIwf || isInternal)
    ? `${baseUrlData}/${shardFolder}/${shardId}/${cleanId}.json.gz`
    : `${baseUrlData}/${shardFolder}/00/${cleanId}.json.gz`;

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
      const buffer = Buffer.from(arrayBuffer);
      
      let decompressed;
      // Safety: Check if it's already decompressed (JSON start) or gzipped (magic number 0x1f8b)
      if (buffer[0] === 0x7b) { // '{'
        decompressed = buffer;
      } else {
        try {
          decompressed = await gunzip(buffer);
        } catch (gzErr) {
          console.warn(`[GUNZIP FAILED for ${shardUrl}]:`, gzErr);
          // Fallback: If it's already text, send as is
          if (buffer[0] === 0x7b || buffer.toString().trim().startsWith('{')) {
            decompressed = buffer;
          } else {
            throw gzErr;
          }
        }
      }

      let payload: any;
      try {
        payload = JSON.parse(decompressed.toString('utf8'));
      } catch {
        payload = null;
      }

      if (payload) {
        const usawId = federation === 'usaw' ? payload.lifter_id : null;
        const iwfId = federation === 'iwf' ? payload.lifter_id : null;
        payload = await enrichWithOwlcms(payload, usawId, iwfId);
        return NextResponse.json(payload, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Response-Time': `${Date.now() - startTime}ms`,
            'X-Shard-ID': shardId,
            'X-Federation': federation
          }
        });
      }

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
    const supabaseAdmin = getSupabaseAdmin();

    if (federation === 'iwf') {
      let { data: lifter } = await supabaseAdmin
        .from('iwf_lifters')
        .select('*')
        .eq('db_lifter_id', cleanId)
        .single();
      
      // Fallback: If not found by db_lifter_id, try official iwf_lifter_id
      if (!lifter && /^\d+$/.test(cleanId)) {
        const { data: lifterByIwfId } = await supabaseAdmin
          .from('iwf_lifters')
          .select('*')
          .eq('iwf_lifter_id', parseInt(cleanId))
          .single();
        lifter = lifterByIwfId;
      }
      
      if (lifter) {
        const { data: results } = await supabaseAdmin
          .from('iwf_meet_results')
          .select('*, iwf_meets(meet, level, iwf_meet_id)')
          .eq('db_lifter_id', cleanId)
          .order('date', { ascending: false });

        let iwfPayload: any = {
          lifter_id: lifter.db_lifter_id,
          athlete_name: lifter.athlete_name,
          iwf_results: results || [],
          usaw_results: [],
          source: 'IWF'
        };
        iwfPayload = await enrichWithOwlcms(iwfPayload, null, lifter.db_lifter_id);

        return NextResponse.json(iwfPayload, { headers: { 'X-Response-Source': 'Direct-DB-Backup' } });
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

        let usawPayload: any = {
          lifter_id: lifter.lifter_id,
          athlete_name: lifter.athlete_name,
          membership_number: lifter.membership_number,
          usaw_results: results || [],
          iwf_results: []
        };
        usawPayload = await enrichWithOwlcms(usawPayload, lifter.lifter_id, null);

        return NextResponse.json(usawPayload, { headers: { 'X-Response-Source': 'Direct-DB-Backup' } });
      }
    }
  } catch (fallbackErr) {
    console.error('[API FALLBACK ERROR]:', fallbackErr);
  }

  return NextResponse.json({ error: 'Athlete data not found.' }, { status: 404 });
}
