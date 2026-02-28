import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index";
import ReportPage from "./pages/ReportPage";
import HazardPage from "./pages/HazardPage";
import MapPage from "./pages/MapPage";
import WalletPage from "./pages/WalletPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import ProfilePage from "./pages/ProfilePage";
import AuthPage from "./pages/AuthPage";
import MaterialsPage from "./pages/MaterialsPage";
import NotificationsPage from "./pages/NotificationsPage";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import SupervisorAssignPage from "./pages/SupervisorAssignPage";
import SupervisorWorkersPage from "./pages/SupervisorWorkersPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const RoleBasedHome = () => {
  const { profile } = useAuth();
  const role = profile?.role;
  if (role === "supervisor") return <SupervisorDashboard />;
  // admin will get its own dashboard later
  return <Index />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<RoleBasedHome />} />
                      <Route path="/report" element={<ReportPage />} />
                      <Route path="/hazard" element={<HazardPage />} />
                      <Route path="/map" element={<MapPage />} />
                      <Route path="/wallet" element={<WalletPage />} />
                      <Route path="/leaderboard" element={<LeaderboardPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/materials" element={<MaterialsPage />} />
                      <Route path="/notifications" element={<NotificationsPage />} />
                      <Route path="/supervisor/assign" element={<SupervisorAssignPage />} />
                      <Route path="/supervisor/workers" element={<SupervisorWorkersPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
