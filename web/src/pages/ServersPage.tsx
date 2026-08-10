import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CircleAlert,
  FolderOpen,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Server,
  SlidersHorizontal,
  Tags,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import {
  fetchGroups,
  fetchServers,
  fetchTags,
  type GroupRecord,
  type ServerRecord,
  type TagRecord,
} from "../lib/api";
import { ServerFormDialog } from "../components/ServerFormDialog";
import { CatalogManageDialog } from "../components/CatalogManageDialog";
import { useT } from "../i18n/useT";

export function ServersPage() {
  const t = useT();
  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | "all">("all");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServerRecord | null>(null);
  const [manageKind, setManageKind] = useState<"groups" | "tags" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCatalog = useCallback(async () => {
    try {
      const [groupList, tagList] = await Promise.all([fetchGroups(), fetchTags()]);
      setGroups(groupList);
      setTags(tagList);
    } catch {
      // Keep the previous catalog on transient failures.
    }
  }, []);

  const refreshServers = useCallback(async () => {
    try {
      setServers(await fetchServers());
      setError(null);
    } catch {
      setError(t("servers.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void refreshServers();
    void refreshCatalog();
  }, [refreshServers, refreshCatalog]);

  const filteredServers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return servers.filter((server) => {
      if (selectedGroupId === "ungrouped") {
        if (server.groupId) return false;
      } else if (selectedGroupId !== "all" && server.groupId !== selectedGroupId) {
        return false;
      }

      if (selectedTagIds.length > 0) {
        const serverTagIds = new Set((server.tags ?? []).map((tag) => tag.id));
        if (!selectedTagIds.every((id) => serverTagIds.has(id))) return false;
      }

      if (normalizedQuery) {
        const searchable = [
          server.name,
          server.host,
          server.username,
          server.remark ?? "",
          server.group?.name ?? "",
          ...(server.tags ?? []).map((tag) => tag.name),
        ]
          .join(" ")
          .toLocaleLowerCase();
        if (!searchable.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [servers, selectedGroupId, selectedTagIds, query]);

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  async function handleDelete(server: ServerRecord) {
    if (!window.confirm(t("servers.deleteConfirm", { name: server.name }))) return;
    setDeletingId(server.id);
    try {
      const response = await fetch(`/api/servers/${server.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(t("servers.deleteFailed"));
      await refreshServers();
    } catch {
      window.alert(t("servers.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="eyebrow">{t("servers.eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-[1.75rem]">
            {t("servers.title")}
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {t("servers.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setManageKind("groups")} className="secondary-button">
            <Layers className="size-4" />
            {t("servers.groups")}
          </button>
          <button type="button" onClick={() => setManageKind("tags")} className="secondary-button">
            <Tags className="size-4" />
            {t("servers.tags")}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="primary-button"
          >
            <Plus className="size-4" />
            {t("servers.addServer")}
          </button>
        </div>
      </div>

      <section className="surface mt-7 overflow-hidden" aria-label={t("servers.filters")}>
        <div className="border-b border-[var(--color-border)] p-3 sm:p-4">
          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("servers.search")}
              className="field pl-10 pr-10"
              aria-label={t("servers.search")}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label={t("servers.clearTags")}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <details className="sm:hidden">
          <summary className="menu-summary flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium">
            <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-[var(--color-primary)]" />{t("servers.filters")}</span>
            <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">{(selectedGroupId !== "all" ? 1 : 0) + selectedTagIds.length}</span>
          </summary>
          <div className="space-y-4 border-t border-[var(--color-border)] p-3">
            <FilterGroup label={t("servers.group")}>
              <FilterChip active={selectedGroupId === "all"} onClick={() => setSelectedGroupId("all")} label={t("servers.all")} />
              <FilterChip active={selectedGroupId === "ungrouped"} onClick={() => setSelectedGroupId("ungrouped")} label={t("servers.ungrouped")} />
              {groups.map((group) => <FilterChip key={group.id} active={selectedGroupId === group.id} onClick={() => setSelectedGroupId(group.id)} label={group.name} color={group.color} />)}
            </FilterGroup>
            <FilterGroup label={t("servers.tags")}>
              {tags.map((tag) => <FilterChip key={tag.id} active={selectedTagIds.includes(tag.id)} onClick={() => toggleTagFilter(tag.id)} label={tag.name} color={tag.color} />)}
              {selectedTagIds.length > 0 ? <button type="button" onClick={() => setSelectedTagIds([])} className="px-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">{t("servers.clearTags")}</button> : null}
            </FilterGroup>
          </div>
        </details>

        <div className="hidden gap-4 p-3 sm:grid sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <FilterGroup label={t("servers.group")}>
            <FilterChip active={selectedGroupId === "all"} onClick={() => setSelectedGroupId("all")} label={t("servers.all")} />
            <FilterChip active={selectedGroupId === "ungrouped"} onClick={() => setSelectedGroupId("ungrouped")} label={t("servers.ungrouped")} />
            {groups.map((group) => (
              <FilterChip key={group.id} active={selectedGroupId === group.id} onClick={() => setSelectedGroupId(group.id)} label={group.name} color={group.color} />
            ))}
          </FilterGroup>

          <FilterGroup label={t("servers.tags")}>
            {tags.length === 0 ? (
              <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
            ) : (
              tags.map((tag) => (
                <FilterChip key={tag.id} active={selectedTagIds.includes(tag.id)} onClick={() => toggleTagFilter(tag.id)} label={tag.name} color={tag.color} />
              ))
            )}
            {selectedTagIds.length > 0 ? (
              <button type="button" onClick={() => setSelectedTagIds([])} className="px-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                {t("servers.clearTags")}
              </button>
            ) : null}
          </FilterGroup>
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between gap-4 px-1">
        <p className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
          {t("servers.showing", { count: filteredServers.length, total: servers.length })}
        </p>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-[var(--color-destructive)]">
          <CircleAlert className="size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {servers.length === 0 ? (
        <EmptyState
          title={t("servers.emptyTitle")}
          hint={t("servers.emptyHint")}
          action={
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="primary-button"
            >
              <Plus className="size-4" />
              {t("servers.addServer")}
            </button>
          }
        />
      ) : filteredServers.length === 0 ? (
        <EmptyState title={t("servers.noMatchTitle")} hint={t("servers.noMatchHint")} />
      ) : (
        <div className="mt-3 space-y-2.5">
          {filteredServers.map((server) => (
            <ServerRow
              key={server.id}
              server={server}
              deleting={deletingId === server.id}
              onEdit={() => {
                setEditing(server);
                setDialogOpen(true);
              }}
              onDelete={() => void handleDelete(server)}
            />
          ))}
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#718091]">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function ServerRow({ server, deleting, onEdit, onDelete }: { server: ServerRecord; deleting: boolean; onEdit: () => void; onDelete: () => void }) {
  const t = useT();
  const openHref = `/terminal?${new URLSearchParams({ serverId: server.id, name: server.name }).toString()}`;
  const filesHref = `/files?${new URLSearchParams({ serverId: server.id }).toString()}`;

  return (
    <article className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/78 p-4 shadow-[0_1px_0_rgba(255,255,255,0.02)_inset] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-card)] sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] sm:text-base">{server.name}</h2>
            {server.group ? <CatalogBadge label={server.group.name} color={server.group.color} /> : null}
          </div>
          <p className="mt-2 truncate font-mono text-xs text-[#96a7b8] sm:text-[13px]">
            {server.username}<span className="text-[#536272]">@</span>{server.host}<span className="text-[#536272]">:</span>{server.port}
          </p>
          <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5">
            {(server.tags ?? []).map((tag) => <CatalogBadge key={tag.id} label={tag.name} color={tag.color} subtle />)}
            {server.remark ? <span className="ml-0 text-xs text-[var(--color-muted-foreground)] sm:ml-1">{server.remark}</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link to={openHref} className="primary-button flex-1 md:flex-none">
            <Terminal className="size-4" />
            {t("servers.open")}
          </Link>
          <Link to={filesHref} className="secondary-button flex-1 md:flex-none">
            <FolderOpen className="size-4" />
            {t("servers.files")}
          </Link>
          <details className="relative">
            <summary className="menu-summary icon-button cursor-pointer" aria-label={t("servers.moreActions", { name: server.name })}>
              <MoreHorizontal className="size-4" />
            </summary>
            <div className="absolute bottom-full right-0 z-20 mb-2 min-w-36 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-elevated)] p-1.5 shadow-2xl md:bottom-auto md:top-full md:mb-0 md:mt-2">
              <button type="button" onClick={onEdit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)]">
                <Pencil className="size-4 text-[var(--color-muted-foreground)]" />
                {t("common.editPlain")}
              </button>
              <button type="button" onClick={onDelete} disabled={deleting} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-destructive)] hover:bg-red-400/10 disabled:opacity-50">
                <Trash2 className="size-4" />
                {t("common.deletePlain")}
              </button>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

function CatalogBadge({ label, color, subtle = false }: { label: string; color: string; subtle?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium sm:text-[11px] ${subtle ? "bg-transparent" : ""}`} style={{ borderColor: `${color}42`, backgroundColor: subtle ? "transparent" : `${color}14`, color }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function EmptyState({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="surface mt-3 flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/50 text-[var(--color-muted-foreground)]">
        <Server className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-muted-foreground)]">{hint}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
      style={{
        borderColor: active ? color || "var(--color-primary)" : "var(--color-border)",
        backgroundColor: active ? (color ? `${color}1f` : "rgb(86 217 144 / 12%)") : "transparent",
        color: active ? color || "var(--color-foreground)" : "var(--color-muted-foreground)",
      }}
    >
      {color ? <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} /> : null}
      {label}
    </button>
  );
}
