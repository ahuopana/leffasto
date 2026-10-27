/** fetch that goes through the Tauri HTTP plugin inside the app (no browser CORS limits), plain fetch in the browser. */
export async function httpFetch(input: string, init?: RequestInit): Promise<Response> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(input, init);
  }
  return fetch(input, init);
}
