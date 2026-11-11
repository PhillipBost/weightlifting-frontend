import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const isSummary = searchParams.get('summary') === 'true';

  try {
    // 1. Fetch IWF Meet Metadata (Prioritizes canonical primary-source iwf_meet_id, falling back to legacy db_meet_id)
    let { data: meetData, error: meetError } = await supabaseAdmin
      .from('iwf_meets')
      .select('iwf_meet_id, db_meet_id, meet, date, level, url, results')
      .eq('iwf_meet_id', id)
      .limit(1)
      .maybeSingle();

    // Secondary fallback only if not found by official iwf_meet_id
    if (!meetData && /^\d+$/.test(id)) {
      const fallbackRes = await supabaseAdmin
        .from('iwf_meets')
        .select('iwf_meet_id, db_meet_id, meet, date, level, url, results')
        .eq('db_meet_id', id)
        .limit(1)
        .maybeSingle();
      meetData = fallbackRes.data;
      meetError = fallbackRes.error;
    }

    if (meetError || !meetData) {
      return NextResponse.json({ error: 'International Meet not found' }, { status: 404 });
    }

    if (isSummary) {
      const { count } = await supabaseAdmin
        .from('iwf_meet_results')
        .select('db_result_id', { count: 'exact', head: true })
        .eq('db_meet_id', meetData.db_meet_id);

      return NextResponse.json({
        meet: meetData,
        resultsCount: count ?? meetData.results ?? 0
      });
    }

    // 2. Fetch Location Data
    const { data: locationData } = await supabaseAdmin
      .from('iwf_meet_locations')
      .select('*')
      .eq('iwf_meet_id', meetData.iwf_meet_id);

    // 3. Fetch Results with Lifter Data
    const { data: results, error: resultsError } = await supabaseAdmin
      .from('iwf_meet_results')
      .select(`
        db_result_id,
        db_lifter_id,
        db_meet_id,
        lifter_name,
        weight_class,
        best_snatch,
        best_cj,
        total,
        snatch_lift_1,
        snatch_lift_2,
        snatch_lift_3,
        cj_lift_1,
        cj_lift_2,
        cj_lift_3,
        body_weight_kg,
        gender,
        age_category,
        competition_age,
        birth_year,
        country_code,
        country_name,
        competition_group,
        rank,
        qpoints,
        q_youth,
        q_masters,
        gamx_total,
        gamx_s,
        gamx_j,
        gamx_u,
        gamx_a,
        gamx_masters,
        best_snatch_ytd,
        best_cj_ytd,
        best_total_ytd,
        snatch_successful_attempts,
        cj_successful_attempts,
        total_successful_attempts,
        bounce_back_snatch_2,
        bounce_back_snatch_3,
        bounce_back_cj_2,
        bounce_back_cj_3,
        manual_override,
        created_at,
        updated_at,
        iwf_lifters!inner(iwf_lifter_id)
      `)
      .eq('db_meet_id', meetData.db_meet_id);

    if (resultsError) {
      return NextResponse.json({ error: `International results error: ${resultsError.message}` }, { status: 500 });
    }

    // 4. Return Unified Response
    return NextResponse.json({
      meet: meetData,
      locations: locationData || [],
      results: results || []
    });

  } catch (err) {
    console.error(`[IWF MEET API ERROR for ${id}]:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
