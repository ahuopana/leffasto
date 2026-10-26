import type { Settings } from "../domain/types";
import { useI18n } from "../i18n";

export function SettingsView({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const { t } = useI18n();
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
      <label className="field">
        {t("settings.apiKey")}
        <input type="password" value={settings.tmdbApiKey} onChange={(e) => set("tmdbApiKey", e.target.value.trim())} />
        <small className="muted">{t("settings.apiKeyHelp")}</small>
      </label>
      <p className="muted small">{t("attribution")}</p>
    </section>
  );
}
