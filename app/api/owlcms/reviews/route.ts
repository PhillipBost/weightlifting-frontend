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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // Query lifters flagged with REVIEW_NEEDED
    const { data: reviews, error } = await supabaseAdmin
      .from('owlcms_lifters')
      .select(`
        lifter_id,
        athlete_name,
        first_name,
        last_name,
        gender,
        birth_year,
        exact_birth_date,
        club_name,
        country_code,
        membership_number,
        link_status,
        review_candidate,
        rejected_candidate_ids,
        created_at
      `)
      .eq('link_status', 'REVIEW_NEEDED')
      .order('lifter_id', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ success: true, count: 0, reviews: [] });
    }

    // 1. Fetch OWLCMS meet results for each lifter
    const lifterIds = reviews.map((r) => r.lifter_id);
    const { data: owlcmsResults } = await supabaseAdmin
      .from('owlcms_meet_results')
      .select(`
        result_id,
        lifter_id,
        meet_id,
        category,
        body_weight_kg,
        snatch_1,
        snatch_2,
        snatch_3,
        best_snatch,
        cj_1,
        cj_2,
        cj_3,
        best_cj,
        total,
        owlcms_meets (
          meet_id,
          meet_name,
          start_date,
          city,
          country
        )
      `)
      .in('lifter_id', lifterIds);

    const owlcmsResultsMap = new Map<number, any>();
    for (const res of owlcmsResults || []) {
      if (!owlcmsResultsMap.has(res.lifter_id)) {
        owlcmsResultsMap.set(res.lifter_id, res);
      }
    }

    // 2. Fetch candidate details (IWF or USAW)
    const iwfCandidateIds: number[] = [];
    const usawCandidateIds: number[] = [];
    for (const r of reviews) {
      const cand = r.review_candidate;
      if (cand?.type === 'IWF' && cand.candidate_id) {
        iwfCandidateIds.push(cand.candidate_id);
      } else if (cand?.type === 'USAW' && cand.candidate_id) {
        usawCandidateIds.push(cand.candidate_id);
      }
    }

    // Fetch IWF in batch
    const iwfLiftersMap = new Map<number, any>();
    const iwfResultsMap = new Map<number, any>();
    if (iwfCandidateIds.length > 0) {
      const { data: iwfLifters } = await supabaseAdmin
        .from('iwf_lifters')
        .select('db_lifter_id, athlete_name, country_code, country_name, iwf_lifter_id, iwf_athlete_url, birth_year, gender')
        .in('db_lifter_id', iwfCandidateIds);
      for (const l of iwfLifters || []) {
        iwfLiftersMap.set(l.db_lifter_id, l);
      }

      const { data: iwfResults } = await supabaseAdmin
        .from('iwf_meet_results')
        .select(`
          db_lifter_id,
          meet_name,
          date,
          weight_class,
          body_weight_kg,
          snatch_lift_1,
          snatch_lift_2,
          snatch_lift_3,
          best_snatch,
          cj_lift_1,
          cj_lift_2,
          cj_lift_3,
          best_cj,
          total
        `)
        .in('db_lifter_id', iwfCandidateIds)
        .order('date', { ascending: false });
      for (const res of iwfResults || []) {
        if (!iwfResultsMap.has(res.db_lifter_id)) {
          iwfResultsMap.set(res.db_lifter_id, res);
        }
      }
    }

    // Fetch USAW in batch
    const usawLiftersMap = new Map<number, any>();
    const usawResultsMap = new Map<number, any>();
    if (usawCandidateIds.length > 0) {
      const { data: usawLifters } = await supabaseAdmin
        .from('usaw_lifters')
        .select('lifter_id, athlete_name, membership_number, club_name, wso, internal_id')
        .in('lifter_id', usawCandidateIds);
      for (const l of usawLifters || []) {
        usawLiftersMap.set(l.lifter_id, l);
      }

      const { data: usawResults } = await supabaseAdmin
        .from('usaw_meet_results')
        .select(`
          lifter_id,
          meet_name,
          date,
          weight_class,
          body_weight_kg,
          snatch_lift_1,
          snatch_lift_2,
          snatch_lift_3,
          best_snatch,
          cj_lift_1,
          cj_lift_2,
          cj_lift_3,
          best_cj,
          total
        `)
        .in('lifter_id', usawCandidateIds)
        .order('date', { ascending: false });
      for (const res of usawResults || []) {
        if (!usawResultsMap.has(res.lifter_id)) {
          usawResultsMap.set(res.lifter_id, res);
        }
      }
    }

    function formatCountry(code?: string | null, name?: string | null): { code: string; name: string; flag: string } {
      const c = (code || '').toUpperCase().trim();
      const n = (name || '').toLowerCase().trim();
      if (c === 'CAN' || n.includes('canada')) {
        return { code: 'CAN', name: 'Canada', flag: '🇨🇦' };
      }
      if (c === 'USA' || n.includes('united states') || n.includes('usa')) {
        return { code: 'USA', name: 'United States', flag: '🇺🇸' };
      }
      if (c === 'GBR' || n.includes('great britain') || n.includes('united kingdom')) {
        return { code: 'GBR', name: 'Great Britain', flag: '🇬🇧' };
      }
      if (c === 'AUS' || n.includes('australia')) {
        return { code: 'AUS', name: 'Australia', flag: '🇦🇺' };
      }
      if (c === 'MEX' || n.includes('mexico')) {
        return { code: 'MEX', name: 'Mexico', flag: '🇲🇽' };
      }
      if (c === 'FRA' || n.includes('france')) {
        return { code: 'FRA', name: 'France', flag: '🇫🇷' };
      }
      return { code: code || 'UNK', name: name || code || 'Unknown', flag: '🌐' };
    }

    function detectOwlcmsCountry(lifter: any, meet: any, evidence?: string): { code: string; name: string; flag: string } {
      if (lifter.country_code) return formatCountry(lifter.country_code, null);
      const evidenceStr = evidence || '';
      if (evidenceStr.includes('(CAN)') || evidenceStr.includes('CAN vs')) return formatCountry('CAN', 'Canada');
      if (evidenceStr.includes('(USA)') || evidenceStr.includes('USA vs')) return formatCountry('USA', 'United States');
      const club = (lifter.club_name || '').toLowerCase();
      const canadianProvinces = [
        'alberta', 'british columbia', 'quebec', 'québec', 'ontario', 'manitoba',
        'saskatchewan', 'nova scotia', 'new brunswick', 'newfoundland', 'pei', 'prince edward island'
      ];
      if (canadianProvinces.some((p) => club.includes(p))) {
        return formatCountry('CAN', 'Canada');
      }
      const meetName = (meet?.meet_name || '').toLowerCase();
      if (meetName.includes('canadien') || meetName.includes('canada')) {
        return formatCountry('CAN', 'Canada');
      }
      return formatCountry(null, null);
    }

    // 3. Assemble enriched reviews payload
    const enrichedReviews = reviews.map((item) => {
      const owlcmsRes = owlcmsResultsMap.get(item.lifter_id);
      const cand = item.review_candidate;
      const owlcmsCountry = detectOwlcmsCountry(item, owlcmsRes?.owlcms_meets, cand?.evidence);

      let candidateDossier: any = null;
      if (cand) {
        if (cand.type === 'IWF') {
          const iwfLifter = iwfLiftersMap.get(cand.candidate_id);
          const iwfRes = iwfResultsMap.get(cand.candidate_id);
          const candCountry = formatCountry(iwfLifter?.country_code, iwfLifter?.country_name);
          const externalUrl =
            iwfLifter?.iwf_athlete_url ||
            (iwfLifter?.iwf_lifter_id
              ? `https://iwf.sport/weightlifting_/athletes-bios/?athlete_id=${iwfLifter.iwf_lifter_id}`
              : null);

          candidateDossier = {
            ...cand,
            country: candCountry,
            affiliation: 'International',
            internal_url: `/athlete/iwf/${cand.candidate_id}`,
            external_url: externalUrl,
            recent_competition: iwfRes
              ? {
                  meet_name: iwfRes.meet_name,
                  date: iwfRes.date,
                  weight_class: iwfRes.weight_class,
                  body_weight_kg: iwfRes.body_weight_kg,
                  snatch_1: iwfRes.snatch_lift_1,
                  snatch_2: iwfRes.snatch_lift_2,
                  snatch_3: iwfRes.snatch_lift_3,
                  best_snatch: iwfRes.best_snatch,
                  cj_1: iwfRes.cj_lift_1,
                  cj_2: iwfRes.cj_lift_2,
                  cj_3: iwfRes.cj_lift_3,
                  best_cj: iwfRes.best_cj,
                  total: iwfRes.total
                }
              : null
          };
        } else if (cand.type === 'USAW') {
          const usawLifter = usawLiftersMap.get(cand.candidate_id);
          const usawRes = usawResultsMap.get(cand.candidate_id);
          const candCountry = formatCountry('USA', 'United States');
          const externalUrl = usawLifter?.internal_id
            ? `https://usaweightlifting.sport80.com/public/rankings/member/${usawLifter.internal_id}`
            : usawLifter?.membership_number
            ? `https://usaweightlifting.sport80.com/public/rankings/member/${usawLifter.membership_number}`
            : null;

          const affiliationParts: string[] = [];
          if (usawLifter?.wso) affiliationParts.push(usawLifter.wso);
          if (usawLifter?.club_name && usawLifter.club_name !== '-') affiliationParts.push(usawLifter.club_name);

          candidateDossier = {
            ...cand,
            country: candCountry,
            membership_number: usawLifter?.membership_number,
            affiliation: affiliationParts.join(' • ') || 'USAW Athlete',
            internal_url: `/athlete/${usawLifter?.membership_number || `u-${cand.candidate_id}`}`,
            external_url: externalUrl,
            recent_competition: usawRes
              ? {
                  meet_name: usawRes.meet_name,
                  date: usawRes.date,
                  weight_class: usawRes.weight_class,
                  body_weight_kg: usawRes.body_weight_kg,
                  snatch_1: usawRes.snatch_lift_1,
                  snatch_2: usawRes.snatch_lift_2,
                  snatch_3: usawRes.snatch_lift_3,
                  best_snatch: usawRes.best_snatch,
                  cj_1: usawRes.cj_lift_1,
                  cj_2: usawRes.cj_lift_2,
                  cj_3: usawRes.cj_lift_3,
                  best_cj: usawRes.best_cj,
                  total: usawRes.total
                }
              : null
          };
        }
      }

      return {
        ...item,
        country: owlcmsCountry,
        competition: owlcmsRes
          ? {
              meet_id: owlcmsRes.meet_id,
              meet_name: owlcmsRes.owlcms_meets?.meet_name || 'OWLCMS Competition',
              date: owlcmsRes.owlcms_meets?.start_date || null,
              category: owlcmsRes.category,
              body_weight_kg: owlcmsRes.body_weight_kg,
              snatch_1: owlcmsRes.snatch_1,
              snatch_2: owlcmsRes.snatch_2,
              snatch_3: owlcmsRes.snatch_3,
              best_snatch: owlcmsRes.best_snatch,
              cj_1: owlcmsRes.cj_1,
              cj_2: owlcmsRes.cj_2,
              cj_3: owlcmsRes.cj_3,
              best_cj: owlcmsRes.best_cj,
              total: owlcmsRes.total
            }
          : null,
        review_candidate: candidateDossier || cand
      };
    });

    return NextResponse.json({
      success: true,
      count: enrichedReviews.length,
      reviews: enrichedReviews
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
