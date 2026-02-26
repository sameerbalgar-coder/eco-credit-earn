import {
  User,
  Settings,
  ChevronRight,
  Leaf,
  Coins,
  Star,
  Trophy,
  Shield,
  HelpCircle,
  LogOut,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const credits = profile?.credits_balance ?? 0;
  const co2 = profile?.co2_saved_kg ?? 0;
  const score = profile?.contribution_score ?? 0;
  const initials = (profile?.display_name ?? "U").slice(0, 2).toUpperCase();

  const menuItems = [
    { icon: Coins, label: "Credit History", desc: "View all transactions", to: "/wallet" },
    { icon: Trophy, label: "Leaderboard", desc: "See rankings", to: "/leaderboard" },
    { icon: BookOpen, label: "Materials Guide", desc: "Recycling info", to: "/materials" },
    { icon: Shield, label: "Verification", desc: "ID and device binding", to: "" },
    { icon: Settings, label: "Settings", desc: "Preferences and language", to: "" },
    { icon: HelpCircle, label: "Help & Support", desc: "FAQs and contact", to: "" },
  ];

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Avatar + Info */}
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full eco-gradient text-2xl font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-background bg-eco-success px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            🏅
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground">{profile?.display_name ?? "User"}</h1>
          <p className="text-xs text-muted-foreground capitalize">{profile?.role ?? "citizen"} • {profile?.badge_level ?? "Bronze"}</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Coins className="h-5 w-5 text-primary mb-1" />
          <span className="text-lg font-bold text-foreground">{credits.toLocaleString()}</span>
          <span className="text-[10px] text-muted-foreground">Credits</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Leaf className="h-5 w-5 text-eco-success mb-1" />
          <span className="text-lg font-bold text-foreground">{co2}kg</span>
          <span className="text-[10px] text-muted-foreground">CO₂ Saved</span>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-border bg-card p-3">
          <Star className="h-5 w-5 text-eco-warning mb-1" />
          <span className="text-lg font-bold text-foreground">{score}</span>
          <span className="text-[10px] text-muted-foreground">Score</span>
        </div>
      </div>

      {/* Contribution Level */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">{profile?.badge_level ?? "Bronze"} Level</span>
          <span className="text-xs text-primary font-medium">Keep going!</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
          <div className="h-full rounded-full eco-gradient transition-all" style={{ width: `${Math.min(100, score / 10)}%` }} />
        </div>
      </div>

      {/* Menu */}
      <div className="space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => item.to && navigate(item.to)}
            className="flex w-full items-center justify-between rounded-xl p-3.5 transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <item.icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <button
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 p-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>
    </div>
  );
};

export default ProfilePage;
