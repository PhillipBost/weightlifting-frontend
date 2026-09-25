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
    const meetId = parseInt(id, 10);
    if (isNaN(meetId)) {
      return NextResponse.json({ success: false, error: 'Invalid meet ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch Meet Metadata
    const { data: meet, error: meetError } = await supabase
      .from('owlcms_meets')
      .select('*')
      .eq('meet_id', meetId)
      .single();

    if (meetError || !meet) {
      return NextResponse.json({ success: false, error: 'Meet not found' }, { status: 404 });
    }

    // 2. Fetch Meet Results joined with Lifter info
    const { data: results, error: resultsError } = await supabase
      .from('owlcms_meet_results')
      .select(`
        *,
        lifter:owlcms_lifters (
          lifter_id,
          athlete_name,
          first_name,
          last_name,
          gender,
          birth_year,
          exact_birth_date,
          country_code,
          club_name,
          membership_number
        )
      `)
      .eq('meet_id', meetId)
      .order('total', { ascending: false, nullsFirst: false });

    if (resultsError) {
      return NextResponse.json({ success: false, error: resultsError.message }, { status: 500 });
    }

    // 3. Fetch Aliases for all lifters in this meet to resolve profile links
    const lifterIds = (results || []).map((r: any) => r.lifter_id).filter(Boolean);
    const aliasMap: Record<number, { usaw_lifter_id?: number | null; iwf_db_lifter_id?: number | null }> = {};

    if (lifterIds.length > 0) {
      const { data: aliases } = await supabase
        .from('athlete_aliases')
        .select('owlcms_lifter_id, usaw_lifter_id, iwf_db_lifter_id')
        .in('owlcms_lifter_id', lifterIds);

      if (aliases) {
        aliases.forEach((a: any) => {
          aliasMap[a.owlcms_lifter_id] = {
            usaw_lifter_id: a.usaw_lifter_id,
            iwf_db_lifter_id: a.iwf_db_lifter_id
          };
        });
      }
    }

    // 4. Enrich Results with Profile Links
    const enrichedResults = (results || []).map((r: any) => {
      const alias = aliasMap[r.lifter_id];
      let profile_url = `/athlete/owlcms/${r.lifter_id}`;
      let linked_federation: 'USAW' | 'IWF' | null = null;

      if (alias?.usaw_lifter_id) {
        profile_url = `/athlete/${alias.usaw_lifter_id}`;
        linked_federation = 'USAW';
      } else if (alias?.iwf_db_lifter_id) {
        profile_url = `/athlete/iwf/${alias.iwf_db_lifter_id}`;
        linked_federation = 'IWF';
      }

      return {
        ...r,
        profile_url,
        linked_federation,
        athlete_name: r.lifter?.athlete_name || `Lifter #${r.lifter_id}`,
        first_name: r.lifter?.first_name,
        last_name: r.lifter?.last_name,
        gender: r.lifter?.gender || r.gender,
        birth_year: r.lifter?.birth_year || r.birth_year,
        club_name: r.lifter?.club_name || null,
        country_code: r.lifter?.country_code || null,
        membership_number: r.lifter?.membership_number || null
      };
    });

    // 5. Aggregate Summary Statistics
    let totalAttempts = 0;
    let successfulAttempts = 0;
    const clubsSet = new Set<string>();
    const sessionsSet = new Set<string>();
    const categoriesSet = new Set<string>();

    enrichedResults.forEach((r: any) => {
      if (r.club_name) clubsSet.add(r.club_name);
      if (r.session_name) sessionsSet.add(r.session_name);
      if (r.category) categoriesSet.add(r.category);

      [r.snatch_1, r.snatch_2, r.snatch_3, r.cj_1, r.cj_2, r.cj_3].forEach((lift: any) => {
        if (lift !== null && lift !== undefined && lift !== 0) {
          totalAttempts++;
          if (Number(lift) > 0) successfulAttempts++;
        }
      });
    });

    const successRate = totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0;
    const rawComp = meet.raw_payload?.competition || {};

    // 6. Enrich with Living Federation Registry & Longitudinal Governance
    let federationDetails: any = null;
    if (meet.federation_id) {
      try {
        const { data: fed } = await supabase
          .from('federation_registry')
          .select('id, canonical_name, short_code, country_code, level')
          .eq('id', meet.federation_id)
          .single();

        if (fed) {
          // Check for point-in-time localization (e.g. historical name at meet.start_date)
          let historicalSanction: any = null;
          if (meet.start_date) {
            const { data: locs } = await supabase
              .from('federation_localizations')
              .select('full_name, acronym, name_type, valid_from, valid_until, citation')
              .eq('federation_id', fed.id)
              .lte('valid_from', meet.start_date)
              .or(`valid_until.is.null,valid_until.gte.${meet.start_date}`);

            const histLoc = locs?.find((l: any) => l.name_type === 'historical');
            if (histLoc) {
              historicalSanction = {
                full_name: histLoc.full_name,
                acronym: histLoc.acronym,
                name_type: histLoc.name_type,
                citation: histLoc.citation
              };
            }
          }

          // Fetch dual governance affiliations
          const { data: affiliations } = await supabase
            .from('federation_affiliations')
            .select(`
              relationship_type,
              parent:federation_registry!federation_affiliations_parent_id_fkey(
                id, canonical_name, short_code, level
              )
            `)
            .eq('child_id', fed.id)
            .eq('is_active', true);

          let apexGovernance: any = null;
          let continentalGovernance: any = null;
          let parentGovernance: any = null;

          (affiliations || []).forEach((aff: any) => {
            if (!aff.parent) return;
            if (aff.relationship_type === 'international_member' || aff.parent.level === 'international') {
              apexGovernance = { canonical_name: aff.parent.canonical_name, short_code: aff.parent.short_code };
            } else if (aff.relationship_type === 'continental_member' || aff.relationship_type === 'continental_confederation' || aff.parent.level === 'continental') {
              continentalGovernance = { canonical_name: aff.parent.canonical_name, short_code: aff.parent.short_code };
            } else if (aff.relationship_type === 'regional_subdivision') {
              parentGovernance = { canonical_name: aff.parent.canonical_name, short_code: aff.parent.short_code };
            }
          });

          federationDetails = {
            id: fed.id,
            canonical_name: fed.canonical_name,
            short_code: fed.short_code,
            country_code: fed.country_code,
            level: fed.level,
            historical_sanction: historicalSanction,
            governance: {
              apex: apexGovernance,
              continental: continentalGovernance,
              parent: parentGovernance
            }
          };
        }
      } catch (fedErr) {
        console.warn('[MEET_DETAIL] Federation enrichment warning:', fedErr);
      }
    }

    return NextResponse.json({
      success: true,
      meet: {
        meet_id: meet.meet_id,
        meet_name: meet.meet_name,
        start_date: meet.start_date,
        end_date: meet.end_date,
        city: meet.city || rawComp.competitionCity || null,
        country: meet.country || null,
        organizer: meet.organizer || rawComp.competitionOrganizer || null,
        federation: federationDetails?.canonical_name || rawComp.federation || null,
        federation_details: federationDetails,
        venue: rawComp.competitionSite || null,
        format_version: meet.format_version,
        summary: {
          total_athletes: enrichedResults.length,
          total_clubs: clubsSet.size,
          total_attempts: totalAttempts,
          successful_attempts: successfulAttempts,
          success_rate: successRate,
          sessions: Array.from(sessionsSet).sort(),
          categories: Array.from(categoriesSet).sort()
        }
      },
      results: enrichedResults
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
