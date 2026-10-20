import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, UserPlus, Users, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SupervisorWorkersPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, onlineUserIds } = useAuth();
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [zones, setZones] = useState<any[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", zoneId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const onlineCount = workers.filter((w) => onlineUserIds.has(w.id)).length;

  useEffect(() => {
    fetchWorkers();
    fetchZones();
    const channel = supabase
      .channel("workers-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => fetchWorkers())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchWorkers())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchZones = async () => {
    const { data } = await supabase.from("zones").select("id, name").order("name");
    if (data) setZones(data);
  };

  const fetchWorkers = async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "worker");

    if (roles && roles.length > 0) {
      const ids = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      if (profiles) setWorkers(profiles);
    }
    setLoading(false);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = "Full name is required";
    else if (form.fullName.trim().length < 2) errs.fullName = "Name is too short";
    if (!form.email.trim() && !form.phone.trim()) {
      errs.email = "Email or phone is required";
    } else {
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errs.email = "Enter a valid email address";
      }
      if (form.phone.trim() && !/^[0-9]{10}$/.test(form.phone.trim())) {
        errs.phone = "Enter a valid 10-digit phone number";
      }
    }
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 6) errs.password = "Password must be at least 6 characters";
    if (!form.zoneId) errs.zoneId = "Select a zone";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setCreating(true);
    try {
      const email = form.email.trim().toLowerCase();
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: form.password,
        email_confirm: true,
        user_metadata: { display_name: form.fullName.trim(), role: "worker", zone_id: form.zoneId },
      });
      if (authError) throw authError;
      const userId = authData.user.id;
      await supabase.from("user_roles").insert({ user_id: userId, role: "worker" } as any);
      await supabase.from("profiles").upsert({
        id: userId,
        display_name: form.fullName.trim(),
        email,
        role: "worker",
        assigned_zone_id: form.zoneId,
      } as any);
      toast({ title: "Worker created!", description: `${form.fullName.trim()} can now sign in as a worker.` });
      setShowCreate(false);
      setForm({ fullName: "", email: "", phone: "", password: "", zoneId: "" });
      setErrors({});
      fetchWorkers();
    } catch (err: any) {
      toast({ title: "Could not create worker", description: err?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const shareLocation = (worker: any) => {
    // Try to get current location and send as notification
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported", variant: "destructive" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        await supabase.from("notifications").insert({
          user_id: worker.id,
          title: "📍 Location Shared",
          message: `Supervisor shared a location with you: ${mapUrl}`,
          type: "location",
        });
        toast({ title: "Location shared!", description: `Sent to ${worker.display_name || "worker"}.` });
      },
      () => {
        toast({ title: "Could not get location", variant: "destructive" });
      }
    );
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Workers</h1>
        <Button size="sm" className="ml-auto rounded-xl" onClick={() => setShowCreate(true)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> Add Worker
        </Button>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Team Overview</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {workers.length} worker{workers.length !== 1 ? "s" : ""} registered • <span className="font-semibold text-eco-success">{onlineCount} online now</span>
        </p>
      </div>

      {/* Worker List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">No workers yet</p>
          <p className="text-xs text-muted-foreground mt-1">Workers need to sign up with the "Worker" role.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...workers]
            .sort((a, b) => Number(onlineUserIds.has(b.id)) - Number(onlineUserIds.has(a.id)))
            .map((w) => {
              const online = onlineUserIds.has(w.id);
              return (
            <div key={w.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {(w.display_name || "W").slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                        online ? "bg-eco-success" : "bg-muted-foreground/40"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{w.display_name || "Worker"}</p>
                    <p className="text-xs text-muted-foreground">{w.email}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    online ? "bg-eco-success/10 text-eco-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {online ? "Online" : "Offline"}
                </span>
              </div>
              <button
                onClick={() => shareLocation(w)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Mail className="h-3.5 w-3.5" />
                Share Location
              </button>
            </div>
              );
            })}
        </div>
      )}

      {/* Create Worker Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setErrors({}); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Create New Worker
            </DialogTitle>
            <DialogDescription>
              Create a worker account. The worker can sign in with their email and password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input
                placeholder="e.g. Rajesh Kumar"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="rounded-xl"
              />
              {errors.fullName && <p className="text-[11px] text-destructive">{errors.fullName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="worker@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded-xl"
                />
                {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Phone</label>
                <Input
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                  className="rounded-xl"
                />
                {errors.phone && <p className="text-[11px] text-destructive">{errors.phone}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="rounded-xl"
              />
              {errors.password && <p className="text-[11px] text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Assigned Zone</label>
              <Select value={form.zoneId} onValueChange={(v) => setForm({ ...form, zoneId: v })}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Select a zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.zoneId && <p className="text-[11px] text-destructive">{errors.zoneId}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
              {creating ? "Creating..." : "Create Worker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupervisorWorkersPage;
