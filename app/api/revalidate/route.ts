import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const path = body?.path || searchParams.get('path') || '/archive';
    const secret = body?.secret || searchParams.get('secret') || req.headers.get('x-revalidate-secret') || req.headers.get('x-api-key');

    const configuredApiKey = process.env.OWLCMS_API_KEY;
    const configuredSecret = process.env.REVALIDATION_SECRET || configuredApiKey;

    let isAuthorized = Boolean(configuredSecret && secret && secret === configuredSecret);

    if (!isAuthorized) {
      const serverSupabase = await createServerClient();
      const { data: authData } = await serverSupabase.auth.getUser();

      if (authData?.user) {
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profile?.role === 'admin') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin session or valid secret required.' }, { status: 401 });
    }

    revalidatePath(path);

    return NextResponse.json({
      success: true,
      revalidated: true,
      path,
      timestamp: new Date().toISOString(),
      message: `Successfully revalidated cache for ${path}`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Revalidation failed' }, { status: 500 });
  }
}
