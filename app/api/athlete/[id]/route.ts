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

async function enrichWithOwlcms(
  data: any, 
  usawLifterId?: number | null, 
  iwfDbLifterId?: number | null,
  membershipNumber?: number | string | null
) {
  if (!usawLifterId && !iwfDbLifterId && !membershipNumber && !data?.id) return data;
  try {
    const supabase = getSupabaseAdmin();
    let resolvedUsawId = usawLifterId;
    if (membershipNumber || usawLifterId) {
      const orFilters: string[] = [];
      if (membershipNumber) orFilters.push(`membership_number.eq.${membershipNumber}`);
      if (usawLifterId) {
        orFilters.push(`lifter_id.eq.${usawLifterId}`);
        orFilters.push(`internal_id.eq.${usawLifterId}`);
      }
      const { data: lifter } = await supabase
        .from('usaw_lifters')
        .select('lifter_id')
        .or(orFilters.join(','))
        .maybeSingle();
      if (lifter?.lifter_id) resolvedUsawId = lifter.lifter_id;
    }

    const aliasFilters: string[] = [];
    if (resolvedUsawId) aliasFilters.push(`usaw_lifter_id.eq.${resolvedUsawId}`);
    if (iwfDbLifterId) aliasFilters.push(`iwf_db_lifter_id.eq.${iwfDbLifterId}`);
    if (data.id) aliasFilters.push(`iwf_db_lifter_id.eq.${data.id}`);

    if (aliasFilters.length === 0) return data;
    const { data: aliases, error: aliasErr } = await supabase
      .from('athlete_aliases')
      .select('owlcms_lifter_id')
      .or(aliasFilters.join(','));
    if (aliasErr || !aliases || aliases.length === 0) return data;

    const owlcmsLifterIds = Array.from(
      new Set(aliases.map((a: any) => a.owlcms_lifter_id).filter((id): id is number => Boolean(id)))
    );
    if (owlcmsLifterIds.length === 0) return data;

    data.linked_owlcms_id = owlcmsLifterIds[0];
    const { data: owlcmsRes } = await supabase
      .from('owlcms_meet_results')
      .select(`
        result_id,
        meet_id,
        body_weight_kg,
        category,
        session_name,
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
        q_youth,
        q_masters,
        gamx_total,
        gamx_s,
        gamx_j,
        gamx_u,
        gamx_a,
        gamx_masters,
        meet:owlcms_meets (
          meet_name,
          start_date,
          raw_payload
        )
      `)
      .in('lifter_id', owlcmsLifterIds);

      if (owlcmsRes && owlcmsRes.length > 0) {
        data.owlcms_results = owlcmsRes.map((r: any) => {
          const meet = Array.isArray(r.meet) ? r.meet[0] : r.meet;
          let sessionDescriptor: string | null = null;
          if (r.session_name) {
            const rawSessions: any[] = meet?.raw_payload?.sessions || [];
            const sorted = [...rawSessions].sort((a, b) => {
              const timeA = Array.isArray(a.competitionTime) ? new Date(Date.UTC(a.competitionTime[0], a.competitionTime[1] - 1, a.competitionTime[2], a.competitionTime[3] || 0, a.competitionTime[4] || 0)).getTime() : 0;
              const timeB = Array.isArray(b.competitionTime) ? new Date(Date.UTC(b.competitionTime[0], b.competitionTime[1] - 1, b.competitionTime[2], b.competitionTime[3] || 0, b.competitionTime[4] || 0)).getTime() : 0;
              return timeA - timeB;
            });
            const matchIdx = sorted.findIndex((s) => s.name === r.session_name);
            if (matchIdx !== -1) {
              const s = sorted[matchIdx];
              const sNum = matchIdx + 1;
              const platform = s.platformName ? `Platform ${s.platformName}` : null;
              const isPureNumber = /^\d+$/.test(r.session_name.trim());
              sessionDescriptor = platform
                ? (isPureNumber ? `${platform} - Session ${r.session_name}` : `${platform} - Session ${sNum} (${r.session_name})`)
                : (isPureNumber ? `Session ${r.session_name}` : `Session ${sNum} (${r.session_name})`);
            } else {
              sessionDescriptor = `Session ${r.session_name}`;
            }
          }
          return {
            result_id: r.result_id,
            meet_id: r.meet_id,
            meet_name: meet?.meet_name || `Meet #${r.meet_id}`,
            date: meet?.start_date,
            category: r.category,
            session_descriptor: sessionDescriptor,
            session_name: r.session_name,
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
            q_youth: r.q_youth,
            q_masters: r.q_masters,
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
  if (!isNumeric && !decodedId.startsWith('u-') && !decodedId.startsWith('iwf-') && !decodedId.startsWith('owlcms-')) {
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
  const isOwlcms = athleteId.startsWith('owlcms-');
  const cleanId = isInternal 
    ? athleteId.replace('u-', '') 
    : isIwf 
      ? athleteId.replace('iwf-', '') 
      : isOwlcms 
        ? athleteId.replace('owlcms-', '') 
        : athleteId;
  const federation = isIwf ? 'iwf' : isOwlcms ? 'owlcms' : 'usaw';
  const shardFolder = isInternal ? 'internal' : federation;

  // Standardization: last two digits of the clean ID
  const shardId = cleanId.padStart(2, '0').slice(-2);
  const baseUrlData = 'http://46.62.223.85:8888';
  const shardUrl = (isNumeric || isIwf || isInternal || isOwlcms)
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
        // Zero runtime DB queries if shard was compiled with the owlcms_results schema
        if (payload.owlcms_results === undefined) {
          const usawId = federation === 'usaw' ? (payload.internal_id || payload.lifter_id) : null;
          const iwfId = payload.id || (federation === 'iwf' ? payload.lifter_id : null);
          const membershipNum = federation === 'usaw' ? (payload.membership_number || cleanId) : null;
          payload = await enrichWithOwlcms(payload, usawId, iwfId, membershipNum);
        }
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

    if (federation === 'owlcms') {
      const lifterId = parseInt(cleanId, 10);
      if (!isNaN(lifterId)) {
        const { data: lifter } = await supabaseAdmin
          .from('owlcms_lifters')
          .select('*')
          .eq('lifter_id', lifterId)
          .single();

        if (lifter) {
          // Find sibling owlcms IDs via verified aliases
          const { data: aliases } = await supabaseAdmin
            .from('athlete_aliases')
            .select('usaw_lifter_id, iwf_db_lifter_id')
            .eq('owlcms_lifter_id', lifterId);

          const usawLifterIds = Array.from(new Set((aliases || []).map((a: any) => a.usaw_lifter_id).filter(Boolean)));
          const iwfLifterIds = Array.from(new Set((aliases || []).map((a: any) => a.iwf_db_lifter_id).filter(Boolean)));

          let targetOwlcmsIds = [lifterId];
          if (usawLifterIds.length > 0) {
            const { data: siblingAliases } = await supabaseAdmin
              .from('athlete_aliases')
              .select('owlcms_lifter_id')
              .in('usaw_lifter_id', usawLifterIds);
            if (siblingAliases && siblingAliases.length > 0) {
              targetOwlcmsIds = Array.from(new Set([
                ...targetOwlcmsIds,
                ...siblingAliases.map((a: any) => a.owlcms_lifter_id).filter(Boolean)
              ]));
            }
          }

          const { data: results } = await supabaseAdmin
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
              q_youth,
              q_masters,
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
            .in('lifter_id', targetOwlcmsIds)
            .order('result_id', { ascending: false });

          const formattedOwlcms = (results || []).map((r: any) => {
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
              q_youth: r.q_youth,
              q_masters: r.q_masters,
              gamx_total: r.gamx_total,
              gamx_s: r.gamx_s,
              gamx_j: r.gamx_j,
              gamx_u: r.gamx_u,
              gamx_a: r.gamx_a,
              gamx_masters: r.gamx_masters,
              _source: 'owlcms'
            };
          });

          let canonicalUsawId: string | null = null;
          let canonicalUsawInternalId: string | number | null = null;
          let canonicalIwfId: string | null = null;
          let usawResults: any[] = [];
          let iwfResults: any[] = [];

          if (usawLifterIds.length > 0) {
            const { data: uLifters } = await supabaseAdmin
              .from('usaw_lifters')
              .select('lifter_id, membership_number, internal_id')
              .in('lifter_id', usawLifterIds);
            const primaryUsaw = uLifters?.[0];
            if (primaryUsaw) {
              canonicalUsawId = primaryUsaw.membership_number
                ? primaryUsaw.membership_number.toString()
                : `u-${primaryUsaw.lifter_id}`;
              canonicalUsawInternalId = primaryUsaw.internal_id || null;
            }
            const { data: uRes } = await supabaseAdmin
              .from('usaw_meet_results')
              .select('*, meets:usaw_meets(Level)')
              .in('lifter_id', usawLifterIds)
              .order('date', { ascending: false });
            usawResults = uRes || [];
          }

          if (iwfLifterIds.length > 0) {
            const { data: iLifters } = await supabaseAdmin
              .from('iwf_lifters')
              .select('db_lifter_id, iwf_lifter_id')
              .in('db_lifter_id', iwfLifterIds);
            const primaryIwf = iLifters?.[0];
            if (primaryIwf) {
              canonicalIwfId = primaryIwf.iwf_lifter_id
                ? primaryIwf.iwf_lifter_id.toString()
                : primaryIwf.db_lifter_id.toString();
            } else {
              canonicalIwfId = iwfLifterIds[0].toString();
            }

            const { data: iRes } = await supabaseAdmin
              .from('iwf_meet_results')
              .select('*, iwf_meets(meet, level, iwf_meet_id)')
              .in('db_lifter_id', iwfLifterIds)
              .order('date', { ascending: false });
            iwfResults = iRes || [];
          }

          const owlcmsPayload = {
            lifter_id: lifter.lifter_id,
            athlete_name: lifter.athlete_name,
            first_name: lifter.first_name,
            last_name: lifter.last_name,
            gender: lifter.gender,
            birthYear: lifter.birth_year,
            country_code: lifter.country_code,
            club_name: lifter.club_name,
            membership_number: canonicalUsawId || lifter.membership_number || null,
            internal_id: canonicalUsawInternalId,
            linked_owlcms_id: lifter.lifter_id,
            linked_usaw_id: canonicalUsawId,
            linked_iwf_id: canonicalIwfId,
            iwf_lifter_id: canonicalIwfId,
            owlcms_results: formattedOwlcms,
            usaw_results: usawResults,
            iwf_results: iwfResults,
            source: 'owlcms'
          };

          return NextResponse.json(owlcmsPayload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Response-Source': 'Direct-DB-Backup'
            }
          });
        }
      }
    } else if (federation === 'iwf') {
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
