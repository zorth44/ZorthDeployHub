import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2, Plus, X } from "lucide-react";
import { fetchServers, type ServerRecord } from "../lib/api";
import { createId } from "../lib/id";
import { useT } from "../i18n/useT";
import { TerminalPane } from "./TerminalPane";

type Tab = {
  id: string;
  serverId: string;
  title: string;
};

export function TerminalWorkspace() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const bootstrapped = useRef(false);

  useEffect(() => {
    void fetchServers()
      .then(setServers)
      .catch(() => setServers([]));
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
    setTabs([
      {
        id: tabId,
        serverId,
        title: name || t("terminal.defaultTitle"),
      },
    ]);
    setActiveId(tabId);
    bootstrapped.current = true;
    navigate("/terminal", { replace: true });
  }, [navigate, searchParams, t]);

  const addTab = useCallback((server: ServerRecord) => {
    const tabId = createId();
    setTabs((prev) => [
      ...prev,
      {
        id: tabId,
        serverId: server.id,
        title: server.name,
      },
    ]);
    setActiveId(tabId);
    setPickerOpen(false);
  }, []);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const next = prev.filter((tab) => tab.id !== tabId);
        if (activeId === tabId) {
          setActiveId(next[next.length - 1]?.id ?? null);
        }
        return next;
      });
    },
    [activeId],
  );

  const renameTab = useCallback((tabId: string, title: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)),
    );
  }, []);

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-[var(--color-background)]"
          : "flex h-full min-h-0 flex-col"
      }
    >
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1">
        {!fullscreen ? (
          <Link
            to="/"
            className="mr-1 inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{t("common.backToServers")}</span>
          </Link>
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`group flex max-w-[12rem] items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                activeId === tab.id
                  ? "bg-[var(--color-muted)] text-[var(--color-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]/60 hover:text-[var(--color-foreground)]"
              }`}
            >
              <span className="truncate">{tab.title}</span>
              <span
                role="button"
                tabIndex={0}
                className="rounded p-0.5 opacity-60 hover:bg-[var(--color-background)] hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }
                }}
              >
                <X className="size-3.5" />
              </span>
            </button>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="size-4" />
            {t("terminal.new")}
          </button>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          onClick={() => setFullscreen((value) => !value)}
          aria-label={
            fullscreen
              ? t("terminal.fullscreenExit")
              : t("terminal.fullscreenEnter")
          }
        >
          {fullscreen ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 bg-[#0b0f14]">
        {tabs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[var(--color-muted-foreground)]">
            <p>{t("terminal.empty")}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)]"
              >
                <Plus className="size-4" />
                {t("terminal.openServer")}
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
              >
                <ArrowLeft className="size-4" />
                {t("common.backToServers")}
              </Link>
            </div>
          </div>
        ) : (
          tabs.map((tab) => (
            <TerminalPane
              key={tab.id}
              serverId={tab.serverId}
              active={tab.id === activeId}
              onTitle={(title) => renameTab(tab.id, title)}
            />
          ))
        )}
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("terminal.pickerTitle")}</h2>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                aria-label={t("common.close")}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {servers.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t("terminal.noServers")}
                </p>
              ) : (
                servers.map((server) => (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => addTab(server)}
                    className="flex w-full flex-col rounded-md border border-[var(--color-border)] px-3 py-2 text-left hover:bg-[var(--color-muted)]"
                  >
                    <span className="font-medium">{server.name}</span>
                    <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                      {server.username}@{server.host}:{server.port}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
