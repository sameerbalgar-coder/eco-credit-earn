import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Flame } from "lucide-react";

interface Report {
  id: string;
  waste_type: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  status: string;
}

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  count: number;
  types: Record<string, number>;
  sample: Report;
}

const SupervisorHotspotsPage = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    supabase
      .from("waste_reports")
      .select("id, waste_type, latitude, longitude, address, status")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(1000)
      .then(({ data }) => setReports((data as any) ?? []));
  }, []);

  const clusters = useMemo<Cluster[]>(() => {
    // Group reports into ~500m grid cells (~0.005 deg)
    const gridSize = 0.005;
    const buckets: Record<string, Cluster> = {};
    reports.forEach((r) => {
      if (r.latitude == null || r.longitude == null) return;
      const gx = Math.round(Number(r.latitude) / gridSize);
      const gy = Math.round(Number(r.longitude) / gridSize);
      const key = `${gx}:${gy}`;
      if (!buckets[key]) {
        buckets[key] = {
          key,
          lat: gx * gridSize,
          lng: gy * gridSize,
          count: 0,
          types: {},
          sample: r,
        };
      }
      buckets[key].count += 1;
      buckets[key].types[r.waste_type] = (buckets[key].types[r.waste_type] ?? 0) + 1;
    });
    return Object.values(buckets).sort((a, b) => b.count - a.count);
  }, [reports]);

  const maxCount = clusters[0]?.count ?? 1;
  const center: [number, number] =
    clusters.length > 0 ? [clusters[0].lat, clusters[0].lng] : [20.5937, 78.9629];

  const heatColor = (n: number) => {
    const ratio = n / maxCount;
    if (ratio > 0.66) return "#dc2626"; // red
    if (ratio > 0.33) return "#f97316"; // orange
    return "#eab308"; // yellow
  };

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Hotspots</h1>
          <p className="text-xs text-muted-foreground">Areas with most reports</p>
        </div>
      </div>

      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-destructive" />
        <p className="text-xs text-foreground">
          {clusters.length} hotspot area{clusters.length !== 1 ? "s" : ""} • {reports.length} total reports
        </p>
      </div>

      <div className="h-[55vh] overflow-hidden rounded-2xl border border-border">
        <MapContainer center={center} zoom={clusters.length > 0 ? 13 : 5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {clusters.map((c) => {
            const radius = 10 + Math.min(30, c.count * 4);
            const color = heatColor(c.count);
            return (
              <CircleMarker
                key={c.key}
                center={[c.lat, c.lng]}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.5, weight: 2 }}
              >
                <Tooltip direction="top" offset={[0, -radius / 2]} opacity={1}>
                  <span className="text-xs font-semibold">{c.count} reports</span>
                </Tooltip>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">🔥 {c.count} reports here</div>
                    {Object.entries(c.types).map(([t, n]) => (
                      <div key={t} className="text-xs capitalize">
                        {t}: {n}
                      </div>
                    ))}
                    {c.sample.address && <div className="text-[10px] opacity-70">{c.sample.address}</div>}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Top Hotspots</h2>
        <div className="space-y-2">
          {clusters.slice(0, 8).map((c, i) => (
            <div key={c.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: heatColor(c.count) }}
              >
                #{i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.sample.address || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {Object.entries(c.types).map(([t, n]) => `${t} (${n})`).join(" · ")}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">{c.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SupervisorHotspotsPage;
