import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(req: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const runId = req.nextUrl.searchParams.get('id');

    // Single run detail query: includes large TOAST log columns only on demand
    if (runId) {
      const { data: run, error } = await supabaseAdmin
        .from('iwf_pipeline_runs')
        .select('id, created_at, updated_at, completed_at, duration_seconds, status, mode, event_id, url, year, athlete_name, dry_run, force, exit_code, error_message, import_stats, db_meet_id, logs, linker_logs')
        .eq('id', Number(runId))
        .single();

      if (error || !run) {
        return NextResponse.json({ success: false, error: 'Pipeline run record not found.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, run });
    }

    // List query: excludes TOAST log text for millisecond payload performance
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 30, 100);
    const { data: runs, error } = await supabaseAdmin
      .from('iwf_pipeline_runs')
      .select('id, created_at, updated_at, completed_at, duration_seconds, status, mode, event_id, url, year, athlete_name, dry_run, force, exit_code, error_message, import_stats, db_meet_id, linker_logs')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const enrichedRuns = (runs || []).map((run) => {
      if (run.linker_logs) {
        const isExplicitlyUnchanged =
          /No new links found across federations/i.test(run.linker_logs) ||
          /athlete_aliases unchanged/i.test(run.linker_logs);

        let usaw = 0;
        let owlcms = 0;

        if (!isExplicitlyUnchanged) {
          const usawUpsertMatch = run.linker_logs.match(/Successfully upserted\s+(\d+)\s+USAW\s*↔\s*IWF/i);
          const usawParentheticalMatch = run.linker_logs.match(/Verified\s+\d+\s+USAW\s*↔\s*IWF\s+roster matches\s*\([^)]*?,\s*(\d+)\s+new\)/i);
          const usawNewMatch = run.linker_logs.match(/Verified\s+(\d+)\s+new\s+USAW\s*↔\s*IWF(?:\s+athlete)?\s+aliases/i);
          const usawDryRunMatch = run.linker_logs.match(/\[DRY RUN\]\s+Would insert\s+(\d+)\s+USAW\s*↔\s*IWF/i);
          if (usawUpsertMatch) usaw = Number(usawUpsertMatch[1]);
          else if (usawParentheticalMatch) usaw = Number(usawParentheticalMatch[1]);
          else if (usawNewMatch) usaw = Number(usawNewMatch[1]);
          else if (usawDryRunMatch) usaw = Number(usawDryRunMatch[1]);

          const owlcmsInsertMatch = run.linker_logs.match(/Inserting\s+(\d+)\s+IWF\s*↔\s*OWLCMS/i);
          const owlcmsNewMatch = run.linker_logs.match(/(?:Verified|Phase 3 found)\s+(\d+)\s+new\s+IWF\s*↔\s*OWLCMS/i);
          const owlcmsDryRunMatch = run.linker_logs.match(/\[DRY RUN\]\s+Would insert\s+(\d+)\s+IWF\s*↔\s*OWLCMS/i);
          if (owlcmsInsertMatch) owlcms = Number(owlcmsInsertMatch[1]);
          else if (owlcmsNewMatch) owlcms = Number(owlcmsNewMatch[1]);
          else if (owlcmsDryRunMatch) owlcms = Number(owlcmsDryRunMatch[1]);
        }

        const shardMatch = run.linker_logs.match(/Triggering static shard generation for\s+(\d+)\s+linked athlete/i);
        const shards = shardMatch ? Number(shardMatch[1]) : 0;

        run.import_stats = {
          ...(run.import_stats || {}),
          linkerStats: {
            usawAliasesLinked: usaw,
            owlcmsAliasesLinked: owlcms,
            totalAliasesLinked: usaw + owlcms,
            shardsRefreshed: shards,
          },
        };
      }
      const { linker_logs, ...rest } = run;
      return rest;
    });

    return NextResponse.json({ success: true, runs: enrichedRuns });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to fetch pipeline runs' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter((n: number) => !isNaN(n) && n > 0) : [];

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid run IDs provided for deletion.' }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('iwf_pipeline_runs')
      .delete()
      .in('id', ids);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: ids.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to delete pipeline runs' }, { status: 500 });
  }
}

