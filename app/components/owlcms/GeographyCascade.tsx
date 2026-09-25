'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  CompetitionScope, 
  FederationTierOption, 
  FederationLineageHop, 
  UploaderSelections,
  BatchResolveResponse,
  CANONICAL_COUNTRY_NAMES,
  formatDefinedFederation,
  FEDERATION_LEVEL_LABELS,
  FederationMatch
} from '@/types/federation';
import { 
  Globe2, 
  Flag, 
  Building2, 
  Sparkles, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  HelpCircle, 
  AlertCircle,
  ShieldCheck,
  Search,
  MapPin,
  FileText,
  Clock
} from 'lucide-react';

interface GeographyCascadeProps {
  asOfDate?: string | null;
  uploaderSelections: UploaderSelections;
  geographyInference?: BatchResolveResponse | null;
  onChange: (selections: UploaderSelections) => void;
  disabled?: boolean;
  hasError?: boolean;
}

function foldAccents(str: string): string {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

interface HostCountryOption {
  code: string;
  name: string;
  label: string;
}

const ALL_HOST_COUNTRIES: HostCountryOption[] = Object.entries(CANONICAL_COUNTRY_NAMES)
  .map(([code, name]) => ({
    code,
    name,
    label: `${name} (${code})`
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function formatHostCountryDisplay(code?: string | null, customCountryName?: string | null): string {
  if (customCountryName) return customCountryName;
  if (!code) return 'Select Host Country (e.g. Ecuador, Canada, USA)...';
  const countryName = CANONICAL_COUNTRY_NAMES[code];
  if (countryName) {
    return `${countryName} (${code})`;
  }
  return `Country (${code})`;
}

export interface ScopeOptionConfig {
  value: CompetitionScope;
  label: string;
  description: string;
  examples: string;
}

const SCOPE_OPTIONS: ScopeOptionConfig[] = [
  { 
    value: 'international', 
    label: 'International', 
    description: 'World & Olympic competitions sanctioned by a global governing body',
    examples: 'World Championships, Olympic Games, IWF Grand Prix, World Cup'
  },
  { 
    value: 'continental', 
    label: 'Continental', 
    description: 'Confederation championships spanning multiple nations across a continent',
    examples: 'Pan American Championships, European Championships, Asian Games'
  },
  { 
    value: 'regional', 
    label: 'Regional', 
    description: 'Multi-nation regional or intercontinental championships confined by federation charter or treaty',
    examples: 'Islamic Solidarity Games, Commonwealth Championships, South American Championships, Mediterranean Championships, Nordic Championships'
  },
  { 
    value: 'national', 
    label: 'National', 
    description: 'Country-wide championship meets sanctioned by a National Governing Body (NGB)',
    examples: 'National Championships, Olympic Trials, National Under-25, Junior Nationals'
  },
  { 
    value: 'state_provincial', 
    label: 'State / Provincial', 
    description: 'Domestic state or provincial championship meets sanctioned by a state/provincial subdivision',
    examples: 'State Championships, Provincial Championships, WSO Championships, Provincial Scholastic'
  },
  { 
    value: 'local', 
    label: 'Local', 
    description: 'Domestic local club invitationals, gym opens, and developmental events',
    examples: 'Club Invitationals, Local Open, Gym Series, High School / Youth Meets'
  },
  { 
    value: 'unknown', 
    label: 'Unknown', 
    description: 'Scope is unclassified or could not be determined from meet file',
    examples: 'Classification to be verified manually'
  }
];

function getTierRelevance(tier: 'international' | 'continent' | 'regional' | 'country' | 'organizer', scope: CompetitionScope | null | undefined): {
  isPrimary: boolean;
  isDesaturated: boolean;
} {
  const currentScope = scope || 'local';
  switch (currentScope) {
    case 'international':
      if (tier === 'international') {
        return { isPrimary: true, isDesaturated: false };
      }
      return { isPrimary: false, isDesaturated: true };

    case 'continental':
      if (tier === 'continent') {
        return { isPrimary: true, isDesaturated: false };
      }
      return { isPrimary: false, isDesaturated: true };

    case 'regional':
      if (tier === 'regional') {
        return { isPrimary: true, isDesaturated: false };
      }
      return { isPrimary: false, isDesaturated: true };

    case 'national':
      if (tier === 'country') {
        return { isPrimary: true, isDesaturated: false };
      }
      return { isPrimary: false, isDesaturated: true };

    case 'state_provincial':
      if (tier === 'organizer') {
        return { isPrimary: true, isDesaturated: false };
      }
      if (tier === 'country') {
        return { isPrimary: false, isDesaturated: false };
      }
      return { isPrimary: false, isDesaturated: true };

    case 'local':
      if (tier === 'organizer') {
        return { isPrimary: true, isDesaturated: false };
      }
      return { isPrimary: false, isDesaturated: true };

    default: // unknown
      return { isPrimary: false, isDesaturated: false };
  }
}

export function GeographyCascade({
  asOfDate = null,
  uploaderSelections,
  geographyInference = null,
  onChange,
  disabled = false,
  hasError = false
}: GeographyCascadeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTier, setActiveTier] = useState<'international' | 'continent' | 'regional' | 'country' | 'organizer' | 'host_country' | 'scope' | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);

  // Loaded tier options
  const [internationalOptions, setInternationalOptions] = useState<FederationTierOption[]>([]);
  const [continentOptions, setContinentOptions] = useState<FederationTierOption[]>([]);
  const [regionalOptions, setRegionalOptions] = useState<FederationTierOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<FederationTierOption[]>([]);
  const [organizerOptions, setOrganizerOptions] = useState<FederationTierOption[]>([]);

  // Selected entities details for display
  const [selectedInternational, setSelectedInternational] = useState<FederationTierOption | null>(null);
  const [selectedContinent, setSelectedContinent] = useState<FederationTierOption | null>(null);
  const [selectedRegional, setSelectedRegional] = useState<FederationTierOption | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<FederationTierOption | null>(null);
  const [selectedOrganizer, setSelectedOrganizer] = useState<FederationTierOption | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Dropdown portal refs and positioning
  const scopeTriggerRef = useRef<HTMLDivElement>(null);
  const hostCountryTriggerRef = useRef<HTMLDivElement>(null);
  const intlTriggerRef = useRef<HTMLDivElement>(null);
  const contTriggerRef = useRef<HTMLDivElement>(null);
  const regTriggerRef = useRef<HTMLDivElement>(null);
  const countryTriggerRef = useRef<HTMLDivElement>(null);
  const organizerTriggerRef = useRef<HTMLDivElement>(null);

  const [dropdownPos, setDropdownPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  // Associated Federations collapsible state
  const isLocalScope = uploaderSelections.competition_scope === 'local';
  const allTiersNone = !uploaderSelections.international_id &&
    !uploaderSelections.continent_id &&
    !uploaderSelections.regional_id &&
    !uploaderSelections.country_id &&
    !uploaderSelections.organizer_id;

  const [isFederationsExpanded, setIsFederationsExpanded] = useState(!allTiersNone);

  useEffect(() => {
    if (!allTiersNone) {
      setIsFederationsExpanded(true);
    }
  }, [allTiersNone]);

  const openDropdown = (
    tier: 'host_country' | 'international' | 'continent' | 'regional' | 'country' | 'organizer' | 'scope',
    ref: React.RefObject<HTMLDivElement | null>
  ) => {
    if (disabled) return;
    if (activeTier === tier) {
      setActiveTier(null);
      setDropdownPos(null);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < 260 && rect.top > 260;
      setDropdownPos({
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
        left: rect.left,
        width: rect.width
      });
      setActiveTier(tier);
      setSearchQuery('');
    }
  };

  useEffect(() => {
    if (!activeTier) return;
    const handleScrollOrClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-dropdown-panel="true"]')) return;
      if (
        scopeTriggerRef.current?.contains(target) ||
        hostCountryTriggerRef.current?.contains(target) ||
        intlTriggerRef.current?.contains(target) ||
        contTriggerRef.current?.contains(target) ||
        regTriggerRef.current?.contains(target) ||
        countryTriggerRef.current?.contains(target) ||
        organizerTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setActiveTier(null);
      setDropdownPos(null);
    };

    const handleWindowEvents = (e: Event) => {
      const target = e.target;
      if (target instanceof Element && target.closest('[data-dropdown-panel="true"]')) {
        return;
      }
      setActiveTier(null);
      setDropdownPos(null);
    };

    window.addEventListener('mousedown', handleScrollOrClickOutside);
    window.addEventListener('scroll', handleWindowEvents, true);
    window.addEventListener('resize', handleWindowEvents);
    return () => {
      window.removeEventListener('mousedown', handleScrollOrClickOutside);
      window.removeEventListener('scroll', handleWindowEvents, true);
      window.removeEventListener('resize', handleWindowEvents);
    };
  }, [activeTier]);

  // Search queries per tier
  const [searchQuery, setSearchQuery] = useState('');
  const [tierLoading, setTierLoading] = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const dateParam = asOfDate ? `&as_of_date=${encodeURIComponent(asOfDate)}` : '';

  // 1. Load international & continent options on mount or date change
  useEffect(() => {
    let active = true;
    async function loadGlobalOptions() {
      try {
        const [intlRes, contRes] = await Promise.all([
          fetch(`/api/federations/options?level=global_international,international${dateParam}&limit=20`),
          fetch(`/api/federations/options?level=continental${dateParam}&limit=10`)
        ]);
        const intlData = await intlRes.json();
        const contData = await contRes.json();
        if (active) {
          if (intlData.success) setInternationalOptions(intlData.items || []);
          if (contData.success) setContinentOptions(contData.items || []);
        }
      } catch (err) {
        console.error('Failed to load global federations:', err);
      }
    }
    loadGlobalOptions();
    return () => { active = false; };
  }, [dateParam]);

  // 2. Fetch selected entities details when IDs change
  useEffect(() => {
    let active = true;
    async function fetchEntities() {
      // International
      if (uploaderSelections.international_id?.startsWith('custom:') || (!uploaderSelections.international_id && uploaderSelections.custom_international_name)) {
        const customName = uploaderSelections.custom_international_name || uploaderSelections.international_id?.replace(/^custom:/, '') || '';
        setSelectedInternational({
          id: uploaderSelections.international_id || `custom:${customName}`,
          canonical_name: customName,
          short_code: null,
          country_code: null,
          level: 'international',
          parent_federation_id: null,
          is_verified: false,
          known_aliases: [],
          display_names: []
        });
      } else if (uploaderSelections.international_id && (!selectedInternational || selectedInternational.id !== uploaderSelections.international_id)) {
        if (geographyInference?.inferred_international_federation && geographyInference.inferred_international_federation.id === uploaderSelections.international_id) {
          const inf = geographyInference.inferred_international_federation;
          setSelectedInternational({
            id: inf.id,
            canonical_name: inf.canonical_name,
            short_code: inf.short_code,
            country_code: inf.country_code,
            level: inf.level,
            parent_federation_id: null,
            is_verified: inf.is_verified ?? true,
            known_aliases: [],
            display_names: []
          });
        } else {
          try {
            const res = await fetch(`/api/federations/options?level=global_international,international${dateParam}&limit=20`);
            const data = await res.json();
            if (active && data.success) {
              const found = data.items.find((i: FederationTierOption) => i.id === uploaderSelections.international_id);
              if (found) setSelectedInternational(found);
            }
          } catch {}
        }
      } else if (!uploaderSelections.international_id && !uploaderSelections.custom_international_name) {
        setSelectedInternational(null);
      }

      // Continent
      if (uploaderSelections.continent_id && (!selectedContinent || selectedContinent.id !== uploaderSelections.continent_id)) {
        if (geographyInference?.inferred_continental_federation && geographyInference.inferred_continental_federation.id === uploaderSelections.continent_id) {
          const inf = geographyInference.inferred_continental_federation;
          setSelectedContinent({
            id: inf.id,
            canonical_name: inf.canonical_name,
            short_code: inf.short_code,
            country_code: inf.country_code,
            level: 'continental',
            parent_federation_id: null,
            is_verified: inf.is_verified ?? true,
            known_aliases: [],
            display_names: []
          });
        } else {
          try {
            const res = await fetch(`/api/federations/options?level=continental${dateParam}&limit=200`);
            const data = await res.json();
            if (active && data.success) {
              const found = data.items.find((i: FederationTierOption) => i.id === uploaderSelections.continent_id);
              if (found) setSelectedContinent(found);
            }
          } catch {}
        }
      } else if (!uploaderSelections.continent_id) {
        setSelectedContinent(null);
      }

      // Regional
      if (uploaderSelections.regional_id?.startsWith('custom:') || (!uploaderSelections.regional_id && uploaderSelections.custom_regional_name)) {
        const customName = uploaderSelections.custom_regional_name || uploaderSelections.regional_id?.replace(/^custom:/, '') || '';
        setSelectedRegional({
          id: uploaderSelections.regional_id || `custom:${customName}`,
          canonical_name: customName,
          short_code: null,
          country_code: null,
          level: 'regional',
          parent_federation_id: null,
          is_verified: false,
          known_aliases: [],
          display_names: []
        });
      } else if (uploaderSelections.regional_id && (!selectedRegional || selectedRegional.id !== uploaderSelections.regional_id)) {
        try {
          const res = await fetch(`/api/federations/options?level=intercontinental_regional,regional${dateParam}&limit=100`);
          const data = await res.json();
          if (active && data.success) {
            const found = data.items.find((i: FederationTierOption) => i.id === uploaderSelections.regional_id);
            if (found) setSelectedRegional(found);
          }
        } catch {}
      } else if (!uploaderSelections.regional_id && !uploaderSelections.custom_regional_name) {
        setSelectedRegional(null);
      }

      // Country
      if (uploaderSelections.country_id?.startsWith('custom:')) {
        const customName = uploaderSelections.custom_country_name || uploaderSelections.country_id.replace(/^custom:/, '');
        setSelectedCountry({
          id: uploaderSelections.country_id,
          canonical_name: customName,
          short_code: null,
          country_code: null,
          level: 'national',
          parent_federation_id: null,
          is_verified: false,
          known_aliases: [],
          display_names: []
        });
      } else if (uploaderSelections.country_id && (!selectedCountry || selectedCountry.id !== uploaderSelections.country_id)) {
        if (geographyInference?.host_country?.match && geographyInference.host_country.match.id === uploaderSelections.country_id) {
          const m = geographyInference.host_country.match;
          setSelectedCountry({
            id: m.id,
            canonical_name: m.canonical_name,
            short_code: m.short_code,
            country_code: m.country_code,
            level: 'national',
            parent_federation_id: null,
            is_verified: m.is_verified ?? true,
            known_aliases: [],
            display_names: []
          });
        } else {
          try {
            const res = await fetch(`/api/federations/options?level=national${dateParam}&limit=200`);
            const data = await res.json();
            if (active && data.success) {
              const found = data.items.find((i: FederationTierOption) => i.id === uploaderSelections.country_id);
              if (found) setSelectedCountry(found);
            }
          } catch {}
        }
      } else if (!uploaderSelections.country_id) {
        setSelectedCountry(null);
      }

      // Organizer
      if (uploaderSelections.organizer_id?.startsWith('custom:')) {
        const customName = uploaderSelections.custom_organizer_name || uploaderSelections.organizer_id.replace(/^custom:/, '');
        setSelectedOrganizer({
          id: uploaderSelections.organizer_id,
          canonical_name: customName,
          short_code: null,
          country_code: selectedCountry?.country_code || null,
          level: 'regional_state_wso',
          parent_federation_id: null,
          is_verified: false,
          known_aliases: [],
          display_names: []
        });
      } else if (uploaderSelections.organizer_id && (!selectedOrganizer || selectedOrganizer.id !== uploaderSelections.organizer_id)) {
        if (geographyInference?.inferred_regional_federation && geographyInference.inferred_regional_federation.id === uploaderSelections.organizer_id) {
          const inf = geographyInference.inferred_regional_federation;
          setSelectedOrganizer({
            id: inf.id,
            canonical_name: inf.canonical_name,
            short_code: inf.short_code,
            country_code: inf.country_code,
            level: 'regional_state_wso',
            parent_federation_id: null,
            is_verified: inf.is_verified ?? true,
            known_aliases: [],
            display_names: []
          });
        } else {
          try {
            const res = await fetch(`/api/federations/options?level=national,regional,regional_state_wso,club${dateParam}&limit=200`);
            const data = await res.json();
            if (active && data.success) {
              const found = data.items.find((i: FederationTierOption) => i.id === uploaderSelections.organizer_id);
              if (found) setSelectedOrganizer(found);
            }
          } catch {}
        }
      } else if (!uploaderSelections.organizer_id) {
        setSelectedOrganizer(null);
      }
    }

    fetchEntities();
    return () => { active = false; };
  }, [
    uploaderSelections.international_id,
    uploaderSelections.custom_international_name,
    uploaderSelections.continent_id,
    uploaderSelections.regional_id,
    uploaderSelections.custom_regional_name,
    uploaderSelections.country_id,
    uploaderSelections.organizer_id,
    uploaderSelections.custom_country_name,
    uploaderSelections.custom_organizer_name,
    dateParam
  ]);

  // 4. Handle tier search / options loading
  useEffect(() => {
    if (!activeTier || activeTier === 'host_country') return;

    let active = true;
    const timer = setTimeout(async () => {
      setTierLoading(true);
      try {
        let level = 'continental';
        let parentConstraint = '';

        if (activeTier === 'international') {
          level = 'global_international,international';
        } else if (activeTier === 'continent') {
          level = 'continental';
        } else if (activeTier === 'regional') {
          level = 'intercontinental_regional,regional';
        } else if (activeTier === 'country') {
          level = 'national';
          if (uploaderSelections.continent_id) {
            parentConstraint = `&parent_id=${encodeURIComponent(uploaderSelections.continent_id)}`;
          }
        } else if (activeTier === 'organizer') {
          level = 'national,regional,regional_state_wso,club';
          if (uploaderSelections.country_id) {
            parentConstraint = `&parent_id=${encodeURIComponent(uploaderSelections.country_id)}`;
          }
        }

        const queryParam = searchQuery.trim() ? `&q=${encodeURIComponent(searchQuery.trim())}` : '';
        const res = await fetch(`/api/federations/options?level=${level}${parentConstraint}${queryParam}${dateParam}&limit=100`);
        const data = await res.json();

        if (active && data.success) {
          if (activeTier === 'international') setInternationalOptions(data.items || []);
          else if (activeTier === 'continent') setContinentOptions(data.items || []);
          else if (activeTier === 'regional') setRegionalOptions(data.items || []);
          else if (activeTier === 'country') setCountryOptions(data.items || []);
          else if (activeTier === 'organizer') setOrganizerOptions(data.items || []);
        }
      } catch (err) {
        console.error('Error fetching tier options:', err);
      } finally {
        if (active) setTierLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeTier, searchQuery, uploaderSelections.continent_id, uploaderSelections.country_id, dateParam]);

  // Select handlers
  const handleSelectInternational = (opt: FederationTierOption | null) => {
    const cleared = opt ? uploaderSelections.cleared.filter((c) => c !== 'international_id') : [...uploaderSelections.cleared, 'international_id'];
    setSelectedInternational(opt);
    onChange({
      ...uploaderSelections,
      international_id: opt?.id || null,
      custom_international_name: null,
      cleared
    });
    setActiveTier(null);
    setSearchQuery('');
  };

  const handleCustomInternational = (customName: string) => {
    const customOpt: FederationTierOption = {
      id: `custom:${customName}`,
      canonical_name: customName,
      short_code: null,
      country_code: null,
      level: 'international',
      parent_federation_id: null,
      is_verified: false,
      known_aliases: [],
      display_names: []
    };
    setSelectedInternational(customOpt);
    setActiveTier(null);
    setSearchQuery('');
    const cleared = uploaderSelections.cleared.filter((c) => c !== 'international_id');
    onChange({
      ...uploaderSelections,
      international_id: customOpt.id,
      custom_international_name: customName,
      cleared
    });
  };

  const handleSelectContinent = (opt: FederationTierOption | null) => {
    const cleared = opt ? uploaderSelections.cleared.filter((c) => c !== 'continent_id') : [...uploaderSelections.cleared, 'continent_id'];
    setSelectedContinent(opt);
    onChange({
      ...uploaderSelections,
      continent_id: opt?.id || null,
      cleared
    });
    setActiveTier(null);
    setSearchQuery('');
  };

  const handleSelectRegional = (opt: FederationTierOption | null) => {
    const cleared = opt ? uploaderSelections.cleared.filter((c) => c !== 'regional_id') : [...uploaderSelections.cleared, 'regional_id'];
    setSelectedRegional(opt);
    onChange({
      ...uploaderSelections,
      regional_id: opt?.id || null,
      custom_regional_name: null,
      cleared
    });
    setActiveTier(null);
    setSearchQuery('');
  };

  const handleCustomRegional = (customName: string) => {
    const customOpt: FederationTierOption = {
      id: `custom:${customName}`,
      canonical_name: customName,
      short_code: null,
      country_code: null,
      level: 'regional',
      parent_federation_id: null,
      is_verified: false,
      known_aliases: [],
      display_names: []
    };
    setSelectedRegional(customOpt);
    setActiveTier(null);
    setSearchQuery('');
    const cleared = uploaderSelections.cleared.filter((c) => c !== 'regional_id');
    onChange({
      ...uploaderSelections,
      regional_id: customOpt.id,
      custom_regional_name: customName,
      cleared
    });
  };

  const handleSelectCountry = (opt: FederationTierOption | null) => {
    const cleared = opt ? uploaderSelections.cleared.filter((c) => c !== 'country_id') : [...uploaderSelections.cleared, 'country_id'];
    setSelectedCountry(opt);
    onChange({
      ...uploaderSelections,
      country_id: opt?.id || null,
      host_country_code: opt?.country_code || uploaderSelections.host_country_code,
      cleared
    });
    setActiveTier(null);
    setSearchQuery('');
  };

  const handleSelectOrganizer = (opt: FederationTierOption | null) => {
    const cleared = opt ? uploaderSelections.cleared.filter((c) => c !== 'organizer_id') : [...uploaderSelections.cleared, 'organizer_id'];
    setSelectedOrganizer(opt);
    onChange({
      ...uploaderSelections,
      organizer_id: opt?.id || null,
      custom_organizer_name: null,
      cleared
    });
    setActiveTier(null);
    setSearchQuery('');
  };

  const handleCustomCountry = (customName: string) => {
    const customOpt: FederationTierOption = {
      id: `custom:${customName}`,
      canonical_name: customName,
      short_code: null,
      country_code: null,
      level: 'national',
      parent_federation_id: null,
      is_verified: false,
      known_aliases: [],
      display_names: []
    };
    setSelectedCountry(customOpt);
    setActiveTier(null);
    setSearchQuery('');
    const cleared = uploaderSelections.cleared.filter((c) => c !== 'country_id');
    onChange({
      ...uploaderSelections,
      country_id: customOpt.id,
      custom_country_name: customName,
      cleared
    });
  };

  const handleCustomOrganizer = (customName: string) => {
    const customOpt: FederationTierOption = {
      id: `custom:${customName}`,
      canonical_name: customName,
      short_code: null,
      country_code: selectedCountry?.country_code || null,
      level: 'regional_state_wso',
      parent_federation_id: null,
      is_verified: false,
      known_aliases: [],
      display_names: []
    };
    setSelectedOrganizer(customOpt);
    setActiveTier(null);
    setSearchQuery('');
    const cleared = uploaderSelections.cleared.filter((c) => c !== 'organizer_id');
    onChange({
      ...uploaderSelections,
      organizer_id: customOpt.id,
      custom_organizer_name: customName,
      cleared
    });
  };

  const handleSelectHostCountry = (opt: HostCountryOption | null) => {
    const code = opt?.code || null;
    const cleared = code 
      ? uploaderSelections.cleared.filter((c) => c !== 'host_country_code') 
      : [...uploaderSelections.cleared, 'host_country_code'];
    onChange({
      ...uploaderSelections,
      host_country_code: code,
      custom_host_country_name: null,
      cleared
    });
    setActiveTier(null);
    setSearchQuery('');
  };

  const handleCustomHostCountry = (customName: string) => {
    const cleared = uploaderSelections.cleared.filter((c) => c !== 'host_country_code');
    onChange({
      ...uploaderSelections,
      host_country_code: customName.slice(0, 3).toUpperCase(),
      custom_host_country_name: customName,
      cleared
    });
    setActiveTier(null);
    setSearchQuery('');
  };

  const handleSelectScope = (scope: CompetitionScope) => {
    const cleared = uploaderSelections.cleared.filter((c) => c !== 'competition_scope');
    const isMultiNation = scope === 'continental' || scope === 'international' || scope === 'regional';
    const isNational = scope === 'national';

    let nextIntlId = uploaderSelections.international_id;
    let nextContId = uploaderSelections.continent_id;
    let nextRegId = uploaderSelections.regional_id;
    let nextCountryId = uploaderSelections.country_id;
    let nextOrgId = uploaderSelections.organizer_id;

    if (scope === 'international') {
      if (!nextIntlId && geographyInference?.inferred_international_federation) {
        nextIntlId = geographyInference.inferred_international_federation.id;
      }
      nextContId = null;
      nextRegId = null;
    } else if (scope === 'continental') {
      if (!nextContId && geographyInference?.inferred_continental_federation) {
        nextContId = geographyInference.inferred_continental_federation.id;
      }
      nextRegId = null;
    } else if (scope === 'regional') {
      if (!nextRegId && geographyInference?.inferred_regional_federation && (geographyInference.inferred_regional_federation.level === 'regional' || geographyInference.inferred_regional_federation.level === 'intercontinental_regional')) {
        nextRegId = geographyInference.inferred_regional_federation.id;
      }
    } else if (scope === 'national') {
      if (!nextCountryId && geographyInference?.host_country?.match?.level === 'national' && !geographyInference.host_country.match.id.startsWith('country:')) {
        nextCountryId = geographyInference.host_country.match.id;
      }
    }

    if (isMultiNation) {
      setSelectedCountry(null);
      setSelectedOrganizer(null);
      nextCountryId = null;
      nextOrgId = null;
    } else if (isNational) {
      setSelectedOrganizer(null);
      nextOrgId = null;
    }

    onChange({
      ...uploaderSelections,
      competition_scope: scope,
      international_id: nextIntlId,
      continent_id: nextContId,
      regional_id: nextRegId,
      country_id: nextCountryId,
      organizer_id: nextOrgId,
      custom_regional_name: (scope === 'international' || scope === 'continental') ? null : uploaderSelections.custom_regional_name,
      custom_country_name: isMultiNation ? null : uploaderSelections.custom_country_name,
      custom_organizer_name: (isMultiNation || isNational) ? null : uploaderSelections.custom_organizer_name,
      cleared
    });
  };

  const handleClearTier = (tierKey: 'international_id' | 'continent_id' | 'regional_id' | 'country_id' | 'organizer_id' | 'host_country_code') => {
    if (tierKey === 'international_id') setSelectedInternational(null);
    if (tierKey === 'continent_id') setSelectedContinent(null);
    if (tierKey === 'regional_id') setSelectedRegional(null);
    if (tierKey === 'country_id') setSelectedCountry(null);
    if (tierKey === 'organizer_id') setSelectedOrganizer(null);

    const nextSelections = { ...uploaderSelections, [tierKey]: null };
    if (tierKey === 'international_id') nextSelections.custom_international_name = null;
    if (tierKey === 'regional_id') nextSelections.custom_regional_name = null;
    if (tierKey === 'country_id') nextSelections.custom_country_name = null;
    if (tierKey === 'organizer_id') nextSelections.custom_organizer_name = null;
    if (tierKey === 'host_country_code') nextSelections.custom_host_country_name = null;

    onChange({
      ...nextSelections,
      cleared: Array.from(new Set([...uploaderSelections.cleared, tierKey]))
    });
  };

  // Re-apply initial machine suggestions
  const handleReapplySuggestion = () => {
    if (!geographyInference) return;
    const fedMatch = geographyInference.federation?.match;
    const orgMatch = geographyInference.organizer?.match;
    const suggestedScope = geographyInference.suggested_scope || 'unknown';
    const isMultiNationScope = suggestedScope === 'continental' || suggestedScope === 'international' || suggestedScope === 'regional';
    const isNationalScope = suggestedScope === 'national';
    const isStateProvincialScope = suggestedScope === 'state_provincial';

    let internationalId: string | null = null;
    let continentId: string | null = null;
    let regionalId: string | null = null;
    let countryId: string | null = null;
    let organizerId: string | null = null;

    if (fedMatch?.level === 'international' || fedMatch?.level === 'global_international') {
      internationalId = fedMatch.id;
    } else if (fedMatch?.level === 'continental') {
      continentId = fedMatch.id;
    } else if (fedMatch?.level === 'intercontinental_regional' || fedMatch?.level === 'regional') {
      regionalId = fedMatch.id;
    } else if (fedMatch?.level === 'national' && !isMultiNationScope) {
      countryId = fedMatch.id;
    } else if ((fedMatch?.level === 'regional_state_wso' || fedMatch?.level === 'club') && !isMultiNationScope && !isNationalScope) {
      organizerId = fedMatch.id;
    }

    if (suggestedScope === 'international' && !internationalId && geographyInference.inferred_international_federation) {
      internationalId = geographyInference.inferred_international_federation.id;
    }

    if (suggestedScope === 'continental' && !continentId && geographyInference.inferred_continental_federation) {
      continentId = geographyInference.inferred_continental_federation.id;
    }

    if (orgMatch && !isMultiNationScope) {
      if ((orgMatch.level === 'international' || orgMatch.level === 'global_international') && !internationalId) {
        internationalId = orgMatch.id;
      } else if ((orgMatch.level === 'intercontinental_regional' || orgMatch.level === 'regional') && !regionalId) {
        regionalId = orgMatch.id;
      } else if (orgMatch.level === 'national' && !countryId && !isStateProvincialScope) {
        countryId = orgMatch.id;
      } else if ((orgMatch.level === 'regional_state_wso' || orgMatch.level === 'club') && !isNationalScope) {
        organizerId = orgMatch.id;
      }
    }

    if (!countryId && (suggestedScope === 'national' || suggestedScope === 'state_provincial') && geographyInference.host_country?.match?.level === 'national' && !geographyInference.host_country.match.id.startsWith('country:')) {
      countryId = geographyInference.host_country.match.id;
    }

    if (suggestedScope === 'regional' && !regionalId && geographyInference.inferred_regional_federation && (geographyInference.inferred_regional_federation.level === 'regional' || geographyInference.inferred_regional_federation.level === 'intercontinental_regional')) {
      regionalId = geographyInference.inferred_regional_federation.id;
    }

    if ((suggestedScope === 'state_provincial' || suggestedScope === 'local' || suggestedScope === 'unknown') && !organizerId && geographyInference.inferred_regional_federation && geographyInference.inferred_regional_federation.level === 'regional_state_wso') {
      organizerId = geographyInference.inferred_regional_federation.id;
    }

    let customInternationalName: string | null = null;
    if (suggestedScope === 'international' && geographyInference.inferred_international_name) {
      customInternationalName = geographyInference.inferred_international_name;
    }

    if (isMultiNationScope) {
      countryId = null;
      organizerId = null;
    } else if (isNationalScope) {
      organizerId = null;
    }

    const hostCode =
      geographyInference.host_country?.match?.country_code ||
      geographyInference.host_country?.match?.short_code ||
      fedMatch?.country_code ||
      orgMatch?.country_code ||
      null;

    onChange({
      international_id: internationalId,
      continent_id: continentId,
      regional_id: regionalId,
      country_id: countryId,
      organizer_id: organizerId,
      custom_international_name: customInternationalName,
      custom_regional_name: null,
      host_country_code: hostCode,
      competition_scope: suggestedScope,
      cleared: []
    });
  };

  // Inference Provenance Details
  // Only cite source fields if they were ACTUALLY matched to an entity that is currently applied
  const fedApplied = Boolean(
    geographyInference?.federation?.match &&
    (uploaderSelections.international_id === geographyInference.federation.match.id ||
     uploaderSelections.continent_id === geographyInference.federation.match.id ||
     uploaderSelections.country_id === geographyInference.federation.match.id ||
     uploaderSelections.organizer_id === geographyInference.federation.match.id)
  );

  const orgApplied = Boolean(
    geographyInference?.organizer?.match &&
    (uploaderSelections.international_id === geographyInference.organizer.match.id ||
     uploaderSelections.continent_id === geographyInference.organizer.match.id ||
     uploaderSelections.country_id === geographyInference.organizer.match.id ||
     uploaderSelections.organizer_id === geographyInference.organizer.match.id)
  );

  const appliedInference = fedApplied 
    ? geographyInference?.federation 
    : (orgApplied ? geographyInference?.organizer : null);

  const sourceField = fedApplied
    ? (geographyInference?.federation?.raw_input ? 'competition.federation' : null)
    : (orgApplied && geographyInference?.organizer?.raw_input ? 'competition.competitionOrganizer' : null);

  const sourceValue = appliedInference?.raw_input || null;

  const suggestedScope = geographyInference?.suggested_scope;
  const isScopeInferred = Boolean(
    suggestedScope &&
    suggestedScope !== 'unknown' &&
    uploaderSelections.competition_scope === suggestedScope &&
    !uploaderSelections.cleared.includes('competition_scope')
  );

  const isHostCountryInferred = Boolean(
    uploaderSelections.host_country_code &&
    geographyInference?.host_country?.match &&
    !uploaderSelections.cleared.includes('host_country_code')
  );

  const isMultiNationScope = 
    uploaderSelections.competition_scope === 'continental' || 
    uploaderSelections.competition_scope === 'international' ||
    uploaderSelections.competition_scope === 'regional';

  const suggestedCountryId = (isMultiNationScope && !geographyInference?.inferred_national_federation)
    ? null
    : (geographyInference?.inferred_national_federation?.id ||
       (geographyInference?.federation?.match?.level === 'national' 
         ? geographyInference.federation.match.id 
         : (geographyInference?.organizer?.match?.level === 'national' 
             ? geographyInference.organizer.match.id 
             : ((uploaderSelections.competition_scope === 'national' || uploaderSelections.competition_scope === 'state_provincial') && 
                geographyInference?.host_country?.match?.level === 'national' && 
                !geographyInference.host_country.match.id.startsWith('country:')
                 ? geographyInference.host_country.match.id
                 : null))));

  const suggestedOrganizerId = (isMultiNationScope || uploaderSelections.competition_scope === 'national')
    ? null
    : (geographyInference?.inferred_regional_federation?.level === 'regional_state_wso'
        ? geographyInference.inferred_regional_federation.id
        : ((geographyInference?.organizer?.match?.level === 'regional_state_wso' || geographyInference?.organizer?.match?.level === 'club')
            ? geographyInference.organizer.match.id
            : ((geographyInference?.federation?.match?.level === 'regional_state_wso' || geographyInference?.federation?.match?.level === 'club')
                ? geographyInference.federation.match.id
                : null)));

  const suggestedScopeVal = geographyInference?.suggested_scope || 'unknown';
  const suggestedCustomInternationalName = geographyInference?.inferred_international_name || null;

  // Polyglot & Translation Resolution Metadata
  const inferenceMatch = appliedInference?.match || null;
  const matchedName = inferenceMatch?.matched_name;
  const canonicalName = inferenceMatch?.canonical_name;
  const matchedLanguage = inferenceMatch?.matched_language;
  const matchedNameType = inferenceMatch?.matched_name_type;
  const matchedAcronym = inferenceMatch?.matched_acronym;
  const canonicalShortCode = inferenceMatch?.short_code;

  const isTranslation = Boolean(
    matchedName && 
    canonicalName && 
    matchedName.toLowerCase().trim() !== canonicalName.toLowerCase().trim()
  );

  const LANGUAGE_NAMES: Record<string, string> = {
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ru: 'Russian',
    pt: 'Portuguese',
    it: 'Italian',
    zh: 'Chinese',
    ja: 'Japanese',
    ar: 'Arabic',
    en: 'English'
  };
  const languageLabel = matchedLanguage ? (LANGUAGE_NAMES[matchedLanguage] || matchedLanguage) : null;
  const nameTypeLabel = matchedNameType === 'official_translation'
    ? 'official translation'
    : matchedNameType === 'historical'
    ? 'historical name'
    : matchedNameType === 'common_alias'
    ? 'common alias'
    : 'alternate name';

  const hasChangesFromSuggestion = Boolean(
    (suggestedCustomInternationalName && uploaderSelections.custom_international_name !== suggestedCustomInternationalName) ||
    (suggestedCountryId && uploaderSelections.country_id !== suggestedCountryId) ||
    (suggestedOrganizerId && uploaderSelections.organizer_id !== suggestedOrganizerId) ||
    (suggestedScopeVal && uploaderSelections.competition_scope !== suggestedScopeVal) ||
    uploaderSelections.cleared.length > 0
  );

  const isCountryRequired = uploaderSelections.competition_scope === 'national';
  const isInternationalInferred = Boolean(
    uploaderSelections.international_id &&
    (uploaderSelections.international_id === geographyInference?.inferred_international_federation?.id ||
     ((geographyInference?.federation?.match?.level === 'international' || geographyInference?.federation?.match?.level === 'global_international') &&
      uploaderSelections.international_id === geographyInference.federation.match.id) ||
     (geographyInference?.inferred_international_name &&
      uploaderSelections.custom_international_name === geographyInference.inferred_international_name)) &&
    !uploaderSelections.cleared.includes('international_id')
  );

  const isContinentInferred = Boolean(
    uploaderSelections.continent_id &&
    (uploaderSelections.continent_id === geographyInference?.inferred_continental_federation?.id ||
     (geographyInference?.federation?.match?.level === 'continental' &&
      uploaderSelections.continent_id === geographyInference.federation.match.id)) &&
    !uploaderSelections.cleared.includes('continent_id')
  );

  const isRegionalInferred = Boolean(
    (geographyInference?.federation?.match?.level === 'regional' ||
     geographyInference?.federation?.match?.level === 'intercontinental_regional' ||
     geographyInference?.organizer?.match?.level === 'regional' ||
     geographyInference?.organizer?.match?.level === 'intercontinental_regional') &&
    (uploaderSelections.regional_id === geographyInference?.federation?.match?.id ||
     uploaderSelections.regional_id === geographyInference?.organizer?.match?.id) &&
    !uploaderSelections.cleared.includes('regional_id')
  );

  const isCountryInferred = Boolean(
    suggestedCountryId &&
    uploaderSelections.country_id === suggestedCountryId &&
    !uploaderSelections.cleared.includes('country_id')
  );

  const isOrganizerInferred = Boolean(
    suggestedOrganizerId &&
    uploaderSelections.organizer_id === suggestedOrganizerId &&
    !uploaderSelections.cleared.includes('organizer_id')
  );

  const visibleInternationalOptions = internationalOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = foldAccents(searchQuery);
    return foldAccents(opt.canonical_name).includes(q) || foldAccents(opt.short_code || '').includes(q);
  });

  const visibleContinentOptions = continentOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = foldAccents(searchQuery);
    return foldAccents(opt.canonical_name).includes(q) || foldAccents(opt.short_code || '').includes(q);
  });

  const visibleRegionalOptions = regionalOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = foldAccents(searchQuery);
    return (
      foldAccents(opt.canonical_name).includes(q) ||
      foldAccents(opt.short_code || '').includes(q) ||
      (opt.known_aliases || []).some((a) => foldAccents(a).includes(q))
    );
  });

  const visibleCountryOptions = countryOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = foldAccents(searchQuery);
    return (
      foldAccents(opt.canonical_name).includes(q) ||
      foldAccents(opt.short_code || '').includes(q) ||
      foldAccents(opt.country_code || '').includes(q) ||
      (opt.known_aliases || []).some((a) => foldAccents(a).includes(q))
    );
  });

  const visibleOrganizerOptions = organizerOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = foldAccents(searchQuery);
    return (
      foldAccents(opt.canonical_name).includes(q) ||
      foldAccents(opt.short_code || '').includes(q) ||
      (opt.known_aliases || []).some((a) => foldAccents(a).includes(q))
    );
  });

  const visibleHostCountryOptions = ALL_HOST_COUNTRIES.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = foldAccents(searchQuery);
    return foldAccents(opt.name).includes(q) || foldAccents(opt.code).includes(q);
  });

  // Calculate exactly 1 itemized line per active inferred pill
  const inferredPillItems: { field: string; explanation: string }[] = [];

  if (isScopeInferred) {
    if (geographyInference?.has_derived_scope) {
      const scopeExplanation = geographyInference?.scope_inference_source
        ? `(${geographyInference.scope_inference_source})`
        : `(derived from ${canonicalName || 'governing body'} level)`;
      const scopeLabel = SCOPE_OPTIONS.find(s => s.value === uploaderSelections.competition_scope)?.label || 
        (uploaderSelections.competition_scope ? `${uploaderSelections.competition_scope.charAt(0).toUpperCase()}${uploaderSelections.competition_scope.slice(1)}` : 'Unknown');
      inferredPillItems.push({
        field: 'Competition Scope',
        explanation: `Inferred as ${scopeLabel} ${scopeExplanation}`
      });
    } else if (uploaderSelections.competition_scope === 'local') {
      inferredPillItems.push({
        field: 'Competition Scope',
        explanation: 'Defaulted to Local (no higher-level governing body found within meet file)'
      });
    }
  }

  if (isHostCountryInferred && uploaderSelections.host_country_code) {
    const hostDisplay = formatHostCountryDisplay(uploaderSelections.host_country_code, uploaderSelections.custom_host_country_name);
    const locationClue = geographyInference?.host_country?.raw_input
      ? `resolved from ${geographyInference.host_country.raw_input}`
      : 'resolved from meet venue/location';
    inferredPillItems.push({
      field: 'Host Country',
      explanation: `Inferred as ${hostDisplay} (${locationClue})`
    });
  }

  if (isInternationalInferred && (selectedInternational || uploaderSelections.custom_international_name)) {
    const intlName = selectedInternational 
      ? formatDefinedFederation(selectedInternational.canonical_name, selectedInternational.short_code)
      : (uploaderSelections.custom_international_name || 'International Federation');
    inferredPillItems.push({
      field: 'International Federation',
      explanation: `Inferred as ${intlName} (matched from international federation in competitionName)`
    });
  }

  if (isContinentInferred && selectedContinent) {
    const isMatchedByInference = geographyInference?.inferred_continental_federation?.id === selectedContinent.id;
    let contCitation = '';
    if (isMatchedByInference) {
      const delegationCount = geographyInference?.teams_analysis?.delegation_count || 0;
      const sampleTeams = geographyInference?.teams_analysis?.unambiguous_country_codes?.slice(0, 5).join(', ') || '';
      const contName = formatDefinedFederation(selectedContinent.canonical_name, selectedContinent.short_code);
      const hostCode = uploaderSelections.host_country_code;
      const hostName = hostCode ? CANONICAL_COUNTRY_NAMES[hostCode] : null;
      const hostDisplay = hostCode ? (hostName ? `${hostName} (${hostCode})` : hostCode) : null;
      const hostClause = hostDisplay ? `; host country is ${hostDisplay}` : '';
      contCitation = delegationCount >= 2
        ? ` (matched continental championship title in meet name; corroborated by ${delegationCount} participating delegations [${sampleTeams}] belonging to the ${contName}${hostClause})`
        : ` (matched continental championship in meet name${hostClause})`;
    } else if (sourceValue) {
      contCitation = ` (matched from "${sourceValue}")`;
    }
    inferredPillItems.push({
      field: 'Continental Federation',
      explanation: `Inferred as ${formatDefinedFederation(selectedContinent.canonical_name, selectedContinent.short_code)}${contCitation}`
    });
  }

  if (isRegionalInferred && (selectedRegional || uploaderSelections.custom_regional_name)) {
    const regName = selectedRegional 
      ? formatDefinedFederation(selectedRegional.canonical_name, selectedRegional.short_code)
      : (uploaderSelections.custom_regional_name || 'Regional Federation');
    inferredPillItems.push({
      field: 'Regional Federation',
      explanation: `Inferred as ${regName}${sourceValue ? ` (matched from "${sourceValue}")` : ''}`
    });
  }

  if (suggestedCountryId && uploaderSelections.country_id === suggestedCountryId && selectedCountry) {
    const isCoSanctionedIntl = uploaderSelections.competition_scope === 'international' && geographyInference?.inferred_national_federation?.id === selectedCountry.id;
    const countrySource = isCoSanctionedIntl
      ? ` (co-sanctioned host national federation matched from meet name)`
      : (geographyInference?.federation?.match?.level === 'national' && geographyInference.federation.raw_input)
      ? ` (matched from "${geographyInference.federation.raw_input}")`
      : (geographyInference?.organizer?.match?.level === 'national' && geographyInference.organizer.raw_input)
      ? ` (matched from "${geographyInference.organizer.raw_input}")`
      : (selectedOrganizer ? ` (parent governing body of ${selectedOrganizer.canonical_name})` : (uploaderSelections.competition_scope === 'national' ? ` (national governing body for national championship)` : ` (national governing body for host country)`));
    inferredPillItems.push({
      field: 'National Federation',
      explanation: `Inferred as ${formatDefinedFederation(selectedCountry.canonical_name, selectedCountry.short_code)}${countrySource}`
    });
  }

  if (suggestedOrganizerId && uploaderSelections.organizer_id === suggestedOrganizerId && selectedOrganizer) {
    const isDirectRegionalInfer = geographyInference?.inferred_regional_federation?.id === selectedOrganizer.id;
    let orgNote = '';
    if (geographyInference?.inferred_regional_federation_source) {
      orgNote = ` (${geographyInference.inferred_regional_federation_source})`;
    } else if (isDirectRegionalInfer) {
      orgNote = ` (matched regional/state jurisdiction for host location)`;
    } else {
      const orgRaw = geographyInference?.organizer?.match?.id === selectedOrganizer.id
        ? geographyInference.organizer.raw_input
        : (geographyInference?.federation?.match?.id === selectedOrganizer.id ? geographyInference.federation.raw_input : null);
      if (orgRaw) {
        orgNote = ` (matched from "${orgRaw}")`;
      }
    }
    inferredPillItems.push({
      field: 'State / Provincial Federation',
      explanation: `Inferred as ${formatDefinedFederation(selectedOrganizer.canonical_name, selectedOrganizer.short_code)}${orgNote}`
    });
  }

  const appliedInferenceCount = inferredPillItems.length;

  const organizerPlaceholder = selectedCountry
    ? `Select state/provincial body under ${selectedCountry.canonical_name}...`
    : 'Select State / Provincial Federation (e.g. Missouri Valley WSO (USAW), Fédération d\'haltérophilie du Québec (WCH))...';

  const intlRel = getTierRelevance('international', uploaderSelections.competition_scope);
  const contRel = getTierRelevance('continent', uploaderSelections.competition_scope);
  const regRel = getTierRelevance('regional', uploaderSelections.competition_scope);
  const countryRel = getTierRelevance('country', uploaderSelections.competition_scope);
  const orgRel = getTierRelevance('organizer', uploaderSelections.competition_scope);

  // Ambiguity Detection & Collision Handling (Rule 11)
  const ambiguousFederation = geographyInference?.federation?.status === 'ambiguous' ? geographyInference.federation : null;
  const ambiguousOrganizer = geographyInference?.organizer?.status === 'ambiguous' ? geographyInference.organizer : null;
  const activeAmbiguity = ambiguousFederation || ambiguousOrganizer;
  const isAmbiguityResolved = Boolean(
    !activeAmbiguity ||
    activeAmbiguity.candidates?.some((c) =>
      uploaderSelections.international_id === c.id ||
      uploaderSelections.continent_id === c.id ||
      uploaderSelections.regional_id === c.id ||
      uploaderSelections.country_id === c.id ||
      uploaderSelections.organizer_id === c.id
    )
  );

  const handleResolveAmbiguity = (candidate: FederationMatch) => {
    let scope = uploaderSelections.competition_scope;
    let nextInternationalId = uploaderSelections.international_id;
    let nextContinentId = uploaderSelections.continent_id;
    let nextRegionalId = uploaderSelections.regional_id;
    let nextCountryId = uploaderSelections.country_id;
    let nextOrganizerId = uploaderSelections.organizer_id;

    if (candidate.level === 'global_international' || candidate.level === 'international') {
      nextInternationalId = candidate.id;
      scope = 'international';
      nextContinentId = null;
      nextRegionalId = null;
      nextCountryId = null;
      nextOrganizerId = null;
      setSelectedInternational({
        id: candidate.id,
        canonical_name: candidate.canonical_name,
        short_code: candidate.short_code,
        country_code: candidate.country_code,
        level: candidate.level,
        parent_federation_id: null,
        is_verified: candidate.is_verified,
        known_aliases: candidate.known_aliases || [],
        display_names: []
      });
    } else if (candidate.level === 'continental') {
      nextContinentId = candidate.id;
      scope = 'continental';
      nextRegionalId = null;
      nextCountryId = null;
      nextOrganizerId = null;
      setSelectedContinent({
        id: candidate.id,
        canonical_name: candidate.canonical_name,
        short_code: candidate.short_code,
        country_code: candidate.country_code,
        level: candidate.level,
        parent_federation_id: null,
        is_verified: candidate.is_verified,
        known_aliases: candidate.known_aliases || [],
        display_names: []
      });
    } else if (candidate.level === 'intercontinental_regional' || candidate.level === 'regional') {
      nextRegionalId = candidate.id;
      scope = 'regional';
      setSelectedRegional({
        id: candidate.id,
        canonical_name: candidate.canonical_name,
        short_code: candidate.short_code,
        country_code: candidate.country_code,
        level: candidate.level,
        parent_federation_id: null,
        is_verified: candidate.is_verified,
        known_aliases: candidate.known_aliases || [],
        display_names: []
      });
    } else if (candidate.level === 'national') {
      nextCountryId = candidate.id;
      if (scope !== 'regional') scope = 'national';
      nextOrganizerId = scope === 'national' ? null : nextOrganizerId;
      setSelectedCountry({
        id: candidate.id,
        canonical_name: candidate.canonical_name,
        short_code: candidate.short_code,
        country_code: candidate.country_code,
        level: candidate.level,
        parent_federation_id: null,
        is_verified: candidate.is_verified,
        known_aliases: candidate.known_aliases || [],
        display_names: []
      });
    } else if (candidate.level === 'regional_state_wso' || candidate.level === 'club') {
      nextOrganizerId = candidate.id;
      setSelectedOrganizer({
        id: candidate.id,
        canonical_name: candidate.canonical_name,
        short_code: candidate.short_code,
        country_code: candidate.country_code,
        level: candidate.level,
        parent_federation_id: null,
        is_verified: candidate.is_verified,
        known_aliases: candidate.known_aliases || [],
        display_names: []
      });
    }

    onChange({
      ...uploaderSelections,
      competition_scope: scope,
      international_id: nextInternationalId,
      continent_id: nextContinentId,
      regional_id: nextRegionalId,
      country_id: nextCountryId,
      organizer_id: nextOrganizerId
    });
  };

  return (
    <div className="w-full relative" ref={triggerRef}>
      <div className="flex items-center justify-between mb-1 text-[11px] font-medium text-slate-400">
        <span className="text-slate-300 font-semibold">
          Editable Meet Details
        </span>
      </div>

      {/* Main Cascade Card — Direct & Open Form */}
      <div 
        className={`w-full rounded-xl bg-slate-900 border transition p-3 space-y-3 ${
          hasError
            ? 'border-rose-500 ring-1 ring-rose-500/30'
            : 'border-slate-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {/* Disambiguation Prompt when meet file has genuine acronym collisions */}
        {activeAmbiguity && !isAmbiguityResolved && activeAmbiguity.candidates && activeAmbiguity.candidates.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs space-y-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-amber-200">
                    Ambiguous Federation Collision Detected:
                  </span>
                  <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px] border border-amber-500/30">
                    &quot;{activeAmbiguity.raw_input}&quot;
                  </code>
                </div>
                <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">
                  Per authentic primary-source governance records, multiple organizations legitimately share this acronym. Please select the intended governing body:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {activeAmbiguity.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => handleResolveAmbiguity(candidate)}
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/50 transition text-left flex flex-col justify-between gap-2 group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium">
                        {FEDERATION_LEVEL_LABELS[candidate.level] || candidate.level}
                      </span>
                      {candidate.country_code && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {candidate.country_code}
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-white text-xs mt-1.5 group-hover:text-amber-200 transition-colors">
                      {formatDefinedFederation(candidate.canonical_name, candidate.matched_acronym || candidate.short_code)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-amber-400 font-medium pt-1 border-t border-slate-800/80">
                    <span>Select this federation</span>
                    <Check className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Top Section: Competition Scope & Host Country Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-800/80">
          {/* Scope Selector */}
          <div className="space-y-1">
            <div className="h-5 flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1.5">
                <span>Competition Scope</span> <span className="text-rose-400 font-bold">*</span>
                <span className="relative group/scopeHelp inline-flex items-center">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-sky-300 cursor-help transition-colors" />
                  <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/scopeHelp:block z-50 w-72 sm:w-80 p-2.5 rounded-xl bg-slate-900/98 backdrop-blur border border-slate-700 shadow-2xl text-left pointer-events-none">
                    <div className="text-[11px] font-semibold text-white mb-1.5 pb-1 border-b border-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      <span>Competition Scope</span>
                    </div>
                    <p className="text-slate-300 text-[10.5px] leading-relaxed">
                      Defines the jurisdictional boundary of the competition (International, Continental, Regional, National, State / Provincial, or Local), governing which federation tiers are applicable and enforcing cross-border multi-nation isolation.
                    </p>
                  </div>
                </span>
              </span>
              {isScopeInferred && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  Inferred
                </span>
              )}
            </div>
            <div className="relative" ref={scopeTriggerRef}>
              <div
                onClick={() => openDropdown('scope', scopeTriggerRef)}
                className="w-full h-9 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-left text-slate-200 flex items-center justify-between hover:border-slate-600 transition cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-white">
                    {SCOPE_OPTIONS.find((s) => s.value === (uploaderSelections.competition_scope || 'unknown'))?.label || 'Select Scope...'}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1.5 transition-transform ${activeTier === 'scope' ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {(() => {
              const currentScopeConfig = SCOPE_OPTIONS.find((s) => s.value === (uploaderSelections.competition_scope || 'unknown'));
              if (!currentScopeConfig) return null;
              return (
                <div className="mt-1 text-[11px] leading-snug text-slate-400 bg-slate-950/70 p-2 rounded-lg border border-slate-800 space-y-0.5 select-text cursor-text">
                  <div className="text-slate-300 font-medium">
                    {currentScopeConfig.description}
                  </div>
                  <div className="text-slate-500 text-[10px]">
                    <strong className="text-slate-400 font-semibold">Examples:</strong> {currentScopeConfig.examples}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Host Country Selector */}
          <div className="space-y-1">
            <div className="h-5 flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" />
                Host Country
              </span>
              <div className="flex items-center gap-1.5">
                {isHostCountryInferred && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Inferred
                  </span>
                )}
                {uploaderSelections.host_country_code && (
                  <button
                    type="button"
                    onClick={() => handleClearTier('host_country_code')}
                    className="text-slate-500 hover:text-rose-400 text-[10px] transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="relative" ref={hostCountryTriggerRef}>
              <div
                onClick={() => openDropdown('host_country', hostCountryTriggerRef)}
                className="w-full h-9 px-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-left text-slate-200 flex items-center justify-between hover:border-slate-600 transition cursor-pointer"
              >
                <span className="truncate select-text cursor-text font-medium text-white">
                  {formatHostCountryDisplay(uploaderSelections.host_country_code, uploaderSelections.custom_host_country_name)}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1.5 transition-transform ${activeTier === 'host_country' ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Hierarchical Tiers (Indented Tree) */}
        {uploaderSelections.competition_scope === 'local' && !isFederationsExpanded ? (
          <div 
            onClick={() => setIsFederationsExpanded(true)}
            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer text-xs"
          >
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Associated Federations</span>
              <span className="text-[10px] text-slate-500 font-normal">(Optional for Local meets)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-sky-400 font-medium">
              <span>Expand</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        ) : (
          <div className={`pt-1 ${
            uploaderSelections.competition_scope === 'local'
              ? 'rounded-lg bg-slate-950/40 border border-slate-800/80 p-2.5 space-y-3'
              : 'space-y-3'
          }`}>
            {uploaderSelections.competition_scope === 'local' && (
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60 text-[11px] font-medium text-slate-500">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  Associated Federations
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 italic">
                    (Optional for Local meets)
                  </span>
                  {allTiersNone && (
                    <button
                      type="button"
                      onClick={() => setIsFederationsExpanded(false)}
                      className="text-slate-400 hover:text-slate-300 flex items-center gap-0.5 text-[10px] transition cursor-pointer"
                    >
                      <span>Collapse</span>
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tier 1: International Federation */}
            <div className={`space-y-1 transition-opacity duration-200 ${intlRel.isDesaturated ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Globe2 className="w-3 h-3 text-amber-400" />
                  International Federation
                  <span className="relative group/intlHelp inline-flex items-center">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-amber-300 cursor-help transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/intlHelp:block z-50 w-72 sm:w-80 p-2.5 rounded-xl bg-slate-900/98 backdrop-blur border border-slate-700 shadow-2xl text-left pointer-events-none">
                      <div className="font-semibold text-amber-300 text-[11px] mb-1 flex items-center gap-1">
                        <Globe2 className="w-3 h-3" /> International Federation
                      </div>
                      <p className="text-slate-300 text-[10px] leading-snug">
                        Apex global governing bodies with worldwide jurisdiction.
                      </p>
                      <p className="text-slate-400 text-[9.5px] mt-1">
                        <strong className="text-slate-300">Examples:</strong> International Weightlifting Federation (IWF), United Masters Weightlifting Federation (UMWF), International Masters Weightlifting Association (IMWA)
                      </p>
                    </div>
                  </span>
                  {isInternationalInferred && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      Inferred
                    </span>
                  )}
                </span>
                {uploaderSelections.international_id && (
                  <button
                    type="button"
                    onClick={() => handleClearTier('international_id')}
                    className="text-slate-500 hover:text-rose-400 text-[10px] transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative" ref={intlTriggerRef}>
                <div
                  onClick={() => openDropdown('international', intlTriggerRef)}
                  className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border text-xs text-left text-slate-200 flex items-center justify-between hover:border-slate-600 transition cursor-pointer ${
                    intlRel.isPrimary ? 'border-amber-500/50 shadow-sm shadow-amber-950/20' : 'border-slate-700'
                  }`}
                >
                  <span className="truncate select-text cursor-text font-medium">
                    {selectedInternational 
                      ? formatDefinedFederation(selectedInternational.canonical_name, selectedInternational.short_code)
                      : uploaderSelections.custom_international_name
                      ? `${uploaderSelections.custom_international_name} (Unlisted)`
                      : 'None'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1.5 transition-transform ${activeTier === 'international' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {/* Tier 2: Continental Federation — Indented under International */}
            <div className={`ml-4 pl-3 border-l-2 border-slate-800 space-y-1 transition-opacity duration-200 ${contRel.isDesaturated ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Globe2 className="w-3 h-3 text-indigo-400" />
                  Continental Federation
                  <span className="relative group/contHelp inline-flex items-center">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-300 cursor-help transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/contHelp:block z-50 w-72 sm:w-80 p-2.5 rounded-xl bg-slate-900/98 backdrop-blur border border-slate-700 shadow-2xl text-left pointer-events-none">
                      <div className="font-semibold text-indigo-300 text-[11px] mb-1 flex items-center gap-1">
                        <Globe2 className="w-3 h-3" /> Continental Federation
                      </div>
                      <p className="text-slate-300 text-[10px] leading-snug">
                        Continental confederations governing championships spanning member national federations across a continent.
                      </p>
                      <p className="text-slate-400 text-[9.5px] mt-1">
                        <strong className="text-slate-300">Examples:</strong> Pan American Weightlifting Federation (PAWF), European Weightlifting Federation (EWF), Asian Weightlifting Federation (AWF), Weightlifting Federation of Africa (WFA), Oceania Weightlifting Federation (OWF)
                      </p>
                    </div>
                  </span>
                  {isContinentInferred && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      Inferred
                    </span>
                  )}
                </span>
                {uploaderSelections.continent_id && (
                  <button
                    type="button"
                    onClick={() => handleClearTier('continent_id')}
                    className="text-slate-500 hover:text-rose-400 text-[10px] transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative" ref={contTriggerRef}>
                <div
                  onClick={() => openDropdown('continent', contTriggerRef)}
                  className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border text-xs text-left text-slate-200 flex items-center justify-between hover:border-slate-600 transition cursor-pointer ${
                    contRel.isPrimary ? 'border-indigo-500/50 shadow-sm shadow-indigo-950/20' : 'border-slate-700'
                  }`}
                >
                  <span className="truncate select-text cursor-text font-medium">
                    {selectedContinent 
                      ? formatDefinedFederation(selectedContinent.canonical_name, selectedContinent.short_code)
                      : 'None'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1.5 transition-transform ${activeTier === 'continent' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {/* Tier 3: Regional Federation — Indented under Continental */}
            <div className={`ml-8 pl-3 border-l-2 border-slate-800 space-y-1 transition-opacity duration-200 ${regRel.isDesaturated ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Globe2 className="w-3 h-3 text-cyan-400" />
                  Regional Federation
                  <span className="relative group/regHelp inline-flex items-center">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-cyan-300 cursor-help transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/regHelp:block z-50 w-72 sm:w-80 p-2.5 rounded-xl bg-slate-900/98 backdrop-blur border border-slate-700 shadow-2xl text-left pointer-events-none">
                      <div className="font-semibold text-cyan-300 text-[11px] mb-1 flex items-center gap-1">
                        <Globe2 className="w-3 h-3" /> Regional Federation
                      </div>
                      <p className="text-slate-300 text-[10px] leading-snug">
                        Multi-nation regional or intercontinental weightlifting federations established by charter or treaty.
                      </p>
                      <p className="text-slate-400 text-[9.5px] mt-1">
                        <strong className="text-slate-300">Examples:</strong> South American Weightlifting Confederation (CSLP), Commonwealth Weightlifting Federation (CWF), Nordic Weightlifting Federation (NWF), Mediterranean Weightlifting Federation (MWF)
                      </p>
                    </div>
                  </span>
                  {isRegionalInferred && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      Inferred
                    </span>
                  )}
                </span>
                {uploaderSelections.regional_id && (
                  <button
                    type="button"
                    onClick={() => handleClearTier('regional_id')}
                    className="text-slate-500 hover:text-rose-400 text-[10px] transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative" ref={regTriggerRef}>
                <div
                  onClick={() => openDropdown('regional', regTriggerRef)}
                  className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border text-xs text-left text-slate-200 flex items-center justify-between hover:border-slate-600 transition cursor-pointer ${
                    regRel.isPrimary ? 'border-cyan-500/50 shadow-sm shadow-cyan-950/20' : 'border-slate-700'
                  }`}
                >
                  <span className="truncate select-text cursor-text font-medium">
                    {selectedRegional 
                      ? formatDefinedFederation(selectedRegional.canonical_name, selectedRegional.short_code)
                      : uploaderSelections.custom_regional_name
                      ? `${uploaderSelections.custom_regional_name} (Unlisted)`
                      : (uploaderSelections.competition_scope === 'international')
                      ? 'None / Not Applicable (International Event)'
                      : (uploaderSelections.competition_scope === 'continental')
                      ? 'None / Not Applicable (Continental Event)'
                      : (uploaderSelections.competition_scope === 'national')
                      ? 'None / Not Applicable (National Event)'
                      : 'None'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1.5 transition-transform ${activeTier === 'regional' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {/* Tier 4: National Federation — Indented under Regional */}
            <div className={`ml-12 pl-3 border-l-2 border-slate-800 space-y-1 transition-opacity duration-200 ${countryRel.isDesaturated ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Flag className="w-3 h-3 text-sky-400" />
                  National Federation
                  <span className="relative group/natHelp inline-flex items-center">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-sky-300 cursor-help transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/natHelp:block z-50 w-72 sm:w-80 p-2.5 rounded-xl bg-slate-900/98 backdrop-blur border border-slate-700 shadow-2xl text-left pointer-events-none">
                      <div className="font-semibold text-sky-300 text-[11px] mb-1 flex items-center gap-1">
                        <Flag className="w-3 h-3" /> National Federation
                      </div>
                      <p className="text-slate-300 text-[10px] leading-snug">
                        Sovereign country-wide governing bodies recognized by international apex federations.
                      </p>
                      <p className="text-slate-400 text-[9.5px] mt-1">
                        <strong className="text-slate-300">Examples:</strong> USA Weightlifting (USAW), Weightlifting Canada Haltérophilie (WCH), Federación Panameña de Levantamiento de Pesas
                      </p>
                    </div>
                  </span>
                  {isCountryInferred && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      Inferred
                    </span>
                  )}
                  {isCountryRequired && (
                    <span className="text-rose-400 font-bold">*</span>
                  )}
                </span>
                {uploaderSelections.country_id && (
                  <button
                    type="button"
                    onClick={() => handleClearTier('country_id')}
                    className="text-slate-500 hover:text-rose-400 text-[10px] transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative" ref={countryTriggerRef}>
                <div
                  onClick={() => openDropdown('country', countryTriggerRef)}
                  className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border text-xs text-left text-slate-200 flex items-center justify-between hover:border-slate-600 transition cursor-pointer ${
                    countryRel.isPrimary ? 'border-sky-500/50 shadow-sm shadow-sky-950/20' : 'border-slate-700'
                  }`}
                >
                  <span className="truncate select-text cursor-text font-medium">
                    {selectedCountry 
                      ? formatDefinedFederation(selectedCountry.canonical_name, selectedCountry.short_code)
                      : (uploaderSelections.competition_scope === 'continental')
                      ? 'None / Not Applicable (Continental Event)'
                      : (uploaderSelections.competition_scope === 'international')
                      ? 'None / Not Applicable (International Event)'
                      : (uploaderSelections.competition_scope === 'regional')
                      ? 'None / Not Applicable (Regional Event)'
                      : 'None'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1.5 transition-transform ${activeTier === 'country' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {/* Tier 5: State / Provincial Federation — Indented under Country */}
            <div className={`ml-16 pl-3 border-l-2 border-slate-800 space-y-1 transition-opacity duration-200 ${orgRel.isDesaturated ? 'opacity-60 hover:opacity-100' : 'opacity-100'}`}>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 flex-wrap">
                  <Building2 className="w-3 h-3 text-emerald-400" />
                  State / Provincial Federation
                  <span className="relative group/orgHelp inline-flex items-center">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-300 cursor-help transition-colors" />
                    <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/orgHelp:block z-50 w-72 sm:w-80 p-2.5 rounded-xl bg-slate-900/98 backdrop-blur border border-slate-700 shadow-2xl text-left pointer-events-none">
                      <div className="font-semibold text-emerald-300 text-[11px] mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> State / Provincial Federation
                      </div>
                      <p className="text-slate-300 text-[10px] leading-snug">
                        Domestic regional, provincial, or state organizations subordinate to the parent national federation.
                      </p>
                      <p className="text-slate-400 text-[9.5px] mt-1">
                        <strong className="text-slate-300">Examples:</strong> Missouri Valley WSO (USAW), Florida WSO (USAW), Fédération d'haltérophilie du Québec (WCH), Ontario Weightlifting Association (WCH)
                      </p>
                    </div>
                  </span>
                  {isOrganizerInferred && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      Inferred
                    </span>
                  )}
                </span>
                {uploaderSelections.organizer_id && (
                  <button
                    type="button"
                    onClick={() => handleClearTier('organizer_id')}
                    className="text-slate-500 hover:text-rose-400 text-[10px] transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative" ref={organizerTriggerRef}>
                <div
                  onClick={() => openDropdown('organizer', organizerTriggerRef)}
                  className={`w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border text-xs text-left text-slate-200 flex items-center justify-between hover:border-slate-600 transition cursor-pointer ${
                    orgRel.isPrimary ? 'border-emerald-500/50 shadow-sm shadow-emerald-950/20' : 'border-slate-700'
                  }`}
                >
                  <span className="truncate select-text cursor-text font-medium">
                    {selectedOrganizer 
                      ? formatDefinedFederation(selectedOrganizer.canonical_name, selectedOrganizer.short_code)
                      : (uploaderSelections.competition_scope === 'national')
                      ? 'None / Not Applicable (National Event)'
                      : (uploaderSelections.competition_scope === 'continental')
                      ? 'None / Not Applicable (Continental Event)'
                      : (uploaderSelections.competition_scope === 'international')
                      ? 'None / Not Applicable (International Event)'
                      : (uploaderSelections.competition_scope === 'regional')
                      ? 'None / Not Applicable (Regional Event)'
                      : 'None'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1.5 transition-transform ${activeTier === 'organizer' ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion Provenance / Explanation Callout */}
      {appliedInferenceCount > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 rounded-lg bg-sky-950/40 border border-sky-500/30 text-[11px] select-text cursor-text"
        >
          <div className="flex items-start justify-between gap-2 p-2.5">
            <div className="flex items-start gap-1.5 flex-1 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 break-words whitespace-normal text-slate-300 leading-relaxed text-[11px]">
                <div className="text-[10px] text-sky-300 font-medium pb-1">
                  {appliedInferenceCount === 1
                    ? 'This inferred selection has been applied by default. You can adjust, change, or clear any tier above:'
                    : 'These inferred selections have been applied by default. You can adjust, change, or clear any tier above:'}
                </div>
                <div className="space-y-1">
                  {inferredPillItems.map((item) => (
                    <div key={item.field} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-sky-300 font-semibold flex-shrink-0">• {item.field}:</span>
                      <span className="text-slate-200">{item.explanation}</span>
                    </div>
                  ))}
                  {!isHostCountryInferred && !uploaderSelections.host_country_code && (
                    <div className="text-[10px] text-amber-300/90 italic pt-0.5">
                      (Host country could not be determined from the file—please select the Host Country above if known)
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
              {hasChangesFromSuggestion && (
                <button
                  type="button"
                  onClick={handleReapplySuggestion}
                  className="px-2 py-0.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-medium text-[11px] transition cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Re-apply
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowProvenance(!showProvenance)}
                className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5 transition px-1 py-0.5 cursor-pointer"
              >
                Details
                <ChevronDown className={`w-3 h-3 transition-transform ${showProvenance ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {showProvenance && (
            <div className="mx-2 mb-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
              <p className="font-semibold text-sky-300">
                Suggested Jurisdiction &amp; Scope Audit Details
              </p>
              <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                {sourceField && sourceValue && (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Source Field:</span>
                      <code className="text-sky-300 font-mono select-text cursor-text">{sourceField}</code>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Raw Value:</span>
                      <span className="text-white font-medium break-words select-text cursor-text">&quot;{sourceValue}&quot;</span>
                    </div>
                  </>
                )}

                {/* Scope Details */}
                <div className="flex items-baseline gap-2 pt-1 border-t border-slate-800/80">
                  <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Scope:</span>
                  <span className="text-slate-200">
                    <strong className="text-sky-300 capitalize">{uploaderSelections.competition_scope || 'local'}</strong>
                    {geographyInference?.has_derived_scope
                      ? (geographyInference.scope_inference_source ? ` — ${geographyInference.scope_inference_source}` : ` — derived from ${canonicalName || 'governing body'} level`)
                      : ' — defaulted to Local for club/open meets lacking higher governing bodies'}
                  </span>
                </div>

                {/* Host Country Details */}
                <div className="flex items-baseline gap-2">
                  <span className="w-24 flex-shrink-0 text-slate-400 font-medium">Host Country:</span>
                  {geographyInference?.host_country?.match ? (
                    <span className="text-slate-200">
                      <strong className="text-emerald-300">
                        {formatHostCountryDisplay(uploaderSelections.host_country_code, uploaderSelections.custom_host_country_name)}
                      </strong>
                      {geographyInference.host_country.raw_input && (
                        <span className="text-slate-400 text-[11px]">
                          {' '}({geographyInference.host_country.raw_input})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-amber-300/90 text-[11px]">
                      Unresolved — checked meet country field, competitor nationalities, and venue/city location via global geocoding, but none yielded a recognized sovereign host country.
                    </span>
                  )}
                </div>

                {isTranslation && canonicalName && (
                  <div className="mt-1 pt-1.5 border-t border-slate-800 flex items-start gap-1.5 text-slate-300">
                    <Globe2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                    <div className="leading-snug">
                      <span className="text-sky-300 font-medium">Translation Resolution:</span>{' '}
                      &quot;<span className="text-white">{sourceValue}</span>&quot;{' '}
                      {matchedAcronym && <span className="text-slate-400 font-mono font-medium">({matchedAcronym}) </span>}
                      is the <strong className="text-slate-200">{languageLabel ? `${languageLabel} ` : ''}{nameTypeLabel}</strong> for{' '}
                      <strong className="text-sky-200">{formatDefinedFederation(canonicalName, canonicalShortCode)}</strong>.
                    </div>
                  </div>
                )}
              </div>
              {geographyInference?.caveats && geographyInference.caveats.length > 0 && (
                <div className="text-amber-300 text-[10px] pt-1 space-y-0.5">
                  {geographyInference.caveats.map((c, i) => <div key={i}>• {c}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Additional Information / Upload Notes (Optional) */}
      <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <label className="flex items-center gap-1.5 font-medium text-slate-300">
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>Additional Information / Upload Notes</span>
            <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
          </label>
          {uploaderSelections.additional_notes && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...uploaderSelections,
                  additional_notes: null
                });
              }}
              className="text-slate-500 hover:text-rose-400 text-[10px] transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          rows={2}
          value={uploaderSelections.additional_notes || ''}
          onChange={(e) => {
            onChange({
              ...uploaderSelections,
              additional_notes: e.target.value
            });
          }}
          disabled={disabled}
          placeholder="Provide any additional context or notes about this specific upload..."
          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition resize-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-1.5 text-[10.5px] text-amber-400/90 leading-snug">
          <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
          <span>Note: Filling this out will queue this upload for administrative review prior to publication.</span>
        </div>
      </div>

      {/* Portal Dropdown Menu */}
      {mounted && dropdownPos && activeTier && typeof document !== 'undefined' && createPortal(
        <div
          data-dropdown-panel="true"
          style={{
            position: 'fixed',
            top: dropdownPos.top !== undefined ? `${dropdownPos.top}px` : undefined,
            bottom: dropdownPos.bottom !== undefined ? `${dropdownPos.bottom}px` : undefined,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
            zIndex: 9999
          }}
          className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-64"
        >
          {activeTier === 'scope' && (
            <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
              {SCOPE_OPTIONS.map((opt) => {
                const isSelected = (uploaderSelections.competition_scope || 'unknown') === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      handleSelectScope(opt.value);
                      setActiveTier(null);
                      setDropdownPos(null);
                    }}
                    className={`w-full px-3 py-2 text-left transition flex flex-col gap-0.5 cursor-pointer ${
                      isSelected ? 'bg-sky-950/60' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs">
                        {opt.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                    </div>
                    <div className="text-[11px] text-slate-300 leading-snug">
                      {opt.description}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      <strong className="text-slate-300 font-medium">Examples:</strong> {opt.examples}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {activeTier === 'host_country' && (
            <>
              <div className="p-2 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-700">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Type country name (e.g. Ecuador, Canada, USA)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                {visibleHostCountryOptions.length > 0 ? (
                  visibleHostCountryOptions.map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        handleSelectHostCountry(opt);
                        setActiveTier(null);
                        setDropdownPos(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left text-white hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{opt.label}</span>
                      {uploaderSelections.host_country_code === opt.code && (
                        <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    {searchQuery ? `No matching country for "${searchQuery}"` : 'Type to search countries...'}
                  </div>
                )}
                {searchQuery.trim() && !visibleHostCountryOptions.some((o) => o.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCustomHostCountry(searchQuery.trim());
                      setActiveTier(null);
                      setDropdownPos(null);
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-sky-400 hover:bg-slate-800 flex items-center gap-1.5 border-t border-slate-800 cursor-pointer"
                  >
                    <span className="font-bold">+</span> Use &quot;{searchQuery.trim()}&quot; as new / unlisted country
                  </button>
                )}
              </div>
            </>
          )}

          {activeTier === 'international' && (
            <>
              <div className="p-2 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-700">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search international federations (e.g. International Weightlifting Federation [IWF])..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectInternational(null);
                    setActiveTier(null);
                    setDropdownPos(null);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-slate-400 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>None</span>
                  {!uploaderSelections.international_id && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                </button>
                {visibleInternationalOptions.length > 0 ? (
                  visibleInternationalOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handleSelectInternational(opt);
                        setActiveTier(null);
                        setDropdownPos(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left text-white hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-2">
                        <span className="truncate">
                          {formatDefinedFederation(opt.canonical_name, opt.short_code)}
                        </span>
                        {opt.level && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide bg-slate-800 text-sky-400 border border-slate-700/80 flex-shrink-0">
                            {FEDERATION_LEVEL_LABELS[opt.level] || opt.level}
                          </span>
                        )}
                      </div>
                      {uploaderSelections.international_id === opt.id && (
                        <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    {searchQuery ? `No registered international bodies match "${searchQuery}"` : 'Type to search international bodies...'}
                  </div>
                )}
                {searchQuery.trim().length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCustomInternational(searchQuery.trim());
                      setActiveTier(null);
                      setDropdownPos(null);
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-sky-300 hover:bg-sky-950/70 border-t border-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span>+ Use &quot;{searchQuery.trim()}&quot; as new / unlisted entity</span>
                  </button>
                )}
              </div>
            </>
          )}

          {activeTier === 'continent' && (
            <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  handleSelectContinent(null);
                  setActiveTier(null);
                  setDropdownPos(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-left text-slate-400 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
              >
                <span>None</span>
                {!uploaderSelections.continent_id && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
              </button>
              {visibleContinentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    handleSelectContinent(opt);
                    setActiveTier(null);
                    setDropdownPos(null);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-white hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-2">
                      <span className="truncate">
                        {formatDefinedFederation(opt.canonical_name, opt.short_code)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide bg-slate-800 text-sky-400 border border-slate-700/80 flex-shrink-0">
                        Continental
                      </span>
                    </div>
                  {uploaderSelections.continent_id === opt.id && (
                    <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {activeTier === 'regional' && (
            <>
              <div className="p-2 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-700">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search regional or intercontinental federations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectRegional(null);
                    setActiveTier(null);
                    setDropdownPos(null);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-slate-400 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>{uploaderSelections.competition_scope === 'international' ? 'None / Not Applicable (International Event)' : 'None'}</span>
                  {!uploaderSelections.regional_id && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                </button>
                {visibleRegionalOptions.length > 0 ? (
                  visibleRegionalOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handleSelectRegional(opt);
                        setActiveTier(null);
                        setDropdownPos(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left text-white hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-2">
                        <span className="truncate">
                          {formatDefinedFederation(opt.canonical_name, opt.short_code)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide bg-slate-800 text-cyan-400 border border-slate-700/80 flex-shrink-0">
                          {FEDERATION_LEVEL_LABELS[opt.level] || 'Regional'}
                        </span>
                      </div>
                      {uploaderSelections.regional_id === opt.id && (
                        <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    {searchQuery ? `No registered regional bodies match "${searchQuery}"` : 'Type to search regional bodies...'}
                  </div>
                )}
                {searchQuery.trim().length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCustomRegional(searchQuery.trim());
                      setActiveTier(null);
                      setDropdownPos(null);
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-sky-300 hover:bg-sky-950/70 border-t border-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span>+ Use &quot;{searchQuery.trim()}&quot; as new / unlisted entity</span>
                  </button>
                )}
              </div>
            </>
          )}

          {activeTier === 'country' && (
            <>
              <div className="p-2 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-700">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search countries or enter new federation name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                {!isCountryRequired && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectCountry(null);
                      setActiveTier(null);
                      setDropdownPos(null);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left text-slate-400 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span>{uploaderSelections.competition_scope === 'continental' ? 'None / Not Applicable (Continental Event)' : 'None'}</span>
                    {!uploaderSelections.country_id && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                  </button>
                )}
                {visibleCountryOptions.length > 0 ? (
                  visibleCountryOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handleSelectCountry(opt);
                        setActiveTier(null);
                        setDropdownPos(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left text-white hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-2">
                        <span className="truncate">
                          {formatDefinedFederation(opt.canonical_name, opt.short_code, opt.country_code)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide bg-slate-800 text-sky-400 border border-slate-700/80 flex-shrink-0">
                          National
                        </span>
                      </div>
                      {uploaderSelections.country_id === opt.id && (
                        <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    {searchQuery ? `No registered national federations match "${searchQuery}"` : 'Type to search national federations...'}
                  </div>
                )}
                {searchQuery.trim().length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCustomCountry(searchQuery.trim());
                      setActiveTier(null);
                      setDropdownPos(null);
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-sky-300 hover:bg-sky-950/70 border-t border-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span>+ Use &quot;{searchQuery.trim()}&quot; as new / unlisted entity</span>
                  </button>
                )}
              </div>
            </>
          )}

          {activeTier === 'organizer' && (
            <>
              <div className="p-2 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900 border border-slate-700">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search or enter state/provincial body..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectOrganizer(null);
                    setActiveTier(null);
                    setDropdownPos(null);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left text-slate-400 hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                >
                  <span>None</span>
                  {!uploaderSelections.organizer_id && <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />}
                </button>
                {visibleOrganizerOptions.length > 0 ? (
                  visibleOrganizerOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        handleSelectOrganizer(opt);
                        setActiveTier(null);
                        setDropdownPos(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs text-left text-white hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0 pr-2">
                        <span className="truncate">
                          {formatDefinedFederation(opt.canonical_name, opt.short_code)}
                        </span>
                        {opt.level && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-wide bg-slate-800 text-sky-400 border border-slate-700/80 flex-shrink-0">
                            {FEDERATION_LEVEL_LABELS[opt.level] || opt.level}
                          </span>
                        )}
                      </div>
                      {uploaderSelections.organizer_id === opt.id && (
                        <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-slate-500">
                    {searchQuery ? `No registered regional bodies match "${searchQuery}"` : 'Type to search regional bodies...'}
                  </div>
                )}
                {searchQuery.trim().length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCustomOrganizer(searchQuery.trim());
                      setActiveTier(null);
                      setDropdownPos(null);
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-sky-300 hover:bg-sky-950/70 border-t border-slate-800 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span>+ Use &quot;{searchQuery.trim()}&quot; as new / unlisted entity</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

