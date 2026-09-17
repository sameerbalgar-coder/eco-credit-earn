import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ecoLogo from "@/assets/ecocredit-logo.png";
import StatCard from "@/components/StatCard";
import {
  Users,
  ClipboardList,
  MapPin,
  Camera,
  Bell,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  UserPlus,
  Send,
  Flame,
  MessageSquare,
  Truck,
} from "lucide-react";

const SupervisorDashboard = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0 });

  useEffect(() => {
    if (!user) return;

    // Fetch pending waste reports (unassigned)
    supabase
      .from("waste_reports")
      .select("*")
      .in("status", ["pending", "assigned"])
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setPendingReports(data);
      });

    // Fetch tasks assigned by this supervisor
    supabase
      .from("tasks")
      .select("*")
      .eq("assigned_by", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          setActiveTasks(data);
          setStats({
            pending: data.filter((t) => t.status === "pending" || t.status === "assigned").length,
            inProgress: data.filter((t) => t.status === "in_progress").length,
            completed: data.filter((t) => t.status === "completed").length,
          });
        }
      });

    // Unread notifications
    supabase
      .from("notifications")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("read", false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const displayName = profile?.display_name ?? "Supervisor";

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ecoLogo} alt="EcoCredit" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Supervisor Panel</h1>
            <p className="text-xs text-muted-foreground">Hello, {displayName} 👋</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/notifications")}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up">
        <StatCard icon={Clock} label="Pending" value={stats.pending.toString()} variant="primary" />
        <StatCard icon={AlertTriangle} label="In Progress" value={stats.inProgress.toString()} />
        <StatCard icon={CheckCircle} label="Completed" value={stats.completed.toString()} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Supervisor Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/supervisor/assign")}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.97]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Assign Tasks</p>
              <p className="text-[10px] text-muted-foreground">Manage reports</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/supervisor/workers")}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.97]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Workers</p>
              <p className="text-[10px] text-muted-foreground">Add & manage</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/map")}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.97]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Map View</p>
              <p className="text-[10px] text-muted-foreground">All locations</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/supervisor/hotspots")}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.97]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
              <Flame className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Hotspots</p>
              <p className="text-[10px] text-muted-foreground">Report density</p>
            </div>
          </button>

          <button
            onClick={() => navigate("/supervisor/community")}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.97]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Community</p>
              <p className="text-[10px] text-muted-foreground">Moderate feed</p>
            </div>
          </button>

        </div>
      </div>


      {/* Pending Reports to Assign */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Pending Reports</h2>
          <button onClick={() => navigate("/supervisor/assign")} className="text-xs font-medium text-primary">
            View All
          </button>
        </div>
        {pendingReports.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No pending reports right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingReports.slice(0, 5).map((r: any) => (
              <div
                key={r.id}
                onClick={() => navigate("/supervisor/assign")}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card p-3.5 transition-all hover:eco-shadow"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      r.status === "pending" ? "bg-destructive/10" : "bg-eco-warning/10"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        r.status === "pending" ? "text-destructive" : "text-eco-warning"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{r.waste_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.address ? r.address.slice(0, 30) : "No address"} • {timeAgo(r.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                      r.status === "pending"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-eco-warning/10 text-eco-warning"
                    }`}
                  >
                    {r.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Tasks */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Your Tasks</h2>
        </div>
        {activeTasks.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No tasks assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeTasks.slice(0, 5).map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      t.status === "completed"
                        ? "bg-eco-success/10"
                        : t.status === "in_progress"
                        ? "bg-eco-info/10"
                        : "bg-eco-warning/10"
                    }`}
                  >
                    {t.status === "completed" ? (
                      <CheckCircle className="h-5 w-5 text-eco-success" />
                    ) : (
                      <Clock className="h-5 w-5 text-eco-warning" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">Task</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium capitalize ${
                    t.status === "completed"
                      ? "text-eco-success"
                      : t.status === "in_progress"
                      ? "text-eco-info"
                      : "text-eco-warning"
                  }`}
                >
                  {t.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupervisorDashboard;
