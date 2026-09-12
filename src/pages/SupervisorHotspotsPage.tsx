import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Flame, MapPinOff } from "lucide-react";

interface Report {
  id: string;
  waste_type: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  count: number;
  open: number;
  resolved: number;
  score: number;
  lastAt: string;
  types: Record<string, number>;
  sample: Report;
}

const GOA_CENTER: [number, number] = [15.2993, 74.124];

const RANGES = [
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "all", label: "All time" },
];

const OPEN_STATUSES = new Set(["pending", "assigned", "in_progress"]);

const severityOf = (r: Report) => {
  const d = (r.description ?? "").toUpperCase();
  if (d.includes("SEVERITY: HIGH")) return "high";
  if (d.includes("SEVERITY: MEDIUM")) return "medium";
  if (d.includes("SEVERITY: LOW")) return "low";
  return null;
};

const MapFocus = ({ target }: { target: { lat: number; lng: number; n: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 });
  }, [target, map]);
  return null;
};

const SupervisorHotspotsPage = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [range, setRange] = useState("30");
  const [openOnly, setOpenOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const focusSeq = useRef(0);

  const load = async () => {
    let q = supabase
      .from("waste_reports")
      .select("id, waste_type, latitude, longitude, address, status, description, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (range !== "all") {
      const since = new Date(Date.now() - Number(range) * 86400000).toISOString();
      q = q.gte("created_at", since);
    }
    const { data } = await q;
    setReports((data as any) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    const channel = supabase
      .channel("hotspots-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "waste_reports" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const types = useMemo(
    () => Array.from(new Set(reports.map((r) => r.waste_type))).sort(),
    [reports]
  );

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (typeFilter !== "all" && r.waste_type !== typeFilter) return false;
        if (openOnly && !OPEN_STATUSES.has(r.status)) return false;
        return true;
      }),
    [reports, typeFilter, openOnly]
  );

  const missingLocation = filtered.filter((r) => r.latitude == null || r.longitude == null).length;

  const clusters = useMemo<Cluster[]>(() => {
    const gridSize = 0.005; // ~500m
    const buckets: Record<string, Cluster> = {};
    filtered.forEach((r) => {
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
          open: 0,
          resolved: 0,
          score: 0,
          lastAt: r.created_at,
          types: {},
          sample: r,
        };
      }
      const b = buckets[key];
      const isOpen = OPEN_STATUSES.has(r.status);
      const sev = severityOf(r);
      b.count += 1;
      if (isOpen) b.open += 1;
      else b.resolved += 1;
      b.score += (isOpen ? 2 : 0.5) * (sev === "high" ? 2 : sev === "medium" ? 1.4 : 1);
      if (r.created_at > b.lastAt) b.lastAt = r.created_at;
      b.types[r.waste_type] = (b.types[r.waste_type] ?? 0) + 1;
    });
    return Object.values(buckets).sort((a, b) => b.score - a.score);
  }, [filtered]);

  const maxScore = clusters[0]?.score ?? 1;
  const center: [number, number] =
    clusters.length > 0 ? [clusters[0].lat, clusters[0].lng] : GOA_CENTER;

  const heatColor = (score: number) => {
    const ratio = score / maxScore;
    if (ratio > 0.66) return "#dc2626";
    if (ratio > 0.33) return "#f97316";
    return "#eab308";
  };

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
      active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
    }`;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Hotspots</h1>
          <p className="text-xs text-muted-foreground">Areas with most reports</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)} className={chip(range === r.id)}>
              {r.label}
            </button>
          ))}
          <button onClick={() => setOpenOnly(!openOnly)} className={chip(openOnly)}>
            Open only
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setTypeFilter("all")} className={chip(typeFilter === "all")}>
            All types
          </button>
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`${chip(typeFilter === t)} capitalize`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
        <Flame className="h-4 w-4 text-destructive" />
        <p className="text-xs text-foreground">
          {clusters.length} hotspot area{clusters.length !== 1 ? "s" : ""} • {filtered.length} reports
        </p>
      </div>

      <div className="h-[55vh] overflow-hidden rounded-2xl border border-border">
        <MapContainer
          center={center}
          zoom={clusters.length > 0 ? 12 : 10}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapFocus target={focus} />
          {clusters.map((c) => {
            const radius = 6 + Math.min(16, c.score * 1.6);
            const color = heatColor(c.score);
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
                    <div className="text-xs">
                      {c.open} open · {c.resolved} resolved
                    </div>
                    {Object.entries(c.types).map(([t, n]) => (
                      <div key={t} className="text-xs capitalize">
                        {t}: {n}
                      </div>
                    ))}
                    <div className="text-[10px] opacity-70">Latest: {fmtDate(c.lastAt)}</div>
                    {c.sample.address && <div className="text-[10px] opacity-70">{c.sample.address}</div>}
                    <button
                      onClick={() =>
                        navigate(
                          `/supervisor/assign${typeFilter !== "all" ? `?type=${encodeURIComponent(typeFilter)}` : ""}`
                        )
                      }
                      className="mt-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                    >
                      View reports
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {missingLocation > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
          <MapPinOff className="h-4 w-4 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground">
            {missingLocation} report{missingLocation !== 1 ? "s" : ""} have no location and are not shown on the map.
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Top Hotspots</h2>
        <div className="space-y-2">
          {clusters.slice(0, 8).map((c, i) => (
            <button
              key={c.key}
              onClick={() => {
                focusSeq.current += 1;
                setFocus({ lat: c.lat, lng: c.lng, n: focusSeq.current });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: heatColor(c.score) }}
              >
                #{i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.sample.address || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {c.open} open · {c.resolved} resolved · last {fmtDate(c.lastAt)}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">{c.count}</span>
            </button>
          ))}
          {clusters.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
              No located reports for these filters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisorHotspotsPage;
