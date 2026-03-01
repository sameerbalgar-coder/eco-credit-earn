import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronRight, ThumbsUp, Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-eco-warning", bg: "bg-eco-warning/10" },
  assigned: { label: "Verified", color: "text-eco-info", bg: "bg-eco-info/10" },
  in_progress: { label: "Task Assigned", color: "text-primary", bg: "bg-primary/10" },
  completed: { label: "Resolved", color: "text-eco-success", bg: "bg-eco-success/10" },
  rejected: { label: "Rejected", color: "text-destructive", bg: "bg-destructive/10" },
};

const ReportHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("waste_reports")
      .select("*")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setReports(data);
        setLoading(false);
      });
  }, [user]);

  const handleUpvote = async (reportId: string) => {
    if (!user) return;
    const { error } = await supabase.from("report_upvotes").insert({ report_id: reportId, user_id: user.id } as any);
    if (!error) {
      await supabase.from("waste_reports").update({ upvote_count: reports.find(r => r.id === reportId)?.upvote_count + 1 } as any).eq("id", reportId);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, upvote_count: (r.upvote_count ?? 0) + 1 } : r));
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">My Reports</h1>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No reports yet. Start by reporting waste!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const status = statusConfig[r.status] ?? statusConfig.pending;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${status.bg}`}>
                      {r.status === "completed" ? (
                        <CheckCircle className={`h-5 w-5 ${status.color}`} />
                      ) : r.status === "rejected" ? (
                        <AlertTriangle className={`h-5 w-5 ${status.color}`} />
                      ) : (
                        <Clock className={`h-5 w-5 ${status.color}`} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">{r.waste_type}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {r.description && (
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                )}

                {r.photo_urls && r.photo_urls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {r.photo_urls.slice(0, 3).map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {r.quantity_kg && <span>{r.quantity_kg} kg</span>}
                    {r.address && <span className="truncate max-w-[150px]">{r.address}</span>}
                  </div>
                  <button
                    onClick={() => handleUpvote(r.id)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    {r.upvote_count ?? 0}
                  </button>
                </div>

                {/* Status Progress */}
                <div className="flex items-center gap-1">
                  {["pending", "assigned", "in_progress", "completed"].map((s, i) => {
                    const steps = ["pending", "assigned", "in_progress", "completed"];
                    const currentIdx = steps.indexOf(r.status);
                    return (
                      <div
                        key={s}
                        className={`h-1 flex-1 rounded-full ${i <= currentIdx ? "eco-gradient" : "bg-muted"}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReportHistoryPage;
