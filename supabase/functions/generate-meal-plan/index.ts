import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createOpenAIChatCompletion, getOpenAIModel } from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipe {
  id: string;
  title_el: string;
  title_en: string;
  ingredients_el: string;
}

interface ClientNote {
  category: string;
  title: string;
}

interface MemberIntake {
  allergies: string[] | null;
  disliked_foods: string[] | null;
  eats_eggs: boolean | null;
  eats_dairy: boolean | null;
  eats_organs: boolean | null;
  cooking_skill: string | null;
  primary_goal_detail: string | null;
  completed_at: string | null;
}

// Greek substring matchers used to exclude recipes whose ingredients clash
// with intake-declared dietary flags. Conservative: false negatives are
// safer than false positives (model double-checks via prompt).
const INGREDIENT_BLOCKLIST_FOR_FLAGS: Record<"no_eggs" | "no_dairy" | "no_organs", string[]> = {
  no_eggs: ["αυγ", "ομελέτ"],
  no_dairy: ["τυρί", "γιαούρτ", "γάλα", "βούτυρ", "κρέμα γάλακτος", "παρμεζάν", "φέτα", "ανθότυρο", "μυζήθρα", "κεφαλοτύρι", "κασέρι", "γραβιέρα"],
  no_organs: ["συκώτι", "καρδιά", "νεφρά", "μυαλό", "γλώσσα", "πατσά", "σπληνάντερ"],
};

function recipeMatchesAnyTerm(ingredientsEl: string, terms: string[]): boolean {
  if (!ingredientsEl || terms.length === 0) return false;
  const lower = ingredientsEl.toLowerCase();
  return terms.some((t) => lower.includes(t.toLowerCase()));
}

async function authenticateUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("UNAUTHORIZED");
  return data.claims.sub as string;
}

