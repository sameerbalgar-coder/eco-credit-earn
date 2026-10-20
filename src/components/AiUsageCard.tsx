import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

// Google free tier: ~20 checks per model per day, rotated across 5 models.
export const FREE_DAILY_LIMIT = 100;

const AiUsageCard = () => {
  const [counts, setCounts] = useState({ total: 0, authentic: 0, flagged_fake: 0, bypassed: 0 });

  useEffect(() => {
    const load = async () => {
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const { data } = await (supabase as any)
        .from("ai_usage_logs")
        .select("outcome")
        .gte("created_at", start.toISOString())
        .limit(5000);
      const rows: { outcome: string }[] = data ?? [];
      const c = { total: rows.length, authentic: 0, flagged_fake: 0, bypassed: 0 };
      rows.forEach((r) => { if (r.outcome in c) (c as any)[r.outcome]++; });
      setCounts(c);
    };
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);

  const pct = Math.min(100, (counts.total / FREE_DAILY_LIMIT) * 100);
  const now = new Date();
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  const hrs = Math.floor((reset.getTime() - now.getTime()) / 3600000);
  const mins = Math.floor(((reset.getTime() - now.getTime()) % 3600000) / 60000);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Gemini AI checks today</h2>
      </div>
      <p className="text-2xl font-bold text-foreground">
        {counts.total} <span className="text-sm font-normal text-muted-foreground">/ {FREE_DAILY_LIMIT} free</span>
      </p>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${pct > 85 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div><p className="font-bold text-foreground">{counts.authentic}</p><p className="text-muted-foreground">Real</p></div>
        <div><p className="font-bold text-foreground">{counts.flagged_fake}</p><p className="text-muted-foreground">Fake blocked</p></div>
        <div><p className="font-bold text-foreground">{counts.bypassed}</p><p className="text-muted-foreground">Skipped</p></div>
      </div>
      <p className="text-xs text-muted-foreground">Resets in {hrs}h {mins}m (midnight UTC, 5:30 AM India)</p>
    </div>
  );
};

export default AiUsageCard;
