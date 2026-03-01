import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, MapPin, Users, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const AdminZonesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [zones, setZones] = useState<any[]>([]);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchZones = async () => {
    const { data } = await supabase.from("zones").select("*").order("created_at", { ascending: false });
    if (data) {
      setZones(data);
      // Fetch staff counts per zone
      const { data: staff } = await supabase.from("zone_staff").select("zone_id");
      if (staff) {
        const counts: Record<string, number> = {};
        staff.forEach((s: any) => { counts[s.zone_id] = (counts[s.zone_id] ?? 0) + 1; });
        setStaffCounts(counts);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchZones(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("zones").insert({ name: newName.trim(), description: newDesc.trim() || null } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      fetchZones();
      toast({ title: "Zone created ✅" });
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("zones").delete().eq("id", id);
    fetchZones();
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
          <h1 className="text-lg font-bold text-foreground">Zone Manager</h1>
        </div>
        <Button size="sm" className="rounded-lg" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-1 h-4 w-4" /> Add Zone
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-fade-in">
          <Input placeholder="Zone name" value={newName} onChange={e => setNewName(e.target.value)} className="rounded-lg" />
          <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="rounded-lg" />
          <div className="flex gap-2">
            <Button size="sm" className="rounded-lg" onClick={handleCreate}>Create</Button>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : zones.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No zones created yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {zones.map(z => (
            <div key={z.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{z.name}</p>
                    {z.description && <p className="text-xs text-muted-foreground">{z.description}</p>}
                  </div>
                </div>
                <button onClick={() => handleDelete(z.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{staffCounts[z.id] ?? 0} staff assigned</span>
                <Button size="sm" variant="outline" className="ml-auto rounded-lg text-xs h-7" onClick={() => navigate(`/admin/zones/${z.id}/staff`)}>
                  Manage Staff
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminZonesPage;
