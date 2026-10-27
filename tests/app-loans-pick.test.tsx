// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "../src/i18n/en";
import { DEMO_MOVIES } from "../src/services/demo";
import type { Notifier } from "../src/services/notifier";
import { LibraryStore } from "../src/storage/library";
import { App } from "../src/ui/App";

afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

const NOW = () => new Date(2026, 2, 5, 12, 0);
const seed = (fn: (s: LibraryStore) => void) => { const s = new LibraryStore(localStorage); DEMO_MOVIES.slice(0, 4).forEach((m) => s.add(m)); fn(s); s.flush(); };

describe("loans in the UI", () => {
  it("lend, see it, find it under Loaned, mark returned", () => {
    seed((s) => s.update(2, { owned: true }));
    localStorage.setItem("leffasto.suggestions.v1", JSON.stringify({ history: [], overdueNotified: [], dismissed: "2026-03-05" }));
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    fireEvent.click(screen.getAllByText("Varjoja paratiisissa")[0]);
    const panel = screen.getByLabelText("Varjoja paratiisissa", { selector: "aside" });
    fireEvent.click(within(panel).getByText(en["loan.lend"]));
    fireEvent.change(within(panel).getByPlaceholderText(en["loan.personPlaceholder"]), { target: { value: "Maija" } });
    fireEvent.change(within(panel).getByLabelText(en["loan.since"]), { target: { value: "2026-02-20" } });
    fireEvent.change(within(panel).getByLabelText(en["loan.due"]), { target: { value: "2026-03-01" } });
    fireEvent.click(within(panel).getByText(en["loan.save"]));
    expect(within(panel).getByText(/Lent to Maija since/)).toBeTruthy();
    expect(within(panel).getByText(/overdue/)).toBeTruthy(); // due 1.3. vs today 5.3.
    expect(screen.getByRole("button", { name: new RegExp(`${en["nav.loaned"]}\\s*1`) })).toBeTruthy();
    fireEvent.click(within(panel).getByText(en["loan.markReturned"]));
    expect(within(panel).queryByText(/Lent to Maija since/)).toBeNull(); // active loan line is gone
    expect(within(panel).queryByText(en["loan.markReturned"])).toBeNull();
    expect(within(panel).getByText(en["loan.history"])).toBeTruthy();
  });
  it("lending is disabled until the movie is owned", () => {
    seed(() => {});
    localStorage.setItem("leffasto.suggestions.v1", JSON.stringify({ history: [], overdueNotified: [], dismissed: "2026-03-05" }));
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    fireEvent.click(screen.getAllByText("Varjoja paratiisissa")[0]);
    expect((screen.getByText(en["loan.lend"]) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText(en["loan.borrow"]) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Tonight's pick", () => {
  const wantAll = () => seed((s) => [1, 2, 3, 4].forEach((id) => s.update(id, { status: "want" })));
  const pickTitle = () => within(screen.getByLabelText(en["pick.title"])).getByRole("heading").textContent!.replace(/\s*\(\d+\)$/, "");

  it("shows a stable pick, re-rolls on Not today, and can be hidden for the day", () => {
    wantAll();
    const { unmount } = render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    const first = pickTitle();
    unmount();
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    expect(pickTitle()).toBe(first); // same after "restart"
    fireEvent.click(screen.getByText(en["pick.notToday"]));
    expect(pickTitle()).not.toBe(first);
    fireEvent.click(screen.getByLabelText(en["pick.dismiss"]));
    expect(screen.queryByLabelText(en["pick.title"])).toBeNull();
    cleanup();
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    expect(screen.queryByLabelText(en["pick.title"])).toBeNull(); // stays hidden today
    render(<App storage={localStorage} systemLocale="en-US" now={() => new Date(2026, 2, 6, 9)} />);
    expect(screen.getByLabelText(en["pick.title"])).toBeTruthy(); // back tomorrow
  });
  it("Not interested removes it from the want list; Watch now marks it watched", () => {
    wantAll();
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    const first = pickTitle();
    fireEvent.click(screen.getByText(en["pick.notInterested"]));
    expect(pickTitle()).not.toBe(first);
    const second = pickTitle();
    fireEvent.click(screen.getByText(en["pick.watchNow"]));
    const stored = new LibraryStore(localStorage);
    stored.flush();
    expect(screen.getByLabelText(second, { selector: "aside" })).toBeTruthy(); // detail opens for rating
    expect((screen.getByLabelText(en["detail.watched"]) as HTMLInputElement).checked).toBe(true);
  });
  it("is hidden when disabled, filtered, or nothing qualifies", () => {
    seed(() => {});
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    expect(screen.queryByLabelText(en["pick.title"])).toBeNull();
  });
});

describe("notifications", () => {
  it("sends the daily pick when the time has passed on launch and the setting is on", async () => {
    seed((s) => s.update(1, { status: "want" }));
    const sent: string[] = [];
    const notifier: Notifier = { isSupported: () => true, ensurePermission: async () => true, notify: async (t, b) => { sent.push(`${t}|${b}`); } };
    localStorage.setItem("leffasto.settings.v1", JSON.stringify({ notificationsEnabled: true, suggestionTime: "09:00" }));
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} notifier={notifier} />);
    await waitFor(() => expect(sent).toEqual([`${en["notify.pickTitle"]}|Tuntematon sotilas`]));
    expect(JSON.parse(localStorage.getItem("leffasto.suggestions.v1")!).lastNotified).toBe("2026-03-05");
  });
});
