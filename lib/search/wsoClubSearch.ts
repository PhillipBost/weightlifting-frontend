import MiniSearch, { SearchResult } from 'minisearch';

export interface WsoClubResult {
    id: string; // Unique ID (e.g., 'wso-1', 'club-123')
    name: string;
    type: 'WSO' | 'Club' | 'Country';
    location: string; // City, State or just State
    slug: string;
    state: string; // For filtering if needed
}

export class WsoClubSearch {
    private searchIndex: MiniSearch<WsoClubResult> | null = null;
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;

    constructor() { }

    async init() {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const response = await fetch('/data/wso-club-search-index.json.gz');
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
                        // Fallback: maybe it wasn't gzipped?
                        // If DecompressionStream fails, it might mean the body was already consumed or it's not gzipped.
                        // We can't easily rewind response.body.
                        // Better approach: Clone defaults?
                        // Re-fetching might be needed if stream is consumed.
                        // But for now, let's assume if it fails, we throw. 
                        // Actually, if fetching a .gz file locally without server gzip headers, the browser sees binary.
                        // DecompressionStream is the correct way to handle client-side decompression of .gz files.
                        throw e;
                    }
                }

                this.searchIndex = MiniSearch.loadJSON(json, {
                    fields: ['name', 'location', 'searchableText'],
                    storeFields: ['id', 'name', 'type', 'location', 'slug', 'state'],
                    searchOptions: {
                        prefix: true,
                        fuzzy: 0.2,
                        boost: { name: 2, type: 1.5 }
                    }
                }) as unknown as MiniSearch<WsoClubResult>;

                this.isInitialized = true;

            } catch (error) {
                console.error('Failed to initialize WSO/Club search:', error);
                this.initPromise = null; // Allow retry
                // Do not throw, just log error so app doesn't crash on init
            }
        })();

        return this.initPromise;
    }

    search(query: string, options?: { limit?: number }): SearchResult[] {
        if (!this.searchIndex) return [];

        // MiniSearch's search returns items with 'score' and stored fields.
        const rawResults = this.searchIndex.search(query);
        const limit = options?.limit || 20;

        // Map to ensure shape (MiniSearch returns & SearchResult & {score, terms, match})
        const results = rawResults.slice(0, limit).map(result => ({
            ...result,
            _relevanceScore: result.score
        }));

        return results;
    }
}

export const wsoClubSearch = new WsoClubSearch();
