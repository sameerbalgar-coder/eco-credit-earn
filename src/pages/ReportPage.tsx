import { useState } from "react";
import {
  Camera,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const wasteCategories = [
  { id: "plastic", label: "Plastic", icon: "♻️" },
  { id: "organic", label: "Organic", icon: "🍂" },
  { id: "ewaste", label: "E-Waste", icon: "🔌" },
  { id: "metal", label: "Metal", icon: "🔩" },
  { id: "glass", label: "Glass", icon: "🫙" },
  { id: "paper", label: "Paper", icon: "📄" },
  { id: "textile", label: "Textile", icon: "👕" },
  { id: "mixed", label: "Mixed", icon: "🗑️" },
];

const quantityOptions = ["Small bag", "Large bag", "Pile", "Dumpster-sized"];

const ReportPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handlePhotoAdd = () => {
    // Simulated photo
    setPhotos((p) => [...p, `/placeholder.svg`]);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => navigate("/"), 2000);
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
      <p className="text-sm text-muted-foreground">
        Upload clear photos of the waste for AI analysis
      </p>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <div key={i} className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            <img src={p} alt="" className="h-full w-full object-cover" />
          </div>
        ))}
        <button
          onClick={handlePhotoAdd}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/40"
        >
          <Camera className="h-6 w-6 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Add Photo</span>
        </button>
      </div>
      {photos.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary">🤖 AI Suggestion</p>
          <p className="mt-1 text-sm text-foreground">
            Detected: <strong>Plastic waste</strong> — Water bottles, packaging
          </p>
        </div>
      )}
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

    // Step 2: Quantity + Location
    <div key="details" className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-bold text-foreground">Quantity & Location</h2>
        <p className="mt-1 text-sm text-muted-foreground">Estimate size and confirm location</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Estimated Quantity</p>
        <div className="grid grid-cols-2 gap-3">
          {quantityOptions.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuantity(q)}
              className={`rounded-xl border p-3 text-sm font-medium transition-all ${
                selectedQuantity === q
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-foreground hover:border-primary/30"
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Location</p>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-3">
          <MapPin className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Auto-detected</p>
            <p className="text-xs text-muted-foreground">MG Road, Sector 14, Gurugram</p>
          </div>
        </div>
      </div>
    </div>,

    // Step 3: Review
    <div key="review" className="space-y-4 animate-fade-in">
      <h2 className="text-lg font-bold text-foreground">Review & Submit</h2>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Category</span>
          <span className="font-medium text-foreground capitalize">
            {selectedCategory ?? "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Quantity</span>
          <span className="font-medium text-foreground">{selectedQuantity ?? "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Photos</span>
          <span className="font-medium text-foreground">{photos.length} uploaded</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Location</span>
          <span className="font-medium text-foreground">MG Road, Sector 14</span>
        </div>
      </div>
      <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        ℹ️ Credits will be released <strong>only after</strong> verified QR-based collection
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
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= step ? "eco-gradient" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {step + 1}/{steps.length}
        </span>
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
            className="w-full rounded-xl py-6 text-sm font-semibold"
          >
            <Upload className="mr-2 h-4 w-4" /> Submit Report
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReportPage;
