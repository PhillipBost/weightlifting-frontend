import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import path from 'path';

export const maxDuration = 300;
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
    global: { headers: customHeaders },
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

function buildLinkerArgs(body: Record<string, any>): { args: string[]; error?: string } {
  const {
    scopeType = 'days',
    days = 3,
    event_id,
    year,
    athlete_name,
    federation = 'all',
    dryRun = false,
    reEvaluate = false,
    verbose = false,
  } = body;

  const args: string[] = [];

  switch (scopeType) {
    case 'days': {
      const parsedDays = Math.max(1, Math.min(3650, Number(days) || 3));
      args.push('--days', String(parsedDays));
      break;
    }
    case 'event_id': {
      const cleanId = extractEventId(event_id);
      if (!cleanId) {
        return { args: [], error: 'A valid IWF Event ID or URL is required for event scope.' };
      }
      args.push('--event-id', cleanId);
      break;
    }
    case 'year': {
      const parsedYear = Number(year);
      if (!parsedYear || parsedYear < 1990 || parsedYear > 2100) {
        return { args: [], error: 'A valid 4-digit year is required for year scope.' };
      }
      args.push('--year', String(parsedYear));
      break;
    }
    case 'athlete_name': {
      const trimmed = typeof athlete_name === 'string' ? athlete_name.trim() : '';
      if (!trimmed) {
        return { args: [], error: 'An athlete name is required for athlete scope.' };
      }
      args.push('--athlete-name', trimmed);
      break;
    }
    case 'all': {
      args.push('--all');
      break;
    }
    default:
      return { args: [], error: `Unsupported scopeType: ${String(scopeType)}` };
  }

  const validFederations = new Set(['all', 'usaw', 'owlcms']);
  const fed = validFederations.has(federation) ? federation : 'all';
  args.push('--federation', fed);

  if (dryRun) args.push('--dry-run');
  if (reEvaluate) args.push('--re-evaluate');
  if (verbose) args.push('--verbose');

  return { args };
}

function parseLinkerOutput(rawLogs: string) {
  const lines = rawLogs.split('\n');
  const summaryLine = lines.find((line) => line.startsWith('__IWF_LINKER_SUMMARY_JSON__:'));
  let summary: Record<string, any> | null = null;

  if (summaryLine) {
    try {
      summary = JSON.parse(summaryLine.replace('__IWF_LINKER_SUMMARY_JSON__:', '').trim());
    } catch {
      summary = null;
    }
  }

  const cleanLogs = lines
    .filter((line) => !line.startsWith('__IWF_LINKER_SUMMARY_JSON__:'))
    .join('\n')
    .trim();

  return { summary, cleanLogs };
}

function killChildProcessTree(child: ReturnType<typeof spawn>) {
  try {
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    // ignore process cleanup errors
  }
}

function runLinkerProcess({
  scriptPath,
  args,
  cwd,
  env,
  onChunk,
  signal,
}: {
  scriptPath: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onChunk?: (text: string) => void;
  signal?: AbortSignal;
}): Promise<{ code: number; combinedLogs: string; aborted: boolean }> {
  return new Promise((resolve, reject) => {
    let combinedLogs = '';
    let aborted = Boolean(signal?.aborted);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env,
      windowsHide: true,
    });

    const onAbort = () => {
      aborted = true;
      killChildProcessTree(child);
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      combinedLogs += text;
      onChunk?.(text);
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      combinedLogs += text;
      onChunk?.(text);
    });

    child.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      resolve({ code: code ?? 0, combinedLogs, aborted });
    });
  });
}

/**
 * Runs scripts/production/link-new-iwf-athletes.js independently of meet scraping/importing.
 */
