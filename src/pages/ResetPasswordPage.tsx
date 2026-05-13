import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ecoLogo from "@/assets/ecocredit-logo.png";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase places recovery tokens in the URL hash and fires a PASSWORD_RECOVERY event
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery") || hash.includes("access_token");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Fallback: if a session exists from the recovery link, allow update
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && isRecovery) setReady(true);
      else if (!isRecovery) setInvalid(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "You can now log in with your new password." });
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img src={ecoLogo} alt="EcoCredit" className="h-16 w-16 rounded-2xl" />
          <h1 className="text-xl font-bold text-foreground">Reset your password</h1>
          <p className="text-xs text-muted-foreground">Enter a new password for your account</p>
        </div>

        {invalid && !ready ? (
          <div className="rounded-xl border border-border bg-card p-4 text-center space-y-3">
            <p className="text-sm text-foreground">This reset link is invalid or has expired.</p>
            <Button onClick={() => navigate("/auth")} className="w-full rounded-xl">
              Back to login
            </Button>
          </div>
        ) : !ready ? (
          <p className="text-center text-sm text-muted-foreground">Verifying reset link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">New Password</label>
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Confirm Password</label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="rounded-xl"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full rounded-xl py-5 text-sm font-semibold">
              {submitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
