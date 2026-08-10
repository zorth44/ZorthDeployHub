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

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const message = await login(
      String(form.get("username") ?? ""),
      String(form.get("password") ?? ""),
    );
    if (message) {
      setError(message === "Login failed" ? t("login.failed") : message);
    }
    setPending(false);
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/95 p-6 shadow-2xl">
        <div className="mb-6 space-y-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {t("shell.brand")}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("login.subtitle")}
          </p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block space-y-2 text-sm">
            <span>{t("login.username")}</span>
            <input
              name="username"
              autoComplete="username"
              required
              placeholder="admin"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 outline-none ring-[var(--color-ring)] focus:ring-2"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>{t("login.password")}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 outline-none ring-[var(--color-ring)] focus:ring-2"
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-60"
          >
            {pending ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
