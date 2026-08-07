import { cn } from "@/lib/utils";
import type { OnlineStatus } from "@/lib/server-status";

export function StatusDot({
  status,
  className,
}: {
  status?: OnlineStatus | "unknown";
  className?: string;
}) {
  const resolved = status ?? "unknown";

  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        resolved === "online" && "bg-emerald-500",
        resolved === "offline" && "bg-red-500",
        resolved === "unknown" && "bg-zinc-500",
        className,
      )}
      title={
        resolved === "online"
          ? "Online"
          : resolved === "offline"
            ? "Offline"
            : "Checking..."
      }
    />
  );
}
