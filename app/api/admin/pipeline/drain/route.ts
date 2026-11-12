import { NextResponse } from 'next/server';
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

// Singleton process lock to prevent overlapping evaluator drains
let activeEvaluatorPromise: Promise<any> | null = null;

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

function runEvaluatorProcess({
  scriptPath,
  args,
  cwd,
  env
}: {
  scriptPath: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env,
      windowsHide: true
    });

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
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

    if (activeEvaluatorPromise) {
      return NextResponse.json(
        { success: false, error: '409 Conflict: Pipeline worker already running' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(1000, Math.max(1, parseInt(String(body.limit || '100'), 10)));
    const dryRun = Boolean(body.dryRun);
    const sourceFed = body.sourceFed ? String(body.sourceFed).trim() : '';
    const targetFed = body.targetFed ? String(body.targetFed).trim() : '';
    const reEvaluate = Boolean(body.reEvaluate);

    const repoRoot =
      process.env.WEIGHTLIFTING_DB_REPO_PATH ||
      'C:\\Users\\PB\\Desktop\\Bost Laboratory Services\\Weightlifting\\weightlifting-database';

    const scriptPath = path.join(repoRoot, 'scripts', 'production', 'run-athlete-linking-evaluator.js');
    const args: string[] = [`--limit=${limit}`];
    if (dryRun) args.push('--dry-run');
    if (sourceFed && sourceFed !== 'ALL') args.push(`--source-fed=${sourceFed}`);
    if (targetFed && targetFed !== 'ALL') args.push(`--target-fed=${targetFed}`);
    if (reEvaluate) args.push('--re-evaluate');

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    };

    const startTime = Date.now();
    activeEvaluatorPromise = runEvaluatorProcess({ scriptPath, args, cwd: repoRoot, env: childEnv });

    let result: { code: number; stdout: string; stderr: string };
    try {
      result = await activeEvaluatorPromise;
    } finally {
      activeEvaluatorPromise = null;
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`.trim();
    const summaryLine = result.stdout
      .split('\n')
      .find((line) => line.startsWith('__ATHLETE_EVALUATOR_SUMMARY_JSON__:'));

    let summary = {
      evaluationsProcessed: 0,
      matchedCount: 0,
      reviewNeededCount: 0,
      isolatedCount: 0,
      isDryRun: dryRun,
      isReEvaluate: reEvaluate,
      executionTimeMs: Date.now() - startTime
    };

    if (summaryLine) {
      try {
        const jsonPart = summaryLine.replace('__ATHLETE_EVALUATOR_SUMMARY_JSON__:', '').trim();
        summary = { ...summary, ...JSON.parse(jsonPart) };
      } catch {
        // Keep fallback summary if JSON parse fails
      }
    }

    const cleanLogs = combinedOutput
      .split('\n')
      .filter((line) => !line.startsWith('__ATHLETE_EVALUATOR_SUMMARY_JSON__:'))
      .join('\n')
      .trim();

    if (result.code !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Evaluator worker exited with code ${result.code}`,
          summary,
          logs: cleanLogs
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      summary,
      logs: cleanLogs
    });
  } catch (err: any) {
    activeEvaluatorPromise = null;
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to execute evaluator worker' },
      { status: 500 }
    );
  }
}

