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
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const recentReports = [
  { id: 1, type: "Plastic Waste", status: "Collected", credits: 15, date: "2h ago" },
  { id: 2, type: "E-Waste", status: "Pending", credits: 0, date: "5h ago" },
  { id: 3, type: "Organic Waste", status: "Collected", credits: 8, date: "1d ago" },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={ecoLogo} alt="EcoCredit" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold text-foreground">EcoCredit</h1>
            <p className="text-xs text-muted-foreground">Good morning, Arjun 👋</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/leaderboard")}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
        >
          <Trophy className="h-5 w-5 text-primary" />
        </button>
      </div>

      {/* Credit Banner */}
      <div className="eco-gradient rounded-2xl p-5 eco-shadow-lg animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-primary-foreground/70">Available Credits</p>
            <p className="text-3xl font-bold text-primary-foreground">1,250</p>
            <p className="mt-1 text-xs text-primary-foreground/60">≈ ₹125.00 value</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-primary-foreground/80">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">+85 this week</span>
            </div>
            <div className="mt-2 rounded-lg bg-primary-foreground/15 px-3 py-1">
              <span className="text-xs font-semibold text-primary-foreground">🏅 Silver</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 animate-slide-up">
        <StatCard icon={Coins} label="Credits" value="1,250" variant="primary" />
        <StatCard icon={Leaf} label="CO₂ Saved" value="48kg" />
        <StatCard icon={Star} label="Score" value="720" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon={Camera} label="Report" to="/report" />
          <QuickAction icon={Recycle} label="Pickup" to="/report?tab=pickup" />
          <QuickAction icon={AlertTriangle} label="Hazard" to="/hazard" />
          <QuickAction icon={MapPin} label="Map" to="/map" />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <button className="text-xs font-medium text-primary">View all</button>
        </div>
        <div className="space-y-2">
          {recentReports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 transition-all hover:eco-shadow"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    r.status === "Collected" ? "bg-eco-success/10" : "bg-eco-warning/10"
                  }`}
                >
                  <Recycle
                    className={`h-5 w-5 ${
                      r.status === "Collected" ? "text-eco-success" : "text-eco-warning"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{r.type}</p>
                  <p className="text-xs text-muted-foreground">{r.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.credits > 0 && (
                  <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    +{r.credits}
                  </span>
                )}
                <span
                  className={`text-xs font-medium ${
                    r.status === "Collected" ? "text-eco-success" : "text-eco-warning"
                  }`}
                >
                  {r.status}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
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
              <div className="h-full w-3/5 rounded-full eco-gradient transition-all" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">3 of 5 completed</p>
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
