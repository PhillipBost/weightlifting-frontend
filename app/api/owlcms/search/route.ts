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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQ = searchParams.get('q')?.trim() || '';
  const q = rawQ.replace(/\(?\bowlcms\b\)?/gi, '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ success: true, athletes: [], meets: [] });
  }

  try {
    const supabase = getSupabaseAdmin();

    const tokens = q.split(/[\s,]+/).filter(t => t.length > 0);
    const orFilters: string[] = [];

    // Direct multi-word substring match
    orFilters.push(`athlete_name.ilike.%${q}%`);

    if (tokens.length === 1) {
      orFilters.push(`first_name.ilike.%${tokens[0]}%`);
      orFilters.push(`last_name.ilike.%${tokens[0]}%`);
    } else {
      // Inverted multi-word substring match (handles "Last, First" or "Last First")
      const reversedQ = tokens.slice().reverse().join(' ');
      orFilters.push(`athlete_name.ilike.%${reversedQ}%`);

      // First & Last cross-token wildcard
      const firstTok = tokens[0];
      const lastTok = tokens[tokens.length - 1];
      orFilters.push(`athlete_name.ilike.%${firstTok}%${lastTok}%`);
      orFilters.push(`athlete_name.ilike.%${lastTok}%${firstTok}%`);

      // AND combinations for split first_name / last_name columns
      orFilters.push(`and(first_name.ilike.%${firstTok}%,last_name.ilike.%${lastTok}%)`);
      orFilters.push(`and(last_name.ilike.%${firstTok}%,first_name.ilike.%${lastTok}%)`);
    }

    const [athletesRes, meetsRes] = await Promise.all([
      supabase
        .from('owlcms_lifters')
        .select('lifter_id, athlete_name, first_name, last_name, gender, country_code, club_name, birth_year')
        .or(orFilters.join(','))
        .limit(20),
      supabase
        .from('owlcms_meets')
        .select('meet_id, meet_name, start_date, city, country')
        .ilike('meet_name', `%${q}%`)
        .limit(6)
    ]);

    const rawAthletes = athletesRes.data || [];
    let athletes: any[] = [];

    if (rawAthletes.length > 0) {
      const lifterIds = rawAthletes.map((a: any) => a.lifter_id);
      
      // Step 1: Look up direct aliases for all matched lifters
      const { data: directAliases } = await supabase
        .from('athlete_aliases')
        .select('owlcms_lifter_id, usaw_lifter_id, iwf_db_lifter_id')
        .in('owlcms_lifter_id', lifterIds);

      // Step 2: Retrieve all sibling OWLCMS aliases sharing those federation IDs
      const usawIds = Array.from(new Set((directAliases || []).map((a: any) => a.usaw_lifter_id).filter(Boolean)));
      const iwfIds = Array.from(new Set((directAliases || []).map((a: any) => a.iwf_db_lifter_id).filter(Boolean)));

      let allAliases = directAliases || [];
      if (usawIds.length > 0 || iwfIds.length > 0) {
        const orConditions: string[] = [];
        if (usawIds.length > 0) orConditions.push(`usaw_lifter_id.in.(${usawIds.join(',')})`);
        if (iwfIds.length > 0) orConditions.push(`iwf_db_lifter_id.in.(${iwfIds.join(',')})`);

        const { data: siblingAliases } = await supabase
          .from('athlete_aliases')
          .select('owlcms_lifter_id, usaw_lifter_id, iwf_db_lifter_id')
          .or(orConditions.join(','));

        if (siblingAliases && siblingAliases.length > 0) {
          allAliases = siblingAliases;
        }
      }

      // Collect any sibling lifter IDs that weren't in the initial search results
      const allSiblingIds = Array.from(new Set(allAliases.map((a: any) => a.owlcms_lifter_id).filter(Boolean)));
      const missingSiblingIds = allSiblingIds.filter((id: number) => !lifterIds.includes(id));

      let allLifterPool = [...rawAthletes];
      if (missingSiblingIds.length > 0) {
        const { data: siblingLifters } = await supabase
          .from('owlcms_lifters')
          .select('lifter_id, athlete_name, first_name, last_name, gender, country_code, club_name, birth_year')
          .in('lifter_id', missingSiblingIds);

        if (siblingLifters && siblingLifters.length > 0) {
          allLifterPool.push(...siblingLifters);
        }
      }

      const aliasMap = new Map<number, string>();
      allAliases.forEach((a: any) => {
        if (a.owlcms_lifter_id) {
          if (a.usaw_lifter_id) {
            aliasMap.set(a.owlcms_lifter_id, `usaw-${a.usaw_lifter_id}`);
          } else if (a.iwf_db_lifter_id) {
            aliasMap.set(a.owlcms_lifter_id, `iwf-${a.iwf_db_lifter_id}`);
          }
        }
      });

      const grouped = new Map<string, any[]>();
      const unaliased: any[] = [];

      for (const a of allLifterPool) {
        const unifiedKey = aliasMap.get(a.lifter_id);
        if (unifiedKey) {
          if (!grouped.has(unifiedKey)) grouped.set(unifiedKey, []);
          grouped.get(unifiedKey)!.push(a);
        } else if (lifterIds.includes(a.lifter_id)) {
          unaliased.push(a);
        }
      }

      const deduped: any[] = [];
      grouped.forEach((siblings) => {
        const hasMatchedMember = siblings.some((s: any) => lifterIds.includes(s.lifter_id));
        if (hasMatchedMember) {
          siblings.sort((a, b) => a.lifter_id - b.lifter_id);
          const primary = { ...siblings[0] };
          primary.country_codes = Array.from(new Set(siblings.map((s: any) => s.country_code).filter(Boolean)));
          primary.all_clubs = Array.from(new Set(siblings.map((s: any) => s.club_name).filter(Boolean)));
          deduped.push(primary);
        }
      });

      athletes = [...deduped, ...unaliased].slice(0, 10);
    }

    return NextResponse.json(
      {
        success: true,
        athletes,
        meets: meetsRes.data || []
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (err: any) {
    console.error('[OWLCMS SEARCH ROUTE ERROR]:', err);
    return NextResponse.json({ success: false, error: err.message, athletes: [], meets: [] }, { status: 500 });
  }
}
