import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { directorsAgree, hitMatchScore, mergeMovie, CombinedProvider } from "../src/services/merge";
import { ElonetClient, elonetIdFromNumber, elonetNumericId, elonetOnlyKey, elonetToMovie, englishTitleFrom, isElonetOnly, parseElonetRecord, plainText } from "../src/services/elonet";
import type { ElonetRecord, ElonetSource } from "../src/services/elonet";
import type { Movie } from "../src/domain/types";
import type { MetadataProvider, SearchResult } from "../src/services/tmdb";

const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "finna", `${name}.json`), "utf8"));
const record = (name: string) => parseElonetRecord(fixture(name).records[0])!;

describe("parseElonetRecord (real Finna responses)", () => {
  it("parses Tuntematon sotilas (1955)", () => {
    const r = record("record-tuntematon-sotilas-1955");
    expect(r).toMatchObject({
      elonetId: "kavi.elonet_elokuva_113528", title: "Tuntematon sotilas", year: 1955, englishTitle: "The Unknown Soldier",
      kind: "feature", language: "fi", directors: ["Edvin Laine"], url: "https://elonet.finna.fi/Record/kavi.elonet_elokuva_113528",
    });
    expect(r.genres).toEqual(["Draama", "Sotaelokuva", "Historiallinen elokuva", "Fiktio"]);
    expect(r.cast[0]).toEqual({ name: "Kosti Klemelä", role: "Koskela, ”Ville”" });
    expect(r.summary).toContain("Edvin Laineen ohjaama");
    expect(r.summary).not.toMatch(/<i>|<\/i>/); // HTML stripped
    expect(r.imageUrl).toMatch(/^https:\/\/elonet\.finna\.fi\/Cover\/Show\?.*size=medium/);
  });
  it("copes with missing fields (no summary, no language)", () => {
    const r = record("record-varjoja-paratiisissa");
    expect(r).toMatchObject({ title: "Varjoja paratiisissa", year: 1986, englishTitle: "Shadows in Paradise", directors: ["Aki Kaurismäki"] });
    expect(r.summary).toBeUndefined();
    expect(r.language).toBeUndefined();
  });
  it("detects short films and handles Toivon tuolla puolen", () => {
    expect(record("record-runoilija-muuttaa-short")).toMatchObject({ kind: "short", year: 1927, directors: ["Erkki Karu"] });
    expect(record("record-toivon-tuolla-puolen").englishTitle).toBe("The Other Side of Hope");
  });
  it("rejects records that are not Elonet films", () => {
    expect(parseElonetRecord({ id: "anders.123", title: "Tuntematon sotilas" })).toBeNull();
    expect(parseElonetRecord({ id: "kavi.elonet_elokuva_1" })).toBeNull();
  });
  it("search hits parse too", () => {
    const hits = fixture("search-tuntematon-sotilas").records.map(parseElonetRecord).filter(Boolean);
    expect(hits.map((h: ElonetRecord) => h.year).sort()).toEqual([1955, 1985, 1994, 2017]); // incl. "Vääpeli Körmy – taisteluni", which mentions it
  });
});

describe("helpers", () => {
  it("englishTitleFrom prefers the plain English title", () => {
    expect(englishTitleFrom(["Okänd soldat (ruotsinkielinen nimi)", "The Unknown Soldier (englanninkielinen nimi)"])).toBe("The Unknown Soldier");
    expect(englishTitleFrom(["Soldier (englanninkielinen nimi Yhdysvalloissa)", "Okänd (ruotsinkielinen nimi)"])).toBe("Soldier");
    expect(englishTitleFrom(["Okänd soldat (ruotsinkielinen nimi)"])).toBeUndefined();
    expect(englishTitleFrom(undefined)).toBeUndefined();
  });
  it("plainText strips tags and entities", () => {
    expect(plainText("A <i>film</i> &amp; more<br>next &quot;q&quot;")).toBe('A film & more\nnext "q"');
  });
  it("ids map to negative keys for Elonet-only movies", () => {
    expect(elonetNumericId("kavi.elonet_elokuva_113528")).toBe(113528);
    expect(elonetOnlyKey("kavi.elonet_elokuva_113528")).toBe(-113528);
    expect(elonetIdFromNumber(113528)).toBe("kavi.elonet_elokuva_113528");
    expect(isElonetOnly(-5)).toBe(true);
    expect(isElonetOnly(5)).toBe(false);
  });
  it("directors agree when they share a name, ignoring diacritics; unknown is not a conflict", () => {
    expect(directorsAgree(["Aki Kaurismäki"], ["Aki Kaurismaki"])).toBe(true);
    expect(directorsAgree(["Edvin Laine"], ["Aki Kaurismäki"])).toBe(false);
    expect(directorsAgree([], ["Anyone"])).toBe(true);
  });
});

