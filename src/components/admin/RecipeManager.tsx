import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ImageIcon, AlertTriangle, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RecipeCategoryManager from "./RecipeCategoryManager";

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
  program_template_id: string | null;
}

interface RecipeCategory {
  id: string;
  key: string;
  label_el: string;
  label_en: string;
}

const RecipeManager = ({ templateId }: { templateId: string }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [showCategories, setShowCategories] = useState(false);

  useEffect(() => { load(); loadCategories(); }, [templateId]);

  const load = async () => {
    const { data } = await supabase
      .from("recipes" as any)
      .select("*")
      .order("sort_order" as any);
    if (data) setRecipes(data as any[]);
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from("recipe_categories")
      .select("id, key, label_el, label_en")
      .order("sort_order");
    if (data) setCategories(data as any[]);
  };

  const duplicateUrls = useMemo(() => {
    const urlCount: Record<string, number> = {};
    recipes.forEach((r) => {
      if (r.image_url) urlCount[r.image_url] = (urlCount[r.image_url] || 0) + 1;
    });
    const dupes = new Set<string>();
    Object.entries(urlCount).forEach(([url, count]) => {
      if (count > 1) dupes.add(url);
    });
    return dupes;
  }, [recipes]);

  const addRecipe = async () => {
    const { error } = await supabase.from("recipes" as any).insert({
      sort_order: recipes.length + 1,
      title_el: "", title_en: "",
      ingredients_el: "", ingredients_en: "",
      instructions_el: "", instructions_en: "",
      tip_el: "", tip_en: "",
      image_url: "",
      program_template_id: null,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const deleteRecipe = async (id: string) => {
    const { error } = await supabase.from("recipes" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const updateField = async (id: string, field: string, value: any) => {
    const { error } = await supabase.from("recipes" as any).update({ [field]: value } as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const handleImageUpload = async (recipeId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `recipes/${recipeId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("recipe-images").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
    await updateField(recipeId, "image_url", urlData.publicUrl);
  };

  return (
    <div className="space-y-4">
      {/* Category Manager Toggle */}
      <button
        onClick={() => setShowCategories(!showCategories)}
        className="text-xs font-sans text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
      >
        {showCategories ? "Hide" : "Manage"} Recipe Books / Categories
      </button>

      {showCategories && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <RecipeCategoryManager />
        </div>
      )}

      {/* Recipes */}
      <div className="space-y-3">
        <button
          onClick={addRecipe}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add Recipe
        </button>

        {recipes.map((r) => {
          const isDuplicate = r.image_url && duplicateUrls.has(r.image_url);
          return (
            <div key={r.id} className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex items-start gap-2">
                {/* Image preview + upload */}
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center relative group">
                  {r.image_url ? (
                    <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-md">
                    <Upload className="h-4 w-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(r.id, file);
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                      Day {r.sort_order}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {r.title_el || r.title_en || "Untitled"}
                    </span>
                  </div>
                  {isDuplicate && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-500">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Same image used by another recipe</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Day #</Label>
                      <Input type="number" defaultValue={r.sort_order} className="h-7 text-xs" onBlur={(e) => updateField(r.id, "sort_order", Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Category</Label>
                      <Select defaultValue={r.category || "carnivore"} onValueChange={(v) => updateField(r.id, "category", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.key} value={c.key}>{c.label_el} / {c.label_en}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Image URL</Label>
                      <Input defaultValue={r.image_url} placeholder="/recipes/day-01.jpg" className="h-7 text-xs" onBlur={(e) => updateField(r.id, "image_url", e.target.value)} />
                    </div>
                  </div>
                </div>
                <button onClick={() => deleteRecipe(r.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Τίτλος (EL)</Label>
                  <Input defaultValue={r.title_el} className="h-7 text-xs" onBlur={(e) => updateField(r.id, "title_el", e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px]">Title (EN)</Label>
                  <Input defaultValue={r.title_en} className="h-7 text-xs" onBlur={(e) => updateField(r.id, "title_en", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Υλικά (EL)</Label>
                  <Textarea defaultValue={r.ingredients_el} className="text-xs min-h-[50px]" onBlur={(e) => updateField(r.id, "ingredients_el", e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px]">Ingredients (EN)</Label>
                  <Textarea defaultValue={r.ingredients_en} className="text-xs min-h-[50px]" onBlur={(e) => updateField(r.id, "ingredients_en", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Εκτέλεση (EL)</Label>
                  <Textarea defaultValue={r.instructions_el} className="text-xs min-h-[50px]" onBlur={(e) => updateField(r.id, "instructions_el", e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px]">Instructions (EN)</Label>
                  <Textarea defaultValue={r.instructions_en} className="text-xs min-h-[50px]" onBlur={(e) => updateField(r.id, "instructions_en", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Tip (EL)</Label>
                  <Textarea defaultValue={r.tip_el} className="text-xs min-h-[40px]" onBlur={(e) => updateField(r.id, "tip_el", e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px]">Tip (EN)</Label>
                  <Textarea defaultValue={r.tip_en} className="text-xs min-h-[40px]" onBlur={(e) => updateField(r.id, "tip_en", e.target.value)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecipeManager;
