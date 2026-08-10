import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  File,
  Folder,
  FolderPlus,
  LoaderCircle,
  PanelRightClose,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteSftp,
  downloadSftp,
  listSftp,
  mkdirSftp,
  sftpExists,
  uploadSftp,
  type ServerRecord,
  type SftpEntry,
} from "../lib/api";
import { useT } from "../i18n/useT";

type Props = {
  server: ServerRecord | null;
  onClose: () => void;
};

function formatSize(bytes: number, isDir: boolean): string {
  if (isDir) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function breadcrumbParts(currentPath: string): { label: string; path: string }[] {
  const parts = currentPath.split("/").filter(Boolean);
  const crumbs = [{ label: "/", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

export function RemoteFilesSidebar({ server, onClose }: Props) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const serverId = server?.id;

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
    setPath("");
    setEntries([]);
    setError(null);
    if (!serverId) return;
    let cancelled = false;
    setLoading(true);
    void listSftp(serverId, "")
      .then((result) => {
        if (cancelled) return;
        setPath(result.path);
        setEntries(result.entries);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("files.listFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId, t]);

  async function handleMkdir() {
    if (!server || !path) return;
    const name = window.prompt(t("files.mkdirPrompt"))?.trim();
    if (!name) return;
    setBusyName(name);
    try {
      await mkdirSftp(server.id, `${path.replace(/\/$/, "")}/${name}`);
      await refresh(path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("files.mkdirFailed"));
    } finally {
      setBusyName(null);
    }
  }

  async function handleDelete(entry: SftpEntry) {
    if (!server || entry.name === "..") return;
    const message = entry.isDir
      ? t("files.deleteFolderConfirm", { name: entry.name })
      : t("files.deleteFileConfirm", { name: entry.name });
    if (!window.confirm(message)) return;
    setBusyName(entry.name);
    try {
      await deleteSftp(server.id, entry.path, entry.isDir);
      await refresh(path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("files.deleteFailed"));
    } finally {
      setBusyName(null);
    }
  }

  async function handleDownload(entry: SftpEntry) {
    if (!server || entry.isDir) return;
    setBusyName(entry.name);
    try {
      await downloadSftp(server.id, entry.path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("files.downloadFailed"));
    } finally {
      setBusyName(null);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!server || !path || !files?.length) return;
    for (const file of Array.from(files)) {
      try {
        if (await sftpExists(server.id, path, file.name)) {
          if (!window.confirm(t("files.overwriteConfirm", { name: file.name }))) continue;
        }
        setBusyName(file.name);
        setUploadPct(0);
        await uploadSftp(server.id, path, file, setUploadPct);
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
    <aside className="absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-[var(--color-border)] bg-[#0e151d] shadow-[-20px_0_50px_rgba(0,0,0,0.32)] sm:w-[23rem] lg:static lg:z-auto lg:w-[22rem] lg:shrink-0 lg:shadow-none xl:w-[25rem]">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Folder className="size-4 shrink-0 text-[var(--color-primary)]" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{t("files.sidebarTitle")}</p>
            <p className="truncate font-mono text-[9px] text-[var(--color-muted-foreground)]">
              {server ? `${server.username}@${server.host}` : t("files.followSession")}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="icon-button min-h-8 min-w-8" aria-label={t("files.closeSidebar")}>
          <PanelRightClose className="size-4" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--color-border)] p-2">
        <button type="button" className="icon-button min-h-8 min-w-8" disabled={!server || loading} onClick={() => void refresh(path)} title={t("files.refresh")}>
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button type="button" className="icon-button min-h-8 min-w-8" disabled={!server || !path || loading} onClick={() => void handleMkdir()} title={t("files.newFolder")}>
          <FolderPlus className="size-3.5" />
        </button>
        <button type="button" className="secondary-button min-h-8 flex-1 px-2.5 py-1 text-xs" disabled={!server || !path || loading || uploadPct !== null} onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-3.5" />
          {t("files.upload")}
        </button>
        <input ref={fileInputRef} className="hidden" type="file" multiple onChange={(event) => void handleUpload(event.target.files)} />
      </div>

      <nav className="flex min-h-10 shrink-0 items-center overflow-x-auto border-b border-[var(--color-border)] px-2 text-[10px]" aria-label={t("files.title")}>
        {crumbs.map((crumb, index) => (
          <span key={crumb.path} className="flex shrink-0 items-center">
            {index > 0 ? <ChevronRight className="size-3 text-[#536272]" /> : null}
            <button type="button" onClick={() => void refresh(crumb.path)} className="max-w-28 truncate rounded px-1.5 py-1 font-mono text-[#aab7c4] hover:bg-[var(--color-muted)]">
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      {uploadPct !== null ? (
        <div className="shrink-0 border-b border-emerald-300/15 bg-emerald-400/6 px-3 py-2 text-[10px]">
          <div className="flex justify-between gap-2"><span className="truncate">{busyName}</span><span>{uploadPct}%</span></div>
          <div className="mt-1 h-1 overflow-hidden rounded bg-[var(--color-muted)]"><div className="h-full bg-[var(--color-primary)]" style={{ width: `${uploadPct}%` }} /></div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {!server ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-xs text-[var(--color-muted-foreground)]">
            <Folder className="mb-3 size-7 opacity-50" />
            {t("files.noActiveSession")}
          </div>
        ) : error ? (
          <div className="m-2 rounded-lg border border-amber-300/20 bg-amber-300/7 p-3 text-xs text-amber-100/80">
            <div className="flex items-center gap-2 font-medium text-amber-100"><AlertTriangle className="size-4" />{t("files.connectionError")}</div>
            <p className="mt-1.5 leading-relaxed text-amber-100/55">{error}</p>
            <button type="button" className="secondary-button mt-3 min-h-8 w-full text-xs" onClick={() => void refresh(path)}>{t("files.refresh")}</button>
          </div>
        ) : loading && entries.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-[var(--color-muted-foreground)]"><LoaderCircle className="size-4 animate-spin" />{t("files.loading")}</div>
        ) : entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--color-muted-foreground)]">{t("files.emptyDir")}</div>
        ) : (
          <div className="space-y-0.5">
            {entries.map((entry) => (
              <div key={`${entry.path}:${entry.name}`} className="group flex min-h-9 items-center gap-2 rounded-md px-2 hover:bg-[var(--color-muted)]/60">
                <button type="button" disabled={!entry.isDir} onClick={() => entry.isDir && void refresh(entry.path)} className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default">
                  {entry.isDir ? <Folder className="size-4 shrink-0 fill-emerald-400/8 text-[var(--color-primary)]" /> : <File className="size-4 shrink-0 text-[#718091]" />}
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{entry.name}{entry.isDir && entry.name !== ".." ? "/" : ""}</span>
                  <span className="shrink-0 font-mono text-[9px] text-[var(--color-muted-foreground)]">{formatSize(entry.size, entry.isDir)}</span>
                </button>
                <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex">
                  {!entry.isDir ? <button type="button" disabled={busyName === entry.name} onClick={() => void handleDownload(entry)} className="flex size-6 items-center justify-center rounded text-[var(--color-muted-foreground)] hover:bg-black/20 hover:text-[var(--color-foreground)]" aria-label={t("files.download", { name: entry.name })}><Download className="size-3" /></button> : null}
                  {entry.name !== ".." ? <button type="button" disabled={busyName === entry.name} onClick={() => void handleDelete(entry)} className="flex size-6 items-center justify-center rounded text-[var(--color-muted-foreground)] hover:bg-red-400/10 hover:text-[var(--color-destructive)]" aria-label={t("common.delete", { name: entry.name })}><Trash2 className="size-3" /></button> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
