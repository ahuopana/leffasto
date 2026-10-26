// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLanguage, translate } from "../src/i18n";
import { en } from "../src/i18n/en";
import { fi } from "../src/i18n/fi";
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
    expect(JSON.parse(localStorage.getItem("leffasto.library.v1")!)[0].entry.status).toBe("want");
  });
  it("renders Finnish UI when system locale is Finnish", () => {
    render(<App storage={localStorage} systemLocale="fi-FI" />);
    expect(screen.getByText(fi["empty.library"])).toBeTruthy();
    expect(screen.getAllByText(fi["nav.want"]).length).toBeGreaterThan(0);
  });
});
