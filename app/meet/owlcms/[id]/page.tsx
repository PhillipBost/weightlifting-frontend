'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Trophy,
  Users,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Medal,
  Loader2,
  Clock,
  Layers,
  Sparkles,
  ClipboardList,
  Building
} from 'lucide-react';
import { CANONICAL_COUNTRY_NAMES, formatDefinedTeam } from '../../../../types/federation';
import { ThemeSwitcher } from '../../../components/ThemeSwitcher';

const MeetHubSpokeMap = dynamic(() => import('../../../components/MeetHubSpokeMap'), { ssr: false });
import {
  Ad, Ae, Af, Ag, Ai, Al, Am, Ao, Aq, Ar, As, At, Au, Aw, Ax, Az,
  Ba, Bb, Bd, Be, Bf, Bg, Bh, Bi, Bj, Bl, Bm, Bn, Bo, Bq, Br, Bs, Bt, Bv, Bw, By, Bz,
  Ca, Cc, Cd, Cf, Cg, Ch, Ci, Ck, Cl, Cm, Cn, Co, Cr, Cu, Cv, Cw, Cx, Cy, Cz,
  De, Dj, Dk, Dm, Do, Dz, Ec, Ee, Eg, Er, Es, Et,
  Fi, Fj, Fk, Fm, Fo, Fr, Ga, Gb, Gd, Ge, Gf, Gg, Gh, Gi, Gl, Gm, Gn, Gp, Gq, Gr, Gs, Gt, Gu, Gw, Gy,
  Hk, Hm, Hn, Hr, Ht, Hu, Id, Ie, Im, In, Io, Iq, Ir, Is, It,
  Je, Jm, Jo, Jp, Ke, Kg, Kh, Ki, Km, Kn, Kp, Kr, Kw, Ky, Kz,
  La, Lb, Lc, Li, Lk, Lr, Ls, Lt, Lu, Lv, Ly, Ma, Mc, Md, Me, Mf, Mg, Mh, Mk, Ml, Mm, Mn, Mo, Mp, Mq, Mr, Ms, Mt, Mu, Mv, Mw, Mx, My, Mz,
  Na, Nc, Ne, Nf, Ng, Ni, Nl, No, Np, Nr, Nu, Nz, Om, Pa, Pe, Pf, Pg, Ph, Pk, Pl, Pm, Pn, Pr, Ps, Pt, Pw, Py,
  Qa, Re, Ro, Rs, Ru, Rw, Sa, Sb, Sc, Sd, Se, Sg, Sh, Si, Sj, Sk, Sl, Sm, Sn, So, Sr, Ss, St, Sv, Sx, Sy, Sz,
  Tc, Td, Tf, Tg, Th, Tj, Tk, Tl, Tm, Tn, To, Tr, Tt, Tv, Tw, Tz, Ua, Ug, Um, Us, Uy, Uz,
  Va, Vc, Ve, Vg, Vi, Vn, Vu, Wf, Ws, Xk, Ye, Yt, Za, Zm, Zw,
  GbEng, GbSct, GbWls
} from 'react-flag-icons';

// Custom ROC flag
const RocFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <img
    src="/roc-flag.svg"
    alt="ROC"
    style={{ ...style, width: '18px', height: 'auto' }}
  />
);

// Custom Israel flag
const IsraelFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <img
    src="/israel-flag.svg"
    alt="Israel"
    style={{ ...style, width: '18px', height: 'auto' }}
  />
);

// Olympic flag
const OlympicFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <img
    src="/Olympic_flag.svg"
    alt="Olympic Neutral"
    style={{ ...style, width: '18px', height: 'auto' }}
  />
);

// ANA flag
const AnaFlag: React.FC<{ style?: React.CSSProperties; year?: number }> = () => (
  <img
    src="/Flag_of_the_Individual_Neutral_Athletes_at_the_2024_Summer_Olympics.svg"
    alt="ANA"
    style={{ width: '18px', height: 'auto' }}
  />
);

interface Participation {
  categoryCode: string;
  championshipType: string;
  totalRank: number;
  snatchRank: number;
  cleanJerkRank: number;
  teamMember?: boolean;
  mixedTeamMember?: boolean;
  combinedRank?: number;
  customRank?: number;
  teamTotalRank?: number;
  teamSnatchRank?: number;
  teamCJRank?: number;
  teamSinclairRank?: number;
  teamRobiRank?: number;
  teamCombinedRank?: number;
}

interface LifterResult {
  result_id: number;
  meet_id: number;
  lifter_id: number;
  athlete_name: string;
  first_name?: string | null;
  last_name?: string | null;
  gender: string;
  birth_year: number | null;
  competition_age?: number | null;
  club_name: string | null;
  country_code: string | null;
  membership_number: string | null;
  body_weight_kg: number | null;
  scale_weight_kg: number | null;
  category: string;
  session_name: string | null;
  lot_number: number | null;
  start_number: number | null;
  snatch_1: number | null;
  snatch_2: number | null;
  snatch_3: number | null;
  best_snatch: number | null;
  snatch_1_time?: string | null;
  snatch_2_time?: string | null;
  snatch_3_time?: string | null;
  cj_1: number | null;
  cj_2: number | null;
  cj_3: number | null;
  best_cj: number | null;
  cj_1_time?: string | null;
  cj_2_time?: string | null;
  cj_3_time?: string | null;
  total: number | null;
  qpoints: number | null;
  q_youth?: number | null;
  q_masters?: number | null;
  gamx_total: number | null;
  gamx_s?: number | null;
  gamx_j?: number | null;
  gamx_u?: number | null;
  gamx_a?: number | null;
  gamx_masters?: number | null;
  profile_url: string;
  linked_federation: 'USAW' | 'IWF' | null;
  participations?: Participation[];
  raw_payload?: any;
  parsedWeightClass?: string;
  parsedDivision?: string;
  parsedGender?: 'M' | 'F';
}

interface ParticipationEntry {
  id: string; // unique key `${r.result_id}-${p.categoryCode}`
  result: LifterResult;
  categoryCode: string;
  divisionCode: string;
  divisionLabel: string;
  federationCode: string;
  federationLabel: string;
  gender: 'M' | 'F';
  weightClass: string;
  totalRank: number | null;
  snatchRank: number | null;
  cleanJerkRank: number | null;
  teamMember?: boolean;
}

interface FederationDetails {
  id: string;
  canonical_name: string;
  short_code: string | null;
  country_code: string | null;
  level: string;
}

interface MeetData {
  meet_id: number;
  meet_name: string;
  start_date: string | null;
  end_date: string | null;
  city: string | null;
  country: string | null;
  organizer: string | null;
  federation: string | null;
  federation_details?: FederationDetails | null;
  venue: string | null;
  latitude?: number | null;
  longitude?: number | null;
  host_country_code?: string | null;
  format_version: string;
  raw_payload?: any;
}

const getCountryFlagComponent = (code: string | null | undefined): React.ComponentType<any> | null => {
  if (!code) return null;
  const iocMap: Record<string, React.ComponentType<any> | null> = {
    'ALB': Al, 'AND': Ad, 'ARM': Am, 'AUT': At, 'AZE': Az, 'BEL': Be, 'BIH': Ba, 'BUL': Bg, 'CRO': Hr, 'CYP': Cy,
    'CZE': Cz, 'DEN': Dk, 'EST': Ee, 'FIN': Fi, 'FRA': Fr, 'GEO': Ge, 'GER': De, 'GRE': Gr, 'GBR': Gb, 'HUN': Hu,
    'ISL': Is, 'IRL': Ie, 'ISR': IsraelFlag, 'ITA': It, 'KOS': Xk, 'LAT': Lv, 'LIE': Li, 'LTU': Lt, 'LUX': Lu, 'MDA': Md,
    'MNE': Me, 'NED': Nl, 'NOR': No, 'POL': Pl, 'POR': Pt, 'ROU': Ro, 'RUS': Ru, 'SMR': Sm, 'SRB': Rs, 'SVK': Sk,
    'SVN': Si, 'ESP': Es, 'SWE': Se, 'SUI': Ch, 'TUR': Tr, 'UKR': Ua,
    'AFG': Af, 'BAN': Bd, 'CAM': Kh, 'CHN': Cn, 'HKG': Hk, 'IND': In, 'IDN': Id, 'IRN': Ir, 'JPN': Jp, 'JOR': Jo,
    'KAZ': Kz, 'KOR': Kr, 'KWT': Kw, 'KGZ': Kg, 'LAO': La, 'LBN': Lb, 'MAS': My, 'MGL': Mn, 'MYA': Mm, 'NEP': Np,
    'PAK': Pk, 'PHI': Ph, 'QAT': Qa, 'SGP': Sg, 'THA': Th, 'TJK': Tj, 'TPE': Tw, 'TKM': Tm, 'UZB': Uz, 'VIE': Vn,
    'ARG': Ar, 'ARU': Aw, 'BAR': Bb, 'BOL': Bo, 'BRA': Br, 'CAN': Ca, 'CHI': Cl, 'COL': Co, 'CRC': Cr, 'CUB': Cu, 'DOM': Do, 'ECU': Ec,
    'SLV': Sv, 'GUA': Gt, 'HAI': Ht, 'HND': Hn, 'HON': Hn, 'JAM': Jm, 'MEX': Mx, 'PAN': Pa, 'PAR': Py, 'PER': Pe, 'PUR': Pr,
    'URU': Uy, 'USA': Us, 'VEN': Ve,
    'AUS': Au, 'FIJ': Fj, 'NZL': Nz, 'PNG': Pg, 'SAM': Ws, 'TON': To,
    'ALG': Dz, 'ANG': Ao, 'BOT': Bw, 'BWA': Bw, 'CMR': Cm, 'EGY': Eg, 'ETH': Et, 'GHA': Gh, 'KEN': Ke, 'LIB': Ly,
    'MAR': Ma, 'MRI': Mu, 'MOZ': Mz, 'NAM': Na, 'NGA': Ng, 'RWA': Rw, 'RSA': Za, 'SUD': Sd, 'TAN': Tz, 'TUN': Tn,
    'UGA': Ug, 'ZIM': Zw,
    'AIN': AnaFlag, 'ANA': AnaFlag, 'EOR': OlympicFlag, 'IOP': OlympicFlag, 'OAR': OlympicFlag, 'VAN': Vu, 'WRT': OlympicFlag,
    'ROC': RocFlag, 'ENG': GbEng, 'SCO': GbSct, 'WAL': GbWls,
    'CA': Ca, 'US': Us, 'GB': Gb, 'FR': Fr, 'DE': De, 'IT': It, 'ES': Es, 'MX': Mx, 'CO': Co, 'BR': Br, 'AU': Au, 'NZ': Nz
  };

  const raw = code.toUpperCase().trim();
  const primaryCode = raw.includes(',') ? raw.split(',')[0].trim() : raw;
  return iocMap[primaryCode] || iocMap[raw] || null;
};

function getDelegationLabel(clubName?: string | null, countryCode?: string | null): string {
  let subCode: string | null = null;
  if (countryCode && countryCode.includes(',')) {
    const parts = countryCode.split(',').map(s => s.trim().toUpperCase());
    if (parts.length >= 2) subCode = parts[1];
  }
  const candidate = (clubName || '').trim() || subCode || (countryCode || '').trim();
  if (!candidate) return '-';
  return formatDefinedTeam(candidate);
}

