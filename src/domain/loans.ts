import type { Loan, LoanRecord } from "./types";

/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the user's clock). */
export function dateKey(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole days from a to b (both YYYY-MM-DD); positive when b is later. */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000);
}

/** Days past the due date (0 when not overdue or no due date). */
export function overdueDays(loan: Pick<Loan, "due">, today: string): number {
  return loan.due ? Math.max(0, daysBetween(loan.due, today)) : 0;
}

export const isOverdue = (loan: Pick<Loan, "due">, today: string) => overdueDays(loan, today) > 0;

export function toRecord(loan: Loan, returned: string): LoanRecord {
  return { ...loan, returned };
}
