import { useState } from "react";
import type { Settings } from "../domain/types";
import type { Notifier } from "../services/notifier";
import { useI18n } from "../i18n";

export function SettingsView({ settings, notifier, onChange }: { settings: Settings; notifier: Notifier; onChange: (s: Settings) => void }) {
  const { t } = useI18n();
  const [denied, setDenied] = useState(false);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  return (
    <section className="settings">
      <h2>{t("settings.title")}</h2>
      <label className="field">
        {t("settings.uiLanguage")}
        <select value={settings.uiLanguage} onChange={(e) => set("uiLanguage", e.target.value as Settings["uiLanguage"])}>
          <option value="system">{t("lang.system")}</option>
          <option value="fi">{t("lang.fi")}</option>
          <option value="en">{t("lang.en")}</option>
        </select>
      </label>
      <label className="field">
        {t("settings.contentLanguage")}
        <select value={settings.contentLanguage} onChange={(e) => set("contentLanguage", e.target.value as Settings["contentLanguage"])}>
          <option value="fi">{t("lang.fi")}</option>
          <option value="en">{t("lang.en")}</option>
        </select>
      </label>
      <label className="field">
        {t("settings.titleDisplay")}
        <select value={settings.titleDisplay} onChange={(e) => set("titleDisplay", e.target.value as Settings["titleDisplay"])}>
          <option value="localized">{t("settings.titleLocalized")}</option>
          <option value="original">{t("settings.titleOriginal")}</option>
        </select>
      </label>
      <label className="field">
        {t("settings.defaultLocation")}
        <input value={settings.defaultLocationName} placeholder={t("location.default")} onChange={(e) => set("defaultLocationName", e.target.value)} />
        <small className="muted">{t("settings.defaultLocationHelp")}</small>
      </label>
      <h3>{t("settings.suggestion")}</h3>
      <label className="check"><input type="checkbox" checked={settings.suggestionEnabled} onChange={(e) => set("suggestionEnabled", e.target.checked)} /> {t("settings.suggestionEnabled")}</label>
      <label className="check"><input type="checkbox" checked={settings.suggestOwnedUnwatched} onChange={(e) => set("suggestOwnedUnwatched", e.target.checked)} /> {t("settings.ownedUnwatched")}</label>
      <label className="field">
        {t("settings.avoidRepeat")}
        <input type="number" min={0} max={365} value={settings.avoidRepeatDays} onChange={(e) => set("avoidRepeatDays", Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.notificationsEnabled}
          disabled={!notifier.isSupported()}
          onChange={async (e) => {
            if (!e.target.checked) return set("notificationsEnabled", false);
            const ok = await notifier.ensurePermission();
            setDenied(!ok);
            set("notificationsEnabled", ok);
          }}
        /> {t("settings.notifications")}
      </label>
      {denied && <p className="error small">{t("settings.notifDenied")}</p>}
      <label className="field">
        {t("settings.suggestionTime")}
        <input type="time" value={settings.suggestionTime} onChange={(e) => set("suggestionTime", e.target.value || "18:00")} />
      </label>
      <label className="field">
        {t("settings.apiKey")}
        <input type="password" value={settings.tmdbApiKey} onChange={(e) => set("tmdbApiKey", e.target.value.trim())} />
        <small className="muted">{t("settings.apiKeyHelp")}</small>
      </label>
      <p className="muted small">{t("attribution")}</p>
    </section>
  );
}
