import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const coupons = [
  { id: 1, brand: "Amazon", value: "₹50 Off", cost: 500, emoji: "🛒" },
  { id: 2, brand: "Swiggy", value: "₹30 Off", cost: 300, emoji: "🍔" },
  { id: 3, brand: "Flipkart", value: "₹100 Off", cost: 1000, emoji: "📦" },
];

const WalletPage = () => {
  const { profile, user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("credit_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [user]);

  const credits = profile?.credits_balance ?? 0;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-lg font-bold text-foreground">Wallet</h1>

      {/* Balance Card */}
      <div className="eco-gradient rounded-2xl p-5 eco-shadow-lg">
        <p className="text-xs font-medium text-primary-foreground/70">Total Credits</p>
        <p className="text-4xl font-bold text-primary-foreground">{credits.toLocaleString()}</p>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-primary-foreground/60">= ₹{(credits / 10).toFixed(2)} equivalent</p>
          <div className="rounded-lg bg-primary-foreground/15 px-3 py-1.5">
            <span className="text-xs font-semibold text-primary-foreground">10 credits = ₹1</span>
          </div>
        </div>
      </div>

      {/* Redeem */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Redeem Credits</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {coupons.map((c) => (
            <div key={c.id} className="flex min-w-[140px] flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center">
              <span className="text-3xl">{c.emoji}</span>
              <p className="text-sm font-semibold text-foreground">{c.brand}</p>
              <p className="text-xs text-primary font-medium">{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.cost} credits</p>
              <Button variant="outline" size="sm" className="rounded-lg text-xs w-full" disabled={credits < c.cost}>
                Redeem
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    t.amount > 0 ? "bg-eco-success/10" : "bg-destructive/10"
                  }`}>
                    {t.amount > 0 ? (
                      <ArrowDownLeft className="h-4 w-4 text-eco-success" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.description ?? t.transaction_type}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${t.amount > 0 ? "text-eco-success" : "text-destructive"}`}>
                  {t.amount > 0 ? "+" : ""}{t.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
