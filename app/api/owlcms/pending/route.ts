import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error: userError } = await serverSupabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ success: false, error: 'Admin required' }, { status: 403 });

    // List files in quarantine storage folder
    const { data: qFiles, error: listError } = await supabaseAdmin.storage
      .from('owlcms-archives')
      .list('quarantine', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });

    if (listError) {
      return NextResponse.json({ success: true, meets: [] });
    }

    const validFiles = (qFiles || []).filter((f) => f.name.endsWith('.json.gz') || f.name.endsWith('.json'));

    const parsedMeets = await Promise.all(
      validFiles.map(async (file) => {
        try {
          const filePath = `quarantine/${file.name}`;
          const { data: blob, error: downloadError } = await supabaseAdmin.storage
            .from('owlcms-archives')
            .download(filePath);

          if (downloadError || !blob) {
            return null;
          }

          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const decompressed = file.name.endsWith('.gz') ? zlib.gunzipSync(buffer).toString('utf-8') : buffer.toString('utf-8');
          const json = JSON.parse(decompressed);

          // Extract metadata
          const comp = json.competition || {};
          const meetName = (comp.competitionName || comp.name || json.competitionName || file.name).trim();
          const startDate = normalizeDate(comp.competitionDate || comp.localizedCompetitionDate || json.startDate);
          const endDate = normalizeDate(comp.competitionEndDate || comp.competitionDate || json.endDate);
          const city = comp.competitionCity || json.city || null;
          const country = comp.competitionSite || comp.country || json.country || null;
          const formatVersion = (json.formatVersion || json.version || '1.0').toString();

          const athletes = Array.isArray(json.athletes)
            ? json.athletes
            : (Array.isArray(json.competitors) ? json.competitors : []);

          // Extract parentMeetId and hash from filename format: ${parentMeetId}_${hash}_${originalName}
          const parts = file.name.split('_');
          let parentMeetId: number | null = null;
          let fileHash: string | null = null;
          if (parts.length >= 3 && !isNaN(Number(parts[0]))) {
            parentMeetId = Number(parts[0]);
            fileHash = parts[1];
          }

          // Fetch parent meet comparison if parentMeetId is known
          let parentMeet = null;
          if (parentMeetId) {
            const { data: pData } = await supabaseAdmin
              .from('owlcms_meets')
              .select('meet_id, meet_name, start_date, format_version, created_at')
              .eq('meet_id', parentMeetId)
              .maybeSingle();
            parentMeet = pData;
          }

          return {
            storage_file_name: file.name,
            storage_path: filePath,
            storage_bytes: file.metadata?.size || buffer.byteLength,
            raw_payload_hash: fileHash,
            created_at: file.created_at || new Date().toISOString(),
            meet_name: meetName,
            start_date: startDate,
            end_date: endDate,
            city,
            country,
            format_version: formatVersion,
            athlete_count: athletes.length,
            parent_meet_id: parentMeetId,
            parent_meet: parentMeet,
            athletes_preview: athletes.slice(0, 50).map((a: any) => ({
              name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown Athlete',
              gender: a.gender || null,
              category: a.categoryCode || a.categoryName || null,
              birthYear: a.isoBirthDate ? a.isoBirthDate.split('-')[0] : (a.yearOfBirth || a.birthYear || null)
            }))
          };
        } catch {
          return null;
        }
      })
    );

    const activeMeets = parsedMeets.filter((m) => m !== null);
    return NextResponse.json({ success: true, meets: activeMeets });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
