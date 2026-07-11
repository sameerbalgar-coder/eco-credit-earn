import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Post {
  id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const SupervisorCommunityPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });
    setPosts((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("supervisor_community")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from("community_posts").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Post removed" });
      setPosts((p) => p.filter((x) => x.id !== id));
    }
    setConfirmId(null);
  };

  return (
    <div className="px-4 py-6 space-y-5 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Community Feed</h1>
          <p className="text-xs text-muted-foreground">Moderate posts from citizens & volunteers</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <p className="text-xs text-foreground">
          {posts.length} post{posts.length !== 1 ? "s" : ""} • Remove inappropriate content
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">No community posts yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.author_name || "Anonymous"}</p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(p.created_at)}</p>
                </div>
                <button
                  onClick={() => setConfirmId(p.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {p.content && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{p.content}</p>}
              {p.media_url && p.media_type?.startsWith("image") && (
                <img src={p.media_url} alt="post" className="mt-2 max-h-64 w-full rounded-lg object-cover" />
              )}
              {p.media_url && p.media_type?.startsWith("video") && (
                <video src={p.media_url} controls className="mt-2 max-h-64 w-full rounded-lg" />
              )}
            </div>
          ))}
        </div>
      )}

      {confirmId && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground">Remove this post?</h3>
            <p className="mt-1 text-xs text-muted-foreground">This action cannot be undone.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => remove(confirmId)}
                className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorCommunityPage;
