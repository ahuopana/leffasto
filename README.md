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
Phase 1.1: rating implies watched; group-by shelves (10 facets: genre, decade, director, country, actor, original language, my rating, status, format, runtime); checkbox filters per facet (uncheck to remove, None + check to add); sortable, virtualised list view. Dev tip: open `http://localhost:1420/?seed=2000` for a synthetic 2000-movie library.

Locations: owned movies can be kept in different places (default "Home", name editable in Settings); new places are added from the movie's edit panel and become selectable for other movies. The location filter/column only appear once more than one place is in use. The left menu collapses to icons while filters are open.

Phase 1: library grid, flags (owned / want / watched), half-star rating, TMDB search + add, fi/en UI and content language. See the project plan for later phases (Elonet, loans, daily suggestion, scanning, statistics).
