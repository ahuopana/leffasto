/** EAN-13 / EAN-8 / UPC-A check digit validation (GS1 mod-10). */
export function isValidBarcode(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13].includes(code.length)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Weights alternate 3,1,3,... starting from the digit next to the check digit.
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-A (12 digits) is an EAN-13 with a leading zero; store and compare everything as 13 digits. */
export function normalizeBarcode(code: string): string {
  const digits = code.replace(/\D/g, "");
  return digits.length === 12 ? `0${digits}` : digits;
}

export const BARCODE_KEY = "leffasto.barcodes.v1";

/** Remembers which movie a barcode resolved to, so scanning the same disc again is instant (and works offline). */
export class BarcodeCache {
  constructor(private storage: Storage) {}

  private read(): Record<string, number> {
    try {
      return JSON.parse(this.storage.getItem(BARCODE_KEY) ?? "{}") as Record<string, number>;
    } catch {
      return {};
    }
  }

  get(code: string): number | undefined {
    return this.read()[normalizeBarcode(code)];
  }

  set(code: string, tmdbId: number) {
    this.storage.setItem(BARCODE_KEY, JSON.stringify({ ...this.read(), [normalizeBarcode(code)]: tmdbId }));
  }
}
