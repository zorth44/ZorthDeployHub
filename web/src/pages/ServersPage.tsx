import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderOpen,
  Pencil,
  Plus,
  Tags,
  Terminal,
  Trash2,
  Layers,
} from "lucide-react";
import {
  fetchGroups,
  fetchServers,
  fetchStatus,
  fetchTags,
  type GroupRecord,
  type OnlineStatus,
  type ServerRecord,
  type TagRecord,
} from "../lib/api";
import { ServerFormDialog } from "../components/ServerFormDialog";
import { CatalogManageDialog } from "../components/CatalogManageDialog";
import { StatusDot } from "../components/StatusDot";

export function ServersPage() {
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, OnlineStatus>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string | "all">("all");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServerRecord | null>(null);
  const [manageKind, setManageKind] = useState<"groups" | "tags" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    try {
      const [groupList, tagList] = await Promise.all([
        fetchGroups(),
        fetchTags(),
      ]);
      setGroups(groupList);
      setTags(tagList);
    } catch {
      // keep previous catalog on transient failures
    }
  }, []);

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
    void refreshCatalog();
  }, [refreshServers, refreshCatalog]);

  useEffect(() => {
    void refreshStatus();
    const timer = setInterval(() => {
      void refreshStatus();
    }, 30_000);
    return () => clearInterval(timer);
  }, [refreshStatus, servers.length]);

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      if (selectedGroupId === "ungrouped") {
        if (server.groupId) return false;
      } else if (selectedGroupId !== "all") {
        if (server.groupId !== selectedGroupId) return false;
      }
      if (selectedTagIds.length > 0) {
        const serverTagIds = new Set((server.tags ?? []).map((t) => t.id));
        if (!selectedTagIds.every((id) => serverTagIds.has(id))) return false;
      }
      return true;
    });
  }, [servers, selectedGroupId, selectedTagIds]);

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Servers</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Group hosts by environment and tag them by role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setManageKind("groups")}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
          >
            <Layers className="size-4" />
            Groups
          </button>
          <button
            type="button"
            onClick={() => setManageKind("tags")}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
          >
            <Tags className="size-4" />
            Tags
          </button>
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
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/60 p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Group
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={selectedGroupId === "all"}
              onClick={() => setSelectedGroupId("all")}
              label="All"
            />
            <FilterChip
              active={selectedGroupId === "ungrouped"}
              onClick={() => setSelectedGroupId("ungrouped")}
              label="Ungrouped"
            />
            {groups.map((group) => (
              <FilterChip
                key={group.id}
                active={selectedGroupId === group.id}
                onClick={() => setSelectedGroupId(group.id)}
                label={group.name}
                color={group.color}
              />
            ))}
          </div>
        </div>
        {tags.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <FilterChip
                  key={tag.id}
                  active={selectedTagIds.includes(tag.id)}
                  onClick={() => toggleTagFilter(tag.id)}
                  label={tag.name}
                  color={tag.color}
                />
              ))}
              {selectedTagIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedTagIds([])}
                  className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  Clear tags
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
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
      ) : filteredServers.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
          <h2 className="font-medium">No matching servers</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Try another group or clear the tag filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredServers.map((server) => {
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
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusDot status={statusMap[server.id] ?? "unknown"} />
                    <h2 className="truncate font-medium">{server.name}</h2>
                    {server.group ? (
                      <span
                        className="rounded-md px-2 py-0.5 text-xs"
                        style={{
                          backgroundColor: `${server.group.color}33`,
                          color: server.group.color,
                        }}
                      >
                        {server.group.name}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-sm text-[var(--color-muted-foreground)]">
                    {server.username}@{server.host}:{server.port}
                  </p>
                  {(server.tags ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {server.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded border px-1.5 py-0.5 text-[11px]"
                          style={{
                            borderColor: `${tag.color}66`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
          void refreshCatalog();
        }}
      />

      <CatalogManageDialog
        open={manageKind !== null}
        kind={manageKind ?? "groups"}
        onOpenChange={(open) => {
          if (!open) setManageKind(null);
        }}
        onChanged={() => {
          void refreshCatalog();
          void refreshServers();
        }}
      />
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
      style={{
        borderColor: active
          ? color || "var(--color-primary)"
          : "var(--color-border)",
        backgroundColor: active
          ? color
            ? `${color}33`
            : "color-mix(in srgb, var(--color-primary) 25%, transparent)"
          : "transparent",
        color: active
          ? color || "var(--color-foreground)"
          : "var(--color-muted-foreground)",
      }}
    >
      {color ? (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {label}
    </button>
  );
}
