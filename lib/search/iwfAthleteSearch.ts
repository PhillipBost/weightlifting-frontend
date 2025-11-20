
import MiniSearch, { SearchResult } from 'minisearch';

export interface IWFAthleteResult {
    id: number;
    iwfId: number | null;
    name: string;
    country: string;
    gender: 'M' | 'F';
    totalResults: number;
    bestTotal: number;
    displaySlug: string;
}

export class IWFAthleteSearch {
    private searchIndex: MiniSearch<IWFAthleteResult> | null = null;
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;

    constructor() { }

    async init() {
        if (this.isInitialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const response = await fetch('/data/iwf-athlete-search-index.json.gz');
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
                    fields: ['name', 'country', 'searchableText'],
                    storeFields: ['id', 'iwfId', 'name', 'country', 'gender', 'totalResults', 'bestTotal', 'displaySlug'],
                    searchOptions: {
                        prefix: true,
                        fuzzy: 0.2,
                        boost: { name: 2 }
                    }
                }) as unknown as MiniSearch<IWFAthleteResult>;
                this.isInitialized = true;
            } catch (error) {
                console.error('Failed to initialize IWF search:', error);
                this.initPromise = null; // Allow retry
                throw error;
            }
        })();

        return this.initPromise;
    }

    search(query: string, options?: { gender?: 'M' | 'F', limit?: number }): SearchResult[] {
        if (!this.searchIndex) return [];

        return this.searchIndex.search(query, {
            filter: options?.gender ? (result) => result.gender === options.gender : undefined
        }).slice(0, options?.limit || 20);
    }
}

export const iwfAthleteSearch = new IWFAthleteSearch();
