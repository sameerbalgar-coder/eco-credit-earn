import { useState, useRef } from "react";
import {
  Camera,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckCircle2,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import exifr from "exifr";

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

const ReportPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("Detecting location...");
  const [capturedAt, setCapturedAt] = useState<Date | null>(null);
  const [exifSource, setExifSource] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { file, preview }]);
      try {
        const meta = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
        if (meta?.latitude && meta?.longitude) {
          setLocation({ lat: meta.latitude, lng: meta.longitude });
          setAddress(`${meta.latitude.toFixed(4)}, ${meta.longitude.toFixed(4)} (from photo)`);
          setExifSource(true);
        }
        const shotAt = meta?.DateTimeOriginal || meta?.CreateDate;
        if (shotAt) setCapturedAt(new Date(shotAt));
        else if (!capturedAt) setCapturedAt(new Date(file.lastModified || Date.now()));
      } catch {
        setCapturedAt((c) => c ?? new Date(file.lastModified || Date.now()));
      }
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedCategory) return;
    setSubmitting(true);
    try {
      // Upload photos to storage
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const fileName = `${user.id}/${Date.now()}-${photo.file.name}`;
        const { data } = await supabase.storage.from("report-photos").upload(fileName, photo.file);
        if (data) {
          const { data: urlData } = supabase.storage.from("report-photos").getPublicUrl(data.path);
          photoUrls.push(urlData.publicUrl);
        }
      }

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
      } as any);

      if (error) throw error;
      setSubmitted(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
        <h2 className="mt-4 text-xl font-bold text-foreground">Report Submitted!</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Your report is under review. Credits will be released after verified collection.
        </p>
      </div>
    );
  }

  const steps = [
    // Step 0: Photo
    <div key="photo" className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-foreground">Take Photos</h2>
      <p className="text-sm text-muted-foreground">Upload clear photos of the waste</p>
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
          <div key={i} className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
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
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3">
        <MapPin className="h-5 w-5 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">Location</p>
          <p className="text-xs text-muted-foreground">{address}</p>
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
            disabled={step === 0 && photos.length === 0}
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
