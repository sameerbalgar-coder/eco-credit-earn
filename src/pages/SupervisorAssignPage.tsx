import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  UserCheck,
  MapPin,
  Send,
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  Camera,
  StickyNote,
  Weight,
  Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Tab = "pending" | "in_progress" | "completed";

interface Report {
  id: string;
  waste_type: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_urls: string[] | null;
  status: string;
  created_at: string;
  reporter_id: string;
  assigned_worker_id: string | null;
}

interface Task {
  id: string;
  report_id: string;
  worker_id: string;
  status: string;
  before_photo_url: string | null;
  after_photo_url: string | null;
  completion_notes: string | null;
  weight_kg: number | null;
  completed_at: string | null;
  started_at: string | null;
  created_at: string;
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const SupervisorAssignPage = () => {
  const navigate = useNavigate();
  const { user, onlineUserIds } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("pending");
  const [searchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get("type") ?? "all");
  const [reports, setReports] = useState<Report[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; email: string | null }>>({});
  const [workers, setWorkers] = useState<any[]>([]);

  const [assignFor, setAssignFor] = useState<Report | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [proofTask, setProofTask] = useState<{ task: Task; report: Report } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const refetch = async () => {
    const [{ data: rData }, { data: tData }] = await Promise.all([
      supabase.from("waste_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    ]);
    if (rData) setReports(rData as any);
    if (tData) setTasks(tData as any);

    const ids = new Set<string>();
    (rData ?? []).forEach((r: any) => {
      if (r.reporter_id) ids.add(r.reporter_id);
      if (r.assigned_worker_id) ids.add(r.assigned_worker_id);
    });
    (tData ?? []).forEach((t: any) => t.worker_id && ids.add(t.worker_id));
    if (ids.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", Array.from(ids));
      if (profs) {
        const map: Record<string, any> = {};
        profs.forEach((p: any) => (map[p.id] = { display_name: p.display_name, email: p.email }));
        setProfiles(map);
      }
    }
  };

  const loadWorkers = async () => {
    const { data } = await supabase.from("user_roles").select("user_id").eq("role", "worker");
    if (data && data.length > 0) {
      const ids = data.map((r) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      if (profs) setWorkers(profs);
    } else {
      setWorkers([]);
    }
  };

  useEffect(() => {
    refetch();
    loadWorkers();

    const ch = supabase
      .channel("supervisor_board")
      .on("postgres_changes", { event: "*", schema: "public", table: "waste_reports" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => loadWorkers())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadWorkers())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taskByReport = useMemo(() => {
    const map: Record<string, Task> = {};
    // pick latest task per report
    [...tasks]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((t) => {
        map[t.report_id] = t;
      });
    return map;
  }, [tasks]);

  const pending = reports.filter((r) => r.status === "pending");
  const inProgress = reports.filter((r) => r.status === "assigned" || r.status === "in_progress");
  const completed = reports.filter((r) => r.status === "completed" || r.status === "verified");

  const stats = {
    pending: pending.length,
    in_progress: inProgress.length,
    completed: completed.length,
  };

  const allTypes = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => r.waste_type && set.add(r.waste_type));
    return Array.from(set).sort();
  }, [reports]);

  const handleAssign = async () => {
    if (!assignFor || !selectedWorker || !user) return;
    setAssigning(true);

    const { error: taskErr } = await supabase.from("tasks").insert({
      report_id: assignFor.id,
      worker_id: selectedWorker,
      assigned_by: user.id,
      status: "assigned",
    });

    if (!taskErr) {
      await supabase
        .from("waste_reports")
        .update({ status: "assigned", assigned_worker_id: selectedWorker, assigned_supervisor_id: user.id })
        .eq("id", assignFor.id);

      await supabase.from("notifications").insert({
        user_id: selectedWorker,
        title: "New Task Assigned",
        message: "A supervisor has assigned you a new cleanup task.",
        type: "task",
      });

      // Also alert other workers in the area so they know activity is happening nearby
      await supabase.rpc("notify_role" as any, {
        _role: "worker",
        _title: "New task in your area",
        _message: `A ${assignFor.waste_type} cleanup was assigned${assignFor.address ? ` near ${assignFor.address}` : ""}.`,
        _type: "task",
      });

      toast({ title: "Task assigned!", description: "Worker has been notified." });
      setAssignFor(null);
      setSelectedWorker(null);
      refetch();
    } else {
      toast({ title: "Error", description: taskErr.message, variant: "destructive" });
    }
    setAssigning(false);
  };

  const tabList: { key: Tab; label: string; count: number; icon: any; color: string }[] = [
    { key: "pending", label: "Pending", count: stats.pending, icon: AlertTriangle, color: "text-destructive" },
    { key: "in_progress", label: "In Progress", count: stats.in_progress, icon: Clock, color: "text-eco-warning" },
    { key: "completed", label: "Completed", count: stats.completed, icon: CheckCircle, color: "text-eco-success" },
  ];

  const baseList = tab === "pending" ? pending : tab === "in_progress" ? inProgress : completed;
  const list = typeFilter === "all" ? baseList : baseList.filter((r) => r.waste_type === typeFilter);
  const onlineWorkerCount = workers.filter((w) => onlineUserIds.has(w.id)).length;

  return (
    <div className="px-4 py-6 space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Reports Board</h1>
          <p className="text-xs text-muted-foreground">Assign & track cleanup tasks</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {tabList.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-all ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <Icon className={`h-4 w-4 ${t.color}`} />
              <span className="text-[11px] font-medium text-foreground">{t.label}</span>
              <span className="text-xs font-bold text-foreground">{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Type filter chips */}
      {allTypes.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setTypeFilter("all")}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === "all" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            All
          </button>
          {allTypes.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                typeFilter === t ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}


      {/* List */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No {tabList.find((t) => t.key === tab)?.label.toLowerCase()} reports.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const task = taskByReport[r.id];
            const worker = task?.worker_id ? profiles[task.worker_id] : null;
            const reporter = r.reporter_id ? profiles[r.reporter_id] : null;
            const thumb = r.photo_urls?.[0];

            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex gap-3">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt="report"
                      onClick={() => setLightbox(thumb)}
                      className="h-16 w-16 shrink-0 cursor-zoom-in rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground capitalize">{r.waste_type}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{r.address || "No address"}</span>
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Reported by <span className="font-medium text-foreground">{reporter?.display_name || "Citizen"}</span>
                    </p>

                    {worker && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/5 px-2 py-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[11px] text-foreground">
                          Assigned to <span className="font-semibold">{worker.display_name || "Worker"}</span>
                        </span>
                        {task && (
                          <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                            {task.status.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex gap-2">
                  {tab === "pending" && (
                    <button
                      onClick={() => {
                        setAssignFor(r);
                        setSelectedWorker(null);
                      }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground active:scale-[0.98]"
                    >
                      <Send className="h-3.5 w-3.5" /> Assign
                    </button>
                  )}
                  {tab === "in_progress" && (
                    <button
                      onClick={() => {
                        setAssignFor(r);
                        setSelectedWorker(null);
                      }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground active:scale-[0.98]"
                    >
                      Reassign
                    </button>
                  )}
                  {tab === "completed" && task && (
                    <button
                      onClick={() => setProofTask({ task, report: r })}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground active:scale-[0.98]"
                    >
                      <Camera className="h-3.5 w-3.5" /> View Proof
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign bottom sheet */}
      {assignFor && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0"
          onClick={() => {
            setAssignFor(null);
            setSelectedWorker(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-background p-5 pb-8 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Assign worker to</p>
                <h2 className="text-base font-bold text-foreground capitalize">{assignFor.waste_type}</h2>
                <p className="text-xs text-muted-foreground">{assignFor.address || "No address"}</p>
              </div>
              <button
                onClick={() => {
                  setAssignFor(null);
                  setSelectedWorker(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {workers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No workers registered yet.</p>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex h-2 w-2 rounded-full bg-eco-success" />
                  <span>{onlineWorkerCount} online now</span>
                </div>
                <div className="space-y-2">
                  {[...workers]
                    .sort((a, b) => Number(onlineUserIds.has(b.id)) - Number(onlineUserIds.has(a.id)))
                    .map((w) => {
                      const online = onlineUserIds.has(w.id);
                      return (
                        <button
                          key={w.id}
                          onClick={() => setSelectedWorker(w.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                            selectedWorker === w.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="relative">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {(w.display_name || "W").slice(0, 2).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                online ? "bg-eco-success" : "bg-muted-foreground/40"
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{w.display_name || "Worker"}</p>
                            <p className="truncate text-xs text-muted-foreground">{w.email}</p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              online ? "bg-eco-success/10 text-eco-success" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {online ? "Online" : "Offline"}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}


            <button
              onClick={handleAssign}
              disabled={!selectedWorker || assigning}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary p-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 active:scale-[0.98]"
            >
              <Send className="h-4 w-4" />
              {assigning ? "Assigning..." : "Confirm Assignment"}
            </button>
          </div>
        </div>
      )}

      {/* Proof modal */}
      {proofTask && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60"
          onClick={() => setProofTask(null)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-background p-5 pb-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Proof of completion</p>
                <h2 className="text-base font-bold text-foreground capitalize">{proofTask.report.waste_type}</h2>
                <p className="text-xs text-muted-foreground">
                  by {profiles[proofTask.task.worker_id]?.display_name || "Worker"}
                </p>
              </div>
              <button
                onClick={() => setProofTask(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Before</p>
                {proofTask.task.before_photo_url ? (
                  <img
                    src={proofTask.task.before_photo_url}
                    alt="before"
                    onClick={() => setLightbox(proofTask.task.before_photo_url)}
                    className="h-40 w-full cursor-zoom-in rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    No photo
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">After</p>
                {proofTask.task.after_photo_url ? (
                  <img
                    src={proofTask.task.after_photo_url}
                    alt="after"
                    onClick={() => setLightbox(proofTask.task.after_photo_url)}
                    className="h-40 w-full cursor-zoom-in rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    No photo
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {proofTask.task.weight_kg != null && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
                  <Weight className="h-4 w-4 text-primary" />
                  <span className="text-xs text-foreground">
                    Weight collected: <span className="font-semibold">{proofTask.task.weight_kg} kg</span>
                  </span>
                </div>
              )}
              {proofTask.task.completion_notes && (
                <div className="flex gap-2 rounded-lg bg-muted/50 p-2.5">
                  <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-xs text-foreground">{proofTask.task.completion_notes}</p>
                </div>
              )}
              {proofTask.task.completed_at && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
                  <CheckCircle className="h-4 w-4 text-eco-success" />
                  <span className="text-xs text-foreground">
                    Completed {timeAgo(proofTask.task.completed_at)}
                  </span>
                </div>
              )}
              {proofTask.report.latitude && proofTask.report.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${proofTask.report.latitude},${proofTask.report.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border p-2.5 text-xs font-medium text-primary"
                >
                  <MapPin className="h-4 w-4" /> Open location in Maps
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox} alt="preview" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default SupervisorAssignPage;
