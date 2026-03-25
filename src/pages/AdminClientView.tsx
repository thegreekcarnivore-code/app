import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Scale, Apple, Camera, Heart, CalendarDays, User, Pencil, Check, X, BookOpen, FileSignature, ExternalLink, Plus, DollarSign, CreditCard, KeyRound, Mail, Copy } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import BodyDashboard from "@/components/measurements/BodyDashboard";
import FoodDashboard from "@/components/measurements/FoodDashboard";
import PhotosDashboard from "@/components/measurements/PhotosDashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ClientProgramDialog from "@/components/ClientProgramDialog";
import EditEnrollmentDialog from "@/components/admin/EditEnrollmentDialog";
import MeasurementForm from "@/components/measurements/MeasurementForm";

const measurementTabs = [
  { key: "body", icon: Scale, en: "Body", el: "Σώμα" },
  { key: "food", icon: Apple, en: "Food", el: "Φαγητό" },
  { key: "photos", icon: Camera, en: "Photos", el: "Φωτογραφίες" },
  { key: "journal", icon: Heart, en: "Journal", el: "Ημερολόγιο" },
] as const;

type MeasurementTabKey = typeof measurementTabs[number]["key"];

interface ProfileData {
  email: string | null;
  display_name: string | null;
  height_cm: number | null;
  sex: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
}
const POLICY_CONTENT_EL = `Πολιτικές & Διαδικασίες — Alexandros The Greek Carnivore

Έγγραφο Πολιτικής και Διαδικασιών για την Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης "The Greek Carnivore"

1. Εισαγωγή
Καλώς ήρθατε στην Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης. Το παρόν έγγραφο καθορίζει τις κατευθυντήριες γραμμές και τους όρους χρήσης.

2. Χωρίς Ιατρικές Συμβουλές
Δεν παρέχουμε ιατρικές συμβουλές. Το περιεχόμενο είναι μόνο για ενημερωτικούς σκοπούς.

3. Συμβουλή με τον Ιατρό σας
Συνιστούμε να συμβουλευτείτε τον ιατρό σας πριν ξεκινήσετε.

4. Χωρίς Επιστροφές
Δεν παρέχουμε επιστροφές για ψηφιακά προϊόντα.

5. Αποτελέσματα
Τα ατομικά αποτελέσματα ενδέχεται να διαφέρουν.

6. Ευθύνη Χρήστη
Ακριβείς πληροφορίες, συμμόρφωση, προσωπική ασφάλεια, σεβαστή συμπεριφορά.

7. Ηλικιακοί Περιορισμοί — 18+

8. Πνευματική Ιδιοκτησία — Προστατεύεται.

9. Προστασία Δεδομένων — Δεν μοιραζόμαστε προσωπικά δεδομένα.

10. Τροποποίηση Πολιτικών — Διατηρούμε το δικαίωμα τροποποίησης.

11. Φωτογραφίες Προόδου — Υποχρεωτική εβδομαδιαία ανάρτηση.`;

const POLICY_CONTENT_EN = `Policies & Procedures — Alexandros The Greek Carnivore

Policy and Procedures Document for the Online Nutrition and Exercise Service "The Greek Carnivore"

1. Introduction
Welcome to the Online Nutrition and Exercise Service. This document sets out guidelines and terms of use.

2. No Medical Advice
We do not provide medical advice. Content is for informational purposes only.

3. Consult Your Physician
We recommend consulting your physician before starting.

4. No Refunds
No refunds for digital products.

5. Results
Individual results may vary.

6. User Responsibility
Accurate information, compliance, personal safety, respectful behavior.

7. Age Restrictions — 18+

8. Intellectual Property — Protected.

9. Privacy — We do not share personal data.

10. Policy Modifications — We reserve the right to modify.

11. Progress Photos — Mandatory weekly uploads.`;

