import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, LogOut, Ruler, Sun, Moon, Bell, BellOff } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import IconButtonWithTooltip from "@/components/IconButtonWithTooltip";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import AdminNotificationPrefs from "@/components/admin/AdminNotificationPrefs";
import { Switch } from "@/components/ui/switch";


const Profile = () => {
  const { user, signOut } = useAuth();
  const { lang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [sex, setSex] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, date_of_birth, avatar_url, height_cm, sex")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName((data as any).display_name ?? "");
          setDateOfBirth((data as any).date_of_birth ?? "");
          setAvatarUrl((data as any).avatar_url ?? null);
          setHeightCm((data as any).height_cm?.toString() ?? "");
          setSex((data as any).sex ?? "");
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const h = parseFloat(heightCm);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        date_of_birth: dateOfBirth || null,
        height_cm: isNaN(h) ? null : h,
        sex: sex || null,
      } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/avatar.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = publicUrl.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: url } as any).eq("id", user.id);
    setAvatarUrl(url);
    setUploading(false);
    toast({ title: "Photo updated" });
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="py-6 space-y-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="text-2xl font-serif font-semibold text-foreground">{lang === "en" ? "Profile" : "Προφίλ"}</h1>

      {/* Avatar section */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20 ring-2 ring-gold/30 ring-offset-2 ring-offset-background">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
            <AvatarFallback className="text-2xl font-serif bg-primary/10 text-primary">{userInitial}</AvatarFallback>
          </Avatar>
          <IconButtonWithTooltip
            tooltip="Change photo"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gold text-gold-foreground flex items-center justify-center shadow-md hover:bg-gold/90 transition-colors"
          >
            <Camera className="h-3.5 w-3.5" />
          </IconButtonWithTooltip>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground">Signed in</p>
        </div>
      </div>

      {/* Personal Details */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 card-inset">
        <h2 className="text-lg font-serif font-semibold text-foreground">{lang === "en" ? "Personal Details" : "Προσωπικά Στοιχεία"}</h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="displayName" className="text-xs font-sans">{lang === "en" ? "Display Name" : "Όνομα"}</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={lang === "en" ? "Your name" : "Το όνομά σας"} className="rounded-xl border-border focus:ring-gold focus:border-gold/50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob" className="text-xs font-sans">{lang === "en" ? "Date of Birth" : "Ημερομηνία Γέννησης"}</Label>
            <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="rounded-xl border-border focus:ring-gold focus:border-gold/50" />
          </div>
        </div>
      </div>

      {/* Body Profile */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 card-inset">
        <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
          <Ruler className="h-5 w-5 text-primary" />
          {lang === "en" ? "Body Profile" : "Σωματικό Προφίλ"}
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="height" className="text-xs font-sans">{lang === "en" ? "Height (cm)" : "Ύψος (cm)"}</Label>
            <Input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" className="rounded-xl border-border focus:ring-gold focus:border-gold/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-sans">{lang === "en" ? "Sex" : "Φύλο"}</Label>
            <Select value={sex} onValueChange={setSex}>
              <SelectTrigger className="rounded-xl border-border focus:ring-gold focus:border-gold/50">
                <SelectValue placeholder={lang === "en" ? "Select" : "Επιλογή"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{lang === "en" ? "Male" : "Άνδρας"}</SelectItem>
                <SelectItem value="female">{lang === "en" ? "Female" : "Γυναίκα"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 card-inset">
        <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
          {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
          {lang === "en" ? "Appearance" : "Εμφάνιση"}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme("light")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-sans font-medium border transition-all ${
              theme === "light"
                ? "border-gold bg-gold/10 text-gold shadow-sm"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <Sun className="h-4 w-4" />
            {lang === "en" ? "Light" : "Φωτεινό"}
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-sans font-medium border transition-all ${
              theme === "dark"
                ? "border-gold bg-gold/10 text-gold shadow-sm"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            <Moon className="h-4 w-4" />
            {lang === "en" ? "Dark" : "Σκοτεινό"}
          </button>
        </div>
      </div>

      {/* Admin Notification Preferences */}
      {isAdmin && <AdminNotificationPrefs />}

      {/* Push Notifications */}
      <PushNotificationSection />


      {/* Save button */}
      <button onClick={handleSave} disabled={saving} className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-3.5 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50">
        {saving ? (lang === "en" ? "Saving…" : "Αποθήκευση…") : (lang === "en" ? "Save Details" : "Αποθήκευση")}
      </button>

      {/* Sign Out */}
      <div className="pt-4 text-center">
        <button
          onClick={() => { signOut(); navigate("/auth"); }}
          className="font-sans text-sm text-muted-foreground hover:text-foreground hover:underline transition-all duration-200 inline-flex items-center gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" /> {lang === "en" ? "Sign Out" : "Αποσύνδεση"}
        </button>
      </div>
    </div>
  );
};

const PushNotificationSection = () => {
  const { lang } = useLanguage();
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast({ title: lang === "en" ? "Notifications disabled" : "Οι ειδοποιήσεις απενεργοποιήθηκαν" });
    } else {
      const success = await subscribe();
      if (success) {
        toast({ title: lang === "en" ? "Notifications enabled!" : "Οι ειδοποιήσεις ενεργοποιήθηκαν!" });
      } else if (permission === "denied") {
        toast({
          title: lang === "en" ? "Notifications blocked" : "Ειδοποιήσεις αποκλεισμένες",
          description: lang === "en"
            ? "Please enable notifications in your browser settings"
            : "Ενεργοποιήστε τις ειδοποιήσεις στις ρυθμίσεις του browser σας",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5 card-inset">
      <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        {lang === "en" ? "Push Notifications" : "Ειδοποιήσεις Push"}
      </h2>
      <p className="text-sm text-muted-foreground font-sans">
        {lang === "en"
          ? "Get notified on your phone when you receive new messages, tasks, or reminders."
          : "Λάβετε ειδοποιήσεις στο κινητό σας για νέα μηνύματα, εργασίες ή υπενθυμίσεις."}
      </p>
      <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <div className="flex items-center gap-3">
          {isSubscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-sans font-medium text-foreground">
            {loading
              ? (lang === "en" ? "Updating…" : "Ενημέρωση…")
              : isSubscribed
                ? (lang === "en" ? "Notifications On" : "Ειδοποιήσεις Ενεργές")
                : (lang === "en" ? "Notifications Off" : "Ειδοποιήσεις Ανενεργές")}
          </span>
        </div>
        <Switch checked={isSubscribed} disabled={loading} onCheckedChange={handleToggle} />
      </div>
    </div>
  );
};

export default Profile;
