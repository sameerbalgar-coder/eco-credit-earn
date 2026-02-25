import { useState } from "react";
import {
  AlertTriangle,
  Camera,
  MapPin,
  ChevronLeft,
  CheckCircle2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const hazardTypes = [
  { id: "chemical", label: "Chemical Spill", icon: "☣️" },
  { id: "structure", label: "Damaged Structure", icon: "🏚️" },
  { id: "pothole", label: "Pothole / Road", icon: "🕳️" },
  { id: "wires", label: "Exposed Wires", icon: "⚡" },
  { id: "hazwaste", label: "Hazardous Waste", icon: "☢️" },
  { id: "other", label: "Other Risk", icon: "⚠️" },
];

const severityLevels = [
  { id: "low", label: "Low", color: "bg-eco-warning/20 text-eco-warning" },
  { id: "medium", label: "Medium", color: "bg-eco-warning/40 text-eco-warning" },
  { id: "high", label: "High", color: "bg-destructive/20 text-destructive" },
  { id: "emergency", label: "Emergency", color: "bg-destructive/30 text-destructive" },
];

const HazardPage = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Hazard Reported!</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Authorities have been notified. Thank you for keeping the community safe.
        </p>
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="mt-6 rounded-xl"
        >
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Report Hazard</h1>
      </div>

      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <p className="text-xs text-foreground">
          Report dangerous situations to protect your community
        </p>
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Photo Evidence</p>
        <button className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/50 py-8 transition-colors hover:border-primary/40">
          <Camera className="h-8 w-8 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Take or upload photo</span>
        </button>
      </div>

      {/* Hazard Type */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Hazard Type</p>
        <div className="grid grid-cols-2 gap-3">
          {hazardTypes.map((h) => (
            <button
              key={h.id}
              onClick={() => setSelectedType(h.id)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                selectedType === h.id
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border bg-card hover:border-destructive/20"
              }`}
            >
              <span className="text-xl">{h.icon}</span>
              <span className="text-xs font-medium text-foreground">{h.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Severity Level</p>
        <div className="flex gap-2">
          {severityLevels.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeverity(s.id)}
              className={`flex-1 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                severity === s.id ? s.color + " border-transparent" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3">
        <MapPin className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">Auto-detected</p>
          <p className="text-xs text-muted-foreground">MG Road, Sector 14, Gurugram</p>
        </div>
      </div>

      <Button
        onClick={() => setSubmitted(true)}
        className="w-full rounded-xl py-6 text-sm font-semibold"
        disabled={!selectedType || !severity}
      >
        <Upload className="mr-2 h-4 w-4" /> Submit Hazard Report
      </Button>
    </div>
  );
};

export default HazardPage;
