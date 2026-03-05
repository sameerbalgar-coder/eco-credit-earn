import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ClipboardList,
  Play,
  CheckCircle2,
  MapPin,
  Navigation,
  Clock,
  Coins,
  Shield,
  ChevronRight,
  AlertTriangle,
  Camera,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const badgeColors: Record<string, string> = {
  Bronze: "bg-[hsl(var(--eco-badge-bronze))]",
  Silver: "bg-[hsl(var(--eco-badge-silver))]",
  Gold: "bg-[hsl(var(--eco-badge-gold))]",
  Emerald: "bg-[hsl(var(--eco-badge-emerald))]",
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "High", color: "text-destructive", bg: "bg-destructive/10" },
  medium: { label: "Medium", color: "text-eco-warning", bg: "bg-eco-warning/10" },
  low: { label: "Low", color: "text-eco-success", bg: "bg-eco-success/10" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  assigned: { label: "Assigned", color: "text-eco-info", bg: "bg-eco-info/10" },
  in_progress: { label: "In Progress", color: "text-eco-warning", bg: "bg-eco-warning/10" },
  completed: { label: "Completed", color: "text-eco-success", bg: "bg-eco-success/10" },
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted" },
};

function getPriority(report: any): string {
  if (report?.waste_type === "hazardous" || report?.upvote_count >= 10) return "high";
  if (report?.upvote_count >= 5 || report?.quantity_kg >= 20) return "medium";
  return "low";
}

const WorkerDashboard = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false });

      if (taskData && taskData.length > 0) {
        setTasks(taskData);
        const reportIds = [...new Set(taskData.map((t) => t.report_id))];
        const { data: reportData } = await supabase
          .from("waste_reports")
          .select("*")
          .in("id", reportIds);
        if (reportData) {
          const map: Record<string, any> = {};
          reportData.forEach((r) => (map[r.id] = r));
          setReports(map);
        }
      }
      setLoading(false);
    };
    fetchTasks();
  }, [user]);

  const todayStr = new Date().toISOString().split("T")[0];
  const assignedCount = tasks.filter((t) => t.status === "assigned").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedTodayCount = tasks.filter(
    (t) => t.status === "completed" && t.completed_at?.startsWith(todayStr)
  ).length;

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const displayName = profile?.display_name ?? "Worker";
  const badgeLevel = profile?.badge_level ?? "Bronze";
  const credits = profile?.credits_balance ?? 0;

  return (
    <div className="space-y-5 px-4 py-6">
      {/* Worker Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl eco-gradient text-lg font-bold text-primary-foreground">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{displayName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary-foreground ${badgeColors[badgeLevel] || badgeColors.Bronze}`}>
                <Shield className="h-3 w-3" /> {badgeLevel}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Coins className="h-3 w-3" /> {credits} EC
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate("/notifications")}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
        >
          <AlertTriangle className="h-5 w-5 text-eco-warning" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up">
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-eco-info/10 mb-1.5">
            <ClipboardList className="h-4.5 w-4.5 text-eco-info" />
          </div>
          <span className="text-xl font-bold text-foreground">{assignedCount}</span>
          <span className="text-[10px] text-muted-foreground text-center">Assigned</span>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-primary/20 eco-gradient-soft p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-eco-warning/10 mb-1.5">
            <Play className="h-4.5 w-4.5 text-eco-warning" />
          </div>
          <span className="text-xl font-bold text-foreground">{inProgressCount}</span>
          <span className="text-[10px] text-muted-foreground text-center">In Progress</span>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-3.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-eco-success/10 mb-1.5">
            <CheckCircle2 className="h-4.5 w-4.5 text-eco-success" />
          </div>
          <span className="text-xl font-bold text-foreground">{completedTodayCount}</span>
          <span className="text-[10px] text-muted-foreground text-center">Done Today</span>
        </div>
      </div>

      {/* My Assigned Tasks */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">My Assigned Tasks</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : activeTasks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <CheckCircle2 className="h-7 w-7 text-eco-success" />
            </div>
            <p className="text-sm font-medium text-foreground">All clear!</p>
            <p className="mt-1 text-xs text-muted-foreground">No tasks assigned right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task) => {
              const report = reports[task.report_id];
              const priority = getPriority(report);
              const pConf = priorityConfig[priority];
              const sConf = statusConfig[task.status] ?? statusConfig.pending;
              const photoUrl = report?.photo_urls?.[0];

              return (
                <button
                  key={task.id}
                  onClick={() => navigate(`/worker/task/${task.id}`)}
                  className="flex w-full gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-all hover:eco-shadow active:scale-[0.98]"
                >
                  {/* Issue photo */}
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Task info */}
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground capitalize truncate">
                          {report?.waste_type ?? "Task"}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pConf.bg} ${pConf.color}`}>
                          {pConf.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{report?.address ?? "Location pending"}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${sConf.bg} ${sConf.color}`}>
                        {sConf.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed tasks summary */}
      {tasks.filter((t) => t.status === "completed").length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary">✅ Completed Tasks</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {tasks.filter((t) => t.status === "completed").length} tasks done total
              </p>
            </div>
            <button
              onClick={() => navigate("/worker/history")}
              className="text-xs font-medium text-primary"
            >
              View All →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerDashboard;
