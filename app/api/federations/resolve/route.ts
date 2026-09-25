import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  CompetitionScope, 
  FieldResolution, 
  BatchResolveRequest, 
  BatchResolveResponse,
  FederationMatch,
  ContinentRegion,
  CANONICAL_COUNTRY_NAMES,
  COUNTRY_TO_CONTINENT
} from '@/types/federation';

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

const CANADIAN_PROVINCES = new Set([
  'BC', 'AB', 'QC', 'ON', 'MB', 'SK', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'
]);

const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]);

const AUSTRALIAN_STATES = new Set([
  'ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'
]);

interface DemonymMatch {
  country_code: string;
  demonym_term: string;
}

function foldAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchNationalDemonym(name: string): DemonymMatch | null {
  const mCan = name.match(/\b(canadian|canadien|canadienne)\b/i);
  if (mCan) return { country_code: 'CAN', demonym_term: mCan[0] };
  const mUsa = name.match(/\b(american|united states)\b/i);
  if (mUsa) return { country_code: 'USA', demonym_term: mUsa[0] };
  const mCol = name.match(/\b(colombiano|colombiana)\b/i);
  if (mCol) return { country_code: 'COL', demonym_term: mCol[0] };
  const mEcu = name.match(/\b(ecuatoriano|ecuatoriana)\b/i);
  if (mEcu) return { country_code: 'ECU', demonym_term: mEcu[0] };
  const mMex = name.match(/\b(mexicano|mexicana)\b/i);
  if (mMex) return { country_code: 'MEX', demonym_term: mMex[0] };
  const mGbr = name.match(/\b(british)\b/i);
  if (mGbr) return { country_code: 'GBR', demonym_term: mGbr[0] };
  const mAus = name.match(/\b(australian)\b/i);
  if (mAus) return { country_code: 'AUS', demonym_term: mAus[0] };
  const mIta = name.match(/\b(italiano|italiana|italian)\b/i);
  if (mIta) return { country_code: 'ITA', demonym_term: mIta[0] };
  const mEsp = name.match(/\b(español|española|spanish)\b/i);
  if (mEsp) return { country_code: 'ESP', demonym_term: mEsp[0] };
  const mGer = name.match(/\b(deutsch|deutsche|german)\b/i);
  if (mGer) return { country_code: 'GER', demonym_term: mGer[0] };
  const mFra = name.match(/\b(français|française|french)\b/i);
  if (mFra) return { country_code: 'FRA', demonym_term: mFra[0] };
  const mPol = name.match(/\b(polski|polska|polish)\b/i);
  if (mPol) return { country_code: 'POL', demonym_term: mPol[0] };
  const mBra = name.match(/\b(brasileiro|brasileira|brazilian)\b/i);
  if (mBra) return { country_code: 'BRA', demonym_term: mBra[0] };
  const mEgy = name.match(/\b(egyptian|égyptien)\b/i);
  if (mEgy) return { country_code: 'EGY', demonym_term: mEgy[0] };
  const mTur = name.match(/\b(turkish|türk)\b/i);
  if (mTur) return { country_code: 'TUR', demonym_term: mTur[0] };
  const mJpn = name.match(/\b(japanese|japonais)\b/i);
  if (mJpn) return { country_code: 'JPN', demonym_term: mJpn[0] };
  return null;
}

function inferScopeFromFederationLevel(level?: string | null): CompetitionScope {
  if (!level) return 'unknown';
  switch (level) {
    case 'global_international':
    case 'international':
      return 'international';
    case 'continental':
      return 'continental';
    case 'intercontinental_regional':
    case 'regional':
      return 'regional';
    case 'national':
      return 'national';
    case 'regional_state_wso':
      return 'state_provincial';
    case 'club':
    default:
      return 'unknown';
  }
}

interface RegionalFederationDefinition {
  canonical_name: string;
  short_code: string | null;
  level: 'regional' | 'intercontinental_regional';
  title_pattern: RegExp;
  member_countries: string[];
}

