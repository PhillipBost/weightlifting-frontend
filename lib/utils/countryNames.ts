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

const US_CITIES_TO_STATE: Record<string, string> = {
  // Ohio
  Hilliard: 'Ohio', Columbus: 'Ohio', Cleveland: 'Ohio', Cincinnati: 'Ohio',
  Akron: 'Ohio', Toledo: 'Ohio', Dayton: 'Ohio', Dublin: 'Ohio', Westerville: 'Ohio',
  // Iowa
  'Council Bluffs': 'Iowa', 'Des Moines': 'Iowa', 'Cedar Rapids': 'Iowa',
  Davenport: 'Iowa', 'Sioux City': 'Iowa', 'Iowa City': 'Iowa', Ames: 'Iowa', Waterloo: 'Iowa',
  // North Carolina
  Morganton: 'North Carolina', Charlotte: 'North Carolina', Raleigh: 'North Carolina',
  Greensboro: 'North Carolina', Durham: 'North Carolina', 'Winston-Salem': 'North Carolina',
  Asheville: 'North Carolina', Wilmington: 'North Carolina', Cary: 'North Carolina',
  // California
  'San Jose': 'California', 'Los Angeles': 'California', 'San Francisco': 'California',
  'San Diego': 'California', Sacramento: 'California', Fresno: 'California', 'Long Beach': 'California',
  Oakland: 'California', Anaheim: 'California', Bakersfield: 'California', Riverside: 'California',
  Stockton: 'California', Irvine: 'California',
  // Utah
  'American Fork': 'Utah', 'Salt Lake City': 'Utah', Provo: 'Utah',
  'West Valley City': 'Utah', 'West Jordan': 'Utah', Orem: 'Utah', Sandy: 'Utah', Ogden: 'Utah',
  // Texas
  Austin: 'Texas', Houston: 'Texas', Dallas: 'Texas', 'San Antonio': 'Texas',
  'Fort Worth': 'Texas', 'El Paso': 'Texas', Arlington: 'Texas', Plano: 'Texas',
  // Florida
  Miami: 'Florida', Orlando: 'Florida', Tampa: 'Florida', Jacksonville: 'Florida',
  'St. Petersburg': 'Florida', Tallahassee: 'Florida', 'Fort Lauderdale': 'Florida',
  // New York
  'New York': 'New York', Buffalo: 'New York', Rochester: 'New York',
  Yonkers: 'New York', Syracuse: 'New York', Albany: 'New York',
  // Illinois
  Chicago: 'Illinois', Aurora: 'Illinois', Naperville: 'Illinois',
  Rockford: 'Illinois', Joliet: 'Illinois', Springfield: 'Illinois',
  // Pennsylvania
  Philadelphia: 'Pennsylvania', Pittsburgh: 'Pennsylvania', Allentown: 'Pennsylvania',
  Reading: 'Pennsylvania', Erie: 'Pennsylvania',
  // Georgia
  Atlanta: 'Georgia', Augusta: 'Georgia', Savannah: 'Georgia', Columbus: 'Georgia',
  // Washington
  Seattle: 'Washington', Spokane: 'Washington', Tacoma: 'Washington',
  Vancouver: 'Washington', Bellevue: 'Washington',
  // Colorado
  Denver: 'Colorado', 'Colorado Springs': 'Colorado', Aurora: 'Colorado',
  'Fort Collins': 'Colorado', Boulder: 'Colorado',
  // Massachusetts
  Boston: 'Massachusetts', Worcester: 'Massachusetts', Springfield: 'Massachusetts', Cambridge: 'Massachusetts',
  // Virginia
  'Virginia Beach': 'Virginia', Norfolk: 'Virginia', Chesapeake: 'Virginia',
  Richmond: 'Virginia', Arlington: 'Virginia', Alexandria: 'Virginia',
  // Arizona
  Phoenix: 'Arizona', Tucson: 'Arizona', Mesa: 'Arizona', Chandler: 'Arizona', Scottsdale: 'Arizona',
  // Michigan
  Detroit: 'Michigan', 'Grand Rapids': 'Michigan', Warren: 'Michigan',
  'Sterling Heights': 'Michigan', 'Ann Arbor': 'Michigan', Lansing: 'Michigan',
  // Minnesota
  Minneapolis: 'Minnesota', 'Saint Paul': 'Minnesota', Rochester: 'Minnesota',
  Duluth: 'Minnesota', Bloomington: 'Minnesota',
  // Indiana
  Indianapolis: 'Indiana', 'Fort Wayne': 'Indiana', Evansville: 'Indiana',
  'South Bend': 'Indiana', Carmel: 'Indiana',
  // Missouri
  'Kansas City': 'Missouri', 'St. Louis': 'Missouri', Springfield: 'Missouri', Columbia: 'Missouri',
  // Tennessee
  Nashville: 'Tennessee', Memphis: 'Tennessee', Knoxville: 'Tennessee', Chattanooga: 'Tennessee',
  // Maryland
  Baltimore: 'Maryland', Frederick: 'Maryland', Rockville: 'Maryland', Gaithersburg: 'Maryland',
  // Wisconsin
  Milwaukee: 'Wisconsin', Madison: 'Wisconsin', 'Green Bay': 'Wisconsin',
  // Oregon
  Portland: 'Oregon', Salem: 'Oregon', Eugene: 'Oregon',
  // Oklahoma
  'Oklahoma City': 'Oklahoma', Tulsa: 'Oklahoma', Norman: 'Oklahoma',
  // Kentucky
  Louisville: 'Kentucky', Lexington: 'Kentucky', 'Bowling Green': 'Kentucky',
  // Louisiana
  'New Orleans': 'Louisiana', 'Baton Rouge': 'Louisiana', Shreveport: 'Louisiana', Lafayette: 'Louisiana',
  // South Carolina
  Charleston: 'South Carolina', Columbia: 'South Carolina', 'North Charleston': 'South Carolina',
  'Mount Pleasant': 'South Carolina', Greenville: 'South Carolina',
  // Alabama
  Huntsville: 'Alabama', Birmingham: 'Alabama', Montgomery: 'Alabama', Mobile: 'Alabama',
  // Nevada
  'Las Vegas': 'Nevada', Henderson: 'Nevada', Reno: 'Nevada', 'North Las Vegas': 'Nevada',
  // New Jersey
  Newark: 'New Jersey', 'Jersey City': 'New Jersey', Paterson: 'New Jersey', Elizabeth: 'New Jersey',
  // District of Columbia
  Washington: 'District of Columbia',
  // Kansas
  Wichita: 'Kansas', 'Overland Park': 'Kansas',
  // Arkansas
  'Little Rock': 'Arkansas', Fayetteville: 'Arkansas',
  // Mississippi
  Jackson: 'Mississippi', Gulfport: 'Mississippi',
  // Connecticut
  Bridgeport: 'Connecticut', 'New Haven': 'Connecticut', Stamford: 'Connecticut', Hartford: 'Connecticut',
  // Nebraska
  Omaha: 'Nebraska', Lincoln: 'Nebraska',
  // New Mexico
  Albuquerque: 'New Mexico', 'Las Cruces': 'New Mexico',
  // Idaho
  Boise: 'Idaho', Meridian: 'Idaho',
  // Hawaii
  Honolulu: 'Hawaii',
  // New Hampshire
  Manchester: 'New Hampshire', Nashua: 'New Hampshire',
  // Maine
  Portland: 'Maine',
  // Rhode Island
  Providence: 'Rhode Island',
  // Montana
  Billings: 'Montana', Missoula: 'Montana',
  // Delaware
  Wilmington: 'Delaware',
  // South Dakota
  'Sioux Falls': 'South Dakota', 'Rapid City': 'South Dakota',
  // North Dakota
  Fargo: 'North Dakota', Bismarck: 'North Dakota',
  // Alaska
  Anchorage: 'Alaska', Fairbanks: 'Alaska',
  // Vermont
  Burlington: 'Vermont',
  // Wyoming
  Cheyenne: 'Wyoming', Casper: 'Wyoming',
  // West Virginia
  Charleston: 'West Virginia', Huntington: 'West Virginia'
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

  // 1. Direct city-to-subdivision mapping
  let subdivision = '';
  if (c === 'US' && US_CITIES_TO_STATE[cleanCity]) {
    subdivision = US_CITIES_TO_STATE[cleanCity];
  } else if (INTL_CITIES_TO_REGION[c] && INTL_CITIES_TO_REGION[c][cleanCity]) {
    subdivision = INTL_CITIES_TO_REGION[c][cleanCity];
  }

  // 2. Active regional correlation fallback
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
