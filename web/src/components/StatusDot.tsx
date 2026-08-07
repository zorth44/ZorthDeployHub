import type { OnlineStatus } from "../lib/api";

export function StatusDot({ status }: { status: OnlineStatus }) {
  const color =
    status === "online"
      ? "bg-emerald-400"
      : status === "offline"
        ? "bg-red-400"
        : "bg-zinc-500";

  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${color}`}
      title={status}
      aria-label={status}
    />
  );
}