function isoMondayOfThisWeek(now = new Date()): string {
  const d = new Date(now.toISOString().slice(0, 10));
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId: string;
  try {
    userId = await authenticateUser(req);
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const lang = body?.lang === "en" ? "en" : "el";
    const source = (body?.source as string) ?? "manual_request";
    const force = Boolean(body?.force);
    const weekStart = isoMondayOfThisWeek();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!force) {
      const { data: existing } = await admin
        .from("meal_plans")
        .select("id, plan, generated_at")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .eq("source", source)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ ok: true, cached: true, plan: existing }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const [profileRes, notesRes, recipesRes, journalRes, intakeRes] = await Promise.all([
      admin.from("profiles").select("id, first_name, language").eq("id", userId).maybeSingle(),
      admin.from("client_notes").select("category, title").eq("user_id", userId).eq("is_active", true),
      admin
        .from("recipes")
        .select("id, title_el, title_en, ingredients_el")
        .order("sort_order", { ascending: true })
        .limit(150),
      admin
        .from("food_journal")
        .select("description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("member_intakes")
        .select("allergies, disliked_foods, eats_eggs, eats_dairy, eats_organs, cooking_skill, primary_goal_detail, completed_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const allRecipes: Recipe[] = (recipesRes.data ?? []).filter((r): r is Recipe => Boolean(r?.id));
    if (allRecipes.length === 0) {
      return new Response(JSON.stringify({ error: "No recipes available to plan with" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notes: ClientNote[] = notesRes.data ?? [];
    const intake = intakeRes.data as MemberIntake | null;
    const intakeReady = Boolean(intake?.completed_at);

    // Merge allergies + dislikes from BOTH client_notes (legacy) and member_intakes (new).
    const noteAllergies = notes.filter((n) => n.category === "allergy").map((n) => n.title);
    const noteRestrictions = notes.filter((n) => n.category === "restriction").map((n) => n.title);
    const intakeAllergies = (intakeReady && intake?.allergies) ? intake.allergies : [];
    const intakeDislikes = (intakeReady && intake?.disliked_foods) ? intake.disliked_foods : [];
    const allergies = Array.from(new Set([...noteAllergies, ...intakeAllergies])).filter(Boolean);
    const restrictions = Array.from(new Set([...noteRestrictions, ...intakeDislikes])).filter(Boolean);
    const goals = notes.filter((n) => n.category === "goal").map((n) => n.title);
    if (intakeReady && intake?.primary_goal_detail) goals.push(intake.primary_goal_detail);

    // Build hard exclusion list from intake diet flags.
    const flagBlocklist: string[] = [];
    if (intakeReady) {
      if (intake?.eats_eggs === false) flagBlocklist.push(...INGREDIENT_BLOCKLIST_FOR_FLAGS.no_eggs);
      if (intake?.eats_dairy === false) flagBlocklist.push(...INGREDIENT_BLOCKLIST_FOR_FLAGS.no_dairy);
      if (intake?.eats_organs === false) flagBlocklist.push(...INGREDIENT_BLOCKLIST_FOR_FLAGS.no_organs);
    }
    // Allergies + dislikes are also substring-matched conservatively against ingredients.
    const allergyTerms = [...allergies, ...restrictions, ...flagBlocklist].filter(Boolean);

    const recipes = allergyTerms.length === 0
      ? allRecipes
      : allRecipes.filter((r) => !recipeMatchesAnyTerm(r.ingredients_el ?? "", allergyTerms));

    if (recipes.length === 0) {
      return new Response(JSON.stringify({ error: "All recipes excluded by allergies/restrictions" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recentMeals = (journalRes.data ?? []).slice(0, 12).map((m: { description: string }) => m.description).filter(Boolean);

    const recipeCatalog = recipes.map((r) => ({
      id: r.id,
      title: lang === "el" ? r.title_el || r.title_en : r.title_en || r.title_el,
    }));

    const cookingSkill = (intakeReady && intake?.cooking_skill) ? intake.cooking_skill : null;
    const cookingSkillNote = lang === "el"
      ? cookingSkill === "none" || cookingSkill === "basic"
        ? " Προτίμησε απλές συνταγές με ≤4 υλικά και ελάχιστα βήματα."
        : cookingSkill === "advanced"
          ? " Μπορείς να εντάξεις και πιο σύνθετες τεχνικές αν ταιριάζουν."
          : ""
      : cookingSkill === "none" || cookingSkill === "basic"
        ? " Prefer simple recipes with ≤4 ingredients and minimal steps."
        : cookingSkill === "advanced"
          ? " You may include more advanced techniques where relevant."
          : "";

    const systemPrompt = lang === "el"
      ? `Είσαι ο σχεδιαστής εβδομαδιαίου meal plan για το πρόγραμμα Μεταμόρφωση του Greek Carnivore. Φτιάχνεις 7-ήμερο πρόγραμμα 2 γευμάτων/ημέρα (πρωινό-μεσημεριανό-βραδινό προαιρετικά). Χρησιμοποιείς ΜΟΝΟ συνταγές από τον δοσμένο κατάλογο, αναφέροντας το recipe_id. ΑΠΟΛΥΤΟΣ ΣΕΒΑΣΜΟΣ σε αλλεργίες, περιορισμούς, και διατροφικά flags (no_eggs/no_dairy/no_organs) — αν μια συνταγή έχει απαγορευμένο υλικό, ΔΕΝ τη χρησιμοποιείς. Αποφεύγεις την επανάληψη πρόσφατων γευμάτων.${cookingSkillNote} Επιστρέφεις JSON αυστηρά της μορφής {"days":[{"date":"YYYY-MM-DD","meals":[{"slot":"breakfast|lunch|dinner","recipe_id":"...","title":"...","notes":"..."}]}]}.`
      : `You are the weekly meal-plan designer for the Greek Carnivore Metamorphosis program. Build a 7-day plan with 2-3 meals per day. Use ONLY recipes from the provided catalog, referencing recipe_id. ABSOLUTE RESPECT for allergies, restrictions, and diet flags (no_eggs/no_dairy/no_organs) — if a recipe contains a forbidden ingredient, do NOT use it. Avoid repeating recent meals.${cookingSkillNote} Return strict JSON {"days":[{"date":"YYYY-MM-DD","meals":[{"slot":"breakfast|lunch|dinner","recipe_id":"...","title":"...","notes":"..."}]}]}.`;

    const userPrompt = JSON.stringify({
      week_start: weekStart,
      language: lang,
      first_name: profileRes.data?.first_name ?? null,
      goals,
      allergies,
      restrictions,
      diet_flags: intakeReady
        ? {
            no_eggs: intake?.eats_eggs === false,
            no_dairy: intake?.eats_dairy === false,
            no_organs: intake?.eats_organs === false,
            cooking_skill: cookingSkill,
          }
        : null,
      recent_meals: recentMeals,
      recipe_catalog: recipeCatalog,
    });

    const completion = await createOpenAIChatCompletion({
      model: getOpenAIModel("OPENAI_MODEL_MEAL_PLAN", "gpt-4.1-mini"),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const planText = completion?.choices?.[0]?.message?.content ?? "{}";
    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(planText);
    } catch {
      throw new Error("Meal plan model returned invalid JSON");
    }

    const validIds = new Set(recipes.map((r) => r.id));
    const days = Array.isArray((plan as { days?: unknown }).days) ? (plan as { days: unknown[] }).days : [];
    const cleanedDays = days.map((day: unknown) => {
      const d = day as { date?: string; meals?: unknown[] };
      const meals = (d.meals ?? []).filter((m: unknown) => {
        const meal = m as { recipe_id?: string };
        return meal && validIds.has(meal.recipe_id ?? "");
      });
      return { date: d.date, meals };
    });

    const upsert = await admin
      .from("meal_plans")
      .upsert(
        {
          user_id: userId,
          week_start: weekStart,
          language: lang,
          source,
          plan: { days: cleanedDays },
        },
        { onConflict: "user_id,week_start,source" },
      )
      .select()
      .single();

    if (upsert.error) throw upsert.error;

    try {
      await admin.rpc("log_api_usage", {
        _user_id: userId,
        _function_name: "generate-meal-plan",
        _service: "openai",
        _model: getOpenAIModel("OPENAI_MODEL_MEAL_PLAN", "gpt-4.1-mini"),
        _estimated_cost: 0.01,
        _call_count: 1,
      });
    } catch (e) {
      console.error("log_api_usage failed:", e);
    }

    return new Response(JSON.stringify({ ok: true, cached: false, plan: upsert.data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-meal-plan error:", e);
    const message = e instanceof Error ? e.message : "meal plan generation failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
