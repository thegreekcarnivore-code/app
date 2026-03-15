import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, UtensilsCrossed, Lightbulb, Heart, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";

interface Recipe {
  id: string;
  sort_order: number;
  title_el: string;
  title_en: string;
  ingredients_el: string;
  ingredients_en: string;
  instructions_el: string;
  instructions_en: string;
  tip_el: string;
  tip_en: string;
  image_url: string;
  category?: string;
}

interface RecipeCardProps {
  recipe: Recipe;
  isFavorited?: boolean;
  onToggleFavorite?: (recipeId: string) => void;
  onLogToDiary?: (recipe: Recipe) => void;
}

const RecipeCard = ({ recipe, isFavorited = false, onToggleFavorite, onLogToDiary }: RecipeCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const { lang } = useLanguage();
  const isGreek = lang === "el";

  const title = isGreek ? recipe.title_el : recipe.title_en;
  const ingredients = isGreek ? recipe.ingredients_el : recipe.ingredients_en;
  const instructions = isGreek ? recipe.instructions_el : recipe.instructions_en;
  const tip = isGreek ? recipe.tip_el : recipe.tip_en;

  return (
    <motion.div
      layout
      className="rounded-xl border border-border bg-card overflow-hidden card-lift cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Image with day badge */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={recipe.image_url}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <Badge className="absolute top-2 left-2 bg-gold text-gold-foreground border-0 font-sans text-[10px] px-2 py-0.5">
          {isGreek ? `Ημερα ${recipe.sort_order}` : `Day ${recipe.sort_order}`}
        </Badge>

        {/* Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(recipe.id);
            }}
            className="absolute top-2 right-2 rounded-full bg-card/80 backdrop-blur-sm p-1.5 shadow-sm transition-colors hover:bg-card z-10"
          >
            <Heart
              className={`h-3.5 w-3.5 transition-colors ${
                isFavorited ? "fill-red-500 text-red-500" : "text-foreground/60"
              }`}
            />
          </button>
        )}

        <ChevronDown
          className={`absolute bottom-2 right-2 h-4 w-4 text-white/80 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Title */}
      <div className="px-3 py-2.5">
        <h3 className="font-serif text-sm font-semibold text-foreground leading-tight">
          {title}
        </h3>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
              {/* Ingredients */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <UtensilsCrossed className="h-3 w-3 text-gold" />
                  <span className="font-sans text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {isGreek ? "Υλικα" : "Ingredients"}
                  </span>
                </div>
                <p className="font-sans text-xs text-foreground/80 leading-relaxed">
                  {ingredients}
                </p>
              </div>

              {/* Instructions */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-sans text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {isGreek ? "Εκτελεση" : "Instructions"}
                  </span>
                </div>
                <p className="font-sans text-xs text-foreground/80 leading-relaxed">
                  {instructions}
                </p>
              </div>

              {/* Tip */}
              {tip && (
                <div className="flex gap-2 bg-gold/10 rounded-lg p-2">
                  <Lightbulb className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
                  <p className="font-sans text-[11px] text-foreground/70 leading-relaxed italic">
                    {tip}
                  </p>
                </div>
              )}

              {/* Log to Food Diary button */}
              {onLogToDiary && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogToDiary(recipe);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold/30 bg-gold/5 py-2 text-xs font-sans font-medium text-gold hover:bg-gold/10 transition-colors"
                >
                  <Utensils className="h-3.5 w-3.5" />
                  {isGreek ? "Καταγραφή στο Ημερολόγιο" : "Log to Food Diary"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RecipeCard;
