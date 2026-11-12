import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { getOfficialIwfMeetUrl } from '@/lib/utils/iwf-urls';

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

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

function isDuplicateOrTypo(primaryName?: string | null, candidateName?: string | null): boolean {
  if (!primaryName || !candidateName) return false;
  const p = primaryName.trim().toLowerCase(), c = candidateName.trim().toLowerCase();
  if (p === c || p.includes('@') || c.includes('@') || /\d/.test(p) || /\d/.test(c)) return true;
  const pParts = p.split(/\s+/), cParts = c.split(/\s+/);
  if (pParts.length > 1 && cParts.length > 1 && pParts[0] === cParts[0]) {
    const pLast = pParts.slice(1).join(' '), cLast = cParts.slice(1).join(' ');
    if (Math.abs(pLast.length - cLast.length) <= 2 && (pLast.includes(cLast) || cLast.includes(pLast))) return true;
    if (levenshteinDistance(pLast, cLast) <= 1) return true;
  }
  return false;
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
    const mode = searchParams.get('mode');

    // Fast-path: Audit list of clean partitions for the interactive reconciliation modal
    if (mode === 'clean_audit') {
      const { data: cleanRows, error: cleanErr } = await supabaseAdmin
        .from('admin_review_queue')
        .select('id, title, confidence_score, evidence, created_at')
        .eq('category', 'homonym_split')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (cleanErr) {
        return NextResponse.json({ success: false, error: cleanErr.message }, { status: 500 });
      }

      const cleanItems = (cleanRows || []).filter((r: any) => {
        const un = r.evidence?.split_plan?.unidentifiedCompetitions || [];
        return un.length === 0;
      }).map((r: any) => {
        const sp = r.evidence?.split_plan || {};
        const splits = sp.splits || sp.athletes || [];
        const baseName = r.title ? r.title.replace(/\s*\([^)]*\)$/, '').trim() : (sp.athlete_name || '');
        return {
          id: r.id,
          title: r.title,
          athlete_name: baseName,
          candidate_count: splits.length,
          total_competitions: r.evidence?.total_competitions || splits.reduce((acc: number, s: any) => acc + (s.meets?.length || 0), 0),
          membership_numbers: splits.map((s: any) => s.membershipNumber || s.membership_number).filter(Boolean),
          created_at: r.created_at
        };
      });

      return NextResponse.json({ success: true, count: cleanItems.length, items: cleanItems });
    }
    const category = searchParams.get('category') || 'all';
    const status = searchParams.get('status') || 'PENDING';
    const search = (searchParams.get('search') || '').trim();
    const subsegment = searchParams.get('subsegment') || 'all';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;
    const needHomonymSubCounts = category === 'all' || category === 'homonym_split';

    // Fetch counts across all 6 categories and homonym subsegments
    const [
      homonymCountRes,
      homonymCleanCountRes,
      homonymContestedCountRes,
      nameChangeCountRes,
      duplicateProfileCountRes,
      dataHygieneCountRes,
      crossFedCountRes,
      iwfDupCountRes,
      evalReviewNeededCountRes
    ] = await Promise.all([
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'homonym_split')
        .eq('status', 'PENDING'),
      needHomonymSubCounts
        ? supabaseAdmin
          .from('admin_review_queue')
          .select('id', { count: 'exact', head: true })
          .eq('category', 'homonym_split')
          .eq('status', 'PENDING')
          .filter('evidence->split_plan->unidentifiedCompetitions', 'eq', '[]')
        : Promise.resolve({ count: 0 }),
      needHomonymSubCounts
        ? supabaseAdmin
          .from('admin_review_queue')
          .select('id', { count: 'exact', head: true })
          .eq('category', 'homonym_split')
          .eq('status', 'PENDING')
          .filter('evidence->split_plan->unidentifiedCompetitions', 'neq', '[]')
        : Promise.resolve({ count: 0 }),
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'name_change_merge')
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'duplicate_profile')
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('admin_review_queue')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'data_hygiene_typo')
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
        .eq('status', 'PENDING'),
      supabaseAdmin
        .from('athlete_linking_evaluations')
        .select('evaluation_id', { count: 'exact', head: true })
        .eq('status', 'REVIEW_NEEDED')
    ]);

    const combinedCrossFedCount = (crossFedCountRes.count ?? 0) + (evalReviewNeededCountRes.count ?? 0);

    const counts = {
      homonym_split: homonymCountRes.count ?? 0,
      homonym_clean: homonymCleanCountRes.count ?? 0,
      homonym_contested: homonymContestedCountRes.count ?? 0,
      name_change_merge: nameChangeCountRes.count ?? 0,
      duplicate_profile: duplicateProfileCountRes.count ?? 0,
      data_hygiene_typo: dataHygieneCountRes.count ?? 0,
      cross_federation: combinedCrossFedCount,
      iwf_duplicate: iwfDupCountRes.count ?? 0,
      total:
        (homonymCountRes.count ?? 0) +
        (nameChangeCountRes.count ?? 0) +
        (duplicateProfileCountRes.count ?? 0) +
        (dataHygieneCountRes.count ?? 0) +
        combinedCrossFedCount +
        (iwfDupCountRes.count ?? 0)
    };

    // Query builder for items
    let query = supabaseAdmin
      .from('admin_review_queue')
      .select('*', { count: 'exact' });

    if (category !== 'all') {
      query = query.eq('category', category);
    }
    if (category === 'homonym_split' && subsegment !== 'all') {
      if (subsegment === 'clean') {
        query = query.filter('evidence->split_plan->unidentifiedCompetitions', 'eq', '[]');
      } else if (subsegment === 'contested') {
        query = query.filter('evidence->split_plan->unidentifiedCompetitions', 'neq', '[]');
      }
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

    const { data: rawItems, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let items = rawItems ?? [];

    // Enrich USAW consolidation items (name_change_merge, duplicate_profile, data_hygiene_typo) with live usaw_lifters roster names
    const consolidationCategories = ['name_change_merge', 'duplicate_profile', 'data_hygiene_typo'];
    const consolidationItems = items.filter((item: any) => consolidationCategories.includes(item.category));
    if (consolidationItems.length > 0) {
      const ncLifterIds = new Set<number>();
      consolidationItems.forEach((item: any) => {
        if (item.primary_entity_id) ncLifterIds.add(item.primary_entity_id);
        if (item.candidate_entity_id) ncLifterIds.add(item.candidate_entity_id);
      });

      const ncLifterMap = new Map<number, any>();
      if (ncLifterIds.size > 0) {
        const { data: ncLifters } = await supabaseAdmin
          .from('usaw_lifters')
          .select('lifter_id, athlete_name, membership_number, internal_id')
          .in('lifter_id', Array.from(ncLifterIds));
        (ncLifters || []).forEach((l: any) => ncLifterMap.set(l.lifter_id, l));
      }

      items = items.map((item: any) => {
        if (!consolidationCategories.includes(item.category)) return item;
        const ev = item.evidence || {};
        const titleMatch = item.title?.match(/(?:Name Change|Data Hygiene Correction):\s*"([^"]+)"\s*[↔→]\s*"([^"]+)"\s*(?:\(Member\s*#(\d+)\))?/)
          || item.title?.match(/Duplicate Profile Records:\s*(.+?)\s*\(Member\s*#(\d+)\)/);
        const primaryLifter = item.primary_entity_id ? ncLifterMap.get(item.primary_entity_id) : null;
        const candidateLifter = item.candidate_entity_id ? ncLifterMap.get(item.candidate_entity_id) : null;

        const healedPrimary = primaryLifter?.athlete_name || ev.primary_name || ev.former_name || titleMatch?.[1];
        const healedCandidate = candidateLifter?.athlete_name || ev.candidate_name || ev.canonical_name || (titleMatch?.length === 3 ? titleMatch?.[1] : titleMatch?.[2]);
        const healedMember = candidateLifter?.membership_number || primaryLifter?.membership_number || ev.membership_number || (titleMatch?.length === 3 ? titleMatch?.[2] : titleMatch?.[3]);
        const healedInternalIds = ev.internal_ids || [primaryLifter?.internal_id, candidateLifter?.internal_id].filter(Boolean);

        let cleanTitle = item.title;
        if (item.category === 'duplicate_profile' && healedCandidate) {
          cleanTitle = `Duplicate Profile Records: ${healedCandidate}${healedMember ? ` (Member #${healedMember})` : ''}`;
        } else if (item.category === 'data_hygiene_typo' && healedPrimary && healedCandidate) {
          cleanTitle = `Data Hygiene Correction: "${healedPrimary}" → "${healedCandidate}"${healedMember ? ` (Member #${healedMember})` : ''}`;
        } else if (item.category === 'name_change_merge' && healedPrimary && healedCandidate) {
          cleanTitle = `Name Change: "${healedPrimary}" → "${healedCandidate}"${healedMember ? ` (Member #${healedMember})` : ''}`;
        }

        return {
          ...item,
          title: cleanTitle,
          evidence: {
            ...ev,
            primary_name: healedPrimary,
            candidate_name: healedCandidate,
            membership_number: healedMember,
            internal_ids: healedInternalIds.length > 0 ? healedInternalIds : ev.internal_ids,
            former_name: ev.former_name || healedPrimary,
            canonical_name: ev.canonical_name || healedCandidate
          }
        };
      });
    }

    // Option A: Enrich homonym_split items with verified Sport80 internal IDs, IWF IDs, and official meet URLs
    const homonymItems = items.filter((item: any) => item.category === 'homonym_split');
    if (homonymItems.length > 0) {
      const membershipNumbers = new Set<string>();
      const meetIds = new Set<number>();
      const athleteNames = new Set<string>();

      homonymItems.forEach((item: any) => {
        const titleName = item.title ? item.title.replace(/\s*\([^)]*\)$/, '').trim() : '';
        if (titleName) athleteNames.add(titleName);

        const sp = item.evidence?.split_plan;
        if (sp?.athlete_name) athleteNames.add(String(sp.athlete_name).trim());
        if (sp) {
          const splits = sp.splits || sp.athletes || [];
          splits.forEach((s: any) => {
            const num = s.membershipNumber || s.membership_number;
            if (num) membershipNumbers.add(String(num));
            const sMeets = s.meets || s.competitions || [];
            sMeets.forEach((m: any) => {
              const mId = typeof m === 'number' || typeof m === 'string'
                ? Number(m)
                : Number(m?.meet_id ?? m?.meetId ?? m?.id ?? m?.competition_id ?? m?.competitionId ?? m?.db_meet_id);
              if (mId && !isNaN(mId)) meetIds.add(mId);
            });
          });
          const unMeets = sp.unidentifiedCompetitions || [];
          unMeets.forEach((u: any) => {
            const mId = u.meet_id || u.id;
            if (mId && !isNaN(Number(mId))) meetIds.add(Number(mId));
          });
        }
      });

      // 1. Batch query usaw_lifters for internal_id and lifter_id
      const liftersMap = new Map<string, { internal_id: number | null; lifter_id: number; membership_number?: string; athlete_name?: string }>();
      const lifterByIdMap = new Map<number, { internal_id: number | null; lifter_id: number; membership_number?: string; athlete_name?: string }>();
      const lifterIds: number[] = [];

      if (membershipNumbers.size > 0) {
        const { data: lifters } = await supabaseAdmin
          .from('usaw_lifters')
          .select('membership_number, internal_id, lifter_id, athlete_name')
          .in('membership_number', Array.from(membershipNumbers));

        (lifters || []).forEach((l: any) => {
          if (l.membership_number) {
            liftersMap.set(String(l.membership_number), l);
            lifterByIdMap.set(l.lifter_id, l);
            if (l.lifter_id) lifterIds.push(l.lifter_id);
          }
        });
      }

      // Query all lifters sharing the athlete names to discover unlisted homonym profiles (e.g. 5th Matthew Smith)
      if (athleteNames.size > 0) {
        for (const name of Array.from(athleteNames)) {
          const { data: nameLifters } = await supabaseAdmin
            .from('usaw_lifters')
            .select('membership_number, internal_id, lifter_id, athlete_name, club_name, wso')
            .ilike('athlete_name', name);

          (nameLifters || []).forEach((l: any) => {
            if (l.lifter_id && !lifterByIdMap.has(l.lifter_id)) {
              lifterByIdMap.set(l.lifter_id, l);
              if (l.membership_number) {
                liftersMap.set(String(l.membership_number), l);
              }
              lifterIds.push(l.lifter_id);
            }
          });
        }
      }

      // Query live meet counts and meet results for each lifter from usaw_meet_results
      const liveCountsMap = new Map<number, number>();
      const lifterMeetSet = new Set<string>();
      if (lifterIds.length > 0) {
        const { data: resultsData } = await supabaseAdmin
          .from('usaw_meet_results')
          .select('lifter_id, meet_id')
          .in('lifter_id', lifterIds);
        (resultsData || []).forEach((r: any) => {
          if (r.lifter_id) {
            liveCountsMap.set(r.lifter_id, (liveCountsMap.get(r.lifter_id) || 0) + 1);
            if (r.meet_id) {
              lifterMeetSet.add(`${r.lifter_id}_${r.meet_id}`);
            }
          }
        });
      }

      // 2. Batch query athlete_aliases for linked IWF IDs (if not directly on usaw_lifters)
      const aliasMap = new Map<number, number>();
      if (lifterIds.length > 0) {
        const { data: aliases } = await supabaseAdmin
          .from('athlete_aliases')
          .select('usaw_lifter_id, iwf_db_lifter_id')
          .in('usaw_lifter_id', lifterIds);

        (aliases || []).forEach((a: any) => {
          if (a.usaw_lifter_id && a.iwf_db_lifter_id) {
            aliasMap.set(a.usaw_lifter_id, a.iwf_db_lifter_id);
          }
        });
      }

      // 3. Batch query usaw_meets for official Sport80 URL, meet title, and date
      const meetsMap = new Map<number, { URL: string | null; Meet: string | null; Date: string | null }>();
      if (meetIds.size > 0) {
        const { data: meets } = await supabaseAdmin
          .from('usaw_meets')
          .select('meet_id, URL, Meet, Date')
          .in('meet_id', Array.from(meetIds));

        (meets || []).forEach((m: any) => {
          if (m.meet_id) {
            meetsMap.set(m.meet_id, m);
          }
        });
      }

      // Merge enriched attributes into items
      items = items.map((item: any) => {
        if (item.category !== 'homonym_split' || !item.evidence?.split_plan) return item;
        const sp = item.evidence.split_plan;
        const itemAthleteName = item.title ? item.title.replace(/\s*\([^)]*\)$/, '').trim() : (sp.athlete_name || '');
        const existingLifterIds = new Set<number>();

        const baseSplits = (sp.splits || sp.athletes || []).map((s: any) => {
          const num = s.membershipNumber || s.membership_number;
          const lifter = num ? liftersMap.get(String(num)) : null;
          if (lifter?.lifter_id) existingLifterIds.add(lifter.lifter_id);
          const iwfId = lifter ? aliasMap.get(lifter.lifter_id) : null;
          const liveCount = lifter ? (liveCountsMap.get(lifter.lifter_id) ?? null) : null;
          const sMeets = (s.meets || s.competitions || []).map((m: any) => {
            const mId = typeof m === 'number' || typeof m === 'string'
              ? Number(m)
              : Number(m?.meet_id ?? m?.meetId ?? m?.id ?? m?.competition_id ?? m?.competitionId ?? m?.db_meet_id);
            const meet = mId ? meetsMap.get(mId) : null;
            return {
              ...(typeof m === 'object' && m !== null ? m : {}),
              meet_id: mId || null,
              meet_name: meet?.Meet ?? (typeof m === 'object' ? m?.meet_name : null),
              date: meet?.Date ?? (typeof m === 'object' ? (m?.date ?? m?.meet_date ?? m?.meetDate) : null),
              meet_url: meet?.URL ?? (typeof m === 'object' ? (m?.sport80Url || m?.sport80_url || m?.meet_url) : null)
            };
          });
          return {
            ...s,
            lifter_id: s.lifter_id ?? (lifter?.lifter_id ?? null),
            internal_id: s.internal_id ?? (lifter?.internal_id ?? null),
            linked_iwf_id: s.linked_iwf_id ?? (iwfId ?? null),
            club_name: s.club_name ?? (lifter?.club_name ?? null),
            wso: s.wso ?? (lifter?.wso ?? null),
            live_meet_count: liveCount,
            meets: sMeets
          };
        });

        // Dynamically append ALL discovered sibling lifters sharing this athlete name (no hardcoded limits)
        const unlistedSiblings: any[] = [];
        for (const [lId, lObj] of lifterByIdMap.entries()) {
          if (!existingLifterIds.has(lId) && lObj.athlete_name && lObj.athlete_name.trim().toLowerCase() === itemAthleteName.toLowerCase()) {
            existingLifterIds.add(lId);
            const liveCount = liveCountsMap.get(lId) ?? 0;
            const iwfId = aliasMap.get(lId) ?? null;
            unlistedSiblings.push({
              newAthleteName: lObj.athlete_name,
              membershipNumber: lObj.membership_number,
              membership_number: lObj.membership_number,
              internal_id: lObj.internal_id,
              lifter_id: lId,
              linked_iwf_id: iwfId,
              club_name: lObj.club_name ?? null,
              wso: lObj.wso ?? null,
              live_meet_count: liveCount,
              meets: [],
              is_discovered_sibling: true
            });
          }
        }
        const splits = [...baseSplits, ...unlistedSiblings];

        const unMeets = (sp.unidentifiedCompetitions || []).map((u: any) => {
          const mId = u.meet_id || u.id;
          const meet = mId ? meetsMap.get(Number(mId)) : null;
          let currentLifterId: number | null = null;
          let currentPersonIndex: number | null = null;
          let currentMembership: string | null = null;
          let externalHolder: any = null;

          if (mId) {
            const foundIdx = splits.findIndex((s: any) => {
              const num = s.membershipNumber || s.membership_number;
              const lifter = num ? liftersMap.get(String(num)) : null;
              return lifter && lifterMeetSet.has(`${lifter.lifter_id}_${mId}`);
            });
            if (foundIdx !== -1) {
              currentPersonIndex = foundIdx;
              const sObj = splits[foundIdx];
              currentMembership = sObj.membershipNumber || sObj.membership_number || null;
              const lifterObj = currentMembership ? liftersMap.get(String(currentMembership)) : null;
              currentLifterId = lifterObj?.lifter_id ?? sObj.lifter_id ?? null;
            } else {
              // Check if any other lifter sharing the same name holds this meet
              for (const [lId, lObj] of lifterByIdMap.entries()) {
                if (lifterMeetSet.has(`${lId}_${mId}`)) {
                  currentLifterId = lId;
                  externalHolder = {
                    lifter_id: lId,
                    athlete_name: lObj.athlete_name,
                    membership_number: lObj.membership_number,
                    internal_id: lObj.internal_id
                  };
                  break;
                }
              }
            }
          }

          return {
            ...u,
            meet_name: meet?.Meet ?? u.meet_name ?? null,
            date: meet?.Date ?? u.date ?? null,
            meet_url: meet?.URL ?? (u.sport80Url || u.sport80_url || u.meet_url || null),
            current_lifter_id: currentLifterId ?? null,
            current_person_index: currentPersonIndex,
            current_membership_number: currentMembership,
            external_holder: externalHolder
          };
        });

        return {
          ...item,
          evidence: {
            ...item.evidence,
            split_plan: {
              ...sp,
              splits,
              unidentifiedCompetitions: unMeets
            }
          }
        };
      });
    }

    // Option C: Enrich iwf_duplicate items with verified IWF meet, lifter, and scorecard details
    const iwfDupItems = items.filter((item: any) => item.category === 'iwf_duplicate');
    if (iwfDupItems.length > 0) {
      const dbMeetIds = new Set<number>();
      const titleMeetNames = new Set<string>();
      const athleteNames = new Set<string>();
      const dbLifterIds = new Set<number>();

      iwfDupItems.forEach((item: any) => {
        const ev = item.evidence || {};
        if (ev.db_meet_id && !isNaN(Number(ev.db_meet_id))) {
          dbMeetIds.add(Number(ev.db_meet_id));
        }
        if (ev.athlete_name) {
          athleteNames.add(String(ev.athlete_name).trim());
        }
        if (item.primary_entity_id && !isNaN(Number(item.primary_entity_id))) {
          dbLifterIds.add(Number(item.primary_entity_id));
        }
        if (item.candidate_entity_id && !isNaN(Number(item.candidate_entity_id))) {
          dbLifterIds.add(Number(item.candidate_entity_id));
        }
        if (ev.db_lifter_id && !isNaN(Number(ev.db_lifter_id))) {
          dbLifterIds.add(Number(ev.db_lifter_id));
        }
        if (ev.lifter_id && !isNaN(Number(ev.lifter_id))) {
          dbLifterIds.add(Number(ev.lifter_id));
        }
        const titleMatch = item.title?.match(/IWF Same-Meet Duplicate:\s*(.+?)\s*\((.+?)\)/);
        if (titleMatch) {
          const parsedAthlete = titleMatch[1].trim();
          const parsedMeet = titleMatch[2].trim();
          if (parsedAthlete) athleteNames.add(parsedAthlete);
          if (parsedMeet) titleMeetNames.add(parsedMeet);
        }
      });

      // Discover authentic meet and lifter IDs directly from iwf_meet_results by permuted athlete names
      if (athleteNames.size > 0) {
        const lifterNameFilters: string[] = [];
        athleteNames.forEach(n => {
          const clean = n.replace(/["'%]/g, '').trim();
          const parts = clean.split(/\s+/).filter(p => p.length >= 2);
          if (parts.length >= 2) {
            lifterNameFilters.push(`lifter_name.ilike.%${parts[0]}%${parts[parts.length - 1]}%`);
            lifterNameFilters.push(`lifter_name.ilike.%${parts[parts.length - 1]}%${parts[0]}%`);
          } else if (clean.length >= 3) {
            lifterNameFilters.push(`lifter_name.ilike.%${clean}%`);
          }
        });
        if (lifterNameFilters.length > 0) {
          const { data: discoveredRows } = await supabaseAdmin
            .from('iwf_meet_results')
            .select('db_lifter_id, lifter_name')
            .or(lifterNameFilters.join(','))
            .limit(25);
          (discoveredRows || []).forEach((row: any) => {
            if (row.db_lifter_id) {
              dbLifterIds.add(Number(row.db_lifter_id));
            }
          });
        }
      }

      // 1. Fetch meet records from iwf_meets (supporting both staged db_meet_id and canonical title lookup)
      const iwfMeetsMap = new Map<number, any>();
      const iwfMeetsByTitleMap = new Map<string, any[]>();
      if (dbMeetIds.size > 0 || titleMeetNames.size > 0) {
        const meetFilters: string[] = [];
        if (dbMeetIds.size > 0) {
          meetFilters.push(`db_meet_id.in.(${Array.from(dbMeetIds).join(',')})`);
        }
        if (titleMeetNames.size > 0) {
          titleMeetNames.forEach(t => {
            const cleanT = t.replace(/["'%]/g, '').trim();
            if (cleanT) meetFilters.push(`meet.ilike.%${cleanT}%`);
          });
        }
        const { data: meets } = await supabaseAdmin
          .from('iwf_meets')
          .select('db_meet_id, iwf_meet_id, meet, date, level, url')
          .or(meetFilters.join(','));
        (meets || []).forEach((m: any) => {
          iwfMeetsMap.set(m.db_meet_id, m);
          if (m.meet) {
            const key = m.meet.trim().toLowerCase();
            if (!iwfMeetsByTitleMap.has(key)) {
              iwfMeetsByTitleMap.set(key, []);
            }
            iwfMeetsByTitleMap.get(key)!.push(m);
          }
        });
      }

      // Resolve effective meet IDs combining staged IDs and title-discovered meets
      const effectiveMeetIds = new Set<number>(dbMeetIds);
      titleMeetNames.forEach(t => {
        const foundList = iwfMeetsByTitleMap.get(t.toLowerCase()) || [];
        foundList.forEach(found => {
          if (found?.db_meet_id) effectiveMeetIds.add(found.db_meet_id);
        });
      });

      // 2. Fetch duplicate scorecards from iwf_meet_results with gender, attempts, and lifter attribution
      const iwfResultsByMeet = new Map<number, any[]>();
      if (effectiveMeetIds.size > 0) {
        const { data: results } = await supabaseAdmin
          .from('iwf_meet_results')
          .select('db_result_id, db_meet_id, db_lifter_id, lifter_name, weight_class, best_snatch, best_cj, total, body_weight_kg, rank, competition_age, gender, country_code, country_name, birth_year, date, manual_override, snatch_lift_1, snatch_lift_2, snatch_lift_3, cj_lift_1, cj_lift_2, cj_lift_3')
          .in('db_meet_id', Array.from(effectiveMeetIds));

        (results || []).forEach((r: any) => {
          if (!iwfResultsByMeet.has(r.db_meet_id)) {
            iwfResultsByMeet.set(r.db_meet_id, []);
          }
          iwfResultsByMeet.get(r.db_meet_id)!.push(r);
          if (r.db_lifter_id) {
            dbLifterIds.add(Number(r.db_lifter_id));
          }
        });
      }

      // 3. Fetch lifters from iwf_lifters by direct db_lifter_id and safe tokenized search
      const iwfLiftersMap = new Map<number, any>();
      const iwfLiftersByNameMap = new Map<string, any[]>();

      // Guaranteed primary-key lookup by known dbLifterIds (avoids PostgREST 400 Bad Request on spaces)
      if (dbLifterIds.size > 0) {
        const { data: idLifters } = await supabaseAdmin
          .from('iwf_lifters')
          .select('db_lifter_id, iwf_lifter_id, athlete_name, country_code, country_name, birth_year, gender, iwf_athlete_url')
          .in('db_lifter_id', Array.from(dbLifterIds));

        (idLifters || []).forEach((l: any) => {
          iwfLiftersMap.set(l.db_lifter_id, l);
          const nameKey = l.athlete_name ? l.athlete_name.trim().toLowerCase() : '';
          if (nameKey) {
            if (!iwfLiftersByNameMap.has(nameKey)) iwfLiftersByNameMap.set(nameKey, []);
            iwfLiftersByNameMap.get(nameKey)!.push(l);
          }
        });
      }

      // Safe tokenized sibling discovery by individual athlete names without broken .or() whitespace
      for (const n of athleteNames) {
        const cleanN = n.replace(/["'%]/g, '').trim();
        if (!cleanN) continue;
        const { data: nameLifters } = await supabaseAdmin
          .from('iwf_lifters')
          .select('db_lifter_id, iwf_lifter_id, athlete_name, country_code, country_name, birth_year, gender, iwf_athlete_url')
          .ilike('athlete_name', `%${cleanN}%`)
          .limit(10);

        (nameLifters || []).forEach((l: any) => {
          iwfLiftersMap.set(l.db_lifter_id, l);
          const nameKey = l.athlete_name ? l.athlete_name.trim().toLowerCase() : '';
          if (nameKey) {
            if (!iwfLiftersByNameMap.has(nameKey)) iwfLiftersByNameMap.set(nameKey, []);
            iwfLiftersByNameMap.get(nameKey)!.push(l);
          }
        });

        const parts = cleanN.split(/\s+/).filter(p => p.length >= 2);
        if (parts.length >= 2) {
          const revName = `${parts[parts.length - 1]} ${parts[0]}`;
          const { data: revLifters } = await supabaseAdmin
            .from('iwf_lifters')
            .select('db_lifter_id, iwf_lifter_id, athlete_name, country_code, country_name, birth_year, gender, iwf_athlete_url')
            .ilike('athlete_name', `%${revName}%`)
            .limit(10);

          (revLifters || []).forEach((l: any) => {
            iwfLiftersMap.set(l.db_lifter_id, l);
            const nameKey = l.athlete_name ? l.athlete_name.trim().toLowerCase() : '';
            if (nameKey) {
              if (!iwfLiftersByNameMap.has(nameKey)) iwfLiftersByNameMap.set(nameKey, []);
              iwfLiftersByNameMap.get(nameKey)!.push(l);
            }
          });
        }
      }

      // 4. Map enriched verification metadata back to items
      items = items.map((item: any) => {
        if (item.category !== 'iwf_duplicate') return item;
        const ev = item.evidence || {};
        const titleMatch = item.title?.match(/IWF Same-Meet Duplicate:\s*(.+?)\s*\((.+?)\)/);
        const athleteName = ev.athlete_name || titleMatch?.[1]?.trim() || '';
        const nameKey = athleteName.toLowerCase();
        const titleMeet = titleMatch?.[2]?.trim();

        // Token-based case-insensitive scorecard matching
        const normalizeTokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
        const targetTokens = normalizeTokens(athleteName);
        const getMatchScorecards = (mId: number | null) => {
          if (!mId) return [];
          const meetResults = iwfResultsByMeet.get(mId) || [];
          return meetResults.filter((sc: any) => {
            if (!sc.lifter_name) return false;
            const scTokens = normalizeTokens(sc.lifter_name);
            return targetTokens.every(t => scTokens.includes(t)) || scTokens.every(t => targetTokens.includes(t));
          });
        };

        // Self-heal meet ID: Check if meet found by title has results or matches
        let meetId = ev.db_meet_id ? Number(ev.db_meet_id) : null;
        let meet = meetId ? iwfMeetsMap.get(meetId) : null;
        let scorecards = getMatchScorecards(meetId);

        // Only attempt title-based meet resolution if no meet record was found by staged db_meet_id
        if (!meet && titleMeet) {
          const candidateMeets = iwfMeetsByTitleMap.get(titleMeet.toLowerCase()) || [];
          for (const titleFoundMeet of candidateMeets) {
            const altScorecards = getMatchScorecards(titleFoundMeet.db_meet_id);
            if (altScorecards.length > 0) {
              meetId = titleFoundMeet.db_meet_id;
              meet = titleFoundMeet;
              scorecards = altScorecards;
              break;
            } else if (!meet) {
              meetId = titleFoundMeet.db_meet_id;
              meet = titleFoundMeet;
            }
          }
        }

        const candidateLifters = iwfLiftersByNameMap.get(nameKey) || [];
        const reversedKey = athleteName.split(/\s+/).reverse().join(' ').toLowerCase();
        const reversedLifters = iwfLiftersByNameMap.get(reversedKey) || [];
        const liftersFound: any[] = [];
        const seenLifterIds = new Set<number>();

        [item.primary_entity_id, item.candidate_entity_id].filter(Boolean).forEach((id: number) => {
          const l = iwfLiftersMap.get(id);
          if (l && !seenLifterIds.has(l.db_lifter_id)) {
            seenLifterIds.add(l.db_lifter_id);
            liftersFound.push(l);
          }
        });

        scorecards.forEach((sc: any) => {
          if (sc.db_lifter_id && !seenLifterIds.has(sc.db_lifter_id)) {
            const l = iwfLiftersMap.get(sc.db_lifter_id);
            if (l) {
              seenLifterIds.add(l.db_lifter_id);
              liftersFound.push(l);
            }
          }
        });

        // Token-based lifter discovery across all fetched iwf_lifters
        for (const l of iwfLiftersMap.values()) {
          if (!l.athlete_name || seenLifterIds.has(l.db_lifter_id)) continue;
          const lTokens = normalizeTokens(l.athlete_name);
          if (targetTokens.length > 0 && (targetTokens.every((t: string) => lTokens.includes(t)) || lTokens.every((t: string) => targetTokens.includes(t)))) {
            seenLifterIds.add(l.db_lifter_id);
            liftersFound.push(l);
          }
        }

        // Fallback: Check if scorecards hold a verified db_lifter_id
        let dbLifterId = ev.db_lifter_id ? Number(ev.db_lifter_id) : null;
        if (!dbLifterId && scorecards.length > 0 && scorecards[0].db_lifter_id) {
          dbLifterId = Number(scorecards[0].db_lifter_id);
        }
        if (dbLifterId && !seenLifterIds.has(dbLifterId)) {
          const l = iwfLiftersMap.get(dbLifterId);
          if (l) liftersFound.unshift(l);
        }

        // Prioritize lifter record holding verified iwf_lifter_id
        const primaryLifter = liftersFound.find((l: any) => l.iwf_lifter_id) || liftersFound[0] || (dbLifterId ? iwfLiftersMap.get(dbLifterId) : null);
        const iwfMeetId = meet?.iwf_meet_id || null;
        const iwfLifterId = primaryLifter?.iwf_lifter_id || null;
        dbLifterId = primaryLifter?.db_lifter_id || dbLifterId || null;

        // Determine gender from lifter profile or scorecards
        const resolvedGender = primaryLifter?.gender || scorecards.find((sc: any) => sc.gender)?.gender || null;
        const normalizedGender = resolvedGender
          ? (/^m/i.test(resolvedGender) ? 'Men' : /^w|^f/i.test(resolvedGender) ? 'Women' : resolvedGender)
          : null;

        // 4-tier chronological official IWF meet URL resolution standard
        const iwfMeetUrl = getOfficialIwfMeetUrl(iwfMeetId, meet?.date) || meet?.url || null;
        const iwfAthleteUrl = primaryLifter?.iwf_athlete_url || (iwfLifterId
          ? `https://iwf.sport/weightlifting_/athletes-bios/?id=${iwfLifterId}`
          : null);
        const iwfAthleteBios = liftersFound
          .filter((l: any) => l.iwf_lifter_id || l.iwf_athlete_url)
          .map((l: any) => ({
            db_lifter_id: l.db_lifter_id,
            iwf_lifter_id: l.iwf_lifter_id,
            athlete_name: l.athlete_name,
            url: l.iwf_athlete_url || (l.iwf_lifter_id ? `https://iwf.sport/weightlifting_/athletes-bios/?id=${l.iwf_lifter_id}` : null)
          }));

        // Self-heal weight classes if empty or missing in staged evidence
        const detectedCategories = Array.from(new Set(scorecards.map((sc: any) => sc.weight_class).filter(Boolean)));
        const effectiveWeightClasses = (ev.weight_classes && ev.weight_classes.length > 0)
          ? ev.weight_classes
          : detectedCategories;

        return {
          ...item,
          evidence: {
            ...ev,
            weight_classes: effectiveWeightClasses,
            db_meet_id: meetId || ev.db_meet_id,
            iwf_meet_id: iwfMeetId,
            meet_name: meet?.meet || ev.event_name || ev.meet_name,
            meet_date: meet?.date || null,
            meet_url: iwfMeetUrl,
            owlanalytics_meet_url: (iwfMeetId || meetId) ? `/meet/iwf/${iwfMeetId || meetId}` : null,
            iwf_meet_url: iwfMeetUrl,
            db_lifter_id: dbLifterId,
            iwf_lifter_id: iwfLifterId,
            gender: normalizedGender,
            raw_gender: resolvedGender,
            country_code: primaryLifter?.country_code || null,
            country_name: primaryLifter?.country_name || null,
            birth_year: primaryLifter?.birth_year || null,
            owlanalytics_athlete_url: iwfLifterId ? `/athlete/iwf/${iwfLifterId}` : null,
            iwf_athlete_url: iwfAthleteUrl,
            iwf_athlete_bios: iwfAthleteBios,
            all_lifters: liftersFound.map((l: any) => ({
              db_lifter_id: l.db_lifter_id,
              iwf_lifter_id: l.iwf_lifter_id,
              athlete_name: l.athlete_name,
              country_code: l.country_code,
              country_name: l.country_name,
              birth_year: l.birth_year,
              gender: l.gender,
              owlanalytics_url: l.iwf_lifter_id ? `/athlete/iwf/${l.iwf_lifter_id}` : null,
              iwf_athlete_url: l.iwf_athlete_url || null,
              iwf_url: l.iwf_athlete_url || (l.iwf_lifter_id ? `https://iwf.sport/weightlifting_/athletes-bios/?id=${l.iwf_lifter_id}` : null)
            })),
            duplicate_scorecards: scorecards
          }
        };
      });
    }

    return NextResponse.json({
      success: true,
      counts,
      items,
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
    const { reviewId, reviewIds, resolution, notes, updatedEvidence } = body;

    if (!['APPROVED', 'REJECTED', 'RESOLVED', 'UPDATE_PLAN', 'PENDING', 'UPDATE_FORMER_NAME_DISPLAY', 'RESCRAPE_IWF_EVENT', 'CHECK_IWF_STATUS'].includes(resolution)) {
      return NextResponse.json({ success: false, error: 'Invalid parameters: resolution required' }, { status: 400 });
    }

    // Batch approval or batch rollback (Undo)
    if (reviewIds && Array.isArray(reviewIds) && reviewIds.length > 0) {
      const isRevert = resolution === 'PENDING';
      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        status: resolution,
        resolved_at: isRevert ? null : now,
        resolved_by: isRevert ? null : (user.email || user.id)
      };

      const { error: batchErr } = await supabaseAdmin
        .from('admin_review_queue')
        .update(updatePayload)
        .in('id', reviewIds);

      if (batchErr) {
        return NextResponse.json({ success: false, error: batchErr.message }, { status: 500 });
      }
      const actionText = isRevert ? 'reverted back to pending' : 'marked as approved';
      return NextResponse.json({ success: true, count: reviewIds.length, message: `Batch ${actionText} (${reviewIds.length} items).` });
    }

    if (!reviewId) {
      return NextResponse.json({ success: false, error: 'reviewId or reviewIds required' }, { status: 400 });
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

    // 2b. Handle standalone former name display toggle for name changes
    if (resolution === 'UPDATE_FORMER_NAME_DISPLAY' && currentItem.category === 'name_change_merge') {
      const currentEv = currentItem.evidence || {};
      const newDisplay = Boolean(updatedEvidence?.display_former_name);
      const titleMatch = currentItem.title?.match(/(?:Name Change|Data Hygiene Correction):\s*"([^"]+)"\s*[↔→]\s*"([^"]+)"\s*(?:\(Member\s*#(\d+)\))?/)
        || currentItem.title?.match(/Duplicate Profile Records:\s*(.+?)\s*\(Member\s*#(\d+)\)/);
      const healedPrimary = currentEv.primary_name || currentEv.former_name || titleMatch?.[1];
      const healedCandidate = currentEv.candidate_name || currentEv.canonical_name || (titleMatch?.length === 3 ? titleMatch?.[1] : titleMatch?.[2]);
      const healedMember = currentEv.membership_number || (titleMatch?.length === 3 ? titleMatch?.[2] : titleMatch?.[3]);
      const updatedEv = {
        ...currentEv,
        primary_name: healedPrimary,
        candidate_name: healedCandidate,
        membership_number: healedMember,
        display_former_name: newDisplay,
        former_name: currentEv.former_name || healedPrimary,
        canonical_name: currentEv.canonical_name || healedCandidate
      };

      const { error: updErr } = await supabaseAdmin
        .from('admin_review_queue')
        .update({ evidence: updatedEv })
        .eq('id', reviewId);

      if (updErr) {
        return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Former name display preference updated.' });
    }

    // 2c. Handle IWF duplicate targeted re-scrape, athlete provisioning, scorecard reassignment, purge, or official confirmation
    if (currentItem.category === 'iwf_duplicate') {
      const triggerIwfShardRefresh = async (iwfIds: (number | string | null | undefined)[]) => {
        const shardRefreshUrl = process.env.HETZNER_SHARD_REFRESH_URL;
        const shardSecret = process.env.HETZNER_SHARD_REFRESH_SECRET || process.env.INTERNAL_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
        if (!shardRefreshUrl) return;
        for (const id of iwfIds) {
          if (!id) continue;
          try {
            await fetch(shardRefreshUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ iwf_id: Number(id) || id, secret: shardSecret }),
              signal: AbortSignal.timeout(5000)
            });
          } catch (err: any) {
            console.warn(`[IWF Shard Refresh] Warning for iwf_id=${id}: ${err?.message || err}`);
          }
        }
      };

      // Real-time database verification for IWF duplicate category presence
      if (resolution === 'CHECK_IWF_STATUS') {
        const currentEv = currentItem.evidence || {};
        const titleMatch = currentItem.title?.match(/IWF Same-Meet Duplicate:\s*(.+?)\s*\((.+?)\)/);
        const athleteName = currentEv.athlete_name || titleMatch?.[1]?.trim() || '';
        const dbMeetId = currentEv.db_meet_id ? Number(currentEv.db_meet_id) : null;
        const iwfMeetId = currentEv.iwf_meet_id ? String(currentEv.iwf_meet_id) : null;
        const registeredCategories: string[] = currentEv.weight_classes || [];

        let resolvedMeetId = dbMeetId;

        // 1. First query live meet results for athlete across all meets via tokenized matching
        const tokens = athleteName.replace(/["'%]/g, '').trim().split(/\s+/).filter(t => t.length >= 2);
        const lifterFilters = tokens.map(t => `lifter_name.ilike.%${t}%`);
        const { data: lifterRows } = await supabaseAdmin
          .from('iwf_meet_results')
          .select('db_result_id, db_meet_id, db_lifter_id, lifter_name, weight_class, best_snatch, best_cj, total, body_weight_kg, rank, competition_age, gender, country_code, country_name, birth_year, date, manual_override')
          .or(lifterFilters.join(','));

        const normalizeTokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
        const targetTokens = tokens.map(t => t.toLowerCase());
        const meetGroups = new Map<number, any[]>();
        (lifterRows || []).forEach((sc: any) => {
          if (!sc.lifter_name) return;
          const scTokens = normalizeTokens(sc.lifter_name);
          if (targetTokens.every(t => scTokens.includes(t)) || scTokens.every(t => targetTokens.includes(t))) {
            if (!meetGroups.has(sc.db_meet_id)) meetGroups.set(sc.db_meet_id, []);
            meetGroups.get(sc.db_meet_id)!.push(sc);
          }
        });

        let meetRow: any = null;
        if (resolvedMeetId) {
          const { data: m } = await supabaseAdmin
            .from('iwf_meets')
            .select('db_meet_id, iwf_meet_id, meet, date')
            .eq('db_meet_id', resolvedMeetId)
            .limit(1)
            .maybeSingle();
          meetRow = m;
        }

        if (!resolvedMeetId && iwfMeetId) {
          const { data: m } = await supabaseAdmin
            .from('iwf_meets')
            .select('db_meet_id, iwf_meet_id, meet, date')
            .eq('iwf_meet_id', Number(iwfMeetId))
            .limit(1)
            .maybeSingle();
          if (m?.db_meet_id) {
            resolvedMeetId = m.db_meet_id;
            meetRow = m;
          }
        }

        if (!resolvedMeetId) {
          return NextResponse.json({ success: false, error: 'Could not resolve meet record for status check.' }, { status: 400 });
        }

        const { data: liveResults } = await supabaseAdmin
          .from('iwf_meet_results')
          .select('db_result_id, db_meet_id, db_lifter_id, lifter_name, weight_class, best_snatch, best_cj, total, body_weight_kg, rank, competition_age, gender, country_code, country_name, birth_year, date, manual_override, snatch_lift_1, snatch_lift_2, snatch_lift_3, cj_lift_1, cj_lift_2, cj_lift_3')
          .eq('db_meet_id', resolvedMeetId);

        const matchedScorecards = meetGroups.get(resolvedMeetId) || (liveResults || []).filter((sc: any) => {
          if (!sc.lifter_name) return false;
          const scTokens = normalizeTokens(sc.lifter_name);
          return targetTokens.every(t => scTokens.includes(t)) || scTokens.every(t => targetTokens.includes(t));
        });

        const detectedCategories = Array.from(new Set(matchedScorecards.map((sc: any) => sc.weight_class).filter(Boolean)));
        const effectiveCategories = (registeredCategories.length > 0) ? registeredCategories : detectedCategories;

        const isComplete = effectiveCategories.length > 0 && matchedScorecards.length >= effectiveCategories.length;
        const updatedEv = {
          ...currentEv,
          duplicate_scorecards: matchedScorecards,
          db_meet_id: resolvedMeetId,
          iwf_meet_id: meetRow?.iwf_meet_id || currentEv.iwf_meet_id,
          meet_name: meetRow?.meet || currentEv.meet_name,
          meet_date: meetRow?.date || currentEv.meet_date,
          weight_classes: effectiveCategories,
          db_lifter_id: matchedScorecards[0]?.db_lifter_id || currentEv.db_lifter_id,
          last_status_check: {
            checked_at: new Date().toISOString(),
            checked_by: user.email || user.id,
            scorecards_found: matchedScorecards.length,
            registered_categories: effectiveCategories.length,
            is_complete: isComplete
          }
        };

        await supabaseAdmin
          .from('admin_review_queue')
          .update({ evidence: updatedEv })
          .eq('id', reviewId);

        return NextResponse.json({
          success: true,
          verified: isComplete,
          scorecardsFound: matchedScorecards.length,
          requiredCategories: effectiveCategories.length,
          scorecards: matchedScorecards,
          message: isComplete
            ? `Database verified: All ${matchedScorecards.length} registered weight categories are present in live records.`
            : `Database has ${matchedScorecards.length} of ${effectiveCategories.length} categories present.`
        });
      }

      if (resolution === 'RESCRAPE_IWF_EVENT') {
        const currentEv = currentItem.evidence || {};
        const eventId = String(updatedEvidence?.iwf_meet_id || currentEv.iwf_meet_id || '').trim();
        const year = String(updatedEvidence?.year || '').trim();
        const athleteName = String(updatedEvidence?.athlete_name || currentEv.athlete_name || '').trim();

        if (!eventId || !year) {
          return NextResponse.json(
            { success: false, error: 'Both official IWF event_id and competition year are required for targeted re-scraping.' },
            { status: 400 }
          );
        }

        const githubPat = process.env.GITHUB_PAT;
        if (!githubPat) {
          return NextResponse.json(
            {
              success: false,
              error: `GITHUB_PAT is not configured in .env.local. Add GITHUB_PAT to trigger GitHub Actions automatically, or run iwf-daily-results-pipeline.yml manually with year=${year}, event_id=${eventId}, force=true, athlete_name="${athleteName}".`
            },
            { status: 400 }
          );
        }

        const ghRes = await fetch(
          'https://api.github.com/repos/PhillipBost/weightlifting-database/actions/workflows/iwf-daily-results-pipeline.yml/dispatches',
          {
            method: 'POST',
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${githubPat}`,
              'X-GitHub-Api-Version': '2022-11-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: {
                year,
                event_id: eventId,
                force: true,
                ...(athleteName ? { athlete_name: athleteName } : {})
              }
            })
          }
        );

        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return NextResponse.json(
            { success: false, error: `GitHub Actions dispatch failed (HTTP ${ghRes.status}): ${errText}` },
            { status: 502 }
          );
        }

        const updatedEv = {
          ...currentEv,
          last_rescrape_dispatch: {
            dispatched_at: new Date().toISOString(),
            dispatched_by: user.email || user.id,
            year,
            event_id: eventId,
            athlete_name: athleteName || null,
            force: true
          }
        };

        await supabaseAdmin
          .from('admin_review_queue')
          .update({ evidence: updatedEv })
          .eq('id', reviewId);

        return NextResponse.json({
          success: true,
          message: `Targeted IWF re-scrape dispatched to GitHub Actions (Event #${eventId}, Year ${year}${athleteName ? `, Athlete: ${athleteName}` : ''}). Missing categories will populate in Supabase within 1–2 minutes.`
        });
      }

      if (resolution === 'APPROVED' || resolution === 'RESOLVED') {
        const currentEv = currentItem.evidence || {};
        const repairAction: string = updatedEvidence?.repair_action || (updatedEvidence?.purge_result_id ? 'SCORECARD_PURGED' : 'CONFIRMED_OFFICIAL');
        const targetResultId = updatedEvidence?.db_result_id ? Number(updatedEvidence.db_result_id) : (updatedEvidence?.purge_result_id ? Number(updatedEvidence.purge_result_id) : null);
        const nowIso = new Date().toISOString();

        let repairExecution: Record<string, any> = {
          action_type: repairAction,
          executed_at: nowIso,
          executed_by: user.email || user.id
        };
        let responseMessage = 'Official primary-source dual entry verified and confirmed.';

        if (repairAction === 'NEW_ATHLETE_CREATED') {
          if (!targetResultId) {
            return NextResponse.json({ success: false, error: 'db_result_id is required to split a scorecard to a new athlete.' }, { status: 400 });
          }
          const newProfile = updatedEvidence?.new_athlete_profile || {};
          const formattedName = String(newProfile.athlete_name || '').trim();
          if (!formattedName) {
            return NextResponse.json({ success: false, error: 'athlete_name is required when provisioning a new IWF athlete profile.' }, { status: 400 });
          }

          // Snapshot original scorecard prior to modification
          const { data: origResult, error: origErr } = await supabaseAdmin
            .from('iwf_meet_results')
            .select('*')
            .eq('db_result_id', targetResultId)
            .single();

          if (origErr || !origResult) {
            return NextResponse.json({ success: false, error: `Scorecard #${targetResultId} not found in iwf_meet_results.` }, { status: 404 });
          }

          const insertLifterPayload: Record<string, any> = {
            athlete_name: formattedName,
            country_code: newProfile.country_code ? String(newProfile.country_code).trim().toUpperCase() : origResult.country_code,
            country_name: newProfile.country_name ? String(newProfile.country_name).trim() : origResult.country_name,
            gender: newProfile.gender ? String(newProfile.gender).trim().toUpperCase() : origResult.gender,
            birth_year: newProfile.birth_year ? Number(newProfile.birth_year) : (origResult.birth_year ?? null),
            iwf_lifter_id: newProfile.iwf_lifter_id ? Number(newProfile.iwf_lifter_id) : null,
            iwf_athlete_url: newProfile.iwf_lifter_id
              ? `https://iwf.sport/weightlifting_/athletes-bios/?id=${Number(newProfile.iwf_lifter_id)}`
              : null
          };

          const { data: createdLifter, error: createErr } = await supabaseAdmin
            .from('iwf_lifters')
            .insert([insertLifterPayload])
            .select('*')
            .single();

          if (createErr || !createdLifter) {
            return NextResponse.json({ success: false, error: createErr?.message || 'Failed to insert new row into iwf_lifters.' }, { status: 500 });
          }

          const newDbLifterId = Number(createdLifter.db_lifter_id);
          const resultYear = origResult.date ? new Date(origResult.date).getFullYear() : null;
          const computedAge = createdLifter.birth_year && resultYear && !isNaN(resultYear)
            ? resultYear - Number(createdLifter.birth_year)
            : origResult.competition_age;

          const { error: reassignErr } = await supabaseAdmin
            .from('iwf_meet_results')
            .update({
              db_lifter_id: newDbLifterId,
              lifter_name: createdLifter.athlete_name,
              country_code: createdLifter.country_code || origResult.country_code,
              country_name: createdLifter.country_name || origResult.country_name,
              birth_year: createdLifter.birth_year ?? origResult.birth_year,
              competition_age: computedAge,
              manual_override: true,
              updated_at: nowIso
            })
            .eq('db_result_id', targetResultId);

          if (reassignErr) {
            return NextResponse.json({ success: false, error: reassignErr.message }, { status: 500 });
          }

          repairExecution = {
            ...repairExecution,
            provisioned_db_lifter_id: newDbLifterId,
            provisioned_lifter_row: createdLifter,
            reassigned_results: [
              {
                db_result_id: targetResultId,
                previous_db_lifter_id: origResult.db_lifter_id,
                new_db_lifter_id: newDbLifterId,
                weight_class: origResult.weight_class,
                previous_row_snapshot: origResult
              }
            ]
          };

          await triggerIwfShardRefresh([origResult.db_lifter_id, newDbLifterId]);
          responseMessage = `Provisioned new IWF athlete profile (${createdLifter.athlete_name}, DB #${newDbLifterId}) and reassigned Scorecard #${targetResultId} (${origResult.weight_class}).`;
        } else if (repairAction === 'SCORECARD_REASSIGNED') {
          const targetDbLifterId = updatedEvidence?.target_db_lifter_id ? Number(updatedEvidence.target_db_lifter_id) : null;
          if (!targetResultId || !targetDbLifterId) {
            return NextResponse.json({ success: false, error: 'Both db_result_id and target_db_lifter_id are required for scorecard reassignment.' }, { status: 400 });
          }

          const { data: origResult, error: origErr } = await supabaseAdmin
            .from('iwf_meet_results')
            .select('*')
            .eq('db_result_id', targetResultId)
            .single();

          if (origErr || !origResult) {
            return NextResponse.json({ success: false, error: `Scorecard #${targetResultId} not found.` }, { status: 404 });
          }

          const { data: targetLifter, error: targetErr } = await supabaseAdmin
            .from('iwf_lifters')
            .select('*')
            .eq('db_lifter_id', targetDbLifterId)
            .single();

          if (targetErr || !targetLifter) {
            return NextResponse.json({ success: false, error: `Target IWF lifter #${targetDbLifterId} not found in iwf_lifters.` }, { status: 404 });
          }

          const resultYear = origResult.date ? new Date(origResult.date).getFullYear() : null;
          const computedAge = targetLifter.birth_year && resultYear && !isNaN(resultYear)
            ? resultYear - Number(targetLifter.birth_year)
            : origResult.competition_age;

          const { error: updResErr } = await supabaseAdmin
            .from('iwf_meet_results')
            .update({
              db_lifter_id: targetDbLifterId,
              lifter_name: targetLifter.athlete_name,
              country_code: targetLifter.country_code || origResult.country_code,
              country_name: targetLifter.country_name || origResult.country_name,
              birth_year: targetLifter.birth_year ?? origResult.birth_year,
              competition_age: computedAge,
              manual_override: true,
              updated_at: nowIso
            })
            .eq('db_result_id', targetResultId);

          if (updResErr) {
            return NextResponse.json({ success: false, error: updResErr.message }, { status: 500 });
          }

          repairExecution = {
            ...repairExecution,
            reassigned_results: [
              {
                db_result_id: targetResultId,
                previous_db_lifter_id: origResult.db_lifter_id,
                new_db_lifter_id: targetDbLifterId,
                weight_class: origResult.weight_class,
                previous_row_snapshot: origResult
              }
            ]
          };

          await triggerIwfShardRefresh([origResult.db_lifter_id, targetDbLifterId]);
          responseMessage = `Reassigned Scorecard #${targetResultId} (${origResult.weight_class}) to ${targetLifter.athlete_name} (DB #${targetDbLifterId}).`;
        } else if (repairAction === 'SCORECARD_PURGED') {
          if (!targetResultId) {
            return NextResponse.json({ success: false, error: 'db_result_id is required to delete an erroneous scorecard.' }, { status: 400 });
          }

          const { data: resultToPurge } = await supabaseAdmin
            .from('iwf_meet_results')
            .select('*')
            .eq('db_result_id', targetResultId)
            .single();

          if (resultToPurge) {
            await supabaseAdmin
              .from('iwf_meet_results')
              .delete()
              .eq('db_result_id', targetResultId);

            repairExecution = {
              ...repairExecution,
              purged_results_backup: [resultToPurge]
            };

            await triggerIwfShardRefresh([resultToPurge.db_lifter_id]);
            responseMessage = `Deleted erroneous IWF Scorecard #${targetResultId} (${resultToPurge.weight_class}) and backed up row snapshot.`;
          }
        }

        const finalEvidence: Record<string, any> = {
          ...currentEv,
          ...(updatedEvidence || {}),
          verified_official_records: repairAction === 'CONFIRMED_OFFICIAL',
          repair_execution: repairExecution,
          ...(notes ? { admin_notes: notes } : {})
        };

        const updatePayload: Record<string, any> = {
          evidence: finalEvidence,
          status: 'APPROVED',
          resolved_at: nowIso,
          resolved_by: user.email || user.id
        };

        const { error: updErr } = await supabaseAdmin
          .from('admin_review_queue')
          .update(updatePayload)
          .eq('id', reviewId);

        if (updErr) {
          return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: responseMessage });
      } else if (resolution === 'PENDING' && (currentItem.evidence?.repair_execution || currentItem.evidence?.merge_backup?.purged_result)) {
        const repairExec = currentItem.evidence?.repair_execution;
        const refreshIds: (number | null | undefined)[] = [];

        if (repairExec?.reassigned_results?.length > 0) {
          for (const r of repairExec.reassigned_results) {
            if (r.previous_row_snapshot) {
              await supabaseAdmin
                .from('iwf_meet_results')
                .upsert(r.previous_row_snapshot);
              refreshIds.push(r.previous_db_lifter_id, r.new_db_lifter_id);
            }
          }
        }

        if (repairExec?.provisioned_db_lifter_id) {
          await supabaseAdmin
            .from('iwf_lifters')
            .delete()
            .eq('db_lifter_id', Number(repairExec.provisioned_db_lifter_id));
        }

        if (repairExec?.purged_results_backup?.length > 0) {
          for (const row of repairExec.purged_results_backup) {
            await supabaseAdmin
              .from('iwf_meet_results')
              .upsert(row);
            refreshIds.push(row.db_lifter_id);
          }
        } else if (currentItem.evidence?.merge_backup?.purged_result) {
          const purgedRow = currentItem.evidence.merge_backup.purged_result;
          await supabaseAdmin
            .from('iwf_meet_results')
            .upsert(purgedRow);
          refreshIds.push(purgedRow.db_lifter_id);
        }

        await triggerIwfShardRefresh(refreshIds);

        const currentEv = { ...(currentItem.evidence || {}) };
        delete currentEv.repair_execution;
        delete currentEv.merge_backup;
        if (notes) currentEv.admin_notes = notes;

        await supabaseAdmin
          .from('admin_review_queue')
          .update({
            evidence: currentEv,
            status: 'PENDING',
            resolved_at: null,
            resolved_by: null
          })
          .eq('id', reviewId);

        return NextResponse.json({ success: true, message: 'IWF repair execution rolled back and item reverted to pending.' });
      }
    }

    // 3. If USAW consolidation (name_change_merge, duplicate_profile, data_hygiene_typo): execute downstream merge and trigger shard refresh
    if (['name_change_merge', 'duplicate_profile', 'data_hygiene_typo'].includes(currentItem.category)) {
      const primaryLifterId = Number(currentItem.primary_entity_id);
      const candidateLifterId = Number(currentItem.candidate_entity_id);

      if (resolution === 'APPROVED' && primaryLifterId && candidateLifterId) {
        // Reassign all meet results from typo lifter to canonical lifter
        const { data: resultsToMove } = await supabaseAdmin
          .from('usaw_meet_results')
          .select('result_id')
          .eq('lifter_id', primaryLifterId);

        if (resultsToMove && resultsToMove.length > 0) {
          await supabaseAdmin
            .from('usaw_meet_results')
            .update({ lifter_id: candidateLifterId })
            .eq('lifter_id', primaryLifterId);
        }

        // Archive primary typo lifter row in evidence before removing obsolete row
        const { data: primaryLifterRow } = await supabaseAdmin
          .from('usaw_lifters')
          .select('*')
          .eq('lifter_id', primaryLifterId)
          .single();

        await supabaseAdmin
          .from('usaw_lifters')
          .delete()
          .eq('lifter_id', primaryLifterId);

        // 4. Update status and append reviewer notes to evidence
        const currentEv = currentItem.evidence || {};
        const titleMatch = currentItem.title?.match(/(?:Name Change|Data Hygiene Correction):\s*"([^"]+)"\s*[↔→]\s*"([^"]+)"\s*(?:\(Member\s*#(\d+)\))?/)
          || currentItem.title?.match(/Duplicate Profile Records:\s*(.+?)\s*\(Member\s*#(\d+)\)/);
        const healedPrimary = currentEv.primary_name || currentEv.former_name || titleMatch?.[1] || primaryLifterRow?.athlete_name;
        const healedCandidate = currentEv.candidate_name || currentEv.canonical_name || (titleMatch?.length === 3 ? titleMatch?.[1] : titleMatch?.[2]);
        const healedMember = currentEv.membership_number || (titleMatch?.length === 3 ? titleMatch?.[2] : titleMatch?.[3]);
        const baseEvidence = {
          ...currentEv,
          ...(updatedEvidence || {})
        };
        const finalEvidence: Record<string, any> = {
          ...baseEvidence,
          ...(notes ? { admin_notes: notes } : {})
        };

        // Persist display preference for former name on public profile (strictly for authentic name changes)
        const displayFormerName = currentItem.category === 'name_change_merge'
          ? (updatedEvidence?.display_former_name !== undefined
            ? Boolean(updatedEvidence.display_former_name)
            : (currentEv.display_former_name !== undefined ? Boolean(currentEv.display_former_name) : true))
          : false;
        finalEvidence.display_former_name = displayFormerName;
        finalEvidence.primary_name = healedPrimary;
        finalEvidence.candidate_name = healedCandidate;
        finalEvidence.membership_number = healedMember;
        finalEvidence.former_name = currentEv.former_name || healedPrimary;
        finalEvidence.canonical_name = currentEv.canonical_name || healedCandidate;

        finalEvidence.merge_backup = {
          primary_lifter: primaryLifterRow,
          moved_result_ids: (resultsToMove || []).map((r: any) => r.result_id),
          executed_at: new Date().toISOString()
        };

        // Resolve candidate lifter's official USAW membership number to avoid namespace collision on the Hetzner seeder
        let canonicalUsawId: number | string | null = currentItem.evidence?.membership_number || null;
        if (!canonicalUsawId) {
          const { data: candRow } = await supabaseAdmin
            .from('usaw_lifters')
            .select('membership_number')
            .eq('lifter_id', candidateLifterId)
            .single();
          canonicalUsawId = candRow?.membership_number || candidateLifterId;
        }

        // Trigger backend shard refresh webhook for canonical lifter using the official membership number
        const shardRefreshUrl = process.env.HETZNER_SHARD_REFRESH_URL;
        const shardSecret = process.env.HETZNER_SHARD_REFRESH_SECRET || process.env.INTERNAL_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
        if (shardRefreshUrl) {
          fetch(shardRefreshUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usaw_id: Number(canonicalUsawId) || canonicalUsawId,
              secret: shardSecret
            }),
            signal: AbortSignal.timeout(5000)
          }).catch((err) => console.warn(`[Shard Refresh] Warning: ${err?.message || err}`));
        }

        const updatePayload: Record<string, any> = {
          evidence: finalEvidence,
          status: 'APPROVED',
          resolved_at: new Date().toISOString(),
          resolved_by: user.email || user.id
        };

        const { error: updateError } = await supabaseAdmin
          .from('admin_review_queue')
          .update(updatePayload)
          .eq('id', reviewId);

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        const successMessage = currentItem.category === 'duplicate_profile'
          ? 'Duplicate profile consolidated and athlete shard refreshed.'
          : currentItem.category === 'data_hygiene_typo'
            ? 'Data hygiene typo sanitized and athlete shard refreshed.'
            : 'Name change merged and athlete shard refreshed.';

        return NextResponse.json({ success: true, message: successMessage });
      } else if (resolution === 'PENDING' && currentItem.evidence?.merge_backup) {
        // Rollback: restore original primary lifter and reassign meet results back
        const backup = currentItem.evidence.merge_backup;
        if (backup.primary_lifter) {
          await supabaseAdmin
            .from('usaw_lifters')
            .upsert(backup.primary_lifter);
        }
        if (backup.moved_result_ids && backup.moved_result_ids.length > 0) {
          await supabaseAdmin
            .from('usaw_meet_results')
            .update({ lifter_id: primaryLifterId })
            .in('result_id', backup.moved_result_ids);
        }

        const baseEvidence = updatedEvidence || currentItem.evidence || {};
        const finalEvidence: Record<string, any> = {
          ...baseEvidence,
          ...(notes ? { admin_notes: notes } : {})
        };
        delete finalEvidence.merge_backup;

        let canonicalUsawId: number | string | null = currentItem.evidence?.membership_number || null;
        if (!canonicalUsawId) {
          const { data: candRow } = await supabaseAdmin
            .from('usaw_lifters')
            .select('membership_number')
            .eq('lifter_id', candidateLifterId)
            .single();
          canonicalUsawId = candRow?.membership_number || candidateLifterId;
        }

        const shardRefreshUrl = process.env.HETZNER_SHARD_REFRESH_URL;
        const shardSecret = process.env.HETZNER_SHARD_REFRESH_SECRET || process.env.INTERNAL_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || '';
        if (shardRefreshUrl) {
          fetch(shardRefreshUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usaw_id: Number(canonicalUsawId) || canonicalUsawId,
              secret: shardSecret
            }),
            signal: AbortSignal.timeout(5000)
          }).catch((err) => console.warn(`[Shard Refresh] Warning: ${err?.message || err}`));
        }

        const updatePayload: Record<string, any> = {
          evidence: finalEvidence,
          status: 'PENDING',
          resolved_at: null,
          resolved_by: null
        };

        const { error: updateError } = await supabaseAdmin
          .from('admin_review_queue')
          .update(updatePayload)
          .eq('id', reviewId);

        if (updateError) {
          return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        const revertMessage = currentItem.category === 'duplicate_profile'
          ? 'Duplicate profile consolidation reverted back to pending.'
          : currentItem.category === 'data_hygiene_typo'
            ? 'Data hygiene correction reverted back to pending.'
            : 'Name change reverted back to pending.';

        return NextResponse.json({ success: true, message: revertMessage });
      }
    }

    // 4. Update status and append reviewer notes to evidence
    const baseEvidence = updatedEvidence || currentItem.evidence || {};
    const finalEvidence = {
      ...baseEvidence,
      ...(notes ? { admin_notes: notes } : {})
    };

    const updatePayload: Record<string, any> = {
      evidence: finalEvidence
    };

    if (resolution === 'PENDING') {
      updatePayload.status = 'PENDING';
      updatePayload.resolved_at = null;
      updatePayload.resolved_by = null;
    } else if (resolution !== 'UPDATE_PLAN') {
      updatePayload.status = resolution === 'RESOLVED' ? 'APPROVED' : resolution;
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.resolved_by = user.email || user.id;
    }

    const { error: updateError } = await supabaseAdmin
      .from('admin_review_queue')
      .update(updatePayload)
      .eq('id', reviewId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const successMessage = resolution === 'PENDING'
      ? 'Review item reverted to pending.'
      : resolution === 'UPDATE_PLAN'
        ? 'Review item plan updated.'
        : `Review item marked as ${resolution.toLowerCase()}.`;

    return NextResponse.json({ success: true, message: successMessage });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
