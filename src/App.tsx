import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MaterialsPage from "./pages/MaterialsPage";
import NotificationsPage from "./pages/NotificationsPage";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import SupervisorAssignPage from "./pages/SupervisorAssignPage";
import SupervisorWorkersPage from "./pages/SupervisorWorkersPage";
import SupervisorCommunityPage from "./pages/SupervisorCommunityPage";
import SupervisorHotspotsPage from "./pages/SupervisorHotspotsPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVerifyPage from "./pages/AdminVerifyPage";
import AdminZonesPage from "./pages/AdminZonesPage";
import ZoneStaffPage from "./pages/ZoneStaffPage";
import AdminCreditsPage from "./pages/AdminCreditsPage";
import AdminOffersPage from "./pages/AdminOffersPage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import ReportHistoryPage from "./pages/ReportHistoryPage";
import CommunityPage from "./pages/CommunityPage";
import RecyclingPage from "./pages/RecyclingPage";
import PickupsPage from "./pages/PickupsPage";
import StaffPickupsPage from "./pages/StaffPickupsPage";
import PublicFeedPage from "./pages/PublicFeedPage";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerTaskDetail from "./pages/WorkerTaskDetail";
import WorkerHistoryPage from "./pages/WorkerHistoryPage";
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

const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  );
};

const RoleBasedHome = () => {
  const { profile } = useAuth();
  const role = profile?.role;
  if (role === "worker") return <WorkerDashboard />;
  if (role === "supervisor") return <SupervisorDashboard />;
  if (role === "admin") return <AdminDashboard />;
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
            <Route path="/reset-password" element={<ResetPasswordPage />} />
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
                      <Route path="/reports" element={<ReportHistoryPage />} />
                      <Route path="/feed" element={<PublicFeedPage />} />
                      <Route path="/community" element={<CommunityPage />} />
                      <Route path="/recycling" element={<RecyclingPage />} />
                      <Route path="/pickups" element={<PickupsPage />} />
                      <Route path="/staff/pickups" element={<StaffPickupsPage />} />

                      <Route path="/worker/task/:taskId" element={<WorkerTaskDetail />} />
                      <Route path="/worker/history" element={<WorkerHistoryPage />} />
                      <Route path="/supervisor/assign" element={<SupervisorAssignPage />} />
                      <Route path="/supervisor/workers" element={<SupervisorWorkersPage />} />
                      <Route path="/supervisor/community" element={<SupervisorCommunityPage />} />
                      <Route path="/supervisor/hotspots" element={<SupervisorHotspotsPage />} />
                      <Route path="/admin/verify" element={<AdminVerifyPage />} />
                      <Route path="/admin/zones" element={<AdminZonesPage />} />
                      <Route path="/admin/zones/:zoneId/staff" element={<ZoneStaffPage />} />
                      <Route path="/admin/credits" element={<AdminCreditsPage />} />
                      <Route path="/admin/offers" element={<AdminOffersPage />} />
                      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
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
