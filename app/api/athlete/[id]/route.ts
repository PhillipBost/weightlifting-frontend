import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { promisify } from 'util';
import zlib from 'zlib';

const gunzip = promisify(zlib.gunzip);

/**
 * Athlete Data Proxy (v3.7 - WINNER-TAKES-ALL)
 * ----------------------------------------
 * Targets sub-500ms by racing shards and using non-blocking async decompression.
 * Injects telemetry headers for performance auditing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  
  let athleteId = decodedId;
  let isNumeric = /^\d+$/.test(decodedId);

  // 1. Slug Resolution (Point Lookup)
  if (!isNumeric && !decodedId.startsWith('u-')) {
    const supabase = await createClient();
    const normalizedName = decodedId.replace(/-/g, ' ');
    const { data } = await supabase
      .from('usaw_lifters')
      .select('membership_number')
      .ilike('athlete_name', normalizedName)
      .limit(1);

    if (data && data.length > 0 && data[0].membership_number) {
      athleteId = data[0].membership_number.toString();
      isNumeric = true;
    }
  }

  const shardId = isNumeric ? athleteId.padStart(2, '0').slice(-2) : '00';
  const baseUrl = 'http://46.62.223.85:8888';

  const urlConfigs = [
    { type: 'USAW', url: `${baseUrl}/usaw/${shardId}/${athleteId}.json.gz` },
    { type: 'IWF', url: `${baseUrl}/iwf/${shardId}/${athleteId}.json.gz` }
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const fetchStart = Date.now();

    // 2. Parallel Binary Streaming (Truly Parallel)
    const requests = urlConfigs.map(async (item) => {
      try {
        const res = await fetch(item.url, { 
          next: { revalidate: 3600 },
          signal: controller.signal 
        });
        
        if (!res.ok) return { type: item.type, ok: false, status: res.status };
        
        const buffer = await res.arrayBuffer();
        return { 
          type: item.type, 
          ok: true, 
          buffer, 
          latency: Date.now() - fetchStart 
        };
      } catch (err) {
        return { type: item.type, ok: false, error: 'Request Failed' };
      }
    });

    const outcomes = await Promise.allSettled(requests);
    clearTimeout(timeoutId);

    let mergedData: any = null;
    const telemetry: any = {};

    // 3. Smart Processing & Merge
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled' && outcome.value.ok && outcome.value.buffer) {
        const decompStart = Date.now();
        try {
          // Asynchronous Decompression (Non-blocking)
          const decompressed = await gunzip(Buffer.from(outcome.value.buffer));
          const shardData = JSON.parse(decompressed.toString());
          
          telemetry[`X-Proxy-${outcome.value.type}-Time`] = `${outcome.value.latency}ms`;
          telemetry[`X-Proxy-${outcome.value.type}-Decompress`] = `${Date.now() - decompStart}ms`;

          if (!mergedData) {
            mergedData = shardData;
          } else {
            // Deduplicate and merge results
            const existingIds = new Set(mergedData.usaw_results?.map((r: any) => r.id) || []);
            const existingIwfIds = new Set(mergedData.iwf_results?.map((r: any) => r.id) || []);

            (shardData.usaw_results || []).forEach((r: any) => {
              if (r.id && !existingIds.has(r.id)) {
                if (!mergedData.usaw_results) mergedData.usaw_results = [];
                mergedData.usaw_results.push(r);
              }
            });

            (shardData.iwf_results || []).forEach((r: any) => {
              if (r.id && !existingIwfIds.has(r.id)) {
                if (!mergedData.iwf_results) mergedData.iwf_results = [];
                mergedData.iwf_results.push(r);
              }
            });

            const existingProfiles = new Set(mergedData.iwf_profiles?.map((p: any) => p.id) || []);
            (shardData.iwf_profiles || []).forEach((p: any) => {
              if (p.id && !existingProfiles.has(p.id)) {
                if (!mergedData.iwf_profiles) mergedData.iwf_profiles = [];
                mergedData.iwf_profiles.push(p);
              }
            });
          }
        } catch (e) {
          console.error(`[DECOMPRESSION ERROR ${outcome.value.type}]:`, e);
        }
      }
    }

    if (mergedData) {
      const response = NextResponse.json(mergedData);
      // Inject Telemetry for browser auditing
      Object.entries(telemetry).forEach(([k, v]) => response.headers.set(k, v as string));
      response.headers.set('X-Proxy-Total-Time', `${Date.now() - startTime}ms`);
      return response;
    }

    return NextResponse.json(
      { error: 'Athlete data not found in Data Factory shards' },
      { status: 404 }
    );

  } catch (error: any) {
    console.error('[API PROXY ERROR]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
