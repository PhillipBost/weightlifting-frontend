
import MiniSearch, { SearchResult } from 'minisearch';

export interface USAWAthleteResult {
    id: number;
    name: string;
    membership_number: string;
    gender: string;
    club: string;
    wso: string;
    totalResults: number;
    latestResultDate: string;
    displaySlug: string;
}

export class USAWAthleteSearch {
    private searchIndex: MiniSearch<USAWAthleteResult> | null = null;
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;

    constructor() { }

    async init() {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const response = await fetch('/data/usaw-athlete-search-index.json.gz');
                if (!response.ok) {
                    throw new Error(`Failed to fetch index: ${response.statusText}`);
                }

                let json;

                // Check if the browser already decompressed it (via Content-Encoding header)
                const contentEncoding = response.headers.get('Content-Encoding');
                if (contentEncoding === 'gzip') {
                    json = await response.text();
                } else {
                    // Manually decompress using DecompressionStream
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
                    fields: ['name', 'membership_number', 'searchableText'],
                    storeFields: ['id', 'name', 'membership_number', 'gender', 'club', 'wso', 'latestResultDate', 'displaySlug'],
                    searchOptions: {
                        prefix: true,
                        fuzzy: 0.2,
                        boost: { name: 2, membership_number: 2 }
                    }
                }) as unknown as MiniSearch<USAWAthleteResult>;
                this.isInitialized = true;
            } catch (error) {
                console.error('Failed to initialize USAW athlete search:', error);
                this.initPromise = null; // Allow retry
                throw error;
            }
        })();

        return this.initPromise;
    }

    search(query: string, options?: { gender?: 'M' | 'F', country?: string, limit?: number, filter?: (result: any) => boolean }): SearchResult[] {
        if (!this.searchIndex) return [];

        return this.searchIndex.search(query, {
            filter: (result) => {
                if (options?.gender && result.gender !== options.gender) return false;
                if (options?.country && result.country !== options.country) return false;
                if (options?.filter && !options.filter(result)) return false;
                return true;
            }
        }).slice(0, options?.limit || 20);
    }
}

export const usawAthleteSearch = new USAWAthleteSearch();
