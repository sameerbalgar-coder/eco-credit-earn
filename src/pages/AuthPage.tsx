import { useState } from "react";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Leaf, User, HardHat, ClipboardCheck, Building2 } from "lucide-react";
import ecoLogo from "@/assets/ecocredit-logo.png";
import { useToast } from "@/hooks/use-toast";

const roles: { id: AppRole; label: string; icon: typeof User; desc: string }[] = [
  { id: "citizen", label: "Citizen / Volunteer", icon: User, desc: "Report waste & earn credits" },
  { id: "worker", label: "Worker", icon: HardHat, desc: "Complete cleanup tasks" },
  { id: "supervisor", label: "Supervisor", icon: ClipboardCheck, desc: "Manage & assign tasks" },
  { id: "admin", label: "Municipality / Admin", icon: Building2, desc: "Full system oversight" },
];

const AuthPage = () => {
  const { signUp, signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("citizen");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!loading && user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({ title: "Login failed", description: error.message, variant: "destructive" });
        } else {
          navigate("/");
        }
      } else {
        const { error } = await signUp(email, password, displayName, selectedRole);
        if (error) {
          toast({ title: "Signup failed", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Account created!", description: "Welcome to EcoCredit!" });
          navigate("/");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <img src={ecoLogo} alt="EcoCredit" className="h-16 w-16 rounded-2xl" />
          <h1 className="text-xl font-bold text-foreground">EcoCredit</h1>
          <p className="text-xs text-muted-foreground">Smart Waste Reporting & Rewards</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex rounded-xl border border-border bg-muted/50 p-1">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              isLogin ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              !isLogin ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
                className="rounded-xl"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="rounded-xl"
            />
          </div>

          {/* Role Selection (signup only) */}
          {!isLogin && (
            <div>
              <label className="mb-2 block text-xs font-medium text-foreground">Select Your Role</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRole(r.id)}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                      selectedRole === r.id
                        ? "border-primary bg-primary/5 eco-shadow"
                        : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <r.icon className={`h-4 w-4 ${selectedRole === r.id ? "text-primary" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{r.label}</p>
                      <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-5 text-sm font-semibold"
          >
            {submitting ? "Please wait..." : isLogin ? "Login" : "Create Account"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
