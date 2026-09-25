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
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const status = searchParams.get('status') || 'PENDING';
    const search = (searchParams.get('search') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // Fetch counts across all 4 categories
    const [homonymCountRes, nameChangeCountRes, crossFedCountRes, iwfDupCountRes] = await Promise.all([
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'homonym_split')
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'name_change_merge')
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'cross_federation')
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'iwf_duplicate')
        .eq('status', 'PENDING')
    ]);

    const counts = {
      homonym_split: homonymCountRes.count ?? 0,
      name_change_merge: nameChangeCountRes.count ?? 0,
      cross_federation: crossFedCountRes.count ?? 0,
      iwf_duplicate: iwfDupCountRes.count ?? 0,
      total: (homonymCountRes.count ?? 0) + (nameChangeCountRes.count ?? 0) + (crossFedCountRes.count ?? 0) + (iwfDupCountRes.count ?? 0)
    };

    // Query builder for items
    let query = supabaseAdmin
      .from('admin_review_queue')
      .select('*', { count: 'exact' });

    if (category !== 'all') {
      query = query.eq('category', category);
    }
    if (status !== 'ALL') {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    query = query
      .order('confidence_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: items, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      counts,
      items: items ?? [],
      total: count ?? 0,
      page,
      limit
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
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
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { reviewId, resolution, notes } = body;

    if (!reviewId || !['APPROVED', 'REJECTED', 'RESOLVED'].includes(resolution)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters: reviewId and resolution required' }, { status: 400 });
    }

    // 1. Fetch current item for cross-federation alias linking and evidence retention
    const { data: currentItem, error: fetchError } = await supabaseAdmin
      .from('admin_review_queue')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (fetchError || !currentItem) {
      return NextResponse.json({ success: false, error: 'Review item not found' }, { status: 404 });
    }

    // 2. If cross_federation and APPROVED, insert pairwise alias into athlete_aliases
    if (currentItem.category === 'cross_federation' && resolution === 'APPROVED') {
      const ev = currentItem.evidence || {};
      const usawId = ev.usaw_athlete?.lifter_id || (currentItem.primary_entity_type === 'usaw_lifters' ? currentItem.primary_entity_id : null);
      const iwfId = ev.iwf_athlete?.db_lifter_id || (currentItem.candidate_entity_type === 'iwf_lifters' ? currentItem.candidate_entity_id : null);

      if (usawId && iwfId) {
        await supabaseAdmin
          .from('athlete_aliases')
          .insert({
            usaw_lifter_id: Number(usawId),
            iwf_db_lifter_id: Number(iwfId),
            match_confidence: currentItem.confidence_score || 100,
            manual_override: true,
            updated_at: new Date().toISOString()
          });
      }
    }

    // 3. Update status and append reviewer notes to evidence
    const updatedEvidence = {
      ...(currentItem.evidence || {}),
      ...(notes ? { admin_notes: notes } : {})
    };

    const { error: updateError } = await supabaseAdmin
      .from('admin_review_queue')
      .update({
        status: resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: user.email || user.id,
        evidence: updatedEvidence
      })
      .eq('id', reviewId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Review item marked as ${resolution.toLowerCase()}.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
