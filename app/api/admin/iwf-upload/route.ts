import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import path from 'path';
import { detectYearFromIwfUrl, getOfficialIwfMeetUrl } from '@/lib/utils/iwf-urls';

export const maxDuration = 300; // Allow up to 5 minutes for Cloudflare click + Puppeteer scrape + DB import
export const dynamic = 'force-dynamic';

export interface TargetAthleteScorecard {
  athlete_name: string;
  nation?: string;
  birth_year?: number | string;
  division?: string;
  weight_class?: string;
  body_weight_kg?: number | string;
  snatch_1?: string;
  snatch_2?: string;
  snatch_3?: string;
  best_snatch?: string | number;
  cj_1?: string;
  cj_2?: string;
  cj_3?: string;
  best_cj?: string | number;
  total?: string | number;
  rank?: string | number;
  gamx_total?: number | string;
  qpoints?: number | string;
  simulatedAction?: 'UPDATE' | 'INSERT' | 'LOCKED_SKIP' | string;
  existingResultId?: number | string | null;
  hasChanges?: boolean;
  diffFields?: string[];
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

function extractEventId(input?: string | number | null): string {
  if (!input) return '';
  const str = String(input).trim();
  const urlMatch = str.match(/[?&]event_id=(\d+)/i);
  if (urlMatch) return urlMatch[1];
  const numMatch = str.match(/^\d+$/);
  if (numMatch) return numMatch[0];
  const endSlashMatch = str.match(/\/(\d+)\/?$/);
  if (endSlashMatch) return endSlashMatch[1];
  return str;
}

function runSpawnStream({
  scriptPath,
  args,
  cwd,
  env,
  onChunk,
}: {
  scriptPath: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onChunk: (text: string) => void;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env,
      windowsHide: false,
    });

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      stdout += text;
      onChunk(text);
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      stderr += text;
      onChunk(text);
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authenticated administrator session
    const serverSupabase = await createServerClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      year: rawYear,
      event_id,
      url: inputUrl,
      athlete_name,
      force = false,
      dryRun = false,
      stream = false,
    } = body;

    const wantsStream = stream || req.headers.get('accept')?.includes('text/event-stream');
    const eventIdClean = extractEventId(event_id);
    const rawUrl = (typeof inputUrl === 'string' && inputUrl.trim().startsWith('http'))
      ? inputUrl.trim()
      : ((typeof event_id === 'string' && event_id.trim().startsWith('http')) ? event_id.trim() : null);
    const canonicalUrl = rawUrl || (eventIdClean ? getOfficialIwfMeetUrl(eventIdClean, rawYear || new Date().getFullYear()) : null);

    let year = rawYear ? Number(rawYear) : new Date().getFullYear();
    if (!rawYear && event_id) {
      const detectedYear = detectYearFromIwfUrl(String(event_id));
      if (detectedYear) {
        year = detectedYear;
      }
    }

    const repoRoot =
      process.env.WEIGHTLIFTING_DB_REPO_PATH ||
      'C:\\Users\\PB\\Desktop\\Bost Laboratory Services\\Weightlifting\\weightlifting-database';

    const childEnv = {
      ...process.env,
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      IWF_HEADLESS: 'false', // Opens visible Chrome window for 1-click Cloudflare verification
    };

    const mode: 'single_event' | 'full_year' = eventIdClean ? 'single_event' : 'full_year';
    const startTime = Date.now();

    // 2. Initialize RUNNING audit record in public.iwf_pipeline_runs
    let runId: number | null = null;
    try {
      const { data: runRecord, error: insertError } = await supabaseAdmin
        .from('iwf_pipeline_runs')
        .insert({
          mode,
          event_id: eventIdClean || null,
          url: canonicalUrl || rawUrl,
          year,
          athlete_name: athlete_name && String(athlete_name).trim().length > 0 ? String(athlete_name).trim() : null,
          dry_run: Boolean(dryRun),
          force: Boolean(force),
          status: 'RUNNING',
          triggered_by: user.id
        })
        .select('id')
        .single();
      if (insertError) {
        console.error('[IWF_PIPELINE] Initial insert error in iwf_pipeline_runs:', insertError);
      }
      if (runRecord?.id) {
        runId = runRecord.id;
      }
    } catch (insertErr) {
      console.warn('[IWF_PIPELINE] Failed to initialize iwf_pipeline_runs record:', insertErr);
    }

    const recordRunCompletion = async ({
      status,
      exitCode,
      combinedLogs,
      linkerLogs,
      errorMessage,
      importStats
    }: {
      status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
      exitCode?: number;
      combinedLogs?: string;
      linkerLogs?: string;
      errorMessage?: string;
      importStats?: any;
    }) => {
      try {
        const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));
        const meetIdMatch = combinedLogs?.match(/Meet ID:\s*(\d+)/i);
        const resolvedMeetId = importStats?.db_meet_id ?? (meetIdMatch ? Number(meetIdMatch[1]) : null);

        // Sanitize logs for PostgreSQL TEXT storage: strip machine delimiters & null bytes
        const sanitizedLogs = (combinedLogs || '')
          .split('\n')
          .filter((line) => !line.startsWith('__IWF_SUMMARY_JSON__:'))
          .join('\n')
          .replace(/###TARGET_ATHLETE_JSON###[\s\S]*?###END_TARGET_ATHLETE_JSON###\r?\n?/, '')
          .replace(/\u0000/g, '')
          .trim();

        const sanitizedLinkerLogs = (linkerLogs || '').replace(/\u0000/g, '').trim();

        const updatePayload = {
          status,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          exit_code: exitCode ?? (status === 'SUCCESS' ? 0 : 1),
          error_message: errorMessage || null,
          import_stats: importStats || {},
          db_meet_id: resolvedMeetId,
          logs: sanitizedLogs || errorMessage || '',
          linker_logs: sanitizedLinkerLogs || null
        };

        if (runId) {
          const { error: updateError } = await supabaseAdmin
            .from('iwf_pipeline_runs')
            .update(updatePayload)
            .eq('id', runId);

          if (!updateError) return;
          console.error('[IWF_PIPELINE] Update error in recordRunCompletion:', updateError);
        }

        // Fallback: If runId is missing or update failed, execute atomic insert so logs are NEVER lost
        const { error: insertFallbackError } = await supabaseAdmin
          .from('iwf_pipeline_runs')
          .insert({
            mode,
            event_id: eventIdClean || null,
            url: rawUrl,
            year,
            athlete_name: athlete_name && String(athlete_name).trim().length > 0 ? String(athlete_name).trim() : null,
            dry_run: Boolean(dryRun),
            force: Boolean(force),
            triggered_by: user?.id || null,
            ...updatePayload
          });

        if (insertFallbackError) {
          console.error('[IWF_PIPELINE] Fallback insert error in recordRunCompletion:', insertFallbackError);
        }
      } catch (updateErr) {
        console.warn('[IWF_PIPELINE] Failed to update iwf_pipeline_runs completion:', updateErr);
      }
    };

    const assembleExecutionResult = (combinedLogs: string, linkerLogs: string) => {
      const menMatch =
        combinedLogs.match(/(?:Men's athletes|Scraped\s+(\d+)\s+men's results):\s*(\d+)/i) ||
        combinedLogs.match(/Men's athletes:\s*(\d+)/i);
      const womenMatch =
        combinedLogs.match(/(?:Women's athletes|Scraped\s+(\d+)\s+women's results):\s*(\d+)/i) ||
        combinedLogs.match(/Women's athletes:\s*(\d+)/i);
      const importedMatch =
        combinedLogs.match(/Successfully imported:\s*(\d+)/i) ||
        combinedLogs.match(/Results imported:\s*(\d+)/i);
      const updatedMatch = combinedLogs.match(/Results updated:\s*(\d+)/i);
      const skippedMatch =
        combinedLogs.match(/Duplicates skipped:\s*(\d+)/i) ||
        combinedLogs.match(/Results skipped:\s*(\d+)/i);
      const errorsMatch = combinedLogs.match(/Errors:\s+(\d+)/i);
      const totalAthletesMatch = combinedLogs.match(/Total athletes:\s*(\d+)/i);

      const menCount = menMatch ? Number(menMatch[2] || menMatch[1]) : undefined;
      const womenCount = womenMatch ? Number(womenMatch[2] || womenMatch[1]) : undefined;

      const summaryLine = combinedLogs
        .split('\n')
        .find((line) => line.startsWith('__IWF_SUMMARY_JSON__:'));

      let parsedSummary: any = null;
      if (summaryLine) {
        try {
          parsedSummary = JSON.parse(summaryLine.replace('__IWF_SUMMARY_JSON__:', '').trim());
        } catch (parseErr) {
          console.warn('[IWF_PIPELINE] Failed to parse __IWF_SUMMARY_JSON__:', parseErr);
        }
      }

      let taggedTargetAthlete: any = null;
      const targetJsonMatch = combinedLogs.match(/###TARGET_ATHLETE_JSON###([\s\S]*?)###END_TARGET_ATHLETE_JSON###/);
      if (targetJsonMatch) {
        try {
          taggedTargetAthlete = JSON.parse(targetJsonMatch[1].trim());
        } catch (parseErr) {
          console.warn('[IWF_PIPELINE] Failed to parse ###TARGET_ATHLETE_JSON###:', parseErr);
        }
      }

      const cleanLogs = combinedLogs
        .split('\n')
        .filter((line) => !line.startsWith('__IWF_SUMMARY_JSON__:'))
        .join('\n')
        .replace(/###TARGET_ATHLETE_JSON###[\s\S]*?###END_TARGET_ATHLETE_JSON###\r?\n?/, '')
        .trim();

      const matchedScorecards =
        parsedSummary?.importStats?.matchedScorecards ||
        parsedSummary?.importStats?.targetAthletes ||
        (taggedTargetAthlete ? [taggedTargetAthlete] : undefined);

      const liveTotalAthletes =
        parsedSummary?.importStats?.total?.totalAthletes ??
        (totalAthletesMatch ? Number(totalAthletesMatch[1]) : undefined);

      const totalParsed =
        athlete_name && liveTotalAthletes !== undefined
          ? liveTotalAthletes
          : (parsedSummary?.importStats?.meetTotalAthletes ??
             parsedSummary?.importStats?.totalAthletes ??
             (menCount !== undefined || womenCount !== undefined ? (menCount || 0) + (womenCount || 0) : undefined));

      const simulatedScorecards =
        matchedScorecards && matchedScorecards.length > 0
          ? matchedScorecards.length
          : (athlete_name ? (parsedSummary?.importStats?.totalAthletes || 0) : (totalParsed || 0));

      const wouldSkip = Boolean(parsedSummary?.importStats?.wouldSkip);
      const skipReason =
        parsedSummary?.importStats?.skipReason ||
        (wouldSkip ? `Meet already exists in database with ${parsedSummary?.importStats?.existingResults || 'existing'} results. Live execution without --force will perform 0 writes.` : undefined);

      const liveImported =
        parsedSummary?.importStats?.total?.successful ??
        parsedSummary?.importStats?.imported ??
        (importedMatch ? Number(importedMatch[1]) : undefined);

      const liveUpdated =
        parsedSummary?.importStats?.updated ??
        (updatedMatch ? Number(updatedMatch[1]) : undefined);

      const liveSkipped =
        parsedSummary?.importStats?.total?.duplicates ??
        parsedSummary?.importStats?.skipped ??
        (skippedMatch ? Number(skippedMatch[1]) : undefined);

      const liveErrors =
        parsedSummary?.importStats?.total?.errors ??
        parsedSummary?.importStats?.errors ??
        (errorsMatch ? Number(errorsMatch[1]) : undefined);

      // Extract Cross-Federation Alias Linker telemetry
      let usawAliases: number | undefined;
      let owlcmsAliases: number | undefined;
      let shardsRefreshed: number | undefined;

      if (linkerLogs) {
        const isExplicitlyUnchanged =
          /No new links found across federations/i.test(linkerLogs) ||
          /athlete_aliases unchanged/i.test(linkerLogs);

        if (isExplicitlyUnchanged) {
          usawAliases = 0;
          owlcmsAliases = 0;
        } else {
          const usawUpsertMatch = linkerLogs.match(/Successfully upserted\s+(\d+)\s+USAW\s*↔\s*IWF/i);
          const usawParentheticalMatch = linkerLogs.match(/Verified\s+\d+\s+USAW\s*↔\s*IWF\s+roster matches\s*\([^)]*?,\s*(\d+)\s+new\)/i);
          const usawNewMatch = linkerLogs.match(/Verified\s+(\d+)\s+new\s+USAW\s*↔\s*IWF(?:\s+athlete)?\s+aliases/i);
          const usawDryRunMatch = linkerLogs.match(/\[DRY RUN\]\s+Would insert\s+(\d+)\s+USAW\s*↔\s*IWF/i);
          if (usawUpsertMatch) usawAliases = Number(usawUpsertMatch[1]);
          else if (usawParentheticalMatch) usawAliases = Number(usawParentheticalMatch[1]);
          else if (usawNewMatch) usawAliases = Number(usawNewMatch[1]);
          else if (usawDryRunMatch) usawAliases = Number(usawDryRunMatch[1]);

          const owlcmsInsertMatch = linkerLogs.match(/Inserting\s+(\d+)\s+IWF\s*↔\s*OWLCMS/i);
          const owlcmsNewMatch = linkerLogs.match(/(?:Verified|Phase 3 found)\s+(\d+)\s+new\s+IWF\s*↔\s*OWLCMS/i);
          const owlcmsDryRunMatch = linkerLogs.match(/\[DRY RUN\]\s+Would insert\s+(\d+)\s+IWF\s*↔\s*OWLCMS/i);
          if (owlcmsInsertMatch) owlcmsAliases = Number(owlcmsInsertMatch[1]);
          else if (owlcmsNewMatch) owlcmsAliases = Number(owlcmsNewMatch[1]);
          else if (owlcmsDryRunMatch) owlcmsAliases = Number(owlcmsDryRunMatch[1]);
        }

        const shardMatch =
          linkerLogs.match(/Triggering static shard generation for\s+(\d+)\s+linked athlete/i);

        if (shardMatch) shardsRefreshed = Number(shardMatch[1]);
      }

      const totalAliases = (usawAliases || 0) + (owlcmsAliases || 0);
      const linkerStats =
        linkerLogs && (usawAliases !== undefined || owlcmsAliases !== undefined || shardsRefreshed !== undefined)
          ? {
              usawAliasesLinked: usawAliases ?? 0,
              owlcmsAliasesLinked: owlcmsAliases ?? 0,
              totalAliasesLinked: totalAliases,
              shardsRefreshed: shardsRefreshed ?? 0,
            }
          : undefined;

      const mergedStats = {
        ...(parsedSummary?.importStats || {}),
        wouldSkip,
        skipReason,
        existingResults: parsedSummary?.importStats?.existingResults,
        simulatedUpdates: parsedSummary?.importStats?.simulatedUpdates,
        simulatedInserts: parsedSummary?.importStats?.simulatedInserts,
        simulatedLocked: parsedSummary?.importStats?.simulatedLocked,
        targetAthlete: parsedSummary?.importStats?.targetAthlete || taggedTargetAthlete || undefined,
        matchedScorecards,
        simulatedScorecards,
        simulatedLifters: matchedScorecards && matchedScorecards.length > 0 ? 1 : (parsedSummary?.importStats?.newLifters || undefined),
        menCount: parsedSummary?.importStats?.menCount ?? menCount,
        womenCount: parsedSummary?.importStats?.womenCount ?? womenCount,
        totalAthletesParsed: totalParsed,
        imported: liveImported,
        updated: liveUpdated,
        skipped: liveSkipped,
        errors: liveErrors,
        linkerStats: linkerStats || parsedSummary?.importStats?.linkerStats,
      };

      return {
        success: true,
        mode,
        dryRun: Boolean(dryRun),
        event_id: parsedSummary?.iwf_meet_id || eventIdClean || null,
        iwf_meet_id: parsedSummary?.iwf_meet_id || eventIdClean || null,
        year,
        importStats: mergedStats,
        logs: cleanLogs,
        linkerLogs: linkerLogs || undefined,
      };
    };

    if (wantsStream) {
      const encoder = new TextEncoder();
      const streamInstance = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };

          let combinedLogs = '';
          let linkerLogs = '';
          const onChunk = (text: string) => {
            combinedLogs += text;
            const displayChunk = text
              .split('\n')
              .filter((l) => !l.startsWith('__IWF_SUMMARY_JSON__:') && !l.includes('###TARGET_ATHLETE_JSON###') && !l.includes('###END_TARGET_ATHLETE_JSON###'))
              .join('\n');
            if (displayChunk) {
              sendEvent('log', { text: displayChunk });
            }
          };

          try {
            sendEvent('status', { stage: 'START', message: 'Starting IWF ingestion process...' });

            if (eventIdClean) {
              sendEvent('status', { stage: 'EVENT_SCRAPE', message: `Executing targeted importer for Event #${eventIdClean}...` });
              const importerScript = path.join(repoRoot, 'scripts', 'production', 'iwf-database-importer.js');
              const args: string[] = ['--event-id', eventIdClean, '--year', String(year)];
              if (canonicalUrl) {
                args.push('--url', canonicalUrl);
              }
              if (force) args.push('--force');
              if (dryRun) args.push('--dry-run');
              if (athlete_name && String(athlete_name).trim().length > 0) {
                args.push('--athlete-name', String(athlete_name).trim());
              }

              const res = await runSpawnStream({ scriptPath: importerScript, args, cwd: repoRoot, env: childEnv, onChunk });
              if (res.code !== 0) {
                await recordRunCompletion({ status: 'FAILED', exitCode: res.code, combinedLogs, linkerLogs, errorMessage: `Importer script exited with code ${res.code}` });
                sendEvent('error', { error: `Importer script exited with code ${res.code}`, logs: combinedLogs });
                controller.close();
                return;
              }
            } else {
              sendEvent('status', { stage: 'DISCOVERY', message: `Discovering ${year} IWF competitions...` });
              const discoveryScript = path.join(repoRoot, 'scripts', 'production', 'iwf-event-discovery.js');
              const discRes = await runSpawnStream({ scriptPath: discoveryScript, args: ['--year', String(year)], cwd: repoRoot, env: childEnv, onChunk });
              if (discRes.code !== 0) {
                await recordRunCompletion({ status: 'FAILED', exitCode: discRes.code, combinedLogs, linkerLogs, errorMessage: `Discovery script exited with code ${discRes.code}` });
                sendEvent('error', { error: `Discovery script exited with code ${discRes.code}`, logs: combinedLogs });
                controller.close();
                return;
              }

              sendEvent('status', { stage: 'MAIN_IMPORT', message: `Processing ${year} competition results...` });
              const mainScript = path.join(repoRoot, 'scripts', 'production', 'iwf-main.js');
              const mainRes = await runSpawnStream({ scriptPath: mainScript, args: ['--year', String(year)], cwd: repoRoot, env: childEnv, onChunk });
              if (mainRes.code !== 0) {
                await recordRunCompletion({ status: 'FAILED', exitCode: mainRes.code, combinedLogs, linkerLogs, errorMessage: `Main orchestrator script exited with code ${mainRes.code}` });
                sendEvent('error', { error: `Main orchestrator script exited with code ${mainRes.code}`, logs: combinedLogs });
                controller.close();
                return;
              }
            }

            const linkerScript = path.join(repoRoot, 'scripts', 'production', 'link-new-iwf-athletes.js');
            const linkerArgs = dryRun ? ['--days', '3', '--dry-run'] : ['--days', '3'];
            sendEvent('status', {
              stage: 'LINKING',
              message: dryRun
                ? 'Simulating cross-federation athlete alias linker (--dry-run)...'
                : 'Running cross-federation athlete alias linker...'
            });
            await runSpawnStream({
              scriptPath: linkerScript,
              args: linkerArgs,
              cwd: repoRoot,
              env: childEnv,
              onChunk: (text) => {
                linkerLogs += text;
                onChunk(text);
              },
            });

            if (!dryRun) {
              try {
                revalidatePath('/archive');
              } catch (revalErr) {
                console.warn('[IWF_PIPELINE] Cache revalidation warning:', revalErr);
              }
            }

            const finalResult = assembleExecutionResult(combinedLogs, linkerLogs);
            await recordRunCompletion({
              status: 'SUCCESS',
              exitCode: 0,
              combinedLogs,
              linkerLogs,
              importStats: finalResult.importStats
            });
            sendEvent('done', { ...finalResult, runId });
            controller.close();
          } catch (err: any) {
            await recordRunCompletion({
              status: 'FAILED',
              exitCode: 1,
              combinedLogs,
              linkerLogs,
              errorMessage: err?.message || 'IWF pipeline execution failed'
            });
            sendEvent('error', {
              success: false,
              error: err?.message || 'IWF pipeline execution failed',
              logs: combinedLogs,
            });
            controller.close();
          }
        },
      });

      return new Response(streamInstance, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    // Fallback: standard non-streaming execution for background/review callers
    let combinedLogs = '';
    let linkerLogs = '';
    const onChunk = (text: string) => { combinedLogs += text; };

    if (eventIdClean) {
      const importerScript = path.join(repoRoot, 'scripts', 'production', 'iwf-database-importer.js');
      const args: string[] = ['--event-id', eventIdClean, '--year', String(year)];
      if (canonicalUrl) {
        args.push('--url', canonicalUrl);
      }
      if (force) args.push('--force');
      if (dryRun) args.push('--dry-run');
      if (athlete_name && String(athlete_name).trim().length > 0) {
        args.push('--athlete-name', String(athlete_name).trim());
      }
      const res = await runSpawnStream({ scriptPath: importerScript, args, cwd: repoRoot, env: childEnv, onChunk });
      if (res.code !== 0) {
        await recordRunCompletion({ status: 'FAILED', exitCode: res.code, combinedLogs, linkerLogs, errorMessage: `Importer script exited with code ${res.code}` });
        throw new Error(`Importer script exited with code ${res.code}`);
      }
    } else {
      const discoveryScript = path.join(repoRoot, 'scripts', 'production', 'iwf-event-discovery.js');
      const mainScript = path.join(repoRoot, 'scripts', 'production', 'iwf-main.js');
      const discRes = await runSpawnStream({ scriptPath: discoveryScript, args: ['--year', String(year)], cwd: repoRoot, env: childEnv, onChunk });
      if (discRes.code !== 0) {
        await recordRunCompletion({ status: 'FAILED', exitCode: discRes.code, combinedLogs, linkerLogs, errorMessage: `Discovery script exited with code ${discRes.code}` });
        throw new Error(`Discovery script exited with code ${discRes.code}`);
      }
      const mainRes = await runSpawnStream({ scriptPath: mainScript, args: ['--year', String(year)], cwd: repoRoot, env: childEnv, onChunk });
      if (mainRes.code !== 0) {
        await recordRunCompletion({ status: 'FAILED', exitCode: mainRes.code, combinedLogs, linkerLogs, errorMessage: `Main orchestrator script exited with code ${mainRes.code}` });
        throw new Error(`Main orchestrator script exited with code ${mainRes.code}`);
      }
    }

    const linkerScript = path.join(repoRoot, 'scripts', 'production', 'link-new-iwf-athletes.js');
    const linkerArgs = dryRun ? ['--days', '3', '--dry-run'] : ['--days', '3'];
    await runSpawnStream({
      scriptPath: linkerScript,
      args: linkerArgs,
      cwd: repoRoot,
      env: childEnv,
      onChunk: (text) => { linkerLogs += text; onChunk(text); },
    });
    if (!dryRun) {
      try {
        revalidatePath('/archive');
      } catch {}
    }

    const finalResult = assembleExecutionResult(combinedLogs, linkerLogs);
    await recordRunCompletion({
      status: 'SUCCESS',
      exitCode: 0,
      combinedLogs,
      linkerLogs,
      importStats: finalResult.importStats
    });
    return NextResponse.json({ ...finalResult, runId });
  } catch (err: any) {
    const logs = [err?.stdout, err?.stderr, err?.message].filter(Boolean).join('\n');
    await recordRunCompletion({
      status: 'FAILED',
      exitCode: 1,
      combinedLogs: logs,
      errorMessage: err?.message || 'IWF pipeline execution failed'
    });
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'IWF pipeline execution failed',
        logs,
      },
      { status: 500 }
    );
  }
}
