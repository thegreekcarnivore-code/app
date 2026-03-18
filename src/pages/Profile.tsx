import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BellOff,
  Camera,
  LogOut,
  Mail,
  Moon,
  Ruler,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
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
      toast({
        title: lang === "en" ? "Error saving" : "Σφάλμα αποθήκευσης",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: lang === "en" ? "Profile updated" : "Το προφίλ ενημερώθηκε" });
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
      toast({
        title: lang === "en" ? "Upload failed" : "Αποτυχία μεταφόρτωσης",
        description: uploadError.message,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }
    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = publicUrl.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: url } as any).eq("id", user.id);
    setAvatarUrl(url);
    setUploading(false);
    toast({ title: lang === "en" ? "Photo updated" : "Η φωτογραφία ενημερώθηκε" });
  };

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "?";
  const accountLabels = {
    title: lang === "en" ? "Profile" : "Προφίλ",
    subtitle: lang === "en"
      ? "Identity, body profile, preferences, and account controls in one place."
      : "Ταυτότητα, body profile, ρυθμίσεις και account controls σε ένα σημείο.",
    signedIn: lang === "en" ? "Signed in" : "Συνδεδεμένος λογαριασμός",
    coachAccess: isAdmin ? (lang === "en" ? "Coach access" : "Πρόσβαση coach") : (lang === "en" ? "Client account" : "Λογαριασμός πελάτη"),
  };

  return (
    <div className="space-y-6 py-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {lang === "en" ? "Back" : "Πίσω"}
      </button>

      <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--beige))_0%,hsl(var(--background))_100%)] p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-2 ring-gold/35 ring-offset-2 ring-offset-background">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profile" /> : null}
                <AvatarFallback className="bg-gradient-to-br from-gold to-primary text-2xl font-serif text-primary-foreground">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <IconButtonWithTooltip
                tooltip={lang === "en" ? "Change photo" : "Αλλαγή φωτογραφίας"}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-md transition-colors hover:bg-gold/90"
              >
                <Camera className="h-4 w-4" />
              </IconButtonWithTooltip>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-gold">
                  {accountLabels.title}
                </p>
                <h1 className="font-serif text-3xl font-semibold text-foreground">
                  {displayName || user?.email || accountLabels.title}
                </h1>
                <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
                  {accountLabels.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-sans font-medium text-foreground">
                  <Mail className="h-3.5 w-3.5 text-gold" />
                  {accountLabels.signedIn}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-sans font-medium text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-gold" />
                  {accountLabels.coachAccess}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-sans font-medium text-foreground">
                  {theme === "dark" ? <Moon className="h-3.5 w-3.5 text-gold" /> : <Sun className="h-3.5 w-3.5 text-gold" />}
                  {theme === "dark"
                    ? (lang === "en" ? "Dark mode" : "Σκοτεινό theme")
                    : (lang === "en" ? "Light mode" : "Φωτεινό theme")}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate("/measurements")}
              className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4 text-left transition-all hover:border-gold/35 hover:shadow-sm"
            >
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {lang === "en" ? "Progress hub" : "Κέντρο προόδου"}
              </p>
              <p className="mt-2 font-serif text-lg font-semibold text-foreground">
                {lang === "en" ? "Open measurements" : "Άνοιγμα μετρήσεων"}
              </p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                {lang === "en"
                  ? "Update body stats, photos, and food logs."
                  : "Ενημέρωσε body stats, φωτογραφίες και food logs."}
              </p>
            </button>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                {lang === "en" ? "Support" : "Υποστήριξη"}
              </p>
              <p className="mt-2 font-serif text-lg font-semibold text-foreground">
                {lang === "en" ? "Stay connected" : "Μείνε συνδεδεμένος"}
              </p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                {lang === "en"
                  ? "Messages, notifications, and the coach dashboard all work from the same account."
                  : "Μηνύματα, ειδοποιήσεις και coaching dashboard λειτουργούν από τον ίδιο λογαριασμό."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 card-inset space-y-5">
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                {lang === "en" ? "Identity" : "Ταυτότητα"}
              </p>
              <h2 className="text-lg font-serif font-semibold text-foreground">
                {lang === "en" ? "Personal details" : "Προσωπικά στοιχεία"}
              </h2>
              <p className="font-sans text-sm text-muted-foreground">
                {lang === "en"
                  ? "These details shape how the app addresses you and structures your account."
                  : "Αυτά τα στοιχεία καθορίζουν πώς σε εμφανίζει η εφαρμογή και πώς οργανώνεται ο λογαριασμός σου."}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="displayName" className="text-xs font-sans">{lang === "en" ? "Display name" : "Όνομα"}</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={lang === "en" ? "Your name" : "Το όνομά σας"} className="rounded-xl border-border focus:ring-gold focus:border-gold/50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dob" className="text-xs font-sans">{lang === "en" ? "Date of birth" : "Ημερομηνία γέννησης"}</Label>
                <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="rounded-xl border-border focus:ring-gold focus:border-gold/50" />
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs font-sans text-muted-foreground">{lang === "en" ? "Signed-in email" : "Email λογαριασμού"}</p>
                <p className="mt-1 text-sm font-sans font-medium text-foreground">{user?.email}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 card-inset space-y-5">
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                {lang === "en" ? "Body profile" : "Body profile"}
              </p>
              <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
                <Ruler className="h-5 w-5 text-primary" />
                {lang === "en" ? "Reference details" : "Στοιχεία αναφοράς"}
              </h2>
              <p className="font-sans text-sm text-muted-foreground">
                {lang === "en"
                  ? "Baseline information that helps measurements and coaching stay consistent."
                  : "Βασικές πληροφορίες που βοηθούν τις μετρήσεις και το coaching να παραμένουν συνεπή."}
              </p>
            </div>

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
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 card-inset space-y-5">
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                {lang === "en" ? "Preferences" : "Ρυθμίσεις"}
              </p>
              <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                {lang === "en" ? "Appearance" : "Εμφάνιση"}
              </h2>
              <p className="font-sans text-sm text-muted-foreground">
                {lang === "en"
                  ? "Choose the theme that makes the daily experience clearer for you."
                  : "Επίλεξε το theme που κάνει την καθημερινή εμπειρία πιο καθαρή για εσένα."}
              </p>
            </div>

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
          </section>

          {isAdmin && <AdminNotificationPrefs />}

          <PushNotificationSection />

          <section className="rounded-2xl border border-border bg-card p-6 card-inset space-y-4">
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                {lang === "en" ? "Account support" : "Υποστήριξη λογαριασμού"}
              </p>
              <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {lang === "en" ? "Need to adjust something?" : "Χρειάζεται κάποια αλλαγή;"}
              </h2>
              <p className="font-sans text-sm text-muted-foreground">
                {lang === "en"
                  ? "Your profile, notifications, and progress tools all stay tied to this account."
                  : "Το προφίλ, οι ειδοποιήσεις και τα εργαλεία προόδου παραμένουν συνδεδεμένα με αυτόν τον λογαριασμό."}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-xs font-sans text-muted-foreground">{lang === "en" ? "Support email" : "Email υποστήριξης"}</p>
              <p className="mt-1 text-sm font-sans font-medium text-foreground">info@thegreekcarnivore.com</p>
            </div>

            <button
              onClick={() => navigate("/home")}
              className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-gold transition-colors hover:text-gold/80"
            >
              {lang === "en" ? "Return to dashboard" : "Επιστροφή στο dashboard"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </section>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-gold py-3.5 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (lang === "en" ? "Saving…" : "Αποθήκευση…") : (lang === "en" ? "Save profile" : "Αποθήκευση προφίλ")}
      </button>

      <div className="pt-2 text-center">
        <button
          onClick={() => {
            signOut();
            navigate("/auth");
          }}
          className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground transition-all duration-200 hover:text-foreground hover:underline"
        >
          <LogOut className="h-3.5 w-3.5" />
          {lang === "en" ? "Sign out" : "Αποσύνδεση"}
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
    <section className="rounded-2xl border border-border bg-card p-6 card-inset space-y-5">
      <div className="space-y-1">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          {lang === "en" ? "Notifications" : "Ειδοποιήσεις"}
        </p>
        <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          {lang === "en" ? "Push notifications" : "Ειδοποιήσεις push"}
        </h2>
        <p className="font-sans text-sm text-muted-foreground">
          {lang === "en"
            ? "Get notified on your phone for new messages, tasks, and reminders."
            : "Λάβε ειδοποιήσεις στο κινητό σου για νέα μηνύματα, tasks και reminders."}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <div className="flex items-center gap-3">
          {isSubscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-sans font-medium text-foreground">
            {loading
              ? (lang === "en" ? "Updating…" : "Ενημέρωση…")
              : isSubscribed
                ? (lang === "en" ? "Notifications on" : "Ειδοποιήσεις ενεργές")
                : (lang === "en" ? "Notifications off" : "Ειδοποιήσεις ανενεργές")}
          </span>
        </div>
        <Switch checked={isSubscribed} disabled={loading} onCheckedChange={handleToggle} />
      </div>
    </section>
  );
};

export default Profile;
