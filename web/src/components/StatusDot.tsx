import type { OnlineStatus } from "../lib/api";
import { useT } from "../i18n/useT";

export function StatusDot({ status }: { status: OnlineStatus }) {
  const t = useT();
  const color =
    status === "online"
      ? "bg-emerald-400"
      : status === "offline"
        ? "bg-red-400"
        : "bg-zinc-500";

  const label =
    status === "online"
      ? t("status.online")
      : status === "offline"
        ? t("status.offline")
        : t("status.unknown");

  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${color}`}
      title={label}
      aria-label={label}
    />
  );
}
