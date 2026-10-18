import { useEffect, useState, useCallback } from "react";
import { Trophy, Medal, Leaf, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Leader {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  credits_balance: number;
  co2_saved_kg: number;
  contribution_score: number;
  badge_level: string | null;
  verified_count: number;
}

const badgeColors: Record<string, string> = {
  Bronze: "bg-[hsl(var(--eco-badge-bronze))]",
  Silver: "bg-[hsl(var(--eco-badge-silver))]",
  Gold: "bg-[hsl(var(--eco-badge-gold))]",
  Emerald: "bg-[hsl(var(--eco-badge-emerald))]",
  Platinum: "bg-gradient-to-r from-primary to-primary/60",
};

const rankBadge: Record<number, { icon: typeof Trophy; label: string; color: string }> = {
  1: { icon: Trophy, label: "Gold", color: "text-eco-warning" },
  2: { icon: Medal, label: "Silver", color: "text-muted-foreground" },
  3: { icon: Medal, label: "Bronze", color: "text-amber-700" },
};

const LeaderboardPage = () => {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"credits" | "co2">("credits");

  const loadLeaders = useCallback(async () => {
    try {
      const orderCol = sortBy === "credits" ? "credits_balance" : "co2_saved_kg";
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, credits_balance, co2_saved_kg, contribution_score, badge_level")
        .order(orderCol, { ascending: false })
        .limit(50);

      if (error) throw error;

      const profileIds = (data ?? []).map((p: any) => p.id);
      let verifiedMap: Record<string, number> = {};
      if (profileIds.length > 0) {
        const { data: reports } = await supabase
          .from("waste_reports")
          .select("reporter_id")
          .eq("status", "verified")
          .in("reporter_id", profileIds);
        if (reports) {
          reports.forEach((r: any) => {
            verifiedMap[r.reporter_id] = (verifiedMap[r.reporter_id] ?? 0) + 1;
          });
        }
      }

      const mapped: Leader[] = (data ?? []).map((p: any) => ({
        id: p.id,
        display_name: p.display_name ?? "Anonymous",
        avatar_url: p.avatar_url,
        credits_balance: p.credits_balance ?? 0,
        co2_saved_kg: Number(p.co2_saved_kg ?? 0),
        contribution_score: p.contribution_score ?? 0,
        badge_level: p.badge_level ?? "Bronze",
        verified_count: verifiedMap[p.id] ?? 0,
      }));

      setLeaders(mapped);
    } catch {
      setLeaders([]);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    loadLeaders();

    const ch = supabase
      .channel("leaderboard_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadLeaders())
      .on("postgres_changes", { event: "*", schema: "public", table: "waste_reports" }, () => loadLeaders())
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadLeaders]);

  const currentUserId = user?.id;
  const currentUserRank = leaders.findIndex((l) => l.id === currentUserId);
  const topThree = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
      </div>

      {/* Sort toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSortBy("credits")}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
            sortBy === "credits" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
          }`}
        >
          By Credits
        </button>
        <button
          onClick={() => setSortBy("co2")}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
            sortBy === "co2" ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
          }`}
        >
          By CO₂ Saved
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : leaders.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No leaderboard data yet. Be the first!</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {topThree.length >= 3 && (
            <div className="flex items-end justify-center gap-3">
              {[topThree[1], topThree[0], topThree[2]].map((l, i) => {
                const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
                const badge = rankBadge[rank];
                const BadgeIcon = badge?.icon ?? Trophy;
                const heights = ["h-20", "h-32", "h-16"];
                return (
                  <div key={l.id} className="flex flex-col items-center gap-2">
                    <div className="relative">
                      {l.avatar_url ? (
                        <img src={l.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-primary-foreground ${badgeColors[l.badge_level ?? "Bronze"] ?? badgeColors.Bronze}`}>
                          {l.display_name?.slice(0, 2).toUpperCase() ?? "??"}
                        </div>
                      )}
                      <div className={`absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background ${badge?.color}`}>
                        <BadgeIcon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-foreground max-w-[5rem] truncate">{l.display_name?.split(" ")[0] ?? "User"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {sortBy === "credits" ? `${l.credits_balance} cr` : `${l.co2_saved_kg.toFixed(1)} kg`}
                    </p>
                    <div className={`${heights[i]} w-16 rounded-t-xl ${rank === 1 ? "eco-gradient" : "bg-primary/10"}`} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Current user highlight if not in top 3 */}
          {currentUserRank >= 3 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 eco-shadow">
              <p className="mb-1 text-[10px] font-semibold uppercase text-primary">Your Position</p>
              <LeaderRow leader={leaders[currentUserRank]} rank={currentUserRank + 1} isUser sortBy={sortBy} />
            </div>
          )}

          {/* Full list (rank 4+) */}
          <div className="space-y-2">
            {rest.map((l, idx) => {
              const rank = idx + 4;
              const isUser = l.id === currentUserId;
              return (
                <LeaderRow key={l.id} leader={l} rank={rank} isUser={isUser} sortBy={sortBy} />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const LeaderRow = ({ leader, rank, isUser, sortBy }: { leader: Leader; rank: number; isUser: boolean; sortBy: "credits" | "co2" }) => {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
        isUser ? "border-primary/30 bg-primary/5 eco-shadow" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 text-center text-sm font-bold text-muted-foreground">{rank}</span>
        {leader.avatar_url ? (
          <img src={leader.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-primary-foreground ${badgeColors[leader.badge_level ?? "Bronze"] ?? badgeColors.Bronze}`}>
            {leader.display_name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {leader.display_name}
            {isUser && <span className="ml-1 text-xs text-primary">(You)</span>}
          </p>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Shield className="h-2.5 w-2.5" /> {leader.badge_level ?? "Bronze"}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Leaf className="h-2.5 w-2.5" /> {leader.co2_saved_kg.toFixed(1)} kg CO₂
            </span>
            <span className="text-[10px] text-muted-foreground">{leader.verified_count} verified</span>
          </div>
        </div>
      </div>
      <span className="text-sm font-bold text-foreground">
        {sortBy === "credits" ? leader.credits_balance : leader.co2_saved_kg.toFixed(1)}
      </span>
    </div>
  );
};

export default LeaderboardPage;
