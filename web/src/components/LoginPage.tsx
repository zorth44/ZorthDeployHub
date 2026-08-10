import { ArrowRight, FolderTree, ShieldCheck, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useT } from "../i18n/useT";
import { LanguageToggle } from "./LanguageToggle";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const message = await login(
      String(form.get("username") ?? ""),
      String(form.get("password") ?? ""),
    );
    if (message) setError(message === "Login failed" ? t("login.failed") : message);
    setPending(false);
  }

  return (
    <div className="relative h-full overflow-y-auto px-4 py-6 sm:px-6 lg:flex lg:items-center lg:py-10">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <LanguageToggle />
      </div>

      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[1.4rem] border border-[var(--color-border)] bg-[var(--color-card)]/78 shadow-[0_32px_100px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:min-h-[650px] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden border-r border-[var(--color-border)] p-12 lg:flex lg:flex-col">
          <div className="absolute -right-20 -top-24 size-80 rounded-full bg-emerald-400/8 blur-3xl" />
          <div className="absolute -bottom-28 -left-16 size-80 rounded-full bg-sky-400/8 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <span className="relative flex size-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-[var(--color-primary)]">
              <SquareTerminal className="size-5" />
              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[var(--color-card)] bg-[var(--color-primary)]" />
            </span>
            <span className="font-mono text-base font-semibold">{t("shell.brand")}</span>
          </div>

          <div className="relative my-auto max-w-xl py-12">
            <p className="eyebrow">{t("login.eyebrow")}</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-[-0.04em] xl:text-[2.75rem]">
              {t("login.title")}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[var(--color-muted-foreground)]">
              {t("login.description")}
            </p>

            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              <Feature icon={SquareTerminal} label={t("login.feature.terminal")} />
              <Feature icon={FolderTree} label={t("login.feature.files")} />
            </div>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
            <ShieldCheck className="size-4 text-[var(--color-primary)]" />
            {t("login.security")}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-20 sm:px-12 lg:px-14 lg:py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <span className="flex size-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-[var(--color-primary)]">
                <SquareTerminal className="size-5" />
              </span>
              <p className="mt-4 font-mono text-sm font-semibold">{t("shell.brand")}</p>
            </div>

            <p className="eyebrow">{t("login.eyebrow")}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{t("login.welcome")}</h2>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{t("login.hint")}</p>

            <form onSubmit={(event) => void handleSubmit(event)} className="mt-8 space-y-5">
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{t("login.username")}</span>
                <input name="username" autoComplete="username" required placeholder="admin" className="field" autoFocus />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{t("login.password")}</span>
                <input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" className="field" />
              </label>
              {error ? (
                <p className="rounded-lg border border-red-400/20 bg-red-400/8 px-3 py-2.5 text-sm text-[var(--color-destructive)]" role="alert">{error}</p>
              ) : null}
              <button type="submit" disabled={pending} className="primary-button w-full py-3">
                {pending ? t("login.submitting") : t("login.submit")}
                {!pending ? <ArrowRight className="size-4" /> : null}
              </button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-2 text-center text-xs text-[var(--color-muted-foreground)] lg:hidden">
              <ShieldCheck className="size-3.5 text-[var(--color-primary)]" />
              {t("login.security")}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof SquareTerminal; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-black/10 px-3.5 py-3 text-sm text-[#b7c3cf]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-primary)]">
        <Icon className="size-4" />
      </span>
      {label}
    </div>
  );
}
