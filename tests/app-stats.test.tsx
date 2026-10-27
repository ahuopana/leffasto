// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { fi } from "../src/i18n/fi";
import { DEMO_MOVIES } from "../src/services/demo";
import { LibraryStore } from "../src/storage/library";
import { App } from "../src/ui/App";

afterEach(() => { cleanup(); localStorage.clear(); });
const NOW = () => new Date(2026, 2, 5, 12, 0);
const hide = () => localStorage.setItem("leffasto.suggestions.v1", JSON.stringify({ history: [], overdueNotified: [], dismissed: "2026-03-05" }));

function seed() {
  const s = new LibraryStore(localStorage);
  DEMO_MOVIES.forEach((m) => s.add(m));
  s.setRating(2, 9, new Date("2026-02-10T12:00:00Z")); // Kaurismäki
  s.setRating(3, 10, new Date("2026-02-20T12:00:00Z")); // Kaurismäki
  s.setRating(4, 6, new Date("2026-01-05T12:00:00Z"));
  s.update(1, { owned: true, format: "dvd" });
  s.flush();
  hide();
}
const openStats = (locale = "en-US") => {
  const r = render(<App storage={localStorage} systemLocale={locale} now={NOW} />);
  fireEvent.click(screen.getByRole("button", { name: /Statistics|Tilastot/ }));
  return r;
};

describe("Statistics page", () => {
  it("shows overview tiles and the best directors with a minimum of rated movies", () => {
    seed();
    openStats();
    expect(screen.getByText(en["stats.tile.hours"])).toBeTruthy();
    const board = screen.getByRole("list", { name: en["stats.leaders.title"] });
    const rows = within(board).getAllByRole("listitem");
    expect(rows).toHaveLength(1); // only Kaurismäki has 2 rated movies
    expect(rows[0].textContent).toContain("Aki Kaurismäki");
    expect(rows[0].textContent).toContain("★ 4.8"); // (9 + 10) / 2 / 2 = 4.75
    fireEvent.change(screen.getByLabelText(en["stats.leaders.minRated"]), { target: { value: "1" } });
    expect(within(board).getAllByRole("listitem").length).toBeGreaterThan(1);
  });
  it("offers a table view of each chart", () => {
    seed();
    openStats();
    const card = screen.getByRole("heading", { name: en["stats.leaders.title"] }).closest("section")!;
    fireEvent.click(within(card).getByText(en["stats.showTable"]));
    expect(within(card).getByRole("table")).toBeTruthy();
    expect(within(card).getByText("Aki Kaurismäki")).toBeTruthy();
  });
  it("scope switch follows the library filters; clicking a director opens the library filtered to them", () => {
    seed();
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en["nav.owned"]) })); // owned preset: 1 movie
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en["nav.stats"]) }));
    expect(screen.getByText(en["stats.movies"].replace("{count}", String(6)))).toBeTruthy(); // whole library by default
    fireEvent.change(screen.getByLabelText(en["stats.scope"]), { target: { value: "filtered" } });
    expect(screen.getByText(en["stats.movies"].replace("{count}", "1"))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en["stats.scope"]), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText(en["stats.leaders.minRated"]), { target: { value: "2" } });
    fireEvent.click(within(screen.getByRole("list", { name: en["stats.leaders.title"] })).getByText(/Aki Kaurismäki/));
    // back in the library, filtered to that director: filters badge shows 1 active facet, two movies visible
    expect(screen.queryByRole("heading", { name: en["stats.title"] })).toBeNull();
    expect(screen.getAllByText(/Varjoja paratiisissa|Toivon tuolla puolen/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Blade Runner")).toBeNull();
  });
  it("renders in Finnish and shows an empty state for an empty library", () => {
    openStats("fi-FI");
    expect(screen.getByText(fi["stats.empty"])).toBeTruthy();
  });
});

describe("viewing dates in the detail panel", () => {
  it("can add and remove viewing dates", () => {
    seed();
    render(<App storage={localStorage} systemLocale="en-US" now={NOW} />);
    fireEvent.click(screen.getAllByText("Varjoja paratiisissa")[0]);
    const panel = screen.getByLabelText("Varjoja paratiisissa", { selector: "aside" });
    fireEvent.change(within(panel).getByLabelText(en["detail.addDate"]), { target: { value: "2025-12-24" } });
    fireEvent.click(within(panel).getByRole("button", { name: en["detail.addDate"] }));
    expect(within(panel).getByLabelText(en["detail.removeDate"].replace("{date}", "2025-12-24"))).toBeTruthy();
    fireEvent.click(within(panel).getByLabelText(en["detail.removeDate"].replace("{date}", "2025-12-24")));
    expect(within(panel).queryByLabelText(en["detail.removeDate"].replace("{date}", "2025-12-24"))).toBeNull();
  });
});
