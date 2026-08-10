import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  COLOR_PRESETS,
  createGroup,
  createTag,
  deleteGroup,
  deleteTag,
  fetchGroups,
  fetchTags,
  updateGroup,
  updateTag,
  type GroupRecord,
  type TagRecord,
} from "../lib/api";
import { useT } from "../i18n/useT";
import { ColorSwatches } from "./ColorSwatches";

type Kind = "groups" | "tags";

export function CatalogManageDialog({
  open,
  kind,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  kind: Kind;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [items, setItems] = useState<Array<GroupRecord | TagRecord>>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const title =
    kind === "groups" ? t("catalog.manageGroups") : t("catalog.manageTags");
  const emptyHint =
    kind === "groups" ? t("catalog.emptyGroups") : t("catalog.emptyTags");

  const refresh = useCallback(async () => {
    try {
      setItems(kind === "groups" ? await fetchGroups() : await fetchTags());
    } catch {
      setError(
        t("catalog.loadFailed", {
          kind:
            kind === "groups"
              ? t("catalog.kind.groups")
              : t("catalog.kind.tags"),
        }),
      );
    }
  }, [kind, t]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor(kind === "groups" ? COLOR_PRESETS[0] : COLOR_PRESETS[1]);
    setEditingId(null);
    setError(null);
    void refresh();
  }, [open, kind, refresh]);

  if (!open) return null;

  function startEdit(item: GroupRecord | TagRecord) {
    setEditingId(item.id);
    setName(item.name);
    setColor(item.color);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setColor(kind === "groups" ? COLOR_PRESETS[0] : COLOR_PRESETS[1]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "groups") {
        if (editingId) await updateGroup(editingId, { name: trimmed, color });
        else await createGroup({ name: trimmed, color });
      } else if (editingId) {
        await updateTag(editingId, { name: trimmed, color });
      } else {
        await createTag({ name: trimmed, color });
      }
      resetForm();
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("catalog.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item: GroupRecord | TagRecord) {
    const label =
      kind === "groups" ? t("catalog.groupLabel") : t("catalog.tagLabel");
    if (
      !window.confirm(
        t("catalog.deleteConfirm", { label, name: item.name }),
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (kind === "groups") await deleteGroup(item.id);
      else await deleteTag(item.id);
      if (editingId === item.id) resetForm();
      await refresh();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("catalog.deleteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
            aria-label={t("common.close")}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <label className="block space-y-2 text-sm">
              <span>
                {editingId ? t("catalog.editName") : t("catalog.newName")}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "groups"
                    ? t("catalog.placeholder.group")
                    : t("catalog.placeholder.tag")
                }
                className="field"
                required
              />
            </label>
            <div className="space-y-2 text-sm">
              <span>{t("catalog.color")}</span>
              <ColorSwatches value={color} onChange={setColor} />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-60"
              >
                <Plus className="size-4" />
                {editingId ? t("common.save") : t("common.create")}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                >
                  {t("catalog.cancelEdit")}
                </button>
              ) : null}
            </div>
          </form>

          {error ? (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          ) : null}

          {items.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {emptyHint}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-sm">{item.name}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-muted)]"
                      aria-label={t("common.edit", { name: item.name })}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item)}
                      disabled={busy}
                      className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-muted)] disabled:opacity-50"
                      aria-label={t("common.delete", { name: item.name })}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <style>{`
        .field {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid var(--color-border);
          background: var(--color-input);
          padding: 0.5rem 0.75rem;
          outline: none;
        }
        .field:focus {
          box-shadow: 0 0 0 2px var(--color-ring);
        }
      `}</style>
    </div>
  );
}
