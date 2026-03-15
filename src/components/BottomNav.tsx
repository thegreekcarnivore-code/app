import { Home, Compass, Ruler, Shield, Video, ChefHat, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("feature_access")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFeatureAccess((data as any).feature_access || {});
      });
  }, [user]);

  const hasAccess = (key: string) => isAdmin || featureAccess[key] !== false;

  const items = [
    { path: "/home", icon: Home, label: t("home"), guide: "nav-home" },
    { path: "/discover", icon: Compass, label: lang === "el" ? "Ανακαλυψτε" : "Discover", guide: "nav-discover" },
    ...(hasAccess("measurements") ? [{ path: "/measurements", icon: Ruler, label: t("measurements"), guide: "nav-measurements" }] : []),
    ...(hasAccess("video_library") ? [{ path: "/learn", icon: Video, label: lang === "el" ? "Μαθηματα" : "Learn", guide: "nav-learn" }] : []),
    ...(hasAccess("community") ? [{ path: "/community", icon: Users, label: lang === "el" ? "Κοινότητα" : "Community", guide: "nav-community" }] : []),
    ...(isAdmin ? [
      { path: "/resources", icon: ChefHat, label: lang === "el" ? "Συνταγές" : "Recipes", guide: "nav-resources" },
      { path: "/admin", icon: Shield, label: "Admin", guide: "nav-admin" },
    ] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold/15 glass">
      <div
        className="mx-auto flex items-center justify-start md:justify-center gap-1 px-2 py-3 overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map(({ path, icon: Icon, label, guide }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              data-guide={guide}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all duration-200 shrink-0 min-w-[3.5rem]",
                isActive ? "text-gold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-sans font-medium tracking-wide whitespace-nowrap">{label}</span>
              {isActive && <span className="h-1 w-1 rounded-full bg-gold" />}
            </button>
          );
        })}
      </div>
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};

export default BottomNav;
