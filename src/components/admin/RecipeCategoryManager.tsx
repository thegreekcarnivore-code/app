import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecipeCategory {
  id: string;
  key: string;
  label_el: string;
  label_en: string;
  color_from: string;
  color_to: string;
  cover_image_url: string | null;
  sort_order: number;
}

const RecipeCategoryManager = () => {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase
      .from("recipe_categories")
      .select("*")
      .order("sort_order");
    if (data) setCategories(data as any[]);
  };

  const addCategory = async () => {
    const nextOrder = categories.length + 1;
    const { error } = await supabase.from("recipe_categories").insert({
      key: `category_${Date.now()}`,
      label_el: "",
      label_en: "",
      sort_order: nextOrder,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("recipe_categories").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const updateField = async (id: string, field: string, value: string | number) => {
    const { error } = await supabase.from("recipe_categories").update({ [field]: value } as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const handleCoverUpload = async (id: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `covers/${id}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("recipe-images").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      return;
    }
    const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
    await updateField(id, "cover_image_url", urlData.publicUrl);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm font-semibold text-foreground">Recipe Books / Categories</h3>
      </div>

      <button
        onClick={addCategory}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Plus className="h-3 w-3" /> Add Book
      </button>

      {categories.map((cat) => (
        <div key={cat.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
              #{cat.sort_order}
            </Badge>
            <span className="text-xs text-muted-foreground flex-1 truncate">
              {cat.label_el || cat.label_en || cat.key}
            </span>
            <button onClick={() => deleteCategory(cat.id)} className="p-1 text-destructive hover:bg-destructive/10 rounded-md">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Key</Label>
              <Input defaultValue={cat.key} className="h-7 text-xs" onBlur={(e) => updateField(cat.id, "key", e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">Ελληνικά</Label>
              <Input defaultValue={cat.label_el} className="h-7 text-xs" onBlur={(e) => updateField(cat.id, "label_el", e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">English</Label>
              <Input defaultValue={cat.label_en} className="h-7 text-xs" onBlur={(e) => updateField(cat.id, "label_en", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">Order</Label>
              <Input type="number" defaultValue={cat.sort_order} className="h-7 text-xs" onBlur={(e) => updateField(cat.id, "sort_order", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-[10px]">Color From</Label>
              <Input defaultValue={cat.color_from} placeholder="amber-700" className="h-7 text-xs" onBlur={(e) => updateField(cat.id, "color_from", e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px]">Color To</Label>
              <Input defaultValue={cat.color_to} placeholder="amber-900" className="h-7 text-xs" onBlur={(e) => updateField(cat.id, "color_to", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-[10px]">Cover Image</Label>
            <div className="flex items-center gap-2">
              {cat.cover_image_url && (
                <img src={cat.cover_image_url} alt="" className="w-10 h-10 rounded object-cover" />
              )}
              <input
                type="file"
                accept="image/*"
                className="text-[10px] font-sans file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:bg-muted file:text-foreground"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverUpload(cat.id, file);
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecipeCategoryManager;
