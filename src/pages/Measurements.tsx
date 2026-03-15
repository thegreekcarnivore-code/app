import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { usePageActions } from "@/context/PageActionsContext";
import { cn } from "@/lib/utils";
import { Scale, Apple, Camera, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import MeasurementForm from "@/components/measurements/MeasurementForm";
import { useAuth } from "@/hooks/useAuth";
import BodyDashboard from "@/components/measurements/BodyDashboard";
import FoodDashboard from "@/components/measurements/FoodDashboard";
import PhotosDashboard from "@/components/measurements/PhotosDashboard";


interface MeasurementsProps {
  userId?: string;
}

const tabs = [
{ key: "body", icon: Scale, en: "Body", el: "Σώμα" },
{ key: "food", icon: Apple, en: "Food", el: "Φαγητό" },
{ key: "photos", icon: Camera, en: "Photos", el: "Φωτογραφίες" }] as
const;

const Measurements = ({ userId }: MeasurementsProps) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") as "body" | "food" | "photos" || "body";
  const [activeTab, setActiveTab] = useState<"body" | "food" | "photos">(initialTab);
  const { registerActions, clearActions } = usePageActions();
  const [formOpen, setFormOpen] = useState(false);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    registerActions({ featureKey: "measurements", featureLabel: "Measurements" });
    return () => clearActions();
  }, [registerActions, clearActions]);

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          {lang === "en" ? "Measurements" : "Μετρήσεις"}
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 mb-6">
        {tabs.map(({ key, icon: Icon, en, el }) =>
        <button
          key={key}
          data-guide={`measurements-${key}`}
          onClick={() => setActiveTab(key)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 font-sans text-sm font-medium transition-all",
            activeTab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}>
          
            <Icon className="h-4 w-4" />
            {lang === "en" ? en : el}
          </button>
        )}
      </div>

      {/* New Measurement button */}
      


      

      {activeTab === "body" && (
        <>
          <button
            onClick={() => setFormOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-sans text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 mb-5"
          >
            <Plus className="h-5 w-5" />
            {lang === "en" ? "New Measurement" : "Νέα Μέτρηση"}
          </button>
          <BodyDashboard userId={userId} />
        </>
      )}
      {activeTab === "food" && <FoodDashboard userId={userId} />}
      {activeTab === "photos" && <PhotosDashboard userId={userId} />}

      <MeasurementForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editEntry={null}
        userId={targetUserId || ""} />
      
    </div>);

};

export default Measurements;