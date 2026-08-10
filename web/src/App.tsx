import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { useT } from "./i18n/useT";
import { LoginPage } from "./pages/LoginPage";
import { ServersPage } from "./pages/ServersPage";
import { TerminalWorkspace } from "./components/TerminalWorkspace";
import { AppShell } from "./components/AppShell";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const t = useT();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
        {t("common.loading")}
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <Protected>
              <Workspace />
            </Protected>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

function Workspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const terminalVisible = location.pathname === "/terminal" || location.pathname === "/files";
  const serversVisible = location.pathname === "/";

  useEffect(() => {
    if (location.pathname === "/files") {
      const params = new URLSearchParams(location.search);
      params.set("files", "1");
      navigate(`/terminal?${params.toString()}`, { replace: true });
    } else if (!serversVisible && !terminalVisible) {
      navigate("/", { replace: true });
    }
  }, [location.pathname, location.search, navigate, serversVisible, terminalVisible]);

  return (
    <AppShell fullHeight>
      <div className={serversVisible ? "h-full overflow-y-auto" : "hidden"}>
        <ServersPage />
      </div>
      <div className={terminalVisible ? "h-full min-h-0" : "hidden"}>
        <TerminalWorkspace visible={terminalVisible} />
      </div>
    </AppShell>
  );
}
