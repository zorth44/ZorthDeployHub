import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { useT } from "./i18n/useT";
import { LoginPage } from "./pages/LoginPage";
import { ServersPage } from "./pages/ServersPage";
import { TerminalPage } from "./pages/TerminalPage";
import { FilesPage } from "./pages/FilesPage";
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
          path="/"
          element={
            <Protected>
              <AppShell>
                <ServersPage />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/terminal"
          element={
            <Protected>
              <AppShell fullHeight>
                <TerminalPage />
              </AppShell>
            </Protected>
          }
        />
        <Route
          path="/files"
          element={
            <Protected>
              <AppShell fullHeight>
                <FilesPage />
              </AppShell>
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
