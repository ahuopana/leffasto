// Drives the Vite dev server in headless Chromium and saves screenshots to ./screenshots.
// Usage: npm run screenshots   (starts its own dev server on :1420)
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const out = path.join(__dirname, "..", "screenshots");
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const URL = "http://localhost:1420";

async function waitForServer(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("dev server did not start");
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = spawn("npx", ["vite", "--port", "1420", "--strictPort"], { cwd: path.join(__dirname, ".."), stdio: "ignore" });
  try {
    await waitForServer(URL);
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 840 }, locale: "fi-FI", colorScheme: "light" });
    const page = await ctx.newPage();
    const shot = (name) => page.screenshot({ path: path.join(out, name + ".png") });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Empty state + add dialog (Finnish UI, demo catalogue)
    await page.goto(URL);
    await shot("01-empty-fi");

    // Rating on an unwatched movie marks it watched
    await page.getByRole("button", { name: /Lisää elokuva/ }).click();
    await page.getByPlaceholder("Hae nimellä…").fill("paratiisissa");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Lisää", exact: true }).click();
    await page.locator(".star").nth(3).locator(".half.right").click();
    await page.waitForTimeout(100);
    await shot("02-rating-marks-watched-fi");

    // Big synthetic library (dev-only ?seed=)
    await page.goto(`${URL}/?seed=2000`);
    await page.waitForSelector(".card");
    await shot("03-grid-2000-fi");

    await page.getByRole("button", { name: /Suodattimet/ }).click();
    await page.locator("select").selectOption("genre");
    await page.waitForSelector(".shelf");
    await shot("04-shelves-by-genre-fi");

    const facet = (name) => page.locator(".facet").filter({ has: page.getByRole("button", { name: new RegExp(`^[▸▾] ${name}`) }) });

    // Filters: uncheck two genres (remove), switch country to None and add two (add)
    await page.locator("select").selectOption("none");
    await facet("Genre").getByLabel(/^Komedia/).uncheck();
    await facet("Genre").getByLabel(/^Kauhu/).uncheck();
    await facet("Maa").getByRole("button", { name: /^▸ Maa/ }).click();
    await facet("Maa").getByRole("button", { name: "Ei mitään" }).click();
    await facet("Maa").getByLabel(/Suomi/).check();
    await facet("Maa").getByLabel(/Yhdysvallat/).check();
    await facet("Sijainti").getByRole("button", { name: /^▸ Sijainti/ }).click();
    await facet("Sijainti").getByLabel(/Office/).uncheck();
    await page.waitForTimeout(200);
    await shot("05-filters-fi");

    // List view, sorted by year, with timing of a sort click
    await page.getByRole("button", { name: /Lista/ }).click();
    await page.locator(".list-head").getByText("Vuosi").click();
    await page.waitForSelector(".list-row:not(.list-head)");
    const t0 = Date.now();
    await page.locator(".list-head").getByText("Ohjaaja").click();
    await page.waitForFunction(() => document.querySelectorAll(".virtual-row").length > 0);
    console.log(`sort click -> rows rendered: ${Date.now() - t0} ms; DOM rows: ${await page.locator(".virtual-row").count()}`);
    await shot("06-list-fi");

    // Location of an owned movie: pick a new place, then it is selectable for others
    await page.getByRole("button", { name: /Suodattimet/ }).click(); // close filters
    await page.getByRole("button", { name: /Ruudukko/ }).click();
    await page.locator(".card").first().click();
    const owned = page.getByLabel("Omistan");
    if (!(await owned.isChecked())) await owned.check();
    await page.getByLabel("Sijainti", { exact: true }).selectOption({ label: "Uusi sijainti…" });
    await page.getByPlaceholder("esim. Kesämökki").fill("Kesämökki");
    await page.getByRole("button", { name: "Lisää", exact: true }).click();
    await page.locator(".card").nth(1).click();
    if (!(await owned.isChecked())) await owned.check();
    await page.getByLabel("Sijainti", { exact: true }).focus();
    await shot("08-location-detail-fi");

    // Loans: fresh state, Loaned page, an overdue loan in the detail panel, and the lend form
    await page.goto(`${URL}/?seed=2000`);
    await page.locator(".sidebar button", { hasText: "Lainassa" }).click();
    await page.getByRole("button", { name: /Lista/ }).click();
    await page.waitForSelector(".list-row:not(.list-head)");
    await shot("09-loaned-list-fi");
    await page.getByRole("button", { name: /Suodattimet/ }).click();
    await page.getByRole("button", { name: /^▸ Tila/ }).click();
    await facet("Tila").getByRole("button", { name: "Ei mitään" }).click();
    await facet("Tila").getByLabel(/Myöhässä oleva laina/).check();
    await page.waitForSelector(".list-row:not(.list-head)");
    await page.locator(".list-row:not(.list-head)").first().click();
    await shot("10-loan-detail-fi");
    await page.getByRole("button", { name: /Suodattimet/ }).click();
    await page.goto(`${URL}/?seed=2000`);
    await page.getByRole("button", { name: /Ruudukko/ }).click();
    await page.locator(".card:has(span[title='Omistan']):not(:has(span[title='Lainassa']))").first().click();
    await page.getByRole("button", { name: "Lainaa henkilölle…" }).click();
    await page.getByPlaceholder("Nimi").fill("Ma");
    await page.locator(".detail").evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await shot("11-loan-form-fi");

    // Statistics (Finnish), then filtered scope and the English UI
    await page.goto(`${URL}/?seed=2000`);
    await page.locator(".sidebar button", { hasText: "Tilastot" }).click();
    await page.waitForSelector(".tile");
    await shot("12-stats-fi");
    await page.locator(".bar-row").first().hover();
    await page.locator(".chart-card", { hasText: "Tulostaulu" }).scrollIntoViewIfNeeded();
    await page.locator(".stats-page").evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await page.waitForTimeout(150);
    await shot("13-stats-leaderboard-fi");
    await page.locator(".chart-card", { hasText: "Tulostaulu" }).getByLabel("Ryhmittely").selectOption("country").catch(() => {});
    await page.locator(".chart-card", { hasText: "Tulostaulu" }).locator("select").first().selectOption("genre");

    // English UI, list grouped by decade, all filters reset
    await page.goto(`${URL}/?seed=2000`);
    await page.getByRole("button", { name: /Asetukset/ }).click();
    await page.locator("select").first().selectOption("en");
    await page.getByRole("button", { name: /^All movies/ }).click();
    await page.locator("select").selectOption("decade");
    await shot("07-list-grouped-by-decade-en");
    await page.locator(".sidebar button", { hasText: "Statistics" }).click();
    await page.waitForSelector(".tile");
    await shot("14-stats-en");

    await browser.close();
    if (errors.length) { console.error("page errors:", errors); process.exitCode = 1; }
  } finally {
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
