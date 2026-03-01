import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Phone, Mail, MapPin, Search, Recycle, Building2, Home, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const RecyclingPage = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "household" | "business">("all");

  useEffect(() => {
    supabase.from("recycling_contacts").select("*").order("name").then(({ data }) => {
      if (data) setContacts(data);
      setLoading(false);
    });
  }, []);

  const filtered = contacts.filter(c => {
    if (filter !== "all" && c.service_type !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.address?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
        <h1 className="text-lg font-bold text-foreground">Recycling Services</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or area..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl" />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "All", icon: Recycle },
          { key: "household", label: "Household", icon: Home },
          { key: "business", label: "Business", icon: Building2 },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filter === f.key ? "eco-gradient text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <f.icon className="h-3.5 w-3.5" /> {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Recycle className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No recycling services found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    c.service_type === "household" ? "bg-eco-success/10 text-eco-success" : "bg-eco-info/10 text-eco-info"
                  }`}>
                    {c.service_type === "household" ? "🏠 Household" : "🏢 Business"}
                  </span>
                </div>
              </div>

              {c.waste_types?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.waste_types.map((w: string) => (
                    <span key={w} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground capitalize">{w}</span>
                  ))}
                </div>
              )}

              <div className="space-y-1 text-xs text-muted-foreground">
                {c.address && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.address}</p>}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-primary">
                    <Mail className="h-3 w-3" /> {c.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecyclingPage;
