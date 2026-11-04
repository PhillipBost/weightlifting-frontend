import { createClient as createAdminClient } from '@supabase/supabase-js';

export type TimeRangeKey = 'today' | '24h' | '7d' | '30d' | '90d' | 'year' | 'all';

export interface AnalyticsData {
  stats: {
    pageviews: number;
    visitors: number;
    visits: number;
    bounces: number;
    totalTime: number;
  };
  pageviewsSeries: { x: string; y: number }[];
  urls: { x: string; displayLabel: string; y: number }[];
  countries: { x: string; y: number }[];
  regions: { x: string; country?: string; y: number }[];
  cities: { x: string; country?: string; y: number }[];
  unit: string;
}

const UMAMI_BASE_URL = 'https://analytics.owlanalytics.org';
const SHARE_ID = '9iDyD2wVL7Fgy22h';

const EXCLUDED_PREFIXES = [
  '/rankings',
  '/admin',
  '/upcoming-meets',
  '/data-export',
  '/api'
];

interface CachedToken {
  token: string;
  websiteId: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
const entityLabelCache = new Map<string, string>();

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabasekong-zoss8scsow00wsssgkck0g88.46.62.223.85.sslip.io';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPass = process.env.BASIC_AUTH_PASSWORD;

  const customHeaders: Record<string, string> = {};
  if (basicAuthUser && basicAuthPass) {
    customHeaders['Proxy-Authorization'] = `Basic ${Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64')}`;
  }
  return createAdminClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: customHeaders }
  });
}

async function enrichPathLabel(path: string, supabase: any): Promise<string> {
  if (entityLabelCache.has(path)) {
    return entityLabelCache.get(path)!;
  }

  try {
    // 1. IWF Athlete: /athlete/iwf/:id
    const iwfMatch = path.match(/^\/athlete\/iwf\/(\d+)$/i);
    if (iwfMatch) {
      const id = parseInt(iwfMatch[1], 10);
      const { data } = await supabase
        .from('iwf_lifters')
        .select('athlete_name, country_name, country_code')
        .or(`db_lifter_id.eq.${id},iwf_lifter_id.eq.${id}`)
        .limit(1)
        .maybeSingle();

      if (data?.athlete_name) {
        const country = data.country_name || data.country_code || 'China';
        const label = `${path} (${data.athlete_name}, ${country})`;
        entityLabelCache.set(path, label);
        return label;
      }
    }

    // 2. USAW Athlete: /athlete/:id
    const usawMatch = path.match(/^\/athlete\/([a-zA-Z0-9_-]+)$/i);
    if (usawMatch && !path.startsWith('/athlete/iwf') && !path.startsWith('/athlete/owlcms')) {
      const rawId = usawMatch[1];
      const numericId = parseInt(rawId, 10);
      const filter = isNaN(numericId)
        ? `membership_number.eq.${rawId}`
        : `lifter_id.eq.${numericId},membership_number.eq.${rawId}`;

      const { data } = await supabase
        .from('usaw_lifters')
        .select('athlete_name')
        .or(filter)
        .limit(1)
        .maybeSingle();

      if (data?.athlete_name) {
        const label = `${path} (${data.athlete_name}, USAW)`;
        entityLabelCache.set(path, label);
        return label;
      }
    }

    // 3. Clubs: /club/:slug
    const clubMatch = path.match(/^\/club\/([a-zA-Z0-9_-]+)$/i);
    if (clubMatch) {
      const slug = clubMatch[1];
      const title = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      const label = `${path} (${title})`;
      entityLabelCache.set(path, label);
      return label;
    }

    // 4. WSO: /WSO/:slug
    const wsoMatch = path.match(/^\/WSO\/([a-zA-Z0-9_-]+)$/i);
    if (wsoMatch) {
      const slug = wsoMatch[1];
      const title = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      const label = `${path} (${title} WSO)`;
      entityLabelCache.set(path, label);
      return label;
    }

    if (path === '/') {
      const label = '/ (Home)';
      entityLabelCache.set(path, label);
      return label;
    }
  } catch (err) {
    console.error('Failed to enrich path label for', path, err);
  }

  entityLabelCache.set(path, path);
  return path;
}

