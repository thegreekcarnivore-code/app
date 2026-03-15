import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FeatureAccessPanel from "@/components/admin/FeatureAccessPanel";
import { Save } from "lucide-react";

interface EditFeatureAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

const EditFeatureAccessDialog = ({ open, onOpenChange, userId, userEmail }: EditFeatureAccessDialogProps) => {
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && userId) fetchAccess();
  }, [open, userId]);

  const fetchAccess = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("feature_access" as any)
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setFeatureAccess((data as any).feature_access || {
        concierge: true, explore: true, delivery: true, shopping: true,
        travel: true, measurements: true, video_library: true, resources: true,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ feature_access: featureAccess } as any)
      .eq("id", userId);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Feature access updated" });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            Feature Access — {userEmail}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <FeatureAccessPanel
              initialAccess={featureAccess}
              onChanged={setFeatureAccess}
            />

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Feature Access"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditFeatureAccessDialog;
