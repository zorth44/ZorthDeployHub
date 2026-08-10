import { createContext } from "react";
import type { Locale } from "./locales";
import type { MessageKey } from "./messages/en";

export type Vars = Record<string, string | number>;

export type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);
