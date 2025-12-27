"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AuthGuard } from "../components/AuthGuard";
import { ROLES } from "../../lib/roles";
import { createClient } from "@/lib/supabase/client";
import { supabaseIWF } from "../../lib/supabaseIWF";
import {
  Trophy,
  Filter,
  Download,
  Printer,
  Search,
  Calendar,
  Users,
  Weight,
  TrendingUp,
  X,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
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
import { matchesAthleteName } from "../../lib/search/searchUtils";
import { MetricTooltip } from "../components/MetricTooltip";

// Custom ROC (Russian Olympic Committee) flag component
const RocFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <img
    src="/roc-flag.svg"
    alt="ROC"
    style={{ ...style, width: '18px', height: 'auto' }}
  />
);

// Custom Israel flag component
const IsraelFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <img
    src="/israel-flag.svg"
    alt="Israel"
    style={{ ...style, width: '18px', height: 'auto' }}
  />
);

// Olympic flag component (for neutral athletes: EOR, IOP, IOA, OAR)
const OlympicFlag: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <img
    src="/Olympic_flag.svg"
    alt="Olympic Neutral"
    style={{ ...style, width: '18px', height: 'auto' }}
  />
);

// ANA (Individual Neutral Athletes) flag component with year detection
const AnaFlag: React.FC<{ style?: React.CSSProperties; year?: number }> = ({ style, year }) => {
  let flagFile = '/Flag_of_the_Individual_Neutral_Athletes_at_the_2024_Summer_Olympics.svg'; // default to 2024

  if (year) {
    if (year <= 2020) {
      flagFile = '/ANA_flag_(2017).svg';
    } else if (year <= 2023) {
      flagFile = '/ANA_flag_(2021)_WA.svg';
    }
  }

  return (
    <img
      src={flagFile}
      alt="ANA"
      style={{ ...style, width: '18px', height: 'auto' }}
    />
  );
};

interface AthleteRanking {
  lifter_id: string;
  lifter_name: string;
  gender: string;
  federation: "usaw" | "iwf";
  year: number;
  weight_class?: string;
  age_category?: string;
  best_snatch: number;
  best_cj: number;
  best_total: number;
  best_qpoints: number;
  q_youth?: number;
  q_masters?: number;
  qpoints?: number;
  competition_count: number;
  last_competition: string;
  last_meet_name: string;
  last_body_weight?: string;
  competition_age?: number;
  trueRank?: number;
  membership_number?: string;
  meet_id?: number;
  iwf_lifter_id?: number;
  result_id?: number;
  unique_id: string;
  country_code?: string;
  country_name?: string;
}

interface USAWRankingResult {
  result_id: number;
  meet_id: number;
  lifter_id: number;
  membership_number: number | null;
  lifter_name: string;
  gender: string;
  weight_class: string;
  age_category: string;
  date: string;
  meet_name: string;
  body_weight_kg: string;
  competition_age: number | null;
  best_snatch: number;
  best_cj: number;
  total: number;
  qpoints: number;
  q_youth: number | null;
  q_masters: number | null;
}

interface IWFRankingResult {
  db_result_id: number;
  db_meet_id: number | null;
  db_lifter_id: number;
  iwf_lifter_id: number | null;
  lifter_name: string;
  gender: string;
  weight_class: string;
  age_category: string;
  date: string;
  meet_name: string;
  body_weight_kg: string;
  competition_age: number | null;
  best_snatch: number;
  best_cj: number;
  total: number;
  qpoints: number;
  q_youth: number | null;
  q_masters: number | null;
  country_code?: string;
  country_name?: string;
}

const getBestQScore = (result: any) => {
  const qYouth = result.q_youth || 0;
  const qPoints = result.qpoints || 0;
  const qMasters = result.q_masters || 0;

  if (qPoints >= qYouth && qPoints >= qMasters && qPoints > 0) {
    return { value: qPoints, type: 'qpoints', style: { color: 'var(--chart-qpoints)' } };
  }
  if (qYouth >= qMasters && qYouth > 0) {
    return { value: qYouth, type: 'qyouth', style: { color: 'var(--chart-qyouth)' } };
  }
  if (qMasters > 0) {
    return { value: qMasters, type: 'qmasters', style: { color: 'var(--chart-qmasters)' } };
  }

  return { value: null, type: 'none', style: { color: 'var(--chart-qpoints)' } };
};

