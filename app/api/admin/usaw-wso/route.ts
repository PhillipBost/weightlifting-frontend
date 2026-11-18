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

// Single-run lock so concurrent --mode wso jobs cannot race on usaw_lifters or local log files.
const globalForWsoLock = globalThis as typeof globalThis & {
  __usawWsoActiveRun?: { startedAt: string; userId: string } | null;
};

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

function runSpawnStream({
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
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<{ code: number; stdout: string; stderr: string; aborted: boolean }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
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
      stdout += text;
      onChunk(text);
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf-8');
      stderr += text;
      onChunk(text);
    });

    child.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      reject(err);
    });
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort);
      resolve({ code: code ?? 0, stdout, stderr, aborted });
    });
  });
}

interface WsoSessionSummary {
  processed?: number;
  completed?: number;
  completedWithoutMetadata?: number;
  failed?: number;
  skipped?: number;
  durationMs?: number;
  dryRunActionsCount: number;
}

function parseWsoSessionSummary(logs: string): WsoSessionSummary {
  const matchMetric = (pattern: RegExp): number | undefined => {
    const m = logs.match(pattern);
    return m ? Number(m[1]) : undefined;
  };

  const durationSecondsMatch = logs.match(/Duration:\s*([\d.]+)\s*s\b/i);
  const durationMsMatch = logs.match(/Duration:\s*(\d+)\s*ms\b/i);
  const durationMs = durationMsMatch
    ? Number(durationMsMatch[1])
    : durationSecondsMatch
      ? Math.round(Number(durationSecondsMatch[1]) * 1000)
      : undefined;

  const dryRunMatches = logs.match(/\[DRY RUN\]\s+Would\b/g);

  return {
    processed: matchMetric(/Processed:\s*(\d+)/i),
    completed: matchMetric(/Completed:\s*(\d+)/i),
    completedWithoutMetadata: matchMetric(/Completed\s*\(without metadata\)|completedWithoutMetadata:\s*(\d+)/i),
    failed: matchMetric(/Failed:\s*(\d+)/i),
    skipped: matchMetric(/Skipped:\s*(\d+)/i),
    durationMs,
    dryRunActionsCount: dryRunMatches ? dryRunMatches.length : 0,
  };
}

