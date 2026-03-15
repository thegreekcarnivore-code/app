import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FeatureAccessPanel from "@/components/admin/FeatureAccessPanel";
import { CheckCircle } from "lucide-react";

interface ApproveUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  onApproved: () => void;
}

const ApproveUserDialog = ({ open, onOpenChange, userId, userEmail, onApproved }: ApproveUserDialogProps) => {
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({
    concierge: true, explore: true, delivery: true, shopping: true,
    travel: true, measurements: true, video_library: true, resources: true,
  });
  const [saving, setSaving] = useState(false);

  const handleApprove = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ approved: true, feature_access: featureAccess } as any)
      .eq("id", userId);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User approved", description: `${userEmail} now has access.` });
      onOpenChange(false);
      onApproved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            Approve — {userEmail}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="font-sans text-xs text-muted-foreground">
            Select which features this client can access, then approve.
          </p>

          <FeatureAccessPanel
            initialAccess={featureAccess}
            onChanged={setFeatureAccess}
          />

          <button
            onClick={handleApprove}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {saving ? "Approving..." : "Approve & Grant Access"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApproveUserDialog;
