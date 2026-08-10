import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CornerDownLeft,
  FolderTree,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Server,
  ShieldCheck,
  SquareTerminal,
  X,
} from "lucide-react";
import { fetchServers, type ServerRecord } from "../lib/api";
import { createId } from "../lib/id";
import { useT } from "../i18n/useT";
import { RemoteFilesSidebar } from "./RemoteFilesSidebar";
import { TerminalPane } from "./TerminalPane";

type Tab = { id: string; serverId: string; title: string };

export function TerminalWorkspace({ visible = true }: { visible?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [filesOpen, setFilesOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const consumedRequest = useRef<string | null>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const pickerListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    void fetchServers().then(setServers).catch(() => setServers([]));
  }, [visible]);

  useEffect(() => {
    // Let the workspace normalize the legacy /files route first. Consuming its
    // query here as well would create the same terminal twice.
    if (location.pathname === "/files") return;
    const serverId = searchParams.get("serverId");
    const name = searchParams.get("name");
    if (!serverId) {
      consumedRequest.current = null;
      return;
    }
    const requestKey = searchParams.toString();
    if (consumedRequest.current === requestKey) return;
    consumedRequest.current = requestKey;
    const tabId = createId();
    setTabs((prev) => [...prev, { id: tabId, serverId, title: name || t("terminal.defaultTitle") }]);
    setActiveId(tabId);
    if (searchParams.get("files") === "1") setFilesOpen(true);
    navigate("/terminal", { replace: true });
  }, [location.pathname, navigate, searchParams, t]);

  useEffect(() => {
    if (!pickerOpen) return;
    setPickerQuery("");
    setHighlightedIndex(0);
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

  useEffect(() => {
    setHighlightedIndex((current) => Math.min(current, Math.max(0, filteredServers.length - 1)));
  }, [filteredServers.length]);

  useEffect(() => {
    pickerListRef.current
      ?.querySelector<HTMLElement>("[data-highlighted='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

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

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? null;
  const activeServer = servers.find((server) => server.id === activeTab?.serverId) ?? null;

  function handlePickerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(0, filteredServers.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter" && filteredServers[highlightedIndex]) {
      event.preventDefault();
      addTab(filteredServers[highlightedIndex]);
    }
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 flex flex-col bg-[var(--color-background)]" : "flex h-full min-h-0 flex-col"}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/94 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-[var(--color-primary)]">
            <SquareTerminal className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{t("terminal.workspaceTitle")}</h1>
            <p className="hidden truncate text-xs text-[var(--color-muted-foreground)] sm:block">{t("terminal.workspaceSubtitle")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-muted-foreground)] sm:inline">
            {t("terminal.sessions", { count: tabs.length })}
          </span>
          <button
            type="button"
            className={`secondary-button min-h-9 px-2.5 text-xs ${filesOpen ? "border-emerald-300/30 bg-emerald-400/10 text-[var(--color-primary)]" : ""}`}
            onClick={() => setFilesOpen((value) => !value)}
            aria-pressed={filesOpen}
            title={t("files.toggleSidebar")}
          >
            <FolderTree className="size-4" />
            <span className="hidden sm:inline">{t("files.title")}</span>
          </button>
          {fullscreen ? (
            <Link to="/" onClick={() => setFullscreen(false)} className="ghost-button hidden sm:inline-flex">
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

      <div className="relative flex min-h-0 flex-1 bg-[#070b0f]">
        <div className="relative min-w-0 flex-1">
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
            tabs.map((tab) => <TerminalPane key={tab.id} serverId={tab.serverId} active={visible && tab.id === activeId} onTitle={(title) => renameTab(tab.id, title)} />)
          )}
        </div>
        {filesOpen ? <RemoteFilesSidebar server={activeServer} onClose={() => setFilesOpen(false)} /> : null}
      </div>

      <div className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-card)] px-3 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
        <span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-[var(--color-primary)]" />{t("terminal.secureChannel")}</span>
        <span>UTF-8 · xterm</span>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-3 pt-[max(4rem,10vh)] backdrop-blur-[2px]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPickerOpen(false);
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="terminal-picker-title" className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-border-strong)] bg-[#121a23] shadow-[var(--shadow-float)]">
            <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-3.5">
              <Search className="size-[18px] shrink-0 text-[var(--color-primary)]" />
              <input
                ref={pickerInputRef}
                value={pickerQuery}
                onChange={(event) => {
                  setPickerQuery(event.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handlePickerKeyDown}
                placeholder={t("terminal.searchPlaceholder")}
                className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:outline-none"
                autoFocus
              />
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-muted)]/60 px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-muted-foreground)]">ESC</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
              <div>
                <h2 id="terminal-picker-title" className="text-xs font-semibold">{t("terminal.pickerTitle")}</h2>
                <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{t("terminal.pickerHint")}</p>
              </div>
              <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{t("terminal.serverCount", { count: filteredServers.length })}</span>
            </div>
            <div ref={pickerListRef} className="max-h-[min(24rem,55vh)] overflow-y-auto p-1.5">
                {filteredServers.length === 0 ? (
                  <p className="px-2 py-10 text-center text-sm text-[var(--color-muted-foreground)]">{t("terminal.noServers")}</p>
                ) : (
                  filteredServers.map((server, index) => (
                    <button
                      key={server.id}
                      type="button"
                      data-highlighted={index === highlightedIndex}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => addTab(server)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${index === highlightedIndex ? "bg-[var(--color-muted)] text-[var(--color-foreground)]" : "text-[#c2ccd6]"}`}
                    >
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${index === highlightedIndex ? "border-emerald-300/25 bg-emerald-400/10 text-[var(--color-primary)]" : "border-[var(--color-border)] bg-black/10 text-[var(--color-muted-foreground)]"}`}><Server className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{server.name}</span>{server.group ? <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px]" style={{ color: server.group.color, backgroundColor: `${server.group.color}14` }}>{server.group.name}</span> : null}</span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-[var(--color-muted-foreground)]">{server.username}@{server.host}:{server.port}</span>
                      </span>
                      {index === highlightedIndex ? <CornerDownLeft className="size-3.5 shrink-0 text-[var(--color-primary)]" /> : null}
                    </button>
                  ))
                )}
            </div>
            <div className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-2 font-mono text-[11px] text-[var(--color-muted-foreground)]">
              <span>↑↓ {t("terminal.pickerNavigate")}</span><span>↵ {t("terminal.pickerOpen")}</span><span>esc {t("common.close")}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
