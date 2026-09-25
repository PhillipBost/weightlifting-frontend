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
    if (!id) {
      return NextResponse.json({ success: false, error: 'Entity ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('as_of_date')?.trim() || null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_federation_lineage', {
      p_entity_id: id,
      p_as_of_date: asOfDate
    });

    if (error) {
      if (error.code === 'P0002') {
        return NextResponse.json({ success: false, error: 'Federation not found' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const hops = data || [];
    const roots = hops
      .filter((h: any) => h.is_root)
      .map((h: any) => h.parent_short_code || h.parent_canonical_name);

    return NextResponse.json({
      success: true,
      entity_id: id,
      as_of_date: asOfDate,
      roots: Array.from(new Set(roots)),
      hops
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch federation lineage' }, { status: 500 });
  }
}
