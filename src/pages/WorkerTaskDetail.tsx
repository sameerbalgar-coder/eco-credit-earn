import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  MapPin,
  Clock,
  Camera,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Navigation,
  Image,
  FileText,
  Wrench,
  Package,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  assigned: { label: "Assigned", color: "text-eco-info", bg: "bg-eco-info/10" },
  in_progress: { label: "In Progress", color: "text-eco-warning", bg: "bg-eco-warning/10" },
  completed: { label: "Completed", color: "text-eco-success", bg: "bg-eco-success/10" },
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted" },
};

const WorkerTaskDetail = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [beforePhoto, setBeforePhoto] = useState<{ file: File; preview: string } | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [showWorkLog, setShowWorkLog] = useState(false);

  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!taskId) return;
    const fetch = async () => {
      const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (t) {
        setTask(t);
        setCompletionNotes(t.completion_notes ?? "");
        setMaterialsUsed(t.materials_used ?? "");
        setWeightKg(t.weight_kg ? String(t.weight_kg) : "");
        if (t.before_photo_url) setBeforePhoto({ file: null as any, preview: t.before_photo_url });
        if (t.after_photo_url) setAfterPhoto({ file: null as any, preview: t.after_photo_url });

        const { data: r } = await supabase.from("waste_reports").select("*").eq("id", t.report_id).single();
        if (r) setReport(r);
      }
      setLoading(false);
    };
    fetch();
  }, [taskId]);

  const uploadPhoto = async (file: File, prefix: string) => {
    if (!user) return null;
    const fileName = `${user.id}/${prefix}-${Date.now()}-${file.name}`;
    const { data } = await supabase.storage.from("report-photos").upload(fileName, file);
    if (data) {
      const { data: urlData } = supabase.storage.from("report-photos").getPublicUrl(data.path);
      return urlData.publicUrl;
    }
    return null;
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!task) return;
    setUpdating(true);
    try {
      const updates: any = { status: newStatus };

      if (newStatus === "in_progress" && !task.started_at) {
        updates.started_at = new Date().toISOString();
      }

      if (newStatus === "completed") {
        if (!beforePhoto?.preview || !afterPhoto?.preview) {
          toast({ title: "Photos Required", description: "Upload both before and after photos to complete.", variant: "destructive" });
          setUpdating(false);
          return;
        }

        // Upload new photos if they are files
        if (beforePhoto.file) {
          const url = await uploadPhoto(beforePhoto.file, "before");
          if (url) updates.before_photo_url = url;
        }
        if (afterPhoto.file) {
          const url = await uploadPhoto(afterPhoto.file, "after");
          if (url) updates.after_photo_url = url;
        }

        updates.completed_at = new Date().toISOString();
        updates.completion_notes = completionNotes || null;
        updates.materials_used = materialsUsed || null;
        updates.weight_kg = weightKg ? parseFloat(weightKg) : null;
      }

      // Save photos on any status update if new files
      if (newStatus !== "completed") {
        if (beforePhoto?.file) {
          const url = await uploadPhoto(beforePhoto.file, "before");
          if (url) updates.before_photo_url = url;
        }
        if (afterPhoto?.file) {
          const url = await uploadPhoto(afterPhoto.file, "after");
          if (url) updates.after_photo_url = url;
        }
      }

      const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
      if (error) throw error;

      // Update report status too
      if (newStatus === "in_progress") {
        await supabase.from("waste_reports").update({ status: "in_progress" }).eq("id", task.report_id);
      } else if (newStatus === "completed") {
        await supabase.from("waste_reports").update({ status: "completed" }).eq("id", task.report_id);
      }

      setTask({ ...task, ...updates });
      toast({ title: "Updated", description: `Task marked as ${newStatus.replace("_", " ")}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setUpdating(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "before" | "after") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === "before") setBeforePhoto({ file, preview });
    else setAfterPhoto({ file, preview });
  };

  const openGoogleMaps = () => {
    if (!report?.latitude || !report?.longitude) return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`, "_blank");
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getDuration = () => {
    if (!task?.started_at) return null;
    const start = new Date(task.started_at).getTime();
    const end = task.completed_at ? new Date(task.completed_at).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!task || !report) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Task not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Go Back</Button>
      </div>
    );
  }

  const sConf = statusConfig[task.status] ?? statusConfig.pending;
  const photoUrl = report.photo_urls?.[0];

  return (
    <div className="px-4 py-5 space-y-5 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground capitalize">{report.waste_type} Issue</h1>
          <p className="text-xs text-muted-foreground">Task #{task.id.slice(0, 8)}</p>
        </div>
        <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${sConf.bg} ${sConf.color}`}>
          {sConf.label}
        </span>
      </div>

      {/* Citizen Photo */}
      {photoUrl && (
        <div className="overflow-hidden rounded-2xl border border-border">
          <img src={photoUrl} alt="Issue" className="w-full h-48 object-cover" />
        </div>
      )}

      {/* Report Info */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-eco-warning flex-shrink-0" />
          <span className="font-medium text-foreground capitalize">{report.waste_type}</span>
          {report.quantity_kg && <span className="text-muted-foreground">• {report.quantity_kg} kg</span>}
        </div>
        {report.description && (
          <p className="text-sm text-muted-foreground">{report.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Reported {timeAgo(report.created_at)}</span>
        </div>
        {getDuration() && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Time spent: {getDuration()}</span>
          </div>
        )}
      </div>

      {/* Location & Map */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="h-44 bg-muted relative">
          {report.latitude && report.longitude ? (
            <iframe
              src={`https://www.google.com/maps?q=${report.latitude},${report.longitude}&z=16&output=embed`}
              className="w-full h-full border-0"
              loading="lazy"
              allowFullScreen
              title="Task Location"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-foreground truncate">{report.address ?? "GPS coordinates"}</span>
          </div>
          {report.latitude && report.longitude && (
            <Button
              variant="outline"
              className="w-full rounded-xl gap-2"
              onClick={openGoogleMaps}
            >
              <Navigation className="h-4 w-4" /> Navigate with Google Maps
            </Button>
          )}
        </div>
      </div>

      {/* Proof of Work */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Camera className="h-4 w-4" /> Proof of Work
        </h2>
        <input ref={beforeRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoSelect(e, "before")} />
        <input ref={afterRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotoSelect(e, "after")} />

        <div className="grid grid-cols-2 gap-3">
          {/* Before */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">📷 Before Cleaning</p>
            <button
              onClick={() => beforeRef.current?.click()}
              className="flex w-full aspect-[4/3] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 overflow-hidden transition-colors hover:border-primary/40"
            >
              {beforePhoto?.preview ? (
                <img src={beforePhoto.preview} alt="Before" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground">Take Photo</span>
                </>
              )}
            </button>
          </div>

          {/* After */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">✅ After Cleaning</p>
            <button
              onClick={() => afterRef.current?.click()}
              className="flex w-full aspect-[4/3] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50 overflow-hidden transition-colors hover:border-primary/40"
            >
              {afterPhoto?.preview ? (
                <img src={afterPhoto.preview} alt="After" className="h-full w-full object-cover" />
              ) : (
                <>
                  <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground">Take Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Work Log (Collapsible) */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowWorkLog(!showWorkLog)}
          className="flex w-full items-center justify-between p-4"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="h-4 w-4" /> Work Log (Optional)
          </span>
          <ChevronLeft className={`h-4 w-4 text-muted-foreground transition-transform ${showWorkLog ? "-rotate-90" : ""}`} />
        </button>
        {showWorkLog && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Package className="h-3.5 w-3.5" /> Materials Used
              </label>
              <Input
                placeholder="e.g. Bags, gloves, broom..."
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
                className="rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Wrench className="h-3.5 w-3.5" /> Weight Collected (kg)
              </label>
              <Input
                type="number"
                placeholder="e.g. 15"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="rounded-xl text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <MessageSquare className="h-3.5 w-3.5" /> Notes
              </label>
              <Textarea
                placeholder="Additional notes..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="rounded-xl text-sm min-h-[60px]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons - Fixed at bottom */}
      {task.status !== "completed" && (
        <div className="fixed bottom-[4.5rem] left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md px-4 py-3">
          <div className="mx-auto max-w-lg space-y-2">
            {task.status === "assigned" && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleStatusUpdate("in_progress")}
                  disabled={updating}
                  className="w-full rounded-xl py-5 gap-2 text-sm font-semibold"
                >
                  <Play className="h-4 w-4" /> Start Task
                </Button>
                <Button
                  variant="outline"
                  onClick={openGoogleMaps}
                  className="w-full rounded-xl py-5 gap-2 text-sm"
                >
                  <Navigation className="h-4 w-4" /> Navigate
                </Button>
              </div>
            )}
            {task.status === "in_progress" && (
              <div className="space-y-2">
                <Button
                  onClick={() => handleStatusUpdate("completed")}
                  disabled={updating || !beforePhoto || !afterPhoto}
                  className="w-full rounded-xl py-5 gap-2 text-sm font-semibold bg-eco-success hover:bg-eco-success/90 text-primary-foreground"
                >
                  <CheckCircle2 className="h-4 w-4" /> {updating ? "Saving..." : "Mark Completed"}
                </Button>
                {(!beforePhoto || !afterPhoto) && (
                  <p className="text-center text-[10px] text-muted-foreground">
                    ⚠️ Upload both before & after photos to complete
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerTaskDetail;
