import { createContext, useContext } from "react";
import type { Lang, UiLanguage } from "../domain/types";
import { en } from "./en";
import type { MessageKey } from "./en";
import { fi } from "./fi";

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, fi };

export function resolveLanguage(setting: UiLanguage, systemLocale: string): Lang {
  if (setting !== "system") return setting;
  return systemLocale.toLowerCase().startsWith("fi") ? "fi" : "en";
}

export function translate(lang: Lang, key: MessageKey, vars: Record<string, string | number> = {}): string {
  let text = dictionaries[lang][key] ?? en[key];
  for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export type TFunction = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const I18nContext = createContext<{ lang: Lang; t: TFunction }>({
  lang: "en",
  t: (key, vars) => translate("en", key, vars),
});

export const useI18n = () => useContext(I18nContext);
export type { MessageKey };
