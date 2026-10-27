// Live contract check against the real Finna API. Skipped unless LIVE=1 (needs network): LIVE=1 npx vitest run tests/live
import { describe, expect, it } from "vitest";
import { ElonetClient } from "../../src/services/elonet";

const live = process.env.LIVE === "1";

describe.skipIf(!live)("Finna / Elonet (live)", () => {
  const client = new ElonetClient((url) => fetch(url), { timeoutMs: 20_000 });

  it("finds Tuntematon sotilas (1955) and reads the full record", async () => {
    const hits = await client.search("Tuntematon sotilas");
    const hit = hits.find((h) => h.year === 1955);
    expect(hit, "1955 film in results").toBeDefined();
    expect(hit!.englishTitle).toBe("The Unknown Soldier");
    const rec = await client.record(hit!.elonetId);
    expect(rec).toMatchObject({ title: "Tuntematon sotilas", year: 1955, directors: ["Edvin Laine"], kind: "feature" });
    expect(rec!.genres).toContain("Draama");
    expect(rec!.cast.length).toBeGreaterThan(3);
    expect(rec!.summary).toBeTruthy();
    expect(rec!.imageUrl).toMatch(/^https:\/\/elonet\.finna\.fi\/Cover\/Show/);
  });
  it("finds a film through its English title", async () => {
    const hits = await client.search("The Other Side of Hope");
    expect(hits.some((h) => h.title === "Toivon tuolla puolen" && h.year === 2017)).toBe(true);
  });
  it("does not contain foreign films (TMDB's job)", async () => {
    expect(await client.search("Blade Runner")).toEqual([]);
  });
});
