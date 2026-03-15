import { useState, useEffect } from "react";
import { UtensilsCrossed, Truck, Compass, ShoppingCart } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePageActions } from "@/context/PageActionsContext";
import { motion, AnimatePresence } from "framer-motion";
import Index from "./Index";
import Delivery from "./Delivery";
import Explore from "./Explore";
import Shopping from "./Shopping";

type DiscoverTab = "restaurant" | "delivery" | "explore" | "shopping";

const TAB_CONFIG: { key: DiscoverTab; icon: typeof UtensilsCrossed; labelEn: string; labelEl: string; featureKey: string }[] = [
  { key: "restaurant", icon: UtensilsCrossed, labelEn: "Restaurant", labelEl: "Εστιατόριο", featureKey: "restaurant" },
  { key: "delivery", icon: Truck, labelEn: "Delivery", labelEl: "Delivery", featureKey: "delivery" },
  { key: "explore", icon: Compass, labelEn: "Activities", labelEl: "Δραστηριότητες", featureKey: "explore" },
  { key: "shopping", icon: ShoppingCart, labelEn: "Shopping", labelEl: "Ψώνια", featureKey: "shopping" },
];

const Discover = () => {
  const { lang } = useLanguage();
  const { isAdmin, user } = useAuth();
  const isGreek = lang === "el";
  const [activeTab, setActiveTab] = useState<DiscoverTab | null>(null);
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});
  const { registerActions, clearActions } = usePageActions();

  useEffect(() => {
    registerActions({ featureKey: "discover", featureLabel: "Discover" });
    return () => clearActions();
  }, [registerActions, clearActions]);

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
  const visibleTabs = TAB_CONFIG.filter((t) => hasAccess(t.featureKey));

  if (activeTab) {
    return (
      <div>
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="px-4 pt-3 pb-2">
            <button
              onClick={() => setActiveTab(null)}
              className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {isGreek ? "Πίσω" : "Back"}
            </button>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "restaurant" && <Index />}
            {activeTab === "delivery" && <Delivery />}
            {activeTab === "explore" && <Explore />}
            {activeTab === "shopping" && <Shopping />}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="pt-14 pb-24 px-5 space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="font-serif text-xl font-semibold text-foreground">
          {isGreek ? "Ανακαλύψτε" : "Discover"}
        </h1>
        <p className="font-sans text-xs text-muted-foreground mt-1">
          {isGreek
            ? "Εστιατόρια, delivery, δραστηριότητες & ψώνια"
            : "Restaurants, delivery, activities & shopping"}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {visibleTabs.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.key}
              data-guide={`discover-${tab.key}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 hover:border-gold/40 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                <Icon className="h-6 w-6 text-gold" />
              </div>
              <span className="font-sans text-sm font-medium text-foreground">
                {isGreek ? tab.labelEl : tab.labelEn}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default Discover;
