import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type IntakeRow = {
  user_id: string;
  completed_at: string | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: string | null;
  primary_goal: string | null;
  primary_goal_detail: string | null;
  biggest_struggle: string | null;
  past_diet_attempts: string | null;
  favorite_meats: string[];
  disliked_foods: string[];
  eats_eggs: boolean | null;
  eats_dairy: boolean | null;
  eats_organs: boolean | null;
  cooking_skill: string | null;
  allergies: string[];
  medical_conditions: string | null;
  medications: string | null;
  pregnant_or_breastfeeding: boolean;
  typical_schedule: string | null;
  social_eating_situations: string | null;
  alcohol_frequency: string | null;
  sleep_hours: number | null;
  stress_level: number | null;
  why_now: string | null;
  biggest_fear: string | null;
  raw_payload: Record<string, unknown>;
};

const emptyIntake = (userId: string): IntakeRow => ({
  user_id: userId,
  completed_at: null,
  weight_kg: null,
  target_weight_kg: null,
  activity_level: null,
  primary_goal: null,
  primary_goal_detail: null,
  biggest_struggle: null,
  past_diet_attempts: null,
  favorite_meats: [],
  disliked_foods: [],
  eats_eggs: null,
  eats_dairy: null,
  eats_organs: null,
  cooking_skill: null,
  allergies: [],
  medical_conditions: null,
  medications: null,
  pregnant_or_breastfeeding: false,
  typical_schedule: null,
  social_eating_situations: null,
  alcohol_frequency: null,
  sleep_hours: null,
  stress_level: null,
  why_now: null,
  biggest_fear: null,
  raw_payload: {},
});

const TOTAL_STEPS = 5;

