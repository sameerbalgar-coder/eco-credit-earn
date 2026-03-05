import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, CheckCircle2, Clock, Camera } from "lucide-react";

const WorkerHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("worker_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      if (data && data.length > 0) {
        setTasks(data);
        const ids = [...new Set(data.map((t) => t.report_id))];
        const { data: rData } = await supabase.from("waste_reports").select("*").in("id", ids);
        if (rData) {
          const m: Record<string, any> = {};
          rData.forEach((r) => (m[r.id] = r));
          setReports(m);
        }
      }
    };
    fetch();
  }, [user]);

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Completed Tasks</h1>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No completed tasks yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const report = reports[task.report_id];
            const duration = task.started_at && task.completed_at
              ? Math.floor((new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 60000)
              : null;

            return (
              <button
                key={task.id}
                onClick={() => navigate(`/worker/task/${task.id}`)}
                className="flex w-full gap-3 rounded-2xl border border-border bg-card p-3.5 text-left"
              >
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {report?.photo_urls?.[0] ? (
                    <img src={report.photo_urls[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Camera className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground capitalize">{report?.waste_type ?? "Task"}</p>
                  <p className="text-xs text-muted-foreground truncate">{report?.address ?? "—"}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-eco-success">
                      <CheckCircle2 className="h-3 w-3" /> Completed
                    </span>
                    {duration !== null && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {duration < 60 ? `${duration}m` : `${Math.floor(duration / 60)}h ${duration % 60}m`}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkerHistoryPage;