describe("ElonetClient", () => {
  const route = (calls: string[]) => async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    if (u.pathname.endsWith("/search")) return new Response(JSON.stringify(fixture("search-tuntematon-sotilas")));
    const id = u.searchParams.get("id");
    if (id === "kavi.elonet_elokuva_113528") return new Response(JSON.stringify(fixture("record-tuntematon-sotilas-1955")));
    return new Response(JSON.stringify({ resultCount: 0, records: [] }));
  };
  it("searches the national filmography building with minimal fields and caches", async () => {
    const calls: string[] = [];
    const client = new ElonetClient(route(calls));
    const hits = await client.search("tuntematon sotilas");
    expect(hits).toHaveLength(4);
    const u = new URL(calls[0]);
    expect(u.searchParams.get("filter[]")).toBe('building:"1/KAVI/skf/"');
    expect(u.searchParams.get("type")).toBe("Title");
    expect(u.searchParams.getAll("field[]")).not.toContain("nonPresenterAuthors");
    await client.search("tuntematon sotilas");
    expect(calls).toHaveLength(1); // cached
  });
  it("fetches a full record, returns null for an unknown id, throws on HTTP errors", async () => {
    const client = new ElonetClient(route([]));
    expect((await client.record("kavi.elonet_elokuva_113528"))!.directors).toEqual(["Edvin Laine"]);
    expect(await client.record("kavi.elonet_elokuva_1")).toBeNull();
    await expect(new ElonetClient(async () => new Response("", { status: 503 })).search("x")).rejects.toThrow("503");
  });
  it("times out slow requests", async () => {
    const slow = new ElonetClient(() => new Promise(() => undefined), { timeoutMs: 20 });
    await expect(slow.search("x")).rejects.toThrow("timeout");
  });
  it("never runs more than the allowed number of requests at once", async () => {
    let active = 0, peak = 0;
    const client = new ElonetClient(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return new Response(JSON.stringify({ records: [] }));
    }, { maxConcurrent: 2 });
    await Promise.all(["a", "b", "c", "d", "e"].map((q) => client.search(q)));
    expect(peak).toBe(2);
  });
});

// --- Combined provider ------------------------------------------------------------------------------------
const tmdbMovie = (over: Partial<Movie> = {}): Movie => ({
  tmdbId: 11, originalTitle: "Tuntematon sotilas", year: 1955, runtime: 180, originalLanguage: "fi",
  titles: { fi: "Tuntematon sotilas", en: "The Unknown Soldier" }, overviews: { fi: "", en: "A classic." },
  genres: { fi: ["Draama", "Sota"], en: ["Drama", "War"] }, directors: ["Edvin Laine"], cast: ["Actor A"], countries: ["FI"], posterPath: "/p.jpg", imdbId: "tt1", ...over,
});
const tmdbResult = (over: Partial<SearchResult> = {}): SearchResult => ({ tmdbId: 11, title: "Tuntematon sotilas", originalTitle: "Tuntematon sotilas", year: 1955, ...over });
const fakeTmdb = (results: SearchResult[], movies: Record<number, Movie> = { 11: tmdbMovie() }): MetadataProvider => ({
  search: async () => results,
  details: async (id) => { if (!movies[id]) throw new Error("no movie"); return movies[id]; },
});
const elonetSource = (): ElonetSource & { searches: string[] } => {
  const searches: string[] = [];
  const recs = new Map<string, ElonetRecord>([["kavi.elonet_elokuva_113528", record("record-tuntematon-sotilas-1955")], ["kavi.elonet_elokuva_107252", record("record-varjoja-paratiisissa")]]);
  return {
    searches,
    search: async (q) => { searches.push(q); return [...recs.values()].filter((r) => q.toLowerCase().split(" ").some((w) => r.title.toLowerCase().includes(w))).map(({ elonetId, title, year, englishTitle, kind }) => ({ elonetId, title, year, englishTitle, kind })); },
    record: async (id) => recs.get(id) ?? null,
  };
};
const opts = { preferElonetText: true };