const REGIONAL_FEDERATION_MEMBERS: RegionalFederationDefinition[] = [
  {
    canonical_name: 'Nordic Weightlifting Federation',
    short_code: 'NWF',
    level: 'regional',
    title_pattern: /\b(nordic|nordique)\b/i,
    member_countries: ['SWE', 'NOR', 'FIN', 'DEN', 'ISL']
  },
  {
    canonical_name: 'Visegrad Four Weightlifting Federation',
    short_code: 'V4WF',
    level: 'regional',
    title_pattern: /\b(visegrad|v4)\b/i,
    member_countries: ['POL', 'CZE', 'SVK', 'HUN']
  },
  {
    canonical_name: 'South American Weightlifting Confederation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(sudamericano|south american|consudatle|cslp)\b/i,
    member_countries: ['BRA', 'ARG', 'COL', 'ECU', 'PER', 'CHI', 'VEN', 'URU', 'PAR', 'BOL', 'GUY', 'SUR', 'PAN', 'ABW']
  },
  {
    canonical_name: 'Central American and Caribbean Weightlifting Confederation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(central american|centroamerican[oa]s?|caribbean|caribe|cac games|juegos centroamericanos)\b/i,
    member_countries: ['MEX', 'CUB', 'DOM', 'PUR', 'COL', 'VEN', 'PAN', 'CRC', 'GUA', 'HON', 'ESA', 'NCA', 'JAM', 'TTO', 'BAR', 'ARU', 'CUW', 'HAI']
  },
  {
    canonical_name: 'North American Weightlifting Committee',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(north american)\b/i,
    member_countries: ['USA', 'CAN', 'MEX']
  },
  {
    canonical_name: 'Small States of Europe Weightlifting Commission',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(small states of europe|petits etats)\b/i,
    member_countries: ['AND', 'CYP', 'ISL', 'LIE', 'LUX', 'MLT', 'MCO', 'MNE', 'SMR']
  },
  {
    canonical_name: 'East Asian Weightlifting Federation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(east asian|asie de l'est)\b/i,
    member_countries: ['CHN', 'JPN', 'KOR', 'PRK', 'TPE', 'HKG', 'MGL', 'MAC']
  },
  {
    canonical_name: 'South Asian Weightlifting Federation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(south asian|asie du sud)\b/i,
    member_countries: ['IND', 'PAK', 'BAN', 'SRI', 'NEP', 'BHU', 'MDV', 'AFG']
  },
  {
    canonical_name: 'Southeast Asian Weightlifting Federation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(southeast asian|sea games|asean)\b/i,
    member_countries: ['THA', 'VIE', 'INA', 'MAS', 'PHI', 'SGP', 'MYA', 'CAM', 'LAO', 'BRU', 'TLS']
  },
  {
    canonical_name: 'West Asian Weightlifting Federation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(west asian|asie de l'ouest)\b/i,
    member_countries: ['KSA', 'IRQ', 'JOR', 'SYR', 'LBN', 'PLE', 'OMA', 'YEM', 'BHR', 'UAE', 'QAT', 'KUW', 'IRI']
  },
  {
    canonical_name: 'Central Asian Weightlifting Federation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(central asian|asie centrale)\b/i,
    member_countries: ['KAZ', 'UZB', 'TKM', 'KGZ', 'TJK', 'AFG', 'IRI']
  },
  {
    canonical_name: 'Pacific Islands Weightlifting Federation',
    short_code: null,
    level: 'regional',
    title_pattern: /\b(pacific islands|pacific games|oceania regional)\b/i,
    member_countries: ['FIJ', 'SAM', 'NRU', 'PNG', 'TUV', 'KIR', 'VAN', 'SOL', 'COK', 'GUM', 'ASA', 'PLW', 'FSM', 'MSH', 'NCL', 'TAH', 'NIU', 'WLF', 'NFK']
  },
  {
    canonical_name: 'Arabic Weightlifting Federation',
    short_code: null,
    level: 'intercontinental_regional',
    title_pattern: /\b(arab|arabe|championnat arabe|arab championships)\b/i,
    member_countries: ['KSA', 'EGY', 'IRQ', 'JOR', 'UAE', 'QAT', 'BHR', 'KUW', 'OMA', 'YEM', 'LBN', 'SYR', 'PLE', 'TUN', 'DZA', 'MAR', 'LBY', 'SUD', 'SOM', 'DJI', 'MRT', 'COM']
  },
  {
    canonical_name: 'Mediterranean Weightlifting Federation',
    short_code: 'MWF',
    level: 'intercontinental_regional',
    title_pattern: /\b(mediterranean|méditerranéen|jeux méditerranéens)\b/i,
    member_countries: ['ITA', 'ESP', 'FRA', 'GRE', 'TUR', 'EGY', 'CRO', 'SLO', 'SRB', 'BIH', 'MNE', 'ALB', 'MKD', 'CYP', 'MLT', 'LBN', 'SYR', 'TUN', 'DZA', 'MAR', 'LBY', 'SMR', 'MCO', 'POR', 'AND']
  },
  {
    canonical_name: 'Commonwealth Weightlifting Federation',
    short_code: 'CWF',
    level: 'intercontinental_regional',
    title_pattern: /\b(commonwealth)\b/i,
    member_countries: ['GBR', 'AUS', 'CAN', 'NZL', 'IND', 'NGR', 'JAM', 'SAM', 'FIJ', 'PNG', 'NRU', 'GHA', 'KEN', 'MAS', 'SGP', 'CYP', 'MLT', 'PAK', 'BAN', 'SRI', 'RSA', 'UGA', 'CMR', 'TUV', 'KIR', 'VAN', 'SOL', 'BAR', 'TTO', 'GUY']
  }
];

interface ContinentalFederationDefinition {
  canonical_name: string;
  short_code: string;
  continent: ContinentRegion;
  title_pattern: RegExp;
}

const CONTINENTAL_FEDERATIONS: ContinentalFederationDefinition[] = [
  {
    canonical_name: 'Pan American Weightlifting Federation',
    short_code: 'PAWF',
    continent: 'americas',
    title_pattern: /\b(pan[- ]?americans?|panamerican[oa]s?|pan[- ]?américains?|pan[- ]?américaines?|americas|américas|amérique|fplp|pawf)\b/i
  },
  {
    canonical_name: 'European Weightlifting Federation',
    short_code: 'EWF',
    continent: 'europe',
    title_pattern: /\b(europeans?|européens?|européennes?|europeos?|europeas?|europe|europa|ewf)\b/i
  },
  {
    canonical_name: 'Asian Weightlifting Federation',
    short_code: 'AWF',
    continent: 'asia',
    title_pattern: /\b(asians?|asiatiques?|asiáticos?|asiáticas?|asia|asie)\b/i
  },
  {
    canonical_name: 'Weightlifting Federation of Africa',
    short_code: 'WFA',
    continent: 'africa',
    title_pattern: /\b(africans?|africains?|africaines?|africanos?|africanas?|africa|afrique|wfa|cah)\b/i
  },
  {
    canonical_name: 'Oceania Weightlifting Federation',
    short_code: 'OWF',
    continent: 'oceania',
    title_pattern: /\b(oceania|océanie|oceanians?|owf)\b/i
  }
];

interface GlobalApexFederationDefinition {
  canonical_name: string;
  short_code: string;
  title_pattern: RegExp;
}

const GLOBAL_APEX_FEDERATIONS: GlobalApexFederationDefinition[] = [
  {
    canonical_name: 'International Weightlifting Federation',
    short_code: 'IWF',
    title_pattern: /\b(iwf|world championship|world championships|championnat du monde|championnats du monde|campeonato mundial|campeonatos mundiales|coupe du monde|copa del mundo|iwf world cup|iwf grand prix|olympic|olympics|olympique|olympiques|olímpico|olímpicos)\b/i
  },
  {
    canonical_name: 'United Masters Weightlifting Federation',
    short_code: 'UMWF',
    title_pattern: /\b(umwf)\b/i
  },
  {
    canonical_name: 'International Masters Weightlifting Association',
    short_code: 'IMWA',
    title_pattern: /\b(imwa)\b/i
  }
];

