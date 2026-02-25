import { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickActionProps {
  icon: LucideIcon;
  label: string;
  to: string;
  color?: string;
}

const QuickAction = ({ icon: Icon, label, to, color }: QuickActionProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(to)}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:eco-shadow active:scale-[0.97]"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color ?? "bg-primary/10"}`}
      >
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  );
};

export default QuickAction;
