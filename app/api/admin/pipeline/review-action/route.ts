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
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { evaluationId, action, notes } = body;

    if (!evaluationId || !['CONFIRM_MATCH', 'REJECT_BLACKLIST', 'DISMISS_ISOLATED', 'REOPEN_REVIEW'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters: evaluationId and valid action are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch evaluation record
    const { data: evalRow, error: fetchErr } = await supabaseAdmin
      .from('athlete_linking_evaluations')
      .select('*')
      .eq('evaluation_id', Number(evaluationId))
      .single();

    if (fetchErr || !evalRow) {
      return NextResponse.json({ success: false, error: 'Evaluation task not found.' }, { status: 404 });
    }

    // 2. Load federation short codes
    const { data: federations } = await supabaseAdmin
      .from('federation_registry')
      .select('id, short_code')
      .in('id', [evalRow.source_federation_id, evalRow.target_federation_id]);

    const fedMap = new Map<string, string>();
    (federations || []).forEach((f: any) => fedMap.set(f.id, (f.short_code || '').toUpperCase()));

    const sCode = fedMap.get(evalRow.source_federation_id) || '';
    const tCode = fedMap.get(evalRow.target_federation_id) || '';
    const sourceId = Number(evalRow.source_athlete_id);
    const targetId = evalRow.target_athlete_id
      ? Number(evalRow.target_athlete_id)
      : (evalRow.evidence_breakdown?.target?.id ? Number(evalRow.evidence_breakdown.target.id) : null);

    const nowIso = new Date().toISOString();
    const resolvedNotes = notes !== undefined ? String(notes).trim() : evalRow.reviewer_notes;
    const currentEb = evalRow.evidence_breakdown || {};

    if (action === 'CONFIRM_MATCH') {
      if (!targetId) {
        return NextResponse.json(
          { success: false, error: 'Cannot confirm match: target_athlete_id is null on this evaluation.' },
          { status: 400 }
        );
      }

      // Build pairwise payload adhering strictly to check_alias_type = 2
      const aliasPayload: Record<string, any> = {
        match_confidence: evalRow.confidence_score ? Math.round(Number(evalRow.confidence_score)) : 100,
        manual_override: true,
        updated_at: nowIso
      };

      if (sCode === 'IWF' && tCode === 'USAW') {
        aliasPayload.iwf_db_lifter_id = sourceId;
        aliasPayload.usaw_lifter_id = targetId;
      } else if (sCode === 'USAW' && tCode === 'IWF') {
        aliasPayload.usaw_lifter_id = sourceId;
        aliasPayload.iwf_db_lifter_id = targetId;
      } else if (sCode === 'USAW' && tCode === 'OWLCMS') {
        aliasPayload.usaw_lifter_id = sourceId;
        aliasPayload.owlcms_lifter_id = targetId;
      } else if (sCode === 'OWLCMS' && tCode === 'USAW') {
        aliasPayload.owlcms_lifter_id = sourceId;
        aliasPayload.usaw_lifter_id = targetId;
      } else if (sCode === 'IWF' && tCode === 'OWLCMS') {
        aliasPayload.iwf_db_lifter_id = sourceId;
        aliasPayload.owlcms_lifter_id = targetId;
      } else if (sCode === 'OWLCMS' && tCode === 'IWF') {
        aliasPayload.owlcms_lifter_id = sourceId;
        aliasPayload.iwf_db_lifter_id = targetId;
      } else if (sCode === 'IWF' && tCode === 'IWF') {
        aliasPayload.iwf_db_lifter_id = sourceId;
        aliasPayload.iwf_db_lifter_id_2 = targetId;
      } else if (sCode === 'OWLCMS' && tCode === 'OWLCMS') {
        aliasPayload.owlcms_lifter_id = sourceId;
        aliasPayload.owlcms_lifter_id_2 = targetId;
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported federation pairing for athlete_aliases: ${sCode} ↔ ${tCode}` },
          { status: 400 }
        );
      }

      const { error: aliasErr } = await supabaseAdmin
        .from('athlete_aliases')
        .insert(aliasPayload);

      if (aliasErr && aliasErr.code !== '23505') {
        return NextResponse.json(
          { success: false, error: `Failed to insert pairwise alias: ${aliasErr.message}` },
          { status: 500 }
        );
      }

      const { error: updErr } = await supabaseAdmin
        .from('athlete_linking_evaluations')
        .update({
          status: 'MATCHED',
          target_athlete_id: targetId,
          is_blacklisted: false,
          reviewer_notes: resolvedNotes || null,
          evaluated_at: nowIso,
          evidence_breakdown: {
            ...currentEb,
            admin_resolution: {
              action: 'CONFIRM_MATCH',
              resolved_by: user.email || user.id,
              resolved_at: nowIso
            }
          }
        })
        .eq('evaluation_id', Number(evaluationId));

      if (updErr) {
        return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        evaluationId: Number(evaluationId),
        newStatus: 'MATCHED',
        message: `Confirmed cross-federation link (${sCode} #${sourceId} ↔ ${tCode} #${targetId}) in athlete_aliases.`
      });
    }

    if (action === 'REJECT_BLACKLIST') {
      const existingRejected = Array.isArray(currentEb.rejected_candidate_ids)
        ? currentEb.rejected_candidate_ids.map((id: any) => Number(id)).filter(Boolean)
        : [];
      const rejectedSet = new Set<number>(existingRejected);
      if (targetId) rejectedSet.add(targetId);

      const { error: updErr } = await supabaseAdmin
        .from('athlete_linking_evaluations')
        .update({
          status: 'VETTED_ISOLATED',
          is_blacklisted: true,
          reviewer_notes: resolvedNotes || null,
          evaluated_at: nowIso,
          evidence_breakdown: {
            ...currentEb,
            rejected_candidate_ids: Array.from(rejectedSet),
            admin_resolution: {
              action: 'REJECT_BLACKLIST',
              rejected_candidate_id: targetId,
              resolved_by: user.email || user.id,
              resolved_at: nowIso
            }
          }
        })
        .eq('evaluation_id', Number(evaluationId));

      if (updErr) {
        return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        evaluationId: Number(evaluationId),
        newStatus: 'VETTED_ISOLATED',
        message: `Candidate ${tCode} #${targetId} blacklisted for ${sCode} #${sourceId} and task marked VETTED_ISOLATED.`
      });
    }

    if (action === 'DISMISS_ISOLATED') {
      const { error: updErr } = await supabaseAdmin
        .from('athlete_linking_evaluations')
        .update({
          status: 'VETTED_ISOLATED',
          is_blacklisted: false,
          reviewer_notes: resolvedNotes || null,
          evaluated_at: nowIso,
          evidence_breakdown: {
            ...currentEb,
            admin_resolution: {
              action: 'DISMISS_ISOLATED',
              resolved_by: user.email || user.id,
              resolved_at: nowIso
            }
          }
        })
        .eq('evaluation_id', Number(evaluationId));

      if (updErr) {
        return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        evaluationId: Number(evaluationId),
        newStatus: 'VETTED_ISOLATED',
        message: `Task #${evaluationId} dismissed as VETTED_ISOLATED without blacklisting.`
      });
    }

    if (action === 'REOPEN_REVIEW') {
      const { error: updErr } = await supabaseAdmin
        .from('athlete_linking_evaluations')
        .update({
          status: 'REVIEW_NEEDED',
          is_blacklisted: false,
          reviewer_notes: resolvedNotes || null
        })
        .eq('evaluation_id', Number(evaluationId));

      if (updErr) {
        return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        evaluationId: Number(evaluationId),
        newStatus: 'REVIEW_NEEDED',
        message: `Task #${evaluationId} restored to REVIEW_NEEDED.`
      });
    }

    return NextResponse.json({ success: false, error: 'Unhandled action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to execute review action' },
      { status: 500 }
    );
  }
}

