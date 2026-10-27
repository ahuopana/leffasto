import { useCallback, useEffect, useRef, useState } from "react";
import { listCameras, openCamera, pickDefaultCamera, stopStream } from "../services/scanner";
import type { Camera } from "../services/scanner";

export type CameraState = "idle" | "starting" | "ready" | "denied" | "none";

/** Opens a camera into a <video>; prefers the iPhone (Continuity Camera) when available. */
export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();

  const start = useCallback(async (id?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) return setState("none");
    setState("starting");
    stopStream(streamRef.current);
    try {
      let stream = await openCamera(id);
      // Labels are only available after permission; if a better camera (the iPhone) exists, switch to it once.
      const list = await listCameras();
      setCameras(list);
      const wanted = id ?? pickDefaultCamera(list)?.deviceId;
      const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (wanted && wanted !== current) {
        stopStream(stream);
        stream = await openCamera(wanted);
      }
      streamRef.current = stream;
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? wanted);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState("ready");
    } catch (e) {
      setState(e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "none");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void start();
    return () => { stopStream(streamRef.current); streamRef.current = null; setState("idle"); };
  }, [enabled, start]);

  return { videoRef, state, cameras, deviceId, select: start };
}
