import type { OcrLine } from "../domain/titles";

type Worker = import("tesseract.js").Worker;
let worker: Promise<Worker> | null = null;

/** The OCR engine and Finnish + English language data are bundled under /ocr (see scripts/copy-ocr-assets.mjs). */
function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  worker ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker(["fin", "eng"], 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
    }),
  );
  return worker;
}

/** Reads text lines (with size and confidence) from a cover photo. */
export async function recognizeCover(image: Blob | HTMLCanvasElement | string, onProgress?: (p: number) => void): Promise<OcrLine[]> {
  const w = await getWorker(onProgress);
  const { data } = await w.recognize(image, {}, { blocks: true });
  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const l of para.lines) {
        lines.push({ text: l.text, confidence: l.confidence, height: l.bbox.y1 - l.bbox.y0, top: l.bbox.y0 });
      }
    }
  }
  return lines;
}

export async function terminateOcr() {
  const w = await worker;
  worker = null;
  await w?.terminate();
}
