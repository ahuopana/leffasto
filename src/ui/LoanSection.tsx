import { useState } from "react";
import { dateKey, overdueDays } from "../domain/loans";
import type { LibraryItem, LoanDirection } from "../domain/types";
import { useI18n } from "../i18n";

interface Props {
  item: LibraryItem;
  people: string[];
  today: string;
  onLend: (person: string, opts: { since?: string; due?: string; note?: string }) => void;
  onBorrow: (person: string, opts: { since?: string; due?: string; note?: string }) => void;
  onReturn: () => void;
}

const fmt = (d: string, lang: string) => new Date(`${d}T12:00:00`).toLocaleDateString(lang);

export function LoanSection({ item, people, today, onLend, onBorrow, onReturn }: Props) {
  const { t, lang } = useI18n();
  const { entry } = item;
  const [form, setForm] = useState<LoanDirection | null>(null);
  const [person, setPerson] = useState("");
  const [since, setSince] = useState(today);
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const opts = { since: since || today, due: due || undefined, note: note || undefined };
    (form === "lentTo" ? onLend : onBorrow)(person, opts);
    setForm(null); setPerson(""); setDue(""); setNote(""); setSince(dateKey(new Date()));
  }

  const loan = entry.loan;
  const late = loan ? overdueDays(loan, today) : 0;
  return (
    <section className="loan" aria-label={t("loan.title")}>
      <h3>{t("loan.title")}</h3>
      {loan ? (
        <>
          <p className={late ? "overdue" : ""}>
            🤝 {t(loan.direction === "lentTo" ? "loan.lentTo" : "loan.borrowedFrom", { person: loan.person, since: fmt(loan.since, lang) })}
            {loan.due && <> · {t("loan.dueOn", { due: fmt(loan.due, lang) })}</>}
            {late > 0 && <strong> · {t("loan.overdue", { days: late })}</strong>}
          </p>
          {loan.note && <p className="muted small">{loan.note}</p>}
          <button className="primary" onClick={onReturn}>{t("loan.markReturned")}</button>
        </>
      ) : form ? (
        <form className="loan-form" onSubmit={submit}>
          <label className="field">
            {t("loan.person")}
            <input list="loan-people" autoFocus required value={person} placeholder={t("loan.personPlaceholder")} onChange={(e) => setPerson(e.target.value)} />
            <datalist id="loan-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
          <label className="field">{t("loan.since")}<input type="date" value={since} onChange={(e) => setSince(e.target.value)} /></label>
          <label className="field">{t("loan.due")}<input type="date" value={due} min={since} onChange={(e) => setDue(e.target.value)} /></label>
          <label className="field">{t("loan.note")}<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="inline-form">
            <button className="primary" type="submit">{t("loan.save")}</button>
            <button className="link" type="button" onClick={() => setForm(null)}>{t("detail.cancel")}</button>
          </div>
        </form>
      ) : (
        <div className="inline-form">
          <button className="toggle" disabled={!entry.owned} title={entry.owned ? "" : t("loan.mustOwn")} onClick={() => setForm("lentTo")}>{t("loan.lend")}</button>
          <button className="toggle" onClick={() => setForm("borrowedFrom")}>{t("loan.borrow")}</button>
        </div>
      )}
      {!loan && !entry.owned && !form && <p className="muted small">{t("loan.mustOwn")}</p>}
      {(entry.loanHistory?.length ?? 0) > 0 && (
        <details className="loan-history">
          <summary>{t("loan.history")}</summary>
          <ul>
            {[...entry.loanHistory!].reverse().map((r, i) => (
              <li key={i} className="small muted">
                {t("loan.historyRow", {
                  direction: t(r.direction === "lentTo" ? "loan.dir.lentTo" : "loan.dir.borrowedFrom"),
                  person: r.person, since: fmt(r.since, lang), returned: fmt(r.returned, lang),
                })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
