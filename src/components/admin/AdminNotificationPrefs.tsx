import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Bell, Scale, Camera, Clock, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const AdminNotificationPrefs = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifyWeight, setNotifyWeight] = useState(true);
  const [notifyPhotos, setNotifyPhotos] = useState(true);
  const [notifyLate, setNotifyLate] = useState(true);
  const [lateThreshold, setLateThreshold] = useState(7);

  useEffect(() => {
    if (!user) return;
    loadPrefs();
  }, [user]);

  const loadPrefs = async () => {
    const { data } = await supabase
      .from("admin_notification_prefs" as any)
      .select("*")
      .eq("admin_id", user!.id)
      .maybeSingle();

    if (data) {
      setNotifyWeight((data as any).notify_weight);
      setNotifyPhotos((data as any).notify_photos);
      setNotifyLate((data as any).notify_late);
      setLateThreshold((data as any).late_threshold_days);
    }
    setLoading(false);
  };

  const savePrefs = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      admin_id: user.id,
      notify_weight: notifyWeight,
      notify_photos: notifyPhotos,
      notify_late: notifyLate,
      late_threshold_days: lateThreshold,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("admin_notification_prefs" as any)
      .upsert(payload as any, { onConflict: "admin_id" });

    setSaving(false);
    if (error) {
      toast({ title: "Error saving preferences", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Notification preferences saved" });
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 card-inset">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5 card-inset">
      <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        Client Notification Preferences
      </h2>
      <p className="text-sm text-muted-foreground font-sans">
        Control which client activity notifications you receive.
      </p>

      <div className="space-y-4">
        {/* Weight measurements */}
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Scale className="h-4 w-4 text-primary" />
            <div>
              <Label className="text-sm font-sans font-medium">Weight Measurements</Label>
              <p className="text-xs text-muted-foreground">Notify when a client logs a weight measurement</p>
            </div>
          </div>
          <Switch checked={notifyWeight} onCheckedChange={setNotifyWeight} />
        </div>

        {/* Progress photos */}
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Camera className="h-4 w-4 text-primary" />
            <div>
              <Label className="text-sm font-sans font-medium">Progress Photos</Label>
              <p className="text-xs text-muted-foreground">Notify when a client uploads a progress photo</p>
            </div>
          </div>
          <Switch checked={notifyPhotos} onCheckedChange={setNotifyPhotos} />
        </div>

        {/* Late clients */}
        <div className="rounded-xl border border-border px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-destructive" />
              <div>
                <Label className="text-sm font-sans font-medium">Late Client Alerts</Label>
                <p className="text-xs text-muted-foreground">Notify when a client hasn't logged measurements</p>
              </div>
            </div>
            <Switch checked={notifyLate} onCheckedChange={setNotifyLate} />
          </div>
          {notifyLate && (
            <div className="flex items-center gap-2 pl-7">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Alert after</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={lateThreshold}
                onChange={(e) => setLateThreshold(parseInt(e.target.value) || 7)}
                className="w-16 h-8 text-sm rounded-lg"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={savePrefs}
        disabled={saving}
        className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Preferences"}
      </button>
    </div>
  );
};

export default AdminNotificationPrefs;
