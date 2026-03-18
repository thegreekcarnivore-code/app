import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Shield, Loader2, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ClientProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  feature_access: Record<string, boolean>;
}

interface FeatureAccessDropdownProps {
  featureKey: string;
  label?: string;
}

const FeatureAccessDropdown = ({ featureKey, label }: FeatureAccessDropdownProps) => {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (open && isAdmin) fetchClients();
  }, [open, isAdmin]);

  const fetchClients = async () => {
    setLoading(true);
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles || []).map((r) => r.user_id));

    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name, feature_access")
      .eq("approved", true)
      .order("email");

    if (data) {
      setClients(
        (data as any[])
          .filter((p) => !adminIds.has(p.id))
          .map((p) => ({
            id: p.id,
            email: p.email,
            display_name: p.display_name,
            feature_access: p.feature_access || {},
          }))
      );
    }
    setLoading(false);
  };

  const toggleAccess = async (client: ClientProfile) => {
    setToggling(client.id);
    const current = client.feature_access[featureKey] !== false;
    const updated = { ...client.feature_access, [featureKey]: !current };

    const { error } = await supabase
      .from("profiles")
      .update({ feature_access: updated } as any)
      .eq("id", client.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id ? { ...c, feature_access: updated } : c
        )
      );
    }
    setToggling(null);
  };

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/75 px-3 py-1.5 text-[11px] font-sans font-medium text-muted-foreground shadow-sm transition-all hover:border-gold/30 hover:bg-background hover:text-foreground"
          title={`Manage ${label || featureKey} access`}
        >
          <Shield className="h-3.5 w-3.5 text-gold" />
          Client access
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 overflow-hidden rounded-3xl border border-border/70 p-0 shadow-xl" align="end">
        <div className="border-b border-border bg-[linear-gradient(135deg,hsl(var(--beige))_0%,hsl(var(--background))_100%)] px-4 py-3.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-gold">
            <Sparkles className="h-3 w-3" />
            Access control
          </div>
          <p className="mt-2 text-sm font-serif font-semibold text-foreground">
            {label || featureKey} — Client Access
          </p>
          <p className="mt-1 text-xs font-sans leading-relaxed text-muted-foreground">
            Approve or restrict this area for active clients without leaving the page.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No clients found</p>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-border bg-background/95">
            {clients.map((client) => {
              const hasAccess = client.feature_access[featureKey] !== false;
              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-sans font-medium text-foreground truncate">
                      {client.display_name || client.email || "Unknown"}
                    </p>
                    {client.display_name && client.email && (
                      <p className="text-[11px] text-muted-foreground truncate">{client.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-[0.16em] ${
                      hasAccess
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {hasAccess ? "On" : "Off"}
                    </span>
                    <Switch
                      checked={hasAccess}
                      disabled={toggling === client.id}
                      onCheckedChange={() => toggleAccess(client)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default FeatureAccessDropdown;
