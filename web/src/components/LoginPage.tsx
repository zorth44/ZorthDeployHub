import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { user, loading, login } = useAuth();
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
    if (message) setError(message);
    setPending(false);
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/95 p-6 shadow-2xl">
        <div className="mb-6 space-y-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            ZorthDeployHub
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Team SSH access through the browser.
          </p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block space-y-2 text-sm">
            <span>Username</span>
            <input
              name="username"
              autoComplete="username"
              required
              placeholder="admin"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 outline-none ring-[var(--color-ring)] focus:ring-2"
            />
          </label>
          <label className="block space-y-2 text-sm">
            <span>Password</span>
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
            {pending ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
