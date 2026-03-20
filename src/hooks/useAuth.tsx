import { useState, useEffect, createContext, useContext, useCallback, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  approved: boolean | null;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  recheckApproval: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setApproved(null);
        setIsAdmin(false);
        setLoading(false);
      }
      // Update last_login_at on any sign-in event (covers password, invite, magic link)
      if (event === 'SIGNED_IN' && session?.user) {
        supabase.from("profiles")
          .update({ last_login_at: new Date().toISOString() } as any)
          .eq("id", session.user.id)
          .then();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check approval and admin status when user changes
  useEffect(() => {
    if (user) {
      checkApprovalAndRole(user.id);
    }
  }, [user]);

  const checkApprovalAndRole = async (userId: string) => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("approved").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
      ]);
      setApproved(profileRes.data?.approved ?? false);
      setIsAdmin(!!roleRes.data);
    } catch {
      setApproved(false);
      setIsAdmin(false);
    }
    setLoading(false);
  };

  const recheckApproval = async () => {
    if (user) await checkApprovalAndRole(user.id);
  };

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({ user, session, loading, approved, isAdmin, signUp, signIn, signOut, recheckApproval }), [user, session, loading, approved, isAdmin, signUp, signIn, signOut, recheckApproval]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
