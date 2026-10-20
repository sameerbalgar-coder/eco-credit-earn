import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AiUsageCard from "@/components/AiUsageCard";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, BarChart3, TrendingUp, MapPin, AlertTriangle, Loader2, CheckCircle2, Clock, XCircle, FileText, Filter, X } from "lucide-react";

type FilterType = "all" | "completed" | "pending" | "rejected";

const filterConfig: Record<FilterType, { label: string; icon: any; color: string }> = {
  all: { label: "All Reports", icon: FileText, color: "text-primary" },
  completed: { label: "Resolved", icon: CheckCircle2, color: "text-eco-success" },
  pending: { label: "Pending", icon: Clock, color: "text-eco-warning" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-destructive" },
};

const AdminAnalyticsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>(
    (searchParams.get("filter") as FilterType) || "all"
  );

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

  const filteredReports = useMemo(() => {
    if (activeFilter === "all") return reports;
    return reports.filter(r => r.status === activeFilter);
  }, [reports, activeFilter]);

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
          <AiUsageCard />
          {/* Overview — clickable metric cards */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "all" as FilterType, count: reports.length, icon: FileText, variant: "primary" as const },
              { key: "completed" as FilterType, count: statusCounts["completed"] ?? 0, icon: CheckCircle2, variant: "default" as const },
              { key: "pending" as FilterType, count: statusCounts["pending"] ?? 0, icon: Clock, variant: "default" as const },
              { key: "rejected" as FilterType, count: statusCounts["rejected"] ?? 0, icon: XCircle, variant: "default" as const },
            ]).map(({ key, count, icon: Icon, variant }) => {
              const isActive = activeFilter === key;
              const conf = filterConfig[key];
              return (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className={`rounded-xl border p-4 text-center transition-all active:scale-[0.97] ${
                    isActive
                      ? "border-primary bg-primary/5 eco-shadow"
                      : variant === "primary"
                      ? "eco-gradient-soft border-primary/20 hover:eco-shadow"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${isActive ? "bg-primary/15" : "bg-primary/10"}`}>
                      <Icon className={`h-4 w-4 ${conf.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${conf.color}`}>{count}</p>
                  <p className="text-xs text-muted-foreground">{conf.label}</p>
                </button>
              );
            })}
          </div>

          {/* Filtered Report List */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                {filterConfig[activeFilter].label}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {filteredReports.length}
                </span>
              </h2>
              {activeFilter !== "all" && (
                <button
                  onClick={() => setActiveFilter("all")}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Clear filter
                </button>
              )}
            </div>
            {filteredReports.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">No reports match this filter.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredReports.slice(0, 20).map(r => (
                  <button
                    key={r.id}
                    onClick={() => navigate("/admin/verify")}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:eco-shadow active:scale-[0.98]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <AlertTriangle className={`h-4 w-4 ${r.waste_type === "hazardous" ? "text-destructive" : "text-eco-warning"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground capitalize truncate">{r.waste_type}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.address ?? "No address"} • {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.status === "completed" ? "bg-eco-success/10 text-eco-success" :
                      r.status === "pending" ? "bg-eco-warning/10 text-eco-warning" :
                      r.status === "rejected" ? "bg-destructive/10 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {r.status}
                    </span>
                  </button>
                ))}
                {filteredReports.length > 20 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    Showing 20 of {filteredReports.length} reports
                  </p>
                )}
              </div>
            )}
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
