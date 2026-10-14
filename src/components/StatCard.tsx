import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "primary" | "accent";
}

const StatCard = ({ icon: Icon, label, value, sub, variant = "default" }: StatCardProps) => {
  const bg =
    variant === "primary"
      ? "eco-gradient-soft border-primary/20"
      : variant === "accent"
      ? "bg-accent/40 border-accent"
      : "bg-card border-border";

  return (
    <div className={`rounded-2xl border p-4 ${bg} transition-all`}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
};

export default StatCard;
