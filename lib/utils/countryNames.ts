const ISO2_TO_ISO3: Record<string, string> = {
  AF: 'AFG', AL: 'ALB', DZ: 'DZA', AS: 'ASM', AD: 'AND', AO: 'AGO', AI: 'AIA', AQ: 'ATA', AG: 'ATG', AR: 'ARG',
  AM: 'ARM', AW: 'ABW', AU: 'AUS', AT: 'AUT', AZ: 'AZE', BS: 'BHS', BH: 'BHR', BD: 'BGD', BB: 'BRB', BY: 'BLR',
  BE: 'BEL', BZ: 'BLZ', BJ: 'BEN', BM: 'BMU', BT: 'BTN', BO: 'BOL', BA: 'BIH', BW: 'BWA', BR: 'BRA', BN: 'BRN',
  BG: 'BGR', BF: 'BFA', BI: 'BDI', KH: 'KHM', CM: 'CMR', CA: 'CAN', CV: 'CPV', KY: 'CYM', CF: 'CAF', TD: 'TCD',
  CL: 'CHL', CN: 'CHN', CO: 'COL', KM: 'COM', CG: 'COG', CD: 'COD', CR: 'CRI', CI: 'CIV', HR: 'HRV', CU: 'CUB',
  CY: 'CYP', CZ: 'CZE', DK: 'DNK', DJ: 'DJI', DM: 'DMA', DO: 'DOM', EC: 'ECU', EG: 'EGY', SV: 'SLV', GQ: 'GNQ',
  ER: 'ERI', EE: 'EST', ET: 'ETH', FJ: 'FJI', FI: 'FIN', FR: 'FRA', GA: 'GAB', GM: 'GMB', GE: 'GEO', DE: 'DEU',
  GH: 'GHA', GR: 'GRC', GD: 'GRD', GT: 'GTM', GN: 'GIN', GW: 'GNB', GY: 'GUY', HT: 'HTI', HN: 'HND', HK: 'HKG',
  HU: 'HUN', IS: 'ISL', IN: 'IND', ID: 'IDN', IR: 'IRN', IQ: 'IRQ', IE: 'IRL', IL: 'ISR', IT: 'ITA', JM: 'JAM',
  JP: 'JPN', JO: 'JOR', KZ: 'KAZ', KE: 'KEN', KI: 'KIR', KP: 'PRK', KR: 'KOR', KW: 'KWT', KG: 'KGZ', LA: 'LAO',
  LV: 'LVA', LB: 'LBN', LS: 'LSO', LR: 'LBR', LY: 'LBY', LI: 'LIE', LT: 'LTU', LU: 'LUX', MO: 'MAC', MK: 'MKD',
  MG: 'MDG', MW: 'MWI', MY: 'MYS', MV: 'MDV', ML: 'MLI', MT: 'MLT', MH: 'MHL', MR: 'MRT', MU: 'MUS', MX: 'MEX',
  FM: 'FSM', MD: 'MDA', MC: 'MCO', MN: 'MNG', ME: 'MNE', MA: 'MAR', MZ: 'MOZ', MM: 'MMR', NA: 'NAM', NR: 'NRU',
  NP: 'NPL', NL: 'NLD', NZ: 'NZL', NI: 'NIC', NE: 'NER', NG: 'NGA', NO: 'NOR', OM: 'OMN', PK: 'PAK', PW: 'PLW',
  PA: 'PAN', PG: 'PNG', PY: 'PRY', PE: 'PER', PH: 'PHL', PL: 'POL', PT: 'PRT', QA: 'QAT', RO: 'ROU', RU: 'RUS',
  RW: 'RWA', KN: 'KNA', LC: 'LCA', VC: 'VCT', WS: 'WSM', SM: 'SMR', ST: 'STP', SA: 'SAU', SN: 'SEN', RS: 'SRB',
  SC: 'SYC', SL: 'SLE', SG: 'SGP', SK: 'SVK', SI: 'SVN', SB: 'SLB', SO: 'SOM', ZA: 'ZAF', ES: 'ESP', LK: 'LKA',
  SD: 'SDN', SR: 'SUR', SZ: 'SWZ', SE: 'SWE', CH: 'CHE', SY: 'SYR', TW: 'TWN', TJ: 'TJK', TZ: 'TZA', TH: 'THA',
  TL: 'TLS', TG: 'TGO', TO: 'TON', TT: 'TTO', TN: 'TUN', TR: 'TUR', TM: 'TKM', TV: 'TUV', UG: 'UGA', UA: 'UKR',
  AE: 'ARE', GB: 'GBR', US: 'USA', UY: 'URY', UZ: 'UZB', VU: 'VUT', VE: 'VEN', VN: 'VNM', YE: 'YEM', ZM: 'ZMB',
  ZW: 'ZWE', XK: 'XKX'
};

// Canonical Olympic 3-letter overrides
const OLYMPIC_CODE_OVERRIDES: Record<string, string> = {
  NLD: 'NED',
  DEU: 'GER',
  PRT: 'POR',
  ZAF: 'RSA',
  CHE: 'SUI',
  GRC: 'GRE',
  DNK: 'DEN'
};

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export interface CountryDetails {
  iso2: string;
  iso3: string;
  displayCode: string;
  name: string;
  displayName: string;
}

