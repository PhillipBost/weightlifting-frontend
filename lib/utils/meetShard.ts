import { promisify } from 'util';
import zlib from 'zlib';

const gunzip = promisify(zlib.gunzip);

export type MeetShardFederation = 'usaw' | 'iwf' | 'owlcms';

export interface MeetShardResult<T> {
  data: T;
  shardId: string;
}

const DEFAULT_SHARD_BASE_URL = 'http://46.62.223.85:8888';
const SHARD_FETCH_TIMEOUT_MS = 3000;

const NUMERIC_MEET_FIELDS = [
  'latitude',
  'longitude',
  'elevation_meters',
  'results',
  'meet_id',
  'db_meet_id'
] as const;

const NUMERIC_LOCATION_FIELDS = [
  'latitude',
  'longitude',
  'elevation_meters'
] as const;

const NUMERIC_RESULT_FIELDS = [
  'best_snatch',
  'best_cj',
  'total',
  'snatch_lift_1',
  'snatch_lift_2',
  'snatch_lift_3',
  'cj_lift_1',
  'cj_lift_2',
  'cj_lift_3',
  'snatch_1',
  'snatch_2',
  'snatch_3',
  'cj_1',
  'cj_2',
  'cj_3',
  'body_weight_kg',
  'competition_age',
  'birth_year',
  'rank',
  'qpoints',
  'q_youth',
  'q_masters',
  'gamx_total',
  'gamx_s',
  'gamx_j',
  'gamx_u',
  'gamx_a',
  'gamx_masters',
  'gamx_sm',
  'gamx_jm',
  'best_snatch_ytd',
  'best_cj_ytd',
  'best_total_ytd',
  'snatch_successful_attempts',
  'cj_successful_attempts',
  'total_successful_attempts'
] as const;

function coerceNumericFields(record: Record<string, any>, fields: readonly string[]): void {
  for (const field of fields) {
    const val = record[field];
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) {
        record[field] = parsed;
      }
    }
  }
}

/**
 * Node-postgres (`pg`) serializes PostgreSQL `numeric`/`decimal`/`bigint` columns as strings
 * in static shards, whereas PostgREST returns JS numbers. Normalize numeric meet/result fields
 * in-place so UI components can safely call `.toFixed()` and numeric comparisons.
 */
function normalizeMeetShardPayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const obj = payload as Record<string, any>;

  if (obj.meet && typeof obj.meet === 'object') {
    coerceNumericFields(obj.meet, NUMERIC_MEET_FIELDS);
  }
  if (Array.isArray(obj.locations)) {
    for (const loc of obj.locations) {
      if (loc && typeof loc === 'object') {
        coerceNumericFields(loc, NUMERIC_LOCATION_FIELDS);
      }
    }
  }
  if (Array.isArray(obj.results)) {
    for (const row of obj.results) {
      if (row && typeof row === 'object') {
        coerceNumericFields(row, NUMERIC_RESULT_FIELDS);
      }
    }
  }

  return payload;
}

/**
 * Fetch and decompress a static meet shard (.json.gz) from the shard server.
 * Returns null on 404, timeout, network error, or parse failure so the caller
 * can fall back to Supabase.
 */
export async function fetchMeetShard<T = any>(
  federation: MeetShardFederation,
  meetId: string | number
): Promise<MeetShardResult<T> | null> {
  const cleanId = String(meetId).trim();
  if (!cleanId) return null;

  const isNumeric = /^\d+$/.test(cleanId);
  const shardId = isNumeric ? cleanId.padStart(2, '0').slice(-2) : '00';
  const baseUrl = (process.env.SHARD_BASE_URL || DEFAULT_SHARD_BASE_URL).replace(/\/+$/, '');
  const shardUrl = `${baseUrl}/meets/${federation}/${shardId}/${encodeURIComponent(cleanId)}.json.gz`;

  try {
    const res = await fetch(shardUrl, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(SHARD_FETCH_TIMEOUT_MS),
      headers: {
        'Accept-Encoding': 'gzip',
        'Cache-Control': 'no-store'
      }
    });

    if (!res.ok) {
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      return null;
    }

    let decompressed: Buffer;
    if (buffer[0] === 0x7b) {
      decompressed = buffer;
    } else {
      try {
        decompressed = await gunzip(buffer);
      } catch (gzErr) {
        if (buffer.toString('utf8').trim().startsWith('{')) {
          decompressed = buffer;
        } else {
          console.warn(`[MEET SHARD GUNZIP FAILED for ${shardUrl}]:`, gzErr);
          return null;
        }
      }
    }

    const data = normalizeMeetShardPayload(JSON.parse(decompressed.toString('utf8')) as T);
    return { data, shardId };
  } catch (err) {
    console.warn(`[MEET SHARD FETCH FAILED for ${federation}/${cleanId}]:`, err);
    return null;
  }
}
