import bwipjs from "bwip-js";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { BarcodeCache } from "../src/domain/barcode";
import { pickDefaultCamera, decodeBarcode } from "../src/services/scanner";
import { RateLimitError, UpcItemDbLookup } from "../src/services/barcode-lookup";
import type { BarcodeLookup } from "../src/services/barcode-lookup";
import { decide, resolveBarcode, resolveCover, resolveManual } from "../src/services/resolve";
import type { MetadataProvider, SearchResult } from "../src/services/tmdb";
import { DEMO_MOVIES } from "../src/services/demo";

async function barcodePng(type: string, text: string, scale = 3, rotate: "N" | "R" = "N") {
  const png = await bwipjs.toBuffer({ bcid: type, text, scale, height: 14, includetext: false, paddingwidth: 12, paddingheight: 12, backgroundcolor: "FFFFFF", rotate });
  return PNG.sync.read(png);
}

describe("decodeBarcode", () => {
  it.each([
    ["ean13", "5901234123457"],
    ["ean8", "96385074"],
    ["upca", "036000291452"],
  ])("reads a rendered %s", async (type, text) => {
    const img = await barcodePng(type, text);
    const code = decodeBarcode(img);
    expect(code).toBe(type === "upca" ? `0${text}` : text); // UPC-A comes back as 13 digits
  });
  it("reads small and rotated barcodes", async () => {
    expect(decodeBarcode(await barcodePng("ean13", "5901234123457", 1))).toBe("5901234123457");
    expect(decodeBarcode(await barcodePng("ean13", "5901234123457", 3, "R"))).toBe("5901234123457");
  });
  it("returns null for an image without a barcode", () => {
    const blank = { data: new Uint8ClampedArray(200 * 100 * 4).fill(255), width: 200, height: 100 };
    expect(decodeBarcode(blank)).toBeNull();
  });
});

describe("camera choice", () => {
  it("prefers the iPhone (Continuity Camera) over the built-in camera", () => {
    const cams = [{ deviceId: "a", label: "FaceTime HD Camera" }, { deviceId: "b", label: "Antti's iPhone Camera" }];
    expect(pickDefaultCamera(cams)?.deviceId).toBe("b");
    expect(pickDefaultCamera([cams[0]])?.deviceId).toBe("a");
    expect(pickDefaultCamera([])).toBeUndefined();
  });
});

describe("UpcItemDbLookup", () => {
  const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
  it("returns the first item title", async () => {
    const l = new UpcItemDbLookup(json({ code: "OK", items: [{ title: "" }, { title: "Blade Runner [Blu-ray]" }] }));
    expect(await l.lookup("5051890271421")).toBe("Blade Runner [Blu-ray]");
  });
  it("returns null when unknown, throws on rate limit and server errors", async () => {
    expect(await new UpcItemDbLookup(json({ code: "OK", items: [] })).lookup("1")).toBeNull();
    expect(await new UpcItemDbLookup(json({}, 404)).lookup("1")).toBeNull();
    await expect(new UpcItemDbLookup(json({}, 429)).lookup("1")).rejects.toBeInstanceOf(RateLimitError);
    await expect(new UpcItemDbLookup(json({}, 500)).lookup("1")).rejects.toThrow("500");
  });
});

// A provider backed by the demo catalogue.
const provider: MetadataProvider = {
  async search(q) {
    const n = q.toLowerCase();
    return DEMO_MOVIES.filter((m) => [m.originalTitle, m.titles.fi, m.titles.en].some((t) => t?.toLowerCase().includes(n.split(" ")[0])))
      .map((m): SearchResult => ({ tmdbId: m.tmdbId, title: m.titles.fi ?? m.originalTitle, originalTitle: m.originalTitle, year: m.year }));
  },
  async details(id) { return DEMO_MOVIES.find((m) => m.tmdbId === id)!; },
};
const memCache = () => { const m = new Map<string, string>(); return new BarcodeCache({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage); };
const lookupOf = (title: string | null | Error): BarcodeLookup => ({ lookup: async () => { if (title instanceof Error) throw title; return title; } });

describe("resolveBarcode", () => {
  it("matches a product title confidently", async () => {
    const r = await resolveBarcode("5901234123457", { provider, cache: memCache(), lookup: lookupOf("Blade Runner [Blu-ray] Region B") });
    expect(r.status).toBe("matched");
    expect(r.chosen).toBe(4);
    expect(r.readAs).toContain("Blade Runner");
  });
  it("uses the remembered barcode without any lookup", async () => {
    const cache = memCache();
    cache.set("5901234123457", 2);
    const r = await resolveBarcode("5901234123457", { provider, cache, lookup: lookupOf(new Error("must not be called")) });
    expect(r).toMatchObject({ status: "matched", chosen: 2 });
  });
  it("asks for a title when the barcode is unknown or the lookup is rate limited", async () => {
    expect(await resolveBarcode("1", { provider, cache: memCache(), lookup: lookupOf(null) })).toMatchObject({ status: "manual", message: "notFound" });
    expect(await resolveBarcode("1", { provider, cache: memCache(), lookup: lookupOf(new RateLimitError()) })).toMatchObject({ status: "manual", message: "rateLimit" });
    expect(await resolveBarcode("1", { provider, cache: memCache(), lookup: lookupOf(new Error("x")) })).toMatchObject({ status: "manual", message: "failed" });
  });
  it("lets the user choose when the title is ambiguous", async () => {
    const r = await resolveBarcode("1", { provider, cache: memCache(), lookup: lookupOf("Toivon") });
    expect(["choose", "matched"]).toContain(r.status);
    const vague = await resolveBarcode("1", { provider, cache: memCache(), lookup: lookupOf("Xyz unknown film") });
    expect(vague.status).toBe("manual");
  });
});

describe("resolveCover / resolveManual", () => {
  const line = (text: string, height: number, top: number) => ({ text, height, top, confidence: 90 });
  it("finds the movie from OCR lines", async () => {
    const r = await resolveCover([line("BLU-RAY", 20, 5), line("BLADE RUNNER", 140, 100), line("Ohjaus: Ridley Scott", 22, 500)], { provider });
    expect(r.chosen).toBe(4);
  });
  it("reports no text when OCR found nothing useful", async () => {
    expect(await resolveCover([line("|||", 50, 0)], { provider })).toMatchObject({ status: "manual", message: "noText" });
  });
  it("manual titles always go through the user's choice", async () => {
    const r = await resolveManual("Blade Runner", { provider });
    expect(r.status).toBe("choose");
    expect(r.chosen).toBeUndefined();
    expect(r.candidates![0].result.tmdbId).toBe(4);
  });
});

describe("decide", () => {
  const c = (id: number, score: number) => ({ result: { tmdbId: id, title: `M${id}`, originalTitle: `M${id}` }, score });
  it("accepts a clear winner, asks when close, and falls back to manual when empty", () => {
    expect(decide([c(1, 0.97), c(2, 0.5)])).toMatchObject({ status: "matched", chosen: 1 });
    expect(decide([c(1, 0.97), c(2, 0.95)])).toMatchObject({ status: "choose" });
    expect(decide([c(1, 0.6)])).toMatchObject({ status: "choose" });
    expect(decide([])).toMatchObject({ status: "manual" });
  });
});
