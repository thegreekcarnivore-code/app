import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ALLOWED_PATHS = ["/intake", "/policy", "/billing", "/auth", "/metamorphosis", "/unico"];

const IntakeGate = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || isAdmin) {
      setCompleted(true);
      return;
    }
    void check();
  }, [user, isAdmin]);

  const check = async () => {
    const { data: enrollment } = await supabase
      .from("client_program_enrollments")
      .select("id, status")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!enrollment) {
      setCompleted(true);
      return;
    }

    const { data: intake } = await supabase
      .from("member_intakes" as any)
      .select("completed_at")
      .eq("user_id", user!.id)
      .maybeSingle();

    setCompleted(!!(intake as { completed_at?: string | null } | null)?.completed_at);
  };

  useEffect(() => {
    if (completed === false && !ALLOWED_PATHS.some((p) => location.pathname.startsWith(p))) {
      navigate("/intake", { replace: true });
    }
  }, [completed, location.pathname, navigate]);

  if (completed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
};

export default IntakeGate;