export async function POST(req: NextRequest) {
  try {
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
    const { args, error: argError } = buildLinkerArgs(body);
    if (argError) {
      return NextResponse.json({ success: false, error: argError }, { status: 400 });
    }

    const repoRoot =
      process.env.WEIGHTLIFTING_DB_REPO_PATH ||
      'C:\\Users\\PB\\Desktop\\Bost Laboratory Services\\Weightlifting\\weightlifting-database';
    const linkerScript = path.join(repoRoot, 'scripts', 'production', 'link-new-iwf-athletes.js');

    const childEnv = {
      ...process.env,
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    };

    const scopeType = body?.scopeType || 'days';
    const mode: 'single_event' | 'full_year' = scopeType === 'event_id' ? 'single_event' : 'full_year';
    const eventIdClean = scopeType === 'event_id' ? extractEventId(body?.event_id) : null;
    const parsedYear = scopeType === 'year' && body?.year ? Number(body.year) : null;
    const athleteFilter =
      scopeType === 'athlete_name' && typeof body?.athlete_name === 'string' && body.athlete_name.trim()
        ? body.athlete_name.trim()
        : null;
    const dryRun = Boolean(body?.dryRun);
    const startTime = Date.now();

    let runId: number | null = null;
    try {
      const { data: runRecord, error: insertError } = await supabaseAdmin
        .from('iwf_pipeline_runs')
        .insert({
          mode,
          event_id: eventIdClean || null,
          url: null,
          year: parsedYear,
          athlete_name: athleteFilter,
          dry_run: dryRun,
          force: Boolean(body?.reEvaluate),
          status: 'RUNNING',
          triggered_by: user.id,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[IWF_LINKER] Initial insert error in iwf_pipeline_runs:', insertError);
      } else if (runRecord?.id) {
        runId = runRecord.id;
      }
    } catch (insertErr) {
      console.warn('[IWF_LINKER] Failed to initialize iwf_pipeline_runs record:', insertErr);
    }

    const recordRunCompletion = async ({
      status,
      exitCode,
      cleanLogs,
      summary,
      errorMessage,
    }: {
      status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
      exitCode?: number;
      cleanLogs?: string;
      summary?: Record<string, any> | null;
      errorMessage?: string;
    }) => {
      try {
        const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));
        const sanitizedLogs = (cleanLogs || '').replace(/\u0000/g, '').trim();
        const usawLinked = summary?.newUsawAliasesInserted ?? 0;
        const owlcmsLinked = summary?.owlcmsMatchesFound ?? 0;
        const importStats = {
          standaloneLinker: true,
          targetScope: summary?.targetScope || { type: scopeType, value: body?.[scopeType] ?? body?.days ?? null },
          targetFederation: summary?.targetFederation || body?.federation || 'all',
          isReEvaluate: Boolean(summary?.isReEvaluate ?? body?.reEvaluate),
          meetsEvaluated: summary?.meetsEvaluated ?? 0,
          athletesEvaluated: summary?.athletesEvaluated ?? 0,
          ambiguousStagedToReview: summary?.ambiguousStagedToReview ?? 0,
          linkerStats: {
            usawAliasesLinked: usawLinked,
            owlcmsAliasesLinked: owlcmsLinked,
            totalAliasesLinked: usawLinked + owlcmsLinked,
            shardsRefreshed: 0,
          },
        };

        const updatePayload = {
          status,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          exit_code: exitCode ?? (status === 'SUCCESS' ? 0 : 1),
          error_message: errorMessage || null,
          import_stats: importStats,
          logs: sanitizedLogs || errorMessage || '',
          linker_logs: sanitizedLogs || null,
        };

        if (runId) {
          const { error: updateError } = await supabaseAdmin
            .from('iwf_pipeline_runs')
            .update(updatePayload)
            .eq('id', runId);
          if (!updateError) return;
          console.error('[IWF_LINKER] Update error in recordRunCompletion:', updateError);
        }

        await supabaseAdmin.from('iwf_pipeline_runs').insert({
          mode,
          event_id: eventIdClean || null,
          url: null,
          year: parsedYear,
          athlete_name: athleteFilter,
          dry_run: dryRun,
          force: Boolean(body?.reEvaluate),
          triggered_by: user.id,
          ...updatePayload,
        });
      } catch (err) {
        console.warn('[IWF_LINKER] Failed to persist iwf_pipeline_runs completion:', err);
      }
    };

    const wantsStream = Boolean(body?.stream) || req.headers.get('accept')?.includes('text/event-stream');

    if (!wantsStream) {
      const res = await runLinkerProcess({ scriptPath: linkerScript, args, cwd: repoRoot, env: childEnv });
      const { summary, cleanLogs } = parseLinkerOutput(res.combinedLogs);
      if (res.code !== 0) {
        const errMsg = `Linker exited with code ${res.code}`;
        await recordRunCompletion({ status: 'FAILED', exitCode: res.code, cleanLogs, summary, errorMessage: errMsg });
        return NextResponse.json(
          { success: false, error: errMsg, summary, logs: cleanLogs, runId },
          { status: 500 }
        );
      }
      await recordRunCompletion({ status: 'SUCCESS', exitCode: 0, cleanLogs, summary });
      return NextResponse.json({ success: true, args, summary, logs: cleanLogs, runId });
    }

    const encoder = new TextEncoder();
    const streamInstance = new ReadableStream({
      async start(controller) {
        let streamClosed = false;
        const safeClose = () => {
          if (!streamClosed) {
            streamClosed = true;
            try {
              controller.close();
            } catch {
              // ignore already closed
            }
          }
        };
        const sendEvent = (event: string, data: any) => {
          if (streamClosed || req.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            streamClosed = true;
          }
        };

        try {
          sendEvent('status', {
            stage: 'RUNNING',
            message: `Running link-new-iwf-athletes.js ${args.join(' ')}`,
          });

          const res = await runLinkerProcess({
            scriptPath: linkerScript,
            args,
            cwd: repoRoot,
            env: childEnv,
            signal: req.signal,
            onChunk: (text) => {
              const displayChunk = text
                .split('\n')
                .filter((line) => !line.startsWith('__IWF_LINKER_SUMMARY_JSON__:'))
                .join('\n');
              if (displayChunk) {
                sendEvent('log', { text: displayChunk });
              }
            },
          });

          const { summary, cleanLogs } = parseLinkerOutput(res.combinedLogs);
          if (res.aborted || req.signal.aborted) {
            await recordRunCompletion({ status: 'CANCELLED', exitCode: res.code, cleanLogs, summary, errorMessage: 'Aborted by admin' });
            safeClose();
            return;
          }
          if (res.code !== 0) {
            const errMsg = `Linker exited with code ${res.code}`;
            await recordRunCompletion({ status: 'FAILED', exitCode: res.code, cleanLogs, summary, errorMessage: errMsg });
            sendEvent('error', { error: errMsg, summary, logs: cleanLogs, runId });
            safeClose();
            return;
          }

          await recordRunCompletion({ status: 'SUCCESS', exitCode: 0, cleanLogs, summary });
          sendEvent('done', { success: true, args, summary, logs: cleanLogs, runId });
          safeClose();
        } catch (err: any) {
          const errMsg = req.signal.aborted ? 'Aborted by admin' : (err?.message || 'Unexpected linker execution failure');
          await recordRunCompletion({ status: req.signal.aborted ? 'CANCELLED' : 'FAILED', exitCode: 1, errorMessage: errMsg });
          sendEvent('error', { error: errMsg, runId });
          safeClose();
        }
      },
    });

    return new Response(streamInstance, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to start linker' }, { status: 500 });
  }
}
