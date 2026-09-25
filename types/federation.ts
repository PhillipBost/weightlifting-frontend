/**
 * Living Federation Registry Interfaces
 * Matches public.federation_registry and public.search_federations RPC
 */

export type FederationLevel = 
  | 'global_international'       // Universal apex: International Weightlifting Federation (IWF), United Masters Weightlifting Federation (UMWF), International Masters Weightlifting Association (IMWA)
  | 'international'              // Backward-compatible synonym for global_international
  | 'continental'                // Continental confederations (PAWF, EWF, AWF, WFA, OWF)
  | 'intercontinental_regional'  // Multi-continent bodies: Commonwealth Weightlifting Federation (CWF), Mediterranean Weightlifting Federation (MWF), Arabic Weightlifting Federation (AWF)
  | 'regional'                   // Sub-continental bodies: South American Weightlifting Confederation (CSLP), Nordic Weightlifting Federation (NWF), Visegrad Four Weightlifting Federation (V4WF), etc.
  | 'national'                   // National governing bodies (e.g. USA Weightlifting, Weightlifting Canada Haltérophilie)
  | 'regional_state_wso'         // Domestic State/Provincial bodies (USAW WSOs, Canadian Provincial Federations)
  | 'club';                      // Local clubs and training centers

export const FEDERATION_LEVEL_LABELS: Record<FederationLevel, string> = {
  global_international: 'Global Apex',
  international: 'International',
  continental: 'Continental',
  intercontinental_regional: 'Intercontinental Regional (Multi-Country)',
  regional: 'Regional (Multi-Country)',
  national: 'National',
  regional_state_wso: 'State / Provincial (WSO)',
  club: 'Club'
};

export interface FederationMatch {
  id: string;                    // UUID in public.federation_registry
  canonical_name: string;        // e.g. "Weightlifting Canada Haltérophilie"
  short_code: string | null;     // e.g. "WCH", "USAW", "USAW-WSO-3"
  country_code: string | null;   // ISO-3 code e.g. "BRA", "CAN", "USA"
  level: FederationLevel;
  parent_federation_id?: string | null;
  parent_name?: string | null;
  known_aliases?: string[];
  is_verified: boolean;
  match_rank: number;            // 100 = exact alias/acronym, 80+ = match

  // Longitudinal & Point-in-Time match fields from public.search_federations RPC
  matched_name?: string | null;
  matched_acronym?: string | null;
  matched_language?: string | null;
  matched_name_type?: 'primary' | 'official_translation' | 'historical' | 'common_alias' | null;
  is_temporally_exact?: boolean;
}

export interface FederationSearchResponse {
  success: boolean;
  query: string;
  as_of_date?: string | null;
  count: number;
  matches: FederationMatch[];
  error?: string;
}

export interface CandidateQuery {
  value: string;
  sourceField: string;
  fieldLabel: string;
}

export interface FederationSelection {
  id?: string | null;
  canonical_name: string;
  short_code?: string | null;
  country_code?: string | null;
  level?: FederationLevel;
  matched_name?: string | null;
  matched_acronym?: string | null;
  matched_name_type?: 'primary' | 'official_translation' | 'historical' | 'common_alias' | null;
  is_temporally_exact?: boolean;
  isUnknown?: boolean;
  isNewUnconfirmed?: boolean;
  isGuessed?: boolean;
  guessedFrom?: string;
  guessedFromField?: string;
  guessedFromFieldLabel?: string;
  note?: string;
}

export interface FederationLocalization {
  id: string;
  federation_id: string;
  language_code: string;
  full_name: string;
  acronym: string | null;
  name_type: 'primary' | 'official_translation' | 'historical' | 'common_alias';
  is_official_in_charter?: boolean;
  valid_from: string | null;
  valid_until: string | null;
  citation?: string | null;
}

export type FederationRelationshipType = 
  | 'continental_confederation' 
  | 'international_member' 
  | 'continental_member' 
  | 'regional_confederation'
  | 'intercontinental_confederation'
  | 'regional_member'
  | 'regional_subdivision';