async function resolveField(
  supabase: any,
  queryText: string | null | undefined,
  asOfDate: string | null | undefined
): Promise<FieldResolution> {
  const trimmed = queryText?.trim();
  if (!trimmed) {
    return {
      status: 'missing_in_source',
      raw_input: null,
      match: null,
      candidates: [],
      confidence_tier: null,
      match_rank: null
    };
  }

  try {
    const { data, error } = await supabase.rpc('search_federations', {
      query_text: trimmed,
      as_of_date: asOfDate || null
    });

    if (error || !data || data.length === 0) {
      return {
        status: 'no_match',
        raw_input: trimmed,
        match: null,
        candidates: [],
        confidence_tier: null,
        match_rank: null
      };
    }

    const matches = data as FederationMatch[];
    const topRank = matches[0]?.match_rank ?? 0;

    if (topRank < 60) {
      return {
        status: 'no_match',
        raw_input: trimmed,
        match: null,
        candidates: matches,
        confidence_tier: null,
        match_rank: topRank
      };
    }

    // Check for tie at top rank
    const tiedAtTop = matches.filter((m) => m.match_rank === topRank);
    if (tiedAtTop.length > 1) {
      return {
        status: 'ambiguous',
        raw_input: trimmed,
        match: null,
        candidates: tiedAtTop,
        confidence_tier: topRank >= 90 ? 'exact' : 'substring',
        match_rank: topRank,
        note: `${tiedAtTop.length} federations tied at rank ${topRank}`
      };
    }

    // Unique match
    const topMatch = matches[0];
    const confidenceTier = topRank >= 90 ? 'exact' : 'substring';

    return {
      status: 'unique',
      raw_input: trimmed,
      match: topMatch,
      candidates: [topMatch],
      confidence_tier: confidenceTier,
      match_rank: topRank
    };
  } catch (err: any) {
    return {
      status: 'no_match',
      raw_input: trimmed,
      match: null,
      candidates: [],
      confidence_tier: null,
      match_rank: null,
      note: err.message
    };
  }
}

interface LocationLookupResult {
  country_code: string;
  country_name: string;
  state?: string | null;
  resolved_query: string;
}

const ISO2_TO_ISO3: Record<string, string> = {
  CA: 'CAN', US: 'USA', ZA: 'ZAF', EC: 'ECU', GB: 'GBR', FR: 'FRA',
  DE: 'GER', IT: 'ITA', ES: 'ESP', AU: 'AUS', NZ: 'NZL', MEX: 'MEX',
  BR: 'BRA', CO: 'COL', AR: 'ARG', CL: 'CHI', PE: 'PER', GT: 'GUA',
  CU: 'CUB', DO: 'DOM', CR: 'CRC', PA: 'PAN', SE: 'SWE', NO: 'NOR',
  FI: 'FIN', DK: 'DEN', PL: 'POL', UA: 'UKR', TR: 'TUR', EG: 'EGY',
  NG: 'NGR', GH: 'GHA', JP: 'JPN', KR: 'KOR', CN: 'CHN', TW: 'TPE',
  IN: 'IND', TH: 'THA', ID: 'INA', PH: 'PHI', UZ: 'UZB', KZ: 'KAZ',
  GE: 'GEO', AM: 'ARM', AZ: 'AZE', RO: 'ROU', BG: 'BUL', HU: 'HUN',
  AT: 'AUT', CH: 'SUI', BE: 'BEL', NL: 'NED', IE: 'IRL', PT: 'POR',
  SA: 'KSA', QA: 'QAT', AE: 'UAE', KW: 'KUW', BH: 'BRN', OM: 'OMA',
  JO: 'JOR', LB: 'LBN', IQ: 'IRQ', IR: 'IRI', AF: 'AFG', PK: 'PAK',
  DZ: 'ALG', MA: 'MAR', TN: 'TUN', LY: 'LBA', YE: 'YEM', SY: 'SYR',
  SD: 'SUD', SG: 'SGP', MY: 'MAS', VN: 'VIE', IL: 'ISR', IS: 'ISL'
};

