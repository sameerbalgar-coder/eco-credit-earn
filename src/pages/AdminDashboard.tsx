import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ecoLogo from "@/assets/ecocredit-logo.png";
import StatCard from "@/components/StatCard";
import {
  Shield, ClipboardCheck, Users, MapPin, BarChart3, Bell, ChevronRight,
  CheckCircle, Clock, AlertTriangle, Coins, Loader2, Flame, MessageSquare, UserCheck, Gift, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [unverifiedReports, setUnverifiedReports] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, users: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase.from("waste_reports").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id", { count: "exact" }),
      supabase.from("notifications").select("id", { count: "exact" }).eq("user_id", user.id).eq("read", false),
    ]).then(([reportsRes, profilesRes, notifRes]) => {
      const reports = reportsRes.data ?? [];
      setUnverifiedReports(reports.filter(r => r.status === "pending"));
      setStats({
        total: reports.length,
        pending: reports.filter(r => r.status === "pending").length,
        completed: reports.filter(r => r.status === "completed").length,
        users: profilesRes.count ?? 0,
      });
      setUnreadCount(notifRes.count ?? 0);
      setLoading(false);
    });
  }, [user]);

  const handleVerify = async (reportId: string, action: "assigned" | "rejected") => {
    await supabase.from("waste_reports").update({ status: action } as any).eq("id", reportId);
    setUnverifiedReports(prev => prev.filter(r => r.id !== reportId));
    setStats(prev => ({ ...prev, pending: prev.pending - 1 }));
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
    <div className="space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ecoLogo} alt="EcoCredit" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Hello, {profile?.display_name ?? "Admin"} 👋</p>
          </div>
        </div>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up">
        <StatCard icon={ClipboardCheck} label="Total Reports" value={stats.total.toString()} variant="primary" />
        <StatCard icon={Clock} label="Pending" value={stats.pending.toString()} />
        <StatCard icon={CheckCircle} label="Completed" value={stats.completed.toString()} />
        <StatCard icon={Users} label="Users" value={stats.users.toString()} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Admin Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Shield, label: "Verify Reports", desc: "Review pending", to: "/admin/verify" },
            { icon: UserCheck, label: "Assign Tasks", desc: "Reports board", to: "/supervisor/assign" },
            { icon: Users, label: "Workers", desc: "Online team", to: "/supervisor/workers" },
            { icon: Flame, label: "Hotspots", desc: "Report density", to: "/supervisor/hotspots" },
            { icon: MessageSquare, label: "Community", desc: "Moderate feed", to: "/supervisor/community" },
            { icon: MapPin, label: "Zone Manager", desc: "Areas & staff", to: "/admin/zones" },
            { icon: Coins, label: "Credit Control", desc: "Approve & audit", to: "/admin/credits" },
            { icon: Gift, label: "Credit Exchange", desc: "Add/remove offers", to: "/admin/offers" },
            { icon: Truck, label: "Pickups", desc: "On-demand requests", to: "/staff/pickups" },
            { icon: BarChart3, label: "Analytics", desc: "Reports & trends", to: "/admin/analytics" },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => navigate(item.to)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.97]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Unverified Reports */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Pending Verification</h2>
          <button onClick={() => navigate("/admin/verify")} className="text-xs font-medium text-primary">View All</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : unverifiedReports.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">All reports verified! 🎉</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unverifiedReports.slice(0, 5).map(r => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-eco-warning/10">
                      <AlertTriangle className="h-5 w-5 text-eco-warning" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">{r.waste_type}</p>
                      <p className="text-xs text-muted-foreground">{r.address?.slice(0, 30) ?? "No address"} • {timeAgo(r.created_at)}</p>
                    </div>
                  </div>
                  {r.upvote_count > 0 && (
                    <span className="text-xs text-primary font-medium">👍 {r.upvote_count}</span>
                  )}
                </div>
                {r.photo_urls?.length > 0 && (
                  <div className="flex gap-2">
                    {r.photo_urls.slice(0, 3).map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className="h-14 w-14 rounded-lg object-cover border border-border" />
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 rounded-lg text-xs" onClick={() => handleVerify(r.id, "assigned")}>
                    <CheckCircle className="mr-1 h-3.5 w-3.5" /> Verify
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 rounded-lg text-xs text-destructive" onClick={() => handleVerify(r.id, "rejected")}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
