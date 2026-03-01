import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, CheckCircle, XCircle, AlertTriangle, ThumbsUp, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AdminVerifyPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [reporters, setReporters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("waste_reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        if (data) {
          setReports(data);
          // Fetch reporter profiles for credibility
          const ids = [...new Set(data.map(r => r.reporter_id))];
          if (ids.length > 0) {
            const { data: profiles } = await supabase.from("profiles").select("id, display_name, credibility_score, contribution_score").in("id", ids);
            if (profiles) {
              const map: Record<string, any> = {};
              profiles.forEach(p => { map[p.id] = p; });
              setReporters(map);
            }
          }
        }
        setLoading(false);
      });
  }, [user]);

  const handleAction = async (reportId: string, reporterId: string, action: "assigned" | "rejected") => {
    await supabase.from("waste_reports").update({ status: action } as any).eq("id", reportId);

    // Update credibility score
    const delta = action === "assigned" ? 5 : -3;
    const current = reporters[reporterId]?.credibility_score ?? 50;
    await supabase.from("profiles").update({ credibility_score: Math.max(0, Math.min(100, current + delta)) } as any).eq("id", reporterId);

    setReports(prev => prev.filter(r => r.id !== reportId));
    toast({ title: action === "assigned" ? "Report Verified ✅" : "Report Rejected" });
  };

  const getCredibilityColor = (score: number) => {
    if (score >= 70) return "text-eco-success";
    if (score >= 40) return "text-eco-warning";
    return "text-destructive";
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
                {/* Photos */}
                {r.photo_urls?.length > 0 && (
                  <div className="flex gap-1 overflow-x-auto">
                    {r.photo_urls.map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className="h-32 w-32 object-cover flex-shrink-0" />
                    ))}
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Reporter info + credibility */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{reporter?.display_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Credibility: <span className={`font-semibold ${getCredibilityColor(credibility)}`}>{credibility}/100</span></p>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                  </div>

                  {/* Report details */}
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

                  {/* Upvotes */}
                  {(r.upvote_count ?? 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <ThumbsUp className="h-3.5 w-3.5" /> {r.upvote_count} community upvotes
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 rounded-lg" onClick={() => handleAction(r.id, r.reporter_id, "assigned")}>
                      <CheckCircle className="mr-1.5 h-4 w-4" /> Verify & Approve
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg text-destructive border-destructive/30" onClick={() => handleAction(r.id, r.reporter_id, "rejected")}>
                      <XCircle className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminVerifyPage;
