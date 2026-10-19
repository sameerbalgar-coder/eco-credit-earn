import { useState, useRef, useEffect } from "react";

const compressToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 640;
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.7).split(",")[1]);
    };
    img.onerror = reject;
    img.src = url;
  });

/**
 * Draw a date/time + location watermark on the bottom-right of the image.
 * Returns a new File (JPEG) with the watermark baked in.
 */
const watermarkImage = async (
  file: File,
  lat: number | null,
  lng: number | null,
  capturedAt: Date
): Promise<File> => {
  const img = new window.Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });

  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);

  const pad = Math.max(6, Math.round(h * 0.012));
  const fontPx = Math.max(11, Math.round(h * 0.022));

  const dateStr = capturedAt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeStr = capturedAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const locStr =
    lat !== null && lng !== null
      ? `${Math.abs(lat).toFixed(4)} ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)} ${lng >= 0 ? "E" : "W"}`
      : "Location unavailable";

  const line1 = `${dateStr} ${timeStr}`;
  const line2 = locStr;
  const lineHeight = Math.round(fontPx * 1.35);
  const blockH = lineHeight * 2 + pad * 1.5;
  const blockW =
    Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + pad * 2;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(w - blockW - pad, h - blockH - pad, blockW, blockH);

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `600 ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(line1, w - blockW - pad + pad * 0.5, h - blockH - pad + pad * 0.4);
  ctx.fillText(line2, w - blockW - pad + pad * 0.5, h - blockH - pad + pad * 0.4 + lineHeight);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
  );
  const name = file.name.replace(/\.[^.]+$/, "") + "_wm.jpg";
  return new File([blob], name, { type: "image/jpeg" });
};

const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });

import {
  Camera,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckCircle2,
  Image,
  Map as MapIcon,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import exifr from "exifr";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="background:#16a34a;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #16a34a"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const LocationPicker = ({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (v: { lat: number; lng: number }) => void;
}) => {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return value ? <Marker position={[value.lat, value.lng]} icon={pinIcon} /> : null;
};

const Recenter = ({ pos }: { pos: { lat: number; lng: number } | null }) => {
  const map = useMap();
  if (pos) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 14));
  return null;
};

const wasteCategories = [
  { id: "plastic", label: "Plastic", icon: "♻️" },
  { id: "organic", label: "Organic", icon: "🍂" },
  { id: "ewaste", label: "E-Waste", icon: "🔌" },
  { id: "metal", label: "Metal", icon: "🔩" },
  { id: "glass", label: "Glass", icon: "🫙" },
  { id: "paper", label: "Paper", icon: "📄" },
  { id: "hazardous", label: "Hazardous", icon: "☢️" },
  { id: "mixed", label: "Mixed", icon: "🗑️" },
];

type PhotoEntry = {
  file: File;
  preview: string;
  lat: number | null;
  lng: number | null;
  capturedAt: Date;
};

const ReportPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("Detecting location...");
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [exifSource, setExifSource] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [watermarking, setWatermarking] = useState(false);
  const [fakeWarning, setFakeWarning] = useState<string | null>(null);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [nearby, setNearby] = useState<{ id: string; waste_type: string; status: string; upvote_count: number; distance_m: number } | null>(null);
  const [aiFilled, setAiFilled] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<"wip" | "boosted" | null>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setAddress("Detecting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setExifSource(false);
      },
      () => setAddress("Location unavailable — enter manually")
    );
  };

  // Auto-detect location
  useState(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => setAddress("Location unavailable — enter manually")
      );
    }
  });

  // Nearby duplicate check (database only, no AI cost)
  useEffect(() => {
    if (!location) { setNearby(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("find_nearby_reports" as any, {
          p_lat: location.lat, p_lng: location.lng, p_radius_m: 75,
        });
        if (!cancelled) setNearby(((data as any[]) ?? [])[0] ?? null);
      } catch { if (!cancelled) setNearby(null); }
    })();
    return () => { cancelled = true; };
  }, [location?.lat, location?.lng]);

  const verifyPhoto = async (file: File): Promise<{ ok: boolean; reason?: string; suggestion?: any }> => {
    const until = Number(sessionStorage.getItem("ai_check_paused_until") || 0);
    if (Date.now() < until) return { ok: true, reason: "unchecked" };
    const pause = () => sessionStorage.setItem("ai_check_paused_until", String(Date.now() + 3 * 60 * 1000));
    try {
      const b64 = await compressToBase64(file);
      const timeout = new Promise<null>((res) => setTimeout(() => res(null), 10000));
      const result: any = await Promise.race([
        supabase.functions.invoke("verify-report-image", { body: { image: b64, mimeType: "image/jpeg" } }),
        timeout,
      ]);
      const data = result?.data;
      if (!result || result.error || !data || data.error || data.bypassed) {
        pause();
        return { ok: true, reason: "unchecked" };
      }
      if (!data.is_authentic || data.is_ai_generated) return { ok: false, reason: data.reason };
      return { ok: true, suggestion: data.suggestion };
    } catch {
      pause();
      return { ok: true, reason: "unchecked" };
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      setVerifying(true);
      setFakeWarning(null);
      const verdict = await verifyPhoto(file);
      setVerifying(false);
      if (!verdict.ok) {
        setFakeWarning(verdict.reason || "This image looks AI-generated or not genuine.");
        toast({
          title: "Fake image detected",
          description: "AI-generated or non-genuine photos cannot be reported. Please take a real photo on site.",
          variant: "destructive",
        });
        continue;
      }

      // AI auto-fill: only fill empty fields so citizen edits are never overwritten
      const sg = verdict.suggestion;
      if (sg) {
        if (sg.waste_type) { setSelectedCategory((c) => { return c || sg.waste_type; }); }
        if (sg.estimated_kg) { setQuantity((q) => { return q || String(sg.estimated_kg); }); }
        if (sg.description) { setDescription((d) => { return d || sg.description; }); }
        if (sg.waste_type || sg.estimated_kg || sg.description) setAiFilled(true);
      }

      setWatermarking(true);
      try {
        // 1. Parse EXIF for GPS + timestamp
        let exifLat: number | null = null;
        let exifLng: number | null = null;
        let shotAt: Date | null = null;
        try {
          const meta = await exifr.parse(file, {
            gps: true,
            pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"],
          });
          if (meta?.latitude && meta?.longitude) {
            exifLat = meta.latitude;
            exifLng = meta.longitude;
          }
          const exifDate = meta?.DateTimeOriginal || meta?.CreateDate;
          if (exifDate) shotAt = new Date(exifDate);
        } catch {
          // EXIF unavailable — continue with fallbacks
        }

        // 2. Fallback to Geolocation API if no EXIF GPS
        let photoLat = exifLat;
        let photoLng = exifLng;
        if (photoLat === null || photoLng === null) {
          const geo = await getCurrentLocation();
          if (geo) {
            photoLat = geo.lat;
            photoLng = geo.lng;
          }
        }

        // 3. Determine capture timestamp
        const captureTime = shotAt ?? new Date(file.lastModified || Date.now());

        // 4. Update location state if we now have coordinates
        if (photoLat !== null && photoLng !== null) {
          setLocation({ lat: photoLat, lng: photoLng });
          const fromPhoto = exifLat !== null;
          setAddress(`${photoLat.toFixed(4)}, ${photoLng.toFixed(4)}${fromPhoto ? " (from photo)" : ""}`);
          setExifSource(fromPhoto);
        }

        if (!capturedAt) setCapturedAt(captureTime);

        // 5. Watermark the image with date, time, and location
        const watermarked = await watermarkImage(file, photoLat, photoLng, captureTime);
        const preview = URL.createObjectURL(watermarked);

        setPhotos((p) => [
          ...p,
          { file: watermarked, preview, lat: photoLat, lng: photoLng, capturedAt: captureTime },
        ]);
        if (verdict.reason !== "unchecked") setVerifiedCount((n) => n + 1);
      } catch {
        // If watermarking fails, use the original file
        const preview = URL.createObjectURL(file);
        const fallbackTime = new Date(file.lastModified || Date.now());
        setPhotos((p) => [
          ...p,
          { file, preview, lat: null, lng: null, capturedAt: fallbackTime },
        ]);
        if (!capturedAt) setCapturedAt(fallbackTime);
        if (verdict.reason !== "unchecked") setVerifiedCount((n) => n + 1);
      } finally {
        setWatermarking(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "Your session expired. Sign in again and resubmit.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    if (!selectedCategory) {
      toast({
        title: "Choose a waste type",
        description: "Go back a step and pick a category before submitting.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      // Duplicate handling: same area already reported
      if (nearby) {
        if (nearby.status === "in_progress") {
          setDuplicateResult("wip");
          return;
        }
        const { error: escErr } = await supabase.rpc("escalate_report" as any, { p_report_id: nearby.id });
        if (escErr) throw escErr;
        setDuplicateResult("boosted");
        return;
      }
      // Upload watermarked photos to storage
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const fileName = `${user.id}/${Date.now()}-${photo.file.name}`;
        const { data, error: upErr } = await supabase.storage.from("report-photos").upload(fileName, photo.file);
        if (upErr) throw upErr;
        if (data) {
          const { data: urlData } = supabase.storage.from("report-photos").getPublicUrl(data.path);
          photoUrls.push(urlData.publicUrl);
        }
      }

      // Use the first photo's capture time as the report's captured_at
      const reportCapturedAt = photos[0]?.capturedAt ?? capturedAt ?? new Date();

      // Create waste report
      const { error } = await supabase.from("waste_reports").insert({
        reporter_id: user.id,
        waste_type: selectedCategory,
        description,
        quantity_kg: quantity ? parseFloat(quantity) : null,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        address,
        photo_urls: photoUrls,
        captured_at: reportCapturedAt.toISOString(),
      } as any);

      if (error) throw error;

      // Alert supervisors of the new report (non-blocking)
      try {
        await supabase.rpc("notify_role" as any, {
          _role: "supervisor",
          _title: "New citizen report",
          _message: `${selectedCategory} reported${address ? ` near ${address}` : ""}.`,
          _type: "report",
        });
      } catch {
        /* notification failure must not block the report */
      }

      setSubmitted(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      toast({
        title: "Could not submit report",
        description: err?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (duplicateResult) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">
          {duplicateResult === "wip" ? "Work in progress" : "Priority boosted!"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {duplicateResult === "wip"
            ? "A cleanup team is already working at this spot. Thanks for checking!"
            : "This spot was already reported. We raised its priority level so it gets cleaned faster."}
        </p>
        <Button className="mt-6 rounded-xl" onClick={() => navigate("/")}>Back to home</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Report Submitted!</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Your report is under review. Credits will be released after verified collection.
        </p>
      </div>
    );
  }

  const nearbyBanner = nearby ? (
    nearby.status === "in_progress" ? (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
        🚧 <strong>Work in progress</strong> — a {nearby.waste_type} report ~{Math.round(nearby.distance_m)} m away is already being cleaned. No new report needed.
      </div>
    ) : (
      <div className="rounded-xl border border-accent bg-accent/30 p-3 text-xs text-foreground">
        📍 <strong>Already reported nearby</strong> (~{Math.round(nearby.distance_m)} m, priority level {nearby.upvote_count}). Submitting will boost its priority instead of creating a duplicate.
      </div>
    )
  ) : null;

  const steps = [
    // Step 0: Photo
    <div key="photo" className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-foreground">Take Photos</h2>
      <p className="text-sm text-muted-foreground">Upload clear photos of the waste</p>
      {verifying && (
        <div className="rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground animate-pulse">
          🔍 Verifying photo authenticity with AI...
        </div>
      )}
      {watermarking && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary animate-pulse">
          📍 Embedding location & timestamp watermark...
        </div>
      )}
      {fakeWarning && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          ⚠️ <strong>Fake image detected.</strong> AI-generated or non-genuine photos cannot be reported. {fakeWarning}
        </div>
      )}
      {!verifying && !watermarking && verifiedCount > 0 && !fakeWarning && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
          ✅ Verified authentic photo · watermarked with location & time
        </div>
      )}
      {nearbyBanner}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handlePhotoCapture}
      />
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            <div className="absolute bottom-0 right-0 bg-black/55 px-1.5 py-0.5 text-[7px] font-semibold text-white/95 leading-tight max-w-full">
              {p.capturedAt.toLocaleDateString()} {p.capturedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {p.lat !== null && p.lng !== null && (
                <div className="truncate">{p.lat.toFixed(3)} {p.lat >= 0 ? "N" : "S"}, {p.lng.toFixed(3)} {p.lng >= 0 ? "E" : "W"}</div>
              )}
            </div>
          </div>
        ))}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/40"
        >
          <Camera className="h-6 w-6 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Camera</span>
        </button>
        <button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = (e) => handlePhotoCapture(e as any);
            input.click();
          }}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/40"
        >
          <Image className="h-6 w-6 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Gallery</span>
        </button>
      </div>
    </div>,

    // Step 1: Category
    <div key="category" className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-foreground">Waste Category</h2>
      <p className="text-sm text-muted-foreground">Select the type of waste</p>
      <div className="grid grid-cols-2 gap-3">
        {wasteCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
              selectedCategory === cat.id
                ? "border-primary bg-primary/5 eco-shadow"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <span className="text-2xl">{cat.icon}</span>
            <span className="text-sm font-medium text-foreground">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Details
    <div key="details" className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-foreground">Details</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add quantity and description</p>
      </div>
      {aiFilled && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm">✨</span>
          <p className="flex-1 text-xs text-foreground">AI suggested the type, weight and description from your photo. Please check and change anything that's wrong.</p>
          <button type="button" aria-label="Dismiss" onClick={() => setAiFilled(false)} className="text-xs text-muted-foreground">✕</button>
        </div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Estimated Weight (kg)</label>
        <Input
          type="number"
          placeholder="e.g. 5"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Description (optional)</label>
        <Input
          placeholder="Describe the waste..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-xl"
        />
      </div>
      <div className="space-y-2 rounded-xl border border-border bg-muted/50 p-3">
        <div className="flex items-start gap-2">
          <MapPin className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Location {exifSource && <span className="text-[10px] text-primary">📷 from photo</span>}
            </p>
            <p className="text-xs text-muted-foreground break-all">{address}</p>
            {capturedAt && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Captured: {capturedAt.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <label className="text-xs font-medium text-foreground">Type address (optional)</label>
          <Input
            placeholder="e.g. Near Miramar beach, Panaji"
            value={manualAddress}
            onChange={(e) => {
              setManualAddress(e.target.value);
              if (e.target.value.trim()) {
                setAddress(e.target.value);
                setExifSource(false);
              }
            }}
            className="rounded-xl bg-background"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <Crosshair className="h-3.5 w-3.5" /> Use my location
            </button>
            <button
              type="button"
              onClick={() => setShowMapPicker((v) => !v)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <MapIcon className="h-3.5 w-3.5" /> {showMapPicker ? "Hide map" : "Pick on map"}
            </button>
          </div>

          {showMapPicker && (
            <div className="h-56 overflow-hidden rounded-xl border border-border">
              <MapContainer
                center={[location?.lat ?? 15.395, location?.lng ?? 73.998]}
                zoom={location ? 15 : 11}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Recenter pos={location} />
                <LocationPicker
                  value={location}
                  onChange={(v) => {
                    setLocation(v);
                    setExifSource(false);
                    if (!manualAddress.trim()) {
                      setAddress(`${v.lat.toFixed(4)}, ${v.lng.toFixed(4)}`);
                    }
                  }}
                />
              </MapContainer>
              <p className="mt-1 text-[10px] text-muted-foreground text-center">Tap map to drop pin</p>
            </div>
          )}
        </div>
      </div>
    </div>,

    // Step 3: Review
    <div key="review" className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-foreground">Review & Submit</h2>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Category</span>
          <span className="font-medium text-foreground capitalize">{selectedCategory ?? "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Quantity</span>
          <span className="font-medium text-foreground">{quantity ? `${quantity} kg` : "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Photos</span>
          <span className="font-medium text-foreground">{photos.length} uploaded</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Location</span>
          <span className="font-medium text-foreground text-right max-w-[180px] truncate">{address}</span>
        </div>
        {capturedAt && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Captured</span>
            <span className="font-medium text-foreground">{capturedAt.toLocaleString()}</span>
          </div>
        )}
      </div>
      <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        ℹ️ Credits will be released <strong>only after</strong> verified collection
      </p>
    </div>,
  ];

  return (
    <div className="px-4 py-6">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => (step > 0 ? setStep(step - 1) : navigate(-1))}>
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex flex-1 gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "eco-gradient" : "bg-muted"}`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{step + 1}/{steps.length}</span>
      </div>

      {steps[step]}

      <div className="mt-8">
        {step < steps.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            className="w-full rounded-xl py-6 text-sm font-semibold"
            disabled={step === 0 && (photos.length === 0 || verifying || watermarking)}
          >
            Continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-xl py-6 text-sm font-semibold"
          >
            <Upload className="mr-2 h-4 w-4" /> {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReportPage;
