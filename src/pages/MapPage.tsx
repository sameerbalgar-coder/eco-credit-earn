import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: "#ef4444", label: "Reported" },
  assigned: { color: "#eab308", label: "In Progress" },
  in_progress: { color: "#eab308", label: "In Progress" },
  completed: { color: "#22c55e", label: "Completed" },
};

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Reported", color: "#ef4444" },
  { id: "in_progress", label: "In Progress", color: "#eab308" },
  { id: "completed", label: "Completed", color: "#22c55e" },
];

const FlyToUser = ({ pos }: { pos: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, 14);
  }, [pos, map]);
  return null;
};

const MapPage = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [filter, setFilter] = useState<string>("all");

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  // Initial fetch + realtime subscription
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("waste_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setReports(data);
    };
    load();

    const channel = supabase
      .channel("waste_reports_map")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "waste_reports" },
        (payload) => {
          setReports((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as any, ...prev];
            if (payload.eventType === "UPDATE")
              return prev.map((r) => (r.id === (payload.new as any).id ? (payload.new as any) : r));
            if (payload.eventType === "DELETE")
              return prev.filter((r) => r.id !== (payload.old as any).id);
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const withCoords = reports.filter((r) => r.latitude && r.longitude);
    if (filter === "all") return withCoords;
    if (filter === "in_progress")
      return withCoords.filter((r) => r.status === "in_progress" || r.status === "assigned");
    return withCoords.filter((r) => r.status === filter);
  }, [reports, filter]);

  const center: [number, number] = userPos ?? [20.5937, 78.9629]; // India fallback

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Live Waste Map</h1>
        <p className="text-sm text-muted-foreground">
          Real-time issue tracking · {filtered.length} visible
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {f.color && <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />}
            {f.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="h-[60vh] overflow-hidden rounded-2xl border border-border">
        <MapContainer
          center={center}
          zoom={userPos ? 14 : 5}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyToUser pos={userPos} />

          {userPos && (
            <CircleMarker
              center={userPos}
              radius={8}
              pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.9 }}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
          )}

          {filtered.map((r) => {
            const meta = STATUS_META[r.status] ?? { color: "#9ca3af", label: r.status };
            return (
              <CircleMarker
                key={r.id}
                center={[Number(r.latitude), Number(r.longitude)]}
                radius={9}
                pathOptions={{
                  color: meta.color,
                  fillColor: meta.color,
                  fillOpacity: 0.85,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold capitalize">{r.waste_type}</div>
                    <div className="text-xs">
                      Status:{" "}
                      <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                    </div>
                    {r.description && <div className="text-xs">{r.description}</div>}
                    {r.address && <div className="text-[10px] opacity-70">{r.address}</div>}
                    <div className="text-[10px] opacity-60">
                      {new Date(r.updated_at ?? r.created_at).toLocaleString()}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ background: "#ef4444" }} />
          <span className="text-muted-foreground">Reported</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ background: "#eab308" }} />
          <span className="text-muted-foreground">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full" style={{ background: "#22c55e" }} />
          <span className="text-muted-foreground">Completed</span>
        </div>
      </div>
    </div>
  );
};

export default MapPage;
