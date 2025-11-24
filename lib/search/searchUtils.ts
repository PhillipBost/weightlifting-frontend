
// Common name variations and nicknames
const NAME_VARIATIONS: Record<string, string[]> = {
  // Philip variations
  'philip': ['phillip', 'filip', 'phil'],
  'phillip': ['philip', 'filip', 'phil'],
  'filip': ['philip', 'phillip', 'phil'],
  'phil': ['philip', 'phillip', 'filip'],

  // Catherine variations
  'catherine': ['katherine', 'kathryn', 'cathy', 'kate', 'katie', 'cat'],
  'katherine': ['catherine', 'kathryn', 'kathy', 'kate', 'katie', 'kat'],
  'kathryn': ['catherine', 'katherine', 'kathy', 'kate', 'katie'],
  'cathy': ['catherine', 'kathy', 'kate'],
  'kathy': ['katherine', 'kathryn', 'cathy', 'kate'],
  'kate': ['katherine', 'kathryn', 'catherine', 'katie', 'cathy'],
  'katie': ['katherine', 'kathryn', 'catherine', 'kate'],

  // John variations
  'john': ['jon', 'johnny', 'johnathan', 'jonathan', 'jack'],
  'jon': ['john', 'johnny', 'johnathan', 'jonathan'],
  'johnny': ['john', 'jon'],
  'johnathan': ['john', 'jon', 'jonathan'],
  'jonathan': ['john', 'jon', 'johnathan'],
  'jack': ['john', 'jackson'],

  // Michael variations
  'michael': ['mike', 'mick', 'mickey', 'mikey'],
  'mike': ['michael', 'mick'],
  'mick': ['michael', 'mike'],
  'mickey': ['michael', 'mike'],
  'mikey': ['michael', 'mike'],

  // William variations
  'william': ['bill', 'will', 'billy', 'willy', 'willie'],
  'bill': ['william', 'billy'],
  'will': ['william', 'willy', 'willie'],
  'billy': ['william', 'bill'],
  'willy': ['william', 'will', 'willie'],
  'willie': ['william', 'will', 'willy'],

  // Robert variations
  'robert': ['rob', 'bob', 'robbie', 'bobby', 'bert'],
  'rob': ['robert', 'robbie'],
  'bob': ['robert', 'bobby'],
  'robbie': ['robert', 'rob'],
  'bobby': ['robert', 'bob'],
  'bert': ['robert', 'albert'],

  // Richard variations
  'richard': ['rick', 'dick', 'rich', 'richie', 'ricky'],
  'rick': ['richard', 'ricky'],
  'dick': ['richard'],
  'rich': ['richard', 'richie'],
  'richie': ['richard', 'rich'],
  'ricky': ['richard', 'rick'],

  // Christopher variations
  'christopher': ['chris', 'christy', 'christie'],
  'chris': ['christopher', 'christian', 'christine'],
  'christy': ['christopher', 'christie'],
  'christie': ['christopher', 'christy'],

  // Nicholas variations
  'nicholas': ['nick', 'nicky', 'nicolas'],
  'nick': ['nicholas', 'nicky'],
  'nicky': ['nicholas', 'nick'],
  'nicolas': ['nicholas', 'nick'],

  // Anthony variations
  'anthony': ['tony', 'anton'],
  'tony': ['anthony', 'antonio'],
  'anton': ['anthony', 'antonio'],
  'antonio': ['anthony', 'tony', 'anton'],

  // Matthew variations
  'matthew': ['matt', 'matty'],
  'matt': ['matthew', 'matty'],
  'matty': ['matthew', 'matt'],

  // Andrew variations
  'andrew': ['andy', 'drew'],
  'andy': ['andrew', 'anderson'],
  'drew': ['andrew'],

  // Daniel variations
  'daniel': ['dan', 'danny', 'dane'],
  'dan': ['daniel', 'danny'],
  'danny': ['daniel', 'dan'],
  'dane': ['daniel'],

  // David variations
  'david': ['dave', 'davey', 'davy'],
  'dave': ['david', 'davey'],
  'davey': ['david', 'dave', 'davy'],
  'davy': ['david', 'davey'],

  // Elizabeth variations
  'elizabeth': ['liz', 'beth', 'betsy', 'betty', 'eliza', 'lisa'],
  'liz': ['elizabeth', 'lisa'],
  'beth': ['elizabeth', 'bethany'],
  'betsy': ['elizabeth', 'betty'],
  'betty': ['elizabeth', 'betsy'],
  'eliza': ['elizabeth'],
  'lisa': ['elizabeth', 'liz'],

  // Jennifer variations
  'jennifer': ['jen', 'jenny', 'jenn'],
  'jen': ['jennifer', 'jenny'],
  'jenny': ['jennifer', 'jen'],
  'jenn': ['jennifer', 'jen'],

  // Jessica variations
  'jessica': ['jess', 'jessie'],
  'jess': ['jessica', 'jessie'],
  'jessie': ['jessica', 'jess'],

  // James variations
  'james': ['jim', 'jimmy', 'jamie'],
  'jim': ['james', 'jimmy'],
  'jimmy': ['james', 'jim'],
  'jamie': ['james'],

  // Joseph variations
  'joseph': ['joe', 'joey', 'jos'],
  'joe': ['joseph', 'joey'],
  'joey': ['joseph', 'joe'],
  'jos': ['joseph'],

  // Thomas variations
  'thomas': ['tom', 'tommy', 'thom'],
  'tom': ['thomas', 'tommy'],
  'tommy': ['thomas', 'tom'],
  'thom': ['thomas'],

  // Charles variations
  'charles': ['charlie', 'chuck', 'chas'],
  'charlie': ['charles', 'charlotte'],
  'chuck': ['charles'],
  'chas': ['charles'],

  // Patricia variations
  'patricia': ['pat', 'patty', 'trish', 'patsy'],
  'pat': ['patricia', 'patrick', 'patty'],
  'patty': ['patricia', 'pat'],
  'trish': ['patricia'],
  'patsy': ['patricia'],

  // Patrick variations
  'patrick': ['pat', 'paddy', 'rick'],
  'paddy': ['patrick'],

  // Additional common names
  'alexander': ['alex', 'xander', 'sandy'],
  'alex': ['alexander', 'alexandra', 'alexis'],
  'xander': ['alexander'],
  'sandy': ['alexander', 'sandra'],

  'benjamin': ['ben', 'benny', 'benji'],
  'ben': ['benjamin', 'benny'],
  'benny': ['benjamin', 'ben'],
  'benji': ['benjamin'],

  'gregory': ['greg', 'gregg'],
  'greg': ['gregory', 'gregg'],
  'gregg': ['gregory', 'greg'],

  'joshua': ['josh'],
  'josh': ['joshua'],

  'steven': ['steve', 'stevie'],
  'stephen': ['steve', 'stevie'],
  'steve': ['steven', 'stephen', 'stevie'],
  'stevie': ['steven', 'stephen', 'steve'],

  'timothy': ['tim', 'timmy'],
  'tim': ['timothy', 'timmy'],
  'timmy': ['timothy', 'tim'],

  'edward': ['ed', 'eddie', 'ted'],
  'ed': ['edward', 'eddie'],
  'eddie': ['edward', 'ed'],
  'ted': ['edward', 'theodore'],

  'ronald': ['ron', 'ronnie'],
  'ron': ['ronald', 'ronnie'],
  'ronnie': ['ronald', 'ron'],

  'harley': ['harv'],
  'harv': ['harley'],

  'martha': ['mattie'],
  'mattie': ['martha'],

  'wesley': ['wes'],
  'wes': ['wesley']
};