function getDivisionLabel(code: string): string {
  const p = code.toUpperCase();
  if (p === 'JR' || p === 'JNR') return 'Junior';
  if (p === 'SR' || p === 'OPEN') return 'Senior / Open';
  if (p === 'YTH') return 'Youth';
  if (p === 'PSR') return 'Pan American Senior';
  if (p === 'P17') return 'Pan American U17';
  if (p === 'P15') return 'Pan American U15';
  if (p === 'SSR') return 'South American Senior';
  if (p === 'S20') return 'South American U20';
  if (p === 'S17') return 'South American U17';
  if (p === 'S15') return 'South American U15';
  if (p.startsWith('M') && !isNaN(Number(p.slice(1)))) return `Masters (${p.slice(1)})`;
  if (p.startsWith('U') && !isNaN(Number(p.slice(1)))) return `Under ${p.slice(1)}`;
  return code;
}

function getFederationInfo(divCode: string): { code: string; label: string } {
  const c = divCode.toUpperCase();
  if (c.startsWith('P')) {
    return { code: 'PAWF', label: 'Pan American (PAWF)' };
  }
  if (c.startsWith('S') && !c.startsWith('SR')) {
    return { code: 'CSLP', label: 'South American (CSLP)' };
  }
  return { code: 'NATIONAL', label: 'National / Regional' };
}

const SortIcon = ({
  column,
  sortConfig,
  division
}: {
  column: string;
  sortConfig: { division: string; key: keyof ParticipationEntry | 'place'; direction: 'asc' | 'desc' } | null;
  division: string;
}) => {
  if (!sortConfig || sortConfig.division !== division) {
    if (column === 'place') {
      return <span className="text-accent-primary ml-1">↑</span>;
    }
    return <span className="text-app-disabled ml-1">↕</span>;
  }

  if (sortConfig.key !== column) {
    return <span className="text-app-disabled ml-1">↕</span>;
  }

  return (
    <span className="text-accent-primary ml-1">
      {sortConfig.direction === 'asc' ? '↑' : '↓'}
    </span>
  );
};

