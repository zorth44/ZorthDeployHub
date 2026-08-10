export type Locale = "zh" | "en";

export const LOCALE_STORAGE_KEY = "zorth-locale";

export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    // ignore
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }
  return "en";
}
