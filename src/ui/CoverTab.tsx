import { useRef, useState } from "react";
import { useI18n } from "../i18n";
import { grabFrame } from "../services/scanner";
import { useCamera } from "./useCamera";

interface Props {
  onPhoto: (image: Blob, name: string) => void;
  /** 0..1 while text is being read, null otherwise. */
  progress: number | null;
}

/** Add a cover from a file, drag and drop, or a camera snapshot. */
export function CoverTab({ onPhoto, progress }: Props) {
  const { t } = useI18n();
  const [useCam, setUseCam] = useState(false);
  const camera = useCamera(useCam);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function files(list: FileList | null) {
    for (const f of Array.from(list ?? [])) if (f.type.startsWith("image/")) onPhoto(f, f.name);
  }
  function snapshot() {
    const video = camera.videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    if (!grabFrame(video, canvas)) return;
    canvas.toBlob((blob) => blob && onPhoto(blob, `${t("cover.takePhoto")} ${new Date().toLocaleTimeString()}`), "image/jpeg", 0.92);
  }

  return (
    <div className="scan-tab">
      <div
        className={`dropzone ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); files(e.dataTransfer.files); }}
      >
        <p>{t("cover.drop")}</p>
        <div className="inline-form">
          <button className="toggle" onClick={() => fileRef.current?.click()}>{t("cover.choose")}</button>
          <button className="toggle" aria-pressed={useCam} onClick={() => setUseCam(!useCam)}>📷 {t("scan.camera")}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden data-testid="cover-file" onChange={(e) => { files(e.target.files); e.target.value = ""; }} />
      </div>
      {useCam && (
        <div className="camera-box">
          <video ref={camera.videoRef} muted playsInline aria-label={t("scan.camera")} />
          {camera.state === "denied" && <p className="camera-note error">{t("scan.cameraDenied")}</p>}
          {camera.state === "none" && <p className="camera-note">{t("scan.noCamera")}</p>}
          {camera.state === "ready" && <button className="primary snap" onClick={snapshot}>{t("cover.takePhoto")}</button>}
        </div>
      )}
      {progress !== null && (
        <p className="muted" role="status">
          {progress < 0.01 ? t("cover.loadingEngine") : t("cover.reading", { percent: Math.round(progress * 100) })}
        </p>
      )}
    </div>
  );
}
