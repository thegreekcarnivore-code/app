import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ExternalLink, FolderOpen, ChefHat, Plus, Trash2, Pencil, X, Upload, ImageIcon, BookOpen, Settings2, ChevronLeft, Heart } from "lucide-react";
import { usePageActions } from "@/context/PageActionsContext";
import RecipeCard from "@/components/RecipeCard";
import LogRecipeDialog from "@/components/LogRecipeDialog";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DocItem {
  id: string;
  title: string;
  description: string;
  document_url: string;
  category: string;
}

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
  category: string;
}

interface RecipeCategoryItem {
  id: string;
  key: string;
  label_el: string;
  label_en: string;
  color_from: string;
  color_to: string;
  cover_image_url: string | null;
  sort_order: number;
}

const Resources = () => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<RecipeCategoryItem[]>([]);
  const { registerActions, clearActions } = usePageActions();
  const [searchParams] = useSearchParams();
  const filterCategory = searchParams.get("category");
  const [selectedBook, setSelectedBook] = useState<string | null>(filterCategory);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [diaryRecipe, setDiaryRecipe] = useState<any>(null);

  // Admin state
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showBookManager, setShowBookManager] = useState(false);
  const [editingBook, setEditingBook] = useState<RecipeCategoryItem | null>(null);

  useEffect(() => {
    registerActions({ featureKey: "resources", featureLabel: "Recipes" });
    return () => clearActions();
  }, [registerActions, clearActions]);

  const loadRecipes = useCallback(async () => {
    if (!user) return;
    let query = supabase.from("recipes" as any).select("*").order("sort_order" as any);
    if (filterCategory) query = query.eq("category", filterCategory);
    const { data } = await query;
    if (data) setRecipes(data as any[]);
  }, [user, filterCategory]);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("recipe_categories").select("*").order("sort_order");
    if (data) setCategoryLabels(data as any[]);
  }, [user]);

  const loadFavorites = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("recipe_favorites" as any).select("recipe_id").eq("user_id", user.id);
    if (data) setFavoriteIds(new Set((data as any[]).map((f: any) => f.recipe_id)));
  }, [user]);

  const toggleFavorite = async (recipeId: string) => {
    if (!user) return;
    if (favoriteIds.has(recipeId)) {
      await supabase.from("recipe_favorites" as any).delete().eq("user_id", user.id).eq("recipe_id", recipeId);
      setFavoriteIds((prev) => { const n = new Set(prev); n.delete(recipeId); return n; });
    } else {
      await supabase.from("recipe_favorites" as any).insert({ user_id: user.id, recipe_id: recipeId } as any);
      setFavoriteIds((prev) => new Set(prev).add(recipeId));
    }
  };

  useEffect(() => {
    if (!user) return;
    loadRecipes();
    loadCategories();
    loadFavorites();

    // Load documents
    const loadDocs = async () => {
      const { data: enrollments } = await supabase
        .from("client_program_enrollments" as any)
        .select("program_template_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);
      if (!enrollments || (enrollments as any[]).length === 0) return;
      const { data } = await supabase
        .from("program_documents" as any)
        .select("*")
        .eq("program_template_id", (enrollments as any[])[0].program_template_id)
        .order("sort_order" as any);
      if (data) setDocuments(data as any[]);
    };
    loadDocs();
  }, [user, filterCategory, loadRecipes, loadCategories, loadFavorites]);

  // ── Recipe CRUD ──
  const addRecipe = async (category?: string) => {
    const catRecipes = recipes.filter((r) => r.category === (category || "carnivore"));
    const { error } = await supabase.from("recipes" as any).insert({
      sort_order: catRecipes.length + 1,
      title_el: "", title_en: "",
      ingredients_el: "", ingredients_en: "",
      instructions_el: "", instructions_en: "",
      tip_el: "", tip_en: "",
      image_url: "",
      category: category || "carnivore",
      program_template_id: null,
    } as any);
    if (error) toast.error(error.message);
    else {
      await loadRecipes();
      // Open the newly created recipe for editing
      const { data } = await supabase.from("recipes" as any).select("*").order("created_at" as any, { ascending: false }).limit(1);
      if (data && (data as any[]).length > 0) setEditingRecipe((data as any[])[0]);
    }
  };

  const deleteRecipe = async (id: string) => {
    const { error } = await supabase.from("recipes" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(isGreek ? "Συνταγή διαγράφηκε" : "Recipe deleted"); loadRecipes(); }
  };

  const updateRecipeField = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("recipes" as any).update({ [field]: value } as any).eq("id", id);
    if (error) toast.error(error.message);
  };

  const saveRecipe = async (recipe: Recipe) => {
    const { id, ...rest } = recipe;
    const { error } = await supabase.from("recipes" as any).update(rest as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(isGreek ? "Αποθηκεύτηκε" : "Saved"); setEditingRecipe(null); loadRecipes(); }
  };

  const handleRecipeImageUpload = async (recipeId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `recipes/${recipeId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("recipe-images").upload(path, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); return; }
    const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
    await updateRecipeField(recipeId, "image_url", urlData.publicUrl);
    if (editingRecipe?.id === recipeId) {
      setEditingRecipe({ ...editingRecipe, image_url: urlData.publicUrl });
    }
    loadRecipes();
  };

  // ── Book/Category CRUD ──
  const addBook = async () => {
    const nextOrder = categoryLabels.length + 1;
    const { error } = await supabase.from("recipe_categories").insert({
      key: `book_${Date.now()}`,
      label_el: "",
      label_en: "",
      sort_order: nextOrder,
    } as any);
    if (error) toast.error(error.message);
    else {
      await loadCategories();
      const { data } = await supabase.from("recipe_categories").select("*").order("created_at", { ascending: false }).limit(1);
      if (data && (data as any[]).length > 0) setEditingBook((data as any[])[0]);
    }
  };

  const deleteBook = async (id: string) => {
    const { error } = await supabase.from("recipe_categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(isGreek ? "Βιβλίο διαγράφηκε" : "Book deleted"); loadCategories(); }
  };

  const saveBook = async (book: RecipeCategoryItem) => {
    const { id, ...rest } = book;
    const { error } = await supabase.from("recipe_categories").update(rest as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(isGreek ? "Αποθηκεύτηκε" : "Saved"); setEditingBook(null); loadCategories(); }
  };

  const handleBookCoverUpload = async (bookId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `covers/${bookId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("recipe-images").upload(path, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); return; }
    const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
    if (editingBook?.id === bookId) {
      setEditingBook({ ...editingBook, cover_image_url: urlData.publicUrl });
    }
    await supabase.from("recipe_categories").update({ cover_image_url: urlData.publicUrl } as any).eq("id", bookId);
    loadCategories();
  };

  const categories = [...new Set(documents.map((d) => d.category))];
  const totalRecipes = recipes.length;
  const totalDocuments = documents.length;

  const resolveThemeColor = (value: string) => {
    if (!value) return "hsl(var(--muted))";
    if (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl") || value.startsWith("var(")) {
      return value;
    }
    return `hsl(var(--${value}))`;
  };

  // Group recipes by category
  const grouped = recipes.reduce<Record<string, Recipe[]>>((acc, r) => {
    const cat = r.category || "carnivore";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="pt-16 pb-4 space-y-6">
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--beige))_0%,hsl(var(--background))_100%)] p-5 shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-gold">
                {isGreek ? "Υλικό υποστήριξης" : "Support library"}
              </p>
              <h1 className="font-serif text-2xl font-semibold text-foreground">
                {isGreek ? "Συνταγές και υλικό προγράμματος" : "Recipes and program support"}
              </h1>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowBookManager(!showBookManager)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-sans font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {isGreek ? "Βιβλία" : "Books"}
              </button>
            )}
          </div>
          <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
            {isGreek
              ? "Χρησιμοποίησε τη βιβλιοθήκη όταν χρειάζεσαι κάτι πρακτικό για να εκτελέσεις καλύτερα το πλάνο σου: συνταγές, documents και υποστηρικτικό υλικό."
              : "Use the library when you need something practical to execute the plan better: recipes, documents, and support material."}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-sans font-medium text-foreground">
              {categoryLabels.length} {isGreek ? "βιβλία" : "books"}
            </span>
            <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-sans font-medium text-foreground">
              {totalRecipes} {isGreek ? "συνταγές" : "recipes"}
            </span>
            <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-sans font-medium text-foreground">
              {totalDocuments} {isGreek ? "έγγραφα" : "documents"}
            </span>
          </div>
        </div>
      </motion.section>

      {/* ── Favorites toggle ── */}
      {!selectedBook && favoriteIds.size > 0 && (
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-sans font-medium transition-colors border ${
            showFavoritesOnly
              ? "bg-red-500/10 border-red-500/30 text-red-500"
              : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className={`h-3 w-3 ${showFavoritesOnly ? "fill-red-500" : ""}`} />
          {isGreek ? `Αγαπημένα (${favoriteIds.size})` : `Favorites (${favoriteIds.size})`}
        </button>
      )}

      {/* ── Admin: Book Manager ── */}
      <AnimatePresence>
        {isAdmin && showBookManager && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-gold" />
                  <h3 className="font-serif text-sm font-semibold text-foreground">
                    {isGreek ? "Διαχείριση Βιβλίων" : "Manage Books"}
                  </h3>
                </div>
                <button onClick={addBook} className="inline-flex items-center gap-1 rounded-lg bg-gold/10 px-2.5 py-1.5 text-xs font-sans font-medium text-gold hover:bg-gold/20 transition-colors">
                  <Plus className="h-3 w-3" /> {isGreek ? "Νέο Βιβλίο" : "New Book"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryLabels.map((book) => (
                  <div key={book.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 group">
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><BookOpen className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-xs font-medium text-foreground truncate">
                        {isGreek ? book.label_el : book.label_en || book.key}
                      </p>
                      <p className="font-sans text-[10px] text-muted-foreground">
                        {(grouped[book.key] || []).length} {isGreek ? "συνταγές" : "recipes"}
                      </p>
                    </div>
                    <button onClick={() => setEditingBook(book)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteBook(book.id)} className="p-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Favorites-only view ── */}
      {!selectedBook && showFavoritesOnly && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-3">
            <Heart className="h-4 w-4 text-red-500 fill-red-500" />
            <h2 className="font-serif text-base font-semibold text-foreground">
              {isGreek ? "Αγαπημένες Συνταγές" : "Favorite Recipes"}
            </h2>
          </div>
          {recipes.filter((r) => favoriteIds.has(r.id)).length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {recipes.filter((r) => favoriteIds.has(r.id)).map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isFavorited={true}
                  onToggleFavorite={toggleFavorite}
                  onLogToDiary={setDiaryRecipe}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="font-sans text-sm text-muted-foreground">
                {isGreek ? "Δεν έχεις αγαπημένες συνταγές ακόμα." : "No favorite recipes yet."}
              </p>
            </div>
          )}
        </motion.section>
      )}

      {/* ── Books grid (no book selected) ── */}
      {!selectedBook && !showFavoritesOnly && (
        <>
          {categoryLabels.length > 0 ? (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-gold" />
                <h2 className="font-serif text-base font-semibold text-foreground">
                  {isGreek ? "Βιβλία Συνταγών" : "Recipe Books"}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {categoryLabels.map((book) => {
                  const count = (grouped[book.key] || []).length;
                  return (
                    <motion.div
                      key={book.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedBook(book.key)}
                      className="rounded-xl border border-border bg-card overflow-hidden card-lift cursor-pointer group"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                        {book.cover_image_url ? (
                          <img src={book.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${resolveThemeColor(book.color_from)}, ${resolveThemeColor(book.color_to)})`,
                            }}
                          >
                            <BookOpen className="h-8 w-8 text-white/60" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <Badge className="absolute bottom-2 left-2 bg-card/80 text-foreground border-0 font-sans text-[10px] px-2 py-0.5 backdrop-blur-sm">
                          {count} {isGreek ? "συνταγές" : "recipes"}
                        </Badge>
                      </div>
                      <div className="px-3 py-2.5">
                        <h3 className="font-serif text-sm font-semibold text-foreground leading-tight">
                          {isGreek ? book.label_el : book.label_en || book.key}
                        </h3>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.section>
          ) : (
            <div className="text-center py-12">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-sans text-sm text-muted-foreground">
                {isGreek ? "Δεν υπάρχουν βιβλία ακόμα." : "No recipe books yet."}
              </p>
              {isAdmin && (
                <button onClick={addBook} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-sans font-medium text-gold-foreground hover:bg-gold/90 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> {isGreek ? "Πρώτο Βιβλίο" : "First Book"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Recipes inside selected book ── */}
      {selectedBook && (() => {
        const items = grouped[selectedBook] || [];
        const found = categoryLabels.find((c) => c.key === selectedBook);
        const bookLabel = found ? (isGreek ? found.label_el : found.label_en) : selectedBook;
        return (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => setSelectedBook(null)}
              className="inline-flex items-center gap-1 text-xs font-sans text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {isGreek ? "Όλα τα βιβλία" : "All books"}
            </button>
            <div className="flex items-center gap-2 mb-1">
              <ChefHat className="h-4 w-4 text-gold" />
              <h2 className="font-serif text-base font-semibold text-foreground">{bookLabel}</h2>
              <span className="text-[10px] font-sans text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{items.length}</span>
              {isAdmin && (
                <button onClick={() => addRecipe(selectedBook)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1 text-[10px] font-sans font-medium text-gold hover:bg-gold/20 transition-colors">
                  <Plus className="h-3 w-3" /> {isGreek ? "Προσθήκη" : "Add"}
                </button>
              )}
            </div>
            {items.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {items.map((recipe) => (
                  <div key={recipe.id} className="relative group">
                    <RecipeCard
                      recipe={recipe}
                      isFavorited={favoriteIds.has(recipe.id)}
                      onToggleFavorite={toggleFavorite}
                      onLogToDiary={setDiaryRecipe}
                    />
                    {isAdmin && (
                      <div className="absolute top-9 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={(e) => { e.stopPropagation(); setEditingRecipe(recipe); }} className="rounded-full bg-card/90 border border-border p-1.5 shadow-sm hover:bg-card transition-colors">
                          <Pencil className="h-3 w-3 text-foreground" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteRecipe(recipe.id); }} className="rounded-full bg-card/90 border border-border p-1.5 shadow-sm hover:bg-destructive/10 transition-colors">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="font-sans text-sm text-muted-foreground">{isGreek ? "Δεν υπάρχουν συνταγές ακόμα." : "No recipes yet."}</p>
              </div>
            )}
          </motion.section>
        );
      })()}

      {/* Documents Section */}
      {categories.map((cat) => (
        <div key={cat} className="space-y-2">
          <h2 className="font-serif text-sm font-semibold text-foreground capitalize">{cat}</h2>
          {documents
            .filter((d) => d.category === cat)
            .map((doc) => (
              <a key={doc.id} href={doc.document_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-gold/30 hover:shadow-sm transition-all">
                <FileText className="h-5 w-5 text-gold flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground">{doc.title}</p>
                  {doc.description && <p className="font-sans text-[10px] text-muted-foreground truncate">{doc.description}</p>}
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
        </div>
      ))}

      {/* ── Recipe Edit Dialog ── */}
      <Dialog open={!!editingRecipe} onOpenChange={(open) => !open && setEditingRecipe(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{isGreek ? "Επεξεργασία Συνταγής" : "Edit Recipe"}</DialogTitle>
          </DialogHeader>
          {editingRecipe && (
            <div className="space-y-4">
              {/* Image */}
              <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-muted group">
                {editingRecipe.image_url ? (
                  <img src={editingRecipe.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="flex items-center gap-2 text-white text-xs font-sans font-medium"><Upload className="h-4 w-4" /> {isGreek ? "Ανέβασε εικόνα" : "Upload image"}</div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRecipeImageUpload(editingRecipe.id, f); }} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{isGreek ? "Αρ. Ημέρας" : "Day #"}</Label>
                  <Input type="number" value={editingRecipe.sort_order} className="h-8 text-sm" onChange={(e) => setEditingRecipe({ ...editingRecipe, sort_order: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">{isGreek ? "Κατηγορία" : "Category"}</Label>
                  <Select value={editingRecipe.category || "carnivore"} onValueChange={(v) => setEditingRecipe({ ...editingRecipe, category: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categoryLabels.map((c) => (
                        <SelectItem key={c.key} value={c.key}>{isGreek ? c.label_el : c.label_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Τίτλος (EL)</Label><Input value={editingRecipe.title_el} className="h-8 text-sm" onChange={(e) => setEditingRecipe({ ...editingRecipe, title_el: e.target.value })} /></div>
                <div><Label className="text-xs">Title (EN)</Label><Input value={editingRecipe.title_en} className="h-8 text-sm" onChange={(e) => setEditingRecipe({ ...editingRecipe, title_en: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Υλικά (EL)</Label><Textarea value={editingRecipe.ingredients_el} className="text-sm min-h-[60px]" onChange={(e) => setEditingRecipe({ ...editingRecipe, ingredients_el: e.target.value })} /></div>
                <div><Label className="text-xs">Ingredients (EN)</Label><Textarea value={editingRecipe.ingredients_en} className="text-sm min-h-[60px]" onChange={(e) => setEditingRecipe({ ...editingRecipe, ingredients_en: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Εκτέλεση (EL)</Label><Textarea value={editingRecipe.instructions_el} className="text-sm min-h-[60px]" onChange={(e) => setEditingRecipe({ ...editingRecipe, instructions_el: e.target.value })} /></div>
                <div><Label className="text-xs">Instructions (EN)</Label><Textarea value={editingRecipe.instructions_en} className="text-sm min-h-[60px]" onChange={(e) => setEditingRecipe({ ...editingRecipe, instructions_en: e.target.value })} /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Tip (EL)</Label><Textarea value={editingRecipe.tip_el} className="text-sm min-h-[40px]" onChange={(e) => setEditingRecipe({ ...editingRecipe, tip_el: e.target.value })} /></div>
                <div><Label className="text-xs">Tip (EN)</Label><Textarea value={editingRecipe.tip_en} className="text-sm min-h-[40px]" onChange={(e) => setEditingRecipe({ ...editingRecipe, tip_en: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingRecipe(null)}>{isGreek ? "Ακύρωση" : "Cancel"}</Button>
            <Button onClick={() => editingRecipe && saveRecipe(editingRecipe)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {isGreek ? "Αποθήκευση" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Book Edit Dialog ── */}
      <Dialog open={!!editingBook} onOpenChange={(open) => !open && setEditingBook(null)}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{isGreek ? "Επεξεργασία Βιβλίου" : "Edit Book"}</DialogTitle>
          </DialogHeader>
          {editingBook && (
            <div className="space-y-4">
              {/* Cover Image */}
              <div className="relative w-full aspect-[3/2] rounded-lg overflow-hidden bg-muted group">
                {editingBook.cover_image_url ? (
                  <img src={editingBook.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><BookOpen className="h-8 w-8 text-muted-foreground" /></div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <div className="flex items-center gap-2 text-white text-xs font-sans font-medium"><Upload className="h-4 w-4" /> {isGreek ? "Ανέβασε εξώφυλλο" : "Upload cover"}</div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBookCoverUpload(editingBook.id, f); }} />
                </label>
              </div>

              <div>
                <Label className="text-xs">Key</Label>
                <Input value={editingBook.key} className="h-8 text-sm" onChange={(e) => setEditingBook({ ...editingBook, key: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Όνομα (EL)</Label><Input value={editingBook.label_el} className="h-8 text-sm" onChange={(e) => setEditingBook({ ...editingBook, label_el: e.target.value })} /></div>
                <div><Label className="text-xs">Name (EN)</Label><Input value={editingBook.label_en} className="h-8 text-sm" onChange={(e) => setEditingBook({ ...editingBook, label_en: e.target.value })} /></div>
              </div>

              <div>
                <Label className="text-xs">{isGreek ? "Σειρά" : "Sort Order"}</Label>
                <Input type="number" value={editingBook.sort_order} className="h-8 text-sm" onChange={(e) => setEditingBook({ ...editingBook, sort_order: Number(e.target.value) })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingBook(null)}>{isGreek ? "Ακύρωση" : "Cancel"}</Button>
            <Button onClick={() => editingBook && saveBook(editingBook)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {isGreek ? "Αποθήκευση" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Log to Diary Dialog ── */}
      <LogRecipeDialog
        recipe={diaryRecipe}
        open={!!diaryRecipe}
        onClose={() => setDiaryRecipe(null)}
      />
    </div>
  );
};

export default Resources;
