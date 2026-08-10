import { useI18n } from "../i18n/useT";
import type { Locale } from "../i18n/locales";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  function option(code: Locale, label: string) {
    const active = locale === code;
    return (
      <button
        type="button"
        onClick={() => setLocale(code)}
        aria-pressed={active}
        className={`rounded px-2 py-1 text-xs transition-colors ${
          active
            ? "bg-[var(--color-muted)] text-[var(--color-foreground)]"
            : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-[var(--color-border)] p-0.5"
      role="group"
      aria-label={t("common.lang.toggle")}
    >
      {option("zh", t("common.lang.zh"))}
      {option("en", t("common.lang.en"))}
    </div>
  );
}
