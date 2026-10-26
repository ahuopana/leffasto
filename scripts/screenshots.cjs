// Drives the Vite dev server in headless Chromium and saves screenshots to ./screenshots.
// Usage: npm run screenshots   (starts its own dev server on :1420)
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const out = path.join(__dirname, "..", "screenshots");
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("dev server did not start");
}

(async () => {
  const server = spawn("npx", ["vite", "--port", "1420", "--strictPort"], { cwd: path.join(__dirname, ".."), stdio: "ignore" });
  try {
    await waitForServer("http://localhost:1420");
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "fi-FI", colorScheme: "light" });
    const page = await ctx.newPage();
    await page.goto("http://localhost:1420");
    const shot = (name) => page.screenshot({ path: path.join(out, name + ".png") });

    await shot("01-empty-fi");

    await page.getByRole("button", { name: /Lisää elokuva/ }).click();
    await page.getByPlaceholder("Hae nimellä…").fill("a");
    await page.keyboard.press("Enter");
    await page.getByText("Tuntematon sotilas").first().waitFor();
    await shot("02-add-dialog-fi");

    for (const _ of DEMO_COUNT()) {
      await page.getByRole("button", { name: "Lisää", exact: true }).first().click();
      await page.getByRole("button", { name: "Lisää elokuva" }).click();
      await page.getByPlaceholder("Hae nimellä…").fill("a");
      await page.keyboard.press("Enter");
      await page.getByText("Kirjastossa").first().waitFor();
    }
    await page.keyboard.press("Escape");
    await page.mouse.click(1200, 780); // close dialog by backdrop
    await page.waitForTimeout(200);
    await shot("03-library-fi");

    await page.locator(".card", { hasText: "Varjoja paratiisissa" }).click();
    await page.getByLabel("Omistan").check();
    await page.getByLabel("Haluan katsoa").check();
    await page.locator(".star").nth(3).locator(".half.right").click();
    await page.locator(".card", { hasText: "Tuntematon sotilas" }).click();
    await page.getByLabel("Katsottu").check();
    await page.getByLabel("Omistan").check();
    await page.locator(".star").nth(4).locator(".half.right").click();
    await page.locator(".card", { hasText: "Varjoja paratiisissa" }).click();
    await shot("04-detail-fi");

    await page.getByRole("button", { name: "Asetukset" }).click();
    await page.locator("select").first().selectOption("en");
    await shot("05-settings-en");
    await page.getByRole("button", { name: /^All movies/ }).click();
    await shot("06-library-en");

    await browser.close();
  } finally {
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });

function DEMO_COUNT() { return [1, 2, 3, 4, 5]; }
