import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { TerminalWorkspace } from "@/components/terminal/terminal-workspace";

export default function TerminalPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading terminal...
          </div>
        }
      >
        <TerminalWorkspace />
      </Suspense>
    </div>
  );
}
