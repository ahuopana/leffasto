// End-to-end check of the fast-add flows in headless Chromium with a STAND-IN camera and a rendered cover:
//   1. a <canvas> stream showing a barcode replaces getUserMedia (the sandbox has no capture devices);
//      the real <video> -> frame grab -> zxing decode loop runs, and the remembered barcode resolves the movie
//   2. cover photo with big title text -> Tesseract (bundled fin+eng) reads it -> match found
// Usage: node scripts/e2e-scan.cjs   (starts its own dev server; writes screenshots to ./screenshots)
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
const bwipjs = require("bwip-js");

const root = path.join(__dirname, "..");
const out = path.join(root, "screenshots");
const URL = "http://localhost:1420";
const CODE = "5901234123457"; // resolves to "Blade Runner" through the seeded barcode cache
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

async function waitForServer(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("dev server did not start");
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-scan-"));
  const barcodePng = (await bwipjs.toBuffer({ bcid: "ean13", text: CODE, scale: 4, height: 18, includetext: true, paddingwidth: 20, paddingheight: 20, backgroundcolor: "FFFFFF" })).toString("base64");

  const server = spawn("npx", ["vite", "--port", "1420", "--strictPort"], { cwd: root, stdio: "ignore" });
  let failed = false;
  try {
    await waitForServer(URL);
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: "en-US" });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(([key, value, sug]) => {
      localStorage.setItem(key, value);
      localStorage.setItem("leffasto.suggestions.v1", sug);
    }, ["leffasto.barcodes.v1", JSON.stringify({ [CODE]: 4 }), JSON.stringify({ history: [], overdueNotified: [], dismissed: "2099-01-01" })]);
    // Stand-in camera: a canvas stream of the barcode, exposed as the only "camera".
    await page.addInitScript((png) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      const canvas = document.createElement("canvas");
      canvas.width = 1280; canvas.height = 720;
      const ctx2d = canvas.getContext("2d");
      const draw = () => {
        ctx2d.fillStyle = "#fff"; ctx2d.fillRect(0, 0, 1280, 720);
        if (img.complete) { const k = Math.min(1100 / img.width, 600 / img.height); ctx2d.drawImage(img, (1280 - img.width * k) / 2, (720 - img.height * k) / 2, img.width * k, img.height * k); }
      };
      setInterval(draw, 50);
      const fakeDevice = { kind: "videoinput", deviceId: "fake", label: "Stand-in iPhone Camera", groupId: "g" };
      navigator.mediaDevices.enumerateDevices = async () => [fakeDevice];
      navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(15);
    }, barcodePng);
    await page.goto(URL);

    // 1. Barcode from the (fake) camera
    await page.getByRole("button", { name: /Add a movie/ }).click();
    await page.getByRole("tab", { name: /Scan barcode/ }).click();
    const t0 = Date.now();
    await page.getByText("Blade Runner", { exact: true }).first().waitFor({ timeout: 20000 });
    console.log(`barcode decoded from the camera stream and matched in ${Date.now() - t0} ms`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, "15-scan-barcode.png") });
    await page.getByRole("button", { name: /Add 1 to library as owned/ }).click();
    await page.getByText(/Added 1 movies/).waitFor();

    // 2. Cover photo: render a cover-like image, then read it with OCR
    const cover = await ctx.newPage();
    await cover.setViewportSize({ width: 600, height: 860 });
    await cover.setContent(`<body style="margin:0;background:#12263f;color:#fff;font-family:Helvetica,Arial,sans-serif">
      <div style="padding:30px 40px;font-size:30px;letter-spacing:6px">BLU-RAY</div>
      <div style="margin-top:160px;text-align:center;font-weight:800;font-size:80px;line-height:1.05">TUNTEMATON<br>SOTILAS</div>
      <div style="margin-top:260px;text-align:center;font-size:26px">Ohjaus: Edvin Laine</div></body>`);
    const coverPng = path.join(tmp, "cover.png");
    await cover.screenshot({ path: coverPng });
    await cover.close();

    await page.getByRole("tab", { name: /Cover photo/ }).click();
    const t1 = Date.now();
    await page.getByTestId("cover-file").setInputFiles(coverPng);
    await page.getByText(/Tuntematon sotilas/).first().waitFor({ timeout: 120000 });
    console.log(`cover read by OCR and matched in ${Date.now() - t1} ms`);
    const pick = page.getByRole("button", { name: /Tuntematon sotilas/ });
    if (await pick.count()) await pick.first().click(); // ambiguous match: the user confirms
    await page.screenshot({ path: path.join(out, "16-scan-cover.png") });
    await page.getByRole("button", { name: /Add 1 to library as owned/ }).click();
    await page.getByText(/Added 1 movies/).waitFor();
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
