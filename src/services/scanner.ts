import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";
import { isValidBarcode, normalizeBarcode } from "../domain/barcode";

export interface RawImage {
  /** RGBA pixels, as in ImageData. */
  data: ArrayLike<number>;
  width: number;
  height: number;
}

const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
  [DecodeHintType.TRY_HARDER, true],
]);

function grey({ data, width, height }: RawImage): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = (data[p] * 306 + data[p + 1] * 601 + data[p + 2] * 117) >> 10;
  return out;
}

/** Rotates a grey image 90° clockwise (zxing's RGB source cannot rotate, and vertical barcodes are common). */
function rotate90(g: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(g.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[x * height + (height - 1 - y)] = g[y * width + x];
  return out;
}

function tryDecode(luminance: Uint8ClampedArray, width: number, height: number): string | null {
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  try {
    const text = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)))).getText();
    return isValidBarcode(text) ? normalizeBarcode(text) : null;
  } catch {
    return null; // NotFoundException etc.: no barcode in this orientation
  }
}

/** Reads one retail barcode (EAN-13/8, UPC-A) from an image; null when there is none or the checksum is wrong. */
export function decodeBarcode(image: RawImage): string | null {
  const g = grey(image);
  const upright = tryDecode(g, image.width, image.height);
  if (upright) return upright;
  return tryDecode(rotate90(g, image.width, image.height), image.height, image.width);
}

export interface Camera {
  deviceId: string;
  label: string;
}

/** Continuity Camera shows up as an ordinary camera whose label names the iPhone; prefer it when present. */
export function pickDefaultCamera(cameras: Camera[]): Camera | undefined {
  return cameras.find((c) => /iphone|ipad|continuity/i.test(c.label)) ?? cameras[0];
}

export async function listCameras(): Promise<Camera[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export function openCamera(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false,
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Grabs the current video frame into a canvas (reused between calls). */
export function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
  if (!video.videoWidth) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Scans video frames until stopped; calls onCode for every valid barcode (the caller de-duplicates). */
export function startScanLoop(video: HTMLVideoElement, onCode: (code: string) => void, intervalMs = 150): () => void {
  const canvas = document.createElement("canvas");
  const timer = setInterval(() => {
    const frame = grabFrame(video, canvas);
    const code = frame && decodeBarcode(frame);
    if (code) onCode(code);
  }, intervalMs);
  return () => clearInterval(timer);
}
