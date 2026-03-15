import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, UtensilsCrossed, Compass, Truck, ShoppingBag, Plane, Ruler, Video, BookOpen, Camera, Users } from "lucide-react";

const FEATURES = [
  { key: "concierge", label: "Concierge (AI Chat)", icon: UtensilsCrossed },
  { key: "explore", label: "Explore Activities", icon: Compass },
  { key: "delivery", label: "Delivery", icon: Truck },
  { key: "shopping", label: "Shopping", icon: ShoppingBag },
  { key: "travel", label: "Travel", icon: Plane },
  { key: "measurements", label: "Measurements & Tracking", icon: Ruler },
  { key: "video_library", label: "Video Library", icon: Video },
  { key: "resources", label: "Resources & Documents", icon: BookOpen },
  { key: "community", label: "Community Groups", icon: Users },
] as const;

const SUB_FEATURES = [
  { key: "food_photo_ai", parentKey: "measurements", label: "Food Photo AI (Multi-Photo)", icon: Camera },
] as const;

type FeatureAccess = Record<string, boolean>;

interface FeatureAccessPanelProps {
  templateId?: string;
  enrollmentId?: string;
  initialAccess?: FeatureAccess;
  onChanged?: (access: FeatureAccess) => void;
}

const FeatureAccessPanel = ({ templateId, enrollmentId, initialAccess, onChanged }: FeatureAccessPanelProps) => {
  const defaultAccess: FeatureAccess = Object.fromEntries(FEATURES.map(f => [f.key, true]));
  const [access, setAccess] = useState<FeatureAccess>(initialAccess || defaultAccess);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (initialAccess) setAccess(initialAccess);
  }, [initialAccess]);

  const toggle = (key: string) => {
    const updated = { ...access, [key]: !access[key] };
    setAccess(updated);
    setDirty(true);
    onChanged?.(updated);
  };

  const toggleAll = (on: boolean) => {
    const updated = Object.fromEntries(FEATURES.map(f => [f.key, on]));
    setAccess(updated);
    setDirty(true);
    onChanged?.(updated);
  };

  const save = async () => {
    if (enrollmentId) {
      const { error } = await supabase
        .from("client_program_enrollments" as any)
        .update({ feature_access_override: access } as any)
        .eq("id", enrollmentId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Client feature access saved" });
        setDirty(false);
      }
    } else if (templateId) {
      const { error } = await supabase
        .from("program_templates" as any)
        .update({ feature_access: access } as any)
        .eq("id", templateId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Feature access saved" });
        setDirty(false);
      }
    }
  };

  const allOn = FEATURES.every(f => access[f.key]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-sans text-muted-foreground">Select which app features clients in this program can access.</p>
        <button
          onClick={() => toggleAll(!allOn)}
          className="text-[10px] font-sans font-medium text-gold hover:underline"
        >
          {allOn ? "Deselect All" : "Full Access"}
        </button>
      </div>

      <div className="grid gap-2">
        {FEATURES.map(({ key, label, icon: Icon }) => (
          <>
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs font-sans cursor-pointer">{label}</Label>
              </div>
              <Switch
                checked={access[key] ?? true}
                onCheckedChange={() => toggle(key)}
              />
            </div>
            {/* Sub-features */}
            {SUB_FEATURES.filter(sf => sf.parentKey === key).map(sf => {
              const SubIcon = sf.icon;
              if (!access[key]) return null;
              return (
                <div
                  key={sf.key}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 ml-6 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <SubIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-[11px] font-sans cursor-pointer text-muted-foreground">{sf.label}</Label>
                  </div>
                  <Switch
                    checked={access[sf.key] ?? false}
                    onCheckedChange={() => toggle(sf.key)}
                  />
                </div>
              );
            })}
          </>
        ))}
      </div>

      {dirty && (
        <button
          onClick={save}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold py-2 text-xs font-sans font-semibold text-gold-foreground hover:opacity-90 transition-opacity"
        >
          <Save className="h-3.5 w-3.5" />
          Save Feature Access
        </button>
      )}
    </div>
  );
};

export default FeatureAccessPanel;