function extractDirectCountryCode(
  text?: string | null
): { country_code: string; country_name: string; source: string } | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Check for 3-letter uppercase IOC/ISO-3 tokens (e.g. "Riyadh, KSA" -> "KSA")
  const tokens = trimmed.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (upper.length === 3 && CANONICAL_COUNTRY_NAMES[upper]) {
      return {
        country_code: upper,
        country_name: CANONICAL_COUNTRY_NAMES[upper],
        source: upper
      };
    }
  }

  // 2. Check for full sovereign country names in CANONICAL_COUNTRY_NAMES (e.g. "Saudi Arabia", "Canada")
  const foldedText = foldAccents(trimmed);
  for (const [code, name] of Object.entries(CANONICAL_COUNTRY_NAMES)) {
    const foldedName = foldAccents(name);
    const regex = new RegExp(`\\b${foldedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(foldedText)) {
      return {
        country_code: code,
        country_name: name,
        source: trimmed
      };
    }
  }

  return null;
}

async function lookupLocationCountry(
  venue?: string | null,
  city?: string | null,
  countryText?: string | null
): Promise<LocationLookupResult | null> {
  const queries: string[] = [];
  const v = (venue || '').trim();
  const c = (city || '').trim();
  const ct = (countryText || '').trim();

  // Composite venue + city query is the highest accuracy POI search
  if (v && c) queries.push(`${v}, ${c}`);
  // If venue has multiple comma-separated segments (e.g. street + building/facility name),
  // try the primary street/venue segment with city
  if (v && c && v.includes(',')) {
    const segments = v.split(',').map((s) => s.trim()).filter(Boolean);
    if (segments.length >= 2) {
      queries.push(`${segments[0]} ${segments[1]}, ${c}`);
      queries.push(`${segments[0]}, ${c}`);
    }
  }
  // When city is provided, query city with countryText or city alone. Never discard city!
  if (c && ct) queries.push(`${c}, ${ct}`);
  if (c) queries.push(c);
  // When no city is provided, check if venue contains address segments (commas or " - ")
  if (v && !c) {
    if (v.includes(',') || v.includes(' - ')) {
      const hyphenParts = v.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);
      if (hyphenParts.length >= 2) {
        queries.push(hyphenParts.slice(1).join(', '));
      }
      const commaParts = v.split(',').map((s) => s.trim()).filter(Boolean);
      if (commaParts.length >= 2) {
        queries.push(commaParts.slice(1).join(', '));
        queries.push(commaParts.slice(-2).join(', '));
        if (commaParts.length >= 3) {
          queries.push(commaParts.slice(-3).join(', '));
        }
      }
    }
    queries.push(v);
  }

  const seen = new Set<string>();
  const uniqueQueries = queries.filter((q) => {
    if (seen.has(q.toLowerCase())) return false;
    seen.add(q.toLowerCase());
    return true;
  });

  for (const q of uniqueQueries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=3`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      const features = data?.features || [];
      for (const feat of features) {
        const cCode2 = feat?.properties?.countrycode?.toUpperCase();
        if (!cCode2) continue;
        const iso3 = ISO2_TO_ISO3[cCode2] || (cCode2.length === 3 ? cCode2 : null);
        if (!iso3) continue;

        // Anti-Forcing & Registry Validation:
        // Must match a recognized sovereign nation in CANONICAL_COUNTRY_NAMES
        const canonicalName = CANONICAL_COUNTRY_NAMES[iso3];
        if (canonicalName) {
          return {
            country_code: iso3,
            country_name: canonicalName,
            state: feat?.properties?.state || null,
            resolved_query: q
          };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findPredominantCountry(codes: string[]): string | null {
  if (!codes || codes.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const c of codes) {
    const norm = String(c || '').trim().toUpperCase();
    if (norm.length >= 2) {
      counts[norm] = (counts[norm] || 0) + 1;
    }
  }
  let maxCount = 0;
  let topCode: string | null = null;
  for (const [code, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      topCode = code;
    }
  }
  if (topCode && (maxCount / codes.length) >= 0.5) {
    return topCode;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body: BatchResolveRequest = await req.json();
    const supabase = getSupabaseAdmin();
    const date = body.competition_date || null;

    const organizerPromise = resolveField(supabase, body.organizer_text, date);
    // When federation_text is missing in source, fallback to organizer_text per importer precedence
    const effectiveFedText = body.federation_text?.trim() || body.organizer_text?.trim() || null;
    const federationPromise = resolveField(supabase, effectiveFedText, date);
    const hostCountryPromise = body.host_country_text ? resolveField(supabase, body.host_country_text, date) : Promise.resolve(null);

    // Deduplicate record federations by value first
    const rawRecordFeds = Array.isArray(body.record_federations) ? body.record_federations : [];
    const uniqueRecordFeds = Array.from(new Set(rawRecordFeds.map((r) => String(r || '').trim()).filter(Boolean)));

    const recordFedPromises = uniqueRecordFeds.map(async (fedStr) => {
      const res = await resolveField(supabase, fedStr, date);
      return [fedStr, res] as const;
    });

    const [organizerRes, federationRes, initialHostCountryRes, recordFedEntries] = await Promise.all([
      organizerPromise,
      federationPromise,
      hostCountryPromise,
      Promise.all(recordFedPromises)
    ]);

    const recordFederationsMap: Record<string, FieldResolution> = {};
    for (const [key, val] of recordFedEntries) {
      recordFederationsMap[key] = val;
    }

    // Demonym and championship keyword extraction from competition name & delegation analysis
    const compName = (body.competition_name || '').trim();
    const isChampionship = /\b(championship|championships|championnat|championnats|campeonato|campeonatos|nationals|nationaux)\b/i.test(compName);
    const demonymMatch = compName ? matchNationalDemonym(compName) : null;
    const isGenericNational = /\b(national|nationaux)\b/i.test(compName);

    const rawTeams = Array.isArray(body.team_names) ? body.team_names : [];
    const candidateTeamCountries = Array.from(new Set(
      rawTeams.map(t => String(t || '').trim().toUpperCase()).filter(t => Boolean(COUNTRY_TO_CONTINENT[t]))
    ));

    const rawAthleteCountries = Array.isArray(body.athlete_countries) ? body.athlete_countries : [];
    const athleteCountryCodes = Array.from(new Set(
      rawAthleteCountries
        .map((c: any) => String(c || '').trim().toUpperCase())
        .filter((c: any) => Boolean(CANONICAL_COUNTRY_NAMES[c]))
    ));

    // Programmatic Multi-National Corroboration:
    // 1. If athlete nationalities are present and all belong to a single sovereign nation, 
    //    isolated 3-letter team strings are domestic club/regional acronyms, NOT foreign sovereign delegations.
    // 2. If athlete nationalities are multi-national, team codes must match competitor nationalities.
    // 3. If athlete nationalities are absent, team codes must comprise a coherent majority (>= 50%) of all teams.
    const teamCountryRatio = rawTeams.length > 0 ? candidateTeamCountries.length / rawTeams.length : 0;
    const isDomesticByCompetitors = athleteCountryCodes.length === 1;

    const unambiguousCountryCodes = isDomesticByCompetitors
      ? []
      : athleteCountryCodes.length >= 2
        ? candidateTeamCountries.filter(c => athleteCountryCodes.includes(c))
        : (teamCountryRatio >= 0.5 || rawTeams.length <= 3 ? candidateTeamCountries : []);

    const representedContinents = new Set(
      unambiguousCountryCodes.map(c => COUNTRY_TO_CONTINENT[c]).filter(Boolean)
    );
    const isMultiContinental = representedContinents.size >= 2;
    const isMultiNational = unambiguousCountryCodes.length >= 2;

    const matchedCanProvinces = rawTeams.map(t => String(t || '').trim().toUpperCase()).filter(t => CANADIAN_PROVINCES.has(t));
    const matchedUsStates = rawTeams.map(t => String(t || '').trim().toUpperCase()).filter(t => US_STATES.has(t));
    const matchedAusStates = rawTeams.map(t => String(t || '').trim().toUpperCase()).filter(t => AUSTRALIAN_STATES.has(t));
    const hasCanadianProvincialDelegations = matchedCanProvinces.length >= 2;
    const hasUsStateDelegations = matchedUsStates.length >= 2;
    const hasAusStateDelegations = matchedAusStates.length >= 2;

    // Host country resolution:
    // 1. Direct registry match (from body.host_country_text)
    // 2. Unambiguous country from resolved governing federation / organizer
    // 3. National championship title demonym / meet name
    // 4. Predominant athlete nationality from JSON (competitor ground-truth)
    // 5. Multi-provincial / multi-state delegation codes
    // 6. Global venue / address / city geocoding (OpenStreetMap Photon)
    let hostCountryRes = initialHostCountryRes;
    let effectiveCountryCode = hostCountryRes?.match?.country_code || null;
    let locationSourceNote: string | null = null;
    let geoResultState: string | null = null;

    // Direct textual country code/name extraction from primary source input fields
    const directCountryMatch = 
      extractDirectCountryCode(body.host_country_text) ||
      extractDirectCountryCode(body.city_text) ||
      extractDirectCountryCode(body.venue_text);

    if (!effectiveCountryCode && directCountryMatch) {
      effectiveCountryCode = directCountryMatch.country_code;
      locationSourceNote = `explicit location text ("${directCountryMatch.source}")`;
    }

    // Direct Canadian postal code & province detection (e.g. "J2T 3Z4" in venue/city/address)
    const CANADIAN_POSTAL_CODE_REGEX = /\b[A-CEJ-NPR-TVXY]\d[A-CEJ-NPR-TV-Z][ -]?\d[A-CEJ-NPR-TV-Z]\d\b/i;
    const canPostalMatch = (body.venue_text || '').match(CANADIAN_POSTAL_CODE_REGEX) || (body.city_text || '').match(CANADIAN_POSTAL_CODE_REGEX);
    if (!effectiveCountryCode && canPostalMatch) {
      effectiveCountryCode = 'CAN';
      locationSourceNote = `Canadian postal code ("${canPostalMatch[0]}") in venue/location`;
    } else if (!effectiveCountryCode && (/\b(Qc|Québec|Quebec)\b/i.test(body.venue_text || '') || /\b(Qc|Québec|Quebec)\b/i.test(body.city_text || ''))) {
      effectiveCountryCode = 'CAN';
      locationSourceNote = `provincial location text in venue/location`;
    }

    if (!effectiveCountryCode && federationRes?.status === 'unique' && federationRes.match?.country_code && CANONICAL_COUNTRY_NAMES[federationRes.match.country_code]) {
      effectiveCountryCode = federationRes.match.country_code;
      locationSourceNote = `inferred governing federation (${federationRes.match.canonical_name})`;
    } else if (!effectiveCountryCode && organizerRes?.status === 'unique' && organizerRes.match?.country_code && CANONICAL_COUNTRY_NAMES[organizerRes.match.country_code]) {
      effectiveCountryCode = organizerRes.match.country_code;
      locationSourceNote = `organizer (${organizerRes.match.canonical_name})`;
    }

    if (!effectiveCountryCode && demonymMatch && CANONICAL_COUNTRY_NAMES[demonymMatch.country_code]) {
      effectiveCountryCode = demonymMatch.country_code;
      locationSourceNote = isChampionship
        ? `national championship title ("${demonymMatch.demonym_term}")`
        : `national demonym in meet title ("${demonymMatch.demonym_term}")`;
    }

    const predominantCountry = findPredominantCountry(body.athlete_countries || []);
    if (!effectiveCountryCode && predominantCountry && CANONICAL_COUNTRY_NAMES[predominantCountry]) {
      effectiveCountryCode = predominantCountry;
      locationSourceNote = `competitor nationalities (${predominantCountry})`;
    }

    if (!effectiveCountryCode && hasCanadianProvincialDelegations) {
      effectiveCountryCode = 'CAN';
      locationSourceNote = `provincial team delegations (${matchedCanProvinces.slice(0, 4).join(', ')})`;
    } else if (!effectiveCountryCode && hasUsStateDelegations) {
      effectiveCountryCode = 'USA';
      locationSourceNote = `state team delegations (${matchedUsStates.slice(0, 4).join(', ')})`;
    } else if (!effectiveCountryCode && hasAusStateDelegations) {
      effectiveCountryCode = 'AUS';
      locationSourceNote = `state team delegations (${matchedAusStates.slice(0, 4).join(', ')})`;
    }

    if (body.venue_text || body.city_text || body.host_country_text) {
      const geoResult = await lookupLocationCountry(body.venue_text, body.city_text, body.host_country_text);
      if (geoResult) {
        geoResultState = geoResult.state || null;
        if (!effectiveCountryCode) {
          effectiveCountryCode = geoResult.country_code;
          const isVenueSource = Boolean(body.venue_text && geoResult.resolved_query.includes(body.venue_text.trim()));
          const sourceLabel = isVenueSource ? 'venue' : 'location';
          locationSourceNote = `${sourceLabel}: "${geoResult.resolved_query}"`;
        }
      }
    }

    if (effectiveCountryCode && (!hostCountryRes || hostCountryRes.status !== 'unique')) {
      const { data: natFeds } = await supabase
        .from('federation_registry')
        .select('*')
        .eq('level', 'national')
        .or(`country_code.eq.${effectiveCountryCode},short_code.eq.${effectiveCountryCode}`)
        .limit(1);

      const countryName = CANONICAL_COUNTRY_NAMES[effectiveCountryCode] || effectiveCountryCode;

      if (natFeds && natFeds.length > 0) {
        const topNat = natFeds[0];
        hostCountryRes = {
          status: 'unique',
          raw_input: locationSourceNote || body.host_country_text || effectiveCountryCode,
          match: {
            id: topNat.id,
            canonical_name: topNat.canonical_name,
            short_code: topNat.short_code,
            country_code: topNat.country_code,
            level: 'national',
            is_verified: topNat.is_verified ?? true,
            match_rank: 95
          },
          candidates: [],
          confidence_tier: 'exact',
          match_rank: 95
        };
      } else if (CANONICAL_COUNTRY_NAMES[effectiveCountryCode]) {
        // Fallback for valid sovereign nation without a registry federation entry
        hostCountryRes = {
          status: 'unique',
          raw_input: locationSourceNote || body.host_country_text || effectiveCountryCode,
          match: {
            id: `country:${effectiveCountryCode}`,
            canonical_name: countryName,
            short_code: effectiveCountryCode,
            country_code: effectiveCountryCode,
            level: 'national',
            is_verified: false,
            match_rank: 90
          },
          candidates: [],
          confidence_tier: 'exact',
          match_rank: 90
        };
      } else {
        // Do not force unknown entities
        hostCountryRes = {
          status: 'no_match',
          raw_input: body.host_country_text || null,
          match: null,
          candidates: [],
          confidence_tier: null,
          match_rank: null,
          note: 'Unresolved — checked meet country field, competitor nationalities, and venue/city location via global geocoding, but none yielded a recognized sovereign host country.'
        };
      }
    } else if (!effectiveCountryCode) {
      hostCountryRes = {
        status: 'no_match',
        raw_input: body.host_country_text || null,
        match: null,
        candidates: [],
        confidence_tier: null,
        match_rank: null,
        note: 'Unresolved — checked meet country field, competitor nationalities, and venue/city location via global geocoding, but none yielded a recognized sovereign host country.'
      };
    }

    // Scope determination:
    // Priority 1: Global International apex body or global championship title
    // Priority 2: Continental confederation body or continental championship title
    // Priority 3: Regional / Intercontinental multi-nation body or regional games title (e.g. Islamic Solidarity Games, Commonwealth, Mediterranean, South American) or multi-national delegations
    // Priority 4: National championship title demonym or multi-provincial/state delegations
    // Priority 5: Governing federation level or organizer level
    // Fallback: Local
    let suggestedScope: CompetitionScope = 'local';
    let hasDerivedScope = false;
    let scopeInferenceSource: string | null = null;
    let inferredInternationalName: string | null = null;

    const isGlobalApexTitle = /\b(olympic|olympics|olympique|olympiques|olímpico|olímpicos|world championship|world championships|championnat du monde|championnats du monde|campeonato mundial|campeonatos mundiales|coupe du monde|copa del mundo|iwf world cup|iwf grand prix|universitaire mondial|iwf|umwf|imwa)\b/i.test(compName);
    const hasContinentalKeyword = CONTINENTAL_FEDERATIONS.some(c => c.title_pattern.test(compName));
    const isContinentalTitle = hasContinentalKeyword && /\b(championship|championships|championnat|championnats|campeonato|campeonatos|games|jeux|juegos|torneo|tournoi)\b/i.test(compName);
    const isRegionalMultiNationTitle = /\b(solidarity|commonwealth|mediterranean|méditerranéen|sudamerican[oa]s?|south american|nordic|nordique|visegrad|v4|balkan|balcan|arab|arabe|jeux de la francophonie|francophone|island games|micronesian|bolivarian[oa]s?|central american|centroamerican[oa]s?|caribbean|caribe|cac games|juegos centroamericanos|pan[- ]?arab)\b/i.test(compName);
    const CANADIAN_PROVINCE_TITLE_REGEX = /\b(du québec|de québec|d'ontario|de l'ontario|de l'alberta|de la colombie-britannique|du manitoba|de la saskatchewan|de la nouvelle-écosse|du nouveau-brunswick|de terre-neuve|de l'île-du-prince-édouard|québec|quebec|ontario|alberta|british columbia|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland)\b/i;
    const US_STATE_TITLE_REGEX = /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;
    const PROVINCIAL_ORG_ACRONYM_REGEX = /\b(fhq|bcwa|bcoa|owa|nsfal|mwa|swa|awa|wso)\b/i;
    const isExplicitChampionship = /\b(championship|championships|championnat|championnats|campeonato|campeonatos|tournoi|tournament|jeux|games|juegos|finale|finals)\b/i.test(compName);

    const isStateProvincialTitle = 
      (/\b(provincial|provinciale|provinciaux|wso|championnat provincial|championnats provinciaux|campeonato estatal)\b/i.test(compName)) ||
      (/\b(state|provincial)\b/i.test(compName) && /\b(championship|championships|championnat|championnats|open|games|jeux|juegos)\b/i.test(compName)) ||
      (isExplicitChampionship && (CANADIAN_PROVINCE_TITLE_REGEX.test(compName) || US_STATE_TITLE_REGEX.test(compName) || PROVINCIAL_ORG_ACRONYM_REGEX.test(compName) || Boolean(geoResultState)) && !demonymMatch);

    const isNationalChampionship = (isChampionship || /\b(games|jeux|juegos|nationals|nationaux)\b/i.test(compName)) && !isStateProvincialTitle && (
      Boolean(demonymMatch) ||
      (isGenericNational && (effectiveCountryCode || hasCanadianProvincialDelegations || hasUsStateDelegations || hasAusStateDelegations)) ||
      hasCanadianProvincialDelegations ||
      hasUsStateDelegations ||
      hasAusStateDelegations
    );

    if (federationRes.match?.level === 'global_international' || federationRes.match?.level === 'international' || isGlobalApexTitle) {
      suggestedScope = 'international';
      hasDerivedScope = true;
      if (federationRes.match?.level === 'global_international' || federationRes.match?.level === 'international') {
        scopeInferenceSource = `governed by global apex federation (${federationRes.match?.canonical_name})`;
      } else {
        scopeInferenceSource = `matched global championship title in meet name`;
      }
    } else if (federationRes.match?.level === 'continental' || isContinentalTitle) {
      suggestedScope = 'continental';
      hasDerivedScope = true;
      const matchedContDef = CONTINENTAL_FEDERATIONS.find(c => c.title_pattern.test(compName)) ||
        (federationRes.match?.level === 'continental' ? CONTINENTAL_FEDERATIONS.find(c => c.canonical_name.toLowerCase() === federationRes.match?.canonical_name.toLowerCase()) : null);
      const contFedDisplay = matchedContDef
        ? `${matchedContDef.canonical_name}${matchedContDef.short_code ? ` (${matchedContDef.short_code})` : ''}`
        : 'the governing continental confederation';
      const hostCountryDisplay = effectiveCountryCode
        ? `${CANONICAL_COUNTRY_NAMES[effectiveCountryCode] || effectiveCountryCode} (${effectiveCountryCode})`
        : null;
      const continentalDelegationSummary = unambiguousCountryCodes.length >= 2
        ? `${unambiguousCountryCodes.length} participating delegations (${unambiguousCountryCodes.slice(0, 5).join(', ')}${unambiguousCountryCodes.length > 5 ? ', ...' : ''}) belonging to the ${contFedDisplay}`
        : null;

      if (isContinentalTitle && continentalDelegationSummary) {
        scopeInferenceSource = `matched continental championship title in meet name; corroborated by ${continentalDelegationSummary}${hostCountryDisplay ? `; host country is ${hostCountryDisplay}` : ''}`;
      } else if (isContinentalTitle) {
        scopeInferenceSource = `matched continental championship in meet name${hostCountryDisplay ? `; host country is ${hostCountryDisplay}` : ''}`;
      } else if (federationRes.match?.level === 'continental') {
        scopeInferenceSource = `governed by continental federation (${federationRes.match?.canonical_name})${hostCountryDisplay ? `; host country is ${hostCountryDisplay}` : ''}`;
      } else {
        scopeInferenceSource = continentalDelegationSummary || `continental meet delegations`;
      }
    } else if (
      federationRes.match?.level === 'regional' ||
      federationRes.match?.level === 'intercontinental_regional' ||
      organizerRes.match?.level === 'regional' ||
      organizerRes.match?.level === 'intercontinental_regional' ||
      isRegionalMultiNationTitle ||
      isMultiContinental ||
      (isMultiNational && unambiguousCountryCodes.length >= 2)
    ) {
      suggestedScope = 'regional';
      hasDerivedScope = true;
      const delegationSummary = unambiguousCountryCodes.length >= 2
        ? `${unambiguousCountryCodes.length} national delegations${representedContinents.size > 1 ? ` across ${representedContinents.size} continents` : ''} (${unambiguousCountryCodes.slice(0, 5).join(', ')}${unambiguousCountryCodes.length > 5 ? ', ...' : ''})`
        : null;

      if (delegationSummary && body.organizer_text) {
        scopeInferenceSource = `${delegationSummary} organized by ${body.organizer_text}`;
      } else if (delegationSummary) {
        scopeInferenceSource = isRegionalMultiNationTitle
          ? `${compName} with ${delegationSummary}`
          : delegationSummary;
      } else if (isMultiContinental) {
        scopeInferenceSource = `multi-national delegations across ${representedContinents.size} continents (${unambiguousCountryCodes.slice(0, 5).join(', ')})`;
      } else if (federationRes.match?.level === 'regional' || federationRes.match?.level === 'intercontinental_regional') {
        scopeInferenceSource = `governed by regional federation (${federationRes.match?.canonical_name})`;
      } else {
        scopeInferenceSource = `matched "${compName}" in meet name`;
      }
    } else if (isNationalChampionship) {
      suggestedScope = 'national';
      hasDerivedScope = true;
      if (demonymMatch) {
        scopeInferenceSource = `matched "${demonymMatch.demonym_term} Championships" in meet name`;
        if (hasCanadianProvincialDelegations) {
          scopeInferenceSource += ` (corroborated by provincial delegations: ${matchedCanProvinces.join(', ')})`;
        } else if (hasUsStateDelegations) {
          scopeInferenceSource += ` (corroborated by state delegations: ${matchedUsStates.join(', ')})`;
        } else if (hasAusStateDelegations) {
          scopeInferenceSource += ` (corroborated by state delegations: ${matchedAusStates.join(', ')})`;
        }
      } else if (hasCanadianProvincialDelegations) {
        scopeInferenceSource = `national championship with provincial delegations: ${matchedCanProvinces.join(', ')}`;
      } else if (hasUsStateDelegations) {
        scopeInferenceSource = `national championship with state delegations: ${matchedUsStates.join(', ')}`;
      } else if (hasAusStateDelegations) {
        scopeInferenceSource = `national championship with state delegations: ${matchedAusStates.join(', ')}`;
      } else {
        scopeInferenceSource = `matched national championship in meet name`;
      }
    } else if (isStateProvincialTitle) {
      suggestedScope = 'state_provincial';
      hasDerivedScope = true;
      scopeInferenceSource = `matched state / provincial championship meet in title`;
    }

    // Participating countries combination (teams + athletes)
    const allParticipatingCountries = Array.from(new Set([...unambiguousCountryCodes, ...athleteCountryCodes]));

    // International, Continental, Regional or State/Provincial Federation resolution
    let inferredInternationalFed: FederationMatch | null = null;
    let inferredContinentalFed: FederationMatch | null = null;
    let inferredRegionalFed: FederationMatch | null = null;
    let inferredNationalFed: FederationMatch | null = null;

    if (suggestedScope === 'international') {
      const matchedApex = GLOBAL_APEX_FEDERATIONS.find(a => a.title_pattern.test(compName));
      if (matchedApex) {
        const { data: apexMatches } = await supabase.rpc('search_federations', {
          query_text: matchedApex.canonical_name,
          as_of_date: body.competition_date || null
        });
        const found = (apexMatches as FederationMatch[] | null)?.find(
          f => f.canonical_name.toLowerCase() === matchedApex.canonical_name.toLowerCase()
        );
        if (found) {
          inferredInternationalFed = found;
          inferredInternationalName = `${found.canonical_name}${found.short_code ? ` (${found.short_code})` : ''}`;
        }
      }
    } else if (suggestedScope === 'continental') {
      const matchedContDef = CONTINENTAL_FEDERATIONS.find(c => c.title_pattern.test(compName)) ||
        (federationRes.match?.level === 'continental' ? CONTINENTAL_FEDERATIONS.find(c => c.canonical_name.toLowerCase() === federationRes.match?.canonical_name.toLowerCase()) : null);
      if (matchedContDef) {
        const { data: contMatches } = await supabase.rpc('search_federations', {
          query_text: matchedContDef.canonical_name,
          as_of_date: body.competition_date || null
        });
        const found = (contMatches as FederationMatch[] | null)?.find(
          f => f.canonical_name.toLowerCase() === matchedContDef!.canonical_name.toLowerCase()
        );
        if (found) {
          inferredContinentalFed = found;
        }
      }
    } else if (suggestedScope === 'regional') {
      // 1. Check title against regional federation definitions
      let matchedRegDef = REGIONAL_FEDERATION_MEMBERS.find(reg => reg.title_pattern.test(compName));

      // 2. If not matched by title, check participating countries overlap
      if (!matchedRegDef && allParticipatingCountries.length >= 2) {
        let bestMatchDef: RegionalFederationDefinition | null = null;
        let bestMatchRatio = 0;

        for (const reg of REGIONAL_FEDERATION_MEMBERS) {
          const matchCount = allParticipatingCountries.filter(c => reg.member_countries.includes(c)).length;
          const ratio = matchCount / allParticipatingCountries.length;
          if (ratio >= 0.75 && ratio > bestMatchRatio) {
            bestMatchRatio = ratio;
            bestMatchDef = reg;
          }
        }
        if (bestMatchDef) {
          matchedRegDef = bestMatchDef;
        }
      }

      if (matchedRegDef) {
        const { data: regMatches } = await supabase.rpc('search_federations', {
          query_text: matchedRegDef.canonical_name,
          as_of_date: body.competition_date || null
        });
        const found = (regMatches as FederationMatch[] | null)?.find(
          f => f.canonical_name.toLowerCase() === matchedRegDef!.canonical_name.toLowerCase()
        );
        if (found) {
          inferredRegionalFed = found;
        }
      }
    }

    // National Federation resolution (for domestic scopes or international co-sanctioned events)
    if (effectiveCountryCode) {
      const isCoSanctionedNational = 
        Boolean(demonymMatch && demonymMatch.country_code === effectiveCountryCode) ||
        (effectiveCountryCode === 'AUS' && /\b(awf|australian)\b/i.test(compName)) ||
        (effectiveCountryCode === 'USA' && /\b(usaw|american|united states)\b/i.test(compName)) ||
        (effectiveCountryCode === 'CAN' && /\b(wch|canadian|canadien)\b/i.test(compName));

      if ((suggestedScope === 'international' && isCoSanctionedNational) || suggestedScope === 'national' || suggestedScope === 'state_provincial' || suggestedScope === 'local') {
        const { data: natMatches } = await supabase.rpc('search_federations', {
          query_text: effectiveCountryCode,
          as_of_date: body.competition_date || null
        });
        const foundNat = (natMatches as FederationMatch[] | null)?.find(
          f => f.country_code === effectiveCountryCode && f.level === 'national'
        );
        if (foundNat) {
          inferredNationalFed = foundNat;
        }
      }
    }

    let inferredRegionalFedSource: string | null = null;
    if ((suggestedScope === 'state_provincial' || suggestedScope === 'local') && effectiveCountryCode) {
      const candidateStates: { name: string; source: string }[] = [];
      if (geoResultState) {
        candidateStates.push({ name: geoResultState, source: `matched state/province "${geoResultState}" from geocoded venue/city` });
      }

      const compOnly = compName;
      const venueCity = `${body.venue_text || ''} ${body.city_text || ''}`;

      const checkProvince = (regex: RegExp, provName: string) => {
        if (regex.test(compOnly)) {
          if (!candidateStates.some(c => c.name === provName)) {
            candidateStates.push({ name: provName, source: `matched state/province "${provName}" in meet title` });
          }
        } else if (regex.test(venueCity)) {
          if (!candidateStates.some(c => c.name === provName)) {
            candidateStates.push({ name: provName, source: `matched state/province "${provName}" from venue/city location` });
          }
        }
      };

      checkProvince(/\b(QC|Québec|Quebec|FHQ)\b/i, 'Québec');
      checkProvince(/\b(ON|Ontario|OWA)\b/i, 'Ontario');
      checkProvince(/\b(BC|British Columbia|BCWA|BCOA)\b/i, 'British Columbia');
      checkProvince(/\b(AB|Alberta|AWA)\b/i, 'Alberta');

      const usStateRegex = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|California|Texas|Florida|Ohio|Pennsylvania|New York|North Carolina|Georgia|Illinois|Michigan|Virginia|Washington|Arizona|Colorado|Minnesota|Missouri|Wisconsin|Indiana|Tennessee|Massachusetts)\b/i;
      const compUsMatch = compOnly.match(usStateRegex);
      const locUsMatch = venueCity.match(usStateRegex);
      if (compUsMatch && !candidateStates.some(c => c.name === compUsMatch[0])) {
        candidateStates.push({ name: compUsMatch[0], source: `matched state/province "${compUsMatch[0]}" in meet title` });
      } else if (locUsMatch && !candidateStates.some(c => c.name === locUsMatch[0])) {
        candidateStates.push({ name: locUsMatch[0], source: `matched state/province "${locUsMatch[0]}" from venue/city location` });
      }

      for (const st of candidateStates) {
        const { data: stateFeds } = await supabase.rpc('search_federations', { query_text: st.name, as_of_date: body.competition_date || null });
        const matched = (stateFeds as FederationMatch[] | null)?.find(f => f.country_code === effectiveCountryCode && f.level === 'regional_state_wso');
        if (matched) {
          inferredRegionalFed = matched;
          inferredRegionalFedSource = st.source;
          break;
        }
      }
    }

    const caveats: string[] = [];
    if (organizerRes.status === 'ambiguous') {
      caveats.push(`Organizer "${body.organizer_text}" is ambiguous between multiple candidate federations.`);
    }
    if (federationRes.status === 'ambiguous') {
      caveats.push(`Governing federation "${effectiveFedText}" is ambiguous between multiple candidate federations.`);
    }

    const response: BatchResolveResponse = {
      success: true,
      organizer: organizerRes,
      federation: federationRes,
      host_country: hostCountryRes || undefined,
      suggested_scope: suggestedScope,
      has_derived_scope: hasDerivedScope,
      scope_inference_source: scopeInferenceSource,
      inferred_international_name: inferredInternationalName,
      inferred_international_federation: inferredInternationalFed,
      inferred_continental_federation: inferredContinentalFed,
      inferred_national_federation: inferredNationalFed,
      inferred_regional_federation: inferredRegionalFed,
      inferred_regional_federation_source: inferredRegionalFedSource,
      record_federations: recordFederationsMap,
      teams_analysis: {
        total_teams: rawTeams.length,
        delegation_count: unambiguousCountryCodes.length,
        unambiguous_country_codes: unambiguousCountryCodes
      },
      caveats
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('Error in POST /api/federations/resolve:', err);
    return NextResponse.json({ success: false, error: err.message || 'Batch resolve failed' }, { status: 500 });
  }
}
