import { httpFetch } from "./http";

/** Resolves a barcode to the product title a shop would list for it (e.g. "Blade Runner [Blu-ray]"). */
export interface BarcodeLookup {
  /** Product title, or null when the barcode is unknown. Throws on network or rate-limit errors. */
  lookup(code: string): Promise<string | null>;
}

export class RateLimitError extends Error {
  constructor() { super("Barcode lookup rate limit reached"); }
}

interface UpcItemDbResponse {
  code?: string;
  items?: { title?: string; brand?: string }[];
}

/**
 * UPCitemdb: the trial endpoint needs no key (limited to roughly 100 lookups per day); DVD/Blu-ray coverage is
 * decent but not complete, so the scan flow always offers a manual title fallback.
 */
export class UpcItemDbLookup implements BarcodeLookup {
  constructor(private fetchFn: (url: string) => Promise<Response> = (url) => httpFetch(url)) {}

  async lookup(code: string): Promise<string | null> {
    const res = await this.fetchFn(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`);
    if (res.status === 429) throw new RateLimitError();
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`);
    const data = (await res.json()) as UpcItemDbResponse;
    return data.items?.find((i) => i.title)?.title ?? null;
  }
}
