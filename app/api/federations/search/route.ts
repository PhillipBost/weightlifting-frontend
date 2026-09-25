import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FederationMatch } from '@/types/federation';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const asOfDate = searchParams.get('as_of_date')?.trim() || null;

  if (!q) {
    return NextResponse.json({
      success: true,
      query: '',
      as_of_date: asOfDate,
      count: 0,
      matches: []
    });
  }

  try {
    const supabase = getSupabaseAdmin();

    const rpcParams: { query_text: string; as_of_date?: string | null } = {
      query_text: q
    };
    if (asOfDate) {
      rpcParams.as_of_date = asOfDate;
    }

    const { data, error } = await supabase.rpc('search_federations', rpcParams);

    if (error) {
      console.error('[FEDERATION SEARCH RPC ERROR]:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        matches: []
      }, { status: 500 });
    }

    let matches = (data || []) as FederationMatch[];

    // Fallback: If no matches and query contains plural forms like "Carolinas"
    if (matches.length === 0 && q.length >= 3) {
      let fallbackQuery = '';
      if (/carolinas/i.test(q)) {
        fallbackQuery = q.replace(/carolinas/gi, 'Carolina');
      } else if (q.toLowerCase().endsWith('s')) {
        fallbackQuery = q.slice(0, -1);
      }

      if (fallbackQuery && fallbackQuery.trim().length >= 3) {
        const fallbackParams: { query_text: string; as_of_date?: string | null } = {
          query_text: fallbackQuery.trim()
        };
        if (asOfDate) fallbackParams.as_of_date = asOfDate;

        const fallbackRes = await supabase.rpc('search_federations', fallbackParams);
        if (fallbackRes.data && fallbackRes.data.length > 0) {
          matches = fallbackRes.data as FederationMatch[];
        }
      }
    }

    return NextResponse.json({
      success: true,
      query: q,
      as_of_date: asOfDate,
      count: matches.length,
      matches
    });
  } catch (err: any) {
    console.error('[FEDERATION SEARCH ROUTE ERROR]:', err);
    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to search federations',
      matches: []
    }, { status: 500 });
  }
}
