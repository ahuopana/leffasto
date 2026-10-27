export interface Notifier {
  isSupported(): boolean;
  /** Asks for permission if needed; resolves to whether notifications may be shown. */
  ensurePermission(): Promise<boolean>;
  notify(title: string, body: string): Promise<void>;
}

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Native macOS notifications through the Tauri plugin. */
export class TauriNotifier implements Notifier {
  isSupported() { return true; }
  async ensurePermission() {
    const n = await import("@tauri-apps/plugin-notification");
    if (await n.isPermissionGranted()) return true;
    return (await n.requestPermission()) === "granted";
  }
  async notify(title: string, body: string) {
    const n = await import("@tauri-apps/plugin-notification");
    n.sendNotification({ title, body });
  }
}

/** Browser dev server: use the Web Notification API when available. */
export class WebNotifier implements Notifier {
  isSupported() { return typeof Notification !== "undefined"; }
  async ensurePermission() {
    if (!this.isSupported()) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    return (await Notification.requestPermission()) === "granted";
  }
  async notify(title: string, body: string) {
    if (this.isSupported() && Notification.permission === "granted") new Notification(title, { body });
  }
}

export const createNotifier = (): Notifier => (inTauri() ? new TauriNotifier() : new WebNotifier());