const getCountryFlagComponent = (code: string): React.ComponentType<any> | null => {
  if (!code) return null;

  // IOC to component mapping (from iwf-lifter-manager.js country codes)
  const iocMap: Record<string, React.ComponentType<any> | null> = {
    // European countries (IOC codes)
    'ALB': Al, 'AND': Ad, 'ARM': Am, 'AUT': At, 'AZE': Az, 'BEL': Be, 'BIH': Ba, 'BUL': Bg, 'CRO': Hr, 'CYP': Cy,
    'CZE': Cz, 'DEN': Dk, 'EST': Ee, 'FIN': Fi, 'FRA': Fr, 'GEO': Ge, 'GER': De, 'GRE': Gr, 'GBR': Gb, 'HUN': Hu,
    'ISL': Is, 'IRL': Ie, 'ISR': IsraelFlag, 'ITA': It, 'KOS': Xk, 'LAT': Lv, 'LIE': Li, 'LTU': Lt, 'LUX': Lu, 'MDA': Md, 'MON': Mc,
    'MNE': Me, 'NED': Nl, 'NOR': No, 'POL': Pl, 'POR': Pt, 'ROU': Ro, 'RUS': Ru, 'SMR': Sm, 'SRB': Rs, 'SVK': Sk,
    'SVN': Si, 'ESP': Es, 'SWE': Se, 'SUI': Ch, 'TUR': Tr, 'UKR': Ua,
    // Asian countries (IOC codes)
    'AFG': Af, 'BAN': Bd, 'CAM': Kh, 'CHN': Cn, 'HKG': Hk, 'IND': In, 'IDN': Id, 'IRN': Ir, 'JPN': Jp, 'JOR': Jo,
    'KAZ': Kz, 'KOR': Kr, 'KWT': Kw, 'KGZ': Kg, 'LAO': La, 'LBN': Lb, 'MAS': My, 'MGL': Mn, 'MYA': Mm, 'NEP': Np,
    'PAK': Pk, 'PHI': Ph, 'QAT': Qa, 'SGP': Sg, 'THA': Th, 'TJK': Tj, 'TPE': Tw, 'TKM': Tm, 'UZB': Uz, 'VIE': Vn,
    // Americas (IOC codes)
    'ARG': Ar, 'BAR': Bb, 'BRA': Br, 'CAN': Ca, 'CHI': Cl, 'COL': Co, 'CRC': Cr, 'CUB': Cu, 'DOM': Do, 'ECU': Ec,
    'SLV': Sv, 'GUA': Gt, 'HAI': Ht, 'HND': Hn, 'JAM': Jm, 'MEX': Mx, 'PAN': Pa, 'PAR': Py, 'PER': Pe, 'PUR': Pr,
    'URU': Uy, 'USA': Us, 'VEN': Ve,
    // Oceania (IOC codes)
    'AUS': Au, 'FIJ': Fj, 'NZL': Nz, 'PNG': Pg, 'SAM': Ws, 'TON': To,
    // Africa (IOC codes)
    'ALG': Dz, 'ANG': Ao, 'BOT': Bw, 'BWA': Bw, 'CMR': Cm, 'EGY': Eg, 'ETH': Et, 'GHA': Gh, 'KEN': Ke, 'LIB': Ly,
    'MAR': Ma, 'MRI': Mu, 'MOZ': Mz, 'NAM': Na, 'NGA': Ng, 'RWA': Rw, 'RSA': Za, 'SUD': Sd, 'TAN': Tz, 'TUN': Tn,
    'UGA': Ug, 'ZIM': Zw,
    // Special/Neutral codes
    'AIN': AnaFlag, 'ANA': AnaFlag, 'EOR': OlympicFlag, 'IOP': OlympicFlag, 'OAR': OlympicFlag, 'VAN': Vu, 'WRT': OlympicFlag, 'KUW': Kw, 'MLT': Mt, 'INA': Id, 'BRN': Bn, 'UAE': Ae, 'TGA': To, 'PRK': Kp,
    'PLE': Ps, 'NMI': Mp, 'NGR': Ng, 'KSA': Sa, 'IRI': Ir, 'ARU': Aw, 'ASA': As, 'BDI': Bi, 'BLR': By, 'BOL': Bo,
    'BRU': Bn, 'CGO': Cg, 'COD': Cd, 'COK': Ck, 'COM': Km, 'CPV': Cv, 'CUR': Cw, 'ENG': GbEng, 'ESA': Sv, 'FSM': Fm,
    'GAM': Gm, 'GEQ': Gq, 'GIB': Gi, 'GUI': Gn, 'GUM': Gu, 'GUY': Gy, 'HON': Hn, 'IOA': OlympicFlag, 'IRQ': Iq, 'KIR': Ki,
    'KRI': Ki, 'LBA': Ly, 'LBR': Lr, 'LES': Ls, 'MAC': Mo, 'MAD': Mg, 'MAW': Mw, 'MHL': Mh, 'MTN': Mr, 'NCA': Ni,
    'NCL': Nc, 'NIC': Ni, 'NIR': GbWls, 'NIU': Nu, 'NRU': Nr, 'OMA': Om, 'PLW': Pw, 'ROC': RocFlag, 'RWF': null, 'SCO': GbSct,
    'SEN': Sn, 'SEY': Sc, 'SLE': Sl, 'SLO': Si, 'SOL': Sb, 'SRI': Lk, 'SWZ': Sz, 'SYR': Sy, 'TAH': Pf, 'TCA': Tc,
    'TLS': Tl, 'TTO': Tt, 'TUV': Tv, 'VIN': Vc, 'WAL': GbWls, 'WLF': Wf, 'YEM': Ye, 'ZAM': Zm, 'ZAN': Tz,
    // Also support ISO 2-letter codes directly
    'AD': Ad, 'AE': Ae, 'AF': Af, 'AG': Ag, 'AI': Ai, 'AL': Al, 'AM': Am, 'AO': Ao, 'AQ': Aq, 'AR': Ar, 'AS': As, 'AT': At,
    'AU': Au, 'AW': Aw, 'AX': Ax, 'AZ': Az, 'BA': Ba, 'BB': Bb, 'BD': Bd, 'BE': Be, 'BF': Bf, 'BG': Bg, 'BH': Bh, 'BI': Bi,
    'BJ': Bj, 'BL': Bl, 'BM': Bm, 'BN': Bn, 'BO': Bo, 'BQ': Bq, 'BR': Br, 'BS': Bs, 'BT': Bt, 'BV': Bv, 'BW': Bw, 'BY': By,
    'BZ': Bz, 'CA': Ca, 'CC': Cc, 'CD': Cd, 'CF': Cf, 'CG': Cg, 'CH': Ch, 'CI': Ci, 'CK': Ck, 'CL': Cl, 'CM': Cm, 'CN': Cn,
    'CO': Co, 'CR': Cr, 'CU': Cu, 'CV': Cv, 'CW': Cw, 'CX': Cx, 'CY': Cy, 'CZ': Cz, 'DE': De, 'DJ': Dj, 'DK': Dk, 'DM': Dm,
    'DO': Do, 'DZ': Dz, 'EC': Ec, 'EE': Ee, 'EG': Eg, 'ER': Er, 'ES': Es, 'ET': Et, 'FI': Fi, 'FJ': Fj, 'FK': Fk,
    'FM': Fm, 'FO': Fo, 'FR': Fr, 'GA': Ga, 'GB': Gb, 'GD': Gd, 'GE': Ge, 'GF': Gf, 'GG': Gg, 'GH': Gh, 'GI': Gi, 'GL': Gl,
    'GM': Gm, 'GN': Gn, 'GP': Gp, 'GQ': Gq, 'GR': Gr, 'GS': Gs, 'GT': Gt, 'GU': Gu, 'GW': Gw, 'GY': Gy, 'HK': Hk, 'HM': Hm,
    'HN': Hn, 'HR': Hr, 'HT': Ht, 'HU': Hu, 'ID': Id, 'IE': Ie, 'IL': IsraelFlag, 'IM': Im, 'IN': In, 'IO': Io, 'IQ': Iq, 'IR': Ir,
    'IS': Is, 'IT': It, 'JE': Je, 'JM': Jm, 'JO': Jo, 'JP': Jp, 'KE': Ke, 'KG': Kg, 'KH': Kh, 'KI': Ki, 'KM': Km, 'KN': Kn,
    'KP': Kp, 'KR': Kr, 'KW': Kw, 'KY': Ky, 'KZ': Kz, 'XK': Xk, 'LA': La, 'LB': Lb, 'LC': Lc, 'LI': Li, 'LK': Lk, 'LR': Lr, 'LS': Ls,
    'LT': Lt, 'LU': Lu, 'LV': Lv, 'LY': Ly, 'MA': Ma, 'MC': Mc, 'MD': Md, 'ME': Me, 'MF': Mf, 'MG': Mg, 'MH': Mh, 'MK': Mk,
    'ML': Ml, 'MM': Mm, 'MN': Mn, 'MO': Mo, 'MP': Mp, 'MQ': Mq, 'MR': Mr, 'MS': Ms, 'MT': Mt, 'MU': Mu, 'MV': Mv, 'MW': Mw,
    'MX': Mx, 'MY': My, 'MZ': Mz, 'NA': Na, 'NC': Nc, 'NE': Ne, 'NF': Nf, 'NG': Ng, 'NI': Ni, 'NL': Nl, 'NO': No, 'NP': Np,
    'NR': Nr, 'NU': Nu, 'NZ': Nz, 'OM': Om, 'PA': Pa, 'PE': Pe, 'PF': Pf, 'PG': Pg, 'PH': Ph, 'PK': Pk, 'PL': Pl, 'PM': Pm,
    'PN': Pn, 'PR': Pr, 'PS': Ps, 'PT': Pt, 'PW': Pw, 'PY': Py, 'QA': Qa, 'RE': Re, 'RO': Ro, 'RS': Rs, 'RU': Ru, 'RW': Rw,
    'SA': Sa, 'SB': Sb, 'SC': Sc, 'SD': Sd, 'SE': Se, 'SG': Sg, 'SH': Sh, 'SI': Si, 'SJ': Sj, 'SK': Sk, 'SL': Sl, 'SM': Sm,
    'SN': Sn, 'SO': So, 'SR': Sr, 'SS': Ss, 'ST': St, 'SV': Sv, 'SX': Sx, 'SY': Sy, 'SZ': Sz, 'TC': Tc, 'TD': Td, 'TF': Tf,
    'TG': Tg, 'TH': Th, 'TJ': Tj, 'TK': Tk, 'TL': Tl, 'TM': Tm, 'TN': Tn, 'TO': To, 'TR': Tr, 'TT': Tt, 'TV': Tv, 'TW': Tw,
    'TZ': Tz, 'UA': Ua, 'UG': Ug, 'UM': Um, 'US': Us, 'UY': Uy, 'UZ': Uz, 'VA': Va, 'VC': Vc, 'VE': Ve, 'VG': Vg, 'VI': Vi,
    'VN': Vn, 'VU': Vu, 'WF': Wf, 'WS': Ws, 'YE': Ye, 'YT': Yt, 'ZA': Za, 'ZM': Zm, 'ZW': Zw,
    'GbEng': GbEng, 'GbSct': GbSct, 'GbWls': GbWls,
  };

  const normalized = code.toUpperCase().trim();
  const component = iocMap[normalized] || null;
  if (!component && normalized !== '') {
    console.log('DEBUG: No flag component found for code:', `"${code}"`, 'normalized:', `"${normalized}"`);
  }
  return component;
};

// Current weight classes (all active weight classes regardless of age group)
const CURRENT_WEIGHT_CLASSES = {
  Women: ["36kg", "40kg", "44kg", "48kg", "53kg", "58kg", "63kg", "63+kg", "69kg", "69+kg", "77kg", "77+kg", "86kg", "86+kg"],
  Men: ["40kg", "44kg", "48kg", "52kg", "56kg", "60kg", "65kg", "65+kg", "71kg", "79kg", "79+kg", "88kg", "94kg", "94+kg", "110kg", "110+kg"],
};

// Historical weight classes (November 2018-May 2025)
const HISTORICAL_2018_2025_WEIGHT_CLASSES = {
  Women: ["30kg", "33kg", "36kg", "40kg", "45kg", "49kg", "55kg", "59kg", "64kg", "64+kg", "71kg", "76kg", "76+kg", "81kg", "81+kg", "87kg", "87+kg"],
  Men: ["32kg", "36kg", "39kg", "44kg", "49kg", "55kg", "61kg", "67kg", "73kg", "73+kg", "81kg", "89kg", "89+kg", "96kg", "102kg", "102+kg", "109kg", "109+kg"],
};

// Historical weight classes (January 1998-October 2018)
const HISTORICAL_1998_2018_WEIGHT_CLASSES = {
  Women: ["31kg", "35kg", "39kg", "44kg", "48kg", "53kg", "58kg", "58+kg", "63kg", "69kg", "69+kg", "75kg", "75+kg", "90kg", "90+kg"],
  Men: ["31kg", "35kg", "39kg", "44kg", "50kg", "56kg", "62kg", "69kg", "69+kg", "77kg", "85kg", "85+kg", "94kg", "94+kg", "105kg", "105+kg"],
};

