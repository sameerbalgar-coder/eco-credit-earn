import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const statusColors: Record<string, string> = {
  pending: "bg-destructive",
  assigned: "bg-eco-warning",
  in_progress: "bg-eco-warning",
  completed: "bg-eco-success",
};

const MapPage = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  useEffect(() => {
    supabase
      .from("waste_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setReports(data); });
  }, []);

  return (
    <div className="px-4 py-6 space-y-4">
      <h1 className="text-lg font-bold text-foreground">Waste Map</h1>
      <p className="text-sm text-muted-foreground">
        View reported waste locations and their status
      </p>

      {/* Map area with report markers */}
      <div className="relative h-[55vh] overflow-hidden rounded-2xl border border-border bg-muted">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Interactive Map</p>
          <p className="text-xs text-muted-foreground">{reports.length} waste reports plotted</p>
        </div>

        {/* Simulated markers based on real data */}
        {reports.slice(0, 8).map((r, i) => {
          const positions = [
            { top: "20%", left: "30%" }, { top: "45%", left: "60%" },
            { top: "35%", left: "45%" }, { top: "65%", left: "25%" },
            { top: "55%", left: "70%" }, { top: "25%", left: "55%" },
            { top: "70%", left: "50%" }, { top: "40%", left: "20%" },
          ];
          const pos = positions[i % positions.length];
          return (
            <button
              key={r.id}
              onClick={() => setSelectedReport(r)}
              className={`absolute h-4 w-4 rounded-full border-2 border-card ${statusColors[r.status] ?? "bg-muted-foreground"} transition-transform hover:scale-150`}
              style={{ top: pos.top, left: pos.left }}
              title={`${r.waste_type} - ${r.status}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Unassigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-eco-warning" />
          <span className="text-muted-foreground">Assigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-eco-success" />
          <span className="text-muted-foreground">Completed</span>
        </div>
      </div>

      {/* Selected report details */}
      {selectedReport && (
        <div className="rounded-xl border border-border bg-card p-4 animate-fade-in space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground capitalize">{selectedReport.waste_type} Waste</h3>
            <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-lg ${
              selectedReport.status === "completed" ? "bg-eco-success/10 text-eco-success" :
              selectedReport.status === "pending" ? "bg-destructive/10 text-destructive" :
              "bg-eco-warning/10 text-eco-warning"
            }`}>{selectedReport.status}</span>
          </div>
          {selectedReport.description && (
            <p className="text-xs text-muted-foreground">{selectedReport.description}</p>
          )}
          {selectedReport.quantity_kg && (
            <p className="text-xs text-muted-foreground">Estimated: {selectedReport.quantity_kg} kg</p>
          )}
          <p className="text-[10px] text-muted-foreground">{selectedReport.address ?? "No address"}</p>
          <button onClick={() => setSelectedReport(null)} className="text-xs text-primary font-medium">
            Close
          </button>
        </div>
      )}

      {/* Recent reports list */}
      {reports.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Recent Reports</h2>
          <div className="space-y-2">
            {reports.slice(0, 5).map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${statusColors[r.status]}`} />
                  <span className="text-sm font-medium text-foreground capitalize">{r.waste_type}</span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{r.status}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapPage;
