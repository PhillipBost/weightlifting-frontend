import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;
const basicAuthUser = process.env.BASIC_AUTH_USER;
const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;

function getSupabaseAdmin() {
  const customHeaders: Record<string, string> = {};
  if (basicAuthUser && basicAuthPass) {
    customHeaders['Proxy-Authorization'] = `Basic ${Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64')}`;
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: customHeaders }
  });
}

export async function GET(request: Request) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const statusParam = (searchParams.get('status') || 'REVIEW_NEEDED').toUpperCase();
    const sourceFedParam = (searchParams.get('sourceFed') || '').trim();
    const targetFedParam = (searchParams.get('targetFed') || '').trim();
    const searchParam = (searchParams.get('search') || '').trim();
    const offset = (page - 1) * pageSize;

    // 1. Load federation registry
    const { data: federations } = await supabaseAdmin
      .from('federation_registry')
      .select('id, short_code, canonical_name');

    const fedByUuid = new Map<string, { id: string; code: string; name: string }>();
    const fedByCode = new Map<string, { id: string; code: string; name: string }>();
    (federations || []).forEach((f: any) => {
      const entry = {
        id: f.id,
        code: (f.short_code || '').toUpperCase(),
        name: f.canonical_name
      };
      fedByUuid.set(f.id, entry);
      if (entry.code) fedByCode.set(entry.code, entry);
    });

    const resolveFedUuid = (param: string): string | null => {
      if (!param) return null;
      if (fedByUuid.has(param)) return param;
      const upper = param.toUpperCase();
      return fedByCode.get(upper)?.id || null;
    };

    const sourceFedUuid = resolveFedUuid(sourceFedParam);
    const targetFedUuid = resolveFedUuid(targetFedParam);

    // 2. Build query on public.athlete_linking_evaluations
    let query = supabaseAdmin
      .from('athlete_linking_evaluations')
      .select('*', { count: 'exact' });

    if (statusParam !== 'ALL') {
      query = query.eq('status', statusParam);
    }
    if (sourceFedUuid) {
      query = query.eq('source_federation_id', sourceFedUuid);
    }
    if (targetFedUuid) {
      query = query.eq('target_federation_id', targetFedUuid);
    }
    if (searchParam) {
      const clean = searchParam.replace(/[%_]/g, '');
      query = query.or(
        `evidence_breakdown->source->>name.ilike.%${clean}%,evidence_breakdown->target->>name.ilike.%${clean}%`
      );
    }

    query = query
      .order('confidence_score', { ascending: false, nullsFirst: false })
      .order('evaluated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data: rows, error, count } = await query;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const rawRows = rows || [];

    // 3. Collect athlete IDs by federation for live enrichment (URLs, member numbers, Sport80 IDs)
    const iwfIds = new Set<number>();
    const usawIds = new Set<number>();
    const owlcmsIds = new Set<number>();

    rawRows.forEach((r: any) => {
      const sCode = fedByUuid.get(r.source_federation_id)?.code;
      const tCode = fedByUuid.get(r.target_federation_id)?.code;
      const sId = Number(r.source_athlete_id);
      const tId = r.target_athlete_id ? Number(r.target_athlete_id) : (r.evidence_breakdown?.target?.id ? Number(r.evidence_breakdown.target.id) : null);

      if (sId) {
        if (sCode === 'IWF') iwfIds.add(sId);
        else if (sCode === 'USAW') usawIds.add(sId);
        else if (sCode === 'OWLCMS') owlcmsIds.add(sId);
      }
      if (tId) {
        if (tCode === 'IWF') iwfIds.add(tId);
        else if (tCode === 'USAW') usawIds.add(tId);
        else if (tCode === 'OWLCMS') owlcmsIds.add(tId);
      }
    });

    const [iwfLiftersRes, usawLiftersRes, owlcmsLiftersRes] = await Promise.all([
      iwfIds.size > 0
        ? supabaseAdmin
            .from('iwf_lifters')
            .select('db_lifter_id, iwf_lifter_id, athlete_name, gender, birth_year, country_code, country_name, iwf_athlete_url')
            .in('db_lifter_id', Array.from(iwfIds))
        : Promise.resolve({ data: [] }),
      usawIds.size > 0
        ? supabaseAdmin
            .from('usaw_lifters')
            .select('lifter_id, athlete_name, membership_number, internal_id')
            .in('lifter_id', Array.from(usawIds))
        : Promise.resolve({ data: [] }),
      owlcmsIds.size > 0
        ? supabaseAdmin
            .from('owlcms_lifters')
            .select('lifter_id, athlete_name, gender, birth_year, country_code, club_name')
            .in('lifter_id', Array.from(owlcmsIds))
        : Promise.resolve({ data: [] })
    ]);

    const iwfMap = new Map<number, any>();
    (iwfLiftersRes.data || []).forEach((l: any) => iwfMap.set(Number(l.db_lifter_id), l));

    const usawMap = new Map<number, any>();
    (usawLiftersRes.data || []).forEach((l: any) => usawMap.set(Number(l.lifter_id), l));

    const owlcmsMap = new Map<number, any>();
    (owlcmsLiftersRes.data || []).forEach((l: any) => owlcmsMap.set(Number(l.lifter_id), l));

    const buildEnrichedAthlete = (
      fedCode: string,
      athleteId: number | null,
      snapshot: any
    ) => {
      if (!athleteId && !snapshot) return null;
      const id = Number(athleteId || snapshot?.id || 0);
      if (fedCode === 'IWF') {
        const live = iwfMap.get(id);
        const iwfLifterId = live?.iwf_lifter_id || snapshot?.iwf_lifter_id || null;
        return {
          id,
          name: live?.athlete_name || snapshot?.name || `IWF Athlete #${id}`,
          gender: live?.gender || snapshot?.gender || null,
          birthYear: live?.birth_year ?? snapshot?.birth_year ?? null,
          country: live?.country_code || snapshot?.country || live?.country_name || null,
          countryName: live?.country_name || null,
          bestTotal: snapshot?.best_total ?? null,
          tableColumn: 'iwf_lifters.db_lifter_id',
          iwfLifterId,
          owlanalyticsUrl: iwfLifterId ? `/athlete/iwf/${iwfLifterId}` : null,
          officialUrl: live?.iwf_athlete_url || (iwfLifterId ? `https://iwf.sport/weightlifting_/athletes-bios/?id=${iwfLifterId}` : null)
        };
      }
      if (fedCode === 'USAW') {
        const live = usawMap.get(id);
        const memberNum = live?.membership_number || snapshot?.membership_number || null;
        const sport80Id = live?.internal_id || snapshot?.internal_id || null;
        return {
          id,
          name: live?.athlete_name || snapshot?.name || `USAW Athlete #${id}`,
          gender: snapshot?.gender || null,
          birthYear: snapshot?.birth_year ?? null,
          country: snapshot?.country || 'USA',
          bestTotal: snapshot?.best_total ?? null,
          tableColumn: 'usaw_lifters.lifter_id',
          membershipNumber: memberNum,
          sport80InternalId: sport80Id,
          owlanalyticsUrl: memberNum ? `/athlete/${memberNum}` : `/athlete/u-${id}`,
          officialUrl: sport80Id ? `https://usaweightlifting.sport80.com/public/rankings/member/${sport80Id}` : null
        };
      }
      if (fedCode === 'OWLCMS') {
        const live = owlcmsMap.get(id);
        return {
          id,
          name: live?.athlete_name || snapshot?.name || `OWLCMS Athlete #${id}`,
          gender: live?.gender || snapshot?.gender || null,
          birthYear: live?.birth_year ?? snapshot?.birth_year ?? null,
          country: live?.country_code || snapshot?.country_code || snapshot?.country || null,
          clubName: live?.club_name || snapshot?.club_name || null,
          bestTotal: snapshot?.best_total ?? null,
          tableColumn: 'owlcms_lifters.lifter_id',
          owlanalyticsUrl: `/athlete/o-${id}`,
          officialUrl: null
        };
      }
      return {
        id,
        name: snapshot?.name || `Athlete #${id}`,
        gender: snapshot?.gender || null,
        birthYear: snapshot?.birth_year ?? null,
        country: snapshot?.country || null,
        bestTotal: snapshot?.best_total ?? null,
        tableColumn: 'source_athlete_id',
        owlanalyticsUrl: null,
        officialUrl: null
      };
    };

    const items = rawRows.map((r: any) => {
      const sFed = fedByUuid.get(r.source_federation_id) || { id: r.source_federation_id, code: 'UNKNOWN', name: 'Unknown Federation' };
      const tFed = fedByUuid.get(r.target_federation_id) || { id: r.target_federation_id, code: 'UNKNOWN', name: 'Unknown Federation' };
      const eb = r.evidence_breakdown || {};
      const targetId = r.target_athlete_id ? Number(r.target_athlete_id) : (eb.target?.id ? Number(eb.target.id) : null);

      return {
        evaluationId: Number(r.evaluation_id),
        status: r.status,
        sourceFederation: { id: sFed.id, code: sFed.code, name: sFed.name },
        targetFederation: { id: tFed.id, code: tFed.code, name: tFed.name },
        confidenceScore: r.confidence_score !== null && r.confidence_score !== undefined ? Number(r.confidence_score) : (eb.score ?? 0),
        cohort: eb.cohort || null,
        algorithmVersion: r.algorithm_version,
        sourceAthlete: buildEnrichedAthlete(sFed.code, Number(r.source_athlete_id), eb.source),
        candidateAthlete: buildEnrichedAthlete(tFed.code, targetId, eb.target),
        evidenceBreakdown: Array.isArray(eb.breakdown) ? eb.breakdown : (eb.reason ? [eb.reason] : []),
        rejectedCandidateIds: Array.isArray(eb.rejected_candidate_ids) ? eb.rejected_candidate_ids : [],
        isBlacklisted: Boolean(r.is_blacklisted),
        reviewerNotes: r.reviewer_notes || null,
        enqueuedAt: r.created_at,
        evaluatedAt: r.evaluated_at,
        updatedAt: r.updated_at
      };
    });

    const totalItems = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return NextResponse.json({
      success: true,
      page,
      pageSize,
      totalItems,
      totalPages,
      items
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to load review queue' },
      { status: 500 }
    );
  }
}

