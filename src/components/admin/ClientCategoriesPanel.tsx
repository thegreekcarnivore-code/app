import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Tag, ChevronDown, ChevronRight, UserPlus, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  user_id: string;
  category_id: string;
}

interface ClientOption {
  id: string;
  email: string;
}

const ClientCategoriesPanel = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [newName, setNewName] = useState("");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [catRes, assignRes, clientRes] = await Promise.all([
      supabase.from("client_categories" as any).select("id, name").order("name"),
      supabase.from("client_category_assignments" as any).select("id, user_id, category_id"),
      supabase.from("profiles").select("id, email").eq("approved", true).order("email"),
    ]);
    if (catRes.data) setCategories(catRes.data as any);
    if (assignRes.data) setAssignments(assignRes.data as any);
    if (clientRes.data) setClients(clientRes.data as ClientOption[]);
    setLoading(false);
  };

  const createCategory = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("client_categories" as any).insert({ name: trimmed, created_by: user?.id } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewName("");
    toast({ title: "Category created" });
    fetchAll();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("client_categories" as any).delete().eq("id", id);
    toast({ title: "Category deleted" });
    fetchAll();
  };

  const assignClient = async (categoryId: string, userId: string) => {
    const exists = assignments.some(a => a.category_id === categoryId && a.user_id === userId);
    if (exists) return;
    const { error } = await supabase.from("client_category_assignments" as any).insert({ category_id: categoryId, user_id: userId } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    fetchAll();
  };

  const removeAssignment = async (assignmentId: string) => {
    await supabase.from("client_category_assignments" as any).delete().eq("id", assignmentId);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-sans text-xs text-muted-foreground">Create categories and assign clients to organize them into groups.</p>

      {/* Create new category */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New category name..."
          className="text-sm flex-1"
          onKeyDown={e => e.key === "Enter" && createCategory()}
        />
        <Button onClick={createCategory} size="sm" className="gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <Tag className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-sans text-sm text-muted-foreground">No categories yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => {
            const catAssignments = assignments.filter(a => a.category_id === cat.id);
            const assignedIds = new Set(catAssignments.map(a => a.user_id));
            const unassigned = clients.filter(c => !assignedIds.has(c.id));
            const isExpanded = expandedCat === cat.id;

            return (
              <div key={cat.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <button
                    onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                    className="flex items-center gap-2 text-sm font-sans font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <Tag className="h-3.5 w-3.5 text-gold" />
                    {cat.name}
                    <span className="text-[10px] text-muted-foreground font-normal">({catAssignments.length})</span>
                  </button>
                  <button onClick={() => deleteCategory(cat.id)} className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-2 space-y-2">
                    {/* Assigned clients */}
                    {catAssignments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {catAssignments.map(a => {
                          const client = clients.find(c => c.id === a.user_id);
                          return (
                            <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-sans text-gold">
                              {client?.email || "Unknown"}
                              <button onClick={() => removeAssignment(a.id)} className="hover:text-destructive transition-colors">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Add client dropdown */}
                    {unassigned.length > 0 && (
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                        {unassigned.map(c => (
                          <button
                            key={c.id}
                            onClick={() => assignClient(cat.id, c.id)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-sans text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <UserPlus className="h-3 w-3" />
                            {c.email}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientCategoriesPanel;
