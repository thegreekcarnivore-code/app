import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const allergyOptions = ["Gluten", "Dairy", "Nuts", "Shellfish", "Soy", "Eggs"];
const cuisineOptions = ["Japanese", "Italian", "French", "Mediterranean", "American", "Korean", "Indian", "Middle Eastern"];
const goalOptions = ["Stay sharp", "Light energy", "Impress guests", "Recovery", "Endurance"];
const dietOptions = ["No restriction", "Mediterranean", "Low-carb", "Plant-forward", "Pescatarian"];

const TagSelector = ({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) => (
  <div className="space-y-3">
    <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={cn(
            "rounded-lg border px-3.5 py-2 font-sans text-xs font-medium transition-all",
            selected.includes(opt)
              ? "border-gold bg-gold/10 text-gold"
              : "border-border bg-card text-muted-foreground hover:border-gold/30"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  </div>
);

const Preferences = () => {
  const [allergies, setAllergies] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [diet, setDiet] = useState<string[]>(["No restriction"]);
  const [alcoholRule, setAlcoholRule] = useState("");

  const toggle = (arr: string[], setArr: (v: string[]) => void) => (val: string) => {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-6 pt-14 space-y-10"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">Profile</p>
        <h1 className="font-serif text-2xl font-semibold text-foreground">My Preferences</h1>
        <p className="font-sans text-sm text-muted-foreground mt-2">Your concierge remembers. Set once, refine anytime.</p>
      </div>

      <TagSelector label="Allergies & Intolerances" options={allergyOptions} selected={allergies} onToggle={toggle(allergies, setAllergies)} />
      <TagSelector label="Cuisine Preferences" options={cuisineOptions} selected={cuisines} onToggle={toggle(cuisines, setCuisines)} />
      <TagSelector label="Dining Goals" options={goalOptions} selected={goals} onToggle={toggle(goals, setGoals)} />
      <TagSelector label="Dietary Approach" options={dietOptions} selected={diet} onToggle={toggle(diet, setDiet)} />

      <div className="space-y-3">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-muted-foreground">Alcohol Rules</p>
        <input
          type="text"
          value={alcoholRule}
          onChange={(e) => setAlcoholRule(e.target.value)}
          placeholder="e.g., No alcohol at business dinners"
          className="w-full rounded-xl border border-border bg-card py-3.5 px-4 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold"
        />
      </div>
    </motion.div>
  );
};

export default Preferences;