export default function OwlcmsMeetPage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [meet, setMeet] = useState<MeetData | null>(null);
  const [results, setResults] = useState<LifterResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: Defaults to authentic owlcms Results View
  const [viewMode, setViewMode] = useState<'owlcms' | 'owlanalytics'>('owlcms');

  // Multi-Division & Federation Filters
  const [selectedFederation, setSelectedFederation] = useState<string>('ALL');
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [groupBySession, setGroupBySession] = useState<boolean>(true);
  const [expandedAthletes, setExpandedAthletes] = useState<Set<number>>(new Set());
  const [sessionDivisionFilters, setSessionDivisionFilters] = useState<Record<string, string>>({});
  const controlBarRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const [resultsMinHeight, setResultsMinHeight] = useState<number>(0);

  // Accordion states
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(["Men's Results by Division", "Women's Results by Division"])
  );
  const [expandedSubrows, setExpandedSubrows] = useState<Set<string>>(new Set());

  // OWLanalytics Mode Summary States
  const [showMenSummary, setShowMenSummary] = useState(false);
  const [showWomenSummary, setShowWomenSummary] = useState(false);
  const [showGamxSummary, setShowGamxSummary] = useState(false);

  const [gamxSortConfig, setGamxSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'gamx_total',
    direction: 'desc'
  });

  const [menSortConfig, setMenSortConfig] = useState<{
    key: keyof LifterResult | 'rank';
    direction: 'asc' | 'desc';
  } | null>(null);

  const [womenSortConfig, setWomenSortConfig] = useState<{
    key: keyof LifterResult | 'rank';
    direction: 'asc' | 'desc';
  } | null>(null);

  const [sortConfig, setSortConfig] = useState<{
    division: string;
    key: keyof ParticipationEntry | 'place';
    direction: 'asc' | 'desc';
  } | null>(null);

  useEffect(() => {
    const resolve = async () => {
      const res = await params;
      setResolvedParams(res);
    };
    resolve();
  }, [params]);

  useEffect(() => {
    if (meet?.meet_name) {
      document.title = `${meet.meet_name} | owlcms | OWLanalytics`;
    }
  }, [meet]);

  // Precompute Chronological Session Numbers and Metadata (Combination of Option B & C)
  const sessionMetaMap = useMemo(() => {
    const map: Record<string, { sessionNumber: number; platform?: string | null; name: string; descriptor: string }> = {};
    const rawSessions: any[] = meet?.raw_payload?.sessions || [];
    
    // Sort sessions chronologically if competitionTime is available
    const sorted = [...rawSessions].sort((a, b) => {
      const timeA = Array.isArray(a.competitionTime) ? new Date(Date.UTC(a.competitionTime[0], a.competitionTime[1] - 1, a.competitionTime[2], a.competitionTime[3] || 0, a.competitionTime[4] || 0)).getTime() : 0;
      const timeB = Array.isArray(b.competitionTime) ? new Date(Date.UTC(b.competitionTime[0], b.competitionTime[1] - 1, b.competitionTime[2], b.competitionTime[3] || 0, b.competitionTime[4] || 0)).getTime() : 0;
      return timeA - timeB;
    });

    sorted.forEach((s, idx) => {
      const sNum = idx + 1;
      const sName = s.name || `Session ${sNum}`;
      const platform = s.platformName ? `Platform ${s.platformName}` : null;
      const isPureNumber = /^\d+$/.test(sName.trim());
      
      let descriptor = '';
      if (platform) {
        descriptor = isPureNumber ? `${platform} - Session ${sName}` : `${platform} - Session ${sNum} (${sName})`;
      } else {
        descriptor = isPureNumber ? `Session ${sName}` : `Session ${sNum} (${sName})`;
      }

      map[sName] = {
        sessionNumber: sNum,
        platform: s.platformName,
        name: sName,
        descriptor
      };
    });

    return map;
  }, [meet]);

  const getSessionDescriptor = (sessionName: string | null | undefined): string | null => {
    if (!sessionName) return null;
    const meta = sessionMetaMap[sessionName];
    if (meta) return meta.descriptor;
    return `Session ${sessionName}`;
  };

  // Max weight classes per division prefix derived from the dataset
  const [categoryPrefixMaxWc, setCategoryPrefixMaxWc] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!resolvedParams?.id) return;

    const fetchMeetData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/meet/owlcms/${resolvedParams.id}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch meet data (${res.status})`);
        }
        const data = await res.json();
        if (!data.success && !data.meet) {
          throw new Error(data.error || 'Failed to fetch competition data');
        }

        const rawResults: LifterResult[] = data.results || [];

        // Determine authentic max regular weight class per division prefix
        const prefixMaxMap: Record<string, number> = {};
        rawResults.forEach((r) => {
          const allCodes = [
            r.category,
            ...(r.participations?.map((p) => p.categoryCode) || [])
          ];

          allCodes.forEach((code) => {
            const match = code?.match(/^([A-Za-z0-9]+)_([MF])(\d+|\+\d+)$/i);
            if (match) {
              const prefix = `${match[1].toUpperCase()}_${match[2].toUpperCase()}`;
              const num = parseInt(match[3], 10);
              if (!isNaN(num) && num < 900) {
                if (!prefixMaxMap[prefix] || num > prefixMaxMap[prefix]) {
                  prefixMaxMap[prefix] = num;
                }
              }
            }
          });
        });

        setCategoryPrefixMaxWc(prefixMaxMap);

        // Enrich results
        const enrichedResults: LifterResult[] = rawResults.map((r) => {
          let parsedGender: 'M' | 'F' = (r.gender?.toUpperCase() === 'F' || r.category?.includes('_F')) ? 'F' : 'M';
          let parsedDivision = 'Open';
          let parsedWeightClass = 'Open';

          const match = r.category?.match(/^([A-Za-z0-9]+)_([MF])(\d+|\+\d+)$/i);
          if (match) {
            const ageCode = match[1].toUpperCase();
            const gCode = match[2].toUpperCase();
            parsedGender = gCode === 'F' ? 'F' : 'M';
            const rawWc = match[3];

            parsedDivision = getDivisionLabel(ageCode);

            if (rawWc === '999') {
              const maxVal = prefixMaxMap[`${ageCode}_${parsedGender}`];
              parsedWeightClass = maxVal ? `+${maxVal}kg` : '+kg';
            } else if (!rawWc.toLowerCase().includes('kg')) {
              parsedWeightClass = `${rawWc}kg`;
            } else {
              parsedWeightClass = rawWc;
            }
          } else if (r.category) {
            parsedWeightClass = r.category;
          }

          return {
            ...r,
            parsedGender,
            parsedDivision,
            parsedWeightClass
          };
        });

        setMeet(data.meet);
        setResults(enrichedResults);

        // Initial sort for GAMX summary
        if (enrichedResults.length > 0) {
          const counts: Record<string, number> = {
            gamx_total: 0,
            gamx_s: 0,
            gamx_j: 0,
            gamx_u: 0,
            gamx_a: 0,
            gamx_masters: 0
          };
          enrichedResults.forEach((r) => {
            if ((r.gamx_total || 0) > 0) counts.gamx_total++;
            if ((r.gamx_s || 0) > 0) counts.gamx_s++;
            if ((r.gamx_j || 0) > 0) counts.gamx_j++;
            if ((r.gamx_u || 0) > 0) counts.gamx_u++;
            if ((r.gamx_a || 0) > 0) counts.gamx_a++;
            if ((r.gamx_masters || 0) > 0) counts.gamx_masters++;
          });
          const dominant = Object.entries(counts).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
          setGamxSortConfig({ key: dominant, direction: 'desc' });
        }
      } catch (err: any) {
        console.error('[owlcms Meet Fetch Error]:', err);
        setError(err.message || 'Failed to load meet details');
      } finally {
        setLoading(false);
      }
    };

    fetchMeetData();
  }, [resolvedParams]);

  // Hub-and-Spoke Country Vector Aggregation
  const [mapSpokes, setMapSpokes] = useState<any[]>([]);
  const [mapType, setMapType] = useState<'country' | 'club'>('country');
  const [mapLoading, setMapLoading] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!meet?.latitude || !meet?.longitude || results.length === 0) {
      setMapSpokes([]);
      return;
    }

    const fetchCountryCenters = async () => {
      try {
        setMapLoading(true);

        // Detect if participants belong to multiple countries or a single domestic country
        const distinctCountries = Array.from(
          new Set(
            results
              .map(r => {
                const raw = r.country_code?.toUpperCase()?.trim();
                if (!raw || raw === 'UNKNOWN') return null;
                return raw.includes(',') ? raw.split(',')[0].trim() : raw;
              })
              .filter(Boolean) as string[]
          )
        );

        const hostCountry = meet?.host_country_code?.toUpperCase() || distinctCountries[0];
        const isDomesticSingleCountry = distinctCountries.length <= 1;

        // Domestic Single-Country Mode with Sub-national Delegations (e.g. Canadian Provinces or Australian States)
        if (isDomesticSingleCountry && (hostCountry === 'CAN' || hostCountry === 'AUS')) {
          const subGeoFile = hostCountry === 'AUS' ? '/data/australian-states.json' : '/data/canadian-provinces.json';
          const res = await fetch(subGeoFile);
          if (res.ok) {
            const subCoords: Record<string, { lat: number; lng: number; code: string; name?: string }> = await res.json();
            const subMap: Record<string, number> = {};
            results.forEach(r => {
              let token = r.club_name?.trim();
              if ((!token || !subCoords[token]) && r.country_code?.includes(',')) {
                token = r.country_code.split(',')[1].trim();
              }
              if (token && subCoords[token]) {
                const canonicalCode = subCoords[token].code;
                subMap[canonicalCode] = (subMap[canonicalCode] || 0) + 1;
              }
            });

            const subKeys = Object.keys(subMap);
            if (subKeys.length > 0) {
              const spokes = subKeys
                .map(code => {
                  const center = subCoords[code];
                  if (!center) return null;
                  return {
                    name: center.name || formatDefinedTeam(code),
                    lat: center.lat,
                    lng: center.lng,
                    count: subMap[code],
                    code: center.code
                  };
                })
                .filter(Boolean);

              if (spokes.length > 0) {
                setMapType('club');
                setMapSpokes(spokes as any[]);
                return;
              }
            }
          }
        }

        // Cross-Border Multi-Nation Mode
        setMapType('country');
        const countryMap: Record<string, { name: string; count: number }> = {};
        results.forEach((r) => {
          const code = r.country_code?.toUpperCase();
          if (code && code !== 'UNKNOWN') {
            const name = CANONICAL_COUNTRY_NAMES[code] || code;
            if (!countryMap[code]) {
              countryMap[code] = { name, count: 0 };
            }
            countryMap[code].count += 1;
          }
        });

        const uniqueCodes = Object.keys(countryMap);
        if (uniqueCodes.length === 0) {
          setMapSpokes([]);
          return;
        }

        const res = await fetch('/data/country-centers.json');
        if (!res.ok) throw new Error('Failed to load country coordinates');
        const centers: Record<string, { lat: number; lng: number }> = await res.json();

        const spokes = uniqueCodes
          .map((code) => {
            const center = centers[code];
            if (!center) return null;
            return {
              name: countryMap[code].name,
              lat: center.lat,
              lng: center.lng,
              count: countryMap[code].count,
              code: code
            };
          })
          .filter(Boolean);

        setMapSpokes(spokes);
      } catch (err: any) {
        setMapError(err.message);
      } finally {
        setMapLoading(false);
      }
    };

    fetchCountryCenters();
  }, [meet?.latitude, meet?.longitude, results]);

  // Participation-Aware Architecture: Expand all participations into distinct competitive entries
  const participationEntries = useMemo<ParticipationEntry[]>(() => {
    const entries: ParticipationEntry[] = [];

    results.forEach((r) => {
      const parts = r.participations && r.participations.length > 0
        ? r.participations
        : [{
            categoryCode: r.category,
            championshipType: 'U',
            totalRank: 1,
            snatchRank: 1,
            cleanJerkRank: 1,
            teamMember: true
          }];

      parts.forEach((p) => {
        const match = p.categoryCode?.match(/^([A-Za-z0-9]+)_([MF])(\d+|\+\d+)$/i);
        let divCode = 'OPEN';
        let gCode: 'M' | 'F' = (r.gender?.toUpperCase() === 'F' || r.category?.includes('_F')) ? 'F' : 'M';
        let rawWc = 'Open';

        if (match) {
          divCode = match[1].toUpperCase();
          gCode = match[2].toUpperCase() as 'M' | 'F';
          rawWc = match[3];
        } else if (p.categoryCode) {
          const partsCode = p.categoryCode.split('_');
          if (partsCode.length >= 2) {
            divCode = partsCode[0].toUpperCase();
            if (partsCode[1].startsWith('F')) gCode = 'F';
            if (partsCode[1].startsWith('M')) gCode = 'M';
            rawWc = partsCode[1].replace(/^[MF]/, '');
          }
        }

        let wcLabel = rawWc;
        if (rawWc === '999') {
          const maxVal = categoryPrefixMaxWc[`${divCode}_${gCode}`];
          wcLabel = maxVal ? `+${maxVal}kg` : '+kg';
        } else if (!rawWc.toLowerCase().includes('kg')) {
          wcLabel = `${rawWc}kg`;
        }

        const fed = getFederationInfo(divCode);

        entries.push({
          id: `${r.result_id}-${p.categoryCode}`,
          result: r,
          categoryCode: p.categoryCode,
          divisionCode: divCode,
          divisionLabel: getDivisionLabel(divCode),
          federationCode: fed.code,
          federationLabel: fed.label,
          gender: gCode,
          weightClass: wcLabel,
          totalRank: p.totalRank,
          snatchRank: p.snatchRank,
          cleanJerkRank: p.cleanJerkRank,
          teamMember: p.teamMember
        });
      });
    });

    return entries;
  }, [results, categoryPrefixMaxWc]);

  // Extract distinct federations
  const availableFederations = useMemo(() => {
    const map = new Map<string, { code: string; label: string; count: number }>();
    participationEntries.forEach((e) => {
      if (!map.has(e.federationCode)) {
        map.set(e.federationCode, {
          code: e.federationCode,
          label: e.federationLabel,
          count: 0
        });
      }
      map.get(e.federationCode)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [participationEntries]);

  // Extract distinct divisions filtered by selected federation
  const availableDivisions = useMemo(() => {
    const map = new Map<string, { code: string; label: string; count: number }>();
    participationEntries.forEach((e) => {
      if (selectedFederation !== 'ALL' && e.federationCode !== selectedFederation) {
        return;
      }
      if (!map.has(e.divisionCode)) {
        map.set(e.divisionCode, {
          code: e.divisionCode,
          label: e.divisionLabel,
          count: 0
        });
      }
      map.get(e.divisionCode)!.count++;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [participationEntries, selectedFederation]);

  // Filtered participation entries according to selected federation and division
  const filteredParticipationEntries = useMemo(() => {
    return participationEntries.filter((e) => {
      if (selectedFederation !== 'ALL' && e.federationCode !== selectedFederation) {
        return false;
      }
      if (selectedDivision !== 'ALL' && e.divisionCode !== selectedDivision) {
        return false;
      }
      return true;
    });
  }, [participationEntries, selectedFederation, selectedDivision]);

  // Filtered unique results for OWLanalytics mode or Session mode
  const filteredUniqueResults = useMemo(() => {
    const lifterIds = new Set(filteredParticipationEntries.map((e) => e.result.lifter_id));
    return results.filter((r) => lifterIds.has(r.lifter_id));
  }, [results, filteredParticipationEntries]);

  const toggleAthleteExpand = (lifterId: number) => {
    setExpandedAthletes((prev) => {
      const next = new Set(prev);
      if (next.has(lifterId)) {
        next.delete(lifterId);
      } else {
        next.add(lifterId);
      }
      return next;
    });
  };

  const toggleSection = (section: string, e?: React.MouseEvent) => {
    const targetEl = e?.currentTarget as HTMLElement | undefined;
    const topBefore = targetEl ? targetEl.getBoundingClientRect().top : null;
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
    if (topBefore !== null && targetEl) {
      requestAnimationFrame(() => {
        const topAfter = targetEl.getBoundingClientRect().top;
        const diff = topAfter - topBefore;
        if (Math.abs(diff) > 1) {
          window.scrollBy({ top: diff, behavior: 'instant' });
        }
      });
    }
  };

  const toggleSubrow = (key: string, e?: React.MouseEvent) => {
    const targetEl = e?.currentTarget as HTMLElement | undefined;
    const topBefore = targetEl ? targetEl.getBoundingClientRect().top : null;
    setExpandedSubrows((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
    if (topBefore !== null && targetEl) {
      requestAnimationFrame(() => {
        const topAfter = targetEl.getBoundingClientRect().top;
        const diff = topAfter - topBefore;
        if (Math.abs(diff) > 1) {
          window.scrollBy({ top: diff, behavior: 'instant' });
        }
      });
    }
  };

  const handleGroupBySession = (bySession: boolean) => {
    if (bySession === groupBySession) return;
    if (resultsContainerRef.current) {
      const currentHeight = resultsContainerRef.current.offsetHeight;
      setResultsMinHeight(currentHeight);
    }
    setGroupBySession(bySession);
  };

  const handleSort = (division: string, key: keyof ParticipationEntry | 'place') => {
    setSortConfig((prev) => {
      if (!prev || prev.division !== division || prev.key !== key) {
        return { division, key, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        return { division, key, direction: 'desc' };
      }
      return null;
    });
  };

  const getSortedEntries = (entries: ParticipationEntry[], divisionKey: string) => {
    const list = [...entries];

    const defaultSort = (a: ParticipationEntry, b: ParticipationEntry) => {
      // In session view with division filter, place ranked contenders at top
      if (a.totalRank !== null && a.totalRank !== undefined && (b.totalRank === null || b.totalRank === undefined)) {
        return -1;
      }
      if ((a.totalRank === null || a.totalRank === undefined) && b.totalRank !== null && b.totalRank !== undefined) {
        return 1;
      }
      if (a.totalRank && b.totalRank && a.totalRank !== b.totalRank) {
        return a.totalRank - b.totalRank;
      }
      const aTot = a.result.total ?? 0;
      const bTot = b.result.total ?? 0;
      if (aTot !== bTot) return bTot - aTot;
      return (a.result.body_weight_kg ?? 999) - (b.result.body_weight_kg ?? 999);
    };

    if (!sortConfig || sortConfig.division !== divisionKey) {
      return list.sort(defaultSort);
    }

    if (sortConfig.key === 'place') {
      list.sort(defaultSort);
      if (sortConfig.direction === 'desc') list.reverse();
      return list;
    }

    return list.sort((a, b) => {
      let valA: any = (a as any)[sortConfig.key];
      let valB: any = (b as any)[sortConfig.key];

      if (valA === undefined && (a.result as any)[sortConfig.key] !== undefined) {
        valA = (a.result as any)[sortConfig.key];
      }
      if (valB === undefined && (b.result as any)[sortConfig.key] !== undefined) {
        valB = (b.result as any)[sortConfig.key];
      }

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortConfig.direction === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    });
  };

  const getAthleteUrl = (r: LifterResult) => {
    return r.profile_url || `/athlete/owlcms/${r.lifter_id}`;
  };

  const menEntries = useMemo(() => filteredParticipationEntries.filter((e) => e.gender === 'M'), [filteredParticipationEntries]);
  const womenEntries = useMemo(() => filteredParticipationEntries.filter((e) => e.gender === 'F'), [filteredParticipationEntries]);

  // OWLanalytics Summary Table Logic
  const handleSummarySort = (
    gender: 'men' | 'women',
    key: keyof LifterResult | 'rank'
  ) => {
    const setConfig = gender === 'men' ? setMenSortConfig : setWomenSortConfig;
    setConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: key === 'rank' ? 'asc' : 'desc' };
      }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const renderSummaryTable = (
    title: string,
    data: LifterResult[],
    gender: 'men' | 'women',
    show: boolean,
    toggle: () => void
  ) => {
    const config = gender === 'men' ? menSortConfig : womenSortConfig;
    const activeSortKey = config?.key || 'rank';
    const activeDirection = config?.direction || 'asc';

    const sortedData = [...data].sort((a, b) => {
      if (activeSortKey === 'rank') {
        const qA = a.qpoints ?? 0;
        const qB = b.qpoints ?? 0;
        if (qA !== qB) {
          return activeDirection === 'asc' ? qB - qA : qA - qB;
        }
        return (b.total ?? 0) - (a.total ?? 0);
      }

      const valA = (a as any)[activeSortKey];
      const valB = (b as any)[activeSortKey];

      const numA = typeof valA === 'number' ? valA : parseFloat(valA) || 0;
      const numB = typeof valB === 'number' ? valB : parseFloat(valB) || 0;

      if (numA === 0 && numB !== 0) return 1;
      if (numA !== 0 && numB === 0) return -1;
      if (numA === 0 && numB === 0) return a.athlete_name.localeCompare(b.athlete_name);

      return activeDirection === 'asc' ? numA - numB : numB - numA;
    });

    const SortIndicator = ({ col }: { col: string }) => {
      if (activeSortKey !== col) return <span className="text-app-disabled ml-1">↕</span>;
      return <span className="text-accent-primary ml-1">{activeDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    const headerClass =
      'px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none';
    const qHeaderClass = (col: string) =>
      `px-2 py-1 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none ${
        activeSortKey === col ? 'text-accent-primary font-bold' : 'text-gray-900 dark:text-gray-200'
      }`;

    return (
      <div className="mb-4">
        <div className="mb-3">
          <button
            onClick={toggle}
            className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
          >
            {show ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <h2 className="text-2xl font-bold">{title}</h2>
            <span className="text-sm text-app-muted ml-2">({data.length} athletes)</span>
          </button>
        </div>

        {show && (
          <div className="card-primary mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                  <tr>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'rank')}>
                      Rank <SortIndicator col="rank" />
                    </th>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'athlete_name')}>
                      Name <SortIndicator col="athlete_name" />
                    </th>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'club_name')}>
                      Club / Country <SortIndicator col="club_name" />
                    </th>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'body_weight_kg')}>
                      Bwt <SortIndicator col="body_weight_kg" />
                    </th>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'category')}>
                      Wt. Class <SortIndicator col="category" />
                    </th>
                    <th className={headerClass}>Division</th>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'best_snatch')}>
                      BEST<br />SNATCH <SortIndicator col="best_snatch" />
                    </th>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'best_cj')}>
                      BEST<br />C&J <SortIndicator col="best_cj" />
                    </th>
                    <th className={headerClass} onClick={() => handleSummarySort(gender, 'total')}>
                      Total <SortIndicator col="total" />
                    </th>
                    <th className={qHeaderClass('q_youth')} onClick={() => handleSummarySort(gender, 'q_youth')}>
                      Q-Youth <SortIndicator col="q_youth" />
                    </th>
                    <th className={qHeaderClass('qpoints')} onClick={() => handleSummarySort(gender, 'qpoints')}>
                      Q-Points <SortIndicator col="qpoints" />
                    </th>
                    <th className={qHeaderClass('q_masters')} onClick={() => handleSummarySort(gender, 'q_masters')}>
                      Q-Masters <SortIndicator col="q_masters" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((r, idx) => {
                    const Flag = getCountryFlagComponent(r.country_code || meet?.country);
                    const displayRank = idx + 1;
                    return (
                      <tr
                        key={r.result_id}
                        className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors group"
                        style={{ borderTopColor: 'var(--border-secondary)' }}
                      >
                        <td className="px-2 py-2 text-sm font-semibold">
                          <div className="flex items-center gap-1">
                            <span>{displayRank}</span>
                            {displayRank === 1 && <Medal className="h-4 w-4" style={{ color: '#FFD700' }} />}
                            {displayRank === 2 && <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />}
                            {displayRank === 3 && <Medal className="h-4 w-4" style={{ color: '#CD7F32' }} />}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-sm max-w-[200px] truncate" title={r.athlete_name}>
                          <Link
                            href={getAthleteUrl(r)}
                            className="text-accent-primary hover:text-accent-primary-hover hover:underline flex items-center space-x-1"
                          >
                            <span>{r.athlete_name}</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          {getSessionDescriptor(r.session_name) && (
                            <div className="text-[11px] text-app-muted truncate" title={`Platform Competition Session: ${getSessionDescriptor(r.session_name)}`}>
                              {getSessionDescriptor(r.session_name)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            {Flag && <Flag style={{ width: '18px', height: '18px' }} />}
                            <span>{getDelegationLabel(r.club_name, r.country_code)}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-sm">{r.body_weight_kg ? `${r.body_weight_kg}kg` : '-'}</td>
                        <td className="px-2 py-2 text-sm">{r.parsedWeightClass || r.category}</td>
                        <td
                          className="px-2 py-2 text-sm max-w-[120px] leading-tight"
                          style={{ fontSize: '0.75rem', whiteSpace: 'normal', wordBreak: 'break-word' }}
                        >
                          {r.parsedDivision || 'Open'}
                        </td>
                        <td className="px-2 py-2 text-sm" style={{ color: 'var(--chart-snatch)' }}>
                          {r.best_snatch ? `${r.best_snatch}kg` : '-'}
                        </td>
                        <td className="px-2 py-2 text-sm" style={{ color: 'var(--chart-cleanjerk)' }}>
                          {r.best_cj ? `${r.best_cj}kg` : '-'}
                        </td>
                        <td className="px-2 py-2 text-sm font-bold" style={{ color: 'var(--chart-total)' }}>
                          {r.total ? `${r.total}kg` : '-'}
                        </td>
                        <td
                          className="px-2 py-2 text-sm font-medium"
                          style={{ color: (r.q_youth || 0) > 0 ? 'var(--chart-qyouth)' : 'inherit' }}
                        >
                          {(r.q_youth && r.q_youth > 0) ? r.q_youth.toFixed(2) : '-'}
                        </td>
                        <td
                          className="px-2 py-2 text-sm font-medium"
                          style={{ color: (r.qpoints || 0) > 0 ? 'var(--chart-qpoints)' : 'inherit' }}
                        >
                          {(r.qpoints && r.qpoints > 0) ? r.qpoints.toFixed(2) : '-'}
                        </td>
                        <td
                          className="px-2 py-2 text-sm font-medium"
                          style={{ color: (r.q_masters || 0) > 0 ? 'var(--chart-qmasters)' : 'inherit' }}
                        >
                          {(r.q_masters && r.q_masters > 0) ? r.q_masters.toFixed(2) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const formatOrdinalPlace = (rank: number | null | undefined): string => {
    if (!rank || rank <= 0) return '-';
    const j = rank % 10;
    const k = rank % 100;
    let suffix = 'th';
    if (j === 1 && k !== 11) suffix = 'st';
    else if (j === 2 && k !== 12) suffix = 'nd';
    else if (j === 3 && k !== 13) suffix = 'rd';
    return `${rank}${suffix} Place`;
  };

  // Chronological Attempt Progression Cascading Tree (GeographyCascade Pattern)
  const renderAttemptTimeline = (
    attemptNum: 1 | 2 | 3,
    actualWeight: number | null | undefined,
    declaration: number | null | undefined,
    progression: string | number | null | undefined,
    change1: number | null | undefined,
    change2: number | null | undefined,
    liftTime: string | null | undefined
  ) => {
    if (actualWeight === null || actualWeight === undefined || actualWeight === 0) {
      return (
        <div className="py-2 px-3 rounded border border-app-primary/15 bg-app-card/30 flex items-center justify-between text-xs">
          <span className="font-bold text-app-secondary">Attempt {attemptNum}</span>
          <span className="text-app-muted italic text-[11px]">Did not attempt</span>
        </div>
      );
    }

    const isGood = actualWeight > 0;
    const absWeight = Math.abs(actualWeight);
    const hasAuto = progression !== null && progression !== undefined && String(progression).trim() !== '';
    const autoNum = hasAuto ? Number(progression) : null;
    const isAutoAccepted = attemptNum > 1 && hasAuto && declaration !== null && declaration !== undefined && Number(declaration) === autoNum;
    const isAutoSuperseded = attemptNum > 1 && hasAuto && declaration !== null && declaration !== undefined && Number(declaration) !== autoNum;

    // Detect unchanged weight changes (e.g., Change 1 identical to Declaration)
    const isChange1Unchanged = change1 !== null && change1 !== undefined && declaration !== null && declaration !== undefined && Number(change1) === Number(declaration);
    const isChange2Unchanged = change2 !== null && change2 !== undefined && change1 !== null && change1 !== undefined && Number(change2) === Number(change1);
    const unchangedTooltip = "Official competition record reflects no alteration from the declared weight.";

    return (
      <div className="p-3 rounded-lg border border-app-primary/25 bg-app-card/40 space-y-2 text-xs">
        {/* Top Line: Attempt Number & Timestamp */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-app-primary text-sm">Attempt {attemptNum}</span>
          {liftTime && (
            <span className="text-[11px] text-app-muted" title="Official attempt timestamp">
              • {new Date(liftTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Cascading Progression Tree */}
        <div className="space-y-1.5 pt-1 text-[11px]">
          {/* Level 1: Initial Declaration */}
          <div>
            <div className="inline-flex items-center gap-2 py-1 px-2.5 rounded bg-app-surface/60 border border-app-primary/20 whitespace-nowrap">
              <span className="text-app-muted font-medium">Declaration:</span>
              <span className="font-semibold text-app-primary">
                {declaration || absWeight}kg
              </span>
            </div>
          </div>

          {/* Level 2: Change 1 (Indented under Declaration) */}
          {change1 && (
            <div className="ml-4 pl-2.5 border-l-2 border-accent-primary/40">
              <div className="inline-flex items-center gap-2 py-1 px-2.5 rounded bg-app-surface/60 border border-app-primary/20 whitespace-nowrap">
                <span className="text-app-muted font-medium">Change 1:</span>
                <span
                  className={`font-semibold text-app-primary ${
                    isChange1Unchanged ? 'underline decoration-dotted decoration-app-muted cursor-help' : ''
                  }`}
                  title={isChange1Unchanged ? unchangedTooltip : "First official weight change"}
                >
                  {change1}kg
                </span>
              </div>
            </div>
          )}

          {/* Level 3: Change 2 (Indented under Change 1) */}
          {change2 && (
            <div className="ml-8 pl-2.5 border-l-2 border-accent-primary/40">
              <div className="inline-flex items-center gap-2 py-1 px-2.5 rounded bg-app-surface/60 border border-app-primary/20 whitespace-nowrap">
                <span className="text-app-muted font-medium">Change 2:</span>
                <span
                  className={`font-semibold text-app-primary ${
                    isChange2Unchanged ? 'underline decoration-dotted decoration-app-muted cursor-help' : ''
                  }`}
                  title={isChange2Unchanged ? unchangedTooltip : "Second official weight change"}
                >
                  {change2}kg
                </span>
              </div>
            </div>
          )}

          {/* Level 4: Loaded Barbell (Indented neutrally under final call) */}
          <div className={`${change2 ? 'ml-12' : change1 ? 'ml-8' : 'ml-4'} pl-2.5 border-l-2 border-app-primary/30`}>
            <div className="inline-flex items-center gap-2 py-1 px-2.5 rounded bg-app-surface/80 border border-app-primary/30 text-app-primary whitespace-nowrap">
              <span className="font-medium text-app-muted">Loaded:</span>
              <span className="font-bold text-app-primary">
                {absWeight}kg
              </span>
            </div>
          </div>

          {/* Level 5: Attempt Result (Nested tabbed over piece at the bottom) */}
          <div className={`${change2 ? 'ml-16' : change1 ? 'ml-12' : 'ml-8'} pl-2.5 border-l-2 ${isGood ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
            <span
              className={`inline-flex items-center font-semibold px-2 py-0.5 rounded text-[11px] border shrink-0 ${
                isGood
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}
            >
              {absWeight}kg {isGood ? 'Good Lift' : 'No Lift'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Participation-Aware Division Table Renderer
  const renderParticipationDivisionTable = (entries: ParticipationEntry[], divisionKey: string) => (
    <div className="border-t border-app-primary overflow-x-auto">
      <table className="border-separate w-full" style={{ borderSpacing: 0 }}>
        <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
          <tr className="border-b-2 border-gray-400 dark:border-gray-500">
            <th
              onClick={() => handleSort(divisionKey, 'place')}
              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
              style={{ width: '48px' }}
            >
              <div className="flex items-center justify-start space-x-1">
                <span>Rank</span>
                <SortIcon column="place" sortConfig={sortConfig} division={divisionKey} />
              </div>
            </th>
            <th
              onClick={() => handleSort(divisionKey, 'athlete_name' as any)}
              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none"
              style={{ minWidth: '170px' }}
            >
              <div className="flex items-center justify-start space-x-1">
                <span>Athlete</span>
                <SortIcon column="athlete_name" sortConfig={sortConfig} division={divisionKey} />
              </div>
            </th>
            <th
              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none"
              style={{ minWidth: '100px' }}
            >
              <span>Club / Country</span>
            </th>
            <th
              className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none"
              style={{ width: '60px' }}
            >
              <span>Bwt</span>
            </th>
            {viewMode === 'owlcms' && (
              <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none" style={{ width: '60px' }}>
                <span>Entry</span>
              </th>
            )}
            <th
              className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none"
              style={{ width: '84px' }}
            >
              <span>Snatch</span>
            </th>
            <th
              className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none"
              style={{ width: '84px' }}
            >
              <span>C&J</span>
            </th>
            <th
              className="px-2 py-1 text-right text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none"
              style={{ width: '74px' }}
            >
              <span>Total</span>
            </th>
            {viewMode === 'owlcms' && (
              <th className="px-2 py-1 text-center text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider select-none" style={{ width: '32px' }}>
                <span>Details</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {getSortedEntries(entries, divisionKey).map((entry, index) => {
            const result = entry.result;
            const displayRank = entry.totalRank !== undefined && entry.totalRank !== null ? entry.totalRank : (groupBySession ? null : index + 1);
            const snatchRank = entry.snatchRank;
            const cjRank = entry.cleanJerkRank;
            const isExpanded = expandedAthletes.has(result.lifter_id);
            const Flag = getCountryFlagComponent(result.country_code || meet?.country);
            const raw = result.raw_payload || {};
            const entryTot = raw.entryTotal || raw.qualifyingTotal;
            const hasMultipleParts = (result.participations?.length || 0) > 1;

            return (
              <React.Fragment key={entry.id}>
                <tr
                  className={`border-t first:border-t-0 transition-colors group cursor-pointer ${
                    entry.totalRank === null && groupBySession ? 'opacity-60 hover:opacity-100 ' : ''
                  }${isExpanded ? 'border-l-4 border-accent-primary ' : ''
                  }${
                    index % 2 === 1
                      ? 'dark:bg-gray-600/15 bg-gray-400/10 hover:bg-app-hover'
                      : 'hover:bg-app-hover'
                  }`}
                  style={{ borderTopColor: 'var(--border-secondary)' }}
                  onClick={() => viewMode === 'owlcms' && toggleAthleteExpand(result.lifter_id)}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm font-medium text-app-primary">
                    <div className="flex items-center gap-1">
                      <span>{displayRank || '-'}</span>
                      {displayRank === 1 && <Medal className="h-4 w-4" style={{ color: '#FFD700' }} />}
                      {displayRank === 2 && <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />}
                      {displayRank === 3 && <Medal className="h-4 w-4" style={{ color: '#CD7F32' }} />}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={getAthleteUrl(result)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center space-x-1 text-accent-primary group-hover:text-accent-primary-hover transition-colors hover:underline"
                      >
                        <span className="font-medium text-sm">{result.athlete_name}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {groupBySession && entry.divisionLabel && (
                        <span
                          className="px-1.5 py-0.5 bg-accent-secondary/20 text-accent-secondary rounded text-[10px] font-semibold"
                          title={`Division: ${entry.divisionLabel}`}
                        >
                          {entry.divisionLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-app-muted flex items-center gap-1 flex-wrap">
                      {result.competition_age ? (
                        <span>Age {result.competition_age}</span>
                      ) : result.birth_year ? (
                        <span>b. {result.birth_year}</span>
                      ) : null}
                      {getSessionDescriptor(result.session_name) && (
                        <>
                          <span>•</span>
                          <span
                            className="font-medium text-app-secondary"
                            title={`Platform Competition Session: ${getSessionDescriptor(result.session_name)}`}
                          >
                            {getSessionDescriptor(result.session_name)}
                          </span>
                        </>
                      )}
                      {result.lot_number && (
                        <>
                          <span>•</span>
                          <span
                            className="underline decoration-dotted decoration-app-muted cursor-help"
                            title="Random number drawn at weigh-in. When two athletes attempt the same barbell weight on the same attempt, the athlete with the lower lot number must lift first."
                          >
                            Lot {result.lot_number}
                          </span>
                        </>
                      )}
                      {(raw.startNumber || result.start_number) && (
                        <>
                          <span>•</span>
                          <span
                            className="underline decoration-dotted decoration-app-muted cursor-help"
                            title="Official start number assigned after weigh-in matching the competition bib. In multi-category sessions, allocated category by category from lowest to highest, in numerical sequence of lot numbers."
                          >
                            Start #{raw.startNumber || result.start_number}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-app-secondary">
                    <div className="flex items-center gap-2">
                      {Flag && <Flag style={{ width: '18px', height: '18px' }} />}
                      <span className="text-sm">
                        {getDelegationLabel(result.club_name, result.country_code)}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-app-secondary text-left">
                    <div>{result.body_weight_kg ? `${result.body_weight_kg}kg` : '-'}</div>
                    {viewMode === 'owlcms' && result.scale_weight_kg && result.scale_weight_kg !== result.body_weight_kg && (
                      <div className="text-[10px] text-app-muted">scale: {result.scale_weight_kg}kg</div>
                    )}
                  </td>
                  {viewMode === 'owlcms' && (
                    <td className="px-2 py-1.5 whitespace-nowrap text-sm text-app-muted">
                      {entryTot ? `${entryTot}kg` : '-'}
                    </td>
                  )}
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-right" style={{ color: 'var(--chart-snatch)' }}>
                    <div className="font-medium flex items-center justify-end gap-1">
                      <span>{result.best_snatch ? `${result.best_snatch}kg` : '-'}</span>
                      {viewMode === 'owlcms' && snatchRank && (
                        <span className="text-[10px] text-app-muted flex items-center gap-0.5">
                          (#{snatchRank})
                          {snatchRank === 1 && <Medal className="h-3 w-3 inline" style={{ color: '#FFD700' }} />}
                          {snatchRank === 2 && <Medal className="h-3 w-3 inline" style={{ color: '#C0C0C0' }} />}
                          {snatchRank === 3 && <Medal className="h-3 w-3 inline" style={{ color: '#CD7F32' }} />}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-app-muted">
                      {[result.snatch_1, result.snatch_2, result.snatch_3]
                        .filter((a) => a !== null && a !== undefined && a !== 0)
                        .map((attempt, i, arr) => {
                          const w = Number(attempt);
                          return (
                            <span
                              key={i}
                              className={w > 0 ? '' : 'text-red-500 font-semibold'}
                              style={w > 0 ? { color: 'var(--chart-snatch)' } : {}}
                            >
                              {Math.abs(w)}
                              {i < arr.length - 1 ? ' / ' : ''}
                            </span>
                          );
                        })}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-sm text-right" style={{ color: 'var(--chart-cleanjerk)' }}>
                    <div className="font-medium flex items-center justify-end gap-1">
                      <span>{result.best_cj ? `${result.best_cj}kg` : '-'}</span>
                      {viewMode === 'owlcms' && cjRank && (
                        <span className="text-[10px] text-app-muted flex items-center gap-0.5">
                          (#{cjRank})
                          {cjRank === 1 && <Medal className="h-3 w-3 inline" style={{ color: '#FFD700' }} />}
                          {cjRank === 2 && <Medal className="h-3 w-3 inline" style={{ color: '#C0C0C0' }} />}
                          {cjRank === 3 && <Medal className="h-3 w-3 inline" style={{ color: '#CD7F32' }} />}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-app-muted">
                      {[result.cj_1, result.cj_2, result.cj_3]
                        .filter((a) => a !== null && a !== undefined && a !== 0)
                        .map((attempt, i, arr) => {
                          const w = Number(attempt);
                          return (
                            <span
                              key={i}
                              className={w > 0 ? '' : 'text-red-500 font-semibold'}
                              style={w > 0 ? { color: 'var(--chart-cleanjerk)' } : {}}
                            >
                              {Math.abs(w)}
                              {i < arr.length - 1 ? ' / ' : ''}
                            </span>
                          );
                        })}
                    </div>
                  </td>
                  <td
                    className="px-2 py-1.5 whitespace-nowrap text-sm font-bold text-right"
                    style={{ color: 'var(--chart-total)' }}
                  >
                    <div>{result.total ? `${result.total}kg` : '-'}</div>
                  </td>
                  {viewMode === 'owlcms' && (
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        aria-label={isExpanded ? "Collapse athlete details" : "Expand athlete details"}
                        className="p-1 rounded-md text-app-muted hover:text-accent-primary hover:bg-app-hover transition-colors inline-flex items-center justify-center"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-accent-primary" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                  )}
                </tr>

                {/* Expandable Technical Details Drawer */}
                {viewMode === 'owlcms' && isExpanded && (
                  <tr
                    className={`border-l-4 border-accent-primary ${
                      index % 2 === 1 ? 'dark:bg-gray-600/15 bg-gray-400/10' : ''
                    }`}
                  >
                    <td colSpan={viewMode === 'owlcms' ? 9 : 7} className="p-4 border-b border-app-primary">
                      <div className="space-y-4 max-w-5xl">
                        {/* Header metadata row */}
                        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-app-secondary border-b border-app-primary/40 pb-2">
                          <div className="flex items-center gap-3">
                            <div>
                              <strong className="font-bold text-app-primary">{result.athlete_name}</strong>{' '}
                              <span className="font-normal text-app-secondary">Attempt Progression & Scorecard Details</span>
                            </div>
                            <span>•</span>
                            <span
                              className="underline decoration-dotted decoration-app-muted cursor-help"
                              title="Random number drawn at weigh-in. When two athletes attempt the same barbell weight on the same attempt, the athlete with the lower lot number must lift first."
                            >
                              Lot #{result.lot_number || '-'}
                            </span>
                            {(raw.startNumber || result.start_number) && (
                              <>
                                <span>•</span>
                                <span
                                  className="underline decoration-dotted decoration-app-muted cursor-help"
                                  title="Official start number assigned after weigh-in matching the competition bib. In multi-category sessions, allocated category by category from lowest to highest, in numerical sequence of lot numbers."
                                >
                                  Start #{raw.startNumber || result.start_number}
                                </span>
                              </>
                            )}
                            <span>•</span>
                            <span title="Official competition platform and session assignment">Session: {getSessionDescriptor(result.session_name) || result.session_name || 'General'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span title="Official bodyweight recorded at technical weigh-in">
                              Official Bodyweight: <strong className="text-app-primary">{result.body_weight_kg}kg</strong>
                            </span>
                            {result.scale_weight_kg && (
                              <span title="Exact scale weight reading before rounding">
                                Scale Reading: <strong className="text-app-primary">{result.scale_weight_kg}kg</strong>
                              </span>
                            )}
                            {entryTot && (
                              <span title="Declared entry total or qualifying total">
                                Entry Total: <strong className="text-app-primary">{entryTot}kg</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Categories and Participations */}
                        {result.participations && result.participations.length > 0 && (
                          <div>
                            <h5 className="text-xs font-bold text-app-primary mb-1.5 flex items-center gap-1">
                              <ClipboardList className="h-3.5 w-3.5 text-accent-primary" />
                              <span>Categories & Official Placings ({result.participations.length}):</span>
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {result.participations.map((p, pIdx) => {
                                const match = p.categoryCode?.match(/^([A-Za-z0-9]+)_/);
                                const prefix = match ? match[1].toUpperCase() : p.categoryCode;
                                return (
                                  <div
                                    key={pIdx}
                                    className="p-2.5 rounded-lg border border-app-primary bg-app-surface text-xs space-y-1"
                                  >
                                    <div className="font-semibold text-app-primary flex items-center justify-between">
                                      <span>{getDivisionLabel(prefix)}</span>
                                      <span className="text-[10px] text-accent-secondary font-mono">{p.categoryCode}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-app-secondary">
                                      <span>Total: <strong className="text-app-primary font-bold">{formatOrdinalPlace(p.totalRank)}</strong></span>
                                      <span>Snatch: <strong className="text-app-primary">{formatOrdinalPlace(p.snatchRank)}</strong></span>
                                      <span>C&J: <strong className="text-app-primary">{formatOrdinalPlace(p.cleanJerkRank)}</strong></span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Attempt Progression Sheet (Side-by-Side Cards) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Snatch attempts */}
                          <div className="p-3.5 rounded-lg border border-app-primary bg-app-surface space-y-3">
                            <div className="font-bold text-app-primary flex items-center justify-between pb-1.5 border-b border-app-primary/30" style={{ color: 'var(--chart-snatch)' }}>
                              <span className="text-sm font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--chart-snatch)' }}></span>
                                Snatch Attempts
                              </span>
                              <span className="text-xs font-semibold">Best: {result.best_snatch ? `${result.best_snatch}kg` : '-'}</span>
                            </div>
                            <div className="space-y-2">
                              {renderAttemptTimeline(1, result.snatch_1, raw.snatch1Declaration, null, raw.snatch1Change1, raw.snatch1Change2, result.snatch_1_time)}
                              {renderAttemptTimeline(2, result.snatch_2, raw.snatch2Declaration, raw.snatch2AutomaticProgression, raw.snatch2Change1, raw.snatch2Change2, result.snatch_2_time)}
                              {renderAttemptTimeline(3, result.snatch_3, raw.snatch3Declaration, raw.snatch3AutomaticProgression, raw.snatch3Change1, raw.snatch3Change2, result.snatch_3_time)}
                            </div>
                          </div>

                          {/* Clean & Jerk attempts */}
                          <div className="p-3.5 rounded-lg border border-app-primary bg-app-surface space-y-3">
                            <div className="font-bold text-app-primary flex items-center justify-between pb-1.5 border-b border-app-primary/30" style={{ color: 'var(--chart-cleanjerk)' }}>
                              <span className="text-sm font-bold flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--chart-cleanjerk)' }}></span>
                                Clean & Jerk Attempts
                              </span>
                              <span className="text-xs font-semibold">Best: {result.best_cj ? `${result.best_cj}kg` : '-'}</span>
                            </div>
                            <div className="space-y-2">
                              {renderAttemptTimeline(1, result.cj_1, raw.cleanJerk1Declaration, null, raw.cleanJerk1Change1, raw.cleanJerk1Change2, result.cj_1_time)}
                              {renderAttemptTimeline(2, result.cj_2, raw.cleanJerk2Declaration, raw.cleanJerk2AutomaticProgression, raw.cleanJerk2Change1, raw.cleanJerk2Change2, result.cj_2_time)}
                              {renderAttemptTimeline(3, result.cj_3, raw.cleanJerk3Declaration, raw.cleanJerk3AutomaticProgression, raw.cleanJerk3Change1, raw.cleanJerk3Change2, result.cj_3_time)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Platform Session Grouping Renderer
  const renderSessionGroups = (list: LifterResult[]) => {
    const sessionMap: Record<string, LifterResult[]> = {};
    list.forEach((r) => {
      const sess = r.session_name || 'General Session';
      if (!sessionMap[sess]) sessionMap[sess] = [];
      sessionMap[sess].push(r);
    });

    const parseSessionKey = (key: string) => {
      const isWomen = /^[FW]/i.test(key);
      const isMen = /^[MH]/i.test(key);
      const genderScore = isWomen ? 1 : isMen ? 2 : 3;
      const isPlus = key.includes('+');
      const nums = (key.match(/\d+/g) || []).map(Number);
      const minNum = nums.length > 0 ? Math.min(...nums) : 0;
      const weightScore = isPlus ? 1000 + minNum : minNum;
      let groupScore = 2;
      if (/\bB\b/i.test(key)) groupScore = 1;
      else if (/\bA\b/i.test(key)) groupScore = 3;
      return { genderScore, weightScore, groupScore };
    };

    const sessionKeys = Object.keys(sessionMap).sort((a, b) => {
      const metaA = sessionMetaMap[a];
      const metaB = sessionMetaMap[b];
      if (metaA && metaB && metaA.sessionNumber !== metaB.sessionNumber) {
        return metaA.sessionNumber - metaB.sessionNumber;
      }
      if (metaA && !metaB) return -1;
      if (!metaA && metaB) return 1;

      const intA = parseInt(a, 10);
      const intB = parseInt(b, 10);
      if (!isNaN(intA) && !isNaN(intB) && String(intA) === a.trim() && String(intB) === b.trim()) {
        return intA - intB;
      }
      const pA = parseSessionKey(a);
      const pB = parseSessionKey(b);
      if (pA.genderScore !== pB.genderScore) return pA.genderScore - pB.genderScore;
      if (pA.weightScore !== pB.weightScore) return pA.weightScore - pB.weightScore;
      if (pA.groupScore !== pB.groupScore) return pA.groupScore - pB.groupScore;
      return a.localeCompare(b);
    });

    return (
      <div className="space-y-4">
        {sessionKeys.map((sessKey) => {
          const sessResults = sessionMap[sessKey];
          const isCollapsed = collapsedSections.has(`Session-${sessKey}`);
          const activeFilter = sessionDivisionFilters[sessKey] || 'ALL';

          // Discover all unique divisions present in this session
          const sessionDivisionsMap = new Map<string, { code: string; label: string; count: number }>();
          sessResults.forEach((r) => {
            (r.participations || []).forEach((p) => {
              const match = p.categoryCode?.match(/^([A-Za-z0-9]+)_/);
              const prefix = match ? match[1].toUpperCase() : p.categoryCode;
              if (prefix) {
                if (!sessionDivisionsMap.has(prefix)) {
                  sessionDivisionsMap.set(prefix, { code: prefix, label: getDivisionLabel(prefix), count: 0 });
                }
                sessionDivisionsMap.get(prefix)!.count++;
              }
            });
          });
          const sessionDivisions = Array.from(sessionDivisionsMap.values());

          // Compute rankings across this session based on activeFilter
          const totalRankMap = new Map<number, number>();
          const snatchRankMap = new Map<number, number>();
          const cjRankMap = new Map<number, number>();

          if (activeFilter === 'ALL') {
            // Overall session ranking across ALL athletes in this session
            const totalSorted = [...sessResults]
              .filter((r) => r.total !== null && r.total !== undefined && Number(r.total) > 0)
              .sort((a, b) => {
                const diff = (Number(b.total) || 0) - (Number(a.total) || 0);
                if (diff !== 0) return diff;
                return (Number(a.body_weight_kg) || 999) - (Number(b.body_weight_kg) || 999);
              });
            totalSorted.forEach((r, idx) => totalRankMap.set(r.result_id, idx + 1));

            const snatchSorted = [...sessResults]
              .filter((r) => r.best_snatch !== null && r.best_snatch !== undefined && Number(r.best_snatch) > 0)
              .sort((a, b) => {
                const diff = (Number(b.best_snatch) || 0) - (Number(a.best_snatch) || 0);
                if (diff !== 0) return diff;
                return (Number(a.body_weight_kg) || 999) - (Number(b.body_weight_kg) || 999);
              });
            snatchSorted.forEach((r, idx) => snatchRankMap.set(r.result_id, idx + 1));

            const cjSorted = [...sessResults]
              .filter((r) => r.best_cj !== null && r.best_cj !== undefined && Number(r.best_cj) > 0)
              .sort((a, b) => {
                const diff = (Number(b.best_cj) || 0) - (Number(a.best_cj) || 0);
                if (diff !== 0) return diff;
                return (Number(a.body_weight_kg) || 999) - (Number(b.body_weight_kg) || 999);
              });
            cjSorted.forEach((r, idx) => cjRankMap.set(r.result_id, idx + 1));
          }

          // Create temporary participation entries for the session view
          const sessionEntries: ParticipationEntry[] = sessResults.map((r) => {
            const matchingPart = activeFilter !== 'ALL'
              ? r.participations?.find(
                  (p) =>
                    p.categoryCode?.toUpperCase().startsWith(activeFilter + '_') ||
                    p.categoryCode?.toUpperCase() === activeFilter
                )
              : undefined;
            const isEligible = Boolean(matchingPart);
            const activeDivisionBadge = isEligible ? getDivisionLabel(activeFilter) : '';

            const totalRank = activeFilter === 'ALL'
              ? (totalRankMap.get(r.result_id) ?? null)
              : (matchingPart?.totalRank && matchingPart.totalRank > 0 ? matchingPart.totalRank : null);
            const snatchRank = activeFilter === 'ALL'
              ? (snatchRankMap.get(r.result_id) ?? null)
              : (matchingPart?.snatchRank && matchingPart.snatchRank > 0 ? matchingPart.snatchRank : null);
            const cleanJerkRank = activeFilter === 'ALL'
              ? (cjRankMap.get(r.result_id) ?? null)
              : (matchingPart?.cleanJerkRank && matchingPart.cleanJerkRank > 0 ? matchingPart.cleanJerkRank : null);

            return {
              id: `${r.result_id}-${activeFilter}`,
              result: r,
              categoryCode: matchingPart?.categoryCode || r.category,
              divisionCode: activeFilter,
              divisionLabel: activeDivisionBadge,
              federationCode: 'SESSION',
              federationLabel: 'Session',
              gender: (r.parsedGender || 'M') as 'M' | 'F',
              weightClass: r.parsedWeightClass || 'Open',
              totalRank,
              snatchRank,
              cleanJerkRank
            };
          });

          return (
            <div key={sessKey} className="card-primary p-0 mb-4">
              <div
                onClick={(e) => toggleSection(`Session-${sessKey}`, e)}
                className="cursor-pointer hover:bg-app-hover transition-colors p-4 rounded-t-lg flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  <h3 className="text-xl font-bold text-app-primary">
                    {getSessionDescriptor(sessKey) || `Platform Session: ${sessKey}`}
                  </h3>
                </div>
                <span className="text-sm text-app-muted">({sessResults.length} athletes)</span>
              </div>
              {!isCollapsed && sessionDivisions.length > 1 && (
                <div className="px-4 py-2.5 bg-app-surface/60 border-t border-b border-app-primary/20 flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-semibold text-app-muted">Rankings by Division:</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSessionDivisionFilters((prev) => ({ ...prev, [sessKey]: 'ALL' }));
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      activeFilter === 'ALL'
                        ? 'bg-accent-primary text-white shadow-sm'
                        : 'bg-app-card text-app-secondary hover:text-app-primary hover:bg-app-hover border border-app-primary/20'
                    }`}
                  >
                    All Athletes ({sessResults.length})
                  </button>
                  {sessionDivisions.map((div) => (
                    <button
                      key={div.code}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionDivisionFilters((prev) => ({ ...prev, [sessKey]: div.code }));
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                        activeFilter === div.code
                          ? 'bg-accent-primary text-white shadow-sm'
                          : 'bg-app-card text-app-secondary hover:text-app-primary hover:bg-app-hover border border-app-primary/20'
                      }`}
                    >
                      {div.label} ({div.count})
                    </button>
                  ))}
                </div>
              )}
              {!isCollapsed && renderParticipationDivisionTable(sessionEntries, `session-${sessKey}`)}
            </div>
          );
        })}
      </div>
    );
  };

  // Gender Weight Class Accordion Renderer
  const buildGenderSections = (entries: ParticipationEntry[], genderSectionTitle: string) => {
    const isCollapsed = collapsedSections.has(genderSectionTitle);
    if (entries.length === 0) return null;

    const sortWcNum = (wc: string) => {
      const hasPlus = wc.includes('+');
      const num = parseFloat(wc.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? -1 : num + (hasPlus ? 0.1 : 0);
    };

    // Group entries by weight class
    const wcMap: Record<string, ParticipationEntry[]> = {};
    entries.forEach((e) => {
      const wc = e.weightClass || 'Open';
      if (!wcMap[wc]) wcMap[wc] = [];
      wcMap[wc].push(e);
    });

    const sortedWcs = Object.keys(wcMap).sort((a, b) => sortWcNum(b) - sortWcNum(a));

    return (
      <div key={genderSectionTitle} className={isCollapsed ? 'mb-2' : 'mb-6'}>
        <div className="mb-3">
          <button
            onClick={(e) => toggleSection(genderSectionTitle, e)}
            className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            <h2 className="text-2xl font-bold">{genderSectionTitle}</h2>
            <span className="ml-2 text-sm font-normal text-app-muted">({entries.length} entries)</span>
          </button>
        </div>

        {!isCollapsed &&
          sortedWcs.map((wc) => {
            const allWcEntries = wcMap[wc];
            const wcKey = `${genderSectionTitle}-${wc}`;
            const isWcCollapsed = !expandedSubrows.has(wcKey);

            // Group entries by Division within this weight class
            const divMap: Record<string, ParticipationEntry[]> = {};
            allWcEntries.forEach((e) => {
              const label = e.divisionLabel || 'Open';
              if (!divMap[label]) divMap[label] = [];
              divMap[label].push(e);
            });

            // De-duplicated unique athletes in this weight class
            const uniqueAthletesCount = new Set(allWcEntries.map((e) => e.result.lifter_id)).size;

            return (
              <div key={wcKey} className="card-primary p-0 mb-3 w-full">
                <div
                  onClick={(e) => toggleSubrow(wcKey, e)}
                  className="cursor-pointer hover:bg-app-hover transition-colors rounded-t-lg"
                >
                  <h3 className="text-xl font-bold px-3 py-2 flex items-center text-app-primary">
                    {isWcCollapsed ? <ChevronRight className="h-5 w-5 mr-2" /> : <ChevronDown className="h-5 w-5 mr-2" />}
                    <span>{wc}</span>
                    <span className="ml-auto text-sm text-app-muted">
                      {uniqueAthletesCount} athletes ({allWcEntries.length} division {allWcEntries.length === 1 ? 'entry' : 'entries'})
                    </span>
                  </h3>
                </div>

                {!isWcCollapsed && (
                  <div className="border-t border-app-primary px-2 sm:px-3 pb-3">
                    <div className="mt-3 mb-2 space-y-2">
                      {Object.entries(divMap).map(([divName, divEntries]) => {
                        const childKey = `${wcKey}-${divName}`;
                        const isChildCollapsed = !expandedSubrows.has(childKey);

                        return (
                          <div key={childKey} className="ml-1 sm:ml-3 border-l-4 border-accent-primary rounded-r-lg">
                            <div
                              onClick={(e) => toggleSubrow(childKey, e)}
                              className="cursor-pointer hover:bg-app-hover transition-colors rounded-tr-lg"
                            >
                              <h4 className="text-base font-bold p-2 flex items-center text-app-primary">
                                {isChildCollapsed ? (
                                  <ChevronRight className="h-4 w-4 mr-2 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 mr-2 text-gray-400" />
                                )}
                                <span className="mr-2 text-app-muted">↳</span>
                                <span>{divName}</span>
                                <span className="ml-auto text-sm text-app-muted">{divEntries.length} competitors</span>
                              </h4>
                            </div>
                            {!isChildCollapsed && renderParticipationDivisionTable(divEntries, childKey)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-accent-primary mx-auto" />
          <p className="text-sm text-app-muted">Loading competition results...</p>
        </div>
      </div>
    );
  }

  if (error || !meet) {
    return (
      <div className="min-h-screen bg-app-gradient flex items-center justify-center p-6">
        <div className="card-primary max-w-md p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-app-primary">Meet Not Found</h2>
          <p className="text-sm text-app-muted">{error || 'Unable to locate this competition record.'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-semibold rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Meets</span>
          </Link>
        </div>
      </div>
    );
  }

  const locationParts = [meet.venue, meet.city, meet.country].filter(Boolean);
  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : 'Location TBD';
  const federationName =
    meet.federation_details?.canonical_name ||
    meet.federation ||
    meet.organizer ||
    'owlcms Competition';

  return (
    <div className="min-h-screen bg-app-gradient">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation & Theme Switcher */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-app-tertiary hover:text-accent-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meets
          </Link>
          <ThemeSwitcher />
        </div>

        {/* Meet Header Card */}
        <div className="card-primary mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded bg-accent-primary/20 text-accent-primary text-xs font-semibold uppercase tracking-wider">
                  owlcms Meet
                </span>
              </div>
              <h1 className="text-3xl font-bold text-app-primary mb-2">{meet.meet_name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-app-secondary">
                {meet.start_date && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {new Date(meet.start_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>{locationStr}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Trophy className="h-4 w-4" />
                  <span>{federationName}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>{results.length} Athletes ({participationEntries.length} Categories)</span>
                </div>
              </div>
            </div>

            {/* View Mode Segmented Switch */}
            <div className="flex items-center p-1 bg-app-surface/90 border border-app-primary rounded-xl self-start">
              <button
                onClick={() => setViewMode('owlcms')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'owlcms'
                    ? 'bg-accent-primary text-white shadow-sm'
                    : 'text-app-muted hover:text-app-primary'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>owlcms Results & Rankings</span>
              </button>
              <button
                onClick={() => setViewMode('owlanalytics')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'owlanalytics'
                    ? 'bg-accent-primary text-white shadow-sm'
                    : 'text-app-muted hover:text-app-primary'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Custom Analytics</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hub and Spoke Map */}
        {meet.latitude && meet.longitude && (
          <div className="card-primary mb-8">
            <MeetHubSpokeMap
              meetLat={meet.latitude}
              meetLng={meet.longitude}
              spokes={mapSpokes}
              type={mapType}
              loading={mapLoading}
              error={mapError}
            />
          </div>
        )}

        {/* owlcms Filter & Grouping Control Bar */}
        {viewMode === 'owlcms' && (
          <div ref={controlBarRef} className="card-primary mb-6 p-4 space-y-3">
            {/* Federation Filter Row (when multiple federations present) */}
            {availableFederations.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap border-b border-app-primary/40 pb-2.5">
                <span className="text-xs font-semibold text-app-muted uppercase flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" />
                  Federation:
                </span>
                <button
                  onClick={() => {
                    setSelectedFederation('ALL');
                    setSelectedDivision('ALL');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    selectedFederation === 'ALL'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'bg-app-surface text-app-secondary hover:text-app-primary border border-app-primary/30'
                  }`}
                >
                  All Federations ({participationEntries.length})
                </button>
                {availableFederations.map((fed) => (
                  <button
                    key={fed.code}
                    onClick={() => {
                      setSelectedFederation((prev) => (prev === fed.code ? 'ALL' : fed.code));
                      setSelectedDivision('ALL');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedFederation === fed.code
                        ? 'bg-accent-primary text-white shadow-sm'
                        : 'bg-app-surface text-app-secondary hover:text-app-primary border border-app-primary/30'
                    }`}
                  >
                    {fed.label} ({fed.count})
                  </button>
                ))}
              </div>
            )}

            {/* Division Filter & Session Grouping Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-app-muted uppercase flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  Division:
                </span>
                <button
                  onClick={() => setSelectedDivision('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    selectedDivision === 'ALL'
                      ? 'bg-accent-primary text-white shadow-sm'
                      : 'bg-app-surface text-app-secondary hover:text-app-primary border border-app-primary/30'
                  }`}
                >
                  All Divisions ({filteredParticipationEntries.length})
                </button>
                {availableDivisions.map((div) => (
                  <button
                    key={div.code}
                    onClick={() => setSelectedDivision((prev) => (prev === div.code ? 'ALL' : div.code))}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      selectedDivision === div.code
                        ? 'bg-accent-primary text-white shadow-sm'
                        : 'bg-app-surface text-app-secondary hover:text-app-primary border border-app-primary/30'
                    }`}
                  >
                    {div.label} ({div.count})
                  </button>
                ))}
              </div>

              {/* Group By Segmented Control */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-app-muted uppercase">Group By:</span>
                <div className="inline-flex rounded-lg border border-app-primary p-0.5 bg-app-surface">
                  <button
                    onClick={() => handleGroupBySession(false)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      !groupBySession
                        ? 'bg-accent-primary text-white shadow-sm'
                        : 'text-app-muted hover:text-app-primary'
                    }`}
                  >
                    Weight Class
                  </button>
                  <button
                    onClick={() => handleGroupBySession(true)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                      groupBySession
                        ? 'bg-accent-primary text-white shadow-sm'
                        : 'text-app-muted hover:text-app-primary'
                    }`}
                  >
                    <Clock className="h-3 w-3" />
                    Platform Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OWLanalytics Metrics Mode: GAMX and Q-Points Overall Rankings */}
        {viewMode === 'owlanalytics' && (
          <>
            {/* Overall Rankings by GAMX */}
            {(() => {
              const handleGamxSort = (key: string) => {
                setGamxSortConfig((prev) =>
                  prev.key === key
                    ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                    : { key, direction: 'desc' }
                );
              };

              const sortedGamx = [...filteredUniqueResults].sort((a, b) => {
                const aVal = (a as any)[gamxSortConfig.key] ?? 0;
                const bVal = (b as any)[gamxSortConfig.key] ?? 0;

                if (aVal === 0 && bVal !== 0) return 1;
                if (aVal !== 0 && bVal === 0) return -1;
                if (aVal === 0 && bVal === 0) {
                  return a.athlete_name.localeCompare(b.athlete_name);
                }

                return gamxSortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
              });

              const GamxSortIndicator = ({ col }: { col: string }) => {
                if (gamxSortConfig.key !== col) return <span className="text-app-disabled ml-1">↕</span>;
                return (
                  <span className="text-accent-primary ml-1">
                    {gamxSortConfig.direction === 'asc' ? '↑' : '↓'}
                  </span>
                );
              };

              const hClass =
                'px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none';
              const qHClass = (col: string) =>
                `px-2 py-1 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none ${
                  gamxSortConfig.key === col ? 'text-accent-primary font-bold' : 'text-gray-900 dark:text-gray-200'
                }`;

              return (
                <div className="mb-4">
                  <div className="mb-3">
                    <button
                      onClick={() => setShowGamxSummary(!showGamxSummary)}
                      className="flex items-center space-x-2 text-app-primary hover:text-accent-primary transition-colors mb-2 text-left"
                    >
                      {showGamxSummary ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      <h2 className="text-2xl font-bold">Overall Rankings by GAMX</h2>
                      <span className="text-sm text-app-muted ml-2">({sortedGamx.length} athletes ranked)</span>
                    </button>
                  </div>

                  {showGamxSummary && (
                    <div className="card-primary mb-8">
                      <div className="overflow-x-auto">
                        <table className="border-separate" style={{ borderSpacing: 0, width: '100%' }}>
                          <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                            <tr className="border-b-2 border-gray-400 dark:border-gray-500">
                              <th className={hClass} onClick={() => handleGamxSort('rank')}>
                                Rank <GamxSortIndicator col="rank" />
                              </th>
                              <th className={hClass} onClick={() => handleGamxSort('athlete_name')}>
                                Name <GamxSortIndicator col="athlete_name" />
                              </th>
                              <th className={`${hClass} hidden sm:table-cell`}>Club / Country</th>
                              <th className={hClass} onClick={() => handleGamxSort('body_weight_kg')}>
                                Bwt <GamxSortIndicator col="body_weight_kg" />
                              </th>
                              <th className={hClass} onClick={() => handleGamxSort('category')}>
                                Wt. Class <GamxSortIndicator col="category" />
                              </th>
                              <th className={hClass}>Division</th>
                              <th className={hClass} onClick={() => handleGamxSort('best_snatch')}>
                                BEST<br />SNATCH <GamxSortIndicator col="best_snatch" />
                              </th>
                              <th className={hClass} onClick={() => handleGamxSort('best_cj')}>
                                BEST<br />C&J <GamxSortIndicator col="best_cj" />
                              </th>
                              <th className={hClass} onClick={() => handleGamxSort('total')}>
                                Total <GamxSortIndicator col="total" />
                              </th>
                              <th className={qHClass('gamx_total')} onClick={() => handleGamxSort('gamx_total')}>
                                GAMX-Total <GamxSortIndicator col="gamx_total" />
                              </th>
                              <th className={qHClass('gamx_s')} onClick={() => handleGamxSort('gamx_s')}>
                                GAMX-S <GamxSortIndicator col="gamx_s" />
                              </th>
                              <th className={qHClass('gamx_j')} onClick={() => handleGamxSort('gamx_j')}>
                                GAMX-J <GamxSortIndicator col="gamx_j" />
                              </th>
                              <th className={qHClass('gamx_u')} onClick={() => handleGamxSort('gamx_u')}>
                                GAMX-U <GamxSortIndicator col="gamx_u" />
                              </th>
                              <th className={qHClass('gamx_a')} onClick={() => handleGamxSort('gamx_a')}>
                                GAMX-A <GamxSortIndicator col="gamx_a" />
                              </th>
                              <th className={qHClass('gamx_masters')} onClick={() => handleGamxSort('gamx_masters')}>
                                GAMX-M <GamxSortIndicator col="gamx_masters" />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedGamx.map((r, idx) => {
                              const Flag = getCountryFlagComponent(r.country_code || meet?.country);
                              const hasScore = ((r as any)[gamxSortConfig.key] || 0) > 0;
                              return (
                                <tr
                                  key={`gamx-${idx}`}
                                  className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors group"
                                  style={{ borderTopColor: 'var(--border-secondary)' }}
                                >
                                  <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-app-primary">
                                    <div className="flex items-center gap-1">
                                      <span>{hasScore ? idx + 1 : '-'}</span>
                                      {idx === 0 && hasScore && <Medal className="h-4 w-4" style={{ color: '#FFD700' }} />}
                                      {idx === 1 && hasScore && <Medal className="h-4 w-4" style={{ color: '#C0C0C0' }} />}
                                      {idx === 2 && hasScore && <Medal className="h-4 w-4" style={{ color: '#CD7F32' }} />}
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 max-w-[200px] truncate" title={r.athlete_name}>
                                    <Link
                                      href={getAthleteUrl(r)}
                                      className="text-accent-primary hover:text-accent-primary-hover hover:underline flex items-center space-x-1"
                                    >
                                      <span className="font-medium text-sm">{r.athlete_name}</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                    {getSessionDescriptor(r.session_name) && (
                                      <div className="text-[11px] text-app-muted truncate" title={`Platform Competition Session: ${getSessionDescriptor(r.session_name)}`}>
                                        {getSessionDescriptor(r.session_name)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-sm hidden sm:table-cell">
                                    <div className="flex items-center gap-2">
                                      {Flag && <Flag style={{ width: '18px', height: '18px' }} />}
                                      <span>{getDelegationLabel(r.club_name, r.country_code)}</span>
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 text-sm">{r.body_weight_kg ? `${r.body_weight_kg}kg` : '-'}</td>
                                  <td className="px-2 py-2 text-sm">{r.parsedWeightClass || r.category}</td>
                                  <td
                                    className="px-2 py-2 text-sm max-w-[120px] leading-tight"
                                    style={{ fontSize: '0.75rem', whiteSpace: 'normal', wordBreak: 'break-word' }}
                                  >
                                    {r.parsedDivision || 'Open'}
                                  </td>
                                  <td className="px-2 py-2 text-sm" style={{ color: 'var(--chart-snatch)' }}>
                                    {r.best_snatch ? `${r.best_snatch}kg` : '-'}
                                  </td>
                                  <td className="px-2 py-2 text-sm" style={{ color: 'var(--chart-cleanjerk)' }}>
                                    {r.best_cj ? `${r.best_cj}kg` : '-'}
                                  </td>
                                  <td className="px-2 py-2 text-sm font-bold" style={{ color: 'var(--chart-total)' }}>
                                    {r.total ? `${r.total}kg` : '-'}
                                  </td>
                                  <td
                                    className="px-2 py-2 text-sm font-medium"
                                    style={{ color: (r.gamx_total || 0) > 0 ? 'var(--chart-gamx-total)' : 'inherit' }}
                                  >
                                    {r.gamx_total ? r.gamx_total.toFixed(0) : '-'}
                                  </td>
                                  <td
                                    className="px-2 py-2 text-sm font-medium"
                                    style={{ color: (r.gamx_s || 0) > 0 ? 'var(--chart-qpoints)' : 'inherit' }}
                                  >
                                    {r.gamx_s ? r.gamx_s.toFixed(0) : '-'}
                                  </td>
                                  <td
                                    className="px-2 py-2 text-sm font-medium"
                                    style={{ color: (r.gamx_j || 0) > 0 ? 'var(--chart-qyouth)' : 'inherit' }}
                                  >
                                    {r.gamx_j ? r.gamx_j.toFixed(0) : '-'}
                                  </td>
                                  <td
                                    className="px-2 py-2 text-sm font-medium"
                                    style={{ color: (r.gamx_u || 0) > 0 ? 'var(--chart-qpoints)' : 'inherit' }}
                                  >
                                    {r.gamx_u ? r.gamx_u.toFixed(0) : '-'}
                                  </td>
                                  <td
                                    className="px-2 py-2 text-sm font-medium"
                                    style={{ color: (r.gamx_a || 0) > 0 ? 'var(--chart-qmasters)' : 'inherit' }}
                                  >
                                    {r.gamx_a ? r.gamx_a.toFixed(0) : '-'}
                                  </td>
                                  <td
                                    className="px-2 py-2 text-sm font-medium"
                                    style={{ color: (r.gamx_masters || 0) > 0 ? 'var(--chart-qmasters)' : 'inherit' }}
                                  >
                                    {r.gamx_masters ? r.gamx_masters.toFixed(0) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Results by Gender Summary Tables */}
            {renderSummaryTable(
              "Men's Overall Rankings by Q-Points",
              filteredUniqueResults.filter((r) => r.parsedGender === 'M'),
              'men',
              showMenSummary,
              () => setShowMenSummary(!showMenSummary)
            )}
            {renderSummaryTable(
              "Women's Overall Rankings by Q-Points",
              filteredUniqueResults.filter((r) => r.parsedGender === 'F'),
              'women',
              showWomenSummary,
              () => setShowWomenSummary(!showWomenSummary)
            )}
          </>
        )}

        {/* Results Presentation */}
        <div
          ref={resultsContainerRef}
          style={{ minHeight: resultsMinHeight > 0 ? `${resultsMinHeight}px` : undefined, overflowAnchor: 'none' }}
        >
          {viewMode === 'owlcms' && groupBySession ? (
            renderSessionGroups(filteredUniqueResults)
          ) : (
            <>
              {buildGenderSections(menEntries, "Men's Results by Division")}
              {buildGenderSections(womenEntries, "Women's Results by Division")}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
