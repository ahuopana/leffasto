import { useEffect, useRef, useState } from "react";
import { isValidBarcode, normalizeBarcode } from "../domain/barcode";
import { useI18n } from "../i18n";
import { startScanLoop } from "../services/scanner";
import { useCamera } from "./useCamera";

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => void ctx.close(), 200);
  } catch { /* no audio: fine */ }
}

/** Live camera scanning plus a text field (also receives USB barcode scanners, which type digits + Enter). */
export function BarcodeTab({ onCode }: { onCode: (code: string) => boolean }) {
  const { t } = useI18n();
  const camera = useCamera(true);
  const [typed, setTyped] = useState("");
  const [invalid, setInvalid] = useState(false);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    const video = camera.videoRef.current;
    if (camera.state !== "ready" || !video) return;
    return startScanLoop(video, (code) => { if (onCodeRef.current(code)) beep(); });
  }, [camera.state, camera.videoRef]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeBarcode(typed);
    if (!isValidBarcode(code)) return setInvalid(true);
    setInvalid(false);
    onCode(code);
    setTyped("");
  }

  return (
    <div className="scan-tab">
      <div className="camera-box">
        <video ref={camera.videoRef} muted playsInline aria-label={t("scan.camera")} />
        {camera.state === "starting" && <p className="camera-note">{t("scan.cameraStarting")}</p>}
        {camera.state === "denied" && <p className="camera-note error">{t("scan.cameraDenied")}</p>}
        {camera.state === "none" && <p className="camera-note">{t("scan.noCamera")}</p>}
        {camera.state === "ready" && <div className="scan-line" aria-hidden />}
      </div>
      {camera.cameras.length > 1 && (
        <label className="inline">{t("scan.camera")}
          <select value={camera.deviceId} onChange={(e) => void camera.select(e.target.value)}>
            {camera.cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}
          </select>
        </label>
      )}
      <p className="muted small">{t("scan.hint")}</p>
      <form onSubmit={submit}>
        <input
          inputMode="numeric"
          value={typed}
          placeholder={t("scan.manualCode")}
          aria-label={t("scan.manualCode")}
          onChange={(e) => { setTyped(e.target.value); setInvalid(false); }}
        />
        {invalid && <p className="error small">{t("scan.invalidCode")}</p>}
      </form>
    </div>
  );
}
