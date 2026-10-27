// End-to-end check of TMDB + Elonet search/merge in headless Chromium. Network calls are answered from recorded
// fixtures (real Finna responses in tests/fixtures/finna, a hand-written TMDB reply), so it runs offline.
// Usage: node scripts/e2e-elonet.cjs   (starts its own dev server; writes screenshots to ./screenshots)
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const out = path.join(root, "screenshots");
const URL = "http://localhost:1420";
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const fx = (name) => fs.readFileSync(path.join(root, "tests", "fixtures", "finna", `${name}.json`), "utf8");
const json = (body) => ({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: typeof body === "string" ? body : JSON.stringify(body) });

const tmdbDetails = (lang) => ({
  id: 11, title: lang === "fi-FI" ? "Tuntematon sotilas" : "The Unknown Soldier", original_title: "Tuntematon sotilas", original_language: "fi",
  overview: lang === "fi-FI" ? "" : "A classic Finnish war film.", release_date: "1955-12-16", runtime: 180, poster_path: null,
  genres: [{ id: 1, name: lang === "fi-FI" ? "Sota" : "War" }], production_countries: [{ iso_3166_1: "FI" }], external_ids: { imdb_id: "tt0048803" },
  credits: { cast: [{ name: "Reino Tolvanen" }], crew: [{ name: "Edvin Laine", job: "Director" }] },
});

async function waitForServer(url, tries = 100) {
  for (let i = 0; i < tries; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("dev server did not start");
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = spawn("npx", ["vite", "--port", "1420", "--strictPort"], { cwd: root, stdio: "ignore" });
  let failed = false;
  try {
    await waitForServer(URL);
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "fi-FI" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await ctx.route("https://api.themoviedb.org/**", (route) => {
      const u = new globalThis.URL(route.request().url());
      if (u.pathname.endsWith("/search/movie")) {
        return route.fulfill(json({ results: [
          { id: 11, title: "Tuntematon sotilas", original_title: "Tuntematon sotilas", release_date: "1955-12-16", poster_path: null },
          { id: 12, title: "Tuntematon sotilas", original_title: "Unknown Soldier", release_date: "2003-01-01", poster_path: null },
        ] }));
      }
      return route.fulfill(json(tmdbDetails(u.searchParams.get("language"))));
    });
    await ctx.route("https://api.finna.fi/**", (route) => {
      const u = new globalThis.URL(route.request().url());
      if (u.pathname.endsWith("/search")) return route.fulfill(json(fx("search-tuntematon-sotilas")));
      const id = u.searchParams.get("id");
      if (id === "kavi.elonet_elokuva_113528") return route.fulfill(json(fx("record-tuntematon-sotilas-1955")));
      return route.fulfill(json({ resultCount: 0, records: [] }));
    });
    await ctx.route("https://elonet.finna.fi/**", (route) => route.abort());
    await page.addInitScript(() => {
      localStorage.setItem("leffasto.settings.v1", JSON.stringify({ tmdbApiKey: "test-key", contentLanguage: "fi" }));
      localStorage.setItem("leffasto.suggestions.v1", JSON.stringify({ history: [], overdueNotified: [], dismissed: "2099-01-01" }));
    });
    await page.goto(URL);

    await page.getByRole("button", { name: /Lisää elokuva/ }).click();
    await page.getByPlaceholder("Hae nimellä…").fill("tuntematon sotilas");
    await page.keyboard.press("Enter");
    await page.getByText("TMDB + Elonet").first().waitFor({ timeout: 15000 });
    console.log("search results:", (await page.locator(".results li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")).join(" | "));
    await page.screenshot({ path: path.join(out, "17-elonet-search-fi.png") });

    await page.locator(".results li", { hasText: "TMDB + Elonet" }).getByRole("button", { name: "Lisää" }).click();
    await page.locator(".detail").waitFor();
    await page.waitForTimeout(300);
    const text = await page.locator(".detail").innerText();
    for (const expected of ["Tuntematon sotilas", "Edvin Laine", "Kosti Klemelä", "Avaa Elonetissa", "Edvin Laineen ohjaama"]) {
      if (!text.includes(expected)) { console.error(`detail panel is missing "${expected}"`); failed = true; }
    }
    await page.screenshot({ path: path.join(out, "18-elonet-detail-fi.png") });
    await browser.close();
    if (errors.length) { console.error("page errors:", errors); failed = true; }
  } catch (e) {
    console.error(e);
    failed = true;
  } finally {
    server.kill();
  }
  process.exit(failed ? 1 : 0);
})();
