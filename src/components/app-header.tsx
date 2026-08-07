import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AppHeader({
  showNav = true,
}: {
  showNav?: boolean;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
          ZorthDeployHub
        </Link>
        {showNav ? (
          <nav className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Servers
            </Link>
            <Link href="/terminal" className="hover:text-foreground">
              Terminal
            </Link>
          </nav>
        ) : null}
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm">
          Logout
        </Button>
      </form>
    </header>
  );
}
