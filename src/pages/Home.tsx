import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { usePageActions } from "@/context/PageActionsContext";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { ChevronRight, UtensilsCrossed, BookOpen, HeartPulse } from "lucide-react";
import DailyTasksCard from "@/components/DailyTasksCard";
import ProgramProgressBar from "@/components/ProgramProgressBar";
import FoodEntryForm from "@/components/measurements/FoodEntryForm";
import MeasurementForm from "@/components/measurements/MeasurementForm";
import WellnessJournal from "@/components/measurements/WellnessJournal";

interface RecipeCategory {
  key: string;
  label_el: string;
  label_en: string;
  color_from: string;
  color_to: string;
  cover_image_url: string | null;
  sort_order: number;
}

const Home = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const isGreek = lang === "el";
  const [displayName, setDisplayName] = useState("");
  const [vocativeName, setVocativeName] = useState("");
  const [recipeBooks, setRecipeBooks] = useState<RecipeCategory[]>([]);
  const [recipeCounts, setRecipeCounts] = useState<Record<string, number>>({});
  const [foodFormOpen, setFoodFormOpen] = useState(false);
  const [measurementFormOpen, setMeasurementFormOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const { registerActions, clearActions } = usePageActions();

  useEffect(() => {
    registerActions({ featureKey: "home", featureLabel: "Home" });
    return () => clearActions();
  }, [registerActions, clearActions]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, vocative_name_el")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if ((data as any)?.vocative_name_el) {
          setVocativeName((data as any).vocative_name_el);
        } else if (data?.display_name) {
          // Compute vocative and cache it
          const firstName = data.display_name.split(" ")[0];
          supabase.functions.invoke("get-vocative-name", {
            body: { name: firstName },
          }).then(({ data: vocData }) => {
            if (vocData?.vocative) {
              setVocativeName(vocData.vocative);
              // Cache in profile
              supabase.from("profiles").update({ vocative_name_el: vocData.vocative } as any).eq("id", user.id).then();
            }
          });
        }
      });

    // Fetch dynamic categories
    supabase
      .from("recipe_categories")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (data) setRecipeBooks(data as any[]);
      });

    // Fetch recipe counts
    supabase
      .from("recipes" as any)
      .select("category")
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        (data as any[]).forEach((r) => {
          const cat = r.category || "carnivore";
          counts[cat] = (counts[cat] || 0) + 1;
        });
        setRecipeCounts(counts);
      });
  }, [user]);

  const today = new Date();
  const dateStr = format(today, "EEEE, d MMMM", { locale: isGreek ? el : enUS });
  const firstName = displayName?.split(" ")[0] || "";

  return (
    <div className="pt-14 pb-24 px-5 space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h1 className="font-serif text-2xl font-semibold text-foreground">
          {isGreek ? `Γεια σου ${vocativeName || firstName}` : `Hello, ${firstName}`}! 👋
        </h1>
        <p className="font-sans text-sm text-muted-foreground capitalize">{dateStr}</p>
      </motion.div>

      {/* Program Progress */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <ProgramProgressBar />
      </motion.div>

      {/* Pending Tasks */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <DailyTasksCard
          onOpenFoodForm={() => setFoodFormOpen(true)}
          onOpenMeasurements={() => setMeasurementFormOpen(true)}
          onOpenPhotos={() => navigate("/measurements?tab=photos")}
        />
      </motion.div>


      {/* How I'm Feeling Shortcut */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
        <button
          onClick={() => setJournalOpen(true)}
          className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:border-gold/30 hover:shadow-sm transition-all"
        >
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gold/15 flex items-center justify-center">
            <HeartPulse className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-sans text-sm font-medium text-foreground">
              {isGreek ? "Πώς Νιώθεις;" : "How Are You Feeling?"}
            </p>
            <p className="font-sans text-[11px] text-muted-foreground">
              {isGreek ? "Σημείωσε συμπτώματα, αντιδράσεις, σκέψεις" : "Note symptoms, reactions, thoughts"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </motion.div>

      {/* Recipe Books - dynamic from DB */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gold" />
          <h2 className="font-serif text-base font-semibold text-foreground">
            {isGreek ? "Βιβλία Συνταγών" : "Recipe Books"}
          </h2>
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
        >
          {recipeBooks.map((book, i) => {
            const count = recipeCounts[book.key] || 0;
            return (
              <motion.button
                key={book.key}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                onClick={() => navigate(`/resources?category=${book.key}`)}
                className="flex-shrink-0 w-36 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow"
              >
                {book.cover_image_url ? (
                  <div className="relative h-44">
                    <img src={book.cover_image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white text-left space-y-1">
                      <p className="font-serif text-sm font-semibold leading-tight">
                        {isGreek ? book.label_el : book.label_en}
                      </p>
                      <p className="font-sans text-[10px] opacity-80">
                        {count} {isGreek ? "συνταγές" : "recipes"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={`bg-gradient-to-br from-${book.color_from} to-${book.color_to} p-4 h-44 flex flex-col justify-between text-white`}>
                    <div className="text-left space-y-1">
                      <p className="font-serif text-sm font-semibold leading-tight">
                        {isGreek ? book.label_el : book.label_en}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-sans text-[10px] opacity-80">
                        {count} {isGreek ? "συνταγές" : "recipes"}
                      </p>
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      </motion.div>

      <FoodEntryForm
        open={foodFormOpen}
        onOpenChange={setFoodFormOpen}
        editEntry={null}
        mealType="breakfast"
        userId={user?.id || ""}
        date={format(today, "yyyy-MM-dd")}
        foodPhotoAiEnabled={false}
      />

      <MeasurementForm
        open={measurementFormOpen}
        onOpenChange={setMeasurementFormOpen}
        editEntry={null}
        userId={user?.id || ""}
      />

      <WellnessJournal
        open={journalOpen}
        onOpenChange={setJournalOpen}
        userId={user?.id || ""}
      />
    </div>
  );
};

export default Home;
