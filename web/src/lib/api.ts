export type GroupRecord = {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TagRecord = {
  id: string;
  name: string;
  color: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ServerRecord = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  remark: string | null;
  groupId: string | null;
  group: GroupRecord | null;
  tags: TagRecord[];
};

export const COLOR_PRESETS = [
  "#64748b",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#f97316",
] as const;

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
  const data = (await res.json()) as ServerRecord[];
  return data.map((server) => ({
    ...server,
    groupId: server.groupId ?? null,
    group: server.group ?? null,
    tags: server.tags ?? [],
  }));
}

export async function fetchGroups(): Promise<GroupRecord[]> {
  const res = await fetch("/api/groups", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load groups");
  return (await res.json()) as GroupRecord[];
}

export async function createGroup(input: {
  name: string;
  color: string;
}): Promise<GroupRecord> {
  const res = await fetch("/api/groups", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create group"));
  return (await res.json()) as GroupRecord;
}

export async function updateGroup(
  id: string,
  input: { name: string; color: string },
): Promise<GroupRecord> {
  const res = await fetch(`/api/groups/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update group"));
  return (await res.json()) as GroupRecord;
}

export async function deleteGroup(id: string): Promise<void> {
  const res = await fetch(`/api/groups/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to delete group"));
}

export async function fetchTags(): Promise<TagRecord[]> {
  const res = await fetch("/api/tags", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load tags");
  return (await res.json()) as TagRecord[];
}

export async function createTag(input: {
  name: string;
  color: string;
}): Promise<TagRecord> {
  const res = await fetch("/api/tags", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to create tag"));
  return (await res.json()) as TagRecord;
}

export async function updateTag(
  id: string,
  input: { name: string; color: string },
): Promise<TagRecord> {
  const res = await fetch(`/api/tags/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to update tag"));
  return (await res.json()) as TagRecord;
}

export async function deleteTag(id: string): Promise<void> {
  const res = await fetch(`/api/tags/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to delete tag"));
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
