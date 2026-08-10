import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  ShieldCheck,
  SquareTerminal,
  X,
} from "lucide-react";
import { fetchServers, type ServerRecord } from "../lib/api";
import { createId } from "../lib/id";
import { useT } from "../i18n/useT";
import { TerminalPane } from "./TerminalPane";

type Tab = { id: string; serverId: string; title: string };

export function TerminalWorkspace() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    void fetchServers().then(setServers).catch(() => setServers([]));
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    const serverId = searchParams.get("serverId");
    const name = searchParams.get("name");
    if (!serverId) {
      bootstrapped.current = true;
      return;
    }
    const tabId = createId();
    setTabs([{ id: tabId, serverId, title: name || t("terminal.defaultTitle") }]);
    setActiveId(tabId);
    bootstrapped.current = true;
    navigate("/terminal", { replace: true });
  }, [navigate, searchParams, t]);

  useEffect(() => {
    if (!pickerOpen) return;
    setPickerQuery("");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickerOpen]);

  const filteredServers = useMemo(() => {
    const query = pickerQuery.trim().toLocaleLowerCase();
    if (!query) return servers;
    return servers.filter((server) =>
      [server.name, server.host, server.username, server.group?.name ?? "", ...(server.tags ?? []).map((tag) => tag.name)]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [pickerQuery, servers]);

  const addTab = useCallback((server: ServerRecord) => {
    const tabId = createId();
    setTabs((prev) => [...prev, { id: tabId, serverId: server.id, title: server.name }]);
    setActiveId(tabId);
    setPickerOpen(false);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === tabId);
      const next = prev.filter((tab) => tab.id !== tabId);
      setActiveId((current) => {
        if (current !== tabId) return current;
        return next[Math.max(0, index - 1)]?.id ?? null;
      });
      return next;
    });
  }, []);

  const renameTab = useCallback((tabId: string, title: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)));
  }, []);

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 flex flex-col bg-[var(--color-background)]" : "flex h-full min-h-0 flex-col"}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/94 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-[var(--color-primary)]">
            <SquareTerminal className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{t("terminal.workspaceTitle")}</h1>
            <p className="hidden truncate text-[11px] text-[var(--color-muted-foreground)] sm:block">{t("terminal.workspaceSubtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted-foreground)] sm:inline">
            {t("terminal.sessions", { count: tabs.length })}
          </span>
          {fullscreen ? (
            <Link to="/" className="ghost-button hidden sm:inline-flex">
              <ArrowLeft className="size-4" />
              {t("common.backToServers")}
            </Link>
          ) : null}
          <button type="button" className="icon-button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? t("terminal.fullscreenExit") : t("terminal.fullscreenEnter")}>
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--color-border)] bg-[#0d1319] px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div key={tab.id} className={`flex max-w-52 shrink-0 items-center rounded-lg border ${activeId === tab.id ? "border-[var(--color-border-strong)] bg-[var(--color-muted)]/75 text-[var(--color-foreground)]" : "border-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]/40"}`}>
              <button type="button" onClick={() => setActiveId(tab.id)} className="min-w-0 flex-1 truncate py-1.5 pl-3 pr-1 text-left text-xs font-medium">{tab.title}</button>
              <button type="button" onClick={() => closeTab(tab.id)} className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-md opacity-60 hover:bg-[var(--color-background)] hover:opacity-100" aria-label={t("common.close")}>
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button type="button" className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]" onClick={() => setPickerOpen(true)}>
            <Plus className="size-3.5" />
            {t("terminal.new")}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#070b0f]">
        {tabs.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-primary)] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              <SquareTerminal className="size-6" />
            </span>
            <h2 className="mt-5 font-semibold">{t("terminal.empty")}</h2>
            <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted-foreground)]">{t("terminal.emptyHint")}</p>
            <button type="button" onClick={() => setPickerOpen(true)} className="primary-button mt-5">
              <Plus className="size-4" />
              {t("terminal.openServer")}
            </button>
          </div>
        ) : (
          tabs.map((tab) => <TerminalPane key={tab.id} serverId={tab.serverId} active={tab.id === activeId} onTitle={(title) => renameTab(tab.id, title)} />)
        )}
      </div>

      <div className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-card)] px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-[var(--color-primary)]" />{t("terminal.secureChannel")}</span>
        <span>UTF-8 · xterm</span>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPickerOpen(false);
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="terminal-picker-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-float)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <p className="eyebrow">SSH Session</p>
                <h2 id="terminal-picker-title" className="mt-0.5 text-lg font-semibold">{t("terminal.pickerTitle")}</h2>
              </div>
              <button type="button" onClick={() => setPickerOpen(false)} className="icon-button" aria-label={t("common.close")}><X className="size-4" /></button>
            </div>
            <div className="p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
                <input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder={t("terminal.searchPlaceholder")} className="field pl-10" autoFocus />
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {filteredServers.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-[var(--color-muted-foreground)]">{t("terminal.noServers")}</p>
                ) : (
                  filteredServers.map((server) => (
                    <button key={server.id} type="button" onClick={() => addTab(server)} className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] px-3.5 py-3 text-left hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)]/55">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{server.name}</span><span className="mt-1 block truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">{server.username}@{server.host}:{server.port}</span></span>
                      <Plus className="size-4 shrink-0 text-[var(--color-primary)]" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
