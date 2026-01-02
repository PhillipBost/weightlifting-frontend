import MiniSearch, { SearchResult } from 'minisearch';

export interface USAWMeetResult {
    id: number;
    name: string;
    date: string;
    level: string;
    city: string;
    state: string;
    displaySlug: string;
}

export class USAWMeetSearch {
    private searchIndex: MiniSearch<USAWMeetResult> | null = null;
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;

    constructor() { }

    async init() {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const response = await fetch('/data/usaw-meet-search-index.json.gz');
                if (!response.ok) {
                    throw new Error(`Failed to fetch index: ${response.statusText}`);
                }

                let json;

                const contentEncoding = response.headers.get('Content-Encoding');
                if (contentEncoding === 'gzip') {
                    json = await response.text();
                } else {
                    try {
                        const ds = new DecompressionStream('gzip');
                        const decompressedStream = response.body?.pipeThrough(ds);
                        if (decompressedStream) {
                            json = await new Response(decompressedStream).text();
                        } else {
                            json = await response.text();
                        }
                    } catch (e) {
                        console.warn('Decompression failed, attempting to parse as plain JSON', e);
                        throw e;
                    }
                }

                this.searchIndex = MiniSearch.loadJSON(json, {
                    fields: ['name', 'searchableText'],
                    storeFields: ['id', 'name', 'date', 'level', 'city', 'state', 'displaySlug'],
                    searchOptions: {
                        prefix: true,
                        fuzzy: 0.2,
                        boost: { name: 2 }
                    }
                }) as unknown as MiniSearch<USAWMeetResult>;
                this.isInitialized = true;
            } catch (error) {
                console.error('Failed to initialize USAW meet search:', error);
                this.initPromise = null; // Allow retry
                throw error;
            }
        })();

        return this.initPromise;
    }

    search(query: string, options?: { limit?: number }): SearchResult[] {
        if (!this.searchIndex) return [];

        // Extract year from query for date filtering
        const yearMatch = query.match(/\b(19|20)\d{2}\b/);
        const targetYear = yearMatch ? parseInt(yearMatch[0]) : null;

        // Get all search results
        const rawResults = this.searchIndex.search(query);
        const allResults = rawResults.slice(0, options?.limit || 100); // Increased limit

        // Apply year filtering and custom relevance scoring
        const scoredResults = allResults.map(result => {
            const meetDate = new Date(result.date);
            const meetYear = meetDate.getFullYear();

            // Calculate relevance score
            let score = result.score || 0;

            // Boost exact name matches significantly
            if (result.name && query.toLowerCase().includes(result.name.toLowerCase())) {
                score += 100;
            }

            // Boost partial name matches
            const queryWords = query.toLowerCase().split(/\s+/);
            const nameWords = result.name?.toLowerCase().split(/\s+/) || [];
            const wordMatches = queryWords.filter((word: string) =>
                nameWords.some((nameWord: string) => nameWord.includes(word) || word.includes(nameWord))
            ).length;
            score += wordMatches * 10;

            // If year was specified in query, heavily prioritize matches from that year
            if (targetYear && meetYear === targetYear) {
                score += 50;
            } else if (targetYear) {
                // Penalize results far from target year
                const yearDiff = Math.abs(meetYear - targetYear);
                score -= yearDiff * 5;
            }

            return { ...result, _relevanceScore: score, _meetYear: meetYear };
        });

        // Sort by relevance score first, then by date (most recent)
        const sortedResults = scoredResults.sort((a, b) => {
            if (a._relevanceScore !== b._relevanceScore) {
                return b._relevanceScore - a._relevanceScore;
            }
            // If same relevance, sort by date (most recent first)
            const aDate = new Date((a as any).date).getTime();
            const bDate = new Date((b as any).date).getTime();
            return bDate - aDate;
        });

        // Remove internal scoring fields before returning
        return sortedResults.map(result => {
            // Preserve _relevanceScore for external sorting
            const { _meetYear, ...cleanResult } = result;
            return cleanResult;
        });
    }
}

export const usawMeetSearch = new USAWMeetSearch();
