import { Trophy, Medal, TrendingUp, Flame } from "lucide-react";

const leaders = [
  { rank: 1, name: "Priya Sharma", score: 2450, badge: "🏆", streak: 14 },
  { rank: 2, name: "Amit Kumar", score: 2100, badge: "🥈", streak: 10 },
  { rank: 3, name: "Sneha Patel", score: 1950, badge: "🥉", streak: 8 },
  { rank: 4, name: "Arjun Singh", score: 1720, badge: "🏅", streak: 7, isUser: true },
  { rank: 5, name: "Kavita Reddy", score: 1680, badge: "", streak: 5 },
  { rank: 6, name: "Ravi Verma", score: 1520, badge: "", streak: 3 },
  { rank: 7, name: "Meera Joshi", score: 1400, badge: "", streak: 6 },
];

const badges = [
  { name: "First Report", icon: "🌱", earned: true },
  { name: "10 Reports", icon: "🌿", earned: true },
  { name: "50 Reports", icon: "🌳", earned: false },
  { name: "E-Waste Hero", icon: "⚡", earned: true },
  { name: "Streak Master", icon: "🔥", earned: false },
  { name: "Community Star", icon: "⭐", earned: false },
];

const LeaderboardPage = () => {
  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
      </div>

      {/* Top 3 Podium */}
      <div className="flex items-end justify-center gap-3">
        {[leaders[1], leaders[0], leaders[2]].map((l, i) => {
          const heights = ["h-24", "h-32", "h-20"];
          return (
            <div key={l.rank} className="flex flex-col items-center gap-2">
              <span className="text-2xl">{l.badge}</span>
              <p className="text-xs font-semibold text-foreground">{l.name.split(" ")[0]}</p>
              <p className="text-[10px] text-muted-foreground">{l.score} pts</p>
              <div
                className={`${heights[i]} w-20 rounded-t-xl ${
                  i === 1 ? "eco-gradient" : "bg-primary/10"
                }`}
              />
            </div>
          );
        })}
      </div>

      {/* Full List */}
      <div className="space-y-2">
        {leaders.map((l) => (
          <div
            key={l.rank}
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
              l.isUser
                ? "border-primary/30 bg-primary/5 eco-shadow"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                {l.rank}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                {l.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {l.name}
                  {l.isUser && (
                    <span className="ml-1 text-xs text-primary">(You)</span>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-eco-warning" />
                  <span className="text-xs text-muted-foreground">
                    {l.streak} day streak
                  </span>
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-foreground">{l.score}</span>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Your Badges</h2>
        <div className="grid grid-cols-3 gap-3">
          {badges.map((b) => (
            <div
              key={b.name}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center ${
                b.earned
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-muted/50 opacity-50"
              }`}
            >
              <span className="text-2xl">{b.icon}</span>
              <span className="text-[10px] font-medium text-foreground">{b.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
