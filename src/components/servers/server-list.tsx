"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ServerFormDialog,
  type ServerRecord,
} from "@/components/servers/server-form-dialog";

export function ServerList({
  initialServers,
}: {
  initialServers: ServerRecord[];
}) {
  const router = useRouter();
  const [servers, setServers] = useState(initialServers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServerRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshServers = useCallback(async () => {
    const response = await fetch("/api/servers");
    if (!response.ok) return;
    const data = (await response.json()) as ServerRecord[];
    setServers(data);
  }, []);

  useEffect(() => {
    setServers(initialServers);
  }, [initialServers]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(server: ServerRecord) {
    setEditing(server);
    setDialogOpen(true);
  }

  async function handleDelete(server: ServerRecord) {
    if (!window.confirm(`Delete server "${server.name}"?`)) return;
    setDeletingId(server.id);
    try {
      const response = await fetch(`/api/servers/${server.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }
      await refreshServers();
      router.refresh();
    } catch {
      window.alert("Failed to delete server");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Servers</h1>
          <p className="text-sm text-muted-foreground">
            Open a shell on any configured host using the shared SSH key.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Server
        </Button>
      </div>

      {servers.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No servers yet</CardTitle>
            <CardDescription>
              Add your first SSH target to start opening terminals.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Add Server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {servers.map((server) => {
            const openHref = `/terminal?${new URLSearchParams({
              serverId: server.id,
              name: server.name,
            }).toString()}`;

            return (
              <Card key={server.id} className="overflow-hidden">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-medium">{server.name}</h2>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground">
                      {server.username}@{server.host}:{server.port}
                    </p>
                    {server.remark ? (
                      <p className="text-sm text-muted-foreground">
                        {server.remark}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button nativeButton={false} render={<Link href={openHref} />}>
                      <Terminal className="size-4" />
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEdit(server)}
                      aria-label={`Edit ${server.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => void handleDelete(server)}
                      disabled={deletingId === server.id}
                      aria-label={`Delete ${server.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
          router.refresh();
        }}
      />
    </div>
  );
}
