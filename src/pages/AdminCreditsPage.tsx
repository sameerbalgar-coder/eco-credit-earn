import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Coins, Loader2 } from "lucide-react";

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

      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Credit transaction history is available to citizens in their wallet.</p>
      </div>
    </div>
  );
};

export default AdminCreditsPage;
