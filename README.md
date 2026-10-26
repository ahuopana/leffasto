# Leffasto

Personal movie library for Mac (Tauri + React + TypeScript). Track owned / watched / want-to-watch movies, rate them, and fetch details from TMDB. UI and movie data in Finnish and English.

## Develop
```
npm install
npm run dev          # web UI at http://localhost:1420 (works in any browser)
npm test             # unit + UI tests (vitest)
npm run screenshots  # headless Chromium screenshots to ./screenshots
npm run tauri dev    # native window (needs Rust + Xcode command line tools on macOS)
```
Without a TMDB API key (Settings) the app uses a small offline demo catalogue. Data is stored in the webview's localStorage for now (SQLite planned).

## Status
Phase 1: library grid, flags (owned / want / watched), half-star rating, TMDB search + add, fi/en UI and content language. See the project plan for later phases (Elonet, loans, daily suggestion, scanning, statistics).
