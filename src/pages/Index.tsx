import ecoLogo from "@/assets/ecocredit-logo.png";
import StatCard from "@/components/StatCard";
import QuickAction from "@/components/QuickAction";
import {
  Coins,
  Leaf,
  Star,
  Trophy,
  Camera,
  Recycle,
  AlertTriangle,
  MapPin,
  ChevronRight,
  TrendingUp,
  Bell,
  BookOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("waste_reports")
      .select("*")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setRecentReports(data); });

    supabase
      .from("notifications")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("read", false)
      .then(({ count }) => setUnreadCount(count ?? 0));
  }, [user]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const credits = profile?.credits_balance ?? 0;
  const co2 = profile?.co2_saved_kg ?? 0;
  const score = profile?.contribution_score ?? 0;
  const displayName = profile?.display_name ?? "User";

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ecoLogo} alt="EcoCredit" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold text-foreground">EcoCredit</h1>
            <p className="text-xs text-muted-foreground">Hello, {displayName} 👋</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/notifications")}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
          >
            <Bell className="h-5 w-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate("/leaderboard")}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
          >
            <Trophy className="h-5 w-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Credit Banner */}
      <div className="eco-gradient rounded-2xl p-5 eco-shadow-lg animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-primary-foreground/70">Available Credits</p>
            <p className="text-3xl font-bold text-primary-foreground">{credits.toLocaleString()}</p>
            <p className="mt-1 text-xs text-primary-foreground/60">≈ ₹{(credits / 10).toFixed(2)} value</p>
          </div>
          <div className="text-right">
            <div className="mt-2 rounded-lg bg-primary-foreground/15 px-3 py-1">
              <span className="text-xs font-semibold text-primary-foreground">🏅 {profile?.badge_level ?? "Bronze"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up">
        <StatCard icon={Coins} label="Credits" value={credits.toLocaleString()} variant="primary" />
        <StatCard icon={Leaf} label="CO₂ Saved" value={`${co2}kg`} />
        <StatCard icon={Star} label="Score" value={score.toString()} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon={Camera} label="Report" to="/report" />
          <QuickAction icon={Recycle} label="Pickup" to="/report" />
          <QuickAction icon={AlertTriangle} label="Hazard" to="/hazard" />
          <QuickAction icon={MapPin} label="Map" to="/map" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <QuickAction icon={BookOpen} label="Materials Guide" to="/materials" />
          <QuickAction icon={Bell} label="Notifications" to="/notifications" />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
        </div>
        {recentReports.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No reports yet. Start by reporting waste!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentReports.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 transition-all hover:eco-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    r.status === "completed" ? "bg-eco-success/10" : r.status === "pending" ? "bg-eco-warning/10" : "bg-eco-info/10"
                  }`}>
                    <Recycle className={`h-5 w-5 ${
                      r.status === "completed" ? "text-eco-success" : r.status === "pending" ? "text-eco-warning" : "text-eco-info"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{r.waste_type}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium capitalize ${
                    r.status === "completed" ? "text-eco-success" : r.status === "pending" ? "text-eco-warning" : "text-eco-info"
                  }`}>
                    {r.status}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Challenge */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">🎯 Weekly Challenge</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              Report 5 waste spots this week
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/10">
              <div className="h-full rounded-full eco-gradient transition-all" style={{ width: `${Math.min(100, (recentReports.length / 5) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{Math.min(recentReports.length, 5)} of 5 completed</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-primary">+50</span>
            <p className="text-[10px] text-muted-foreground">bonus credits</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
