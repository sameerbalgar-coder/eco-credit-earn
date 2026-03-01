import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ThumbsUp, Clock, MapPin, Loader2 } from "lucide-react";

const PublicFeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [reporters, setReporters] = useState<Record<string, string>>({});
  const [userUpvotes, setUserUpvotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("waste_reports").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("report_upvotes").select("report_id").eq("user_id", user.id),
    ]).then(async ([reportsRes, upvotesRes]) => {
      const data = reportsRes.data ?? [];
      setReports(data);
      setUserUpvotes(new Set((upvotesRes.data ?? []).map((u: any) => u.report_id)));

      const ids = [...new Set(data.map(r => r.reporter_id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
        const map: Record<string, string> = {};
        profiles?.forEach(p => { map[p.id] = p.display_name ?? "Citizen"; });
        setReporters(map);
      }
      setLoading(false);
    });
  }, [user]);

  const handleUpvote = async (reportId: string) => {
    if (!user || userUpvotes.has(reportId)) return;
    await supabase.from("report_upvotes").insert({ report_id: reportId, user_id: user.id } as any);
    setUserUpvotes(prev => new Set(prev).add(reportId));
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, upvote_count: (r.upvote_count ?? 0) + 1 } : r));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const statusColors: Record<string, string> = {
    pending: "bg-eco-warning/10 text-eco-warning",
    assigned: "bg-eco-info/10 text-eco-info",
    in_progress: "bg-primary/10 text-primary",
    completed: "bg-eco-success/10 text-eco-success",
    rejected: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Community Feed</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {r.photo_urls?.length > 0 && (
                <div className="flex gap-0.5 overflow-x-auto">
                  {r.photo_urls.slice(0, 2).map((url: string, i: number) => (
                    <img key={i} src={url} alt="" className="h-36 flex-1 object-cover min-w-0" />
                  ))}
                </div>
              )}
              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">{reporters[r.reporter_id] ?? "Citizen"}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(r.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusColors[r.status] ?? ""}`}>
                    {r.status?.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-foreground capitalize">{r.waste_type}{r.quantity_kg ? ` • ${r.quantity_kg} kg` : ""}</p>
                {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                {r.address && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.address}</p>}

                <button
                  onClick={() => handleUpvote(r.id)}
                  disabled={userUpvotes.has(r.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    userUpvotes.has(r.id)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" /> {r.upvote_count ?? 0}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicFeedPage;
