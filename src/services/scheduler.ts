import { dateKey, isOverdue } from "../domain/loans";
import { todaysPick } from "../domain/suggestion";
import type { LibraryItem, Settings } from "../domain/types";
import type { SuggestionState } from "../storage/suggestions";
import type { Notifier } from "./notifier";

/** Milliseconds until the next occurrence of "HH:MM" (today if still ahead, otherwise tomorrow). */
export function msUntilNext(time: string, now: Date): number {
  const [h, m] = time.split(":").map(Number);
  const next = new Date(now);
  next.setHours(h || 0, m || 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** True when today's notification time has already passed. */
export function timePassed(time: string, now: Date): boolean {
  const [h, m] = time.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= (h || 0) * 60 + (m || 0);
}

export interface DailyDeps {
  items: LibraryItem[];
  settings: Settings;
  state: SuggestionState;
  notifier: Notifier;
  now: Date;
  /** Localized texts: title of a movie and the notification strings. */
  texts: {
    movieTitle: (item: LibraryItem) => string;
    pickTitle: string;
    overdueTitle: string;
    overdueBody: (title: string, person: string) => string;
  };
}

/**
 * Posts today's suggestion once per day and a notice for each newly overdue loan.
 * Returns the updated state (caller persists it) — unchanged when nothing was sent.
 */
export async function dailyCheck(d: DailyDeps): Promise<SuggestionState> {
  if (!d.settings.notificationsEnabled || !d.notifier.isSupported()) return d.state;
  if (!(await d.notifier.ensurePermission())) return d.state;
  const today = dateKey(d.now);
  let state = d.state;

  if (d.settings.suggestionEnabled && state.lastNotified !== today) {
    const { pick, history } = todaysPick(d.items, state.history, today, d.settings);
    if (pick) await d.notifier.notify(d.texts.pickTitle, d.texts.movieTitle(pick.item));
    state = { ...state, history, lastNotified: today };
  }

  const overdue = d.items.filter((i) => i.entry.loan && isOverdue(i.entry.loan, today));
  const fresh = overdue.filter((i) => !state.overdueNotified.includes(`${i.movie.tmdbId}:${i.entry.loan!.due}`));
  for (const i of fresh.slice(0, 3)) {
    await d.notifier.notify(d.texts.overdueTitle, d.texts.overdueBody(d.texts.movieTitle(i), i.entry.loan!.person));
  }
  if (fresh.length) {
    state = { ...state, overdueNotified: [...state.overdueNotified, ...fresh.map((i) => `${i.movie.tmdbId}:${i.entry.loan!.due}`)] };
  }
  return state;
}

/** Runs `run` every day at the configured time while the app is open. Returns a stop function. */
export function startDailyTimer(getTime: () => string, run: () => void, now: () => Date = () => new Date()): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    timer = setTimeout(() => { run(); arm(); }, msUntilNext(getTime(), now()));
  };
  arm();
  return () => timer !== undefined && clearTimeout(timer);
}