// Athletes who competed under different names
const ATHLETE_NAME_CHANGES: Record<string, string[]> = {
  'kate nye': ['katherine vibert'],
  'katherine vibert': ['kate nye'],
};

/**
 * Strips punctuation from a string
 */
export const stripPunctuation = (term: string): string => {
  return term.replace(/[^\w\s-]/g, '').trim();
};

/**
 * Gets name variations for a single name token (e.g. "Bill" -> ["Bill", "William"])
 */
export const getNameVariations = (name: string): string[] => {
  const cleaned = name.toLowerCase().trim();
  const variations = [name]; // Always include original
  
  // Add mapped variations
  if (NAME_VARIATIONS[cleaned]) {
    variations.push(...NAME_VARIATIONS[cleaned]);
  }
  
  return variations;
};

/**
 * Checks if an athlete name matches a search query using fuzzy logic
 * - Handles nicknames (Bill -> William)
 * - Handles name changes (Kate Nye -> Katherine Vibert)
 * - Requires ALL query tokens to be present in the name (AND logic)
 */
export const matchesAthleteName = (athleteName: string, query: string): boolean => {
  if (!query) return true;
  if (!athleteName) return false;

  const normalizedName = athleteName.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();

  // 1. Check specific full-name mappings (e.g. "Kate Nye" -> "Katherine Vibert")
  const mappedNames = ATHLETE_NAME_CHANGES[normalizedQuery];
  if (mappedNames) {
    if (mappedNames.some(mapped => normalizedName.includes(mapped))) return true;
  }

  // 2. Token-based matching
  // Split query into tokens
  const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
  
  // If no tokens, match everything (should be handled by !query check above but safe to keep)
  if (queryTokens.length === 0) return true;

  // Check if EVERY query token (or one of its variations) is present in the athlete name
  return queryTokens.every(token => {
    const variations = getNameVariations(token);
    // Check if ANY variation of this token is in the name
    return variations.some(v => normalizedName.includes(v));
  });
};

