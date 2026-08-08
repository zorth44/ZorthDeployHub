import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function AppShell({
  children,
  fullHeight = false,
}: {
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className={`flex flex-col ${fullHeight ? "h-full" : "min-h-full"}`}>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-4 backdrop-blur">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="font-mono text-sm font-semibold tracking-tight text-[var(--color-foreground)]"
          >
            ZorthDeployHub
          </Link>
          <nav className="flex items-center gap-3 text-sm text-[var(--color-muted-foreground)]">
            <Link to="/" className="hover:text-[var(--color-foreground)]">
              Servers
            </Link>
            <Link to="/terminal" className="hover:text-[var(--color-foreground)]">
              Terminal
            </Link>
            <Link to="/files" className="hover:text-[var(--color-foreground)]">
              Files
            </Link>
          </nav>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-md px-3 py-1.5 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          Logout
        </button>
      </header>
      <main className={fullHeight ? "min-h-0 flex-1" : "mx-auto w-full max-w-5xl flex-1 p-6"}>
        {children}
      </main>
    </div>
  );
}
