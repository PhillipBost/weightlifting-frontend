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

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { lifter_id, action, candidate_type, candidate_id } = body;

    if (!lifter_id || !action) {
      return NextResponse.json({ success: false, error: 'Missing lifter_id or action' }, { status: 400 });
    }

    if (action === 'link') {
      if (!candidate_id || !candidate_type) {
        return NextResponse.json({ success: false, error: 'Missing candidate_id or candidate_type for link' }, { status: 400 });
      }

      const isUSAW = candidate_type.toUpperCase() === 'USAW';
      const isIWF = candidate_type.toUpperCase() === 'IWF';

      if (!isUSAW && !isIWF) {
        return NextResponse.json({ success: false, error: 'Invalid candidate_type (must be USAW or IWF)' }, { status: 400 });
      }

      // 1. Insert pairwise alias link (strictly 2 foreign keys)
      const aliasRecord = {
        owlcms_lifter_id: Number(lifter_id),
        usaw_lifter_id: isUSAW ? Number(candidate_id) : null,
        iwf_db_lifter_id: isIWF ? Number(candidate_id) : null,
        match_confidence: 100,
        manual_override: true,
        updated_at: new Date().toISOString()
      };

      const { error: aliasError } = await supabaseAdmin
        .from('athlete_aliases')
        .insert(aliasRecord);

      if (aliasError) {
        return NextResponse.json({ success: false, error: `Failed to insert alias: ${aliasError.message}` }, { status: 500 });
      }

      // 2. Update owlcms_lifters to LINKED and clear review_candidate
      const { error: lifterError } = await supabaseAdmin
        .from('owlcms_lifters')
        .update({
          link_status: 'LINKED',
          review_candidate: null
        })
        .eq('lifter_id', lifter_id);

      if (lifterError) {
        return NextResponse.json({ success: false, error: `Failed to update lifter: ${lifterError.message}` }, { status: 500 });
      }

      // 3. Trigger instant shard regeneration on backend (non-blocking)
      const shardRefreshUrl = process.env.HETZNER_SHARD_REFRESH_URL;
      if (shardRefreshUrl) {
        fetch(shardRefreshUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usaw_id: isUSAW ? Number(candidate_id) : null,
            iwf_id: isIWF ? Number(candidate_id) : null,
            secret: process.env.INTERNAL_WEBHOOK_SECRET || ''
          }),
          signal: AbortSignal.timeout(5000)
        }).catch((err) => {
          console.warn(`[Shard Refresh] Background shard regeneration notice failed: ${err?.message || err}`);
        });
      }

      return NextResponse.json({
        success: true,
        action: 'link',
        lifter_id,
        candidate_type,
        candidate_id,
        message: `Successfully linked OWLCMS lifter #${lifter_id} to ${candidate_type} #${candidate_id}.`
      });
    }

    if (action === 'reject') {
      // 1. Fetch current rejected list
      const { data: lifter, error: fetchError } = await supabaseAdmin
        .from('owlcms_lifters')
        .select('rejected_candidate_ids')
        .eq('lifter_id', lifter_id)
        .single();

      if (fetchError) {
        return NextResponse.json({ success: false, error: `Lifter not found: ${fetchError.message}` }, { status: 404 });
      }

      const existingRejected = Array.isArray(lifter?.rejected_candidate_ids)
        ? lifter.rejected_candidate_ids
        : [];

      const updatedRejected = candidate_id && !existingRejected.includes(candidate_id)
        ? [...existingRejected, candidate_id]
        : existingRejected;

      // 2. Update owlcms_lifters to ISOLATED and save updated blacklist array
      const { error: updateError } = await supabaseAdmin
        .from('owlcms_lifters')
        .update({
          link_status: 'ISOLATED',
          review_candidate: null,
          rejected_candidate_ids: updatedRejected
        })
        .eq('lifter_id', lifter_id);

      if (updateError) {
        return NextResponse.json({ success: false, error: `Failed to isolate lifter: ${updateError.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'reject',
        lifter_id,
        candidate_id,
        message: `Match rejected. Candidate #${candidate_id || '?'} blacklisted for lifter #${lifter_id}.`
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Expected "link" or "reject".' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