export async function POST(req: NextRequest) {
  let lockAcquired = false;

  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await serverSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required.' },
        { status: 401 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required.' },
        { status: 403 }
      );
    }

    if (globalForWsoLock.__usawWsoActiveRun) {
      return NextResponse.json(
        {
          success: false,
          error: `A USAW WSO backfill run is already in progress (started ${globalForWsoLock.__usawWsoActiveRun.startedAt}). Wait for it to finish or cancel it before starting another.`,
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const {
      dryRun = true,
      missingMembership = false,
      missingInternalId = false,
      membershipDuplicates = false,
      missingWso = false,
      missingClub = false,
      missingAge = false,
      missingGender = false,
      missingRank = false,
      excludeZeroTotal = false,
      athleteName = '',
      meetIds = '',
      startDate = '',
      endDate = '',
      gender = '',
      maxResults = '25',
      force = false,
      logLevel = 'info',
      delay = '2000',
      timeout = '30000',
      stream = false,
    } = body || {};

    const hasTargetFilter = Boolean(
      missingMembership ||
        missingInternalId ||
        membershipDuplicates ||
        missingWso ||
        missingClub ||
        missingAge ||
        missingGender ||
        missingRank
    );
    const hasScopeLimiter = Boolean(
      String(athleteName).trim() ||
        String(meetIds).trim() ||
        String(startDate).trim() ||
        String(endDate).trim()
    );

    if (!hasTargetFilter && !hasScopeLimiter) {
      return NextResponse.json(
        {
          success: false,
          error: 'Select at least one Target Filter or provide a Scope Limiter (athlete name, meet IDs, or date range).',
        },
        { status: 400 }
      );
    }

    const cliArgs: string[] = ['--mode', 'wso'];

    if (dryRun) cliArgs.push('--dry-run');
    if (missingMembership) cliArgs.push('--missing-membership');
    if (missingInternalId) cliArgs.push('--missing-internal-id');
    if (membershipDuplicates) cliArgs.push('--membership-duplicates');
    if (missingWso) cliArgs.push('--missing-wso');
    if (missingClub) cliArgs.push('--missing-club');
    if (missingAge) cliArgs.push('--missing-age');
    if (missingGender) cliArgs.push('--missing-gender');
    if (missingRank) cliArgs.push('--missing-rank');
    if (excludeZeroTotal) cliArgs.push('--exclude-zero-total');

    const cleanAthleteName = String(athleteName).trim();
    if (cleanAthleteName) cliArgs.push('--athlete-name', cleanAthleteName);

    const cleanMeetIds = String(meetIds)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .join(',');
    if (cleanMeetIds) cliArgs.push('--meet-ids', cleanMeetIds);

    const cleanStartDate = String(startDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStartDate)) cliArgs.push('--start-date', cleanStartDate);

    const cleanEndDate = String(endDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanEndDate)) cliArgs.push('--end-date', cleanEndDate);

    if (gender === 'M' || gender === 'F') cliArgs.push('--gender', gender);

    const parsedMaxResults = Number(maxResults);
    if (Number.isFinite(parsedMaxResults) && parsedMaxResults > 0) {
      cliArgs.push('--max-results', String(Math.floor(parsedMaxResults)));
    }

    if (force) cliArgs.push('--force');

    if (['info', 'debug', 'warn', 'error'].includes(String(logLevel))) {
      cliArgs.push('--log-level', String(logLevel));
    }

    const parsedDelay = Number(delay);
    if (Number.isFinite(parsedDelay) && parsedDelay >= 0) {
      cliArgs.push('--delay', String(Math.floor(parsedDelay)));
    }

    const parsedTimeout = Number(timeout);
    if (Number.isFinite(parsedTimeout) && parsedTimeout >= 1000) {
      cliArgs.push('--timeout', String(Math.floor(parsedTimeout)));
    }

    const repoRoot =
      process.env.WEIGHTLIFTING_DB_REPO_PATH ||
      'C:\\Users\\PB\\Desktop\\Bost Laboratory Services\\Weightlifting\\weightlifting-database';
    const scriptPath = path.join(repoRoot, 'scripts', 'unified-scraper.js');

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    };

    globalForWsoLock.__usawWsoActiveRun = {
      startedAt: new Date().toISOString(),
      userId: user.id,
    };
    lockAcquired = true;

    const wantsStream = stream || req.headers.get('accept')?.includes('text/event-stream');

    if (wantsStream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let closed = false;
          const sendEvent = (event: string, data: unknown) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            } catch {
              closed = true;
            }
          };

          sendEvent('log', {
            chunk: `Command: node scripts/unified-scraper.js ${cliArgs.join(' ')}\n\n`,
          });

          try {
            const { code, stdout, stderr, aborted } = await runSpawnStream({
              scriptPath,
              args: cliArgs,
              cwd: repoRoot,
              env: childEnv,
              onChunk: (text) => sendEvent('log', { chunk: text }),
              signal: req.signal,
            });

            const combinedLogs = `${stdout}\n${stderr}`.trim();
            const summary = parseWsoSessionSummary(combinedLogs);

            if (aborted) {
              sendEvent('done', {
                success: false,
                cancelled: true,
                dryRun: Boolean(dryRun),
                summary,
                error: 'Run cancelled by administrator.',
              });
            } else if (code !== 0) {
              sendEvent('done', {
                success: false,
                exitCode: code,
                dryRun: Boolean(dryRun),
                summary,
                error: `unified-scraper.js exited with code ${code}.`,
              });
            } else {
              sendEvent('done', {
                success: true,
                exitCode: 0,
                dryRun: Boolean(dryRun),
                summary,
              });
            }
          } catch (err: any) {
            sendEvent('error', {
              error: err?.message || 'Failed to execute unified-scraper.js',
            });
          } finally {
            globalForWsoLock.__usawWsoActiveRun = null;
            if (!closed) {
              closed = true;
              controller.close();
            }
          }
        },
        cancel() {
          globalForWsoLock.__usawWsoActiveRun = null;
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const { code, stdout, stderr, aborted } = await runSpawnStream({
      scriptPath,
      args: cliArgs,
      cwd: repoRoot,
      env: childEnv,
      onChunk: () => {},
      signal: req.signal,
    });
    globalForWsoLock.__usawWsoActiveRun = null;
    lockAcquired = false;

    const combinedLogs = `${stdout}\n${stderr}`.trim();
    const summary = parseWsoSessionSummary(combinedLogs);

    return NextResponse.json({
      success: !aborted && code === 0,
      cancelled: aborted,
      exitCode: code,
      dryRun: Boolean(dryRun),
      summary,
      logs: combinedLogs,
    });
  } catch (err: any) {
    if (lockAcquired) {
      globalForWsoLock.__usawWsoActiveRun = null;
    }
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
