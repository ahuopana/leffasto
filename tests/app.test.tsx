// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLanguage, translate } from "../src/i18n";
import { en } from "../src/i18n/en";
import { fi } from "../src/i18n/fi";
import { generateLibrary } from "../src/services/synthetic";
import { App } from "../src/ui/App";

afterEach(() => { cleanup(); localStorage.clear(); });

describe("i18n", () => {
  it("has the same keys in fi and en", () => {
    expect(Object.keys(fi).sort()).toEqual(Object.keys(en).sort());
  });
  it("resolves system language and interpolates", () => {
    expect(resolveLanguage("system", "fi-FI")).toBe("fi");
    expect(resolveLanguage("system", "de-DE")).toBe("en");
    expect(resolveLanguage("en", "fi-FI")).toBe("en");
    expect(translate("fi", "detail.directedBy", { names: "A" })).toBe("Ohjaus: A");
  });
});

describe("App", () => {
  it("adds a movie from demo search, shows it, rates and marks it", async () => {
    render(<App storage={localStorage} systemLocale="en-US" />);
    expect(screen.getByText(en["empty.library"])).toBeTruthy();
    fireEvent.click(screen.getByText(`＋ ${en["add.title"]}`));
    fireEvent.change(screen.getByPlaceholderText(en["add.placeholder"]), { target: { value: "paratiisissa" } });
    fireEvent.submit(screen.getByPlaceholderText(en["add.placeholder"]));
    const addBtn = await screen.findByText(en["add.button"]);
    fireEvent.click(addBtn);
    await waitFor(() => expect(screen.getAllByText("Varjoja paratiisissa").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByLabelText(en["detail.want"]));
    expect((screen.getByLabelText(en["detail.want"]) as HTMLInputElement).checked).toBe(true);
    cleanup(); // unmount flushes the debounced write
    expect(JSON.parse(localStorage.getItem("leffasto.library.v2")!)[0].entry.status).toBe("want");
  });
  it("rating an unwatched movie marks it watched; un-watching a rated movie asks first", async () => {
    render(<App storage={localStorage} systemLocale="en-US" />);
    fireEvent.click(screen.getByText(`＋ ${en["add.title"]}`));
    fireEvent.change(screen.getByPlaceholderText(en["add.placeholder"]), { target: { value: "paratiisissa" } });
    fireEvent.submit(screen.getByPlaceholderText(en["add.placeholder"]));
    fireEvent.click(await screen.findByText(en["add.button"]));
    await waitFor(() => screen.getByLabelText(en["detail.watched"]));
    const watched = screen.getByLabelText(en["detail.watched"]) as HTMLInputElement;
    expect(watched.checked).toBe(false);
    fireEvent.click(screen.getByLabelText("4"));
    expect(watched.checked).toBe(true);
    fireEvent.click(watched);
    expect(screen.getByText(en["detail.unwatchConfirm"])).toBeTruthy();
    expect(watched.checked).toBe(true);
    fireEvent.click(screen.getByText(en["detail.unwatchYes"]));
    expect(watched.checked).toBe(false);
    expect(screen.queryByText(en["detail.clearRating"])).toBeNull();
  });
  it("owned movies get a location; a new place becomes selectable for other movies", async () => {
    render(<App storage={localStorage} systemLocale="en-US" />);
    const addMovie = async (query: string) => {
      fireEvent.click(screen.getByText(`＋ ${en["add.title"]}`));
      fireEvent.change(screen.getByPlaceholderText(en["add.placeholder"]), { target: { value: query } });
      fireEvent.submit(screen.getByPlaceholderText(en["add.placeholder"]));
      fireEvent.click(await screen.findByText(en["add.button"]));
      await waitFor(() => screen.getByLabelText(en["detail.owned"]));
    };
    await addMovie("paratiisissa");
    expect(screen.queryByLabelText(en["detail.location"])).toBeNull(); // hidden until owned
    fireEvent.click(screen.getByLabelText(en["detail.owned"]));
    const select = screen.getByLabelText(en["detail.location"]) as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe(en["location.default"]);
    fireEvent.change(select, { target: { value: "__new__" } });
    fireEvent.change(screen.getByPlaceholderText(en["location.namePlaceholder"]), { target: { value: "Summer cottage" } });
    fireEvent.click(screen.getByText(en["location.add"]));
    expect((screen.getByLabelText(en["detail.location"]) as HTMLSelectElement).value).toBe("Summer cottage");

    await addMovie("sotilas");
    fireEvent.click(screen.getByLabelText(en["detail.owned"]));
    const options = [...(screen.getByLabelText(en["detail.location"]) as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toContain("Summer cottage");
  });
  it("collapses the sidebar while filters are open", () => {
    const { container } = render(<App storage={localStorage} systemLocale="en-US" />);
    expect(container.querySelector(".sidebar.collapsed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en["filter.title"]) }));
    expect(container.querySelector(".sidebar.collapsed")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(en["filter.title"]) }));
    expect(container.querySelector(".sidebar.collapsed")).toBeNull();
  });
  it("list view renders only a window of rows and sorts by column", () => {
    localStorage.setItem("leffasto.library.v2", JSON.stringify(generateLibrary(3000)));
    localStorage.setItem("leffasto.settings.v1", JSON.stringify({ view: "list" }));
    const { container } = render(<App storage={localStorage} systemLocale="en-US" />);
    const rows = container.querySelectorAll(".virtual-row").length;
    expect(rows).toBeGreaterThan(5);
    expect(rows).toBeLessThan(80);
    fireEvent.click(screen.getByText(en["col.year"]));
    const years = [...container.querySelectorAll(".list-row:not(.list-head) .cell.num:nth-child(2)")].map((e) => Number(e.textContent));
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });
  it("renders Finnish UI when system locale is Finnish", () => {
    render(<App storage={localStorage} systemLocale="fi-FI" />);
    expect(screen.getByText(fi["empty.library"])).toBeTruthy();
    expect(screen.getAllByText(fi["nav.want"]).length).toBeGreaterThan(0);
  });
});
