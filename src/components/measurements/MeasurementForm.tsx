import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TextMeasurementInput from "./TextMeasurementInput";

interface MeasurementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEntry: any | null;
  userId: string;
}

const wellnessFields = [
  { key: "energy", en: "Energy", el: "Ενέργεια" },
  { key: "digestion", en: "Digestion", el: "Πέψη" },
  { key: "skin_health", en: "Skin Health", el: "Υγεία Δέρματος" },
  { key: "mood", en: "Mood", el: "Διάθεση" },
  { key: "stress", en: "Stress", el: "Στρες" },
  { key: "cravings", en: "Cravings", el: "Λιγούρες" },
  { key: "breathing_health", en: "Breathing", el: "Αναπνοή" },
  { key: "mental_health", en: "Mental Health", el: "Ψυχική Υγεία" },
  { key: "pain", en: "Pain", el: "Πόνους" },
];

const MeasurementForm = ({ open, onOpenChange, editEntry, userId }: MeasurementFormProps) => {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Date>(new Date());
  const [fields, setFields] = useState<Record<string, string>>({});
  const [wellness, setWellness] = useState<Record<string, number>>({});

  useEffect(() => {
    if (editEntry) {
      setDate(new Date(editEntry.measured_at));
      setFields({
        weight_kg: editEntry.weight_kg?.toString() || "",
        height_cm: editEntry.height_cm?.toString() || "",
        fat_kg: editEntry.fat_kg?.toString() || "",
        muscle_kg: editEntry.muscle_kg?.toString() || "",
        waist_cm: editEntry.waist_cm?.toString() || "",
        hip_cm: editEntry.hip_cm?.toString() || "",
        right_arm_cm: editEntry.right_arm_cm?.toString() || "",
        left_arm_cm: editEntry.left_arm_cm?.toString() || "",
        right_leg_cm: editEntry.right_leg_cm?.toString() || "",
        left_leg_cm: editEntry.left_leg_cm?.toString() || "",
      });
      const w: Record<string, number> = {};
      wellnessFields.forEach(({ key }) => {
        if (editEntry[key] !== null && editEntry[key] !== undefined) w[key] = editEntry[key];
      });
      setWellness(w);
    } else {
      setDate(new Date());
      setFields({});
      setWellness({});
    }
  }, [editEntry, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const numField = (k: string) => fields[k] ? parseFloat(fields[k]) : null;
      const payload = {
        user_id: userId,
        measured_at: date.toISOString(),
        weight_kg: numField("weight_kg"),
        height_cm: numField("height_cm"),
        fat_kg: numField("fat_kg"),
        muscle_kg: numField("muscle_kg"),
        waist_cm: numField("waist_cm"),
        hip_cm: numField("hip_cm"),
        right_arm_cm: numField("right_arm_cm"),
        left_arm_cm: numField("left_arm_cm"),
        right_leg_cm: numField("right_leg_cm"),
        left_leg_cm: numField("left_leg_cm"),
        ...Object.fromEntries(wellnessFields.map(({ key }) => [key, wellness[key] ?? null])),
      };

      if (editEntry) {
        const { error } = await supabase.from("measurements").update(payload).eq("id", editEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("measurements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurements", userId] });
      onOpenChange(false);
      toast({ title: lang === "en" ? "Saved" : "Αποθηκεύτηκε" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const numericFields = [
    { key: "weight_kg", label: lang === "en" ? "Weight (kg)" : "Βάρος (kg)" },
    { key: "height_cm", label: lang === "en" ? "Height (cm)" : "Ύψος (cm)" },
    { key: "fat_kg", label: lang === "en" ? "Fat (kg)" : "Λίπος (kg)" },
    { key: "muscle_kg", label: lang === "en" ? "Muscle (kg)" : "Μυϊκή Μάζα (kg)" },
    { key: "waist_cm", label: lang === "en" ? "Waist (cm)" : "Περίμετρος Μέσης (cm)" },
    { key: "hip_cm", label: lang === "en" ? "Hip (cm)" : "Περίμετρος Γοφών (cm)" },
    { key: "right_arm_cm", label: lang === "en" ? "Right Arm (cm)" : "Μπράτσο Δεξί (cm)" },
    { key: "left_arm_cm", label: lang === "en" ? "Left Arm (cm)" : "Μπράτσο Αριστ. (cm)" },
    { key: "right_leg_cm", label: lang === "en" ? "Right Leg (cm)" : "Μηρός Δεξί (cm)" },
    { key: "left_leg_cm", label: lang === "en" ? "Left Leg (cm)" : "Μηρός Αριστ. (cm)" },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] pb-6">
        <DrawerTitle className="px-4 pt-4 font-serif text-xl">
          {editEntry ? (lang === "en" ? "Edit Measurement" : "Επεξεργασία Μέτρησης") : (lang === "en" ? "New Measurement" : "Νέα Μέτρηση")}
        </DrawerTitle>

        <Tabs defaultValue={editEntry ? "manual" : "manual"} className="px-4 pt-2">
          {!editEntry && (
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="manual" className="text-sm font-sans">
                {lang === "en" ? "Manual" : "Χειροκίνητα"}
              </TabsTrigger>
              <TabsTrigger value="quick" className="text-sm font-sans">
                {lang === "en" ? "Quick Entry" : "Γρήγορη Καταχώρηση"}
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="manual" className="mt-0">
            <div className="overflow-y-auto max-h-[calc(85vh-140px)] space-y-5 pb-2">
              {/* Date picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              {/* Body metrics */}
              <div>
                <h4 className="text-base font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {lang === "en" ? "Body Composition" : "Συσταση Σωματος"}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {numericFields.map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-sm font-sans text-muted-foreground">{label}</label>
                      <input
                        data-guide={`measurement-field-${key}`}
                        type="number"
                        step="0.1"
                        value={fields[key] || ""}
                        onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base font-sans text-foreground"
                        placeholder="—"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Wellness */}
              <div>
                <h4 className="text-base font-sans font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {lang === "en" ? "Wellness (0-10)" : "Ευεξια (0-10)"}
                </h4>
                <div className="space-y-3">
                  {wellnessFields.map(({ key, en, el }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-base font-sans text-muted-foreground w-28 shrink-0">{lang === "en" ? en : el}</span>
                      <Slider
                        min={0}
                        max={10}
                        step={1}
                        value={[wellness[key] ?? 0]}
                        onValueChange={([v]) => setWellness((w) => ({ ...w, [key]: v }))}
                        className={cn("flex-1", !(key in wellness) && "opacity-40")}
                      />
                      <span className="text-base font-sans font-medium text-foreground w-8 text-right">
                        {key in wellness ? wellness[key] : "—"}
                      </span>
                      {key in wellness && (
                        <button
                          type="button"
                          onClick={() => setWellness((w) => {
                            const next = { ...w };
                            delete next[key];
                            return next;
                          })}
                          className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          title={lang === "en" ? "Clear" : "Καθαρισμός"}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
                {mutation.isPending ? (lang === "en" ? "Saving..." : "Αποθήκευση...") : (lang === "en" ? "Save" : "Αποθήκευση")}
              </Button>
            </div>
          </TabsContent>

          {!editEntry && (
            <TabsContent value="quick" className="mt-0">
              <div className="overflow-y-auto max-h-[calc(85vh-140px)] pb-2">
                <TextMeasurementInput userId={userId} />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
};

export default MeasurementForm;
