import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lifterId = parseInt(id, 10);

    if (isNaN(lifterId)) {
      return NextResponse.json({ success: false, error: 'Invalid athlete ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch Lifter Biographical Info
    const { data: lifter, error: lifterError } = await supabase
      .from('owlcms_lifters')
      .select('*')
      .eq('lifter_id', lifterId)
      .single();

    if (lifterError || !lifter) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    // 2. Check for Linked USAW or IWF Identities in athlete_aliases
    const { data: alias } = await supabase
      .from('athlete_aliases')
      .select('usaw_lifter_id, iwf_db_lifter_id')
      .eq('owlcms_lifter_id', lifterId)
      .maybeSingle();

    let linkedIdentities: {
      usaw_lifter_id?: number | null;
      usaw_membership_number?: string | null;
      usaw_name?: string | null;
      iwf_db_lifter_id?: number | null;
      iwf_name?: string | null;
    } = {
      usaw_lifter_id: alias?.usaw_lifter_id || null,
      iwf_db_lifter_id: alias?.iwf_db_lifter_id || null
    };

    if (alias?.usaw_lifter_id) {
      const { data: usawLifter } = await supabase
        .from('usaw_lifters')
        .select('membership_number, athlete_name')
        .eq('lifter_id', alias.usaw_lifter_id)
        .maybeSingle();
      if (usawLifter) {
        linkedIdentities.usaw_membership_number = usawLifter.membership_number?.toString() || null;
        linkedIdentities.usaw_name = usawLifter.athlete_name;
      }
    }

    if (alias?.iwf_db_lifter_id) {
      const { data: iwfLifter } = await supabase
        .from('iwf_lifters')
        .select('athlete_name')
        .eq('db_lifter_id', alias.iwf_db_lifter_id)
        .maybeSingle();
      if (iwfLifter) {
        linkedIdentities.iwf_name = iwfLifter.athlete_name;
      }
    }

    // 3. Fetch Competition History
    const { data: results, error: resultsError } = await supabase
      .from('owlcms_meet_results')
      .select(`
        result_id,
        meet_id,
        body_weight_kg,
        category,
        session_name,
        lot_number,
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
          meet_id,
          meet_name,
          start_date,
          end_date,
          city,
          country,
          organizer,
          raw_payload
        )
      `)
      .eq('lifter_id', lifterId);

    if (resultsError) {
      return NextResponse.json({ success: false, error: resultsError.message }, { status: 500 });
    }

    // Sort results chronologically descending
    const formattedResults = (results || []).map((r: any) => {
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
        ...r,
        session_descriptor: sessionDescriptor,
        meet_name: meet?.meet_name || `Meet #${r.meet_id}`,
        start_date: meet?.start_date || null,
        end_date: meet?.end_date || null,
        city: meet?.city || null,
        country: meet?.country || null,
        organizer: meet?.organizer || null,
        federation: meet?.raw_payload?.competition?.federation || null
      };
    }).sort((a: any, b: any) => {
      const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
      const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
      return dateB - dateA;
    });

    // 4. Compute Personal Bests
    let bestSnatch = 0;
    let bestCj = 0;
    let bestTotal = 0;
    let bestQpoints = 0;
    let bestGamx = 0;

    formattedResults.forEach((r: any) => {
      if (r.best_snatch && r.best_snatch > bestSnatch) bestSnatch = r.best_snatch;
      if (r.best_cj && r.best_cj > bestCj) bestCj = r.best_cj;
      if (r.total && r.total > bestTotal) bestTotal = r.total;
      if (r.qpoints && r.qpoints > bestQpoints) bestQpoints = r.qpoints;
      if (r.gamx_total && r.gamx_total > bestGamx) bestGamx = r.gamx_total;
    });

    return NextResponse.json({
      success: true,
      lifter: {
        lifter_id: lifter.lifter_id,
        athlete_name: lifter.athlete_name,
        first_name: lifter.first_name,
        last_name: lifter.last_name,
        gender: lifter.gender,
        birth_year: lifter.birth_year,
        exact_birth_date: lifter.exact_birth_date,
        country_code: lifter.country_code,
        club_name: lifter.club_name,
        membership_number: lifter.membership_number
      },
      linked_identities: linkedIdentities,
      personal_bests: {
        best_snatch: bestSnatch || null,
        best_cj: bestCj || null,
        best_total: bestTotal || null,
        best_qpoints: bestQpoints || null,
        best_gamx_total: bestGamx || null
      },
      results: formattedResults
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
