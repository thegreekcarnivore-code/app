import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";

interface Recipe {
  id: string;
  title_el: string;
  title_en: string;
  ingredients_el: string;
  ingredients_en: string;
}

interface LogRecipeDialogProps {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
}

const LogRecipeDialog = ({ recipe, open, onClose }: LogRecipeDialogProps) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const isGreek = lang === "el";
  const [portions, setPortions] = useState(1);
  const [mealType, setMealType] = useState("lunch");
  const [saving, setSaving] = useState(false);

  if (!recipe) return null;

  const title = isGreek ? recipe.title_el : recipe.title_en;
  const ingredients = isGreek ? recipe.ingredients_el : recipe.ingredients_en;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const portionLabel = portions === 1
      ? (isGreek ? "1 μερίδα" : "1 portion")
      : (isGreek ? `${portions} μερίδες` : `${portions} portions`);

    const description = `${title} — ${portionLabel}`;
    const notes = ingredients ? `${isGreek ? "Υλικά" : "Ingredients"}: ${ingredients}` : "";

    const { error } = await supabase.from("food_journal").insert({
      user_id: user.id,
      meal_type: mealType,
      description,
      notes,
      entry_date: new Date().toISOString().split("T")[0],
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isGreek ? "Καταγράφηκε στο ημερολόγιο!" : "Logged to food diary!");
      setPortions(1);
      setMealType("lunch");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {isGreek ? "Καταγραφή Συνταγής" : "Log Recipe"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="font-sans text-sm font-medium text-foreground">{title}</p>
          </div>

          <div>
            <Label className="text-xs font-sans">{isGreek ? "Γεύμα" : "Meal"}</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">{isGreek ? "Πρωινό" : "Breakfast"}</SelectItem>
                <SelectItem value="lunch">{isGreek ? "Μεσημεριανό" : "Lunch"}</SelectItem>
                <SelectItem value="dinner">{isGreek ? "Βραδινό" : "Dinner"}</SelectItem>
                <SelectItem value="snack">{isGreek ? "Σνακ" : "Snack"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-sans">{isGreek ? "Μερίδες" : "Portions"}</Label>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => setPortions(Math.max(0.5, portions - 0.5))}
                className="rounded-lg border border-border p-2 hover:bg-muted transition-colors"
              >
                <Minus className="h-4 w-4 text-foreground" />
              </button>
              <span className="font-sans text-lg font-semibold text-foreground min-w-[3rem] text-center">
                {portions}
              </span>
              <button
                onClick={() => setPortions(portions + 0.5)}
                className="rounded-lg border border-border p-2 hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose} size="sm">
            {isGreek ? "Ακύρωση" : "Cancel"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            {saving
              ? (isGreek ? "Αποθήκευση..." : "Saving...")
              : (isGreek ? "Καταγραφή" : "Log")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogRecipeDialog;