function RankingsContent() {
  const supabase = createClient();
  const [usawRankings, setUsawRankings] = useState<AthleteRanking[]>([]);
  const [iwfRankings, setIwfRankings] = useState<AthleteRanking[]>([]);
  const [rankings, setRankings] = useState<AthleteRanking[]>([]);
  const [filteredRankings, setFilteredRankings] = useState<AthleteRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    searchTerm: "",
    gender: "all",
    selectedWeightClasses: [] as string[],
    selectedHistorical2018: [] as string[],
    selectedHistorical1998: [] as string[],
    ageCategory: "all",
    rankBy: "best_total",
    federation: "all",
    sortBy: "best_total",
    sortOrder: "desc",
    selectedYears: [2025] as number[], // Default to current year
    selectedCountries: [] as string[],
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showWeightClassDropdown, setShowWeightClassDropdown] = useState(false);
  const [showHistorical2018Dropdown, setShowHistorical2018Dropdown] = useState(false);
  const [showHistorical1998Dropdown, setShowHistorical1998Dropdown] = useState(false);
  const [showFederationDropdown, setShowFederationDropdown] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const resultsPerPage = 20;

  const [filterOptions, setFilterOptions] = useState({
    weightClasses: [] as string[],
    ageCategories: [] as string[],
    countries: [] as { code: string; name: string }[],
  });

  const [inactiveWeightClasses, setInactiveWeightClasses] = useState<
    Set<string>
  >(new Set());

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rankings, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Re-fetch data when selected years change
  useEffect(() => {
    // Only re-fetch if inactiveWeightClasses has been initialized
    // Don't check rankings.length because it might be 0 after clearing years
    if (inactiveWeightClasses.size > 0) {
      console.log('Year selection changed, re-fetching data for:', filters.selectedYears);
      fetchRankingsData(inactiveWeightClasses);
    }
  }, [filters.selectedYears]);

  async function initializeData() {
    let inactiveSet: Set<string> = new Set();
    try {
      inactiveSet = await loadInactiveDivisions();
    } catch (e) {
      console.error("Inactive divisions load failed, continuing:", e);
    }
    await fetchRankingsData(inactiveSet);
  }

  async function loadInactiveDivisions(): Promise<Set<string>> {
    // LOAD_INACTIVE_DIVISIONS_PLACEHOLDER
    const response = await fetch("/all-divisions.csv");
    if (!response.ok) {
      throw new Error("Failed to fetch divisions CSV");
    }

    const csvContent = await response.text();
    const lines = csvContent.split("\n").slice(1); // Skip header

    const inactiveSet = new Set<string>();

    lines.forEach((line) => {
      const division = line.trim().replace("\r", "");

      if (division.startsWith("(Inactive)")) {
        const cleanDivision = division.replace("(Inactive) ", "");

        let gender = "";
        if (cleanDivision.includes("Women's")) gender = "Women's";
        else if (cleanDivision.includes("Men's")) gender = "Men's";

        const parts = cleanDivision.split(" ");
        const weightClass = parts[parts.length - 1];

        if (gender && weightClass && weightClass.includes("kg")) {
          const genderWeightClass = `${gender} ${weightClass}`;
          inactiveSet.add(genderWeightClass);
        }
      }
    });

    setInactiveWeightClasses(inactiveSet);
    return inactiveSet; // Return the Set for immediate use
  }

  async function loadUSAWRankingsFile(year: number): Promise<USAWRankingResult[]> {
    const response = await fetch(`/data/usaw-rankings-${year}.json.gz`);
    if (!response.ok) throw new Error(`Failed to fetch USAW ${year}: ${response.statusText}`);

    let json;
    const contentEncoding = response.headers.get('Content-Encoding');
    if (contentEncoding === 'gzip') {
      json = await response.text();
    } else {
      try {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = response.body?.pipeThrough(ds);
        json = decompressedStream ? await new Response(decompressedStream).text() : await response.text();
      } catch (e) {
        console.warn('USAW decompression failed', e);
        json = await response.text();
      }
    }

    const data: USAWRankingResult[] = JSON.parse(json);
    console.log(`Loaded ${data.length} USAW results for ${year}`);
    return data;
  }

  async function loadIWFRankingsFile(year: number): Promise<IWFRankingResult[]> {
    const response = await fetch(`/data/iwf-rankings-${year}.json.gz`);
    if (!response.ok) throw new Error(`Failed to fetch IWF ${year}: ${response.statusText}`);

    let json;
    const contentEncoding = response.headers.get('Content-Encoding');
    if (contentEncoding === 'gzip') {
      json = await response.text();
    } else {
      try {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = response.body?.pipeThrough(ds);
        json = decompressedStream ? await new Response(decompressedStream).text() : await response.text();
      } catch (e) {
        console.warn('IWF decompression failed', e);
        json = await response.text();
      }
    }

    const data: IWFRankingResult[] = JSON.parse(json);
    console.log(`Loaded ${data.length} IWF results for ${year}`);
    return data;
  }

  // Helper function to fetch all results with pagination
  async function fetchAllInBatches(baseQuery: any, label: string) {
    const BATCH_SIZE = 1000;
    let allResults: any[] = [];
    let start = 0;
    let hasMore = true;
    let batchCount = 0;

    while (hasMore) {
      batchCount++;
      console.log(`${label}: Fetching batch ${batchCount} (rows ${start}-${start + BATCH_SIZE - 1})...`);

      const { data, error } = await baseQuery
        .range(start, start + BATCH_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allResults = allResults.concat(data);
        start += BATCH_SIZE;
        hasMore = data.length === BATCH_SIZE; // If less than batch size, we're done
      } else {
        hasMore = false;
      }
    }

    console.log(`${label}: Fetched ${allResults.length} total results in ${batchCount} batches`);
    return allResults;
  }

  async function fetchRankingsData(inactiveWeightClassesSet: Set<string>) {
    try {
      setLoading(true);
      setError(null);

      const inactiveSet =
        inactiveWeightClassesSet instanceof Set
          ? inactiveWeightClassesSet
          : new Set<string>();

      // If no years are selected, show zero results (don't fetch anything)
      if (!filters.selectedYears || filters.selectedYears.length === 0) {
        setRankings([]);
        setUsawRankings([]);
        setIwfRankings([]);
        setLoading(false);
        return;
      }

      // --- USAW DATA LOADING ---
      let usawResults: USAWRankingResult[] = [];
      let lifterInfoMap = new Map<number, any>();
      let usawDbFallbackNeeded = false;

      try {
        const usawPromises = filters.selectedYears
          .filter(year => year >= 2012 && year <= 2025)
          .map(year => loadUSAWRankingsFile(year));

        if (usawPromises.length > 0) {
          const usawYearData = await Promise.all(usawPromises);
          usawResults = usawYearData.flat();
          console.log(`USAW: Loaded ${usawResults.length} total results from files`);
        }
      } catch (err) {
        console.error('USAW file load failed, fallback to database:', err);
        usawDbFallbackNeeded = true;
      }

      // Fallback to Database if file load failed or no files loaded (but years selected)
      // Note: If selected years are outside 2012-2025, we might need DB fallback too, 
      // but currently the UI restricts or files cover the range. 
      // If usawResults is empty but we have selected years, and we didn't fail, 
      // it might mean we selected years with no files? 
      // The plan assumes files cover 2012-2025.

      if (usawDbFallbackNeeded) {
        console.log("USAW: Falling back to database...");
        // Build USAW query with optional year filtering
        let usawQuery = supabase
          .from("usaw_meet_results")
          .select(
            `
            result_id,
            lifter_id,
            lifter_name,
            date,
            meet_name,
            meet_id,
            weight_class,
            age_category,
            body_weight_kg,
            best_snatch,
            best_cj,
            total,
            qpoints,
            q_youth,
            q_masters,
            competition_age,
            gender
          `
          );

        if (filters.selectedYears && filters.selectedYears.length > 0) {
          const minYear = Math.min(...filters.selectedYears);
          const maxYear = Math.max(...filters.selectedYears);
          usawQuery = usawQuery
            .gte('date', `${minYear}-01-01`)
            .lte('date', `${maxYear}-12-31`);
        }

        usawQuery = usawQuery.order("date", { ascending: false });

        const resultsData = await fetchAllInBatches(usawQuery, "USAW");

        // Extract unique lifter IDs
        const lifterIds = Array.from(new Set((resultsData || []).map((r: any) => r.lifter_id)));

        // Batch fetch lifter details
        const LIFTER_BATCH_SIZE = 900;

        console.log(`USAW: Fetching details for ${lifterIds.length} unique lifters...`);

        for (let i = 0; i < lifterIds.length; i += LIFTER_BATCH_SIZE) {
          const batch = lifterIds.slice(i, i + LIFTER_BATCH_SIZE);
          const { data: liftersData, error: liftersError } = await supabase
            .from("usaw_lifters")
            .select(`lifter_id, athlete_name, wso, club_name, membership_number`)
            .in('lifter_id', batch);

          if (liftersError) throw liftersError;

          (liftersData || []).forEach((lifter: any) => {
            lifterInfoMap.set(lifter.lifter_id, lifter);
          });
        }

        // Cast to USAWRankingResult (some fields might be missing/null but handled in aggregation)
        usawResults = resultsData as unknown as USAWRankingResult[];
      }

      // --- USAW DATA MAPPING ---
      // Map directly to AthleteRanking without grouping
      const usawRankingsLocal: AthleteRanking[] = usawResults.map((result, index) => {
        const lifterInfo = lifterInfoMap.get(result.lifter_id);
        const resultDate = new Date(result.date);
        const year = resultDate.getFullYear();

        return {
          lifter_id: String(result.lifter_id),
          lifter_name: lifterInfo?.athlete_name || result.lifter_name || "Unknown",
          gender: result.gender || "",
          federation: "usaw" as const,
          year: isNaN(year) ? 0 : year,
          weight_class: result.weight_class || "",
          age_category: result.age_category || "",
          best_snatch: result.best_snatch || 0,
          best_cj: result.best_cj || 0,
          best_total: result.total || 0,
          best_qpoints: Math.max(result.qpoints || 0, result.q_youth || 0, result.q_masters || 0),
          q_youth: result.q_youth || undefined,
          q_masters: result.q_masters || undefined,
          qpoints: result.qpoints || undefined,
          competition_count: 1,
          last_competition: result.date || "",
          last_meet_name: result.meet_name || "",
          last_body_weight: result.body_weight_kg || "",
          competition_age: result.competition_age || undefined,
          membership_number: lifterInfo?.membership_number || result.membership_number || "",
          meet_id: result.meet_id || 0,
          result_id: result.result_id || 0,
          unique_id: result.result_id ? `usaw-${result.result_id}-${index}` : `usaw-gen-${year}-${index}`,
          country_code: "USA",
          country_name: "USA",
        };
      });

      setUsawRankings(usawRankingsLocal);

      // --- FILTER OPTION EXTRACTION (Keep existing logic) ---
      const weightClassCombinations = new Set<string>();
      usawRankingsLocal.forEach((athlete) => {
        if (athlete.age_category && athlete.weight_class) {
          let gender = "";
          if (athlete.age_category.includes("Women's")) gender = "Women's";
          else if (athlete.age_category.includes("Men's")) gender = "Men's";

          if (gender) {
            weightClassCombinations.add(`${gender} ${athlete.weight_class}`);
          }
        }
      });

      const extractedAgeCategories = new Set<string>();
      usawRankingsLocal.forEach((athlete) => {
        const ageCategory = athlete.age_category || "";
        if (ageCategory.includes("11 Under")) extractedAgeCategories.add("11 Under Age Group");
        else if (ageCategory.includes("13 Under")) extractedAgeCategories.add("13 Under Age Group");
        else if (ageCategory.includes("14-15")) extractedAgeCategories.add("14-15 Age Group");
        else if (ageCategory.includes("16-17")) extractedAgeCategories.add("16-17 Age Group");
        else if (ageCategory.includes("Junior")) extractedAgeCategories.add("Junior (15-20)");
        else if (ageCategory.includes("Masters (35-39)")) extractedAgeCategories.add("Masters (35-39)");
        else if (ageCategory.includes("Masters (40-44)")) extractedAgeCategories.add("Masters (40-44)");
        else if (ageCategory.includes("Masters (45-49)")) extractedAgeCategories.add("Masters (45-49)");
        else if (ageCategory.includes("Masters (50-54)")) extractedAgeCategories.add("Masters (50-54)");
        else if (ageCategory.includes("Masters (55-59)")) extractedAgeCategories.add("Masters (55-59)");
        else if (ageCategory.includes("Masters (60-64)")) extractedAgeCategories.add("Masters (60-64)");
        else if (ageCategory.includes("Masters (65-69)")) extractedAgeCategories.add("Masters (65-69)");
        else if (ageCategory.includes("Masters (70-74)")) extractedAgeCategories.add("Masters (70-74)");
        else if (ageCategory.includes("Masters (75-79)")) extractedAgeCategories.add("Masters (75-79)");
        else if (ageCategory.includes("Masters (75+)")) extractedAgeCategories.add("Masters (75+)");
        else if (ageCategory.includes("Masters (80+)")) extractedAgeCategories.add("Masters (80+)");
        else if (ageCategory.includes("Open")) extractedAgeCategories.add("Open / Senior (15+)");
      });

      function getWeightClassOrder(weightClass: string) {
        if (weightClass.includes("Women's")) return 1;
        if (weightClass.includes("Men's")) return 2;
        return 3;
      }

      const activeWeightClasses: string[] = [];
      const inactiveWeightClassesList: string[] = [];

      Array.from(weightClassCombinations).forEach((wc) => {
        if (inactiveSet.has(wc)) {
          inactiveWeightClassesList.push(`(Inactive) ${wc}`);
        } else {
          activeWeightClasses.push(wc);
        }
      });

      const sortWeightClasses = (classes: string[]) => {
        return classes.sort((a, b) => {
          const cleanA = a.replace("(Inactive) ", "");
          const cleanB = b.replace("(Inactive) ", "");
          const aOrder = getWeightClassOrder(cleanA);
          const bOrder = getWeightClassOrder(cleanB);
          if (aOrder !== bOrder) return aOrder - bOrder;
          const aWeight = parseFloat(cleanA.split(" ").pop()?.replace(/[^\d.]/g, "") || "0") || 0;
          const bWeight = parseFloat(cleanB.split(" ").pop()?.replace(/[^\d.]/g, "") || "0") || 0;
          return aWeight - bWeight;
        });
      };

      const sortedWeightClasses = [
        ...sortWeightClasses(activeWeightClasses),
        ...sortWeightClasses(inactiveWeightClassesList),
      ];

      const ageCategoryOrder = [
        "11 Under Age Group", "13 Under Age Group", "14-15 Age Group", "16-17 Age Group",
        "Junior (15-20)", "Open / Senior (15+)",
        "Masters (35-39)", "Masters (40-44)", "Masters (45-49)", "Masters (50-54)",
        "Masters (55-59)", "Masters (60-64)", "Masters (65-69)", "Masters (70-74)",
        "Masters (75-79)", "Masters (75+)", "Masters (80+)",
      ];

      const sortedAgeCategories = Array.from(extractedAgeCategories).sort((a, b) => {
        const aIndex = ageCategoryOrder.indexOf(a);
        const bIndex = ageCategoryOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      setFilterOptions({
        weightClasses: sortedWeightClasses,
        ageCategories: sortedAgeCategories,
        countries: [], // Initialize with empty, will be populated after data load
      });

      // --- IWF DATA LOADING ---
      let iwfResults: IWFRankingResult[] = [];
      let iwfDbFallbackNeeded = false;

      try {
        const iwfPromises = filters.selectedYears
          .filter(year => year >= 1998 && year <= 2025)
          .map(year => loadIWFRankingsFile(year));

        if (iwfPromises.length > 0) {
          const iwfYearData = await Promise.all(iwfPromises);
          iwfResults = iwfYearData.flat();
          console.log(`IWF: Loaded ${iwfResults.length} total results from files`);
        }
      } catch (err) {
        console.error('IWF file load failed, fallback to database:', err);
        iwfDbFallbackNeeded = true;
      }

      if (iwfDbFallbackNeeded) {
        console.log("IWF: Falling back to database...");
        let iwfQuery = supabaseIWF
          .from("iwf_meet_results")
          .select(
            `
            db_lifter_id,
            lifter_name,
            date,
            meet_name,
            db_meet_id,
            weight_class,
            age_category,
            body_weight_kg,
            best_snatch,
            best_cj,
            total,
            qpoints,
            q_youth,
            q_masters,
            competition_age,
            competition_age,
            gender,
            country_code,
            country_name,
            iwf_lifters (
              iwf_lifter_id
            )
          `
          );

        if (filters.selectedYears && filters.selectedYears.length === 1) {
          iwfQuery = iwfQuery.ilike('date', `%, ${filters.selectedYears[0]}`);
        }

        iwfQuery = iwfQuery.order("date", { ascending: false });

        try {
          const results = await fetchAllInBatches(iwfQuery, "IWF");

          // Filter by year in JS if multiple years
          if (filters.selectedYears && filters.selectedYears.length > 1) {
            iwfResults = results.filter((r: any) => {
              const resultDate = new Date(r.date);
              return filters.selectedYears.includes(resultDate.getFullYear());
            }) as unknown as IWFRankingResult[];
          } else {
            iwfResults = results as unknown as IWFRankingResult[];
          }
        } catch (err) {
          console.error("Error fetching IWF results from DB:", err);
        }
      }

      // --- IWF DATA MAPPING ---
      // Map directly to AthleteRanking without grouping
      const iwfRankingsLocal: AthleteRanking[] = iwfResults.map((result, index) => {
        const resultDate = new Date(result.date);
        const year = resultDate.getFullYear();

        return {
          lifter_id: String(result.db_lifter_id),
          lifter_name: result.lifter_name || "Unknown",
          gender: result.gender || "",
          federation: "iwf" as const,
          year: isNaN(year) ? 0 : year,
          weight_class: result.weight_class || "",
          age_category: result.age_category || "",
          best_snatch: result.best_snatch || 0,
          best_cj: result.best_cj || 0,
          best_total: result.total || 0,
          best_qpoints: Math.max(result.qpoints || 0, result.q_youth || 0, result.q_masters || 0),
          q_youth: result.q_youth || undefined,
          q_masters: result.q_masters || undefined,
          qpoints: result.qpoints || undefined,
          competition_count: 1,
          last_competition: result.date || "",
          last_meet_name: result.meet_name || "",
          last_body_weight: result.body_weight_kg || "",
          competition_age: result.competition_age || undefined,
          meet_id: result.db_meet_id || 0,
          iwf_lifter_id: result.iwf_lifter_id || 0,
          unique_id: result.db_result_id ? `iwf-${result.db_result_id}-${index}` : `iwf-gen-${year}-${index}`,
          country_code: result.country_code || "",
          country_name: result.country_name || "",
        };
      });

      setIwfRankings(iwfRankingsLocal);

      // Populate countries for the filter dropdown
      const uniqueCountries = new Map<string, string>();
      [...usawRankingsLocal, ...iwfRankingsLocal].forEach(athlete => {
        if (athlete.country_code && athlete.country_name) {
          uniqueCountries.set(athlete.country_code, athlete.country_name);
        }
      });

      const sortedCountries = Array.from(uniqueCountries.entries())
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setFilterOptions(prev => ({
        ...prev,
        countries: sortedCountries
      }));

      setRankings([
        ...usawRankingsLocal.map((a) => ({ ...a, federation: "usaw" as const })),
        ...iwfRankingsLocal.map((a) => ({ ...a, federation: "iwf" as const })),
      ]);

    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching rankings data:", err);
    } finally {
      setLoading(false);
    }
  }

  // Helper function to determine age categories from numeric age
  function determineAgeCategoriesFromAge(age: number): string[] {
    const categories: string[] = [];

    if (age <= 11) categories.push("11 Under Age Group");
    if (age <= 13) categories.push("13 Under Age Group");
    if (age >= 14 && age <= 15) categories.push("14-15 Age Group");
    if (age >= 16 && age <= 17) categories.push("16-17 Age Group");
    if (age >= 15 && age <= 20) categories.push("Junior (15-20)");
    if (age >= 15) categories.push("Open / Senior (15+)");

    // Masters categories
    if (age >= 35 && age <= 39) categories.push("Masters (35-39)");
    if (age >= 40 && age <= 44) categories.push("Masters (40-44)");
    if (age >= 45 && age <= 49) categories.push("Masters (45-49)");
    if (age >= 50 && age <= 54) categories.push("Masters (50-54)");
    if (age >= 55 && age <= 59) categories.push("Masters (55-59)");
    if (age >= 60 && age <= 64) categories.push("Masters (60-64)");
    if (age >= 65 && age <= 69) categories.push("Masters (65-69)");
    if (age >= 70 && age <= 74) categories.push("Masters (70-74)");
    if (age >= 75 && age <= 79) categories.push("Masters (75-79)");
    if (age >= 75) categories.push("Masters (75+)");
    if (age >= 80) categories.push("Masters (80+)");

    return categories;
  }

  // Helper to normalize weight class strings for comparison
  // Removes "kg", trims whitespace, and ensures "+" is at the end
  function normalizeWeightClass(wc: string): string {
    if (!wc) return "";
    let normalized = wc.toLowerCase().replace(/kg/g, "").trim();
    // Standardize super heavyweights to have "+" at the end (e.g. "+109" -> "109+")
    if (normalized.startsWith("+")) {
      normalized = normalized.substring(1) + "+";
    }
    return normalized;
  }

  function applyFilters() {
    // Choose base dataset by federation
    let base: AthleteRanking[];
    if (filters.federation === "usaw") {
      base = usawRankings;
    } else if (filters.federation === "iwf" || filters.federation === "iwf_one_per_country") {
      base = iwfRankings;
    } else {
      base = rankings.length
        ? rankings
        : [...usawRankings, ...iwfRankings];
    }

    let filtered = [...base];

    if (filters.searchTerm) {
      filtered = filtered.filter((athlete) =>
        matchesAthleteName(athlete.lifter_name, filters.searchTerm)
      );
    }

    if (filters.gender !== "all") {
      filtered = filtered.filter(
        (athlete) => athlete.gender === filters.gender
      );
    }

    // Combine all weight class selections (current + both historical periods)
    // Normalize filters for comparison
    const allSelectedWeightClasses = [
      ...filters.selectedWeightClasses,
      ...filters.selectedHistorical2018,
      ...filters.selectedHistorical1998,
    ].map(normalizeWeightClass);

    if (allSelectedWeightClasses.length > 0) {
      filtered = filtered.filter((athlete) => {
        const weightClass = normalizeWeightClass(athlete.weight_class || "");
        return allSelectedWeightClasses.includes(weightClass);
      });
    }

    if (filters.ageCategory !== "all") {
      filtered = filtered.filter((athlete) => {
        // Use competition_age as primary source
        if (athlete.competition_age !== null && athlete.competition_age !== undefined) {
          const athleteCategories = determineAgeCategoriesFromAge(athlete.competition_age);
          return athleteCategories.includes(filters.ageCategory);
        }

        // Fallback to age_category string field if competition_age is missing
        if (athlete.age_category) {
          return athlete.age_category === filters.ageCategory ||
            athlete.age_category.includes(filters.ageCategory);
        }

        // Exclude athletes with no age data from specific category filters
        return false;
      });
    }

    // Filter by year if specific years are selected
    // This handles non-continuous year selections (e.g., [2025, 2023] excluding 2024)
    if (filters.selectedYears && filters.selectedYears.length > 0) {
      filtered = filtered.filter((athlete) => {
        return filters.selectedYears.includes(athlete.year);
      });
    }

    // Filter by selected countries
    if (filters.selectedCountries && filters.selectedCountries.length > 0) {
      filtered = filtered.filter((athlete) => {
        return athlete.country_code && filters.selectedCountries.includes(athlete.country_code);
      });
    }

    // If "IWF 1/MF" is selected, keep only the best athlete per country
    if (filters.federation === "iwf_one_per_country") {
      const countryBestMap = new Map<string, AthleteRanking>();
      const rankingCriteriaForFilter = filters.rankBy as keyof AthleteRanking;

      filtered.forEach((athlete) => {
        const countryCode = athlete.country_code || "";
        const existingBest = countryBestMap.get(countryCode);

        if (!existingBest) {
          countryBestMap.set(countryCode, athlete);
        } else {
          // Compare based on ranking criteria
          const currentValue = athlete[rankingCriteriaForFilter] as number;
          const existingValue = existingBest[rankingCriteriaForFilter] as number;

          if (currentValue > existingValue) {
            // Current athlete is better - replace
            countryBestMap.set(countryCode, athlete);
          } else if (currentValue === existingValue) {
            // Tie - use most recent competition date
            const currentDate = new Date(athlete.last_competition).getTime();
            const existingDate = new Date(existingBest.last_competition).getTime();

            if (currentDate > existingDate) {
              countryBestMap.set(countryCode, athlete);
            }
          }
        }
      });

      // Replace filtered array with only the best per country
      filtered = Array.from(countryBestMap.values());
    }

    const rankingCriteria = filters.rankBy as keyof AthleteRanking;

    // Create a sorted list to determine ranks
    // We sort by the ranking criteria (e.g. best_total desc) to establish the "True Rank" order
    const rankedForTrueRank = [...filtered];
    rankedForTrueRank.sort((a, b) => {
      const aValue = a[rankingCriteria] as number;
      const bValue = b[rankingCriteria] as number;
      return bValue - aValue;
    });

    // Assign ranks based on the sorted list
    // For each lifter, only their best result gets a rank
    // We use unique_id to identify which specific results should have ranks
    const rankMap = new Map<string, number>(); // Maps unique_id to rank
    let currentRank = 1;
    const rankedLifters = new Set<string>();

    rankedForTrueRank.forEach((athlete) => {
      if (!rankedLifters.has(athlete.lifter_id)) {
        // This is the best result for this lifter - assign it a rank
        rankMap.set(athlete.unique_id, currentRank);
        rankedLifters.add(athlete.lifter_id);
        currentRank++;
      }
      // All other results for this lifter will not have a rank
    });

    // Handle trueRank sorting separately since it's calculated
    if (filters.sortBy === "trueRank") {
      // rankedForTrueRank is already sorted by performance (Rank ASC)
      // If sortOrder is 'desc', we reverse it
      let sortedResult = [...rankedForTrueRank];

      if (filters.sortOrder === "desc") {
        sortedResult.reverse();
      }

      const rankedFiltered = sortedResult.map((athlete) => ({
        ...athlete,
        trueRank: rankMap.get(athlete.unique_id),
      }));

      console.log('Final filtered count (rankBy mode):', rankedFiltered.length);
      setFilteredRankings(rankedFiltered);
      return;
    }

    filtered.sort((a, b) => {
      const sortKey = filters.sortBy as keyof AthleteRanking;
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // String comparisons
      if (filters.sortBy === "lifter_name" || filters.sortBy === "gender" || filters.sortBy === "last_meet_name") {
        const aStr = String(aVal || "");
        const bStr = String(bVal || "");
        return filters.sortOrder === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      }

      // Weight class sorting (parse numeric, handle +109kg)
      if (filters.sortBy === "weight_class") {
        const parseWeight = (wc: string) => {
          if (!wc) return 0;
          const match = wc.match(/(\d+)/);
          const base = match ? parseInt(match[1]) : 0;
          return wc.includes("+") ? base + 0.5 : base;
        };
        const weightA = parseWeight(String(aVal || ""));
        const weightB = parseWeight(String(bVal || ""));
        return filters.sortOrder === "asc" ? weightA - weightB : weightB - weightA;
      }

      // Age category sorting (use predefined order)
      if (filters.sortBy === "age_category") {
        // Normalize age category to match order array format
        const normalizeAgeCategory = (ageCategory: string) => {
          if (!ageCategory) return "";

          if (ageCategory.includes("11 Under")) return "11 Under Age Group";
          if (ageCategory.includes("13 Under")) return "13 Under Age Group";
          if (ageCategory.includes("14-15")) return "14-15 Age Group";
          if (ageCategory.includes("16-17")) return "16-17 Age Group";
          if (ageCategory.includes("Junior")) return "Junior";
          if (ageCategory.includes("Masters (35-39)")) return "Masters (35-39)";
          if (ageCategory.includes("Masters (40-44)")) return "Masters (40-44)";
          if (ageCategory.includes("Masters (45-49)")) return "Masters (45-49)";
          if (ageCategory.includes("Masters (50-54)")) return "Masters (50-54)";
          if (ageCategory.includes("Masters (55-59)")) return "Masters (55-59)";
          if (ageCategory.includes("Masters (60-64)")) return "Masters (60-64)";
          if (ageCategory.includes("Masters (65-69)")) return "Masters (65-69)";
          if (ageCategory.includes("Masters (70-74)")) return "Masters (70-74)";
          if (ageCategory.includes("Masters (75-79)")) return "Masters (75-79)";
          if (ageCategory.includes("Masters (75+)")) return "Masters (75+)";
          if (ageCategory.includes("Masters (80+)")) return "Masters (80+)";
          if (ageCategory.includes("Open")) return "Open";

          return ageCategory;
        };

        const ageCategoryOrder = [
          "11 Under Age Group",
          "13 Under Age Group",
          "14-15 Age Group",
          "16-17 Age Group",
          "Junior",
          "Open",
          "Masters (35-39)",
          "Masters (40-44)",
          "Masters (45-49)",
          "Masters (50-54)",
          "Masters (55-59)",
          "Masters (60-64)",
          "Masters (65-69)",
          "Masters (70-74)",
          "Masters (75-79)",
          "Masters (75+)",
          "Masters (80+)",
        ];

        // Normalize both values before comparison
        const normalizedA = normalizeAgeCategory(String(aVal || ""));
        const normalizedB = normalizeAgeCategory(String(bVal || ""));

        const indexA = ageCategoryOrder.indexOf(normalizedA);
        const indexB = ageCategoryOrder.indexOf(normalizedB);
        const finalIndexA = indexA === -1 ? 999 : indexA;
        const finalIndexB = indexB === -1 ? 999 : indexB;

        return filters.sortOrder === "asc" ? finalIndexA - finalIndexB : finalIndexB - finalIndexA;
      }

      // Body weight sorting (parse numeric value from string format)
      if (filters.sortBy === "last_body_weight") {
        const parseBodyWeight = (bw: string) => {
          if (!bw) return 0;
          const numericValue = parseFloat(bw.replace(/[^\d.]/g, ""));
          return isNaN(numericValue) ? 0 : numericValue;
        };
        const weightA = parseBodyWeight(String(aVal || ""));
        const weightB = parseBodyWeight(String(bVal || ""));
        return filters.sortOrder === "asc" ? weightA - weightB : weightB - weightA;
      }

      // Date sorting (parse and compare timestamps)
      if (filters.sortBy === "last_competition") {
        const dateA = aVal ? new Date(String(aVal)).getTime() : 0;
        const dateB = bVal ? new Date(String(bVal)).getTime() : 0;
        return filters.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }

      // Numeric comparisons (default for all other fields)
      const numA = (aVal as number) || 0;
      const numB = (bVal as number) || 0;
      return filters.sortOrder === "asc" ? numA - numB : numB - numA;
    });

    const rankedFiltered = filtered.map((athlete) => ({
      ...athlete,
      trueRank: rankMap.get(athlete.unique_id),
    }));

    // No hard cap: show all matching athletes
    console.log('Final filtered count (sortBy mode):', rankedFiltered.length);
    setFilteredRankings(rankedFiltered);
  }

  function handleSort(column: string) {
    let newSortOrder: 'asc' | 'desc' = 'asc';
    if (filters.sortBy === column && filters.sortOrder === 'asc') {
      newSortOrder = 'desc';
    }
    setFilters(prev => ({
      ...prev,
      sortBy: column,
      sortOrder: newSortOrder
    }));
  }

  function handleFilterChange(key: string, value: any) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function getSortIcon(column: string) {
    if (filters.sortBy !== column) {
      return (
        <span className="text-app-disabled ml-1">
          ↕
        </span>
      );
    }
    return (
      <span className="text-accent-primary ml-1">
        {filters.sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  }

  function clearFilters() {
    setFilters({
      searchTerm: "",
      gender: "all",
      selectedWeightClasses: [],
      selectedHistorical2018: [],
      selectedHistorical1998: [],
      ageCategory: "all",
      rankBy: "best_total",
      sortBy: "best_total",
      sortOrder: "desc",
      selectedYears: [],
      federation: "all",
      selectedCountries: [],
    });
  }

  function exportToCSV() {
    const headers = [
      "Rank",
      "Athlete Name",
      "Resource",
      "Gender",
      "Weight Class",
      "Age Category",
      "Best Snatch (kg)",
      "Best C&J (kg)",
      "Best Total (kg)",
      "Best Q-Points",
      "Competitions",
      "Last Competition",
      "Meet Name",
    ];

    const csvData = filteredRankings.map((athlete) => [
      athlete.trueRank || "N/A",
      athlete.lifter_name,
      athlete.federation === "iwf" ? "IWF" : "USAW",
      athlete.gender,
      athlete.weight_class || "",
      athlete.age_category || "",
      athlete.best_snatch || "",
      athlete.best_cj || "",
      athlete.best_total || "",
      athlete.best_qpoints || "",
      athlete.competition_count,
      athlete.last_competition || "",
      athlete.last_meet_name || "",
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) =>
        row.map((cell) => `"${cell}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weightlifting-rankings-${new Date().toISOString().split("T")[0]
      }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function printTable() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Limit rows to prevent browser crash
    const MAX_PRINT_ROWS = 1000;
    const rowsToPrint = filteredRankings.slice(0, MAX_PRINT_ROWS);
    const isTruncated = filteredRankings.length > MAX_PRINT_ROWS;

    const tableHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>USA Weightlifting Ranking Tables</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .rank { font-weight: bold; }
            .warning { color: #666; font-style: italic; text-align: center; margin-top: 10px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Upcoming Meets</h1>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
          ${isTruncated ? `<p class="warning">Note: Output limited to top ${MAX_PRINT_ROWS} results for performance. Please filter data to see specific results.</p>` : ''}
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Athlete</th>
                <th>Resource</th>
                <th>Gender</th>
                <th>Weight Class</th>
                <th>Age Category</th>
                <th>Best Snatch</th>
                <th>Best C&J</th>
                <th>Best Total</th>
                <th>Q-Points</th>
                <th>Meet</th>
              </tr>
            </thead>
            <tbody>
              ${rowsToPrint
        .map(
          (athlete) => `
                <tr>
                  <td class="rank">${athlete.trueRank || "N/A"}</td>
                  <td>${athlete.lifter_name}</td>
                  <td>${athlete.federation === "iwf" ? "IWF" : "USAW"}</td>
                  <td>${athlete.gender}</td>
                  <td>${athlete.weight_class || ""}</td>
                  <td>${athlete.age_category || ""}</td>
                  <td>${athlete.best_snatch || "-"}</td>
                  <td>${athlete.best_cj || "-"}</td>
                  <td>${athlete.best_total || "-"}</td>
                  <td>${athlete.best_qpoints
              ? athlete.best_qpoints.toFixed(1)
              : "-"
            }</td>
                  <td>${athlete.last_meet_name || "-"}</td>
                </tr>
              `
        )
        .join("")}
            </tbody>
          </table>
          ${isTruncated ? `<p class="warning">End of top ${MAX_PRINT_ROWS} results.</p>` : ''}
        </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    // Small delay to ensure styles are loaded before printing
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }



  if (error) {
    return (
      <div className="min-h-screen bg-app-primary flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Error Loading Upcoming Meets
          </h1>
          <p className="text-gray-300 mb-4">
            {error}
          </p>
          <button
            onClick={() => initializeData()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(filteredRankings.length / resultsPerPage);
  const displayResults = filteredRankings.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );

  return (
    <div className="min-h-screen bg-app-primary">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="max-w-[1200px] mx-auto">
          <div className={`card-primary transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-60' : ''}`}>
            <div>
              <div className="flex flex-nowrap items-center justify-between gap-4">
                {/* Left: Title and context */}
                <div className="flex items-start space-x-4 flex-1 min-w-0">
                  <div className="bg-gray-700 rounded-2xl p-3 flex items-center justify-center">
                    <Trophy className="h-7 w-7 text-yellow-400" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-app-primary">
                      Upcoming Meets
                    </h1>
                    <p className="text-sm text-app-secondary mt-1">
                      Explore national and international rankings across federations,
                      years, and divisions.
                    </p>
                    {/* Summary chips */}
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                        {filteredRankings.length} athletes
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                        Federation:{" "}
                        {filters.federation === "all"
                          ? "All Federations"
                          : filters.federation === "usaw"
                            ? "USAW"
                            : filters.federation === "iwf_one_per_country"
                              ? "IWF 1/MF"
                              : "IWF"}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                        Years:{" "}
                        {filters.selectedYears.length === 0
                          ? "All (1998–" + new Date().getFullYear() + ")"
                          : filters.selectedYears
                            .slice()
                            .sort((a, b) => b - a)
                            .join(", ")}
                      </span>

                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-secondary">
                        Sorted by:{" "}
                        {filters.sortBy === "lifter_name"
                          ? "Name"
                          : filters.sortBy === "competition_count"
                            ? "Competition Count"
                            : filters.sortBy === "best_snatch"
                              ? "Best Snatch"
                              : filters.sortBy === "best_cj"
                                ? "Best C&J"
                                : filters.sortBy === "best_qpoints"
                                  ? "Best Q-Points"
                                  : "Best Total"}{" ("}{filters.sortOrder === "asc" ? "Asc" : "Desc"}{")"}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-app-tertiary text-app-muted">
                        Last updated: {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>


                {/* Right: Actions */}
                <div className="flex items-start md:items-center space-x-3 flex-shrink-0">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Filter className="h-4 w-4" />
                    <span>{showFilters ? "Hide Filters" : "Show Filters"}</span>
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export</span>
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 mt-2 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20">
                        <button
                          onClick={() => {
                            exportToCSV();
                            setShowExportMenu(false);
                          }}
                          className="flex items-center space-x-2 w-full text-left px-4 py-2 text-xs text-white hover:bg-gray-700 rounded-t-lg"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>Download CSV</span>
                        </button>
                        <button
                          onClick={() => {
                            printTable();
                            setShowExportMenu(false);
                          }}
                          className="flex items-center space-x-2 w-full text-left px-4 py-2 text-xs text-white hover:bg-gray-700 rounded-b-lg"
                        >
                          <Printer className="h-4 w-4" />
                          <span>Print Table</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Filters */}
              {showFilters && (
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Search
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={filters.searchTerm}
                          onChange={(e) =>
                            handleFilterChange(
                              "searchTerm",
                              e.target.value
                            )
                          }
                          placeholder="Athlete name"
                          className="w-full h-10 pl-10 pr-3 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Federation */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Federation
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowFederationDropdown(!showFederationDropdown)}
                        className="w-full h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                      >
                        <span>
                          {filters.federation === "all" && "All Federations"}
                          {filters.federation === "usaw" && "USAW"}
                          {filters.federation === "iwf" && "IWF"}
                          {filters.federation === "iwf_one_per_country" && "IWF 1/MF"}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showFederationDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showFederationDropdown && (
                        <div className="absolute z-10 mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              handleFilterChange("federation", "all");
                              setShowFederationDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-600 first:rounded-t-lg ${filters.federation === "all" ? "bg-gray-600" : ""
                              }`}
                          >
                            All Federations
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleFilterChange("federation", "usaw");
                              setShowFederationDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-600 ${filters.federation === "usaw" ? "bg-gray-600" : ""
                              }`}
                          >
                            USAW
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleFilterChange("federation", "iwf");
                              setShowFederationDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-600 ${filters.federation === "iwf" ? "bg-gray-600" : ""
                              }`}
                          >
                            IWF
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleFilterChange("federation", "iwf_one_per_country");
                              setShowFederationDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-600 last:rounded-b-lg flex items-center justify-between ${filters.federation === "iwf_one_per_country" ? "bg-gray-600" : ""
                              }`}
                          >
                            <span>IWF 1/MF</span>
                            <MetricTooltip
                              title="IWF 1/MF"
                              description="Show one athlete per country - displays only the best performing athlete from each Member Federation."
                            >
                              <span></span>
                            </MetricTooltip>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Gender
                      </label>
                      <select
                        value={filters.gender}
                        onChange={(e) =>
                          handleFilterChange("gender", e.target.value)
                        }
                        className="w-full h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Genders</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                    </div>

                    {/* Age Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Age Category
                      </label>
                      <select
                        value={filters.ageCategory}
                        onChange={(e) =>
                          handleFilterChange(
                            "ageCategory",
                            e.target.value
                          )
                        }
                        className="w-full h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">
                          All Age Categories
                        </option>
                        {filterOptions.ageCategories.map((ac) => (
                          <option key={ac} value={ac}>
                            {ac}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Current Weight Classes - Multi-select */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Current Weight Classes
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowWeightClassDropdown(!showWeightClassDropdown)}
                        className="w-full h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                      >
                        <span>
                          {filters.selectedWeightClasses.length === 0
                            ? "All Weight Classes"
                            : `${filters.selectedWeightClasses.length} selected`}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showWeightClassDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showWeightClassDropdown && (
                        <div className="absolute z-10 mt-1 w-full max-h-96 overflow-y-auto bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                          {/* Select/Deselect All */}
                          <div className="sticky top-0 bg-gray-700 border-b border-gray-600 p-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFilters(prev => ({
                                  ...prev,
                                  selectedWeightClasses: []
                                }));
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Clear All
                            </button>
                          </div>

                          {/* Two-column layout: Women | Men */}
                          <div className="grid grid-cols-2 gap-0 divide-x divide-gray-600">
                            {/* Women's Column */}
                            <div>
                              <div className="px-3 py-2 bg-gray-600 text-xs font-semibold text-gray-300 text-center">
                                Women
                              </div>
                              <div className="p-2">
                                {CURRENT_WEIGHT_CLASSES.Women.map((weight) => (
                                  <label
                                    key={`women-${weight}`}
                                    className="flex items-center px-2 py-1.5 hover:bg-gray-600 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.selectedWeightClasses.includes(weight)}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...filters.selectedWeightClasses, weight]
                                          : filters.selectedWeightClasses.filter(w => w !== weight);
                                        setFilters(prev => ({
                                          ...prev,
                                          selectedWeightClasses: newSelected
                                        }));
                                      }}
                                      className="mr-2 accent-blue-500"
                                    />
                                    <span className="text-sm text-gray-200">{weight}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Men's Column */}
                            <div>
                              <div className="px-3 py-2 bg-gray-600 text-xs font-semibold text-gray-300 text-center">
                                Men
                              </div>
                              <div className="p-2">
                                {CURRENT_WEIGHT_CLASSES.Men.map((weight) => (
                                  <label
                                    key={`men-${weight}`}
                                    className="flex items-center px-2 py-1.5 hover:bg-gray-600 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.selectedWeightClasses.includes(weight)}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...filters.selectedWeightClasses, weight]
                                          : filters.selectedWeightClasses.filter(w => w !== weight);
                                        setFilters(prev => ({
                                          ...prev,
                                          selectedWeightClasses: newSelected
                                        }));
                                      }}
                                      className="mr-2 accent-blue-500"
                                    />
                                    <span className="text-sm text-gray-200">{weight}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Historical Weight Classes (2018-2025) - Multi-select */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Historical Weight Classes (2018-2025)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHistorical2018Dropdown(!showHistorical2018Dropdown)}
                        className="w-full h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                      >
                        <span>
                          {filters.selectedHistorical2018.length === 0
                            ? "All Weight Classes"
                            : `${filters.selectedHistorical2018.length} selected`}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showHistorical2018Dropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showHistorical2018Dropdown && (
                        <div className="absolute z-10 mt-1 w-full max-h-96 overflow-y-auto bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                          {/* Select/Deselect All */}
                          <div className="sticky top-0 bg-gray-700 border-b border-gray-600 p-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFilters(prev => ({
                                  ...prev,
                                  selectedHistorical2018: []
                                }));
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Clear All
                            </button>
                          </div>

                          {/* Two-column layout: Women | Men */}
                          <div className="grid grid-cols-2 gap-0 divide-x divide-gray-600">
                            {/* Women's Column */}
                            <div>
                              <div className="px-3 py-2 bg-gray-600 text-xs font-semibold text-gray-300 text-center">
                                Women
                              </div>
                              <div className="p-2">
                                {HISTORICAL_2018_2025_WEIGHT_CLASSES.Women.map((weight) => (
                                  <label
                                    key={`hist2018-women-${weight}`}
                                    className="flex items-center px-2 py-1.5 hover:bg-gray-600 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.selectedHistorical2018.includes(weight)}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...filters.selectedHistorical2018, weight]
                                          : filters.selectedHistorical2018.filter(w => w !== weight);
                                        setFilters(prev => ({
                                          ...prev,
                                          selectedHistorical2018: newSelected
                                        }));
                                      }}
                                      className="mr-2 accent-blue-500"
                                    />
                                    <span className="text-sm text-gray-200">{weight}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Men's Column */}
                            <div>
                              <div className="px-3 py-2 bg-gray-600 text-xs font-semibold text-gray-300 text-center">
                                Men
                              </div>
                              <div className="p-2">
                                {HISTORICAL_2018_2025_WEIGHT_CLASSES.Men.map((weight) => (
                                  <label
                                    key={`hist2018-men-${weight}`}
                                    className="flex items-center px-2 py-1.5 hover:bg-gray-600 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.selectedHistorical2018.includes(weight)}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...filters.selectedHistorical2018, weight]
                                          : filters.selectedHistorical2018.filter(w => w !== weight);
                                        setFilters(prev => ({
                                          ...prev,
                                          selectedHistorical2018: newSelected
                                        }));
                                      }}
                                      className="mr-2 accent-blue-500"
                                    />
                                    <span className="text-sm text-gray-200">{weight}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Historical Weight Classes (1998-2018) - Multi-select */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Historical Weight Classes (1998-2018)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHistorical1998Dropdown(!showHistorical1998Dropdown)}
                        className="w-full h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left flex justify-between items-center"
                      >
                        <span>
                          {filters.selectedHistorical1998.length === 0
                            ? "All Weight Classes"
                            : `${filters.selectedHistorical1998.length} selected`}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${showHistorical1998Dropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showHistorical1998Dropdown && (
                        <div className="absolute z-10 mt-1 w-full max-h-96 overflow-y-auto bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                          {/* Select/Deselect All */}
                          <div className="sticky top-0 bg-gray-700 border-b border-gray-600 p-2">
                            <button
                              type="button"
                              onClick={() => {
                                setFilters(prev => ({
                                  ...prev,
                                  selectedHistorical1998: []
                                }));
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Clear All
                            </button>
                          </div>

                          {/* Two-column layout: Women | Men */}
                          <div className="grid grid-cols-2 gap-0 divide-x divide-gray-600">
                            {/* Women's Column */}
                            <div>
                              <div className="px-3 py-2 bg-gray-600 text-xs font-semibold text-gray-300 text-center">
                                Women
                              </div>
                              <div className="p-2">
                                {HISTORICAL_1998_2018_WEIGHT_CLASSES.Women.map((weight) => (
                                  <label
                                    key={`hist1998-women-${weight}`}
                                    className="flex items-center px-2 py-1.5 hover:bg-gray-600 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.selectedHistorical1998.includes(weight)}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...filters.selectedHistorical1998, weight]
                                          : filters.selectedHistorical1998.filter(w => w !== weight);
                                        setFilters(prev => ({
                                          ...prev,
                                          selectedHistorical1998: newSelected
                                        }));
                                      }}
                                      className="mr-2 accent-blue-500"
                                    />
                                    <span className="text-sm text-gray-200">{weight}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Men's Column */}
                            <div>
                              <div className="px-3 py-2 bg-gray-600 text-xs font-semibold text-gray-300 text-center">
                                Men
                              </div>
                              <div className="p-2">
                                {HISTORICAL_1998_2018_WEIGHT_CLASSES.Men.map((weight) => (
                                  <label
                                    key={`hist1998-men-${weight}`}
                                    className="flex items-center px-2 py-1.5 hover:bg-gray-600 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={filters.selectedHistorical1998.includes(weight)}
                                      onChange={(e) => {
                                        const newSelected = e.target.checked
                                          ? [...filters.selectedHistorical1998, weight]
                                          : filters.selectedHistorical1998.filter(w => w !== weight);
                                        setFilters(prev => ({
                                          ...prev,
                                          selectedHistorical1998: newSelected
                                        }));
                                      }}
                                      className="mr-2 accent-blue-500"
                                    />
                                    <span className="text-sm text-gray-200">{weight}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Countries Filter */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Countries
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown((prev) => !prev)}
                        className="w-full flex items-center justify-between h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span>
                          {filters.selectedCountries.length === 0
                            ? "All Countries"
                            : `${filters.selectedCountries.length} selected`}
                        </span>
                        <span className="ml-2 text-xs text-gray-300">
                          {showCountryDropdown ? "▲" : "▼"}
                        </span>
                      </button>

                      {showCountryDropdown && (
                        <div className="absolute z-20 mt-1 w-64 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-2">
                          <div className="flex justify-between items-center mb-2 text-[10px] text-gray-400">
                            <button
                              type="button"
                              onClick={() => {
                                const allCountries = filterOptions.countries.map(c => c.code);
                                setFilters((prev) => ({
                                  ...prev,
                                  selectedCountries: allCountries,
                                }));
                              }}
                              className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  selectedCountries: [],
                                }))
                              }
                              className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {filterOptions.countries.length > 0 ? (
                              filterOptions.countries.map((country) => {
                                const checked = filters.selectedCountries.includes(country.code);
                                const FlagComponent = getCountryFlagComponent(country.code);
                                return (
                                  <label
                                    key={country.code}
                                    className="flex items-center space-x-2 text-xs text-gray-200 cursor-pointer hover:bg-gray-700 p-1 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        setFilters((prev) => {
                                          const exists = prev.selectedCountries.includes(country.code);
                                          return {
                                            ...prev,
                                            selectedCountries: exists
                                              ? prev.selectedCountries.filter((c) => c !== country.code)
                                              : [...prev.selectedCountries, country.code],
                                          };
                                        });
                                      }}
                                      className="h-3 w-3 accent-blue-500 flex-shrink-0"
                                    />
                                    <div className="flex items-center space-x-2 truncate">
                                      {FlagComponent && (
                                        <div className="flex-shrink-0 w-5">
                                          <FlagComponent style={{ width: '100%', height: 'auto' }} />
                                        </div>
                                      )}
                                      <span className="truncate">{country.name}</span>
                                    </div>
                                  </label>
                                );
                              })
                            ) : (
                              <div className="text-gray-400 text-xs p-2 text-center">
                                No countries available for selected criteria
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Years dropdown with multi-select checkboxes */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Years
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowYearDropdown((prev) => !prev)}
                        className="w-full flex items-center justify-between h-10 px-3 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span>
                          {filters.selectedYears.length === 0
                            ? "All Years (1998–" +
                            new Date().getFullYear() +
                            ")"
                            : filters.selectedYears
                              .slice()
                              .sort((a, b) => b - a)
                              .join(", ")}
                        </span>
                        <span className="ml-2 text-xs text-gray-300">
                          {showYearDropdown ? "▲" : "▼"}
                        </span>
                      </button>

                      {showYearDropdown && (
                        <div className="absolute z-20 mt-1 w-64 max-h-64 overflow-y-auto bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-2">
                          <div className="flex justify-between items-center mb-2 text-[10px] text-gray-400">
                            <button
                              type="button"
                              onClick={() => {
                                const currentYear = new Date().getFullYear();
                                const allYears = Array.from(
                                  { length: currentYear - 1998 + 1 },
                                  (_, i) => currentYear - i
                                );
                                setFilters((prev) => ({
                                  ...prev,
                                  selectedYears: allYears,
                                }));
                              }}
                              className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setFilters((prev) => ({
                                  ...prev,
                                  selectedYears: [],
                                }))
                              }
                              className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {Array.from(
                              { length: new Date().getFullYear() - 1998 + 1 },
                              (_, i) => new Date().getFullYear() - i
                            ).map((year) => {
                              const checked =
                                filters.selectedYears.includes(year);
                              return (
                                <label
                                  key={year}
                                  className="flex items-center space-x-1 text-[10px] text-gray-200 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setFilters((prev) => {
                                        const exists =
                                          prev.selectedYears.includes(year);
                                        return {
                                          ...prev,
                                          selectedYears: exists
                                            ? prev.selectedYears.filter(
                                              (y) => y !== year
                                            )
                                            : [...prev.selectedYears, year],
                                        };
                                      });
                                    }}
                                    className="h-3 w-3 accent-blue-500"
                                  />
                                  <span>{year}</span>
                                </label>
                              );
                            })}
                          </div>

                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      onClick={clearFilters}
                      className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear Filters</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Upcoming Meets Table */}
      <div className="max-w-[1200px] mx-auto">
        <div className="card-results results-table mb-8">
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-300 dark:!bg-gray-700 dark:!text-gray-200">
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("trueRank")}>
                      Rank {getSortIcon("trueRank")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("lifter_name")}>
                      Athlete {getSortIcon("lifter_name")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("gender")}>
                      Gender {getSortIcon("gender")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("weight_class")}>
                      Weight Class {getSortIcon("weight_class")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("last_body_weight")}>
                      Body Weight {getSortIcon("last_body_weight")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("best_snatch")}>
                      Best Sn {getSortIcon("best_snatch")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("best_cj")}>
                      Best CJ {getSortIcon("best_cj")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("best_total")}>
                      Total {getSortIcon("best_total")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("best_qpoints")}>
                      Q-Points {getSortIcon("best_qpoints")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("competition_age")}>
                      Comp Age {getSortIcon("competition_age")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider">
                      Age Category
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("last_competition")}>
                      Date {getSortIcon("last_competition")}
                    </th>
                    <th className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-app-surface transition-colors select-none" onClick={() => handleSort("last_meet_name")}>
                      Meet Name {getSortIcon("last_meet_name")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 15 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="border-t border-gray-700/50 animate-pulse">
                        {Array.from({ length: 14 }).map((_, j) => (
                          <td key={j} className="px-2 py-3">
                            <div className="h-4 bg-gray-700/50 rounded w-full"></div>
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    displayResults.map((athlete, index) => (
                      <tr
                        key={athlete.unique_id}
                        className="border-t first:border-t-0 dark:even:bg-gray-600/15 even:bg-gray-400/10 hover:bg-app-hover transition-colors"
                        style={{ borderTopColor: 'var(--border-secondary)' }}
                      >
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          {athlete.trueRank ?? ""}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          <div className="font-medium">
                            <Link
                              href={
                                athlete.federation === "iwf"
                                  ? `/athlete/iwf/${athlete.iwf_lifter_id}`
                                  : (athlete.membership_number && athlete.membership_number !== "null" && athlete.membership_number !== "")
                                    ? `/athlete/${athlete.membership_number}`
                                    : `/athlete/u-${athlete.lifter_id}`
                              }
                              prefetch={false}
                              className="text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              {athlete.lifter_name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${athlete.federation === 'iwf'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                            {athlete.federation === 'iwf' ? 'IWF' : 'USAW'}
                          </span>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          <div className="flex items-center space-x-2">
                            {(() => {
                              const FlagComponent = getCountryFlagComponent(athlete.country_code || "");
                              return FlagComponent ? <FlagComponent style={{ width: '1.2em', height: 'auto' }} /> : null;
                            })()}
                            <span>{athlete.country_code || "-"}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          {athlete.gender}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          {athlete.weight_class || "-"}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          {athlete.last_body_weight ? `${athlete.last_body_weight}kg` : "-"}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="font-medium text-xs" style={{ color: 'var(--chart-snatch)' }}>
                            {athlete.best_snatch || "-"}
                            {athlete.best_snatch ? "kg" : ""}
                          </span>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="font-medium text-xs" style={{ color: 'var(--chart-cleanjerk)' }}>
                            {athlete.best_cj || "-"}
                            {athlete.best_cj ? "kg" : ""}
                          </span>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap">
                          <span className="font-bold text-xs" style={{ color: 'var(--chart-total)' }}>
                            {athlete.best_total || "-"}
                            {athlete.best_total ? "kg" : ""}
                          </span>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          <span className="font-bold" style={getBestQScore(athlete).style}>
                            {getBestQScore(athlete).value ? getBestQScore(athlete).value.toFixed(1) : "-"}
                          </span>
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          {athlete.competition_age || "-"}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          {athlete.age_category || "-"}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs">
                          {athlete.last_competition ? new Date(athlete.last_competition).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-2 py-1 whitespace-nowrap text-xs max-w-[200px] truncate" title={athlete.last_meet_name || ""}>
                          <Link
                            href={
                              athlete.federation === "iwf"
                                ? `/meet/iwf/${athlete.meet_id}`
                                : `/meet/${athlete.meet_id}`
                            }
                            prefetch={false}
                            className="text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            {athlete.last_meet_name || "-"}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>


              {!loading && filteredRankings.length === 0 && (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">
                    No athletes found matching your criteria
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredRankings.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-app-muted">
                  Showing {((currentPage - 1) * resultsPerPage) + 1} to {Math.min(currentPage * resultsPerPage, filteredRankings.length)} of {filteredRankings.length} results
                </div>

                <div className="flex items-center space-x-2">
                  {currentPage > 1 && (
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </button>
                  )}

                  <div className="flex space-x-1">
                    {(() => {
                      const delta = 2;
                      const pages = [];
                      const start = Math.max(1, currentPage - delta);
                      const end = Math.min(totalPages, currentPage + delta);

                      if (start > 1) {
                        pages.push(1);
                        if (start > 2) pages.push('...');
                      }

                      for (let i = start; i <= end; i++) {
                        pages.push(i);
                      }

                      if (end < totalPages) {
                        if (end < totalPages - 1) pages.push('...');
                        pages.push(totalPages);
                      }

                      return pages.map((page, index) => (
                        <button
                          key={index}
                          onClick={() => typeof page === 'number' && setCurrentPage(page)}
                          disabled={page === '...'}
                          className={`px-3 py-2 text-sm font-medium rounded-lg ${page === currentPage
                            ? 'bg-accent-primary text-app-primary border border-accent-primary'
                            : page === '...'
                              ? 'text-app-muted cursor-default'
                              : 'text-app-secondary bg-app-tertiary border border-app-secondary hover:bg-app-surface'
                            }`}
                        >
                          {page}
                        </button>
                      ));
                    })()}
                  </div>

                  {currentPage < totalPages && (
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Click outside handler for export menu */}
          {showExportMenu && (
            <div
              className="fixed inset-0 z-5"
              onClick={() => setShowExportMenu(false)}
            />
          )}

          {showYearDropdown && (
            <div
              className="fixed inset-0 z-0"
              onClick={() => setShowYearDropdown(false)}
            />
          )}
        </div>
      </div>
    </div >
  );
}

export default function RankingsPage() {
  return (
    <AuthGuard
      requireRole={ROLES.ADMIN}
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to view upcoming meets.
            </p>
          </div>
        </div>
      }
    >
      <RankingsContent />
    </AuthGuard>
  );
}
