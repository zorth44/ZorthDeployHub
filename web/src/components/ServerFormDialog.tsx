import { useEffect, useState } from "react";
import {
  COLOR_PRESETS,
  createTag,
  fetchGroups,
  fetchTags,
  type GroupRecord,
  type ServerRecord,
  type TagRecord,
} from "../lib/api";

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
        setError("Failed to load groups/tags");
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
        tagIds: (initial.tags ?? []).map((t) => t.id),
      });
    } else {
      setForm(emptyForm);
    }
    setNewTagName("");
    setError(null);
  }, [open, initial]);

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
      setError(err instanceof Error ? err.message : "Failed to create tag");
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
        throw new Error(data?.error ?? "Failed to save server");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-2xl">
        <h2 className="mb-4 text-lg font-semibold">
          {isEdit ? "Edit Server" : "Add Server"}
        </h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              required
              placeholder="API"
              className="field"
            />
          </Field>
          <Field label="Host">
            <input
              value={form.host}
              onChange={(e) => setForm((s) => ({ ...s, host: e.target.value }))}
              required
              placeholder="10.0.0.11"
              className="field"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Port">
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
            <Field label="Username">
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
          <Field label="Group">
            <select
              value={form.groupId}
              onChange={(e) =>
                setForm((s) => ({ ...s, groupId: e.target.value }))
              }
              className="field"
            >
              <option value="">Ungrouped</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="space-y-2 text-sm">
            <span>Tags</span>
            {tags.length === 0 ? (
              <p className="text-[var(--color-muted-foreground)]">
                No tags yet. Create one below.
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
                placeholder="New tag name"
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
                Add tag
              </button>
            </div>
          </div>
          <Field label="Remark">
            <textarea
              value={form.remark}
              onChange={(e) => setForm((s) => ({ ...s, remark: e.target.value }))}
              placeholder="Optional note"
              rows={3}
              className="field"
            />
          </Field>
          {error ? (
            <p className="text-sm text-[var(--color-destructive)]">{error}</p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-60"
            >
              {saving ? "Saving..." : isEdit ? "Save" : "Create"}
            </button>
          </div>
        </form>
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
