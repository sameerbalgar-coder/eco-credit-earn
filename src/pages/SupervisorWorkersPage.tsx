import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, UserPlus, Users, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const SupervisorWorkersPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, onlineUserIds } = useAuth();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const onlineCount = workers.filter((w) => onlineUserIds.has(w.id)).length;

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "worker");

    if (roles && roles.length > 0) {
      const ids = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email, credits_balance, co2_saved_kg, contribution_score")
        .in("id", ids);
      if (profiles) setWorkers(profiles);
    }
    setLoading(false);
  };

  const shareLocation = (worker: any) => {
    // Try to get current location and send as notification
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        await supabase.from("notifications").insert({
          user_id: worker.id,
          title: "📍 Location Shared",
          message: `Supervisor shared a location with you: ${mapUrl}`,
          type: "location",
        });
        toast({ title: "Location shared!", description: `Sent to ${worker.display_name || "worker"}.` });
      },
      () => {
        toast({ title: "Could not get location", variant: "destructive" });
      }
    );
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Workers</h1>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Team Overview</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {workers.length} worker{workers.length !== 1 ? "s" : ""} registered • <span className="font-semibold text-eco-success">{onlineCount} online now</span>
        </p>
      </div>

      {/* Worker List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">No workers yet</p>
          <p className="text-xs text-muted-foreground mt-1">Workers need to sign up with the "Worker" role.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...workers]
            .sort((a, b) => Number(onlineUserIds.has(b.id)) - Number(onlineUserIds.has(a.id)))
            .map((w) => {
              const online = onlineUserIds.has(w.id);
              return (
            <div key={w.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(w.display_name || "W").slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                        online ? "bg-eco-success" : "bg-muted-foreground/40"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{w.display_name || "Worker"}</p>
                    <p className="text-xs text-muted-foreground">{w.email}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    online ? "bg-eco-success/10 text-eco-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {online ? "Online" : "Offline"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold text-foreground">{w.credits_balance}</p>
                  <p className="text-[10px] text-muted-foreground">Credits</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{w.co2_saved_kg}kg</p>
                  <p className="text-[10px] text-muted-foreground">CO₂</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{w.contribution_score}</p>
                  <p className="text-[10px] text-muted-foreground">Score</p>
                </div>
              </div>
              <button
                onClick={() => shareLocation(w)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Mail className="h-3.5 w-3.5" />
                Share Location
              </button>
            </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default SupervisorWorkersPage;
