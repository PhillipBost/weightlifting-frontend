import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level')?.trim() || null;
  const parentId = searchParams.get('parent_id')?.trim() || null;
  const q = searchParams.get('q')?.trim() || null;
  const asOfDate = searchParams.get('as_of_date')?.trim() || null;
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  try {
    const supabase = getSupabaseAdmin();
    let effectiveParentId = parentId;
    let memberChildIds: Set<string> | null = null;

    const requestedLevels = level ? level.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const isMultiLevel = requestedLevels.length > 1;
    const rpcLevel = isMultiLevel ? null : (requestedLevels[0] || null);

    // When querying national federations constrained by a continental parent,
    // lookup child members via federation_affiliations since national federations
    // have parent_federation_id = NULL in federation_registry.
    if (rpcLevel === 'national' && parentId) {
      const { data: affs } = await supabase
        .from('federation_affiliations')
        .select('child_id')
        .eq('parent_id', parentId)
        .eq('is_active', true);
      if (affs && affs.length > 0) {
        memberChildIds = new Set(affs.map((a: any) => a.child_id));
        effectiveParentId = null; // Query unconstrained from RPC, filter below
      }
    }

    const { data, error } = await supabase.rpc('list_federation_options', {
      p_level: rpcLevel,
      p_parent_id: effectiveParentId,
      p_query: q,
      p_as_of_date: asOfDate,
      p_limit: (memberChildIds || isMultiLevel) ? 500 : limit,
      p_offset: (memberChildIds || isMultiLevel) ? 0 : offset
    });

    if (error) {
      if (error.code === '22023') {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let items = (data || []) as any[];
    if (isMultiLevel) {
      const levelSet = new Set(requestedLevels);
      items = items.filter((item) => levelSet.has(item.level));
    }
    if (memberChildIds) {
      items = items.filter((item) => memberChildIds!.has(item.id));
    }

    const totalCount = memberChildIds 
      ? items.length 
      : (items.length > 0 && items[0].total_count !== undefined ? Number(items[0].total_count) : 0);
    const hasMore = memberChildIds ? false : offset + limit < totalCount;

    return NextResponse.json({
      success: true,
      total_count: totalCount,
      limit,
      offset,
      has_more: hasMore,
      items
    }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to list federation options' }, { status: 500, headers: corsHeaders });
  }
}
