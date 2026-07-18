import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Trash2, Pencil, Coins, Loader2, Gift, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Reward = {
  id: string;
  title: string;
  description: string | null;
  reward_type: string;
  credit_cost: number;
  image_url: string | null;
  stock: number | null;
  active: boolean;
};

const REWARD_TYPES = [
  { id: "discount", label: "Discount" },
  { id: "scratch_card", label: "Scratch Card" },
  { id: "voucher", label: "Voucher" },
  { id: "freebie", label: "Freebie" },
];

const emptyForm = {
  id: "",
  title: "",
  description: "",
  reward_type: "discount",
  credit_cost: 100,
  image_url: "",
  stock: "" as string,
  active: true,
};

const AdminOffersPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("rewards" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setRewards((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      title: editing.title.trim(),
      description: editing.description.trim() || null,
      reward_type: editing.reward_type,
      credit_cost: Number(editing.credit_cost) || 0,
      image_url: editing.image_url.trim() || null,
      stock: editing.stock === "" ? null : Number(editing.stock),
      active: editing.active,
    };
    const { error } = editing.id
      ? await supabase.from("rewards" as any).update(payload).eq("id", editing.id)
      : await supabase.from("rewards" as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Offer updated" : "Offer added" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this offer?")) return;
    const { error } = await supabase.from("rewards" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setRewards((r) => r.filter((x) => x.id !== id));
  };

  const toggleActive = async (r: Reward) => {
    await supabase.from("rewards" as any).update({ active: !r.active }).eq("id", r.id);
    setRewards((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)));
  };

  return (
    <div className="px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">Credit Exchange</h1>
        <Button size="sm" onClick={() => setEditing({ ...emptyForm })} className="rounded-xl">
          <Plus className="mr-1 h-4 w-4" /> Add Offer
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Manage rewards users can redeem with credits — discounts, scratch cards, vouchers, freebies.
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rewards.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <Gift className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No offers yet. Add your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rewards.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{r.title}</p>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 capitalize">
                      {r.reward_type.replace("_", " ")}
                    </span>
                    {!r.active && (
                      <span className="text-[10px] rounded-full bg-destructive/10 text-destructive px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Coins className="h-3 w-3" /> {r.credit_cost}
                    </span>
                    {r.stock !== null && <span>Stock: {r.stock}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() =>
                      setEditing({
                        id: r.id,
                        title: r.title,
                        description: r.description ?? "",
                        reward_type: r.reward_type,
                        credit_cost: r.credit_cost,
                        image_url: r.image_url ?? "",
                        stock: r.stock === null ? "" : String(r.stock),
                        active: r.active,
                      })
                    }
                    className="p-1.5 rounded-lg hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-muted">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => toggleActive(r)}
                className="text-[11px] font-medium text-primary"
              >
                {r.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {editing.id ? "Edit Offer" : "New Offer"}
              </h2>
              <button onClick={() => setEditing(null)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Title</label>
              <Input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="rounded-xl"
                maxLength={100}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Description</label>
              <Textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="rounded-xl"
                rows={2}
                maxLength={300}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Type</label>
                <select
                  value={editing.reward_type}
                  onChange={(e) => setEditing({ ...editing, reward_type: e.target.value })}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  {REWARD_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Credit cost</label>
                <Input
                  type="number"
                  min={0}
                  value={editing.credit_cost}
                  onChange={(e) =>
                    setEditing({ ...editing, credit_cost: Number(e.target.value) })
                  }
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Stock (optional)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Unlimited"
                  value={editing.stock}
                  onChange={(e) => setEditing({ ...editing, stock: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Image URL (optional)</label>
                <Input
                  value={editing.image_url}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              Active (visible to users)
            </label>
            <Button onClick={save} disabled={saving} className="w-full rounded-xl">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing.id ? "Save changes" : "Create offer"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOffersPage;
