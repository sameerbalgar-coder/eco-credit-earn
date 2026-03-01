import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, BarChart3, TrendingUp, MapPin, AlertTriangle, Loader2 } from "lucide-react";

const AdminAnalyticsPage = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("waste_reports").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setReports(data);
      setLoading(false);
    });
  }, []);

  // Calculate analytics
  const wasteTypeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const dailyCounts: Record<string, number> = {};

  reports.forEach(r => {
    wasteTypeCounts[r.waste_type] = (wasteTypeCounts[r.waste_type] ?? 0) + 1;
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    const day = new Date(r.created_at).toLocaleDateString();
    dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
  });

  const topWasteTypes = Object.entries(wasteTypeCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = topWasteTypes[0]?.[1] ?? 1;

  // Find hotspot areas (recurring locations)
  const locationClusters: { address: string; count: number }[] = [];
  const addrCounts: Record<string, number> = {};
  reports.forEach(r => {
    if (r.address) {
      addrCounts[r.address] = (addrCounts[r.address] ?? 0) + 1;
    }
  });
  Object.entries(addrCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([address, count]) => locationClusters.push({ address, count }));

  return (
    <div className="px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Analytics</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{reports.length}</p>
              <p className="text-xs text-muted-foreground">Total Reports</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-eco-success">{statusCounts["completed"] ?? 0}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-eco-warning">{statusCounts["pending"] ?? 0}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-destructive">{statusCounts["rejected"] ?? 0}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </div>

          {/* Waste Type Distribution */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Waste Type Distribution
            </h2>
            <div className="space-y-2">
              {topWasteTypes.map(([type, count]) => (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground capitalize">{type}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full eco-gradient transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hotspot Areas */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4 text-destructive" /> Hotspot Areas
            </h2>
            {locationClusters.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recurring hotspots detected yet.</p>
            ) : (
              <div className="space-y-2">
                {locationClusters.map((loc, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-4 w-4 ${loc.count >= 3 ? "text-destructive" : "text-eco-warning"}`} />
                      <span className="text-sm text-foreground truncate max-w-[200px]">{loc.address}</span>
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">{loc.count} reports</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recurring Issues */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Trends
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {topWasteTypes[0] ? (
                <>Most reported: <strong className="text-foreground capitalize">{topWasteTypes[0][0]}</strong> ({topWasteTypes[0][1]} reports). {locationClusters[0] ? <>Top hotspot: <strong className="text-foreground">{locationClusters[0].address}</strong></> : null}</>
              ) : "Not enough data for trend analysis yet."}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAnalyticsPage;
