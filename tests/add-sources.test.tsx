// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { fi } from "../src/i18n/fi";
import { I18nContext, translate } from "../src/i18n";
import type { MetadataProvider, SearchResult } from "../src/services/tmdb";
import { AddPanel } from "../src/ui/AddPanel";
import { Detail } from "../src/ui/Detail";
import { defaultSettings } from "../src/domain/types";
import { newEntry } from "../src/storage/library";
import type { Movie } from "../src/domain/types";

afterEach(() => cleanup());
const ctx = (lang: "en" | "fi" = "en") => ({ lang, t: (k: never, v?: Record<string, string | number>) => translate(lang, k, v) });

const results: SearchResult[] = [
  { tmdbId: 11, source: "both", elonetId: "kavi.elonet_elokuva_113528", title: "Tuntematon sotilas", originalTitle: "Tuntematon sotilas", year: 1955 },
  { tmdbId: 12, source: "tmdb", title: "Blade Runner", originalTitle: "Blade Runner", year: 1982 },
  { tmdbId: -107252, source: "elonet", elonetId: "kavi.elonet_elokuva_107252", title: "Varjoja paratiisissa", originalTitle: "Varjoja paratiisissa", year: 1986 },
];
const provider: MetadataProvider = { search: async () => results, details: async () => { throw new Error("n/a"); } };

function open(props: Partial<React.ComponentProps<typeof AddPanel>> = {}, lang: "en" | "fi" = "en") {
  render(
    <I18nContext.Provider value={ctx(lang) as never}>
      <AddPanel provider={provider} demo={false} inLibrary={new Set()} onAdd={async () => undefined} onAddOwned={async () => 0} storage={localStorage} onClose={() => undefined} {...props} />
    </I18nContext.Provider>,
  );
}

describe("search results show their source", () => {
  it("badges TMDB, Elonet and linked results", async () => {
    open();
    fireEvent.change(screen.getByPlaceholderText(en["add.placeholder"]), { target: { value: "x" } });
    fireEvent.submit(screen.getByPlaceholderText(en["add.placeholder"]));
    await screen.findByText("Blade Runner");
    expect(screen.getByText(en["add.source.both"])).toBeTruthy();
    expect(screen.getByText(en["add.source.tmdb"])).toBeTruthy();
    expect(screen.getByText(en["add.source.elonet"])).toBeTruthy();
  });
  it("tells the user when one source is down (en and fi)", () => {
    open({ sourceWarning: "elonet" });
    expect(screen.getByText(en["add.elonetUnavailable"])).toBeTruthy();
    cleanup();
    open({ sourceWarning: "tmdb" }, "fi");
    expect(screen.getByText(fi["add.tmdbUnavailable"])).toBeTruthy();
  });
});

describe("Elonet link in the detail panel", () => {
  const movie: Movie = { tmdbId: 11, originalTitle: "Tuntematon sotilas", titles: {}, overviews: {}, genres: {}, directors: [], cast: [], countries: [], elonetUrl: "https://elonet.finna.fi/Record/kavi.elonet_elokuva_113528" };
  const props = { settings: defaultSettings, locations: [], defaultLocationName: "Home", people: [], today: "2026-03-05", onLend() {}, onBorrow() {}, onReturn() {}, onSetWatchedDates() {}, onUpdate() {}, onSetRating() {}, onMarkWatched() {}, onMarkUnwatched() {}, onRemove() {}, onClose() {} };
  it("links to the Elonet record only when there is one", () => {
    render(<I18nContext.Provider value={ctx() as never}><Detail item={{ movie, entry: newEntry(11) }} {...props} /></I18nContext.Provider>);
    expect(screen.getByText(new RegExp(en["detail.openElonet"])).getAttribute("href")).toBe(movie.elonetUrl);
    cleanup();
    render(<I18nContext.Provider value={ctx() as never}><Detail item={{ movie: { ...movie, elonetUrl: undefined }, entry: newEntry(11) }} {...props} /></I18nContext.Provider>);
    expect(screen.queryByText(new RegExp(en["detail.openElonet"]))).toBeNull();
  });
});
