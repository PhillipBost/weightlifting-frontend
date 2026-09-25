import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FederationGovernanceHierarchy, FederationGovernanceNode } from '@/types/federation';

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
      return NextResponse.json({ success: false, error: 'Federation ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch the target federation entity node
    const { data: targetFed, error: targetError } = await supabase
      .from('federation_registry')
      .select('id, canonical_name, short_code, level, country_code')
      .eq('id', id)
      .single();

    if (targetError || !targetFed) {
      return NextResponse.json({ success: false, error: 'Federation not found' }, { status: 404 });
    }

    // 2. Fetch parent affiliations (where this federation is the child)
    const { data: parentEdges, error: parentError } = await supabase
      .from('federation_affiliations')
      .select(`
        id,
        relationship_type,
        parent:federation_registry!federation_affiliations_parent_id_fkey (
          id,
          canonical_name,
          short_code,
          level
        )
      `)
      .eq('child_id', id)
      .eq('is_active', true);

    if (parentError) {
      console.warn('[FEDERATION_GOVERNANCE] Parent edge query error:', parentError);
    }

    // 3. Fetch child affiliations (subdivisions where this federation is the parent)
    const { data: childEdges, error: childError } = await supabase
      .from('federation_affiliations')
      .select(`
        id,
        relationship_type,
        child:federation_registry!federation_affiliations_child_id_fkey (
          id,
          canonical_name,
          short_code,
          level
        )
      `)
      .eq('parent_id', id)
      .eq('is_active', true);

    if (childError) {
      console.warn('[FEDERATION_GOVERNANCE] Child edge query error:', childError);
    }

    // 4. Construct Dual Governance Hierarchy
    let apexNode: FederationGovernanceNode | null = null;
    let continentalNode: FederationGovernanceNode | null = null;
    let regionalParentNode: FederationGovernanceNode | null = null;
    const subdivisions: FederationGovernanceNode[] = [];

    (parentEdges || []).forEach((edge: any) => {
      if (!edge.parent) return;
      const node: FederationGovernanceNode = {
        id: edge.parent.id,
        canonical_name: edge.parent.canonical_name,
        short_code: edge.parent.short_code,
        level: edge.parent.level,
        relationship_type: edge.relationship_type
      };

      if (edge.relationship_type === 'international_member' || edge.parent.level === 'international') {
        apexNode = node;
      } else if (edge.relationship_type === 'continental_member' || edge.relationship_type === 'continental_confederation' || edge.parent.level === 'continental') {
        continentalNode = node;
      } else if (edge.relationship_type === 'regional_subdivision') {
        regionalParentNode = node;
      }
    });

    (childEdges || []).forEach((edge: any) => {
      if (!edge.child) return;
      subdivisions.push({
        id: edge.child.id,
        canonical_name: edge.child.canonical_name,
        short_code: edge.child.short_code,
        level: edge.child.level,
        relationship_type: edge.relationship_type
      });
    });

    const hierarchy: FederationGovernanceHierarchy = {
      federation_id: targetFed.id,
      canonical_name: targetFed.canonical_name,
      level: targetFed.level,
      apex_international: apexNode,
      continental_confederation: continentalNode,
      regional_parent: regionalParentNode,
      subdivisions
    };

    return NextResponse.json({
      success: true,
      federation: targetFed,
      hierarchy
    });
  } catch (err: any) {
    console.error('[FEDERATION_GOVERNANCE ROUTE ERROR]:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to fetch federation governance'
    }, { status: 500 });
  }
}
