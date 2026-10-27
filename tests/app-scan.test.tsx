// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import type { BarcodeLookup } from "../src/services/barcode-lookup";
import { App } from "../src/ui/App";
import { LibraryStore } from "../src/storage/library";

afterEach(() => { cleanup(); localStorage.clear(); });
const NOW = () => new Date(2026, 2, 5, 12, 0);
const lookupOf = (title: string | null): BarcodeLookup => ({ lookup: async () => title });
const line = (text: string, height: number, top: number) => ({ text, height, top, confidence: 90 });

function openTab(tab: RegExp, props: Partial<React.ComponentProps<typeof App>> = {}) {
  localStorage.setItem("leffasto.suggestions.v1", JSON.stringify({ history: [], overdueNotified: [], dismissed: "2026-03-05" }));
  render(<App storage={localStorage} systemLocale="en-US" now={NOW} {...props} />);
  fireEvent.click(screen.getByText(`＋ ${en["add.title"]}`));
  fireEvent.click(screen.getByRole("tab", { name: tab }));
}
const library = () => new LibraryStore(localStorage).list();

describe("barcode tab", () => {
  it("a typed barcode resolves to a movie and is added as owned with the chosen format, and remembered", async () => {
    openTab(/Scan barcode/, { lookup: lookupOf("Blade Runner [Blu-ray] Region B") });
    expect(screen.getByText(en["scan.noCamera"])).toBeTruthy(); // jsdom has no camera
    fireEvent.change(screen.getByLabelText(en["scan.manualCode"]), { target: { value: "5901234123457" } });
    fireEvent.submit(screen.getByLabelText(en["scan.manualCode"]));
    await screen.findByText("Blade Runner", { selector: "strong" });
    fireEvent.change(screen.getByLabelText(en["scan.format"]), { target: { value: "bluray" } });
    fireEvent.click(screen.getByRole("button", { name: /Add 1 to library as owned/ }));
    await screen.findByText(en["scan.addedCount"].replace("{count}", "1"));
    cleanup(); // unmount flushes the debounced save
    const [item] = library();
    expect(item.movie.originalTitle).toBe("Blade Runner");
    expect(item.entry).toMatchObject({ owned: true, format: "bluray" });
    expect(JSON.parse(localStorage.getItem("leffasto.barcodes.v1")!)).toEqual({ "5901234123457": 4 });
  });
  it("rejects an invalid check digit and ignores a repeated barcode", async () => {
    openTab(/Scan barcode/, { lookup: lookupOf("Blade Runner") });
    const input = screen.getByLabelText(en["scan.manualCode"]);
    fireEvent.change(input, { target: { value: "5901234123458" } });
    fireEvent.submit(input);
    expect(screen.getByText(en["scan.invalidCode"])).toBeTruthy();
    for (let i = 0; i < 2; i++) { fireEvent.change(input, { target: { value: "5901234123457" } }); fireEvent.submit(input); }
    await screen.findByText("Blade Runner", { selector: "strong" });
    expect(screen.getByRole("region", { name: /Scanned \(1\)/ })).toBeTruthy();
  });
  it("does not queue a barcode again after it was added (disc still in front of the camera)", async () => {
    openTab(/Scan barcode/, { lookup: lookupOf("Blade Runner") });
    const input = screen.getByLabelText(en["scan.manualCode"]);
    fireEvent.change(input, { target: { value: "5901234123457" } });
    fireEvent.submit(input);
    fireEvent.click(await screen.findByRole("button", { name: /Add 1 to library as owned/ }));
    await screen.findByText(en["scan.addedCount"].replace("{count}", "1"));
    fireEvent.change(input, { target: { value: "5901234123457" } });
    fireEvent.submit(input);
    expect(screen.getByRole("region", { name: /Scanned \(0\)/ })).toBeTruthy();
  });
  it("removing a scanned item by hand allows scanning it again", async () => {
    openTab(/Scan barcode/, { lookup: lookupOf("Blade Runner") });
    const input = screen.getByLabelText(en["scan.manualCode"]);
    fireEvent.change(input, { target: { value: "5901234123457" } });
    fireEvent.submit(input);
    await screen.findByText("Blade Runner", { selector: "strong" });
    fireEvent.click(screen.getByLabelText(en["scan.remove"]));
    fireEvent.change(input, { target: { value: "5901234123457" } });
    fireEvent.submit(input);
    expect(screen.getByRole("region", { name: /Scanned \(1\)/ })).toBeTruthy();
  });
  it("asks for a title when the barcode is unknown, then lets the user pick", async () => {
    openTab(/Scan barcode/, { lookup: lookupOf(null) });
    fireEvent.change(screen.getByLabelText(en["scan.manualCode"]), { target: { value: "5901234123457" } });
    fireEvent.submit(screen.getByLabelText(en["scan.manualCode"]));
    await screen.findByText(en["scan.notFound"]);
    fireEvent.change(screen.getByPlaceholderText(en["scan.titlePlaceholder"]), { target: { value: "paratiisissa" } });
    fireEvent.click(screen.getByText(en["scan.search"]));
    const pick = await screen.findByRole("button", { name: /Varjoja paratiisissa/ });
    fireEvent.click(pick);
    fireEvent.click(await screen.findByRole("button", { name: /Add 1 to library as owned/ }));
    await waitFor(() => expect(library()[0]?.entry.owned).toBe(true));
    expect(library()[0].movie.tmdbId).toBe(2);
  });
});

describe("cover tab", () => {
  it("reads a cover photo with OCR and adds the match", async () => {
    openTab(/Cover photo/, {
      ocr: async (_img, onProgress) => { onProgress(1); return [line("BLU-RAY", 20, 5), line("BLADE RUNNER", 150, 120), line("Ohjaus: Ridley Scott", 24, 520)]; },
    });
    const file = new File([new Uint8Array([1, 2, 3])], "cover.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("cover-file"), { target: { files: [file] } });
    await screen.findByText("Blade Runner", { selector: "strong" });
    expect(screen.getByText("cover.jpg", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Add 1 to library as owned/ }));
    await waitFor(() => expect(library()).toHaveLength(1));
    expect(library()[0].entry.owned).toBe(true);
  });
  it("lets the user skip a match and shows a text prompt when OCR reads nothing", async () => {
    openTab(/Cover photo/, { ocr: async () => [] });
    fireEvent.change(screen.getByTestId("cover-file"), { target: { files: [new File([new Uint8Array([1])], "x.png", { type: "image/png" })] } });
    await screen.findByText(en["scan.noText"]);
    const row = screen.getByText(en["scan.noText"]).closest("li")!;
    expect(within(row).getByPlaceholderText(en["scan.titlePlaceholder"])).toBeTruthy();
  });
});
