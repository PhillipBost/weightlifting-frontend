import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import zlib from 'zlib';

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

function normalizeDate(rawDate: any): string | null {
  if (!rawDate) return null;
  if (Array.isArray(rawDate) && rawDate.length >= 3) {
    return `${rawDate[0]}-${String(rawDate[1]).padStart(2, '0')}-${String(rawDate[2]).padStart(2, '0')}`;
  }
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  return null;
}

function normalizeAttempt(val: any): number | null {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) || num === 0 ? null : num;
}

function normalizeNumber(val: any): number | null {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

export async function POST(req: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });

    const { fileName, action, parentMeetId } = await req.json();
    if (!fileName || !action) {
      return NextResponse.json({ success: false, error: 'Missing fileName or action' }, { status: 400 });
    }

    const quarantineFilePath = `quarantine/${fileName}`;

    // Download file from quarantine
    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from('owlcms-archives')
      .download(quarantineFilePath);

    if (downloadError || !blob) {
      return NextResponse.json({ success: false, error: 'Quarantined file not found in storage' }, { status: 404 });
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const decompressedString = fileName.endsWith('.gz') ? zlib.gunzipSync(buffer).toString('utf-8') : buffer.toString('utf-8');
    const json = JSON.parse(decompressedString);

    // Extract hash from filename: ${parentMeetId}_${hash}_${originalName}
    const parts = fileName.split('_');
    const fileHash = parts.length >= 3 ? parts[1] : null;

    // OPTION 1: Reject & Delete
    if (action === 'reject_delete') {
      await supabaseAdmin.storage.from('owlcms-archives').remove([quarantineFilePath]);
      return NextResponse.json({
        success: true,
        action: 'reject_delete',
        message: `Quarantined file ${fileName} permanently deleted from storage.`
      });
    }

    // OPTION 2: Reject & Keep (Blocklist Hash)
    if (action === 'reject_keep') {
      const rejectedPath = `rejected/${fileHash || fileName}.json.gz`;
      await supabaseAdmin.storage
        .from('owlcms-archives')
        .upload(rejectedPath, buffer, { contentType: 'application/gzip', upsert: true });

      await supabaseAdmin.storage.from('owlcms-archives').remove([quarantineFilePath]);

      return NextResponse.json({
        success: true,
        action: 'reject_keep',
        message: `Quarantined file archived under rejected/ and hash blocklisted from future imports.`
      });
    }

    const comp = json.competition || {};
    const meetName = (comp.competitionName || comp.name || json.competitionName || fileName).trim();
    const startDate = normalizeDate(comp.competitionDate || comp.localizedCompetitionDate || json.startDate);
    const endDate = normalizeDate(comp.competitionEndDate || comp.competitionDate || json.endDate);
    const city = comp.competitionCity || json.city || null;
    const country = comp.competitionSite || comp.country || json.country || null;
    const organizer = comp.competitionOrganizer || comp.federation || json.organizer || null;
    const formatVersion = (json.formatVersion || json.version || '1.0').toString();

    const athletes = Array.isArray(json.athletes)
      ? json.athletes
      : (Array.isArray(json.competitors) ? json.competitors : []);
    const teams = Array.isArray(json.teams) ? json.teams : [];
    const teamMap = new Map<string, string>();
    for (const t of teams) {
      if (t && t.id !== undefined && t.name) teamMap.set(String(t.id), t.name);
    }

    // OPTION 4: Accept & Enrich (Merge into existing meet without creating duplicate meet row)
    if (action === 'accept_enrich') {
      const targetMeetId = parentMeetId || (parts.length >= 3 && !isNaN(Number(parts[0])) ? Number(parts[0]) : null);
      if (!targetMeetId) {
        return NextResponse.json({ success: false, error: 'Cannot enrich: parent meet ID not found' }, { status: 400 });
      }

      // Fetch existing meet details
      const { data: parentMeet } = await supabaseAdmin
        .from('owlcms_meets')
        .select('meet_id, meet_name, format_version')
        .eq('meet_id', targetMeetId)
        .single();

      // Fetch existing results for parent meet
      const { data: existingResults } = await supabaseAdmin
        .from('owlcms_meet_results')
        .select('result_id, lifter_id, category, raw_payload')
        .eq('meet_id', targetMeetId);

      const lifterIds = Array.from(new Set(existingResults?.map((r) => r.lifter_id).filter(Boolean) || []));

      // Fetch current lifter records to inspect missing fields
      const { data: existingLifters } = await supabaseAdmin
        .from('owlcms_lifters')
        .select('lifter_id, athlete_name, exact_birth_date, birth_year, membership_number, club_name')
        .in('lifter_id', lifterIds);

      const lifterMap = new Map(existingLifters?.map((l) => [l.lifter_id, l]) || []);

      const audit = {
        meet_id: targetMeetId,
        meet_name: parentMeet?.meet_name || meetName,
        parent_format_version: parentMeet?.format_version || '1.0',
        uploaded_format_version: formatVersion,
        lifters_updated: 0,
        results_updated: 0,
        stats: {
          birth_dates_added: 0,
          birth_years_added: 0,
          memberships_added: 0,
          clubs_added: 0,
          categories_updated: 0
        },
        athletes: [] as Array<{
          lifter_id: number;
          athlete_name: string;
          changes: Array<{ field: string; label: string; value: any }>;
        }>
      };

      // Match and enrich only genuinely missing fields
      for (const ath of athletes) {
        const firstName = (ath.firstName || '').trim().toLowerCase();
        const lastName = (ath.lastName || '').trim().toLowerCase();
        const exactBirthDate = normalizeDate(ath.isoBirthDate || ath.fullBirthDate || ath.birthDate);
        const birthYear = exactBirthDate ? parseInt(exactBirthDate.split('-')[0], 10) : (ath.yearOfBirth || ath.birthYear || null);
        const membership = (ath.membership || ath.membershipNumber || '').toString().trim() || null;
        let clubName = ath.club || null;
        if (!clubName && ath.team !== undefined && teamMap.has(String(ath.team))) {
          clubName = teamMap.get(String(ath.team)) || null;
        }

        // Match against existing results
        const matched = existingResults?.find((r) => {
          const raw = r.raw_payload || {};
          const rFirst = (raw.firstName || '').trim().toLowerCase();
          const rLast = (raw.lastName || '').trim().toLowerCase();
          return rFirst === firstName && rLast === lastName;
        });

        if (matched?.lifter_id) {
          const currentLifter = lifterMap.get(matched.lifter_id);
          const updateLifter: Record<string, any> = {};
          const athleteChanges: Array<{ field: string; label: string; value: any }> = [];

          // Only backfill if database record was actually missing the value
          if (!currentLifter?.exact_birth_date && exactBirthDate) {
            updateLifter.exact_birth_date = exactBirthDate;
            athleteChanges.push({ field: 'exact_birth_date', label: 'Exact Birth Date', value: exactBirthDate });
            audit.stats.birth_dates_added++;
          }
          if (!currentLifter?.birth_year && birthYear) {
            updateLifter.birth_year = birthYear;
            athleteChanges.push({ field: 'birth_year', label: 'Birth Year', value: birthYear });
            audit.stats.birth_years_added++;
          }
          if (!currentLifter?.membership_number && membership) {
            updateLifter.membership_number = membership;
            athleteChanges.push({ field: 'membership_number', label: 'Membership #', value: membership });
            audit.stats.memberships_added++;
          }
          if (!currentLifter?.club_name && clubName) {
            updateLifter.club_name = clubName;
            athleteChanges.push({ field: 'club_name', label: 'Club', value: clubName });
            audit.stats.clubs_added++;
          }

          if (Object.keys(updateLifter).length > 0) {
            await supabaseAdmin.from('owlcms_lifters').update(updateLifter).eq('lifter_id', matched.lifter_id);
            audit.lifters_updated++;
            audit.athletes.push({
              lifter_id: matched.lifter_id,
              athlete_name: currentLifter?.athlete_name || `${ath.firstName || ''} ${ath.lastName || ''}`.trim(),
              changes: athleteChanges
            });
          }

          // Enrich results if category was missing
          const category = (ath.categoryCode || ath.categoryName || '').toString().trim();
          if (category && !matched.category) {
            await supabaseAdmin.from('owlcms_meet_results').update({ category }).eq('result_id', matched.result_id);
            audit.results_updated++;
            audit.stats.categories_updated++;
          }
        }
      }

      // Move archive to parent meet folder
      const enrichedArchivePath = `meets/${targetMeetId}/enriched_${Date.now()}_${fileName}`;
      await supabaseAdmin.storage
        .from('owlcms-archives')
        .upload(enrichedArchivePath, buffer, { contentType: 'application/gzip', upsert: true });

      // Clean up from quarantine
      await supabaseAdmin.storage.from('owlcms-archives').remove([quarantineFilePath]);

      const message =
        audit.lifters_updated > 0 || audit.results_updated > 0
          ? `Meet #${targetMeetId} successfully enriched! Backfilled missing details for ${audit.lifters_updated} athletes and ${audit.results_updated} results.`
          : `Meet #${targetMeetId} was already up to date with more complete data (v${audit.parent_format_version}). No missing fields were found in this upload. The file was archived safely.`;

      return NextResponse.json({
        success: true,
        action: 'accept_enrich',
        audit,
        message
      });
    }

    // OPTION 3: Accept & Upload (New Meet)
    if (action === 'accept_upload') {
      // 1. Insert Meet Record
      const { data: newMeet, error: meetError } = await supabaseAdmin
        .from('owlcms_meets')
        .insert({
          meet_name: meetName,
          start_date: startDate,
          end_date: endDate,
          city,
          country,
          organizer,
          format_version: formatVersion,
          source_file_name: fileName,
          uploaded_by: user.id,
          uploader_email: user.email || null,
          raw_payload: json
        })
        .select('meet_id')
        .single();

      if (meetError || !newMeet) {
        return NextResponse.json({ success: false, error: meetError?.message || 'Failed to create meet' }, { status: 500 });
      }

      const newMeetId = newMeet.meet_id;

      // 2. Bulk insert lifters
      const liftersToInsert = athletes.map((ath: any) => {
        const firstName = ath.firstName?.trim() || '';
        const lastName = ath.lastName?.trim() || '';
        const exactBirthDate = normalizeDate(ath.isoBirthDate || ath.fullBirthDate || ath.birthDate);
        const birthYear = exactBirthDate ? parseInt(exactBirthDate.split('-')[0], 10) : (ath.yearOfBirth || ath.birthYear || null);
        let clubName = ath.club || null;
        if (!clubName && ath.team !== undefined && teamMap.has(String(ath.team))) clubName = teamMap.get(String(ath.team)) || null;

        return {
          athlete_name: `${firstName} ${lastName}`.trim() || 'Unknown Athlete',
          first_name: firstName || null,
          last_name: lastName || null,
          gender: ath.gender?.trim().toUpperCase() || null,
          birth_year: birthYear,
          exact_birth_date: exactBirthDate,
          country_code: ath.federationCodes?.trim() || ath.country?.trim() || null,
          club_name: clubName,
          membership_number: (ath.membership || ath.membershipNumber || '').toString().trim() || null,
          raw_payload: ath
        };
      });

      let insertedLifters: Array<{ lifter_id: number }> = [];
      if (liftersToInsert.length > 0) {
        const { data: lData } = await supabaseAdmin.from('owlcms_lifters').insert(liftersToInsert).select('lifter_id');
        insertedLifters = lData || [];
      }

      // 3. Bulk insert results
      const resultsToInsert = athletes.map((ath: any, i: number) => {
        const exactBirthDate = normalizeDate(ath.isoBirthDate || ath.fullBirthDate || ath.birthDate);
        const birthYear = exactBirthDate ? parseInt(exactBirthDate.split('-')[0], 10) : (ath.yearOfBirth || ath.birthYear || null);
        const s1 = normalizeAttempt(ath.snatch1ActualLift ?? ath.snatch1);
        const s2 = normalizeAttempt(ath.snatch2ActualLift ?? ath.snatch2);
        const s3 = normalizeAttempt(ath.snatch3ActualLift ?? ath.snatch3);
        const bestSnatch = [s1, s2, s3].filter((a): a is number => a !== null && a > 0);
        const cj1 = normalizeAttempt(ath.cleanJerk1ActualLift ?? ath.cleanJerk1);
        const cj2 = normalizeAttempt(ath.cleanJerk2ActualLift ?? ath.cleanJerk2);
        const cj3 = normalizeAttempt(ath.cleanJerk3ActualLift ?? ath.cleanJerk3);
        const bestCj = [cj1, cj2, cj3].filter((a): a is number => a !== null && a > 0);
        const snatchVal = bestSnatch.length > 0 ? Math.max(...bestSnatch) : null;
        const cjVal = bestCj.length > 0 ? Math.max(...bestCj) : null;
        let total = normalizeNumber(ath.total);
        if (total === null && snatchVal !== null && cjVal !== null) total = snatchVal + cjVal;

        return {
          meet_id: newMeetId,
          lifter_id: insertedLifters[i]?.lifter_id ?? null,
          gender: ath.gender?.trim().toUpperCase() || null,
          birth_year: birthYear,
          body_weight_kg: normalizeNumber(ath.bodyWeight ?? ath.presumedBodyWeight),
          scale_weight_kg: normalizeNumber(ath.scaleWeight),
          category: (ath.categoryCode || ath.categoryName || ath.category || 'OPEN').toString().trim(),
          session_name: ath.sessionName || ath.sessionPattern || null,
          lot_number: ath.lotNumber ? parseInt(String(ath.lotNumber), 10) : null,
          start_number: ath.startNumber ? parseInt(String(ath.startNumber), 10) : null,
          snatch_1: s1,
          snatch_2: s2,
          snatch_3: s3,
          best_snatch: snatchVal,
          cj_1: cj1,
          cj_2: cj2,
          cj_3: cj3,
          best_cj: cjVal,
          total,
          eligible_for_individual_ranking: ath.eligibleForIndividualRanking !== false,
          raw_payload: ath
        };
      });

      if (resultsToInsert.length > 0) {
        await supabaseAdmin.from('owlcms_meet_results').insert(resultsToInsert);
      }

      // Move storage archive
      const finalArchivePath = `meets/${newMeetId}/${fileName}`;
      await supabaseAdmin.storage
        .from('owlcms-archives')
        .upload(finalArchivePath, buffer, { contentType: 'application/gzip', upsert: true });

      await supabaseAdmin.storage.from('owlcms-archives').remove([quarantineFilePath]);

      return NextResponse.json({
        success: true,
        action: 'accept_upload',
        message: `Meet #${newMeetId} (${meetName}) created with ${resultsToInsert.length} results.`
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
