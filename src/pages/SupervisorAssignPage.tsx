import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, UserCheck, MapPin, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SupervisorAssignPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    // Fetch unassigned/pending reports
    supabase
      .from("waste_reports")
      .select("*")
      .in("status", ["pending", "assigned"])
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setReports(data);
      });

    // Fetch workers
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "worker")
      .then(async ({ data }) => {
        if (data && data.length > 0) {
          const ids = data.map((r) => r.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", ids);
          if (profiles) setWorkers(profiles);
        }
      });
  }, []);

  const handleAssign = async () => {
    if (!selectedReport || !selectedWorker || !user) return;
    setAssigning(true);

    // Create task
    const { error: taskErr } = await supabase.from("tasks").insert({
      report_id: selectedReport,
      worker_id: selectedWorker,
      assigned_by: user.id,
      status: "assigned",
    });

    // Update report status
    if (!taskErr) {
      await supabase
        .from("waste_reports")
        .update({ status: "assigned", assigned_worker_id: selectedWorker, assigned_supervisor_id: user.id })
        .eq("id", selectedReport);

      // Notify worker
      await supabase.from("notifications").insert({
        user_id: selectedWorker,
        title: "New Task Assigned",
        message: "A supervisor has assigned you a new cleanup task.",
        type: "task",
      });

      toast({ title: "Task assigned!", description: "Worker has been notified." });
      setReports((prev) => prev.filter((r) => r.id !== selectedReport));
      setSelectedReport(null);
      setSelectedWorker(null);
    } else {
      toast({ title: "Error", description: taskErr.message, variant: "destructive" });
    }

    setAssigning(false);
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Assign Tasks</h1>
      </div>

      {/* Select Report */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Select a Report</h2>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending reports.</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  selectedReport === r.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize truncate">{r.waste_type}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.address || "No address"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Select Worker */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Assign to Worker</h2>
        {workers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workers registered yet.</p>
        ) : (
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {workers.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorker(w.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  selectedWorker === w.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <UserCheck className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{w.display_name || "Worker"}</p>
                  <p className="text-xs text-muted-foreground">{w.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Assign Button */}
      <button
        onClick={handleAssign}
        disabled={!selectedReport || !selectedWorker || assigning}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3.5 text-sm font-semibold text-primary-foreground transition-all disabled:opacity-50 active:scale-[0.98]"
      >
        <Send className="h-4 w-4" />
        {assigning ? "Assigning..." : "Assign Task"}
      </button>
    </div>
  );
};

export default SupervisorAssignPage;
