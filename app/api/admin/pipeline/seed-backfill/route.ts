import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;
const basicAuthUser = process.env.BASIC_AUTH_USER;
const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;

const ALGORITHM_VERSION = 'v2.2-demographic-physics-symmetrical';

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

async function fetchAllColumn<T = any>(
  supabaseAdmin: any,
  table: string,
  select: string,
  buildFilter?: (q: any) => any
): Promise<T[]> {
  const results: T[] = [];
  const PAGE_SIZE = 1000;
  let page = 0;

  while (true) {
    let q = supabaseAdmin.from(table).select(select).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (buildFilter) q = buildFilter(q);
    const { data, error } = await q;
    if (error) throw new Error(`Error querying ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return results;
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      sourceFederation,
      targetFederations = [],
      scope = {},
      previewOnly = false
    } = body;

    if (!sourceFederation || !Array.isArray(targetFederations) || targetFederations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'sourceFederation and at least one targetFederation are required.' },
        { status: 400 }
      );
    }

    // 1. Load federation registry
    const { data: federations, error: fedErr } = await supabaseAdmin
      .from('federation_registry')
      .select('id, short_code, canonical_name');

    if (fedErr || !federations) {
      return NextResponse.json({ success: false, error: 'Failed to load federation_registry' }, { status: 500 });
    }

    const fedByCode = new Map<string, { id: string; code: string; name: string }>();
    const fedByUuid = new Map<string, { id: string; code: string; name: string }>();
    federations.forEach((f: any) => {
      const entry = { id: f.id, code: (f.short_code || '').toUpperCase(), name: f.canonical_name };
      if (entry.code) fedByCode.set(entry.code, entry);
      fedByUuid.set(f.id, entry);
    });

    const resolveFed = (val: string) => fedByUuid.get(val) || fedByCode.get(String(val).trim().toUpperCase()) || null;

    const sFed = resolveFed(sourceFederation);
    if (!sFed) {
      return NextResponse.json({ success: false, error: `Unrecognized source federation: ${sourceFederation}` }, { status: 400 });
    }

    const tFeds = targetFederations
      .map((tf: string) => resolveFed(tf))
      .filter((tf): tf is { id: string; code: string; name: string } => Boolean(tf) && tf!.id !== sFed.id);

    if (tFeds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please select at least one target federation distinct from the source federation.' },
        { status: 400 }
      );
    }

    const year = scope.year ? parseInt(String(scope.year), 10) : null;
    const meetId = scope.meetId ? parseInt(String(scope.meetId), 10) : null;
    const unlinkedOnly = scope.unlinkedOnly !== undefined ? Boolean(scope.unlinkedOnly) : true;

    // 2. Discover distinct source athlete IDs matching scope
    const sourceAthleteIds = new Set<number>();

    if (sFed.code === 'IWF') {
      if (meetId) {
        // Resolve whether meetId is official iwf_meet_id or internal db_meet_id
        const { data: meetRows } = await supabaseAdmin
          .from('iwf_meets')
          .select('db_meet_id')
          .or(`db_meet_id.eq.${meetId},iwf_meet_id.eq.${meetId}`);
        const dbMeetIds = (meetRows || []).map((m: any) => Number(m.db_meet_id));
        if (dbMeetIds.length > 0) {
          const resRows = await fetchAllColumn(
            supabaseAdmin,
            'iwf_meet_results',
            'db_lifter_id',
            (q) => q.in('db_meet_id', dbMeetIds).not('db_lifter_id', 'is', null)
          );
          resRows.forEach((r: any) => sourceAthleteIds.add(Number(r.db_lifter_id)));
        }
      } else if (year) {
        const resRows = await fetchAllColumn(
          supabaseAdmin,
          'iwf_meet_results',
          'db_lifter_id',
          (q) =>
            q
              .gte('date', `${year}-01-01`)
              .lte('date', `${year}-12-31`)
              .not('db_lifter_id', 'is', null)
        );
        resRows.forEach((r: any) => sourceAthleteIds.add(Number(r.db_lifter_id)));
      } else {
        const lifterRows = await fetchAllColumn(supabaseAdmin, 'iwf_lifters', 'db_lifter_id');
        lifterRows.forEach((l: any) => sourceAthleteIds.add(Number(l.db_lifter_id)));
      }
    } else if (sFed.code === 'USAW') {
      if (meetId) {
        const resRows = await fetchAllColumn(
          supabaseAdmin,
          'usaw_meet_results',
          'lifter_id',
          (q) => q.eq('meet_id', meetId).not('lifter_id', 'is', null)
        );
        resRows.forEach((r: any) => sourceAthleteIds.add(Number(r.lifter_id)));
      } else if (year) {
        const resRows = await fetchAllColumn(
          supabaseAdmin,
          'usaw_meet_results',
          'lifter_id',
          (q) =>
            q
              .gte('date', `${year}-01-01`)
              .lte('date', `${year}-12-31`)
              .not('lifter_id', 'is', null)
        );
        resRows.forEach((r: any) => sourceAthleteIds.add(Number(r.lifter_id)));
      } else {
        const lifterRows = await fetchAllColumn(supabaseAdmin, 'usaw_lifters', 'lifter_id');
        lifterRows.forEach((l: any) => sourceAthleteIds.add(Number(l.lifter_id)));
      }
    } else if (sFed.code === 'OWLCMS') {
      if (meetId) {
        const resRows = await fetchAllColumn(
          supabaseAdmin,
          'owlcms_meet_results',
          'lifter_id',
          (q) => q.eq('meet_id', meetId).not('lifter_id', 'is', null)
        );
        resRows.forEach((r: any) => sourceAthleteIds.add(Number(r.lifter_id)));
      } else if (year) {
        const { data: meetRows } = await supabaseAdmin
          .from('owlcms_meets')
          .select('meet_id')
          .gte('start_date', `${year}-01-01`)
          .lte('start_date', `${year}-12-31`);
        const meetIds = (meetRows || []).map((m: any) => Number(m.meet_id));
        if (meetIds.length > 0) {
          const resRows = await fetchAllColumn(
            supabaseAdmin,
            'owlcms_meet_results',
            'lifter_id',
            (q) => q.in('meet_id', meetIds).not('lifter_id', 'is', null)
          );
          resRows.forEach((r: any) => sourceAthleteIds.add(Number(r.lifter_id)));
        }
      } else {
        const lifterRows = await fetchAllColumn(supabaseAdmin, 'owlcms_lifters', 'lifter_id');
        lifterRows.forEach((l: any) => sourceAthleteIds.add(Number(l.lifter_id)));
      }
    }

    const allSourceIds = Array.from(sourceAthleteIds).filter(Boolean);
    if (allSourceIds.length === 0) {
      return NextResponse.json({
        success: true,
        previewOnly,
        sourceAthletesFound: 0,
        tasksToEnqueueCount: 0,
        enqueuedCount: 0,
        breakdownByTarget: []
      });
    }

    // 3. Filter out already-linked and already-evaluated pairs per target federation
    const aliasColumnForFed = (code: string) => {
      if (code === 'IWF') return 'iwf_db_lifter_id';
      if (code === 'USAW') return 'usaw_lifter_id';
      if (code === 'OWLCMS') return 'owlcms_lifter_id';
      return null;
    };

    const sAliasCol = aliasColumnForFed(sFed.code);
    const breakdownByTarget: Array<{
      targetFederation: string;
      candidateAthletes: number;
      alreadyLinkedSkipped: number;
      alreadyEvaluatedSkipped: number;
      newTasksCount: number;
    }> = [];

    const allNewPayloads: Array<{
      source_federation_id: string;
      source_athlete_id: number;
      target_federation_id: string;
      status: string;
      algorithm_version: string;
    }> = [];

    for (const tFed of tFeds) {
      const tAliasCol = aliasColumnForFed(tFed.code);
      const linkedSourceIds = new Set<number>();

      if (unlinkedOnly && sAliasCol && tAliasCol) {
        const aliasRows = await fetchAllColumn(
          supabaseAdmin,
          'athlete_aliases',
          `${sAliasCol}, ${tAliasCol}`,
          (q) => q.not(sAliasCol, 'is', null).not(tAliasCol, 'is', null)
        );
        aliasRows.forEach((a: any) => {
          if (a[sAliasCol]) linkedSourceIds.add(Number(a[sAliasCol]));
        });
      }

      // Fetch existing evaluations for (source_federation_id, target_federation_id)
      const existingEvalRows = await fetchAllColumn(
        supabaseAdmin,
        'athlete_linking_evaluations',
        'source_athlete_id',
        (q) =>
          q
            .eq('source_federation_id', sFed.id)
            .eq('target_federation_id', tFed.id)
      );
      const existingEvalSourceIds = new Set<number>(
        existingEvalRows.map((e: any) => Number(e.source_athlete_id))
      );

      let alreadyLinkedSkipped = 0;
      let alreadyEvaluatedSkipped = 0;
      let newTasksCount = 0;

      for (const sId of allSourceIds) {
        if (unlinkedOnly && linkedSourceIds.has(sId)) {
          alreadyLinkedSkipped++;
          continue;
        }
        if (existingEvalSourceIds.has(sId)) {
          alreadyEvaluatedSkipped++;
          continue;
        }
        newTasksCount++;
        allNewPayloads.push({
          source_federation_id: sFed.id,
          source_athlete_id: sId,
          target_federation_id: tFed.id,
          status: 'PENDING',
          algorithm_version: ALGORITHM_VERSION
        });
      }

      breakdownByTarget.push({
        targetFederation: tFed.code,
        candidateAthletes: allSourceIds.length,
        alreadyLinkedSkipped,
        alreadyEvaluatedSkipped,
        newTasksCount
      });
    }

    if (previewOnly) {
      return NextResponse.json({
        success: true,
        previewOnly: true,
        sourceAthletesFound: allSourceIds.length,
        tasksToEnqueueCount: allNewPayloads.length,
        enqueuedCount: 0,
        breakdownByTarget
      });
    }

    // 4. Batch insert new evaluation tasks in chunks of 1000
    const CHUNK_SIZE = 1000;
    let totalEnqueued = 0;
    for (let i = 0; i < allNewPayloads.length; i += CHUNK_SIZE) {
      const chunk = allNewPayloads.slice(i, i + CHUNK_SIZE);
      const { error: upsertErr } = await supabaseAdmin
        .from('athlete_linking_evaluations')
        .upsert(chunk, {
          onConflict: 'source_federation_id,source_athlete_id,target_federation_id',
          ignoreDuplicates: true
        });
      if (upsertErr) {
        return NextResponse.json(
          { success: false, error: `Failed to enqueue batch: ${upsertErr.message}` },
          { status: 500 }
        );
      }
      totalEnqueued += chunk.length;
    }

    return NextResponse.json({
      success: true,
      previewOnly: false,
      sourceAthletesFound: allSourceIds.length,
      tasksToEnqueueCount: allNewPayloads.length,
      enqueuedCount: totalEnqueued,
      breakdownByTarget
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to seed historical backfill' },
      { status: 500 }
    );
  }
}