export interface FederationAffiliation {
  id: string;
  child_id: string;
  parent_id: string;
  relationship_type: FederationRelationshipType;
  is_active: boolean;
  effective_start: string | null;
  effective_end: string | null;
  parent?: {
    id: string;
    canonical_name: string;
    short_code: string | null;
    level: FederationLevel;
  };
  child?: {
    id: string;
    canonical_name: string;
    short_code: string | null;
    level: FederationLevel;
  };
}

export interface FederationHeadquarters {
  id: string;
  federation_id: string;
  city: string;
  country_code: string;
  address: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_current: boolean;
  citation?: string | null;
}

export interface FederationGovernanceNode {
  id: string;
  canonical_name: string;
  acronym?: string | null;
  short_code?: string | null;
  level: FederationLevel;
  relationship_type: FederationRelationshipType;
}

export interface FederationGovernanceHierarchy {
  federation_id: string;
  canonical_name: string;
  level: FederationLevel;
  apex_international?: FederationGovernanceNode | null;
  continental_confederation?: FederationGovernanceNode | null;
  regional_parent?: FederationGovernanceNode | null;
  subdivisions?: FederationGovernanceNode[];
}

/**
 * Options returned by list_federation_options RPC
 */
export interface FederationTierDisplayName {
  language_code: string;
  full_name: string;
  acronym: string | null;
  name_type: 'primary' | 'official_translation' | 'historical' | 'common_alias';
}

export interface FederationTierOption {
  id: string;
  canonical_name: string;
  short_code: string | null;
  country_code: string | null;
  level: FederationLevel;
  parent_federation_id: string | null;
  is_verified: boolean;
  known_aliases: string[];
  display_names: FederationTierDisplayName[];
  total_count?: number;
}

export interface FederationOptionsResponse {
  success: boolean;
  total_count: number;
  limit: number;
  offset: number;
  has_more: boolean;
  items: FederationTierOption[];
  error?: string;
}

/**
 * Lineage hop returned by get_federation_lineage RPC
 */
export interface FederationLineageHop {
  depth: number;
  parent_id: string;
  parent_canonical_name: string;
  parent_short_code: string | null;
  parent_level: FederationLevel;
  relationship_type: FederationRelationshipType;
  is_verified: boolean;
  citation: string | null;
  effective_start: string | null;
  effective_end: string | null;
  is_root: boolean;
}

export interface FederationLineageResponse {
  success: boolean;
  entity_id: string;
  as_of_date: string | null;
  roots: string[];
  hops: FederationLineageHop[];
  error?: string;
}

/**
 * Database check-constrained competition scopes
 */
export type CompetitionScope =
  | 'international'
  | 'continental'
  | 'regional'
  | 'national'
  | 'state_provincial'
  | 'local'
  | 'unknown';

/**
 * Human uploader choices submitted with meet upload
 */
export interface UploaderSelections {
  international_id?: string | null;
  continent_id?: string | null;
  regional_id?: string | null;
  country_id?: string | null;
  organizer_id?: string | null;
  host_country_code?: string | null;
  competition_scope?: CompetitionScope | null;
  cleared: string[];
  custom_international_name?: string | null;
  custom_regional_name?: string | null;
  custom_country_name?: string | null;
  custom_organizer_name?: string | null;
  custom_host_country_name?: string | null;
  additional_notes?: string | null;
}

export type ResolutionStatus = 'unique' | 'ambiguous' | 'no_match' | 'missing_in_source';

export interface FieldResolution {
  status: ResolutionStatus;
  raw_input?: string | null;
  match?: FederationMatch | null;
  candidates?: FederationMatch[];
  confidence_tier?: 'exact' | 'substring' | null;
  match_rank?: number | null;
  note?: string;
}

export interface BatchResolveRequest {
  organizer_text?: string | null;
  federation_text?: string | null;
  competition_name?: string | null;
  host_country_text?: string | null;
  city_text?: string | null;
  venue_text?: string | null;
  record_federations?: string[];
  team_names?: string[];
  athlete_countries?: string[];
  competition_date?: string | null;
}

