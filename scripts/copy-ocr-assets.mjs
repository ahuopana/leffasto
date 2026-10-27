// Copies the OCR engine (Tesseract.js worker + WASM core) and Finnish/English language data into public/ocr
// so the app works offline and under the Tauri CSP. Runs after `npm install` and before dev/build.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const out = join(root, "public", "ocr");
mkdirSync(join(out, "lang"), { recursive: true });

const files = [
  [join(nm, "tesseract.js", "dist", "worker.min.js"), join(out, "worker.min.js")],
  ...["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"].map((n) => [
    join(nm, "tesseract.js-core", `${n}.wasm.js`),
    join(out, `${n}.wasm.js`),
  ]),
  [join(nm, "@tesseract.js-data", "fin", "4.0.0_best_int", "fin.traineddata.gz"), join(out, "lang", "fin.traineddata.gz")],
  [join(nm, "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), join(out, "lang", "eng.traineddata.gz")],
];
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.warn(`copy-ocr-assets: missing ${from} (run npm install)`);
    continue;
  }
  cpSync(from, to);
}
console.log(`copy-ocr-assets: ${files.length} files -> public/ocr`);
