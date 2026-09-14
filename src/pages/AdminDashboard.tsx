import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ecoLogo from "@/assets/ecocredit-logo.png";
import StatCard from "@/components/StatCard";
import {
  Shield, ClipboardCheck, Users, MapPin, Bell,
  CheckCircle, Clock, Flame, MessageSquare, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<{ total: number | null; pending: number | null; completed: number | null; users: number | null }>({
    total: null,
    pending: null,
    completed: null,
    users: null,
  });
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      supabase.from("profiles").select("id, email").eq("role", "citizen"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("notifications").select("id", { count: "exact" }).eq("user_id", user.id).eq("read", false),
    ]).then(async ([citizensRes, profilesRes, notifRes]) => {
      const citizenIds = (citizensRes.data ?? [])
        .filter((citizen) => !citizen.email?.toLowerCase().endsWith("@demo.local"))
        .map((citizen) => citizen.id);

      let total = 0;
      let pending = 0;
      let completed = 0;

      if (citizenIds.length > 0) {
        const hazardQuery = () => supabase
          .from("waste_reports")
          .select("id", { count: "exact", head: true })
          .eq("waste_type", "hazardous")
          .in("reporter_id", citizenIds);

        const [totalRes, pendingRes, completedRes] = await Promise.all([
          hazardQuery(),
          hazardQuery().eq("status", "pending"),
          hazardQuery().eq("status", "completed"),
        ]);

        total = totalRes.count ?? 0;
        pending = pendingRes.count ?? 0;
        completed = completedRes.count ?? 0;
      }

      setStats({
        total,
        pending,
        completed,
        users: profilesRes.count ?? 0,
      });
      setUnreadCount(notifRes.count ?? 0);
    });
  }, [user]);

  const displayCount = (value: number | null) => value === null ? "—" : value.toString();

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
        <StatCard icon={ClipboardCheck} label="Hazard Total Reports" value={displayCount(stats.total)} variant="primary" />
        <Button
          variant="ghost"
          className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
          onClick={() => navigate("/admin/verify?type=hazardous")}
          aria-label="Open pending hazard reports"
        >
          <div className="w-full">
            <StatCard icon={Clock} label="Pending" value={displayCount(stats.pending)} />
          </div>
        </Button>
        <StatCard icon={CheckCircle} label="Completed" value={displayCount(stats.completed)} />
        <StatCard icon={Users} label="Users" value={displayCount(stats.users)} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Admin Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Shield, label: "Verify Reports", desc: "Review pending", to: "/admin/verify" },
            { icon: MessageSquare, label: "Community", desc: "Moderate feed", to: "/supervisor/community" },
            { icon: Flame, label: "Hotspots", desc: "Report density", to: "/admin/hotspots" },
            { icon: MapPin, label: "Zone Manager", desc: "Areas & staff", to: "/admin/zones" },
            { icon: Gift, label: "Carbon Credits", desc: "Add/remove offers", to: "/admin/offers" },
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
    </div>
  );
};

export default AdminDashboard;