/**
 * Generates search terms for search engines (legacy/MiniSearch support)
 * Keeps the logic from app/page.tsx for compatibility
 */
export const generateAthleteSearchTerms = (query: string): string[] => {
  const terms = [query];
  const cleaned = query.toLowerCase().trim();

  // Handle common typos in names
  let fuzzyQuery = cleaned;

  // Remove extra letters (e.g., "Philllip" -> "Philip")
  fuzzyQuery = fuzzyQuery.replace(/([a-z])\1{2,}/g, '$1$1'); // Reduce 3+ repeated letters to 2
  fuzzyQuery = fuzzyQuery.replace(/([a-z])\1{1,}/g, '$1'); // Then reduce 2+ to single

  // Add the cleaned version if it's different
  if (fuzzyQuery !== cleaned) {
    terms.push(query.replace(new RegExp(cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), fuzzyQuery));
  }

  // Handle multi-word queries to support names with middle names
  const words = cleaned.trim().split(/\s+/);
  if (words.length === 2) {
    const twoWordPattern = `${words[0]}%${words[1]}`;
    terms.push(twoWordPattern);
  } else if (words.length > 2) {
    const firstWord = words[0];
    const lastWord = words[words.length - 1];
    if (firstWord !== lastWord) {
      terms.push(`${firstWord}%${lastWord}`);
    }
  }

  // Check for full name matches (exact athlete name changes)
  Object.entries(ATHLETE_NAME_CHANGES).forEach(([formerName, currentNames]) => {
    const formerNameLower = formerName.toLowerCase();
    if (cleaned === formerNameLower) {
      currentNames.forEach(currentName => {
        terms.push(currentName);
      });
    }
  });

  // Only apply individual name variations if we haven't found a specific athlete name change
  const hasSpecificNameMatch = Object.keys(ATHLETE_NAME_CHANGES).some(
    key => cleaned === key.toLowerCase()
  );

  if (!hasSpecificNameMatch) {
    // Add name variations for individual words
    Object.entries(NAME_VARIATIONS).forEach(([key, alts]) => {
      const keyRegex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (keyRegex.test(cleaned)) {
        alts.forEach(alt => {
          terms.push(query.replace(keyRegex, alt));
        });
      }
    });
  }

  // Also try partial matches for name changes
  if (cleaned.includes('kate') && cleaned.includes('nye')) {
    terms.push('vibert');
    terms.push('katherine vibert');
    terms.push('kate vibert');
    terms.push('vibert, katherine');
    terms.push('vibert, kate');
  }

  return [...new Set(terms)];
};
