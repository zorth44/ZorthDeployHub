import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FolderPlus,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteSftp,
  downloadSftp,
  fetchServers,
  listSftp,
  mkdirSftp,
  sftpExists,
  uploadSftp,
  type ServerRecord,
  type SftpEntry,
} from "../lib/api";
import { useT } from "../i18n/useT";

function formatSize(bytes: number, isDir: boolean): string {
  if (isDir) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function breadcrumbParts(currentPath: string): { label: string; path: string }[] {
  if (!currentPath || currentPath === "/") {
    return [{ label: "/", path: "/" }];
  }
  const parts = currentPath.split("/").filter(Boolean);
  const crumbs = [{ label: "/", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

export function FilesPage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [servers, setServers] = useState<ServerRecord[]>([]);
  const [serverId, setServerId] = useState<string>("");
  const [path, setPath] = useState<string>("");
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);

  useEffect(() => {
    void fetchServers()
      .then((list) => {
        setServers(list);
        const fromQuery = searchParams.get("serverId");
        if (fromQuery && list.some((s) => s.id === fromQuery)) {
          setServerId(fromQuery);
          return;
        }
        if (list[0]) setServerId(list[0].id);
      })
      .catch(() => setError(t("files.loadServersFailed")));
  }, [searchParams, t]);

  const selectedServer = useMemo(
    () => servers.find((s) => s.id === serverId) ?? null,
    [servers, serverId],
  );

  const refresh = useCallback(
    async (nextPath?: string) => {
      if (!serverId) return;
      setLoading(true);
      setError(null);
      try {
        const result = await listSftp(serverId, nextPath ?? path);
        setPath(result.path);
        setEntries(result.entries);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("files.listFailed"));
      } finally {
        setLoading(false);
      }
    },
    [path, serverId, t],
  );

  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listSftp(serverId, "")
      .then((result) => {
        if (cancelled) return;
        setPath(result.path);
        setEntries(result.entries);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("files.listFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId, t]);

  async function openEntry(entry: SftpEntry) {
    if (!entry.isDir) return;
    await refresh(entry.path);
  }

  async function handleMkdir() {
    if (!serverId || !path) return;
    const name = window.prompt(t("files.mkdirPrompt"));
    if (!name?.trim()) return;
    const target = `${path.replace(/\/$/, "")}/${name.trim()}`;
    setBusyName(name.trim());
    try {
      await mkdirSftp(serverId, target);
      await refresh(path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("files.mkdirFailed"));
    } finally {
      setBusyName(null);
    }
  }

  async function handleDelete(entry: SftpEntry) {
    if (!serverId || entry.name === "..") return;
    const confirmMsg = entry.isDir
      ? t("files.deleteFolderConfirm", { name: entry.name })
      : t("files.deleteFileConfirm", { name: entry.name });
    if (!window.confirm(confirmMsg)) return;
    setBusyName(entry.name);
    try {
      await deleteSftp(serverId, entry.path, entry.isDir);
      await refresh(path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("files.deleteFailed"));
    } finally {
      setBusyName(null);
    }
  }

  async function handleDownload(entry: SftpEntry) {
    if (!serverId || entry.isDir) return;
    setBusyName(entry.name);
    try {
      await downloadSftp(serverId, entry.path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("files.downloadFailed"));
    } finally {
      setBusyName(null);
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!serverId || !path || !fileList?.length) return;
    const files = Array.from(fileList);
    for (const file of files) {
      try {
        const exists = await sftpExists(serverId, path, file.name);
        if (exists) {
          const ok = window.confirm(
            t("files.overwriteConfirm", { name: file.name }),
          );
          if (!ok) continue;
        }
        setUploadPct(0);
        setBusyName(file.name);
        await uploadSftp(serverId, path, file, setUploadPct);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : t("files.uploadFailed"));
        break;
      } finally {
        setBusyName(null);
        setUploadPct(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refresh(path);
  }

  const crumbs = breadcrumbParts(path);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            <ArrowLeft className="size-4" />
            {t("common.backToServers")}
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {selectedServer
                ? `${selectedServer.name} · ${t("files.title")}`
                : t("files.title")}
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t("files.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
            <HardDrive className="size-4" />
            <select
              value={serverId}
              onChange={(e) => {
                const id = e.target.value;
                setServerId(id);
                navigate(`/files?serverId=${encodeURIComponent(id)}`, {
                  replace: true,
                });
              }}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-input)] px-2 py-1.5 text-[var(--color-foreground)]"
            >
              {servers.length === 0 ? (
                <option value="">{t("files.noServersOption")}</option>
              ) : (
                servers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refresh(path)}
            disabled={!serverId || loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            {t("files.refresh")}
          </button>
          <button
            type="button"
            onClick={() => void handleMkdir()}
            disabled={!serverId || !path || loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] disabled:opacity-50"
          >
            <FolderPlus className="size-4" />
            {t("files.newFolder")}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!serverId || !path || loading || uploadPct !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
          >
            <Upload className="size-4" />
            {t("files.upload")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />
        </div>
      </div>

      {selectedServer ? (
        <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
          {selectedServer.username}@{selectedServer.host}:{selectedServer.port}
        </p>
      ) : null}

      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => (
          <span key={crumb.path} className="flex items-center gap-1">
            {index > 0 ? (
              <span className="text-[var(--color-muted-foreground)]">/</span>
            ) : null}
            <button
              type="button"
              className="rounded px-1.5 py-0.5 font-mono text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
              onClick={() => void refresh(crumb.path)}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      {uploadPct !== null ? (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
          {t("files.uploading", { name: busyName ?? "", pct: uploadPct })}
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-[var(--color-muted)]">
            <div
              className="h-full bg-[var(--color-primary)] transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--color-destructive)]">{error}</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {!serverId ? (
          <div className="p-6 text-sm text-[var(--color-muted-foreground)]">
            {t("files.noServer")}
          </div>
        ) : loading && entries.length === 0 ? (
          <div className="flex items-center gap-2 p-6 text-sm text-[var(--color-muted-foreground)]">
            <LoaderCircle className="size-4 animate-spin" />
            {t("files.loading")}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--color-card)] text-[var(--color-muted-foreground)]">
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-2 font-medium">{t("files.name")}</th>
                <th className="px-4 py-2 font-medium">{t("files.size")}</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">
                  {t("files.modified")}
                </th>
                <th className="px-4 py-2 font-medium">{t("files.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path + entry.name}
                  className="border-b border-[var(--color-border)]/70 last:border-0"
                >
                  <td className="px-4 py-2">
                    {entry.isDir ? (
                      <button
                        type="button"
                        className="font-mono text-[var(--color-primary)] hover:underline"
                        onClick={() => void openEntry(entry)}
                      >
                        {entry.name}/
                      </button>
                    ) : (
                      <span className="font-mono">{entry.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-[var(--color-muted-foreground)]">
                    {formatSize(entry.size, entry.isDir)}
                  </td>
                  <td className="hidden px-4 py-2 text-[var(--color-muted-foreground)] sm:table-cell">
                    {entry.name === ".." ? "—" : formatTime(entry.modTime)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {!entry.isDir ? (
                        <button
                          type="button"
                          className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-muted)] disabled:opacity-50"
                          disabled={busyName === entry.name}
                          onClick={() => void handleDownload(entry)}
                          aria-label={t("files.download", { name: entry.name })}
                        >
                          <Download className="size-4" />
                        </button>
                      ) : null}
                      {entry.name !== ".." ? (
                        <button
                          type="button"
                          className="rounded-md border border-[var(--color-border)] p-1.5 hover:bg-[var(--color-muted)] disabled:opacity-50"
                          disabled={busyName === entry.name}
                          onClick={() => void handleDelete(entry)}
                          aria-label={t("common.delete", { name: entry.name })}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-[var(--color-muted-foreground)]"
                  >
                    {t("files.emptyDir")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