export interface BatchResolveResponse {
  success: boolean;
  organizer: FieldResolution;
  federation: FieldResolution;
  host_country?: FieldResolution;
  suggested_scope: CompetitionScope;
  has_derived_scope?: boolean;
  scope_inference_source?: string | null;
  inferred_international_name?: string | null;
  inferred_international_federation?: FederationMatch | null;
  inferred_continental_federation?: FederationMatch | null;
  inferred_national_federation?: FederationMatch | null;
  inferred_regional_federation?: FederationMatch | null;
  inferred_regional_federation_source?: string | null;
  record_federations: Record<string, FieldResolution>;
  teams_analysis?: {
    total_teams: number;
    delegation_count?: number;
    unambiguous_country_codes?: string[];
  };
  caveats: string[];
  error?: string;
}

export type ContinentRegion = 'americas' | 'europe' | 'asia' | 'oceania' | 'africa';

export const COUNTRY_TO_CONTINENT: Record<string, ContinentRegion> = {
  // Americas
  ECU: 'americas', CAN: 'americas', USA: 'americas', COL: 'americas', MEX: 'americas',
  BRA: 'americas', ARG: 'americas', PER: 'americas', CHI: 'americas', CHL: 'americas',
  VEN: 'americas', PUR: 'americas', DOM: 'americas', CUB: 'americas', GUA: 'americas',
  GTM: 'americas', PAN: 'americas', CRC: 'americas', CRI: 'americas', ESA: 'americas',
  SLV: 'americas', HON: 'americas', HND: 'americas', NCA: 'americas', NIC: 'americas',
  PAR: 'americas', PRY: 'americas', URU: 'americas', URY: 'americas', BOL: 'americas',
  ARU: 'americas', ABW: 'americas', BAR: 'americas', BRB: 'americas', JAM: 'americas',
  TTO: 'americas', GUY: 'americas', SUR: 'americas', HAI: 'americas', HTI: 'americas',
  CAY: 'americas', CYM: 'americas', BER: 'americas', BMU: 'americas', ISV: 'americas',
  VIR: 'americas', IVB: 'americas', VGB: 'americas', BAH: 'americas', BHS: 'americas',
  BIZ: 'americas', BLZ: 'americas', ANT: 'americas', ATG: 'americas', GRN: 'americas',
  LCA: 'americas', VIN: 'americas', VCT: 'americas', SKN: 'americas', KNA: 'americas',
  DMA: 'americas', CUR: 'americas', CUW: 'americas', SXM: 'americas',
  // Europe
  GBR: 'europe', FRA: 'europe', GER: 'europe', DEU: 'europe', ITA: 'europe',
  ESP: 'europe', POL: 'europe', UKR: 'europe', GEO: 'europe', ARM: 'europe',
  TUR: 'europe', BUL: 'europe', ROU: 'europe', GRE: 'europe', GRC: 'europe',
  HUN: 'europe', ALB: 'europe', SWE: 'europe', NOR: 'europe', FIN: 'europe',
  DEN: 'europe', DNK: 'europe', AUT: 'europe', BEL: 'europe', NED: 'europe',
  NLD: 'europe', SUI: 'europe', CHE: 'europe', CZE: 'europe', SVK: 'europe',
  IRL: 'europe', POR: 'europe', PRT: 'europe', CRO: 'europe', HRV: 'europe',
  SRB: 'europe', BIH: 'europe', SLO: 'europe', SVN: 'europe', MKD: 'europe',
  MNE: 'europe', KOS: 'europe', CYP: 'europe', MLT: 'europe', ISL: 'europe',
  LUX: 'europe', EST: 'europe', LAT: 'europe', LVA: 'europe', LTU: 'europe',
  MDA: 'europe', AZE: 'europe', ISR: 'europe', MON: 'europe', MCO: 'europe',
  SMR: 'europe', AND: 'europe', LIE: 'europe', BLR: 'europe', RUS: 'europe',
  // Asia
  CHN: 'asia', KOR: 'asia', PRK: 'asia', JPN: 'asia', TPE: 'asia', TWN: 'asia',
  THA: 'asia', INA: 'asia', IDN: 'asia', VIE: 'asia', VNM: 'asia', PHI: 'asia',
  PHL: 'asia', IND: 'asia', UZB: 'asia', KAZ: 'asia', IRI: 'asia', IRN: 'asia',
  IRQ: 'asia', KSA: 'asia', SAU: 'asia', QAT: 'asia', UAE: 'asia', ARE: 'asia',
  JOR: 'asia', MGL: 'asia', MNG: 'asia', SGP: 'asia', AFG: 'asia', BRU: 'asia',
  BRN: 'asia', BAN: 'asia', BGD: 'asia', BHU: 'asia', BTN: 'asia', CAM: 'asia',
  KHM: 'asia', HKG: 'asia', KUW: 'asia', KWT: 'asia', KGZ: 'asia', LAO: 'asia',
  LBN: 'asia', MAC: 'asia', MAS: 'asia', MYS: 'asia', MDV: 'asia', MYA: 'asia',
  MMR: 'asia', NEP: 'asia', NPL: 'asia', OMA: 'asia', OMN: 'asia', PAK: 'asia',
  PLE: 'asia', PSE: 'asia', SRI: 'asia', LKA: 'asia', SYR: 'asia', TJK: 'asia',
  TLS: 'asia', TKM: 'asia', YEM: 'asia',
  // Oceania
  AUS: 'oceania', NZL: 'oceania', SAM: 'oceania', WSM: 'oceania', NRU: 'oceania',
  PNG: 'oceania', FIJ: 'oceania', FJI: 'oceania', KIR: 'oceania', ASA: 'oceania',
  ASM: 'oceania', COK: 'oceania', FSM: 'oceania', GUM: 'oceania', MHL: 'oceania',
  PLW: 'oceania', SOL: 'oceania', SLB: 'oceania', TGA: 'oceania', TON: 'oceania',
  TUV: 'oceania', VAN: 'oceania', VUT: 'oceania', WLF: 'oceania', NCL: 'oceania',
  PYF: 'oceania', NUE: 'oceania',
  // Africa
  EGY: 'africa', NGR: 'africa', NGA: 'africa', TUN: 'africa', ALG: 'africa',
  DZA: 'africa', RSA: 'africa', ZAF: 'africa', CMR: 'africa', MRI: 'africa',
  MUS: 'africa', GHA: 'africa', KEN: 'africa', UGA: 'africa', MAD: 'africa',
  MDG: 'africa', SEY: 'africa', SYC: 'africa', BOT: 'africa', BWA: 'africa',
  NAM: 'africa', ZAM: 'africa', ZMB: 'africa', ZIM: 'africa', ZWE: 'africa',
  LBA: 'africa', LBY: 'africa', MAR: 'africa', SUD: 'africa', SDN: 'africa',
  SSD: 'africa', ETH: 'africa', ERI: 'africa', SOM: 'africa', DJI: 'africa',
  SEN: 'africa', CIV: 'africa', SLE: 'africa', LBR: 'africa', GUI: 'africa',
  GIN: 'africa', GBS: 'africa', GAM: 'africa', GMB: 'africa', MLI: 'africa',
  BUR: 'africa', BFA: 'africa', NIG: 'africa', NER: 'africa', CHA: 'africa',
  TCD: 'africa', TOG: 'africa', TGO: 'africa', BEN: 'africa', CGO: 'africa',
  COD: 'africa', GAB: 'africa', GEQ: 'africa', GNQ: 'africa', STP: 'africa',
  ANG: 'africa', AGO: 'africa', MOZ: 'africa', MAW: 'africa', MWI: 'africa',
  LES: 'africa', LSO: 'africa', SWZ: 'africa', CPV: 'africa', COM: 'africa',
  RWA: 'africa', BDI: 'africa', MTN: 'africa', MRT: 'africa'
};

