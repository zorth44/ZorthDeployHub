"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Maximize2, Minimize2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TerminalPane } from "@/components/terminal/terminal-pane";
import type { ServerRecord } from "@/components/servers/server-form-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = {
  id: string;
  serverId: string;
  title: string;
};

export function TerminalWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const bootstrapped = useMemo(() => ({ current: false }), []);

  useEffect(() => {
    void fetch("/api/servers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ServerRecord[]) => setServers(data))
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

    const tabId = crypto.randomUUID();
    setTabs([
      {
        id: tabId,
        serverId,
        title: name || "Terminal",
      },
    ]);
    setActiveId(tabId);
    bootstrapped.current = true;
    router.replace("/terminal");
  }, [bootstrapped, router, searchParams]);

  const addTab = useCallback((server: ServerRecord) => {
    const tabId = crypto.randomUUID();
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
          ? "fixed inset-0 z-50 flex flex-col bg-background"
          : "flex min-h-0 flex-1 flex-col"
      }
    >
      <div className="flex items-center gap-1 border-b border-border bg-card px-2 py-1">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`group flex max-w-[12rem] items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                activeId === tab.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <span className="truncate">{tab.title}</span>
              <span
                role="button"
                tabIndex={0}
                className="rounded p-0.5 opacity-60 hover:bg-background hover:opacity-100"
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="size-4" />
            New
          </Button>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setFullscreen((value) => !value)}
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreen ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </Button>
      </div>

      <div className="min-h-0 flex-1 bg-[#0b0f14]">
        {tabs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <p>No terminal open.</p>
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" />
              Open Server
            </Button>
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

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Terminal</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {servers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No servers configured. Add one from the Servers page.
              </p>
            ) : (
              servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => addTab(server)}
                  className="flex w-full flex-col rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="font-medium">{server.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {server.username}@{server.host}:{server.port}
                  </span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