const AdminClientView = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDataOnly = searchParams.get("view") === "data";
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MeasurementTabKey>("body");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProfileData>>({});
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editEnrollmentOpen, setEditEnrollmentOpen] = useState(false);
  const [measurementFormOpen, setMeasurementFormOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    setResettingPassword(true);
    try {
      const res = await supabase.functions.invoke("admin-reset-password", {
        body: { email: profile.email },
      });
      if (res.error) throw res.error;
      if (res.data?.error) throw new Error(res.data.error);
      toast.success(lang === "el" ? `Το email επαναφοράς κωδικού στάλθηκε στο ${profile.email}` : `Password reset email sent to ${profile.email}`);
    } catch (err) {
      toast.error(lang === "el" ? "Αποτυχία αποστολής email επαναφοράς" : "Failed to send password reset email");
    }
    setResettingPassword(false);
  };

  const handleCopyEmail = () => {
    if (!profile?.email) return;
    navigator.clipboard.writeText(profile.email);
    toast.success(lang === "el" ? "Το email αντιγράφηκε" : "Email copied to clipboard");
  };
  const { data: profile } = useQuery({
    queryKey: ["admin-client-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("email, display_name, height_cm, sex, date_of_birth, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      return data as ProfileData | null;
    },
    enabled: !!userId,
  });

  const { data: enrollment, refetch: refetchEnrollment } = useQuery({
    queryKey: ["enrollment", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("client_program_enrollments")
        .select("id, start_date, status, program_template_id, weekly_day, duration_weeks_override")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (!data) return null;
      const { data: template } = await supabase
        .from("program_templates")
        .select("name, duration_weeks")
        .eq("id", (data as any).program_template_id)
        .maybeSingle();
      return { ...(data as any), template: template as any };
    },
    enabled: !!userId,
  });

  // Fetch client_programs for payment info
  const { data: clientPrograms } = useQuery({
    queryKey: ["client-programs", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("client_programs")
        .select("id, program_name, payment_status, amount_paid, start_date, end_date, installments_paid, installments_total, payment_method, program_template_id")
        .or(`user_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!userId,
  });
  const { data: signedForms } = useQuery({
    queryKey: ["admin-client-signatures", userId],
    queryFn: async () => {
      if (!userId) return [];
      const results: any[] = [];

      // 1. Policy signatures (mandatory before app access)
      const { data: policySigs } = await supabase
        .from("policy_signatures")
        .select("id, full_name, signature_url, signed_at, policy_version")
        .eq("user_id", userId)
        .order("signed_at", { ascending: false });
      if (policySigs) {
        policySigs.forEach((ps: any) => {
          results.push({
            ...ps,
            type: "policy",
            form: { title: "Πολιτικές & Διαδικασίες", content: null },
          });
        });
      }

      // 2. Program form signatures
      const { data } = await supabase
        .from("client_form_signatures")
        .select("id, full_name, signature_url, signed_at, form_id, enrollment_id")
        .eq("user_id", userId)
        .order("signed_at", { ascending: false });
      if (data && data.length > 0) {
        const formIds = [...new Set(data.map((s: any) => s.form_id))];
        const { data: forms } = await supabase
          .from("program_forms")
          .select("id, title, content")
          .in("id", formIds);
        const formMap = new Map((forms || []).map((f: any) => [f.id, f]));
        data.forEach((s: any) => {
          results.push({ ...s, type: "form", form: formMap.get(s.form_id) || null });
        });
      }

      // Generate signed URLs for all signatures (bucket is private)
      const withSignedUrls = await Promise.all(
        results.map(async (item: any) => {
          if (!item.signature_url) return item;
          const match = item.signature_url.match(/\/signatures\/(.+)$/);
          const storagePath = match
            ? decodeURIComponent(match[1])
            : item.signature_url;
          const { data: signedUrlData } = await supabase.storage
            .from("signatures")
            .createSignedUrl(storagePath, 3600);
          return { ...item, signature_url: signedUrlData?.signedUrl || item.signature_url };
        })
      );
      return withSignedUrls;
    },
    enabled: !!userId,
  });

  const [viewingForm, setViewingForm] = useState<any>(null);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<ProfileData>) => {
      if (!userId) throw new Error("No user");
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: updates.display_name ?? null,
          height_cm: updates.height_cm ?? null,
          sex: updates.sex ?? null,
          date_of_birth: updates.date_of_birth ?? null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-client-profile", userId] });
      toast.success(lang === "el" ? "Το προφίλ ενημερώθηκε" : "Profile updated");
      setEditing(false);
    },
    onError: () => {
      toast.error(lang === "el" ? "Σφάλμα ενημέρωσης" : "Failed to update profile");
    },
  });

  const startEditing = () => {
    setEditForm({
      display_name: profile?.display_name ?? "",
      height_cm: profile?.height_cm ?? null,
      sex: profile?.sex ?? "",
      date_of_birth: profile?.date_of_birth ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

  return (
    <div className="px-4 pt-6 pb-24">
      <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 text-sm font-sans text-muted-foreground hover:text-foreground transition-colors mb-2">
        <ArrowLeft className="h-4 w-4" />
        {lang === "en" ? "Back to Admin" : "Πίσω στο Admin"}
      </button>

      <h1 className="font-serif text-3xl font-semibold text-foreground mb-4">
        {!profile ? (
          <span className="inline-block h-8 w-48 animate-pulse rounded bg-muted" />
        ) : (
          <>
            {profile.display_name && profile.email
              ? `${profile.display_name} (${profile.email})`
              : profile.display_name || profile.email || (lang === "en" ? "Client" : "Πελάτης")}
            {isDataOnly && ` — ${lang === "en" ? "Data" : "Δεδομένα"}`}
          </>
        )}
      </h1>

      {/* Sticky anchor nav */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border/40 mb-4 flex gap-2 overflow-x-auto">
        {[
          { id: "section-profile", en: "Profile", el: "Προφίλ" },
          { id: "section-program", en: "Program", el: "Πρόγραμμα" },
          { id: "section-forms", en: "Forms", el: "Φόρμες" },
          { id: "section-measurements", en: "Measurements", el: "Μετρήσεις" },
        ].map(({ id, en, el: elLabel }) => (
          <button
            key={id}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="shrink-0 rounded-full bg-muted px-3.5 py-1.5 font-sans text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            {lang === "en" ? en : elLabel}
          </button>
        ))}
      </div>

      {/* Profile info card */}
      {!isDataOnly && profile && (
        <div id="section-profile" className="rounded-xl border border-border bg-card p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="font-sans text-sm font-semibold text-foreground">
                {lang === "el" ? "Πληροφορίες Πελάτη" : "Client Info"}
              </span>
            </div>
            {!editing ? (
              <Button variant="ghost" size="sm" onClick={startEditing} className="gap-1.5 text-xs">
                <Pencil className="h-3 w-3" />
                {lang === "el" ? "Επεξεργασία" : "Edit"}
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="gap-1 text-xs text-muted-foreground">
                  <X className="h-3 w-3" />
                  {lang === "el" ? "Ακύρωση" : "Cancel"}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="gap-1 text-xs">
                  <Check className="h-3 w-3" />
                  {lang === "el" ? "Αποθήκευση" : "Save"}
                </Button>
              </div>
            )}
          </div>

          {!editing ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">{lang === "el" ? "Ονομα" : "Name"}</p>
                <p className="text-sm font-sans text-foreground">{profile.display_name || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-sm font-sans text-foreground truncate">{profile.email || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">{lang === "el" ? "Υψος" : "Height"}</p>
                <p className="text-sm font-sans text-foreground">{profile.height_cm ? `${profile.height_cm} cm` : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">{lang === "el" ? "Φύλο" : "Sex"}</p>
                <p className="text-sm font-sans text-foreground">
                  {profile.sex === "male" ? (lang === "el" ? "Ανδρας" : "Male") 
                    : profile.sex === "female" ? (lang === "el" ? "Γυναίκα" : "Female") 
                    : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">{lang === "el" ? "Ημ. Γεννησης" : "Date of Birth"}</p>
                <p className="text-sm font-sans text-foreground">
                  {profile.date_of_birth ? format(new Date(profile.date_of_birth), "dd MMM yyyy") : "—"}
                </p>
              </div>
              <div className="col-span-2 flex flex-wrap gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={handleCopyEmail} disabled={!profile.email} className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3" />
                  {lang === "el" ? "Αντιγραφή Email" : "Copy Email"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetPassword} disabled={!profile.email || resettingPassword} className="gap-1.5 text-xs">
                  <KeyRound className="h-3 w-3" />
                  {resettingPassword
                    ? (lang === "el" ? "Αποστολή..." : "Sending...")
                    : (lang === "el" ? "Αποστολή Επαναφοράς Κωδικού" : "Send Password Reset")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">{lang === "el" ? "Ονομα" : "Name"}</Label>
                <Input
                  value={editForm.display_name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder={lang === "el" ? "Ονομα πελάτη" : "Client name"}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">Email</Label>
                <Input value={profile.email ?? ""} disabled className="h-9 text-sm opacity-60" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">{lang === "el" ? "Υψος (cm)" : "Height (cm)"}</Label>
                <Input
                  type="number"
                  value={editForm.height_cm ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, height_cm: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="175"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">{lang === "el" ? "Φύλο" : "Sex"}</Label>
                <Select value={editForm.sex ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, sex: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{lang === "el" ? "Ανδρας" : "Male"}</SelectItem>
                    <SelectItem value="female">{lang === "el" ? "Γυναίκα" : "Female"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">{lang === "el" ? "Ημ. Γεννησης" : "Date of Birth"}</Label>
                <Input
                  type="date"
                  value={editForm.date_of_birth ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, date_of_birth: e.target.value || null }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Program section */}
      {!isDataOnly && <div id="section-program" className="rounded-xl border border-border bg-card p-4 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-sans text-sm font-semibold text-foreground">
              {lang === "el" ? "Πρόγραμμα" : "Program"}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setProgramDialogOpen(true)} className="text-xs gap-1">
              <CalendarDays className="h-3 w-3" />
              {lang === "el" ? "Πληρωμές" : "Payments"}
            </Button>
            {enrollment ? (
              <Button variant="outline" size="sm" onClick={() => setEditEnrollmentOpen(true)} className="text-xs gap-1">
                <Pencil className="h-3 w-3" />
                {lang === "el" ? "Επεξεργασία" : "Edit Enrollment"}
              </Button>
            ) : (
              <p className="text-[10px] font-sans text-muted-foreground italic">
                {lang === "el" ? "Εγγραφή μέσω Programs tab" : "Enroll via Programs tab"}
              </p>
            )}
          </div>
        </div>

        {enrollment?.template ? (() => {
          const start = new Date(enrollment.start_date);
          const totalDays = enrollment.template.duration_weeks * 7;
          const endDate = new Date(start);
          endDate.setDate(endDate.getDate() + totalDays);
          const elapsed = Math.max(0, differenceInDays(new Date(), start));
          const remaining = Math.max(0, totalDays - elapsed);
          const pct = Math.min(100, (elapsed / totalDays) * 100);
          return (
            <div className="space-y-2.5">
              <p className="font-sans text-sm font-medium text-foreground">{enrollment.template.name}</p>
              <div className="flex items-center gap-4 text-xs font-sans text-muted-foreground">
                <span>{lang === "en" ? "Start" : "Έναρξη"}: {format(start, "dd MMM yyyy")}</span>
                <span>{lang === "en" ? "End" : "Λήξη"}: {format(endDate, "dd MMM yyyy")}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-sans font-medium text-foreground whitespace-nowrap">
                  {elapsed}/{totalDays} {lang === "en" ? "days" : "ημέρες"}
                </span>
              </div>
              <p className="text-[11px] font-sans text-muted-foreground">
                {remaining > 0
                  ? `${remaining} ${lang === "en" ? "days remaining" : "ημέρες απομένουν"}`
                  : (lang === "en" ? "Program completed" : "Το πρόγραμμα ολοκληρώθηκε")}
              </p>
            </div>
          );
        })() : (
          <p className="text-xs font-sans text-muted-foreground py-2">
            {lang === "el" ? "Δεν υπάρχει ενεργό πρόγραμμα" : "No active program enrollment"}
          </p>
        )}

        {/* Payment records */}
        {clientPrograms && clientPrograms.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider font-semibold">
                {lang === "el" ? "Πληρωμές" : "Payments"}
              </span>
            </div>
            {clientPrograms.map((cp: any) => {
              const statusColors: Record<string, string> = {
                paid: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
                partial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
                pending: "bg-muted text-muted-foreground border-border",
                offer_sent: "bg-amber-500/15 text-amber-600 border-amber-500/30",
                canceled: "bg-destructive/15 text-destructive border-destructive/30",
              };
              const statusLabels: Record<string, { el: string; en: string }> = {
                paid: { el: "Πληρωμένο", en: "Paid" },
                partial: { el: "Μερική πληρωμή", en: "Partial" },
                pending: { el: "Εκκρεμεί", en: "Pending" },
                offer_sent: { el: "⏳ Αναμονή Πληρωμής", en: "⏳ Awaiting Payment" },
                canceled: { el: "Ακυρωμένο", en: "Canceled" },
              };
              const statusLabel = statusLabels[cp.payment_status] || { el: cp.payment_status, en: cp.payment_status };
              return (
                <div key={cp.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-2.5">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-xs font-medium text-foreground truncate">{cp.program_name || "—"}</p>
                    <p className="font-sans text-[10px] text-muted-foreground">
                      {cp.start_date ? format(new Date(cp.start_date), "dd MMM yyyy") : "—"}
                      {cp.amount_paid > 0 && ` · €${cp.amount_paid}`}
                      {cp.installments_total > 1 && ` · ${cp.installments_paid}/${cp.installments_total} ${lang === "el" ? "δόσεις" : "installments"}`}
                    </p>
                  </div>
                  <span className={cn("text-[10px] font-sans font-medium px-2 py-0.5 rounded-full border", statusColors[cp.payment_status] || "bg-muted text-muted-foreground border-border")}>
                    {lang === "el" ? statusLabel.el : statusLabel.en}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* Signed Forms section */}
      {!isDataOnly && signedForms && signedForms.length > 0 && (
        <div id="section-forms" className="rounded-xl border border-border bg-card p-4 mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            <span className="font-sans text-sm font-semibold text-foreground">
              {lang === "el" ? "Υπογεγραμμένα Έντυπα" : "Signed Forms"}
            </span>
            <span className="ml-auto text-[10px] font-sans text-muted-foreground">{signedForms.length}</span>
          </div>
          <div className="space-y-2">
            {signedForms.map((sig: any) => (
              <div key={sig.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground truncate">
                    {sig.form?.title || (lang === "el" ? "Έντυπο" : "Form")}
                  </p>
                  <p className="font-sans text-[10px] text-muted-foreground">
                    {lang === "el" ? "Υπογραφή" : "Signed by"}: {sig.full_name} · {format(new Date(sig.signed_at), "dd MMM yyyy, HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {sig.signature_url && (
                    <a href={sig.signature_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title={lang === "el" ? "Προβολή υπογραφής" : "View signature"}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {(sig.form?.content || sig.type === "policy") && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setViewingForm(sig)}>
                      <FileSignature className="h-3 w-3" />
                      {lang === "el" ? "Προβολή" : "View"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View signed form dialog */}
      <Dialog open={!!viewingForm} onOpenChange={(o) => { if (!o) setViewingForm(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">
              {viewingForm?.form?.title || (lang === "el" ? "Έντυπο" : "Form")}
            </DialogTitle>
          </DialogHeader>
          {viewingForm && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none font-sans text-foreground whitespace-pre-wrap text-xs leading-relaxed">
                {viewingForm.type === "policy"
                  ? (lang === "el" ? POLICY_CONTENT_EL : POLICY_CONTENT_EN)
                  : viewingForm.form?.content}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">
                  {lang === "el" ? "Στοιχεία Υπογραφής" : "Signature Details"}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-sans">
                  <div>
                    <p className="text-muted-foreground">{lang === "el" ? "Ονοματεπώνυμο" : "Full Name"}</p>
                    <p className="text-foreground font-medium">{viewingForm.full_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{lang === "el" ? "Ημερομηνία" : "Date"}</p>
                    <p className="text-foreground font-medium">{format(new Date(viewingForm.signed_at), "dd MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
                {viewingForm.signature_url && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">{lang === "el" ? "Υπογραφή" : "Signature"}</p>
                    <img src={viewingForm.signature_url} alt="Signature" className="h-16 rounded-md border border-border bg-background p-1" />
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Measurement tabs */}
      <div id="section-measurements" className="flex gap-1 rounded-lg border border-border bg-card p-1 mb-6">
        {measurementTabs.map(({ key, icon: Icon, en, el }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 font-sans text-sm font-medium transition-all",
              activeTab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{lang === "en" ? en : el}</span>
          </button>
        ))}
      </div>

      {/* New Measurement button */}
      <Button onClick={() => setMeasurementFormOpen(true)} className="w-full gap-2 mb-6">
        <Plus className="h-5 w-5" />
        {lang === "en" ? "New Measurement" : "Νέα Μέτρηση"}
      </Button>

      {activeTab === "body" && <BodyDashboard userId={userId} />}
      {activeTab === "food" && <FoodDashboard userId={userId} />}
      {activeTab === "photos" && <PhotosDashboard userId={userId} />}
      {activeTab === "journal" && userId && <JournalTab userId={userId} lang={lang} />}

      {userId && (
        <MeasurementForm
          open={measurementFormOpen}
          onOpenChange={setMeasurementFormOpen}
          editEntry={null}
          userId={userId}
        />
      )}

      {/* Dialogs */}
      {userId && profile && (
        <ClientProgramDialog
          open={programDialogOpen}
          onOpenChange={setProgramDialogOpen}
          userId={userId}
          userEmail={profile.email || ""}
        />
      )}

      {userId && enrollment && (
        <EditEnrollmentDialog
          open={editEnrollmentOpen}
          onOpenChange={(open) => {
            setEditEnrollmentOpen(open);
            if (!open) refetchEnrollment();
          }}
          userId={userId}
          userEmail={profile?.email || ""}
          onSaved={() => { setEditEnrollmentOpen(false); refetchEnrollment(); }}
        />
      )}
    </div>
  );
};

// Inline Journal tab component
const JournalTab = ({ userId, lang }: { userId: string; lang: string }) => {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["admin-wellness-journal", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("wellness_journal")
        .select("id, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm font-sans text-muted-foreground text-center py-8">
        {lang === "el" ? "Δεν υπάρχουν καταχωρήσεις ημερολογίου" : "No journal entries yet"}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry: any) => (
        <div key={entry.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
          <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">
            {format(new Date(entry.created_at), "dd MMM yyyy, HH:mm")}
          </p>
          <p className="text-sm font-sans text-foreground whitespace-pre-wrap">{entry.content}</p>
        </div>
      ))}
    </div>
  );
};

export default AdminClientView;
