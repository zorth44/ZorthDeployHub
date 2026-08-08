import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Pencil, Plus, Terminal, Trash2 } from "lucide-react";
import {
  fetchServers,
  fetchStatus,
  type OnlineStatus,
  type ServerRecord,
} from "../lib/api";
import { ServerFormDialog } from "../components/ServerFormDialog";
import { StatusDot } from "../components/StatusDot";

export function ServersPage() {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, OnlineStatus>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServerRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshServers = useCallback(async () => {
    try {
      setServers(await fetchServers());
    } catch {
      setError("Failed to load servers");
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      setStatusMap(await fetchStatus());
    } catch {
      // ignore transient probe failures
    }
  }, []);

  useEffect(() => {
    void refreshServers();
  }, [refreshServers]);

  useEffect(() => {
    void refreshStatus();
    const timer = setInterval(() => {
      void refreshStatus();
    }, 30_000);
    return () => clearInterval(timer);
  }, [refreshStatus, servers.length]);

  async function handleDelete(server: ServerRecord) {
    if (!window.confirm(`Delete server "${server.name}"?`)) return;
    setDeletingId(server.id);
    try {
      const response = await fetch(`/api/servers/${server.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete");
      await refreshServers();
    } catch {
      window.alert("Failed to delete server");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Servers</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Open a shell on any configured host using the shared SSH key.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)]"
        >
          <Plus className="size-4" />
          Add Server
        </button>
      </div>

      {error ? (
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      ) : null}

      {servers.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="font-medium">No servers yet</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Add your first SSH target to start opening terminals.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {servers.map((server) => {
            const openHref = `/terminal?${new URLSearchParams({
              serverId: server.id,
              name: server.name,
            }).toString()}`;
            const filesHref = `/files?${new URLSearchParams({
              serverId: server.id,
            }).toString()}`;

            return (
              <div
                key={server.id}
                className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusDot status={statusMap[server.id] ?? "unknown"} />
                    <h2 className="truncate font-medium">{server.name}</h2>
                  </div>
                  <p className="font-mono text-sm text-[var(--color-muted-foreground)]">
                    {server.username}@{server.host}:{server.port}
                  </p>
                  {server.remark ? (
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {server.remark}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={openHref}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)]"
                  >
                    <Terminal className="size-4" />
                    Open
                  </Link>
                  <Link
                    to={filesHref}
                    className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                  >
                    <FolderOpen className="size-4" />
                    Files
                  </Link>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-muted)]"
                    onClick={() => {
                      setEditing(server);
                      setDialogOpen(true);
                    }}
                    aria-label={`Edit ${server.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-muted)] disabled:opacity-50"
                    onClick={() => void handleDelete(server)}
                    disabled={deletingId === server.id}
                    aria-label={`Delete ${server.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ServerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSaved={() => {
          void refreshServers();
        }}
      />
    </div>
  );
}
