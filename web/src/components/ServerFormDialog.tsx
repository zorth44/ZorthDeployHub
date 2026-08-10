import { useEffect, useState } from "react";
import { Server, X } from "lucide-react";
import {
  COLOR_PRESETS,
  createTag,
  fetchGroups,
  fetchTags,
  type GroupRecord,
  type ServerRecord,
  type TagRecord,
} from "../lib/api";
import { useT } from "../i18n/useT";

type FormState = {
  name: string;
  host: string;
  port: string;
  username: string;
  remark: string;
  groupId: string;
  tagIds: string[];
};

const emptyForm: FormState = {
  name: "",
  host: "",
  port: "22",
  username: "",
  remark: "",
  groupId: "",
  tagIds: [],
};

export function ServerFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ServerRecord | null;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial;

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [groupList, tagList] = await Promise.all([
          fetchGroups(),
          fetchTags(),
        ]);
        setGroups(groupList);
        setTags(tagList);
      } catch {
        setError(t("serverForm.loadCatalogFailed"));
      }
    })();

    if (initial) {
      setForm({
        name: initial.name,
        host: initial.host,
        port: String(initial.port),
        username: initial.username,
        remark: initial.remark ?? "",
        groupId: initial.groupId ?? "",
        tagIds: (initial.tags ?? []).map((tag) => tag.id),
      });
    } else {
      setForm(emptyForm);
    }
    setNewTagName("");
    setError(null);
  }, [open, initial, t]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  function toggleTag(tagId: string) {
    setForm((s) => ({
      ...s,
      tagIds: s.tagIds.includes(tagId)
        ? s.tagIds.filter((id) => id !== tagId)
        : [...s.tagIds, tagId],
    }));
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const tag = await createTag({
        name,
        color: COLOR_PRESETS[(tags.length + 1) % COLOR_PRESETS.length],
      });
      setTags((prev) =>
        [...prev, tag].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
      );
      setForm((s) => ({ ...s, tagIds: [...s.tagIds, tag.id] }));
      setNewTagName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("serverForm.createTagFailed"),
      );
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      host: form.host,
      port: Number(form.port),
      username: form.username,
      remark: form.remark || null,
      groupId: form.groupId || null,
      tagIds: form.tagIds,
    };

    try {
      const response = await fetch(
        isEdit ? `/api/servers/${initial!.id}` : "/api/servers",
        {
          method: isEdit ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? t("serverForm.saveFailed"));
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("serverForm.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? t("serverForm.editTitle") : t("serverForm.addTitle");

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onOpenChange(false);
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-form-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-float)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-400/10 text-[var(--color-primary)]">
              <Server className="size-[18px]" />
            </span>
            <div>
              <p className="eyebrow">SSH Target</p>
              <h2 id="server-form-title" className="mt-0.5 text-lg font-semibold">{title}</h2>
            </div>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="icon-button" aria-label={t("common.close")}>
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <Field label={t("serverForm.name")}>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              required
              placeholder="API"
              className="field"
              autoFocus
            />
          </Field>
          <Field label={t("serverForm.host")}>
            <input
              value={form.host}
              onChange={(e) => setForm((s) => ({ ...s, host: e.target.value }))}
              required
              placeholder="10.0.0.11"
              className="field"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("serverForm.port")}>
              <input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => setForm((s) => ({ ...s, port: e.target.value }))}
                required
                className="field"
              />
            </Field>
            <Field label={t("serverForm.username")}>
              <input
                value={form.username}
                onChange={(e) =>
                  setForm((s) => ({ ...s, username: e.target.value }))
                }
                required
                placeholder="bddf"
                className="field"
              />
            </Field>
          </div>
          <Field label={t("serverForm.group")}>
            <select
              value={form.groupId}
              onChange={(e) =>
                setForm((s) => ({ ...s, groupId: e.target.value }))
              }
              className="field"
            >
              <option value="">{t("serverForm.ungrouped")}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="space-y-2 text-sm">
            <span>{t("serverForm.tags")}</span>
            {tags.length === 0 ? (
              <p className="text-[var(--color-muted-foreground)]">
                {t("serverForm.noTags")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = form.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="rounded-md border px-2.5 py-1 text-xs transition-colors"
                      style={{
                        borderColor: selected ? tag.color : "var(--color-border)",
                        backgroundColor: selected
                          ? `${tag.color}33`
                          : "transparent",
                        color: selected
                          ? "var(--color-foreground)"
                          : "var(--color-muted-foreground)",
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={t("serverForm.newTagPlaceholder")}
                className="field"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreateTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void handleCreateTag()}
                className="shrink-0 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
              >
                {t("serverForm.addTag")}
              </button>
            </div>
          </div>
          <Field label={t("serverForm.remark")}>
            <textarea
              value={form.remark}
              onChange={(e) => setForm((s) => ({ ...s, remark: e.target.value }))}
              placeholder={t("serverForm.remarkPlaceholder")}
              rows={3}
              className="field"
            />
          </Field>
          {error ? (
            <p className="rounded-lg border border-red-400/20 bg-red-400/8 px-3 py-2.5 text-sm text-[var(--color-destructive)]">{error}</p>
          ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ghost-button"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="primary-button"
            >
              {saving
                ? t("serverForm.saving")
                : isEdit
                  ? t("common.save")
                  : t("common.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}
