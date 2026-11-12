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

export async function GET() {
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

    const [
      federationsRes,
      pendingRes,
      reviewNeededRes,
      matchedRes,
      isolatedRes
    ] = await Promise.all([
      supabaseAdmin
        .from('federation_registry')
        .select('id, short_code, canonical_name')
        .in('short_code', ['USAW', 'IWF', 'OWLCMS']),
      supabaseAdmin
        .from('athlete_linking_evaluations')
        .select('evaluation_id', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('athlete_linking_evaluations')
        .select('evaluation_id', { count: 'exact', head: true })
        .eq('status', 'REVIEW_NEEDED'),
      supabaseAdmin
        .from('athlete_linking_evaluations')
        .select('evaluation_id', { count: 'exact', head: true })
        .eq('status', 'MATCHED'),
      supabaseAdmin
        .from('athlete_linking_evaluations')
        .select('evaluation_id', { count: 'exact', head: true })
        .eq('status', 'VETTED_ISOLATED')
    ]);

    const federations = federationsRes.data || [];

    const byTargetFederation = await Promise.all(
      federations.map(async (fed: any) => {
        const [fedPending, fedReview, fedMatched] = await Promise.all([
          supabaseAdmin
            .from('athlete_linking_evaluations')
            .select('evaluation_id', { count: 'exact', head: true })
            .eq('target_federation_id', fed.id)
            .eq('status', 'PENDING'),
          supabaseAdmin
            .from('athlete_linking_evaluations')
            .select('evaluation_id', { count: 'exact', head: true })
            .eq('target_federation_id', fed.id)
            .eq('status', 'REVIEW_NEEDED'),
          supabaseAdmin
            .from('athlete_linking_evaluations')
            .select('evaluation_id', { count: 'exact', head: true })
            .eq('target_federation_id', fed.id)
            .eq('status', 'MATCHED')
        ]);

        return {
          federationId: fed.id,
          shortCode: fed.short_code,
          canonicalName: fed.canonical_name,
          pendingCount: fedPending.count ?? 0,
          reviewNeededCount: fedReview.count ?? 0,
          matchedCount: fedMatched.count ?? 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      totalPending: pendingRes.count ?? 0,
      totalReviewNeeded: reviewNeededRes.count ?? 0,
      totalMatched: matchedRes.count ?? 0,
      totalIsolated: isolatedRes.count ?? 0,
      byTargetFederation
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to fetch queue status' },
      { status: 500 }
    );
  }
}