describe("CombinedProvider.search", () => {
  it("links an Elonet hit to the matching TMDB result (same title, year within 1)", async () => {
    const p = new CombinedProvider(fakeTmdb([tmdbResult({ year: 1956 })]), elonetSource(), opts);
    const r = await p.search("tuntematon sotilas");
    const linked = r.filter((x) => x.source === "both");
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({ tmdbId: 11, elonetId: "kavi.elonet_elokuva_113528" });
    expect(r.filter((x) => x.source === "elonet")).toEqual([]); // nothing left over
  });
  it("keeps same-titled remakes with other years apart", async () => {
    const r = await new CombinedProvider(fakeTmdb([tmdbResult()]), elonetSource(), opts).search("tuntematon sotilas");
    expect(r.filter((x) => x.source === "both")).toHaveLength(1);
  });
  it("matches through the English title when TMDB lists only the English one", async () => {
    const r = await new CombinedProvider(fakeTmdb([tmdbResult({ title: "The Unknown Soldier", originalTitle: "Tuntematon sotilas" })]), elonetSource(), opts).search("tuntematon");
    expect(r[0].source).toBe("both");
  });
  it("lists Elonet-only films with negative ids and puts linked results first", async () => {
    const r = await new CombinedProvider(fakeTmdb([]), elonetSource(), opts).search("varjoja paratiisissa");
    expect(r).toEqual([expect.objectContaining({ tmdbId: -107252, source: "elonet", title: "Varjoja paratiisissa", year: 1986 })]);
  });
  it("orders Elonet-only hits by how well their title matches the query", async () => {
    const elo: ElonetSource = {
      search: async () => [
        { elonetId: "kavi.elonet_elokuva_3", title: "Vääpeli Körmy – taisteluni", year: 1994, kind: "feature" },
        { elonetId: "kavi.elonet_elokuva_1", title: "Tuntematon sotilas", year: 2017, kind: "feature" },
        { elonetId: "kavi.elonet_elokuva_2", title: "Tuntematon sotilas", year: 1985, kind: "feature" },
      ],
      record: async () => null,
    };
    const r = await new CombinedProvider(fakeTmdb([]), elo, opts).search("tuntematon sotilas");
    expect(r.map((x) => x.year)).toEqual([1985, 2017, 1994]);
  });
  it("one source failing does not block the other; both failing throws", async () => {
    const errors: string[] = [];
    const failing: MetadataProvider = { search: async () => { throw new Error("tmdb down"); }, details: async () => { throw new Error("x"); } };
    const onlyElonet = await new CombinedProvider(failing, elonetSource(), { ...opts, onSourceError: (s) => errors.push(s) }).search("varjoja");
    expect(onlyElonet).toHaveLength(1);
    expect(errors).toEqual(["tmdb"]);
    const brokenElonet: ElonetSource = { search: async () => { throw new Error("elonet down"); }, record: async () => null };
    const onlyTmdb = await new CombinedProvider(fakeTmdb([tmdbResult()]), brokenElonet, { ...opts, onSourceError: (s) => errors.push(s) }).search("x");
    expect(onlyTmdb.map((r) => r.source)).toEqual(["tmdb"]);
    await expect(new CombinedProvider(failing, brokenElonet, opts).search("x")).rejects.toThrow();
  });
  it("works without Elonet (turned off)", async () => {
    const r = await new CombinedProvider(fakeTmdb([tmdbResult()]), null, opts).search("x");
    expect(r.map((x) => x.source)).toEqual(["tmdb"]);
  });
});