/**
 * Universal Agent Protocol 10: Defined Acronym Standard
 * Maps ISO-3 / IOC / IWF country codes to their canonical country names.
 * Raw country or delegation codes must never be presented in isolation.
 */
export const CANONICAL_COUNTRY_NAMES: Record<string, string> = {
  // Americas
  ECU: 'Ecuador', CAN: 'Canada', USA: 'United States of America',
  COL: 'Colombia', MEX: 'Mexico', BRA: 'Brazil', ARG: 'Argentina',
  PER: 'Peru', CHI: 'Chile', CHL: 'Chile', VEN: 'Venezuela', PUR: 'Puerto Rico',
  DOM: 'Dominican Republic', CUB: 'Cuba', GUA: 'Guatemala', GTM: 'Guatemala', PAN: 'Panama',
  CRC: 'Costa Rica', CRI: 'Costa Rica', ESA: 'El Salvador', SLV: 'El Salvador',
  HON: 'Honduras', HND: 'Honduras', NCA: 'Nicaragua', NIC: 'Nicaragua',
  PAR: 'Paraguay', PRY: 'Paraguay', URU: 'Uruguay', URY: 'Uruguay', BOL: 'Bolivia',
  ARU: 'Aruba', ABW: 'Aruba', BAR: 'Barbados', BRB: 'Barbados', JAM: 'Jamaica',
  TTO: 'Trinidad and Tobago', GUY: 'Guyana', SUR: 'Suriname', HAI: 'Haiti', HTI: 'Haiti',
  CAY: 'Cayman Islands', CYM: 'Cayman Islands', BER: 'Bermuda', BMU: 'Bermuda',
  ISV: 'Virgin Islands (US)', VIR: 'Virgin Islands (US)',
  IVB: 'Virgin Islands (British)', VGB: 'Virgin Islands (British)',
  BAH: 'Bahamas', BHS: 'Bahamas', BIZ: 'Belize', BLZ: 'Belize',
  ANT: 'Antigua and Barbuda', ATG: 'Antigua and Barbuda', GRN: 'Grenada',
  LCA: 'Saint Lucia', VIN: 'Saint Vincent and the Grenadines', VCT: 'Saint Vincent and the Grenadines',
  SKN: 'Saint Kitts and Nevis', KNA: 'Saint Kitts and Nevis', DMA: 'Dominica',
  CUR: 'Curaçao', CUW: 'Curaçao', SXM: 'Sint Maarten',

  // Europe
  GBR: 'Great Britain', FRA: 'France', GER: 'Germany', DEU: 'Germany', ITA: 'Italy',
  ESP: 'Spain', POL: 'Poland', UKR: 'Ukraine', GEO: 'Georgia', ARM: 'Armenia',
  TUR: 'Turkey', BUL: 'Bulgaria', ROU: 'Romania', GRE: 'Greece', GRC: 'Greece',
  HUN: 'Hungary', ALB: 'Albania', SWE: 'Sweden', NOR: 'Norway', FIN: 'Finland',
  DEN: 'Denmark', DNK: 'Denmark', AUT: 'Austria', BEL: 'Belgium', NED: 'Netherlands',
  NLD: 'Netherlands', SUI: 'Switzerland', CHE: 'Switzerland', CZE: 'Czech Republic',
  SVK: 'Slovakia', IRL: 'Ireland', POR: 'Portugal', PRT: 'Portugal', CRO: 'Croatia',
  HRV: 'Croatia', SRB: 'Serbia', BIH: 'Bosnia and Herzegovina', SLO: 'Slovenia',
  SVN: 'Slovenia', MKD: 'North Macedonia', MNE: 'Montenegro', KOS: 'Kosovo',
  CYP: 'Cyprus', MLT: 'Malta', ISL: 'Iceland', LUX: 'Luxembourg', EST: 'Estonia',
  LAT: 'Latvia', LVA: 'Latvia', LTU: 'Lithuania', MDA: 'Moldova', AZE: 'Azerbaijan',
  ISR: 'Israel', MON: 'Monaco', MCO: 'Monaco', SMR: 'San Marino', AND: 'Andorra',
  LIE: 'Liechtenstein', BLR: 'Belarus', RUS: 'Russia',

  // Asia
  CHN: "People's Republic of China", KOR: 'Republic of Korea', PRK: "Democratic People's Republic of Korea",
  JPN: 'Japan', TPE: 'Chinese Taipei', TWN: 'Chinese Taipei', THA: 'Thailand',
  INA: 'Indonesia', IDN: 'Indonesia', VIE: 'Vietnam', VNM: 'Vietnam',
  PHI: 'Philippines', PHL: 'Philippines', IND: 'India', UZB: 'Uzbekistan',
  KAZ: 'Kazakhstan', IRI: 'Islamic Republic of Iran', IRN: 'Islamic Republic of Iran',
  IRQ: 'Iraq', KSA: 'Saudi Arabia', SAU: 'Saudi Arabia', QAT: 'Qatar',
  UAE: 'United Arab Emirates', ARE: 'United Arab Emirates', JOR: 'Jordan',
  MGL: 'Mongolia', MNG: 'Mongolia', SGP: 'Singapore', AFG: 'Afghanistan',
  BRU: 'Brunei Darussalam', BRN: 'Brunei Darussalam', BAN: 'Bangladesh', BGD: 'Bangladesh',
  BHU: 'Bhutan', BTN: 'Bhutan', CAM: 'Cambodia', KHM: 'Cambodia', HKG: 'Hong Kong, China',
  KUW: 'Kuwait', KWT: 'Kuwait', KGZ: 'Kyrgyzstan', LAO: "Lao People's Democratic Republic",
  LBN: 'Lebanon', MAC: 'Macau, China', MAS: 'Malaysia', MYS: 'Malaysia',
  MDV: 'Maldives', MYA: 'Myanmar', MMR: 'Myanmar', NEP: 'Nepal', NPL: 'Nepal',
  OMA: 'Oman', OMN: 'Oman', PAK: 'Pakistan', PLE: 'Palestine', PSE: 'Palestine',
  SRI: 'Sri Lanka', LKA: 'Sri Lanka', SYR: 'Syrian Arab Republic', TJK: 'Tajikistan',
  TLS: 'Timor-Leste', TKM: 'Turkmenistan', YEM: 'Yemen',

  // Oceania
  AUS: 'Australia', NZL: 'New Zealand', SAM: 'Samoa', WSM: 'Samoa', NRU: 'Nauru',
  PNG: 'Papua New Guinea', FIJ: 'Fiji', FJI: 'Fiji', KIR: 'Kiribati',
  ASA: 'American Samoa', ASM: 'American Samoa', COK: 'Cook Islands',
  FSM: 'Federated States of Micronesia', GUM: 'Guam', MHL: 'Marshall Islands',
  PLW: 'Palau', SOL: 'Solomon Islands', SLB: 'Solomon Islands',
  TGA: 'Tonga', TON: 'Tonga', TUV: 'Tuvalu', VAN: 'Vanuatu', VUT: 'Vanuatu',
  WLF: 'Wallis and Futuna', NCL: 'New Caledonia', PYF: 'French Polynesia', NUE: 'Niue',

  // Africa
  EGY: 'Egypt', NGR: 'Nigeria', NGA: 'Nigeria', TUN: 'Tunisia', ALG: 'Algeria',
  DZA: 'Algeria', RSA: 'South Africa', ZAF: 'South Africa', CMR: 'Cameroon',
  MRI: 'Mauritius', MUS: 'Mauritius', GHA: 'Ghana', KEN: 'Kenya', UGA: 'Uganda',
  MAD: 'Madagascar', MDG: 'Madagascar', SEY: 'Seychelles', SYC: 'Seychelles',
  BOT: 'Botswana', BWA: 'Botswana', NAM: 'Namibia', ZAM: 'Zambia', ZMB: 'Zambia',
  ZIM: 'Zimbabwe', ZWE: 'Zimbabwe', LBA: 'Libya', LBY: 'Libya', MAR: 'Morocco',
  SUD: 'Sudan', SDN: 'Sudan', SSD: 'South Sudan', ETH: 'Ethiopia', ERI: 'Eritrea',
  SOM: 'Somalia', DJI: 'Djibouti', SEN: 'Senegal', CIV: "Côte d'Ivoire",
  SLE: 'Sierra Leone', LBR: 'Liberia', GUI: 'Guinea', GIN: 'Guinea',
  GBS: 'Guinea-Bissau', GAM: 'Gambia', GMB: 'Gambia', MLI: 'Mali',
  BUR: 'Burkina Faso', BFA: 'Burkina Faso', NIG: 'Niger', NER: 'Niger',
  CHA: 'Chad', TCD: 'Chad', TOG: 'Togo', TGO: 'Togo', BEN: 'Benin',
  CGO: 'Congo', COD: 'Democratic Republic of the Congo', GAB: 'Gabon',
  GEQ: 'Equatorial Guinea', GNQ: 'Equatorial Guinea', STP: 'São Tomé and Príncipe',
  ANG: 'Angola', AGO: 'Angola', MOZ: 'Mozambique', MAW: 'Malawi', MWI: 'Malawi',
  LES: 'Lesotho', LSO: 'Lesotho', SWZ: 'Eswatini', CPV: 'Cabo Verde',
  COM: 'Comoros', RWA: 'Rwanda', BDI: 'Burundi', MTN: 'Mauritania', MRT: 'Mauritania'
};

