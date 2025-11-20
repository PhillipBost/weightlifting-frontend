
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

        return this.searchIndex.search(query).slice(0, options?.limit || 20);
    }
}

export const usawMeetSearch = new USAWMeetSearch();
