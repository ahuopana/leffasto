import { useCallback, useEffect, useRef, useState } from "react";
import type { BarcodeCache } from "../domain/barcode";
import type { OcrLine } from "../domain/titles";
import type { BarcodeLookup } from "../services/barcode-lookup";
import { resolveBarcode, resolveCover, resolveManual } from "../services/resolve";
import type { ScanItem } from "../services/resolve";
import type { MetadataProvider } from "../services/tmdb";

export interface ScanDeps {
  provider: MetadataProvider;
  cache: BarcodeCache;
  lookup: BarcodeLookup;
  /** Reads text lines from a photo (Tesseract in the app, a fake in tests). */
  ocr: (image: Blob, onProgress: (p: number) => void) => Promise<OcrLine[]>;
}

let counter = 0;

/** The review queue shared by barcode scanning and cover photos: items resolve in the background, the user confirms. */
export function useScanQueue(deps: ScanDeps) {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const alive = useRef(true);
  const depsRef = useRef(deps);
  depsRef.current = deps;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const patch = useCallback((id: string, p: Partial<ScanItem>) => {
    if (alive.current) setItems((all) => all.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }, []);

  // Codes scanned in this session. Kept after "Add" so a disc still in front of the camera is not queued again;
  // removing an item by hand forgets its code so it can be scanned again.
  const seen = useRef(new Set<string>());

  const addBarcode = useCallback((code: string): boolean => {
    if (seen.current.has(code)) return false;
    seen.current.add(code);
    const id = `b${++counter}`;
    setItems((all) => [{ id, source: "barcode", label: code, status: "looking", candidates: [] }, ...all]);
    void resolveBarcode(code, depsRef.current).then((r) => patch(id, r));
    return true;
  }, [patch]);

  const addCover = useCallback((image: Blob, name: string) => {
    const id = `c${++counter}`;
    setItems((all) => [{ id, source: "cover", label: name, status: "looking", candidates: [] }, ...all]);
    setProgress(0);
    depsRef.current.ocr(image, (p) => alive.current && setProgress(p))
      .then((lines) => resolveCover(lines, depsRef.current))
      .then((r) => patch(id, r))
      .catch(() => patch(id, { status: "error", message: "failed", candidates: [] }))
      .finally(() => alive.current && setProgress(null));
  }, [patch]);

  const setManual = useCallback((id: string, title: string) => {
    patch(id, { status: "looking" });
    void resolveManual(title, depsRef.current).then((r) => patch(id, r));
  }, [patch]);

  const choose = useCallback((id: string, tmdbId: number | undefined) => {
    patch(id, { chosen: tmdbId, status: tmdbId === undefined ? "choose" : "matched" });
  }, [patch]);

  const remove = useCallback((id: string) => {
    setItems((all) => {
      const gone = all.find((i) => i.id === id);
      if (gone?.source === "barcode") seen.current.delete(gone.label);
      return all.filter((i) => i.id !== id);
    });
  }, []);
  const removeMany = useCallback((ids: string[]) => setItems((all) => all.filter((i) => !ids.includes(i.id))), []);

  return { items, progress, addBarcode, addCover, setManual, choose, remove, removeMany };
}