async function resolveShareCredentials(): Promise<{ token: string; websiteId: string }> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return { token: cachedToken.token, websiteId: cachedToken.websiteId };
  }

  const shareRes = await fetch(`${UMAMI_BASE_URL}/api/share/${SHARE_ID}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 }
  });

  if (!shareRes.ok) {
    throw new Error(`Failed to resolve Umami share credentials: ${shareRes.status}`);
  }

  const shareData = await shareRes.json();
  const token = shareData.token || SHARE_ID;
  const websiteId = shareData.websiteId || shareData.website?.id;

  if (!websiteId) {
    throw new Error('Website ID not found in share metadata');
  }

  cachedToken = {
    token,
    websiteId,
    expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour in-memory cache
  };

  return { token, websiteId };
}

export async function getVisitorStats(range: TimeRangeKey = '30d'): Promise<AnalyticsData> {
  const { token, websiteId } = await resolveShareCredentials();

  const now = Date.now();
  let startAt = now - 30 * 86400 * 1000;
  let unit = 'day';

  switch (range) {
    case 'today': {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      startAt = startOfToday.getTime();
      unit = 'hour';
      break;
    }
    case '24h':
      startAt = now - 24 * 3600 * 1000;
      unit = 'hour';
      break;
    case '7d':
      startAt = now - 7 * 86400 * 1000;
      unit = 'day';
      break;
    case '30d':
      startAt = now - 30 * 86400 * 1000;
      unit = 'day';
      break;
    case '90d':
      startAt = now - 90 * 86400 * 1000;
      unit = 'day';
      break;
    case 'year': {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      startAt = startOfYear.getTime();
      unit = 'month';
      break;
    }
    case 'all': {
      startAt = new Date(2024, 0, 1).getTime();
      unit = 'month';
      break;
    }
  }

  const queryParams = `startAt=${startAt}&endAt=${now}`;
  const authHeaders = {
    'x-umami-share-token': token,
    'x-umami-share-context': '1',
    Accept: 'application/json'
  };

  const [statsRes, pageviewsRes, pathsRes, countriesRes, regionsRes, citiesRes] = await Promise.all([
    fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}/stats?${queryParams}`, {
      headers: authHeaders,
      next: { revalidate: 60 }
    }),
    fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}/pageviews?${queryParams}&unit=${unit}`, {
      headers: authHeaders,
      next: { revalidate: 60 }
    }),
    fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}/metrics?${queryParams}&type=path&limit=500`, {
      headers: authHeaders,
      next: { revalidate: 60 }
    }),
    fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}/metrics?${queryParams}&type=country&limit=100`, {
      headers: authHeaders,
      next: { revalidate: 60 }
    }),
    fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}/metrics?${queryParams}&type=region&limit=100`, {
      headers: authHeaders,
      next: { revalidate: 60 }
    }),
    fetch(`${UMAMI_BASE_URL}/api/websites/${websiteId}/metrics?${queryParams}&type=city&limit=100`, {
      headers: authHeaders,
      next: { revalidate: 60 }
    })
  ]);

  const stats = statsRes.ok ? await statsRes.json() : null;
  const pageviews = pageviewsRes.ok ? await pageviewsRes.json() : null;
  const rawPaths = pathsRes.ok ? await pathsRes.json() : [];
  const topCountries = countriesRes.ok ? await countriesRes.json() : [];
  const topRegions = regionsRes.ok ? await regionsRes.json() : [];
  const topCities = citiesRes.ok ? await citiesRes.json() : [];

  // Filter out gated and internal routes
  const sanitizedUrls = (rawPaths || []).filter((item: { x: string; y: number }) => {
    const path = (item.x || '').toLowerCase();
    return !EXCLUDED_PREFIXES.some(
      prefix => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')
    );
  });

  // Enrich URLs with athlete names and entity titles
  let supabaseAdmin: any = null;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    console.error('Failed to initialize Supabase admin for visitor analytics enrichment:', err);
  }

  const enrichedUrls = await Promise.all(
    sanitizedUrls.map(async (item: { x: string; y: number }) => {
      const displayLabel = supabaseAdmin
        ? await enrichPathLabel(item.x, supabaseAdmin)
        : item.x;
      return {
        x: item.x,
        displayLabel,
        y: item.y
      };
    })
  );

  return {
    stats: {
      pageviews: typeof stats?.pageviews === 'number' ? stats.pageviews : (stats?.pageviews?.value ?? 0),
      visitors: typeof stats?.visitors === 'number' ? stats.visitors : (stats?.visitors?.value ?? 0),
      visits: typeof stats?.visits === 'number' ? stats.visits : (stats?.visits?.value ?? 0),
      bounces: typeof stats?.bounces === 'number' ? stats.bounces : (stats?.bounces?.value ?? 0),
      totalTime: typeof stats?.totaltime === 'number' ? stats.totaltime : (stats?.totaltime?.value ?? 0)
    },
    pageviewsSeries: Array.isArray(pageviews?.pageviews)
      ? pageviews.pageviews
      : (Array.isArray(pageviews) ? pageviews : []),
    urls: enrichedUrls,
    countries: Array.isArray(topCountries) ? topCountries : (topCountries?.value || []),
    regions: Array.isArray(topRegions) ? topRegions : (topRegions?.value || []),
    cities: Array.isArray(topCities) ? topCities : (topCities?.value || []),
    unit
  };
}
