import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Download,
  File,
  Folder,
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
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-7 xl:px-10">
      <div className="flex shrink-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] lg:hidden"
          >
            <ArrowLeft className="size-4" />
            {t("common.backToServers")}
          </Link>
          <p className="eyebrow mt-4 lg:mt-0">{t("files.eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
            {selectedServer ? `${selectedServer.name} · ${t("files.title")}` : t("files.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t("files.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <label className="relative flex min-w-0 items-center text-sm text-[var(--color-muted-foreground)]">
            <HardDrive className="pointer-events-none absolute left-3 size-4" />
            <select
              value={serverId}
              onChange={(e) => {
                const id = e.target.value;
                setServerId(id);
                navigate(`/files?serverId=${encodeURIComponent(id)}`, {
                  replace: true,
                });
              }}
              className="field min-w-40 appearance-none pl-9 pr-8 text-[var(--color-foreground)]"
              aria-label={t("servers.title")}
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
            className="secondary-button"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            {t("files.refresh")}
          </button>
          <button
            type="button"
            onClick={() => void handleMkdir()}
            disabled={!serverId || !path || loading}
            className="secondary-button"
          >
            <FolderPlus className="size-4" />
            {t("files.newFolder")}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!serverId || !path || loading || uploadPct !== null}
            className="primary-button"
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

      <div className="surface mt-5 flex shrink-0 flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <nav className="flex min-w-0 flex-wrap items-center gap-0.5 text-xs" aria-label={t("files.title")}>
          {crumbs.map((crumb, index) => (
            <span key={crumb.path} className="flex min-w-0 items-center">
              {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-[#566575]" /> : null}
              <button type="button" className="max-w-40 truncate rounded-md px-2 py-1.5 font-mono text-[#b8c4cf] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]" onClick={() => void refresh(crumb.path)}>
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>
        {selectedServer ? (
          <p className="shrink-0 truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">
            {selectedServer.username}@{selectedServer.host}:{selectedServer.port}
          </p>
        ) : null}
      </div>

      {uploadPct !== null ? (
        <div className="mt-3 shrink-0 rounded-xl border border-emerald-300/15 bg-emerald-400/6 px-4 py-3 text-sm">
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
        <div className="mt-3 flex shrink-0 gap-3 rounded-xl border border-amber-300/20 bg-amber-300/7 px-4 py-3" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-amber-100">{t("files.connectionError")}</p>
            <p className="mt-0.5 text-xs text-amber-100/60">{t("files.errorHint")}</p>
          </div>
        </div>
      ) : null}

      <div className="surface mt-3 min-h-0 flex-1 overflow-auto">
        {!serverId ? (
          <div className="flex h-full min-h-56 items-center justify-center p-6 text-center text-sm text-[var(--color-muted-foreground)]">
            {t("files.noServer")}
          </div>
        ) : loading && entries.length === 0 ? (
          <div className="flex h-full min-h-56 items-center justify-center gap-2 p-6 text-sm text-[var(--color-muted-foreground)]">
            <LoaderCircle className="size-4 animate-spin" />
            {t("files.loading")}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--color-card-elevated)] text-[var(--color-muted-foreground)] shadow-[0_1px_0_var(--color-border)]">
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-xs font-medium">{t("files.name")}</th>
                <th className="px-4 py-3 text-xs font-medium">{t("files.size")}</th>
                <th className="hidden px-4 py-3 text-xs font-medium sm:table-cell">
                  {t("files.modified")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium">{t("files.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.path + entry.name}
                  className="border-b border-[var(--color-border)]/70 last:border-0 hover:bg-[var(--color-muted)]/25"
                >
                  <td className="px-4 py-3">
                    {entry.isDir ? (
                      <button
                        type="button"
                        className="inline-flex max-w-[18rem] items-center gap-2.5 font-mono text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] sm:max-w-none"
                        onClick={() => void openEntry(entry)}
                      >
                        <Folder className="size-4 shrink-0 fill-emerald-400/10" />
                        <span className="truncate">{entry.name}/</span>
                      </button>
                    ) : (
                      <span className="inline-flex max-w-[18rem] items-center gap-2.5 font-mono sm:max-w-none">
                        <File className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
                        <span className="truncate">{entry.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-[var(--color-muted-foreground)]">
                    {formatSize(entry.size, entry.isDir)}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-[var(--color-muted-foreground)] sm:table-cell">
                    {entry.name === ".." ? "—" : formatTime(entry.modTime)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {!entry.isDir ? (
                        <button
                          type="button"
                          className="icon-button min-h-8 min-w-8"
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
                          className="icon-button min-h-8 min-w-8 hover:border-red-400/30 hover:bg-red-400/10 hover:text-[var(--color-destructive)]"
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
                    className="h-48 px-4 py-8 text-center text-[var(--color-muted-foreground)]"
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
