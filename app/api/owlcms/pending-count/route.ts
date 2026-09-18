import { NextResponse } from 'next/server';
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
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: customHeaders
    }
  });
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    let totalCount = 0;

    // 1. Count files in storage quarantine folder
    try {
      const { data: qFiles } = await supabaseAdmin.storage
        .from('owlcms-archives')
        .list('quarantine', { limit: 100 });
      if (qFiles) {
        totalCount += qFiles.filter((f) => f.name.endsWith('.json.gz') || f.name.endsWith('.json')).length;
      }
    } catch {
      // Storage bucket quarantine folder empty
    }

    // 2. Count any staged rows in database
    try {
      const { count } = await supabaseAdmin
        .from('owlcms_meets')
        .select('meet_id', { count: 'exact', head: true })
        .eq('status', 'pending_review');
      if (typeof count === 'number') {
        totalCount += count;
      }
    } catch {
      // Table column not present
    }

    return NextResponse.json({ success: true, count: totalCount });
  } catch {
    return NextResponse.json({ success: true, count: 0 });
  }
}