export function getCountryDetails(code: string): CountryDetails {
  const upper = (code || '').toUpperCase().trim();
  let iso2 = upper;
  let iso3 = upper;

  if (upper.length === 2) {
    iso3 = ISO2_TO_ISO3[upper] || upper;
  } else if (upper.length === 3) {
    for (const [k, v] of Object.entries(ISO2_TO_ISO3)) {
      if (v === upper) {
        iso2 = k;
        break;
      }
    }
  }

  let name = '';
  try {
    if (iso2.length === 2) {
      name = regionNames.of(iso2) || '';
    }
  } catch {
    // fallback
  }

  if (!name) {
    name = iso3;
  }

  const displayCode = OLYMPIC_CODE_OVERRIDES[iso3] || iso3;

  return {
    iso2,
    iso3,
    displayCode,
    name,
    displayName: `${name} (${displayCode})`
  };
}

const US_STATE_CITIES: Record<string, string[]> = {
  OH: ['Hilliard', 'Columbus', 'Cleveland', 'Cincinnati', 'Akron', 'Toledo', 'Dayton', 'Dublin', 'Westerville'],
  IA: ['Council Bluffs', 'Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City', 'Ames', 'Waterloo'],
  NC: ['Morganton', 'Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Asheville', 'Wilmington', 'Cary'],
  CA: ['San Jose', 'Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Fresno', 'Long Beach', 'Oakland', 'Anaheim', 'Bakersfield', 'Riverside', 'Stockton', 'Irvine'],
  UT: ['American Fork', 'Salt Lake City', 'Provo', 'West Valley City', 'West Jordan', 'Orem', 'Sandy', 'Ogden', 'St. George'],
  TX: ['Austin', 'Houston', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Plano'],
  FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'St. Petersburg', 'Tallahassee', 'Fort Lauderdale'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Rockford', 'Joliet', 'Springfield'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie'],
  GA: ['Atlanta', 'Augusta', 'Savannah', 'Columbus'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge'],
  VA: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Arlington', 'Alexandria'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing'],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth', 'Bloomington'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
  MO: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
  MD: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg'],
  WI: ['Milwaukee', 'Madison', 'Green Bay'],
  OR: ['Portland', 'Salem', 'Eugene'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman'],
  KY: ['Louisville', 'Lexington', 'Bowling Green'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'],
  SC: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Greenville'],
  AL: ['Huntsville', 'Birmingham', 'Montgomery', 'Mobile'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas'],
  NJ: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth'],
  DC: ['Washington'],
  KS: ['Wichita', 'Overland Park', 'Kansas City'],
  AR: ['Little Rock', 'Fayetteville'],
  MS: ['Jackson', 'Gulfport'],
  CT: ['Bridgeport', 'New Haven', 'Stamford', 'Hartford'],
  NE: ['Omaha', 'Lincoln'],
  NM: ['Albuquerque', 'Las Cruces'],
  ID: ['Boise', 'Meridian'],
  HI: ['Honolulu'],
  NH: ['Manchester', 'Nashua'],
  ME: ['Portland'],
  RI: ['Providence'],
  MT: ['Billings', 'Missoula'],
  DE: ['Wilmington'],
  SD: ['Sioux Falls', 'Rapid City'],
  ND: ['Fargo', 'Bismarck'],
  AK: ['Anchorage', 'Fairbanks'],
  VT: ['Burlington'],
  WY: ['Cheyenne', 'Casper'],
  WV: ['Charleston', 'Huntington']
};

const INTL_CITIES_TO_REGION: Record<string, Record<string, string>> = {
  NL: {
    Haarlem: 'North Holland', Amsterdam: 'North Holland', Rotterdam: 'South Holland',
    'The Hague': 'South Holland', Utrecht: 'Utrecht', Eindhoven: 'North Brabant',
    Groningen: 'Groningen', Tilburg: 'North Brabant', Almere: 'Flevoland',
    Breda: 'North Brabant', Nijmegen: 'Gelderland'
  },
  AT: {
    Vienna: 'Vienna', Graz: 'Styria', Linz: 'Upper Austria', Salzburg: 'Salzburg',
    Innsbruck: 'Tyrol', Klagenfurt: 'Carinthia', Villach: 'Carinthia', Wels: 'Upper Austria',
    'Sankt Pölten': 'Lower Austria', Dornbirn: 'Vorarlberg', Bregenz: 'Vorarlberg'
  },
  CA: {
    Toronto: 'Ontario', Montreal: 'Quebec', Vancouver: 'British Columbia',
    Calgary: 'Alberta', Edmonton: 'Alberta', Ottawa: 'Ontario', Winnipeg: 'Manitoba',
    'Quebec City': 'Quebec', Halifax: 'Nova Scotia', Victoria: 'British Columbia'
  },
  GB: {
    London: 'England', Manchester: 'England', Birmingham: 'England',
    Edinburgh: 'Scotland', Glasgow: 'Scotland', Cardiff: 'Wales',
    Belfast: 'Northern Ireland', Leeds: 'England', Liverpool: 'England', Bristol: 'England'
  },
  AU: {
    Sydney: 'New South Wales', Melbourne: 'Victoria', Brisbane: 'Queensland',
    Perth: 'Western Australia', Adelaide: 'South Australia',
    Canberra: 'Australian Capital Territory', Hobart: 'Tasmania', Darwin: 'Northern Territory'
  },
  DE: {
    Berlin: 'Berlin', Munich: 'Bavaria', Frankfurt: 'Hesse', Hamburg: 'Hamburg',
    Cologne: 'North Rhine-Westphalia', Stuttgart: 'Baden-Württemberg',
    Düsseldorf: 'North Rhine-Westphalia', Leipzig: 'Saxony', Dortmund: 'North Rhine-Westphalia'
  },
  FR: {
    Paris: 'Île-de-France', Marseille: "Provence-Alpes-Côte d'Azur", Lyon: 'Auvergne-Rhône-Alpes',
    Toulouse: 'Occitanie', Nice: "Provence-Alpes-Côte d'Azur", Nantes: 'Pays de la Loire',
    Strasbourg: 'Grand Est', Montpellier: 'Occitanie', Bordeaux: 'Nouvelle-Aquitaine', Lille: 'Hauts-de-France'
  }
};

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia'
};

const COMMON_REGIONS: Record<string, string> = {
  'NL-NH': 'North Holland',
  'NL-ZH': 'South Holland',
  'NL-UT': 'Utrecht',
  'AT-9': 'Vienna',
  'AT-1': 'Burgenland',
  'AT-2': 'Carinthia',
  'AT-3': 'Lower Austria',
  'AT-4': 'Upper Austria',
  'AT-5': 'Salzburg',
  'AT-6': 'Styria',
  'AT-7': 'Tyrol',
  'AT-8': 'Vorarlberg'
};

export function formatRegionName(regionCode: string, countryCode?: string): string {
  if (!regionCode) return 'Unknown Region';
  const cleanCode = regionCode.trim().toUpperCase();

  if (cleanCode.includes('-')) {
    const [c, r] = cleanCode.split('-');
    const countryDetails = getCountryDetails(c);
    if (c === 'US' && US_STATES[r]) {
      return `${US_STATES[r]}, ${countryDetails.displayName}`;
    }
    if (COMMON_REGIONS[cleanCode]) {
      return `${COMMON_REGIONS[cleanCode]}, ${countryDetails.displayName}`;
    }
    return `${cleanCode}, ${countryDetails.displayName}`;
  }

  if (countryCode) {
    const countryDetails = getCountryDetails(countryCode);
    return `${regionCode}, ${countryDetails.displayName}`;
  }

  return regionCode;
}

export function formatCityName(
  cityName: string,
  countryCode?: string,
  activeRegions?: { x: string; country?: string }[]
): string {
  if (!cityName) return 'Unknown City';
  if (!countryCode) return cityName;

  const countryDetails = getCountryDetails(countryCode);
  const cleanCity = cityName.trim();
  const c = (countryCode || '').toUpperCase().trim();

  let subdivision = '';

  if (c === 'US') {
    // 1. Cross-reference with active telemetry regions first (e.g. 'US-OH' -> 'OH')
    if (activeRegions && activeRegions.length > 0) {
      for (const reg of activeRegions) {
        const regCode = (reg.x || '').toUpperCase().trim();
        if (regCode.startsWith('US-')) {
          const stateCode = regCode.split('-')[1];
          if (US_STATE_CITIES[stateCode]?.includes(cleanCity)) {
            subdivision = US_STATES[stateCode];
            break;
          }
        }
      }
    }

    // 2. Fallback to state registry
    if (!subdivision) {
      for (const [stateCode, cities] of Object.entries(US_STATE_CITIES)) {
        if (cities.includes(cleanCity)) {
          subdivision = US_STATES[stateCode];
          break;
        }
      }
    }
  } else if (INTL_CITIES_TO_REGION[c] && INTL_CITIES_TO_REGION[c][cleanCity]) {
    subdivision = INTL_CITIES_TO_REGION[c][cleanCity];
  }

  // 3. Active regional correlation fallback
  if (!subdivision && activeRegions && activeRegions.length > 0) {
    const matchingCountryRegions = activeRegions.filter(
      (r) => (r.country || '').toUpperCase() === c || (r.x.includes('-') && r.x.split('-')[0].toUpperCase() === c)
    );
    if (matchingCountryRegions.length === 1) {
      const regCode = matchingCountryRegions[0].x;
      if (regCode.includes('-')) {
        const [, r] = regCode.split('-');
        if (c === 'US' && US_STATES[r]) {
          subdivision = US_STATES[r];
        } else if (COMMON_REGIONS[regCode.toUpperCase()]) {
          subdivision = COMMON_REGIONS[regCode.toUpperCase()];
        }
      }
    }
  }

  if (subdivision) {
    return `${cleanCity}, ${subdivision}, ${countryDetails.displayName}`;
  }

  return `${cleanCity}, ${countryDetails.displayName}`;
}