const Intake = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [intake, setIntake] = useState<IntakeRow | null>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  const load = async () => {
    const { data } = await supabase
      .from("member_intakes" as any)
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setIntake(data as IntakeRow);
      if (data.completed_at) {
        navigate("/home", { replace: true });
      }
    } else {
      setIntake(emptyIntake(user!.id));
    }
  };

  const update = (patch: Partial<IntakeRow>) => {
    setIntake((current) => (current ? { ...current, ...patch } : current));
  };

  const persist = async (markComplete = false) => {
    if (!intake) return false;
    setSaving(true);
    const payload = { ...intake, updated_at: new Date().toISOString() };
    if (markComplete) payload.completed_at = new Date().toISOString();
    const { error } = await supabase
      .from("member_intakes" as any)
      .upsert(payload as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({
        title: lang === "el" ? "Σφάλμα" : "Error",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const next = async () => {
    const ok = await persist(false);
    if (ok) setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    setSubmitting(true);
    const ok = await persist(true);
    setSubmitting(false);
    if (ok) {
      toast({
        title: lang === "el" ? "Έτοιμο!" : "Ready!",
        description: lang === "el"
          ? "Ξεκινάμε τη Μεταμόρφωσή σου."
          : "Your Metamorphosis begins now.",
      });
      navigate("/home", { replace: true });
    }
  };

  const stepValid = useMemo(() => {
    if (!intake) return false;
    switch (step) {
      case 1:
        return !!(intake.weight_kg && intake.target_weight_kg && intake.activity_level);
      case 2:
        return !!(intake.primary_goal && (intake.biggest_struggle?.length ?? 0) >= 30);
      case 3:
        return !!intake.cooking_skill && intake.eats_eggs !== null && intake.eats_dairy !== null;
      case 4:
        return true;
      case 5:
        return (intake.why_now?.length ?? 0) >= 30 && (intake.biggest_fear?.length ?? 0) >= 10;
      default:
        return false;
    }
  }, [intake, step]);

  if (!intake) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
            <Sparkles className="h-3 w-3" />
            {lang === "el" ? "Φόρμα έναρξης" : "Intake form"}
          </div>
          <h1 className="font-serif text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            {lang === "el" ? "Ας γνωριστούμε καλύτερα" : "Let's get to know you"}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {lang === "el"
              ? "Όσο πιο αναλυτικός είσαι, τόσο πιο εξατομικευμένη η καθοδήγηση. Όλα μένουν ιδιωτικά και χρησιμοποιούνται μόνο για να σε βοηθήσουν."
              : "The more detail you give, the more personal your guidance. Everything stays private and is used only to help you."}
          </p>
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-gold" : "bg-border"}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {lang === "el" ? `Βήμα ${step} από ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
            {saving && <span className="ml-2 text-gold">{lang === "el" ? "Αποθήκευση..." : "Saving..."}</span>}
          </p>
        </div>

        <div className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          {step === 1 && <Step1Body intake={intake} update={update} lang={lang} />}
          {step === 2 && <Step2Goals intake={intake} update={update} lang={lang} />}
          {step === 3 && <Step3Food intake={intake} update={update} lang={lang} />}
          {step === 4 && <Step4Lifestyle intake={intake} update={update} lang={lang} />}
          {step === 5 && <Step5Commitment intake={intake} update={update} lang={lang} />}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 1}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            {lang === "el" ? "Πίσω" : "Back"}
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={next}
              disabled={!stepValid || saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-gold px-5 py-3 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {lang === "el" ? "Συνέχεια" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!stepValid || submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-gold px-5 py-3 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting
                ? (lang === "el" ? "Ολοκλήρωση..." : "Finishing...")
                : (lang === "el" ? "Ολοκλήρωση" : "Finish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="text-xs font-semibold">{label}</Label>
    {children}
    {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
  </div>
);

const TagInput = ({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) => {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setInput("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-11 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:border-gold/40 hover:text-foreground"
        >
          +
        </button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:border-destructive hover:text-destructive"
            >
              {v} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

type StepProps = {
  intake: IntakeRow;
  update: (patch: Partial<IntakeRow>) => void;
  lang: "el" | "en";
};

const Step1Body = ({ intake, update, lang }: StepProps) => (
  <div className="space-y-5">
    <h2 className="font-serif text-lg font-semibold text-foreground">
      {lang === "el" ? "Σώμα & δραστηριότητα" : "Body & activity"}
    </h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={lang === "el" ? "Τρέχον βάρος (kg)" : "Current weight (kg)"}>
        <Input
          type="number"
          value={intake.weight_kg ?? ""}
          onChange={(e) => update({ weight_kg: e.target.value ? Number(e.target.value) : null })}
          className="h-11"
        />
      </Field>
      <Field label={lang === "el" ? "Στόχος βάρους (kg)" : "Target weight (kg)"}>
        <Input
          type="number"
          value={intake.target_weight_kg ?? ""}
          onChange={(e) => update({ target_weight_kg: e.target.value ? Number(e.target.value) : null })}
          className="h-11"
        />
      </Field>
    </div>
    <Field label={lang === "el" ? "Επίπεδο δραστηριότητας" : "Activity level"}>
      <Select value={intake.activity_level ?? undefined} onValueChange={(v) => update({ activity_level: v })}>
        <SelectTrigger className="h-11"><SelectValue placeholder={lang === "el" ? "Διάλεξε..." : "Choose..."} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sedentary">{lang === "el" ? "Καθιστική ζωή" : "Sedentary"}</SelectItem>
          <SelectItem value="light">{lang === "el" ? "Ελαφριά (1-2/εβδ.)" : "Light (1-2/wk)"}</SelectItem>
          <SelectItem value="moderate">{lang === "el" ? "Μέτρια (3-4/εβδ.)" : "Moderate (3-4/wk)"}</SelectItem>
          <SelectItem value="very_active">{lang === "el" ? "Πολύ ενεργή (5+/εβδ.)" : "Very active (5+/wk)"}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  </div>
);

const Step2Goals = ({ intake, update, lang }: StepProps) => (
  <div className="space-y-5">
    <h2 className="font-serif text-lg font-semibold text-foreground">
      {lang === "el" ? "Στόχοι & δυσκολίες" : "Goals & struggles"}
    </h2>
    <Field label={lang === "el" ? "Κύριος στόχος" : "Primary goal"}>
      <Select value={intake.primary_goal ?? undefined} onValueChange={(v) => update({ primary_goal: v })}>
        <SelectTrigger className="h-11"><SelectValue placeholder={lang === "el" ? "Διάλεξε..." : "Choose..."} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="weight_loss">{lang === "el" ? "Απώλεια βάρους" : "Weight loss"}</SelectItem>
          <SelectItem value="health">{lang === "el" ? "Υγεία γενικά" : "Health"}</SelectItem>
          <SelectItem value="energy">{lang === "el" ? "Ενέργεια" : "Energy"}</SelectItem>
          <SelectItem value="mental_clarity">{lang === "el" ? "Διαύγεια / διάθεση" : "Mental clarity"}</SelectItem>
          <SelectItem value="other">{lang === "el" ? "Άλλο" : "Other"}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field
      label={lang === "el" ? "Πες μας περισσότερα για τον στόχο σου" : "Tell us more about your goal"}
      hint={lang === "el" ? "Π.χ. «Θέλω να χάσω 15kg μέχρι τον Σεπτέμβριο για τον γάμο της αδερφής μου.»" : "E.g. \"Lose 15kg by September for my sister's wedding.\""}
    >
      <Textarea
        rows={3}
        value={intake.primary_goal_detail ?? ""}
        onChange={(e) => update({ primary_goal_detail: e.target.value })}
      />
    </Field>
    <Field
      label={lang === "el" ? "Ποια είναι η μεγαλύτερη δυσκολία σου τώρα; (≥30 χαρ.)" : "Biggest struggle right now? (≥30 chars)"}
      hint={lang === "el" ? "Όσο πιο ειλικρινής, τόσο πιο στοχευμένη η βοήθεια." : "Honesty here gives you more targeted help."}
    >
      <Textarea
        rows={4}
        value={intake.biggest_struggle ?? ""}
        onChange={(e) => update({ biggest_struggle: e.target.value })}
      />
    </Field>
    <Field
      label={lang === "el" ? "Τι έχεις δοκιμάσει στο παρελθόν και γιατί δεν δούλεψε;" : "What have you tried before and why didn't it work?"}
    >
      <Textarea
        rows={3}
        value={intake.past_diet_attempts ?? ""}
        onChange={(e) => update({ past_diet_attempts: e.target.value })}
      />
    </Field>
  </div>
);

const Step3Food = ({ intake, update, lang }: StepProps) => (
  <div className="space-y-5">
    <h2 className="font-serif text-lg font-semibold text-foreground">
      {lang === "el" ? "Διατροφικές προτιμήσεις" : "Food preferences"}
    </h2>
    <Field
      label={lang === "el" ? "Αγαπημένα κρέατα" : "Favorite meats"}
      hint={lang === "el" ? "π.χ. βοδινό, αρνί, κοτόπουλο" : "e.g. beef, lamb, chicken"}
    >
      <TagInput
        values={intake.favorite_meats}
        onChange={(v) => update({ favorite_meats: v })}
        placeholder={lang === "el" ? "Πρόσθεσε και πάτα Enter" : "Type and press Enter"}
      />
    </Field>
    <Field
      label={lang === "el" ? "Τρόφιμα που δεν αντέχεις" : "Foods you dislike"}
    >
      <TagInput
        values={intake.disliked_foods}
        onChange={(v) => update({ disliked_foods: v })}
        placeholder={lang === "el" ? "π.χ. συκώτι" : "e.g. liver"}
      />
    </Field>
    <div className="grid gap-3 sm:grid-cols-3">
      <ToggleField label={lang === "el" ? "Τρως αυγά;" : "Eat eggs?"} value={intake.eats_eggs} onChange={(v) => update({ eats_eggs: v })} lang={lang} />
      <ToggleField label={lang === "el" ? "Τρως γαλακτοκομικά;" : "Eat dairy?"} value={intake.eats_dairy} onChange={(v) => update({ eats_dairy: v })} lang={lang} />
      <ToggleField label={lang === "el" ? "Τρως εντόσθια;" : "Eat organs?"} value={intake.eats_organs} onChange={(v) => update({ eats_organs: v })} lang={lang} />
    </div>
    <Field label={lang === "el" ? "Επίπεδο μαγειρικής" : "Cooking skill"}>
      <Select value={intake.cooking_skill ?? undefined} onValueChange={(v) => update({ cooking_skill: v })}>
        <SelectTrigger className="h-11"><SelectValue placeholder={lang === "el" ? "Διάλεξε..." : "Choose..."} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{lang === "el" ? "Καθόλου" : "None"}</SelectItem>
          <SelectItem value="basic">{lang === "el" ? "Βασικό" : "Basic"}</SelectItem>
          <SelectItem value="intermediate">{lang === "el" ? "Μέτριο" : "Intermediate"}</SelectItem>
          <SelectItem value="advanced">{lang === "el" ? "Προχωρημένο" : "Advanced"}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
    <Field
      label={lang === "el" ? "Αλλεργίες / δυσανεξίες" : "Allergies / intolerances"}
      hint={lang === "el" ? "Πρόσθεσε ξεχωριστά. Π.χ. αυγά, ξηροί καρποί." : "Add separately. E.g. eggs, nuts."}
    >
      <TagInput
        values={intake.allergies}
        onChange={(v) => update({ allergies: v })}
        placeholder={lang === "el" ? "Πρόσθεσε αλλεργία..." : "Add an allergy..."}
      />
    </Field>
  </div>
);

const ToggleField = ({
  label,
  value,
  onChange,
  lang,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  lang: "el" | "en";
}) => (
  <div className="space-y-2">
    <Label className="text-xs font-semibold">{label}</Label>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 rounded-xl border px-3 py-2 text-xs ${value === true ? "border-gold bg-gold/10 text-foreground" : "border-border bg-card text-muted-foreground"}`}
      >
        {lang === "el" ? "Ναι" : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 rounded-xl border px-3 py-2 text-xs ${value === false ? "border-gold bg-gold/10 text-foreground" : "border-border bg-card text-muted-foreground"}`}
      >
        {lang === "el" ? "Όχι" : "No"}
      </button>
    </div>
  </div>
);

const Step4Lifestyle = ({ intake, update, lang }: StepProps) => (
  <div className="space-y-5">
    <h2 className="font-serif text-lg font-semibold text-foreground">
      {lang === "el" ? "Τρόπος ζωής & ιατρικό" : "Lifestyle & medical"}
    </h2>
    <Field
      label={lang === "el" ? "Τυπική μέρα/πρόγραμμα" : "Typical day/schedule"}
      hint={lang === "el" ? "Π.χ. «δουλειά 9-5, γυμναστήριο 3 φορές, παιδιά 7μμ.»" : "E.g. work 9-5, gym 3x/wk, kids 7pm."}
    >
      <Textarea
        rows={3}
        value={intake.typical_schedule ?? ""}
        onChange={(e) => update({ typical_schedule: e.target.value })}
      />
    </Field>
    <Field
      label={lang === "el" ? "Κοινωνικά γεύματα" : "Social eating situations"}
      hint={lang === "el" ? "Γάμοι, business lunches, οικογενειακά τραπέζια." : "Weddings, business lunches, family dinners."}
    >
      <Textarea
        rows={2}
        value={intake.social_eating_situations ?? ""}
        onChange={(e) => update({ social_eating_situations: e.target.value })}
      />
    </Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={lang === "el" ? "Αλκοόλ" : "Alcohol"}>
        <Select value={intake.alcohol_frequency ?? undefined} onValueChange={(v) => update({ alcohol_frequency: v })}>
          <SelectTrigger className="h-11"><SelectValue placeholder={lang === "el" ? "Διάλεξε..." : "Choose..."} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="never">{lang === "el" ? "Ποτέ" : "Never"}</SelectItem>
            <SelectItem value="rarely">{lang === "el" ? "Σπάνια" : "Rarely"}</SelectItem>
            <SelectItem value="weekly">{lang === "el" ? "Εβδομαδιαία" : "Weekly"}</SelectItem>
            <SelectItem value="daily">{lang === "el" ? "Καθημερινά" : "Daily"}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label={lang === "el" ? "Ώρες ύπνου" : "Sleep hours"}>
        <Input
          type="number"
          step="0.5"
          value={intake.sleep_hours ?? ""}
          onChange={(e) => update({ sleep_hours: e.target.value ? Number(e.target.value) : null })}
          className="h-11"
        />
      </Field>
    </div>
    <Field label={lang === "el" ? "Επίπεδο στρες (1-10)" : "Stress level (1-10)"}>
      <Input
        type="number"
        min={1}
        max={10}
        value={intake.stress_level ?? ""}
        onChange={(e) => update({ stress_level: e.target.value ? Number(e.target.value) : null })}
        className="h-11"
      />
    </Field>
    <Field
      label={lang === "el" ? "Ιατρικές καταστάσεις (αν υπάρχουν)" : "Medical conditions (if any)"}
      hint={lang === "el" ? "Πληροφοριακό μόνο. Δεν υποκαθιστά γιατρό." : "Informational only. Not a substitute for a doctor."}
    >
      <Textarea
        rows={2}
        value={intake.medical_conditions ?? ""}
        onChange={(e) => update({ medical_conditions: e.target.value })}
      />
    </Field>
    <Field label={lang === "el" ? "Φάρμακα" : "Medications"}>
      <Textarea
        rows={2}
        value={intake.medications ?? ""}
        onChange={(e) => update({ medications: e.target.value })}
      />
    </Field>
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <Checkbox
        checked={intake.pregnant_or_breastfeeding}
        onCheckedChange={(v) => update({ pregnant_or_breastfeeding: !!v })}
      />
      {lang === "el" ? "Είμαι έγκυος ή θηλάζω" : "I am pregnant or breastfeeding"}
    </label>
  </div>
);

const Step5Commitment = ({ intake, update, lang }: StepProps) => (
  <div className="space-y-5">
    <h2 className="font-serif text-lg font-semibold text-foreground">
      {lang === "el" ? "Δέσμευση" : "Commitment"}
    </h2>
    <Field
      label={lang === "el" ? "Γιατί τώρα; (≥30 χαρ.)" : "Why now? (≥30 chars)"}
      hint={lang === "el" ? "Το συναισθηματικό \"γιατί\" σου. Αυτό θα κρατάει όταν δυσκολευτείς." : "Your emotional why. This is what holds you when it gets hard."}
    >
      <Textarea
        rows={4}
        value={intake.why_now ?? ""}
        onChange={(e) => update({ why_now: e.target.value })}
      />
    </Field>
    <Field
      label={lang === "el" ? "Τι σε φοβίζει για αυτό το πρόγραμμα; (≥10 χαρ.)" : "What scares you about this program? (≥10 chars)"}
    >
      <Textarea
        rows={3}
        value={intake.biggest_fear ?? ""}
        onChange={(e) => update({ biggest_fear: e.target.value })}
      />
    </Field>
  </div>
);

export default Intake;
