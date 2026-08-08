export type ServerRecord = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  remark: string | null;
};

export type OnlineStatus = "online" | "offline" | "unknown";

export type SftpEntry = {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mode: string;
  modTime: string;
};

export type SftpListResult = {
  path: string;
  entries: SftpEntry[];
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) return data.error;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchServers(): Promise<ServerRecord[]> {
  const res = await fetch("/api/servers", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load servers");
  return (await res.json()) as ServerRecord[];
}

export async function fetchStatus(): Promise<Record<string, OnlineStatus>> {
  const res = await fetch("/api/servers/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load status");
  return (await res.json()) as Record<string, OnlineStatus>;
}

export async function listSftp(
  serverId: string,
  path = "",
): Promise<SftpListResult> {
  const params = new URLSearchParams({ serverId });
  if (path) params.set("path", path);
  const res = await fetch(`/api/sftp/list?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(await readError(res, "Failed to list directory"));
  return (await res.json()) as SftpListResult;
}

export async function sftpExists(
  serverId: string,
  path: string,
  name: string,
): Promise<boolean> {
  const params = new URLSearchParams({ serverId, path, name });
  const res = await fetch(`/api/sftp/exists?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(await readError(res, "Failed to check file"));
  const data = (await res.json()) as { exists: boolean };
  return data.exists;
}

export async function mkdirSftp(serverId: string, path: string): Promise<void> {
  const res = await fetch("/api/sftp/mkdir", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverId, path }),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create directory"));
}

export async function deleteSftp(
  serverId: string,
  path: string,
  recursive = false,
): Promise<void> {
  const params = new URLSearchParams({ serverId, path });
  if (recursive) params.set("recursive", "1");
  const res = await fetch(`/api/sftp?${params}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to delete"));
}

export async function downloadSftp(serverId: string, path: string): Promise<void> {
  const params = new URLSearchParams({ serverId, path });
  const res = await fetch(`/api/sftp/download?${params}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to download"));

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plainMatch = /filename="([^"]+)"/i.exec(disposition);
  const name = utfMatch
    ? decodeURIComponent(utfMatch[1])
    : plainMatch?.[1] || path.split("/").pop() || "download";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function uploadSftp(
  serverId: string,
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/sftp/upload");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(data.error || "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    const form = new FormData();
    form.set("serverId", serverId);
    form.set("path", path);
    form.set("file", file, file.name);
    xhr.send(form);
  });
}
