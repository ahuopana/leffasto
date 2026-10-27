/** Opens a link in the user's default browser (inside the Tauri app a plain <a target=_blank> would not). */
export async function openExternal(url: string): Promise<void> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** fetch that goes through the Tauri HTTP plugin inside the app (no browser CORS limits), plain fetch in the browser. */
export async function httpFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(input, init);
  }
  return fetch(input, init);
}
