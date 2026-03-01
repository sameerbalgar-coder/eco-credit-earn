import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const ZoneStaffPage = () => {
  const navigate = useNavigate();
  const { zoneId } = useParams();
  const { toast } = useToast();
  const [zone, setZone] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const fetchData = async () => {
    if (!zoneId) return;
    const [zoneRes, staffRes] = await Promise.all([
      supabase.from("zones").select("*").eq("id", zoneId).single(),
      supabase.from("zone_staff").select("*").eq("zone_id", zoneId),
    ]);
    if (zoneRes.data) setZone(zoneRes.data);
    const staffData = staffRes.data ?? [];

    // Fetch profile details for staff
    if (staffData.length > 0) {
      const ids = staffData.map((s: any) => s.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, role, badge_level").in("id", ids);
      const profileMap: Record<string, any> = {};
      profiles?.forEach(p => { profileMap[p.id] = p; });
      setStaff(staffData.map((s: any) => ({ ...s, profile: profileMap[s.user_id] })));
    } else {
      setStaff([]);
    }
    setLoading(false);
  };

  const fetchAvailable = async () => {
    const { data } = await supabase.from("profiles").select("id, display_name, role").in("role", ["worker", "supervisor"]);
    const assignedIds = staff.map(s => s.user_id);
    setAvailable((data ?? []).filter(p => !assignedIds.includes(p.id)));
    setShowAdd(true);
  };

  useEffect(() => { fetchData(); }, [zoneId]);

  const handleAdd = async (userId: string, role: string) => {
    await supabase.from("zone_staff").insert({ zone_id: zoneId, user_id: userId, role } as any);
    setShowAdd(false);
    fetchData();
    toast({ title: "Staff added ✅" });
  };

  const handleRemove = async (id: string) => {
    await supabase.from("zone_staff").delete().eq("id", id);
    fetchData();
  };

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ChevronLeft className="h-5 w-5 text-foreground" /></button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{zone?.name ?? "Zone"}</h1>
            <p className="text-xs text-muted-foreground">Staff Management</p>
          </div>
        </div>
        <Button size="sm" className="rounded-lg" onClick={fetchAvailable}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 animate-fade-in">
          <p className="text-sm font-medium text-foreground">Available Staff</p>
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground">No available workers/supervisors</p>
          ) : (
            available.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-card p-3 border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{p.role}</p>
                </div>
                <Button size="sm" className="rounded-lg h-7 text-xs" onClick={() => handleAdd(p.id, p.role)}>Assign</Button>
              </div>
            ))
          )}
          <Button size="sm" variant="outline" className="rounded-lg w-full" onClick={() => setShowAdd(false)}>Cancel</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No staff assigned to this zone.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {(s.profile?.display_name ?? "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.profile?.display_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{s.role} • {s.profile?.badge_level ?? "Bronze"}</p>
                </div>
              </div>
              <button onClick={() => handleRemove(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10">
                <UserMinus className="h-4 w-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ZoneStaffPage;
