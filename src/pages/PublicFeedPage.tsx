import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ThumbsUp, Clock, MapPin, Loader2, ImagePlus, Send, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Tab = "posts" | "reports";

const PublicFeedPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("posts");
  const [reports, setReports] = useState<any[]>([]);
  const [reporters, setReporters] = useState<Record<string, string>>({});
  const [userUpvotes, setUserUpvotes] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; type: "image" | "video" } | null>(null);


  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("waste_reports").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("report_upvotes").select("report_id").eq("user_id", user.id),
      supabase.from("community_posts" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]).then(async ([reportsRes, upvotesRes, postsRes]: any) => {
      const data = reportsRes.data ?? [];
      setReports(data);
      setUserUpvotes(new Set((upvotesRes.data ?? []).map((u: any) => u.report_id)));
      setPosts(postsRes.data ?? []);

      const ids = [...new Set(data.map((r: any) => r.reporter_id))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids as string[]);
        const map: Record<string, string> = {};
        profiles?.forEach(p => { map[p.id] = p.display_name ?? "Citizen"; });
        setReporters(map);
      }
      setLoading(false);
    });

    const postsChannel = supabase
      .channel("community_posts_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_posts" },
        (payload) => {
          setPosts((prev) => prev.some((p) => p.id === (payload.new as any).id) ? prev : [payload.new as any, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_posts" },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
        }
      )
      .subscribe();

    const reportsChannel = supabase
      .channel("waste_reports_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waste_reports" },
        (payload) => {
          setReports((prev) => prev.some((r) => r.id === (payload.new as any).id) ? prev : [payload.new as any, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "waste_reports" },
        (payload) => {
          setReports((prev) => prev.map((r) => r.id === (payload.new as any).id ? { ...r, ...(payload.new as any) } : r));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(reportsChannel);
    };
  }, [user]);

  const handleUpvote = async (reportId: string) => {
    if (!user || userUpvotes.has(reportId)) return;
    await supabase.from("report_upvotes").insert({ report_id: reportId, user_id: user.id } as any);
    setUserUpvotes(prev => new Set(prev).add(reportId));
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, upvote_count: (r.upvote_count ?? 0) + 1 } : r));
  };

  const pickFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submitPost = async () => {
    if (!user || (!content.trim() && !file)) return;
    setPosting(true);
    try {
      let media_url: string | null = null;
      let media_type: "image" | "video" | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `community/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("report-photos").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        media_url = supabase.storage.from("report-photos").getPublicUrl(path).data.publicUrl;
        media_type = file.type.startsWith("video") ? "video" : "image";
      }
      const { data, error } = await supabase.from("community_posts" as any).insert({
        author_id: user.id,
        author_name: profile?.display_name ?? "Citizen",
        content: content.trim(),
        media_url,
        media_type,
      } as any).select().single();
      if (error) throw error;
      setPosts(prev => [data, ...prev]);
      setContent("");
      pickFile(null);
      toast({ title: "Posted! 🎉", description: "Your post is now on the community feed." });
    } catch (e: any) {
      toast({ title: "Couldn't post", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async (id: string) => {
    await supabase.from("community_posts" as any).delete().eq("id", id);
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
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
    <div className="px-4 py-6 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Community Feed</h1>
      </div>

      <div className="flex gap-2 rounded-xl bg-muted p-1">
        <button
          onClick={() => setTab("posts")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${tab === "posts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >Community Posts</button>
        <button
          onClick={() => setTab("reports")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${tab === "reports" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >Waste Reports</button>
      </div>

      {tab === "posts" && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share an environmental fact, event, or update..."
            className="min-h-[70px] resize-none text-sm"
          />
          {preview && (
            <div className="relative rounded-lg overflow-hidden">
              {file?.type.startsWith("video") ? (
                <video src={preview} className="w-full max-h-56 object-cover" controls />
              ) : (
                <img src={preview} alt="" className="w-full max-h-56 object-cover" />
              )}
              <button onClick={() => pickFile(null)} className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-1" /> Photo/Video
            </Button>
            <Button
              size="sm"
              className="ml-auto rounded-lg"
              disabled={posting || (!content.trim() && !file)}
              onClick={submitPost}
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Post</>}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === "posts" ? (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No posts yet. Be the first to share!
            </div>
          ) : posts.map(p => (
            <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {p.media_url && (p.media_type === "video" ? (
                <video
                  src={p.media_url}
                  className="w-full max-h-80 object-cover bg-black cursor-zoom-in"
                  controls
                  onClick={() => setViewer({ url: p.media_url, type: "video" })}
                />
              ) : (
                <img
                  src={p.media_url}
                  alt=""
                  className="w-full max-h-80 object-cover cursor-zoom-in"
                  onClick={() => setViewer({ url: p.media_url, type: "image" })}
                />
              ))}

              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">{p.author_name ?? "Citizen"}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(p.created_at)}</p>
                  </div>
                  {p.author_id === user?.id && (
                    <button onClick={() => deletePost(p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{p.content}</p>
              </div>
            </div>
          ))}
        </div>
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
