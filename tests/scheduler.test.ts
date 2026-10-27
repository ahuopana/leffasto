import { describe, expect, it, vi } from "vitest";
import { dailyCheck, msUntilNext, startDailyTimer, timePassed } from "../src/services/scheduler";
import type { Notifier } from "../src/services/notifier";
import { emptySuggestionState } from "../src/storage/suggestions";
import { defaultSettings } from "../src/domain/types";
import type { LibraryItem, Movie } from "../src/domain/types";
import { newEntry } from "../src/storage/library";

const movie = (id: number): Movie => ({ tmdbId: id, originalTitle: `M${id}`, titles: {}, overviews: {}, genres: {}, directors: [], cast: [], countries: [] });
const items: LibraryItem[] = [
  { movie: movie(1), entry: { ...newEntry(1), status: "want" } },
  { movie: movie(2), entry: { ...newEntry(2), owned: true, loan: { direction: "lentTo", person: "Maija", since: "2026-02-01", due: "2026-03-01" } } },
];
const fakeNotifier = (granted = true) => {
  const sent: [string, string][] = [];
  const n: Notifier = { isSupported: () => true, ensurePermission: async () => granted, notify: async (t, b) => { sent.push([t, b]); } };
  return { n, sent };
};
const texts = { movieTitle: (i: LibraryItem) => i.movie.originalTitle, pickTitle: "Pick", overdueTitle: "Late", overdueBody: (t: string, p: string) => `${t}/${p}` };
const settings = { ...defaultSettings, notificationsEnabled: true };
const at = (h: number, m = 0) => new Date(2026, 2, 5, h, m);

describe("msUntilNext", () => {
  it("is later today if the time is ahead, otherwise tomorrow", () => {
    expect(msUntilNext("18:00", at(17, 30))).toBe(30 * 60_000);
    expect(msUntilNext("18:00", at(18, 0))).toBe(24 * 3_600_000);
    expect(msUntilNext("18:00", at(19, 0))).toBe(23 * 3_600_000);
  });
  it("timePassed", () => {
    expect(timePassed("18:00", at(17, 59))).toBe(false);
    expect(timePassed("18:00", at(18, 0))).toBe(true);
  });
});

describe("dailyCheck", () => {
  it("sends today's pick once per day and overdue notices once per loan", async () => {
    const { n, sent } = fakeNotifier();
    const s1 = await dailyCheck({ items, settings, state: emptySuggestionState, notifier: n, now: at(18), texts });
    expect(sent).toEqual([["Pick", "M1"], ["Late", "M2/Maija"]]);
    expect(s1.lastNotified).toBe("2026-03-05");
    const s2 = await dailyCheck({ items, settings, state: s1, notifier: n, now: at(18, 5), texts });
    expect(sent).toHaveLength(2); // nothing new the same day
    expect(s2).toEqual(s1);
    await dailyCheck({ items, settings, state: s2, notifier: n, now: new Date(2026, 2, 6, 18), texts });
    expect(sent.filter((x) => x[0] === "Pick")).toHaveLength(2); // next day: new pick, overdue not repeated
    expect(sent.filter((x) => x[0] === "Late")).toHaveLength(1);
  });
  it("does nothing when disabled or permission is denied", async () => {
    const a = fakeNotifier();
    await dailyCheck({ items, settings: { ...settings, notificationsEnabled: false }, state: emptySuggestionState, notifier: a.n, now: at(18), texts });
    const b = fakeNotifier(false);
    await dailyCheck({ items, settings, state: emptySuggestionState, notifier: b.n, now: at(18), texts });
    expect(a.sent).toEqual([]);
    expect(b.sent).toEqual([]);
  });
  it("skips the pick when the suggestion is disabled", async () => {
    const { n, sent } = fakeNotifier();
    await dailyCheck({ items, settings: { ...settings, suggestionEnabled: false }, state: emptySuggestionState, notifier: n, now: at(18), texts });
    expect(sent.map((x) => x[0])).toEqual(["Late"]);
  });
});

describe("startDailyTimer", () => {
  it("fires at the configured time every day and can be stopped", () => {
    vi.useFakeTimers();
    vi.setSystemTime(at(17, 59));
    const run = vi.fn();
    const stop = startDailyTimer(() => "18:00", run);
    vi.advanceTimersByTime(60_000);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 3_600_000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    vi.advanceTimersByTime(48 * 3_600_000);
    expect(run).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
