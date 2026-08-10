import {
  LogOut,
  Server,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useT } from "../i18n/useT";
import { LanguageToggle } from "./LanguageToggle";

function Brand() {
  const t = useT();
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3">
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-[var(--color-primary)] shadow-[0_0_24px_rgba(86,217,144,0.08)]">
        <SquareTerminal className="size-[18px]" strokeWidth={1.8} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-[var(--color-card)] bg-[var(--color-primary)]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
          {t("shell.brand")}
        </span>
        <span className="hidden truncate text-[11px] uppercase tracking-[0.14em] text-[var(--color-subtle-foreground)] sm:block lg:block">
          {t("shell.workspace")}
        </span>
      </span>
    </Link>
  );
}

const navigation = [
  { to: "/", key: "shell.nav.servers" as const, icon: Server, end: true },
  {
    to: "/terminal",
    key: "shell.nav.terminal" as const,
    icon: SquareTerminal,
    end: false,
  },
];

function Navigation({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <nav
      aria-label={t("shell.nav.label")}
      className={compact ? "grid grid-cols-2 gap-1" : "space-y-1"}
    >
      {navigation.map(({ to, key, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              "group flex items-center rounded-lg text-sm font-medium",
              compact
                ? "min-h-10 justify-center gap-1.5 px-2"
                : "min-h-11 gap-3 px-3",
              isActive
                ? "bg-emerald-400/10 text-[var(--color-primary)] shadow-[inset_0_0_0_1px_rgba(86,217,144,0.12)]"
                : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]/70 hover:text-[var(--color-foreground)]",
            ].join(" ")
          }
        >
          <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
          <span>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({
  children,
  fullHeight = false,
}: {
  children: React.ReactNode;
  fullHeight?: boolean;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--color-background)]/35">
      <aside className="hidden w-[var(--sidebar-width)] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]/88 p-4 backdrop-blur-xl lg:flex">
        <div className="px-1 py-1">
          <Brand />
        </div>

        <div className="mt-8">
          <p className="mb-2 px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle-foreground)]">
            {t("shell.nav.label")}
          </p>
          <Navigation />
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-black/10 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-foreground)]">
              <ShieldCheck className="size-4 text-[var(--color-primary)]" />
              {t("shell.secure")}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              {t("shell.secureHint")}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="icon-button"
              aria-label={t("common.logout")}
              title={t("common.logout")}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-card)]/92 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Brand />
            <div className="flex shrink-0 items-center gap-2">
              <LanguageToggle />
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label={t("common.logout")}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)]/70 px-3 py-1.5">
            <Navigation compact />
          </div>
        </header>

        <main
          className={
            fullHeight
              ? "min-h-0 flex-1 overflow-hidden"
              : "min-h-0 flex-1 overflow-y-auto"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
