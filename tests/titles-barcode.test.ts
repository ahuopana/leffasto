import { describe, expect, it } from "vitest";
import { BarcodeCache, isValidBarcode, normalizeBarcode } from "../src/domain/barcode";
import { cleanProductTitle, extractTitleCandidates, findYear, rankMatches, similarity } from "../src/domain/titles";
import type { OcrLine } from "../src/domain/titles";

describe("barcodes", () => {
  it("validates EAN-13, UPC-A and EAN-8 check digits", () => {
    expect(isValidBarcode("5901234123457")).toBe(true); // EAN-13
    expect(isValidBarcode("5901234123458")).toBe(false);
    expect(isValidBarcode("036000291452")).toBe(true); // UPC-A
    expect(isValidBarcode("96385074")).toBe(true); // EAN-8
    expect(isValidBarcode("12345")).toBe(false);
    expect(isValidBarcode("50518902714ab")).toBe(false);
  });
  it("normalizes UPC-A to 13 digits", () => {
    expect(normalizeBarcode("036000291452")).toBe("0036000291452");
    expect(normalizeBarcode("5901 2341 23457")).toBe("5901234123457");
  });
  it("caches barcode -> movie in storage, regardless of UPC/EAN spelling", () => {
    const m = new Map<string, string>();
    const storage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
    new BarcodeCache(storage).set("036000291452", 42);
    expect(new BarcodeCache(storage).get("0036000291452")).toBe(42);
    expect(new BarcodeCache(storage).get("5901234123457")).toBeUndefined();
  });
});

describe("cleanProductTitle", () => {
  it.each([
    ["Blade Runner [Blu-ray]", "Blade Runner"],
    ["Blade Runner (1982) [DVD] Region 2", "Blade Runner"],
    ["Tuntematon sotilas - Suomijulkaisu DVD", "Tuntematon sotilas"],
    ["The Matrix 4K Ultra HD Blu-ray Steelbook", "The Matrix"],
    ["Amélie: Special Edition 2-Disc Set", "Amélie"],
    ["Toivon tuolla puolen", "Toivon tuolla puolen"],
    ["Mr. Smith Goes to Washington", "Mr. Smith Goes to Washington"],
    ["  Alien  -  Director's Cut ", "Alien"],
  ])("%s -> %s", (raw, expected) => expect(cleanProductTitle(raw)).toBe(expected));
  it("finds a release year", () => {
    expect(findYear("Blade Runner (1982) Blu-ray")).toBe(1982);
    expect(findYear("2001: A Space Odyssey")).toBe(2001);
    expect(findYear("No year here")).toBeUndefined();
  });
});

describe("similarity and ranking", () => {
  it("is 1 for equal titles ignoring case, punctuation and diacritics", () => {
    expect(similarity("Amélie", "AMELIE")).toBe(1);
    expect(similarity("Blade Runner", "Blade-Runner!")).toBe(1);
  });
  it("scores subtitled titles high but below exact, and unrelated titles low", () => {
    const sub = similarity("Blade Runner", "Blade Runner: The Final Cut");
    expect(sub).toBeGreaterThan(0.7);
    expect(sub).toBeLessThan(1);
    expect(similarity("Blade Runner", "Toivon tuolla puolen")).toBeLessThan(0.3);
  });
  it("tolerates OCR typos", () => {
    expect(similarity("Tuntematon sotilas", "Tuntematon sotllas")).toBeGreaterThan(0.9);
  });
  const results = [
    { tmdbId: 1, title: "Blade Runner 2049", originalTitle: "Blade Runner 2049", year: 2017 },
    { tmdbId: 2, title: "Blade Runner", originalTitle: "Blade Runner", year: 1982 },
    { tmdbId: 3, title: "Runner", originalTitle: "Runner", year: 2000 },
  ];
  it("ranks the best match first and uses the year as a tie-break", () => {
    const ranked = rankMatches(["Blade Runner [Blu-ray] (1982)"], results);
    expect(ranked[0].result.tmdbId).toBe(2);
    expect(ranked[0].score).toBeGreaterThan(0.95);
    expect(ranked.map((r) => r.result.tmdbId)).toContain(1);
  });
  it("matches the Finnish title or the original title", () => {
    const r = rankMatches(["Hopeless Hope"], [{ tmdbId: 9, title: "Toivon tuolla puolen", originalTitle: "Hopeless Hope", year: 2017 }]);
    expect(r[0].score).toBe(1);
  });
});

describe("extractTitleCandidates", () => {
  const line = (text: string, height: number, top: number, confidence = 85): OcrLine => ({ text, height, top, confidence });
  it("prefers large confident lines and drops cover boilerplate", () => {
    const c = extractTitleCandidates([
      line("BLU-RAY", 30, 10),
      line("TUNTEMATON", 120, 100),
      line("SOTILAS", 118, 230),
      line("Ohjaus: Edvin Laine", 20, 600),
      line("K-16", 40, 700),
      line("%%%", 90, 800, 20),
    ]);
    expect(c).toContain("TUNTEMATON SOTILAS");
    expect(c[0]).toMatch(/TUNTEMATON|SOTILAS/);
    expect(c.some((x) => /blu-?ray/i.test(x))).toBe(false);
    expect(c.some((x) => /Ohjaus/.test(x))).toBe(false);
    expect(c.some((x) => /K-16/.test(x))).toBe(false);
  });
  it("returns nothing for empty or noisy input", () => {
    expect(extractTitleCandidates([])).toEqual([]);
    expect(extractTitleCandidates([line("|||", 50, 0, 90)])).toEqual([]);
  });
});
