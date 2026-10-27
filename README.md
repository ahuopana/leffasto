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

Fast add (Add dialog tabs): **Scan barcode** (live camera, prefers the iPhone via Continuity Camera; EAN-13/8, UPC-A decoded on the Mac with zxing; also accepts typed codes and USB scanners) and **Cover photo** (file, drag-and-drop or camera snapshot; text read on-device by Tesseract with bundled Finnish + English data). Scans go to a review queue; confident matches are pre-selected, ambiguous ones ask, unknown barcodes fall back to typing a title. Barcode -> product title uses UPCitemdb's free trial endpoint (about 100 lookups/day, patchy DVD coverage); each confirmed barcode is remembered locally. `node scripts/e2e-scan.cjs` runs the flows end to end in headless Chromium with a stand-in camera.

Statistics: overview tiles, movies by release decade/year (watched vs not), viewings per month/year, rating distribution, leaderboards (best directors/actors/genres/countries by average rating with a minimum number of rated movies, or by count), collection by format/location/runtime. Charts can be viewed as tables, bars drill down to the library, scope is the whole library or the current filters. Viewing dates can be edited in a movie's panel.

Phase 3: loans (lend an owned movie or record a borrowed one, due dates, overdue highlighting, history, "Loaned" sidebar page) and a daily "Tonight's pick" suggestion (want-to-watch list, optionally owned-unwatched; stable per day, no repeats within N days, "Not today" re-rolls) with an optional daily notification while the app is open (Tauri notification plugin; checked by hand on macOS, not in CI). Elonet (phase 2) is deferred until Finna API responses can be inspected.

Phase 1: library grid, flags (owned / want / watched), half-star rating, TMDB search + add, fi/en UI and content language. See the project plan for later phases (Elonet, loans, daily suggestion, scanning, statistics).
