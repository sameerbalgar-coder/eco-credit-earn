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

type Mode = "login" | "signup" | "forgot";

const AuthPage = () => {
  const { signUp, signIn, resetPassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("citizen");
  const [submitting, setSubmitting] = useState(false);

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  // Redirect if already logged in
  if (!loading && user) {
    navigate("/", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isForgot) {
        const { error } = await resetPassword(email);
        if (error) {
          const msg = error.message?.includes("fetch")
            ? "Network error. Please check your connection and try again."
            : error.message;
          toast({ title: "Reset failed", description: msg, variant: "destructive" });
        } else {
          toast({ title: "Check your email", description: "We sent a password reset link to " + email });
          setMode("login");
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          const msg = error.message?.includes("fetch")
            ? "Network error. Please check your connection and try again."
            : error.message;
          toast({ title: "Login failed", description: msg, variant: "destructive" });
        } else {
          navigate("/");
        }
      } else {
        const { error, data } = await signUp(email, password, displayName, selectedRole);
        if (error) {
          const msg = error.message?.includes("fetch")
            ? "Network error. Please check your connection and try again."
            : error.message;
          toast({ title: "Signup failed", description: msg, variant: "destructive" });
        } else if (data?.session) {
          toast({ title: "Account created!", description: "Welcome to EcoCredit!" });
          navigate("/");
        } else if (data?.user && !data.session) {
          toast({ title: "Check your email", description: "We sent a verification link to " + email });
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

        {/* Tab Toggle - hidden in forgot mode */}
        {!isForgot && (
          <div className="flex rounded-xl border border-border bg-muted/50 p-1">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                isLogin ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                isSignup ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {isForgot && (
          <p className="text-center text-sm text-muted-foreground">
            Enter your email and we'll send you a reset link.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
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

          {!isForgot && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-foreground">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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
          )}

          {/* Role Selection (signup only) */}
          {isSignup && (
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
            {submitting
              ? "Please wait..."
              : isForgot
              ? "Send reset link"
              : isLogin
              ? "Login"
              : "Create Account"}
          </Button>

          {isForgot && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="block w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              ← Back to login
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthPage;

