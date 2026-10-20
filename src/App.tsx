import React, { Suspense, lazy } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "./components/AppLayout";
const Index = lazy(() => import("./pages/Index"));
const ReportPage = lazy(() => import("./pages/ReportPage"));
const HazardPage = lazy(() => import("./pages/HazardPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const MaterialsPage = lazy(() => import("./pages/MaterialsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SupervisorDashboard = lazy(() => import("./pages/SupervisorDashboard"));
const SupervisorAssignPage = lazy(() => import("./pages/SupervisorAssignPage"));
const SupervisorWorkersPage = lazy(() => import("./pages/SupervisorWorkersPage"));
const SupervisorCommunityPage = lazy(() => import("./pages/SupervisorCommunityPage"));
const SupervisorHotspotsPage = lazy(() => import("./pages/SupervisorHotspotsPage"));
const SupervisorVerifyPage = lazy(() => import("./pages/SupervisorVerifyPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminVerifyPage = lazy(() => import("./pages/AdminVerifyPage"));
const AdminZonesPage = lazy(() => import("./pages/AdminZonesPage"));
const ZoneStaffPage = lazy(() => import("./pages/ZoneStaffPage"));
const AdminCreditsPage = lazy(() => import("./pages/AdminCreditsPage"));
const AdminOffersPage = lazy(() => import("./pages/AdminOffersPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/AdminAnalyticsPage"));
const ReportHistoryPage = lazy(() => import("./pages/ReportHistoryPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const RecyclingPage = lazy(() => import("./pages/RecyclingPage"));
const PickupsPage = lazy(() => import("./pages/PickupsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const StaffPickupsPage = lazy(() => import("./pages/StaffPickupsPage"));
const PublicFeedPage = lazy(() => import("./pages/PublicFeedPage"));
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const WorkerTaskDetail = lazy(() => import("./pages/WorkerTaskDetail"));
const WorkerHistoryPage = lazy(() => import("./pages/WorkerHistoryPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

const PageTransition = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => {
    const location = useLocation();
    return (
      <div ref={ref} key={location.pathname} className="page-enter">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    );
  }
);
PageTransition.displayName = "PageTransition";

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
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading…</div>}>
          <Routes>
            <Route path="/auth" element={<PageTransition><AuthPage /></PageTransition>} />
            <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PageTransition>
                    <Routes>
                      <Route path="/" element={<RoleBasedHome />} />
                      <Route path="/index" element={<Navigate to="/" replace />} />
                      <Route path="/index.html" element={<Navigate to="/" replace />} />
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
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/help" element={<HelpPage />} />
                      <Route path="/staff/pickups" element={<StaffPickupsPage />} />

                      <Route path="/worker/task/:taskId" element={<WorkerTaskDetail />} />
                      <Route path="/worker/history" element={<WorkerHistoryPage />} />
                      <Route path="/supervisor/assign" element={<SupervisorAssignPage />} />
                      <Route path="/supervisor/workers" element={<SupervisorWorkersPage />} />
                      <Route path="/supervisor/community" element={<SupervisorCommunityPage />} />
                      <Route path="/supervisor/hotspots" element={<SupervisorHotspotsPage />} />
                      <Route path="/supervisor/verify" element={<SupervisorVerifyPage />} />
                      <Route path="/admin/hotspots" element={<SupervisorHotspotsPage />} />
                      <Route path="/admin/verify" element={<AdminVerifyPage />} />
                      <Route path="/admin/zones" element={<AdminZonesPage />} />
                      <Route path="/admin/zones/:zoneId/staff" element={<ZoneStaffPage />} />
                      <Route path="/admin/credits" element={<AdminCreditsPage />} />
                      <Route path="/admin/offers" element={<AdminOffersPage />} />
                      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </PageTransition>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
