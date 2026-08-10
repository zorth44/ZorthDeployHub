import { useCallback, useEffect, useMemo, useState } from "react";
import { I18nContext, type Vars } from "./context";
import { detectLocale, LOCALE_STORAGE_KEY, type Locale } from "./locales";
import { en, type MessageKey } from "./messages/en";
import { zh } from "./messages/zh";

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, zh };

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const catalog = catalogs[locale];
      return format(catalog[key] ?? en[key] ?? key, vars);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
