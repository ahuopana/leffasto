import { describe, expect, it } from "vitest";
import { TmdbClient } from "../src/services/tmdb";

const detail = (lang: string) => ({
  id: 42,
  title: lang === "fi-FI" ? "Suomalainen nimi" : "English Title",
  original_title: "Alkuperäinen",
  overview: lang === "fi-FI" ? "" : "English overview",
  release_date: "1999-05-01",
  runtime: 101,
  poster_path: "/p.jpg",
  genres: [{ id: 1, name: lang === "fi-FI" ? "Draama" : "Drama" }],
  production_countries: [{ iso_3166_1: "FI" }],
  external_ids: { imdb_id: "tt123" },
  credits: {
    cast: Array.from({ length: 12 }, (_, i) => ({ name: `Actor ${i}` })),
    crew: [{ name: "Dir", job: "Director" }, { name: "Cam", job: "Cinematography" }],
  },
});

function fakeFetch(calls: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    const body = url.pathname.endsWith("/search/movie")
      ? { results: [{ id: 42, title: "Suomalainen nimi", original_title: "Alkuperäinen", release_date: "1999-05-01", poster_path: null }] }
      : detail(url.searchParams.get("language")!);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

describe("TmdbClient", () => {
  it("searches in Finnish and maps results", async () => {
    const calls: string[] = [];
    const res = await new TmdbClient("KEY", fakeFetch(calls)).search("nimi");
    expect(res).toEqual([{ tmdbId: 42, title: "Suomalainen nimi", originalTitle: "Alkuperäinen", year: 1999, posterPath: undefined }]);
    expect(calls[0]).toContain("language=fi-FI");
    expect(calls[0]).toContain("api_key=KEY");
  });
  it("merges fi and en details", async () => {
    const m = await new TmdbClient("KEY", fakeFetch([])).details(42);
    expect(m.titles).toEqual({ fi: "Suomalainen nimi", en: "English Title" });
    expect(m.overviews.fi).toBeUndefined();
    expect(m.overviews.en).toBe("English overview");
    expect(m.genres).toEqual({ fi: ["Draama"], en: ["Drama"] });
    expect(m.directors).toEqual(["Dir"]);
    expect(m.cast).toHaveLength(8);
    expect(m.imdbId).toBe("tt123");
    expect(m.year).toBe(1999);
  });
  it("throws on HTTP errors", async () => {
    const f = (async () => new Response("", { status: 401 })) as typeof fetch;
    await expect(new TmdbClient("bad", f).search("x")).rejects.toThrow("TMDB 401");
  });
});
