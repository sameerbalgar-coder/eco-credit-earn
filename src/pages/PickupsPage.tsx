import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Truck,
  Plus,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Crosshair,
  Map as MapIcon,
  Camera,
  CheckCircle2,
  X,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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

const slots = [
  { id: "morning", label: "Morning", time: "8 AM – 12 PM" },
  { id: "afternoon", label: "Afternoon", time: "12 – 4 PM" },
  { id: "evening", label: "Evening", time: "4 – 8 PM" },
];

const statusMeta: Record<string, { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-amber-500/10 text-amber-600" },
  confirmed: { label: "Confirmed", cls: "bg-eco-info/10 text-eco-info" },
  on_the_way: { label: "On the way", cls: "bg-eco-info/10 text-eco-info" },
  completed: { label: "Completed", cls: "bg-eco-success/10 text-eco-success" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground" },
};

const pickupSchema = z.object({
  waste_type: z.string().min(1, "Select a waste type"),
  preferred_date: z.string().refine((d) => {
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(d) >= today;
  }, "Pick today or a future date"),
  time_slot: z.string().min(1, "Select a time slot"),
  contact_phone: z.string().trim().regex(/^[0-9]{10}$/, "Enter a valid 10-digit phone number"),
  address: z.string().trim().min(1, "Enter a pickup address").max(200, "Address is too long"),
  notes: z.string().trim().max(500, "Notes must be under 500 characters"),
  quantity_kg: z.string().refine((v) => v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), "Weight must be a positive number"),
});

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const PickupsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [requests, setRequests] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // form state
  const [wasteType, setWasteType] = useState("");
  const [date, setDate] = useState(todayStr());
  const [slot, setSlot] = useState("morning");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    const [{ data: reqs }, { data: cts }] = await Promise.all([
      supabase.from("pickup_requests" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("recycling_contacts").select("*").order("name"),
    ]);
    setRequests((reqs as any[]) ?? []);
    setContacts(cts ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel("pickup-requests-citizen")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pickup_requests", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Your device does not support GPS.", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!address.trim()) setAddress(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      () => toast({ title: "Permission needed", description: "Allow location access or type the address.", variant: "destructive" })
    );
  };

  const sortedContacts = location
    ? [...contacts].sort((a, b) => {
        const da = a.latitude && a.longitude ? distanceKm(location, { lat: Number(a.latitude), lng: Number(a.longitude) }) : 1e9;
        const db = b.latitude && b.longitude ? distanceKm(location, { lat: Number(b.latitude), lng: Number(b.longitude) }) : 1e9;
        return da - db;
      })
    : contacts;

  const resetForm = () => {
    setWasteType("");
    setDate(todayStr());
    setSlot("morning");
    setPhone("");
    setAddress("");
    setQuantity("");
    setNotes("");
    setContactId("");
    setPhoto(null);
    setShowMap(false);
    setErrors({});
  };

  const submit = async () => {
    if (!user) return;
    const parsed = pickupSchema.safeParse({
      waste_type: wasteType,
      preferred_date: date,
      time_slot: slot,
      contact_phone: phone,
      address,
      notes,
      quantity_kg: quantity,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const path = `pickups/${user.id}/${Date.now()}-${photo.file.name}`;
        const { data } = await supabase.storage.from("report-photos").upload(path, photo.file);
        if (data) photoUrl = supabase.storage.from("report-photos").getPublicUrl(data.path).data.publicUrl;
      }

      const { data: inserted, error } = await supabase
        .from("pickup_requests" as any)
        .insert({
          user_id: user.id,
          waste_type: wasteType,
          preferred_date: date,
          time_slot: slot,
          contact_phone: phone.trim(),
          address: address.trim(),
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          quantity_kg: quantity ? parseFloat(quantity) : null,
          notes: notes.trim() || null,
          photo_url: photoUrl,
          contact_id: contactId || null,
        } as any)
        .select()
        .single();
      if (error) throw error;

      await supabase.rpc("notify_role" as any, {
        _role: "supervisor",
        _title: "New pickup request",
        _message: `${wasteType} pickup requested for ${date} (${slot})${address ? ` at ${address}` : ""}.`,
        _type: "pickup",
      });

      setCreatedId((inserted as any)?.id ?? null);
      setShowForm(false);
      resetForm();
      load();
    } catch (err: any) {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (id: string) => {
    const { error } = await supabase.from("pickup_requests" as any).update({ status: "cancelled" } as any).eq("id", id);
    if (error) toast({ title: "Could not cancel", description: error.message, variant: "destructive" });
    else load();
  };

  const upcoming = requests.filter((r) => ["requested", "confirmed", "on_the_way"].includes(r.status));
  const history = requests.filter((r) => ["completed", "cancelled"].includes(r.status));
  const list = tab === "upcoming" ? upcoming : history;

  if (createdId) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Pickup Requested!</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Your request ID is <strong className="text-foreground">#{createdId.slice(0, 8).toUpperCase()}</strong>. A recycling
          partner will confirm your slot shortly.
        </p>
        <Button className="mt-6 rounded-xl" onClick={() => setCreatedId(null)}>
          View My Pickups
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Go back">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">On-Demand Pickup</h1>
      </div>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.98]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-foreground">Request a pickup</p>
            <p className="text-[11px] text-muted-foreground">Choose waste type, date and time slot</p>
          </div>
          <Plus className="h-5 w-5 text-primary" />
        </button>
      )}

      {showForm && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">New Pickup Request</h2>
            <button onClick={() => setShowForm(false)} aria-label="Close form">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Waste type */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Waste type</label>
            <div className="grid grid-cols-2 gap-2">
              {wasteCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setWasteType(c.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-all ${
                    wasteType === c.id ? "border-primary bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className="font-medium text-foreground">{c.label}</span>
                </button>
              ))}
            </div>
            {errors.waste_type && <p className="text-[11px] text-destructive">{errors.waste_type}</p>}
          </div>

          {/* Date & slot */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Preferred date</label>
            <Input type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" />
            {errors.preferred_date && <p className="text-[11px] text-destructive">{errors.preferred_date}</p>}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {slots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSlot(s.id)}
                  className={`rounded-xl border p-2 text-center transition-all ${
                    slot === s.id ? "border-primary bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <p className="text-xs font-medium text-foreground">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.time}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Contact number</label>
            <Input
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className="rounded-xl"
            />
            {errors.contact_phone && <p className="text-[11px] text-destructive">{errors.contact_phone}</p>}
          </div>

          {/* Address / location */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Pickup address</label>
            <Input
              placeholder="House / street / landmark"
              maxLength={200}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded-xl"
            />
            {errors.address && <p className="text-[11px] text-destructive">{errors.address}</p>}
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
                onClick={() => setShowMap((v) => !v)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <MapIcon className="h-3.5 w-3.5" /> {showMap ? "Hide map" : "Pick on map"}
              </button>
            </div>
            {showMap && (
              <div className="h-56 overflow-hidden rounded-xl border border-border">
                <MapContainer
                  center={[location?.lat ?? 15.395, location?.lng ?? 73.998]}
                  zoom={location ? 15 : 11}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom
                >
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Recenter pos={location} />
                  <LocationPicker value={location} onChange={setLocation} />
                </MapContainer>
              </div>
            )}
          </div>

          {/* Partner */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Recycling partner</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="">Any available partner</option>
              {sortedContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.service_type ? ` — ${c.service_type}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Optional extras */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Weight (kg)</label>
              <Input
                type="number"
                min="0"
                placeholder="Optional"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Photo</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto({ file: f, preview: URL.createObjectURL(f) });
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background text-xs text-muted-foreground"
              >
                <Camera className="h-3.5 w-3.5" /> {photo ? "Change" : "Add photo"}
              </button>
            </div>
          </div>
          {errors.quantity_kg && <p className="text-[11px] text-destructive">{errors.quantity_kg}</p>}
          {photo && (
            <img src={photo.preview} alt="Pickup waste preview" className="h-24 w-24 rounded-xl object-cover" />
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Notes (optional)</label>
            <Input
              placeholder="Gate code, floor, timing hints..."
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
            />
            {errors.notes && <p className="text-[11px] text-destructive">{errors.notes}</p>}
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full rounded-xl py-6 text-sm font-semibold">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            {submitting ? "Submitting..." : "Request Pickup"}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["upcoming", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
              tab === t ? "eco-gradient text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t} ({t === "upcoming" ? upcoming.length : history.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Truck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === "upcoming" ? "No upcoming pickups yet." : "No past pickups."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const partner = contacts.find((c) => c.id === r.contact_id);
            const meta = statusMeta[r.status] ?? statusMeta.requested;
            return (
              <div key={r.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold capitalize text-foreground">{r.waste_type} pickup</p>
                    <p className="text-[11px] text-muted-foreground">
                      #{r.id.slice(0, 8).toUpperCase()} · {new Date(r.preferred_date).toLocaleDateString()} ·{" "}
                      {slots.find((s) => s.id === r.time_slot)?.label ?? r.time_slot}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>
                </div>

                {r.address && (
                  <p className="flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {r.address}
                  </p>
                )}
                {r.quantity_kg && <p className="text-xs text-muted-foreground">≈ {r.quantity_kg} kg</p>}
                {r.notes && <p className="text-xs text-muted-foreground">📝 {r.notes}</p>}

                <div className="rounded-lg bg-muted/50 p-2 text-xs">
                  {partner ? (
                    <>
                      <p className="font-medium text-foreground">{partner.name}</p>
                      <div className="mt-1 flex gap-3">
                        {partner.phone && (
                          <a href={`tel:${partner.phone}`} className="flex items-center gap-1 text-primary">
                            <Phone className="h-3 w-3" /> Call
                          </a>
                        )}
                        {partner.email && (
                          <a href={`mailto:${partner.email}`} className="flex items-center gap-1 text-primary">
                            <Mail className="h-3 w-3" /> Email
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Awaiting partner assignment</p>
                  )}
                </div>

                {["requested", "confirmed"].includes(r.status) && (
                  <button
                    onClick={() => cancelRequest(r.id)}
                    className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-destructive hover:bg-muted"
                  >
                    Cancel request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PickupsPage;
