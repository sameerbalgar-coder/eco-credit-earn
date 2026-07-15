import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  MapPin,
  ChevronLeft,
  CheckCircle2,
  Upload,
  Loader2,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import exifr from "exifr";

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
];

const HazardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [otherDescription, setOtherDescription] = useState("");
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [exifSource, setExifSource] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("Detecting location...");
  const [locationDenied, setLocationDenied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setAddress("Geolocation not supported");
      setLocationDenied(true);
      return;
    }
    setAddress("Detecting location...");
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddress(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => {
        setAddress("Location permission denied");
        setLocationDenied(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPhoto({ file, preview });
    try {
      const meta = await exifr.parse(file, {
        gps: true,
        pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
      });
      if (meta?.latitude && meta?.longitude) {
        setLocation({ lat: meta.latitude, lng: meta.longitude });
        setAddress(`${meta.latitude.toFixed(5)}, ${meta.longitude.toFixed(5)} (from photo)`);
        setExifSource(true);
        setLocationDenied(false);
      }
      const shotAt = meta?.DateTimeOriginal || meta?.CreateDate;
      setCapturedAt(shotAt ? new Date(shotAt) : new Date(file.lastModified || Date.now()));
    } catch {
      setCapturedAt(new Date(file.lastModified || Date.now()));
    }
  };

  const validate = (): string | null => {
    if (!selectedType) return "Please select a hazard type.";
    if (!photo) return "Please attach a photo of the hazard.";
    if (!severity) return "Please choose a severity level.";
    if (selectedType === "other" && otherDescription.trim().length < 10)
      return "Please describe the 'Other Risk' hazard (min 10 characters).";
    if (!location) return "Location is required. Please enable location access.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Missing information", description: err, variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to submit.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Upload photo
      let photoUrl: string | null = null;
      if (photo) {
        const fileName = `${user.id}/hazard-${Date.now()}-${photo.file.name}`;
        const { data, error: upErr } = await supabase.storage
          .from("report-photos")
          .upload(fileName, photo.file);
        if (upErr) throw upErr;
        if (data) {
          const { data: urlData } = supabase.storage.from("report-photos").getPublicUrl(data.path);
          photoUrl = urlData.publicUrl;
        }
      }

      const typeLabel = hazardTypes.find((h) => h.id === selectedType)?.label ?? selectedType;
      const priority =
        severity === "high" ? "HIGH PRIORITY" : severity === "medium" ? "Supervisor review" : "Routine maintenance";
      const descParts = [
        `⚠️ HAZARD: ${typeLabel}`,
        `Severity: ${severity?.toUpperCase()} (${priority})`,
        selectedType === "other" ? `Details: ${otherDescription.trim()}` : null,
        capturedAt ? `📷 Captured: ${capturedAt.toISOString()}` : null,
      ].filter(Boolean);

      const { data: inserted, error } = await supabase
        .from("waste_reports")
        .insert({
          reporter_id: user.id,
          waste_type: "hazardous",
          description: descParts.join(" | "),
          latitude: location!.lat,
          longitude: location!.lng,
          address,
          photo_urls: photoUrl ? [photoUrl] : [],
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      const newId = (inserted as any)?.id as string;
      setReportId(newId);

      // Routing notifications
      const shortId = newId.slice(0, 8);
      const baseMsg = `${typeLabel} • ${severity?.toUpperCase()}${address ? ` • ${address}` : ""} (#${shortId})`;

      if (severity === "high") {
        await supabase.rpc("notify_role" as any, {
          _role: "admin",
          _title: "🚨 HIGH PRIORITY hazard",
          _message: baseMsg,
          _type: "hazard",
        });
        await supabase.rpc("notify_role" as any, {
          _role: "supervisor",
          _title: "🚨 HIGH PRIORITY hazard",
          _message: baseMsg,
          _type: "hazard",
        });
      } else if (severity === "medium") {
        await supabase.rpc("notify_role" as any, {
          _role: "supervisor",
          _title: "Hazard for review",
          _message: baseMsg,
          _type: "hazard",
        });
      } else {
        await supabase.rpc("notify_role" as any, {
          _role: "supervisor",
          _title: "Hazard queued (routine)",
          _message: `Routine maintenance: ${baseMsg}`,
          _type: "hazard",
        });
      }

      setSubmitted(true);
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Hazard reported successfully</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Your report has been forwarded to the appropriate authority.
        </p>
        {reportId && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Report ID</span>
            <span className="text-xs font-mono font-semibold text-foreground">
              {reportId.slice(0, 8).toUpperCase()}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(reportId);
                toast({ title: "Copied", description: "Report ID copied to clipboard." });
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Copy report ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <Button variant="outline" onClick={() => navigate("/")} className="mt-6 rounded-xl">
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
        <p className="text-sm font-medium text-foreground">
          Photo Evidence <span className="text-destructive">*</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoCapture}
        />
        {photo ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            <img src={photo.preview} alt="Hazard" className="h-48 w-full object-cover" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 rounded-lg bg-background/90 px-3 py-1.5 text-xs font-medium shadow"
            >
              Replace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute("capture", "environment");
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/50 py-6 transition-colors hover:border-primary/40"
            >
              <Camera className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Take photo</span>
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute("capture");
                  fileInputRef.current.click();
                }
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/50 py-6 transition-colors hover:border-primary/40"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Upload from gallery</span>
            </button>
          </div>
        )}
        {capturedAt && (
          <p className="text-[11px] text-muted-foreground">
            🕒 {capturedAt.toLocaleString()} {exifSource && "• 📍 GPS from photo"}
          </p>
        )}
      </div>

      {/* Hazard Type */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Hazard Type <span className="text-destructive">*</span>
        </p>
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
        {selectedType === "other" && (
          <div className="space-y-1 pt-2">
            <label className="text-xs font-medium text-foreground">
              Describe the hazard <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={otherDescription}
              onChange={(e) => setOtherDescription(e.target.value)}
              placeholder="Please describe the risk in detail (min 10 characters)..."
              className="rounded-xl"
              maxLength={500}
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {otherDescription.length}/500
            </p>
          </div>
        )}
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Severity Level <span className="text-destructive">*</span>
        </p>
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
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          Location <span className="text-destructive">*</span>
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3">
          <MapPin className={`h-5 w-5 ${locationDenied ? "text-destructive" : "text-primary"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {location ? "Auto-detected" : locationDenied ? "Permission needed" : "Detecting..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">{address}</p>
          </div>
          {locationDenied && (
            <Button size="sm" variant="outline" onClick={detectLocation} className="rounded-lg text-xs">
              Retry
            </Button>
          )}
        </div>
        {locationDenied && (
          <p className="text-[11px] text-destructive">
            Enable location access in your browser to submit this report.
          </p>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        className="w-full rounded-xl py-6 text-sm font-semibold"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> Submit Hazard Report
          </>
        )}
      </Button>
    </div>
  );
};

export default HazardPage;
