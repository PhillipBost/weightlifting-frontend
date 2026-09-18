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
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: customHeaders
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Admin Authentication Check
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

    const { rawPayloadHash, meetName, startDate } = await req.json();

    // Check 1: Exact bitwise hash duplicate
    if (rawPayloadHash) {
      const { data: exactMatch } = await supabaseAdmin
        .from('owlcms_meets')
        .select('meet_id, meet_name, start_date, created_at, status, uploaded_by, uploader_email')
        .eq('raw_payload_hash', rawPayloadHash)
        .order('meet_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (exactMatch) {
        return NextResponse.json({
          success: true,
          collisionType: 'exact_duplicate',
          existingMeet: exactMatch
        });
      }
    }

    // Check 2: Semantic duplicate (same meet name and start date)
    if (meetName && startDate) {
      const cleanName = meetName.trim();
      const { data: semanticMatch } = await supabaseAdmin
        .from('owlcms_meets')
        .select('meet_id, meet_name, start_date, created_at, status, uploaded_by, uploader_email')
        .ilike('meet_name', cleanName)
        .eq('start_date', startDate)
        .order('meet_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (semanticMatch) {
        return NextResponse.json({
          success: true,
          collisionType: 'semantic_duplicate',
          existingMeet: semanticMatch
        });
      }
    }

    // Clean new meet
    return NextResponse.json({
      success: true,
      collisionType: 'none'
    });
  } catch (error: any) {
    console.error('Error in POST /api/owlcms/check:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
