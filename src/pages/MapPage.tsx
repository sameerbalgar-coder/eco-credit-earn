import { MapPin } from "lucide-react";

const MapPage = () => {
  return (
    <div className="px-4 py-6 space-y-4">
      <h1 className="text-lg font-bold text-foreground">Waste Map</h1>
      <p className="text-sm text-muted-foreground">
        View garbage hotspots, hazard zones, and recycling centers
      </p>

      {/* Map placeholder */}
      <div className="relative h-[60vh] overflow-hidden rounded-2xl border border-border bg-muted">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MapPin className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Interactive Map</p>
          <p className="text-xs text-muted-foreground">
            Map integration will display here
          </p>
        </div>

        {/* Mock heatmap dots */}
        {[
          { top: "20%", left: "30%", size: "40px", opacity: 0.3 },
          { top: "45%", left: "60%", size: "60px", opacity: 0.4 },
          { top: "35%", left: "45%", size: "50px", opacity: 0.25 },
          { top: "65%", left: "25%", size: "35px", opacity: 0.35 },
          { top: "55%", left: "70%", size: "45px", opacity: 0.2 },
        ].map((dot, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-destructive"
            style={{
              top: dot.top,
              left: dot.left,
              width: dot.size,
              height: dot.size,
              opacity: dot.opacity,
              filter: "blur(8px)",
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-destructive/40" />
          <span className="text-muted-foreground">Garbage Hotspot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-eco-success/50" />
          <span className="text-muted-foreground">Cleaned Zone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-eco-warning/50" />
          <span className="text-muted-foreground">Hazard</span>
        </div>
      </div>
    </div>
  );
};

export default MapPage;
