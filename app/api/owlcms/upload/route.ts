import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import zlib from 'zlib';
import crypto from 'crypto';
import { promisify } from 'util';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const gzipAsync = promisify(zlib.gzip);

function calculateSha256(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function compressPayload(input: string): Promise<Buffer> {
  const buf = Buffer.from(input, 'utf-8');
  return gzipAsync(buf, { level: 6 });
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
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: customHeaders
    }
  });
}

function normalizeDate(rawDate: any): string | null {
  if (!rawDate) return null;
  if (Array.isArray(rawDate) && rawDate.length >= 3) {
    const y = rawDate[0];
    const m = String(rawDate[1]).padStart(2, '0');
    const d = String(rawDate[2]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  }
  return null;
}

function normalizeTimestamp(rawTime: any): string | null {
  if (!rawTime || typeof rawTime !== 'string') return null;
  const parsed = new Date(rawTime.trim());
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
  const overallStartTime = performance.now();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // 1. Dual Authentication Check (API Key or Supabase Admin Session)
    const apiKeyHeader = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const configuredApiKey = process.env.OWLCMS_API_KEY;

    let user: { id: string; email: string | null };

    if (configuredApiKey && apiKeyHeader && apiKeyHeader === configuredApiKey) {
      user = { id: 'owlcms_external_api', email: 'api@owlcms' };
    } else {
      const serverSupabase = await createServerClient();
      const { data: authData, error: userError } = await serverSupabase.auth.getUser();

      if (userError || !authData.user) {
        return NextResponse.json({ success: false, error: 'Unauthorized: Invalid API key or session' }, { status: 401 });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profileError || profile?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
      }

      user = { id: authData.user.id, email: authData.user.email || null };
    }

    // 2. Parse & Validate Payload (Supports both raw OWLCMS JSON and UI wrapper)
    const body = await req.json();
    const isWrapper = body && typeof body === 'object' && 'payload' in body;

    const payload = isWrapper ? body.payload : body;
    const fileName = isWrapper ? body.fileName : (req.headers.get('x-file-name') || 'owlcms_export.json');
    const dryRun = Boolean(isWrapper ? body.dryRun : (req.headers.get('x-dry-run') === 'true' || req.nextUrl.searchParams.get('dryRun') === 'true'));
    const batchMode = Boolean(isWrapper ? body.batchMode : req.headers.get('x-batch-mode') === 'true');
    const explicitParentMeetId = isWrapper ? body.parentMeetId : null;
    const explicitRevisionNotes = isWrapper ? body.revisionNotes : null;
    const forceUpload = Boolean(isWrapper ? body.forceUpload : false);

    if (!payload || typeof payload !== 'object' || (!payload.competition && !payload.athletes && !payload.competitors && !payload.formatVersion && !payload.version)) {
      return NextResponse.json({ success: false, error: 'Invalid or missing OWLCMS JSON payload' }, { status: 400 });
    }

    // Support both modern v2.0+ and legacy/pre-v2 OWLCMS export files
    const rawVersion = payload.formatVersion || payload.version;
    const version = rawVersion ? String(rawVersion) : '1.0';

    const comp = payload.competition || {};
    const athletes = Array.isArray(payload.athletes)
      ? payload.athletes
      : (Array.isArray(payload.competitors) ? payload.competitors : []);
    const teams = Array.isArray(payload.teams) ? payload.teams : [];

    const teamMap = new Map<string, string>();
    for (const t of teams) {
      if (t && t.id !== undefined && t.name) {
        teamMap.set(String(t.id), t.name);
      }
    }

    const meetName = (comp.competitionName || comp.name || payload.competitionName || 'OWLCMS Competition').trim();
    const startDate = normalizeDate(comp.competitionDate || comp.localizedCompetitionDate || payload.startDate);
    const endDate = normalizeDate(comp.competitionEndDate || comp.competitionDate || payload.endDate);
    const city = comp.competitionCity || payload.city || null;
    const country = comp.competitionSite || comp.country || payload.country || null;
    const organizer = comp.competitionOrganizer || comp.federation || payload.organizer || null;

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Step 1 Benchmark: Gzip compression & Hash calculation
    const storageStartTime = performance.now();
    const rawPayloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const rawPayloadHash = calculateSha256(rawPayloadString);
    const compressedBuffer = await compressPayload(rawPayloadString);
    const rawStorageBytes = compressedBuffer.length;
    const rawStorageHash = calculateSha256(compressedBuffer);

    let sanitizedFileName = (fileName || 'export.json').replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!sanitizedFileName.endsWith('.gz')) sanitizedFileName += '.gz';

    let parentMeetId = explicitParentMeetId;
    let revisionNotes = explicitRevisionNotes;
    let isRevision = Boolean(parentMeetId);

    // Pre-flight collision prevention
    if (!forceUpload && !parentMeetId) {
      // Check 1: Exact bitwise hash duplicate
      const { data: exactMatch } = await supabaseAdmin
        .from('owlcms_meets')
        .select('meet_id, meet_name, start_date, created_at')
        .eq('raw_payload_hash', rawPayloadHash)
        .order('meet_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (exactMatch) {
        if (batchMode) {
          // In batch mode, auto-skip exact duplicates cleanly
          return NextResponse.json({
            success: true,
            isExactDuplicate: true,
            skipped: true,
            meet_id: exactMatch.meet_id,
            meet_name: exactMatch.meet_name,
            message: `Exact duplicate of Meet #${exactMatch.meet_id} ("${exactMatch.meet_name}"). Skipped.`
          });
        }
        return NextResponse.json({
          success: false,
          collisionType: 'exact_duplicate',
          error: `This competition was already imported as Meet #${exactMatch.meet_id} ("${exactMatch.meet_name}"). Duplicate upload was prevented.`,
          existingMeet: exactMatch
        }, { status: 409 });
      }

      // Check 1.5: Blocklisted hash check
      try {
        const { data: rejectedFiles } = await supabaseAdmin.storage
          .from('owlcms-archives')
          .list('rejected', { search: rawPayloadHash });
        if (rejectedFiles && rejectedFiles.length > 0) {
          return NextResponse.json({
            success: false,
            collisionType: 'rejected_hash',
            error: `This competition export was previously rejected and blocklisted. Upload prevented.`
          }, { status: 409 });
        }
      } catch {
        // Continue if rejected folder is empty or not yet initialized
      }

      // Check 2: Semantic duplicate (same meet name and start date)
      if (meetName && startDate) {
        const { data: semanticMatch } = await supabaseAdmin
          .from('owlcms_meets')
          .select('meet_id, meet_name, start_date, created_at')
          .ilike('meet_name', meetName)
          .eq('start_date', startDate)
          .order('meet_id', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (semanticMatch) {
          parentMeetId = semanticMatch.meet_id;
          revisionNotes = revisionNotes || `Candidate revision for Meet #${semanticMatch.meet_id}`;
          isRevision = true;

          const storageDurationMs = Math.round(performance.now() - storageStartTime);
          const totalDurationMs = Math.round(performance.now() - overallStartTime);

          // If Dry Run: return simulated quarantine status WITHOUT storage or database writes
          if (dryRun) {
            return NextResponse.json({
              success: true,
              dryRun: true,
              meet_name: meetName,
              start_date: startDate,
              end_date: endDate,
              city,
              country,
              organizer,
              status: 'pending_review',
              parent_meet_id: parentMeetId,
              revision_notes: revisionNotes,
              isRevision: true,
              quarantined: true,
              athletes_found: athletes.length,
              teams_found: teams.length,
              format_version: String(version),
              uploaded_by: user.id,
              uploader_email: user.email || null,
              uploader_ip: clientIp,
              raw_payload_bytes: Buffer.byteLength(rawPayloadString, 'utf-8'),
              compressed_bytes: rawStorageBytes,
              compression_ratio: `${((1 - rawStorageBytes / Buffer.byteLength(rawPayloadString, 'utf-8')) * 100).toFixed(1)}%`,
              raw_payload_hash: rawPayloadHash,
              raw_storage_hash: rawStorageHash,
              timings: {
                compression_and_storage_ms: storageDurationMs,
                bulk_insert_ms: 0,
                total_ms: totalDurationMs
              }
            });
          }

          // Pure Storage Quarantine: Upload to storage bucket ONLY
          const quarantineFileName = `${parentMeetId}_${rawPayloadHash}_${sanitizedFileName}`;
          const quarantinePath = `quarantine/${quarantineFileName}`;

          const { error: qUploadErr } = await supabaseAdmin.storage
            .from('owlcms-archives')
            .upload(quarantinePath, compressedBuffer, {
              contentType: 'application/gzip',
              upsert: true
            });

          if (qUploadErr) {
            console.warn(`[OWLCMS_UPLOAD] Quarantine storage upload error: ${qUploadErr.message}`);
          }

          // Return immediately — ZERO RECORDS WRITTEN TO DATABASE
          return NextResponse.json({
            success: true,
            quarantined: true,
            status: 'pending_review',
            parent_meet_id: parentMeetId,
            meet_name: meetName,
            start_date: startDate,
            end_date: endDate,
            city,
            country,
            isRevision: true,
            format_version: String(version),
            lifters_created: 0,
            lifters_reused: 0,
            total_results_imported: 0,
            raw_storage_path: quarantinePath,
            raw_storage_bytes: rawStorageBytes,
            raw_storage_hash: rawStorageHash,
            raw_payload_hash: rawPayloadHash,
            message: `Collision detected with Meet #${parentMeetId}. Quarantined in storage for admin review; zero records written to database.`,
            timings: {
              compression_and_storage_ms: storageDurationMs,
              bulk_insert_ms: 0,
              total_ms: totalDurationMs
            }
          });
        }
      }
    }

    if (dryRun) {
      const storageDurationMs = Math.round(performance.now() - storageStartTime);
      const totalDurationMs = Math.round(performance.now() - overallStartTime);
      return NextResponse.json({
        success: true,
        dryRun: true,
        meet_name: meetName,
        start_date: startDate,
        end_date: endDate,
        city,
        country,
        organizer,
        status: parentMeetId ? 'pending_review' : 'published',
        parent_meet_id: parentMeetId || null,
        revision_notes: revisionNotes || null,
        isRevision,
        quarantined: Boolean(parentMeetId),
        athletes_found: athletes.length,
        teams_found: teams.length,
        format_version: String(version),
        uploaded_by: user.id,
        uploader_email: user.email || null,
        uploader_ip: clientIp,
        raw_payload_bytes: Buffer.byteLength(rawPayloadString, 'utf-8'),
        compressed_bytes: rawStorageBytes,
        compression_ratio: `${((1 - rawStorageBytes / Buffer.byteLength(rawPayloadString, 'utf-8')) * 100).toFixed(1)}%`,
        raw_payload_hash: rawPayloadHash,
        raw_storage_hash: rawStorageHash,
        timings: {
          compression_and_storage_ms: storageDurationMs,
          bulk_insert_ms: 0,
          total_ms: totalDurationMs
        }
      });
    }

    // Step 2 Benchmark: Database Inserts
    const dbStartTime = performance.now();

    // 3. Insert Meet Record
    const meetInsertData: Record<string, any> = {
      meet_name: meetName,
      start_date: startDate,
      end_date: endDate,
      city,
      country,
      organizer,
      format_version: String(version),
      source_file_name: fileName || 'upload.json',
      uploaded_by: user.id,
      uploader_email: user.email || null,
      uploader_ip: clientIp,
      raw_payload: payload,
      raw_payload_hash: rawPayloadHash,
      status: parentMeetId ? 'pending_review' : 'published',
      parent_meet_id: parentMeetId || null,
      revision_notes: revisionNotes || null
    };

    let { data: meetRecord, error: meetError } = await supabaseAdmin
      .from('owlcms_meets')
      .insert(meetInsertData)
      .select('meet_id')
      .single();

    // Fallback if status/parent_meet_id columns are not yet applied via migration
    if (meetError && (meetError.message.includes('column') || meetError.code === 'PGRST204')) {
      delete meetInsertData.status;
      delete meetInsertData.parent_meet_id;
      delete meetInsertData.revision_notes;
      const fallback = await supabaseAdmin
        .from('owlcms_meets')
        .insert(meetInsertData)
        .select('meet_id')
        .single();
      meetRecord = fallback.data;
      meetError = fallback.error;
    }

    if (meetError || !meetRecord) {
      return NextResponse.json({ success: false, error: `Meet creation failed: ${meetError?.message}` }, { status: 500 });
    }

    const meetId = meetRecord.meet_id;
    const storagePath = `meets/${meetId}/${sanitizedFileName}`;

    // 4. Archive compressed payload to Hetzner Supabase Storage bucket & update meet record
    try {
      const { error: uploadError } = await supabaseAdmin.storage
        .from('owlcms-archives')
        .upload(storagePath, compressedBuffer, {
          contentType: 'application/gzip',
          upsert: true
        });

      if (uploadError) {
        console.warn(`[OWLCMS_UPLOAD] Storage upload warning: ${uploadError.message}`);
      } else {
        console.log(`[OWLCMS_UPLOAD] Archived compressed file: ${storagePath} (${rawStorageBytes} bytes)`);
      }

      await supabaseAdmin
        .from('owlcms_meets')
        .update({
          raw_storage_path: storagePath,
          raw_storage_bytes: rawStorageBytes,
          raw_storage_hash: rawStorageHash
        })
        .eq('meet_id', meetId);
    } catch (archiveErr: any) {
      console.warn(`[OWLCMS_UPLOAD] Archival error: ${archiveErr.message}`);
    }
    const storageDurationMs = Math.round(performance.now() - storageStartTime);

    const isQuarantined = Boolean(parentMeetId);
    let insertedLifters: Array<{ lifter_id: number }> = [];
    let results: any[] = [];
    let liftersCreatedCount = 0;

    // If the meet is quarantined for review, DO NOT insert into lifters or meet_results.
    // The raw data is safely preserved in raw_payload and storage archives for admin curation.
    if (!isQuarantined) {
      // 5. Bulk Insert Lifters for this meet (Single Array Batch)
      const liftersToInsert = athletes.map((ath: any) => {
        const firstName = ath.firstName?.trim() || '';
        const lastName = ath.lastName?.trim() || '';
        const athleteName = `${firstName} ${lastName}`.trim() || 'Unknown Athlete';
        const exactBirthDate = normalizeDate(ath.isoBirthDate || ath.fullBirthDate || ath.birthDate);
        const birthYear = exactBirthDate
          ? parseInt(exactBirthDate.split('-')[0], 10)
          : (ath.yearOfBirth || ath.birthYear || null);

        let clubName = ath.club || null;
        if (!clubName && ath.team !== undefined && teamMap.has(String(ath.team))) {
          clubName = teamMap.get(String(ath.team)) || null;
        }

        const membership = (ath.membership || ath.membershipNumber || '').toString().trim() || null;

        return {
          athlete_name: athleteName,
          first_name: firstName || null,
          last_name: lastName || null,
          gender: ath.gender?.trim().toUpperCase() || null,
          birth_year: birthYear,
          exact_birth_date: exactBirthDate,
          country_code: ath.federationCodes?.trim() || ath.country?.trim() || null,
          club_name: clubName,
          membership_number: membership,
          raw_payload: ath
        };
      });

      if (liftersToInsert.length > 0) {
        const { data: lData, error: lError } = await supabaseAdmin
          .from('owlcms_lifters')
          .insert(liftersToInsert)
          .select('lifter_id');

        if (lError) {
          throw new Error(`Bulk lifters insert error: ${lError.message}`);
        }
        insertedLifters = lData || [];
        liftersCreatedCount = insertedLifters.length;
      }

      function resolveBestLift(provided: any, a1: number | null, a2: number | null, a3: number | null): number | null {
        const norm = normalizeNumber(provided);
        if (norm !== null) return norm;
        const valid = [a1, a2, a3].filter((a): a is number => a !== null && a > 0);
        if (valid.length > 0) return Math.max(...valid);
        const anyAttempt = [a1, a2, a3].some((a) => a !== null && a !== 0);
        return anyAttempt ? 0 : null;
      }

      // 6. Bulk Insert Platform Results (Mapped directly to inserted lifter IDs)
      results = athletes.map((ath: any, i: number) => {
        const exactBirthDate = normalizeDate(ath.isoBirthDate || ath.fullBirthDate || ath.birthDate);
        const birthYear = exactBirthDate
          ? parseInt(exactBirthDate.split('-')[0], 10)
          : (ath.yearOfBirth || ath.birthYear || null);

        const s1 = normalizeAttempt(ath.snatch1ActualLift ?? ath.snatch1);
        const s2 = normalizeAttempt(ath.snatch2ActualLift ?? ath.snatch2);
        const s3 = normalizeAttempt(ath.snatch3ActualLift ?? ath.snatch3);
        const bestSnatch = resolveBestLift(ath.bestSnatch, s1, s2, s3);

        const cj1 = normalizeAttempt(ath.cleanJerk1ActualLift ?? ath.cleanJerk1);
        const cj2 = normalizeAttempt(ath.cleanJerk2ActualLift ?? ath.cleanJerk2);
        const cj3 = normalizeAttempt(ath.cleanJerk3ActualLift ?? ath.cleanJerk3);
        const bestCj = resolveBestLift(ath.bestCleanJerk, cj1, cj2, cj3);

        let total = normalizeNumber(ath.total);
        if (total === null && bestSnatch !== null && bestCj !== null) {
          total = bestSnatch + bestCj;
        }

        const category = (ath.categoryCode || ath.categoryName || ath.category || 'OPEN').toString().trim();
        const sessionName = ath.sessionName || ath.sessionPattern || null;

        return {
          meet_id: meetId,
          lifter_id: insertedLifters[i]?.lifter_id ?? null,
          gender: ath.gender?.trim().toUpperCase() || null,
          birth_year: birthYear,
          body_weight_kg: normalizeNumber(ath.bodyWeight ?? ath.presumedBodyWeight),
          scale_weight_kg: normalizeNumber(ath.scaleWeight),
          category,
          session_name: sessionName,
          lot_number: ath.lotNumber ? parseInt(String(ath.lotNumber), 10) : null,
          start_number: ath.startNumber ? parseInt(String(ath.startNumber), 10) : null,
          snatch_1: s1,
          snatch_2: s2,
          snatch_3: s3,
          best_snatch: bestSnatch,
          snatch_1_time: normalizeTimestamp(ath.snatch1LiftTime),
          snatch_2_time: normalizeTimestamp(ath.snatch2LiftTime),
          snatch_3_time: normalizeTimestamp(ath.snatch3LiftTime),
          cj_1: cj1,
          cj_2: cj2,
          cj_3: cj3,
          best_cj: bestCj,
          cj_1_time: normalizeTimestamp(ath.cleanJerk1LiftTime),
          cj_2_time: normalizeTimestamp(ath.cleanJerk2LiftTime),
          cj_3_time: normalizeTimestamp(ath.cleanJerk3LiftTime),
          total,
          eligible_for_individual_ranking: ath.eligibleForIndividualRanking !== false,
          ranking_status_reason: ath.rankingStatusReason || null,
          participations: Array.isArray(ath.participations) ? ath.participations : [],
          raw_payload: ath
        };
      });

      if (results.length > 0) {
        const { error: rError } = await supabaseAdmin
          .from('owlcms_meet_results')
          .insert(results);

        if (rError) {
          throw new Error(`Bulk results insert error: ${rError.message}`);
        }
      }

      // Trigger backend post-ingestion pipeline runner (non-blocking)
      const pipelineUrl = process.env.OWLCMS_PIPELINE_TRIGGER_URL || process.env.HETZNER_PIPELINE_URL;
      if (pipelineUrl && !isQuarantined && !dryRun && meetId) {
        fetch(pipelineUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'MEET_INGESTED',
            meet_id: meetId,
            timestamp: new Date().toISOString()
          }),
          signal: AbortSignal.timeout(5000)
        }).catch((err: any) => {
          console.warn(`[Pipeline Trigger] Background runner notice failed: ${err?.message || err}`);
        });
      }
    }

    const dbDurationMs = Math.round(performance.now() - dbStartTime);
    const totalDurationMs = Math.round(performance.now() - overallStartTime);

    return NextResponse.json({
      success: true,
      meet_id: meetId,
      meet_name: meetName,
      start_date: startDate,
      end_date: endDate,
      city,
      country,
      status: parentMeetId ? 'pending_review' : 'published',
      parent_meet_id: parentMeetId || null,
      revision_notes: revisionNotes || null,
      isRevision,
      quarantined: isQuarantined,
      format_version: String(version),
      lifters_created: liftersCreatedCount,
      lifters_reused: 0,
      total_results_imported: results.length,
      raw_storage_path: storagePath,
      raw_storage_bytes: rawStorageBytes,
      raw_storage_hash: rawStorageHash,
      raw_payload_hash: rawPayloadHash,
      timings: {
        compression_and_storage_ms: storageDurationMs,
        bulk_insert_ms: dbDurationMs,
        total_ms: totalDurationMs
      }
    });
  } catch (error: any) {
    console.error('Error in POST /api/owlcms/upload:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
