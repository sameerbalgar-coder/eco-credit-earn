import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Coins, ArrowUpRight, ArrowDownLeft, Loader2, AlertTriangle } from "lucide-react";

const AdminCreditsPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [totalIssued, setTotalIssued] = useState(0);

  useEffect(() => {
    supabase
      .from("credit_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(async ({ data }) => {
        if (data) {
          setTransactions(data);
          setTotalIssued(data.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0));
          const ids = [...new Set(data.map(t => t.user_id))];
          if (ids.length > 0) {
            const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
            const map: Record<string, string> = {};
            profs?.forEach(p => { map[p.id] = p.display_name ?? "Unknown"; });
            setProfiles(map);
          }
        }
        setLoading(false);
      });
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Credit Control</h1>
      </div>

      {/* Summary */}
      <div className="eco-gradient rounded-2xl p-5 eco-shadow-lg">
        <p className="text-xs font-medium text-primary-foreground/70">Total Credits Issued</p>
        <p className="text-3xl font-bold text-primary-foreground">{totalIssued.toLocaleString()}</p>
        <p className="mt-1 text-xs text-primary-foreground/60">≈ ₹{(totalIssued / 10).toFixed(2)} equivalent</p>
      </div>

      {/* Transaction Log */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">All Transactions</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${t.amount > 0 ? "bg-eco-success/10" : "bg-destructive/10"}`}>
                    {t.amount > 0 ? <ArrowDownLeft className="h-4 w-4 text-eco-success" /> : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{profiles[t.user_id] ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{t.description ?? t.transaction_type} • {timeAgo(t.created_at)}</p>
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

export default AdminCreditsPage;
