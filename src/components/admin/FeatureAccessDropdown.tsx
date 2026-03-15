import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Shield, Loader2 } from "lucide-react";
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
          className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-sans font-medium text-muted-foreground hover:text-foreground hover:border-gold/30 transition-all"
          title={`Manage ${label || featureKey} access`}
        >
          <Shield className="h-3 w-3" />
          Access
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-xs font-sans font-semibold text-foreground">
            {label || featureKey} — Client Access
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No clients found</p>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-border">
            {clients.map((client) => {
              const hasAccess = client.feature_access[featureKey] !== false;
              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-xs font-sans font-medium text-foreground truncate">
                      {client.display_name || client.email || "Unknown"}
                    </p>
                    {client.display_name && client.email && (
                      <p className="text-[10px] text-muted-foreground truncate">{client.email}</p>
                    )}
                  </div>
                  <Switch
                    checked={hasAccess}
                    disabled={toggling === client.id}
                    onCheckedChange={() => toggleAccess(client)}
                  />
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
