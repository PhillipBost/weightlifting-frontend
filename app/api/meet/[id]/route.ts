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
  const meetId = parseInt(id);

  if (isNaN(meetId)) {
    return NextResponse.json({ error: 'Invalid meet ID' }, { status: 400 });
  }

  try {
    // 1. Fetch Meet Metadata
    const { data: meet, error: meetError } = await supabaseAdmin
      .from('usaw_meets')
      .select('Meet, Date, Level, city, state, address, elevation_meters, latitude, longitude, URL')
      .eq('meet_id', meetId)
      .single();

    if (meetError || !meet) {
      return NextResponse.json({ error: 'Meet not found' }, { status: 404 });
    }

    // 2. Fetch Meet Results with Lifter Data (Membership Numbers)
    const { data: results, error: resultsError } = await supabaseAdmin
      .from('usaw_meet_results')
      .select(`
        result_id,
        lifter_name,
        lifter_id,
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
        wso,
        club_name,
        qpoints,
        q_youth,
        q_masters,
        gamx_total,
        gamx_s,
        gamx_j,
        gamx_u,
        gamx_a,
        gamx_masters,
        lifters:usaw_lifters!inner(membership_number)
      `)
      .eq('meet_id', meetId);

    if (resultsError) {
      return NextResponse.json({ error: `Results error: ${resultsError.message}` }, { status: 500 });
    }

    // 3. Return Unified Response
    return NextResponse.json({
      meet,
      results: results || []
    });

  } catch (err) {
    console.error(`[MEET API ERROR for ${meetId}]:`, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