export function formatDefinedTeam(teamNameOrCode: string): string {
  const trimmed = (teamNameOrCode || '').trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (CANONICAL_COUNTRY_NAMES[upper]) {
    return `${CANONICAL_COUNTRY_NAMES[upper]} (${upper})`;
  }
  return trimmed;
}

export const CANONICAL_ACRONYMS: Record<string, string> = {
  // Global & Masters
  "International Weightlifting Federation": 'IWF',
  "United Masters Weightlifting Federation": 'UMWF',
  "International Masters Weightlifting Association": 'IMWA',
  // Continental
  "European Weightlifting Federation": 'EWF',
  "Pan American Weightlifting Federation": 'PAWF',
  "Asian Weightlifting Federation": 'AWF',
  "Oceania Weightlifting Federation": 'OWF',
  "Weightlifting Federation of Africa": 'WFA',
  // Intercontinental Regional
  "Commonwealth Weightlifting Federation": 'CWF',
  "Mediterranean Weightlifting Federation": 'MWF',
  "Arabic Weightlifting Federation": 'AWF',
  // Regional
  "South American Weightlifting Confederation": 'CSLP',
  "Central American and Caribbean Weightlifting Confederation": 'CCCLP',
  "North American Weightlifting Committee": 'NAWC',
  "Nordic Weightlifting Federation": 'NWF',
  "Visegrad Four Weightlifting Federation": 'V4WF',
  "European Union Weightlifting Confederation": 'EUWC',
  "Small States of Europe Weightlifting Commission": 'SSEWC',
  "South Asian Weightlifting Federation": 'SAWF',
  "East Asian Weightlifting Federation": 'EAWF',
  "West Asian Weightlifting Federation": 'WAWF',
  "Central Asian Weightlifting Federation": 'CAWF',
  "Southeast Asian Weightlifting Federation": 'SEAWF',
  "Pacific Islands Weightlifting Federation": 'PIWF',
  // National Governing Bodies
  "USA Weightlifting": 'USAW',
  "Weightlifting Canada Haltérophilie": 'WCH',
  "Australian Weightlifting Federation Inc.": 'AWF',
  "Australian Weightlifting Federation": 'AWF',
  // Regional / State / Provincial Bodies
  "Fédération d'haltérophilie du Québec": 'FHQ',
  "Ontario Weightlifting Association": 'OWA',
  "British Columbia Weightlifting Association": 'BCWA',
  "Alberta Weightlifting Association": 'AWA',
  "Saskatchewan Weightlifting Association": 'SWA',
  "Manitoba Weightlifting Association": 'MWA',
  "Nova Scotia Weightlifting Association": 'NSWA',
  "New Brunswick Weightlifting Association": 'NBWA',
  "Newfoundland and Labrador Weightlifting Association": 'NLWA'
};

/**
 * Universal Agent Protocol 10: Defined Acronym Standard
 * Acronyms must never be displayed in isolation. Permitted only when explicitly
 * defined alongside their full canonical name.
 */
export function formatDefinedFederation(name: string, acronym?: string | null, countryCode?: string | null): string {
  const effectiveAcronym = 
    CANONICAL_ACRONYMS[name] || 
    (acronym && !acronym.startsWith('USAW-WSO-') ? acronym : null) || 
    null;

  let label = name;
  if (effectiveAcronym) {
    if (!name.includes(`(${effectiveAcronym})`)) {
      const cleanName = name.replace(new RegExp(`^${effectiveAcronym}\\s+`, 'i'), '').trim();
      label = `${cleanName} (${effectiveAcronym})`;
    }
  } else {
    const prefixMatch = name.match(/^([A-Z]{2,6})\s+(.+)$/);
    if (prefixMatch) {
      label = `${prefixMatch[2]} (${prefixMatch[1]})`;
    }
  }

  return label;
}


