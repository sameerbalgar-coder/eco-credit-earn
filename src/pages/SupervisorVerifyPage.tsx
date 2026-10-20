import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, CheckCircle, XCircle, AlertTriangle, ThumbsUp, Loader2, MapPin, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const SupervisorVerifyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [reporters, setReporters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [flaggingReport, setFlaggingReport] = useState<any | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    if (!user) return;
    const loadReports = async () => {
      try {
        const { data } = await supabase
          .from("waste_reports")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (data) {
          setReports(data);
          const ids = [...new Set(data.map(r => r.reporter_id))];
          if (ids.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name, credibility_score, contribution_score")
              .in("id", ids);
            if (profiles) {
              const map: Record<string, any> = {};
              profiles.forEach(p => { map[p.id] = p; });
              setReporters(map);
            }
          }
        }
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    void loadReports();
  }, [user]);

  const handleAction = async (reportId: string, reporterId: string, action: "assigned" | "rejected", wasteType?: string, quantityKg?: number | null) => {
    try {
      if (action === "assigned") {
        const qty = quantityKg ?? 1;
        const baseCredits = Math.max(10, Math.round(qty * 15));
        const co2Kg = Math.round(qty * 2.5 * 10) / 10;
        const { error: rpcError } = await (supabase.rpc as any)("verify_completed_report", {
          p_report_id: reportId,
          p_supervisor_id: user!.id,
          p_credits_awarded: baseCredits,
          p_co2_kg: co2Kg,
        });
        if (rpcError) {
          // Fallback: direct update + award_carbon_credits
          await supabase.from("waste_reports").update({ status: "assigned" } as any).eq("id", reportId);
          await (supabase.rpc as any)("award_carbon_credits", {
            p_user_id: reporterId,
            p_amount: baseCredits,
            p_transaction_type: "report_verified",
            p_description: `Report verified: ${wasteType ?? "waste"} (${qty}kg)`,
            p_related_report_id: reportId,
            p_co2_kg: co2Kg,
          });
        }
      } else {
        await supabase.from("waste_reports").update({ status: "rejected" } as any).eq("id", reportId);
        const delta = -3;
        const current = reporters[reporterId]?.credibility_score ?? 50;
        await supabase.from("profiles").update({ credibility_score: Math.max(0, Math.min(100, current + delta)) } as any).eq("id", reporterId);
      }

      setReports(prev => prev.filter(r => r.id !== reportId));
      toast({
        title: action === "assigned" ? "Report Verified ✅" : "Report Rejected",
      });
    } catch {
      toast({ title: "Action failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleFlag = async () => {
    if (!flaggingReport) return;
    if (!flagReason.trim()) {
      toast({ title: "Reason required", description: "Please enter why this report is being flagged.", variant: "destructive" });
      return;
    }
    setFlagging(true);
    try {
      await supabase.from("waste_reports").update({
        status: "dismissed",
        supervisor_notes: `FLAGGED: ${flagReason.trim()}`,
      } as any).eq("id", flaggingReport.id);

      const delta = -10;
      const current = reporters[flaggingReport.reporter_id]?.credibility_score ?? 50;
      await supabase.from("profiles").update({
        credibility_score: Math.max(0, Math.min(100, current + delta)),
      } as any).eq("id", flaggingReport.reporter_id);

      setReports(prev => prev.filter(r => r.id !== flaggingReport.id));
      toast({
        title: "Report flagged as fraudulent",
        description: "Report dismissed and no worker will be assigned.",
      });
      setFlaggingReport(null);
      setFlagReason("");
    } catch {
      toast({ title: "Could not flag report", description: "Please try again.", variant: "destructive" });
    } finally {
      setFlagging(false);
    }
  };

  const getCredibilityColor = (score: number) => {
    if (score >= 70) return "text-eco-success";
    if (score >= 40) return "text-eco-warning";
    return "text-destructive";
  };

  const formatDateTime = (dateStr: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateStr));

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Verify Reports</h1>
        <span className="ml-auto rounded-full bg-eco-warning/10 px-2.5 py-1 text-xs font-semibold text-eco-warning">{reports.length} pending</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-eco-success mb-3" />
          <p className="text-sm font-medium text-foreground">All caught up!</p>
          <p className="text-xs text-muted-foreground mt-1">No pending reports to verify.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const reporter = reporters[r.reporter_id];
            const credibility = reporter?.credibility_score ?? 50;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {r.photo_urls?.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto">
                    {r.photo_urls.map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className="h-32 w-32 object-cover flex-shrink-0" />
                    ))}
                  </div>
                )}

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{reporter?.display_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Credibility: <span className={`font-semibold ${getCredibilityColor(credibility)}`}>{credibility}/100</span></p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-eco-warning" />
                      <span className="text-sm font-medium text-foreground capitalize">{r.waste_type}</span>
                      {r.quantity_kg && <span className="text-xs text-muted-foreground">• {r.quantity_kg} kg</span>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    {r.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {r.address}
                      </div>
                    )}
                  </div>

                  {(r.upvote_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <ThumbsUp className="h-3.5 w-3.5" /> {r.upvote_count} community upvotes
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 rounded-lg" onClick={() => handleAction(r.id, r.reporter_id, "assigned", r.waste_type, r.quantity_kg)}>
                      <CheckCircle className="mr-1.5 h-4 w-4" /> Verify & Approve
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg text-destructive border-destructive/30" onClick={() => handleAction(r.id, r.reporter_id, "rejected", r.waste_type, r.quantity_kg)}>
                      <XCircle className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </div>
                  <button
                    onClick={() => { setFlaggingReport(r); setFlagReason(""); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/5 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Flag className="h-3.5 w-3.5" /> Flag as Fake / Fraudulent
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Flag as Fake Dialog */}
      <Dialog open={!!flaggingReport} onOpenChange={(open) => { if (!open) { setFlaggingReport(null); setFlagReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-destructive" /> Flag as Fake / Fraudulent
            </DialogTitle>
            <DialogDescription>
              This report will be dismissed and no worker will be assigned. The reporter's credibility score will be penalized.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Reason</label>
            <Textarea
              placeholder="Explain why this report looks fraudulent (e.g. AI-generated photo, wrong location, duplicate, etc.)"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              className="rounded-xl min-h-[80px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFlaggingReport(null); setFlagReason(""); }} disabled={flagging}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleFlag} disabled={flagging}>
              {flagging ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Flag className="mr-1.5 h-4 w-4" />}
              {flagging ? "Flagging..." : "Flag & Dismiss"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorVerifyPage;
