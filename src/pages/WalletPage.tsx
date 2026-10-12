import { useEffect, useState, useCallback } from "react";
import { ArrowUpRight, ArrowDownLeft, Leaf, Loader2, Gift, Sprout, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  reward_type: string;
  credit_cost: number;
  image_url: string | null;
  stock: number | null;
  active: boolean;
};

type Transaction = {
  id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  co2_kg: number | null;
};

const rewardTypeIcon: Record<string, string> = {
  discount: "🏷️",
  scratch_card: "🎰",
  voucher: "🎫",
  freebie: "🎁",
};

const WalletPage = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: txData } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (txData) setTransactions(txData as Transaction[]);
    } catch {
      setTransactions([]);
    } finally {
      setLoadingTx(false);
    }

    try {
      const { data: rewardData } = await supabase
        .from("rewards")
        .select("*")
        .eq("active", true)
        .order("credit_cost", { ascending: true });
      if (rewardData) setRewards(rewardData as Reward[]);
    } catch {
      setRewards([]);
    } finally {
      setLoadingRewards(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const credits = profile?.credits_balance ?? 0;
  const co2Saved = profile?.co2_saved_kg ?? 0;
  const badge = profile?.badge_level ?? "Bronze";

  // Carbon credits: 1 credit = 0.1 kg CO2 offset
  const co2FromCredits = credits * 0.1;

  const handleRedeem = async (reward: Reward) => {
    if (credits < reward.credit_cost) return;
    setRedeeming(reward.id);
    try {
      // Deduct credits via the award function (negative amount)
      const { error: rpcError } = await (supabase.rpc as any)("award_carbon_credits", {
        p_user_id: user!.id,
        p_amount: -reward.credit_cost,
        p_transaction_type: "redeemed",
        p_description: `Redeemed: ${reward.title}`,
      });

      if (rpcError) throw new Error(rpcError.message);

      // Decrement stock if applicable
      if (reward.stock !== null) {
        await supabase
          .from("rewards")
          .update({ stock: Math.max(0, reward.stock - 1) })
          .eq("id", reward.id);
      }

      toast({
        title: "Redeemed successfully!",
        description: `${reward.title} — ${reward.credit_cost} credits used.`,
      });

      // Refresh data
      await loadData();
    } catch (err: any) {
      toast({
        title: "Redemption failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRedeeming(null);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const isAward = (type: string) => type === "report_verified" || type === "task_completed" || type === "bonus";

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-lg font-bold text-foreground">Carbon Wallet</h1>

      {/* Balance Card with CO2 framing */}
      <div className="eco-gradient rounded-2xl p-5 eco-shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-primary-foreground/70 flex items-center gap-1.5">
              <Leaf className="h-3.5 w-3.5" /> Carbon Credits
            </p>
            <p className="text-4xl font-bold text-primary-foreground mt-0.5">{credits.toLocaleString()}</p>
            <p className="mt-1 text-xs text-primary-foreground/60">
              ≈ {co2FromCredits.toFixed(1)} kg CO₂ offset
            </p>
          </div>
          <div className="text-right space-y-2">
            <div className="rounded-lg bg-primary-foreground/15 px-3 py-1.5">
              <span className="text-xs font-semibold text-primary-foreground">🏅 {badge}</span>
            </div>
            <div className="rounded-lg bg-primary-foreground/15 px-3 py-1.5">
              <p className="text-xs text-primary-foreground/70">Total CO₂ Saved</p>
              <p className="text-sm font-bold text-primary-foreground">{co2Saved.toFixed(1)} kg</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/10 px-3 py-2">
          <Sprout className="h-3.5 w-3.5 text-primary-foreground/80" />
          <p className="text-[11px] text-primary-foreground/80">
            1 credit = 0.1 kg CO₂ offset • Earn by reporting waste & completing cleanup tasks
          </p>
        </div>
      </div>

      {/* CO2 Impact Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <Leaf className="mx-auto h-5 w-5 text-eco-success mb-1" />
          <p className="text-lg font-bold text-foreground">{co2Saved.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground">kg CO₂ Saved</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <TrendingUp className="mx-auto h-5 w-5 text-primary mb-1" />
          <p className="text-lg font-bold text-foreground">{credits.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Credits Balance</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <Gift className="mx-auto h-5 w-5 text-eco-warning mb-1" />
          <p className="text-lg font-bold text-foreground">
            {transactions.filter((t) => t.transaction_type === "redeemed").length}
          </p>
          <p className="text-[10px] text-muted-foreground">Rew Redeemed</p>
        </div>
      </div>

      {/* Redeem Rewards */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Redeem Credits</h2>
        {loadingRewards ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rewards.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Gift className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No rewards available yet.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {rewards.map((r) => {
              const canAfford = credits >= r.credit_cost;
              const outOfStock = r.stock !== null && r.stock <= 0;
              return (
                <div
                  key={r.id}
                  className="flex min-w-[150px] flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center"
                >
                  <span className="text-3xl">{rewardTypeIcon[r.reward_type] ?? "🎁"}</span>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  {r.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{r.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-primary">
                    <Leaf className="h-3 w-3" />
                    <span className="text-xs font-medium">{r.credit_cost} credits</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    ≈ {(r.credit_cost * 0.1).toFixed(1)} kg CO₂
                  </p>
                  {r.stock !== null && (
                    <p className="text-[10px] text-muted-foreground">
                      {outOfStock ? "Out of stock" : `${r.stock} left`}
                    </p>
                  )}
                  <Button
                    variant={canAfford && !outOfStock ? "default" : "outline"}
                    size="sm"
                    className="rounded-lg text-xs w-full"
                    disabled={!canAfford || outOfStock || redeeming === r.id}
                    onClick={() => handleRedeem(r)}
                  >
                    {redeeming === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : outOfStock ? (
                      "Unavailable"
                    ) : canAfford ? (
                      "Redeem"
                    ) : (
                      "Not enough"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transactions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Transaction History</h2>
        {loadingTx ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No transactions yet. Report waste or complete tasks to earn carbon credits!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => {
              const positive = t.amount > 0;
              return (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      positive ? "bg-eco-success/10" : "bg-destructive/10"
                    }`}>
                      {positive ? (
                        <ArrowDownLeft className="h-4 w-4 text-eco-success" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {t.description ?? t.transaction_type.replace(/_/g, " ")}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</p>
                        {isAward(t.transaction_type) && t.co2_kg != null && (
                          <span className="flex items-center gap-0.5 text-[10px] text-eco-success">
                            <Leaf className="h-2.5 w-2.5" /> {t.co2_kg} kg CO₂
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${positive ? "text-eco-success" : "text-destructive"}`}>
                    {positive ? "+" : ""}{t.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
