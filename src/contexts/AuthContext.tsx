import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "citizen" | "worker" | "supervisor" | "admin";

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: AppRole;
  credits_balance: number;
  co2_saved_kg: number;
  contribution_score: number;
  badge_level: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  onlineUserIds: Set<string>;
  signUp: (email: string, password: string, displayName: string, role: AppRole) => Promise<{ error: any; data: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // Presence: track this user in a shared channel so supervisors can see who's online.
  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      return;
    }
    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUserIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchProfile = async (userId: string, retries = 5): Promise<void> => {
    for (let i = 0; i < retries; i++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data) {
        setProfile(data as unknown as Profile);
        return;
      }
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  };

  const applySession = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    if (!nextSession?.user) {
      setProfile(null);
    }
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        applySession(nextSession);
        if (event === "SIGNED_OUT") return;

        const userId = nextSession?.user?.id;
        if (userId) {
          queueMicrotask(() => {
            void fetchProfile(userId);
          });
        }
      }
    );

    // Always start at the login page: clear any stored session on fresh app load,
    // except when arriving via a password-recovery link (needs its session).
    const isRecovery = window.location.hash.includes("type=recovery");
    if (!isRecovery) {
      supabase.auth.signOut().finally(() => {
        applySession(null);
      });
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        applySession(session);
        if (session?.user) {
          void fetchProfile(session.user.id);
        }
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string, role: AppRole) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, role },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error, data };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, onlineUserIds, signUp, signIn, signOut, refreshProfile, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};
