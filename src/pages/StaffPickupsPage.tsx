import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Truck, Loader2, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type PickupStatus = "requested" | "confirmed" | "on_the_way" | "completed" | "cancelled";

const statusFlow: Record<PickupStatus, PickupStatus[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["on_the_way", "cancelled"],
  on_the_way: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const statusStyle: Record<PickupStatus, string> = {
  requested: "bg-eco-warning/10 text-eco-warning",
  confirmed: "bg-eco-info/10 text-eco-info",
  on_the_way: "bg-eco-info/10 text-eco-info",
  completed: "bg-eco-success/10 text-eco-success",
  cancelled: "bg-muted text-muted-foreground",
};

const slotLabel: Record<string, string> = {
  morning: "Morning 8-12",
  afternoon: "Afternoon 12-4",
  evening: "Evening 4-8",
};

const StaffPickupsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("pickup_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("recycling_contacts").select("id,name,phone"),
    ]);
    setRows(p ?? []);
    setContacts(c ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("staff-pickups")
      .on("postgres_changes", { event: "*", schema: "public", table: "pickup_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const update = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("pickup_requests").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  };

  return (
    <div className="space-y-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Pickup Requests</h1>
          <p className="text-xs text-muted-foreground">Assign partners and update status</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No pickup requests yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const status = r.status as PickupStatus;
            return (
              <div key={r.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold capitalize text-foreground">{r.waste_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.preferred_date).toLocaleDateString()} · {slotLabel[r.time_slot] ?? r.time_slot}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${statusStyle[status]}`}>
                    {status.replace(/_/g, " ")}
                  </span>
                </div>

                {r.address && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r.address}
                  </p>
                )}
                <a href={`tel:${r.contact_phone}`} className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Phone className="h-3.5 w-3.5" /> {r.contact_phone}
                </a>
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}

                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-muted-foreground">Recycling partner</label>
                  <select
                    value={r.contact_id ?? ""}
                    onChange={(e) => update(r.id, { contact_id: e.target.value || null })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Any available partner</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {statusFlow[status].length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {statusFlow[status].map((next) => (
                      <button
                        key={next}
                        onClick={() => update(r.id, { status: next })}
                        className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium capitalize text-foreground transition-colors hover:bg-muted"
                      >
                        Mark {next.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffPickupsPage;