describe("CombinedProvider.details and merging", () => {
  it("merges Finnish text and credits from Elonet into the TMDB movie", async () => {
    const p = new CombinedProvider(fakeTmdb([tmdbResult()]), elonetSource(), opts);
    await p.search("tuntematon sotilas"); // establishes the link
    const m = await p.details(11);
    expect(m).toMatchObject({ tmdbId: 11, elonetId: "kavi.elonet_elokuva_113528", runtime: 180, imdbId: "tt1", posterPath: "/p.jpg" });
    expect(m.overviews.fi).toContain("Edvin Laineen ohjaama"); // TMDB had an empty Finnish overview
    expect(m.overviews.en).toBe("A classic.");
    expect(m.genres.fi).toEqual(["Draama", "Sota"]); // TMDB genres kept
    expect(m.cast[0]).toBe("Kosti Klemelä");
    expect(m.elonetUrl).toContain("elonet.finna.fi/Record/");
  });
  it("finds the Elonet record by itself for Finnish films when no search link exists", async () => {
    const m = await new CombinedProvider(fakeTmdb([]), elonetSource(), opts).details(11);
    expect(m.elonetId).toBe("kavi.elonet_elokuva_113528");
  });
  it("does not query Elonet for foreign films", async () => {
    const elo = elonetSource();
    const foreign = tmdbMovie({ tmdbId: 12, originalTitle: "Blade Runner", originalLanguage: "en", countries: ["US"], titles: { fi: "Blade Runner", en: "Blade Runner" }, year: 1982, directors: ["Ridley Scott"] });
    const m = await new CombinedProvider(fakeTmdb([], { 12: foreign }), elo, opts).details(12);
    expect(elo.searches).toEqual([]);
    expect(m.elonetId).toBeUndefined();
  });
  it("refuses a link when the directors clearly differ (remake with the same title and year)", async () => {
    const other = tmdbMovie({ directors: ["Someone Else"] });
    const m = await new CombinedProvider(fakeTmdb([], { 11: other }), elonetSource(), opts).details(11);
    expect(m.elonetId).toBeUndefined();
  });
  it("returns plain TMDB data when Elonet fails during details", async () => {
    const errors: unknown[] = [];
    const broken: ElonetSource = { search: async () => { throw new Error("down"); }, record: async () => { throw new Error("down"); } };
    const m = await new CombinedProvider(fakeTmdb([]), broken, { ...opts, onSourceError: (_s, e) => errors.push(e) }).details(11);
    expect(m.elonetId).toBeUndefined();
    expect(errors).toHaveLength(1);
  });
  it("loads an Elonet-only movie by its negative id", async () => {
    const m = await new CombinedProvider(fakeTmdb([]), elonetSource(), opts).details(-107252);
    expect(m).toMatchObject({ tmdbId: -107252, originalTitle: "Varjoja paratiisissa", year: 1986, countries: ["FI"], directors: ["Aki Kaurismäki"] });
    expect(m.titles.en).toBe("Shadows in Paradise");
    expect(m.posterPath).toMatch(/^https:\/\/elonet\.finna\.fi/);
    await expect(new CombinedProvider(fakeTmdb([]), null, opts).details(-5)).rejects.toThrow("turned off");
  });
  it("preferElonetText=false keeps TMDB's Finnish title and overview", () => {
    const rec = record("record-tuntematon-sotilas-1955");
    const m = mergeMovie(tmdbMovie({ titles: { fi: "TMDB-nimi", en: "X" }, overviews: { fi: "TMDB-kuvaus" } }), rec, { preferElonetText: false });
    expect(m.titles.fi).toBe("TMDB-nimi");
    expect(m.overviews.fi).toBe("TMDB-kuvaus");
    expect(mergeMovie(tmdbMovie({ overviews: { fi: "" } }), rec, { preferElonetText: false }).overviews.fi).toContain("Laineen"); // fills a gap
  });
});

describe("title scoring", () => {
  it("is 0 when years are more than one apart", () => {
    expect(hitMatchScore({ title: "Tuntematon sotilas", year: 1955 }, { title: "Tuntematon sotilas", originalTitle: "Tuntematon sotilas", year: 1985 })).toBe(0);
    expect(elonetToMovie(record("record-varjoja-paratiisissa")).tmdbId).toBe(-107252);
  });
});
