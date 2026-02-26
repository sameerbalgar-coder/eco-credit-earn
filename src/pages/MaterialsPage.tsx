import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface WasteCategory {
  id: string;
  name: string;
  icon: string;
  handling_info: string;
  recycling_method: string;
  credits_per_kg: number;
}

const MaterialsPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<WasteCategory[]>([]);
  const [selected, setSelected] = useState<WasteCategory | null>(null);

  useEffect(() => {
    supabase.from("waste_categories").select("*").then(({ data }) => {
      if (data) setCategories(data as unknown as WasteCategory[]);
    });
  }, []);

  if (selected) {
    return (
      <div className="px-4 py-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)}>
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">
            {selected.icon} {selected.name}
          </h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How to Handle</p>
            <p className="mt-1 text-sm text-foreground">{selected.handling_info}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recycling Method</p>
            <p className="mt-1 text-sm text-foreground">{selected.recycling_method}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-3">
            <span className="text-sm font-medium text-foreground">Credit Value</span>
            <span className="text-lg font-bold text-primary">{selected.credits_per_kg} / kg</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Recyclable Materials</h1>
      </div>
      <p className="text-sm text-muted-foreground">Learn about waste categories, handling methods, and credit values.</p>

      <div className="space-y-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelected(cat)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 transition-all hover:eco-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{cat.icon}</span>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{cat.name}</p>
                <p className="text-xs text-muted-foreground">{cat.credits_per_kg} credits/kg</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default MaterialsPage;
