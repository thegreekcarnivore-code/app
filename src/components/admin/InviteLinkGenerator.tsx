import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import FeatureAccessPanel from "@/components/admin/FeatureAccessPanel";
import { Link2, Copy, Trash2, Clock, CheckCircle } from "lucide-react";

interface InviteToken {
  id: string;
  token: string;
  feature_access: Record<string, boolean>;
  created_at: string;
  expires_at: string;
  used_by: string | null;
  used_at: string | null;
}

const InviteLinkGenerator = () => {
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({
    concierge: true, explore: true, delivery: true, shopping: true,
    travel: true, measurements: true, video_library: true, resources: true, community: true,
  });
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [tokens, setTokens] = useState<InviteToken[]>([]);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    const { data } = await supabase
      .from("invite_tokens")
      .select("id, token, feature_access, created_at, expires_at, used_by, used_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setTokens(data as any);
  };

  const generateLink = async () => {
    setGenerating(true);
    const { data, error } = await supabase
      .from("invite_tokens")
      .insert({ feature_access: featureAccess } as any)
      .select("token")
      .single();

    setGenerating(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const link = `https://thegreekcarnivore.com/auth?invite=${data.token}`;
    setGeneratedLink(link);
    fetchTokens();
    toast({ title: "Invite link created", description: "Copy and share the link below." });
  };

  const copyLink = (token: string) => {
    const link = `https://thegreekcarnivore.com/auth?invite=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: "Copied!", description: "Invite link copied to clipboard." });
  };

  const deleteToken = async (id: string) => {
    await supabase.from("invite_tokens").delete().eq("id", id);
    toast({ title: "Link deleted" });
    fetchTokens();
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h3 className="font-serif text-sm font-semibold text-foreground">Generate Invite Link</h3>
        <p className="font-sans text-xs text-muted-foreground">
          Create a single-use invite link. Anyone who signs up with this link will be auto-approved with the selected feature access.
        </p>

        <div>
          <Label className="font-sans text-xs mb-2 block">Feature Access</Label>
          <FeatureAccessPanel initialAccess={featureAccess} onChanged={setFeatureAccess} />
        </div>

        <button
          onClick={generateLink}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          {generating ? "Generating..." : "Generate Link"}
        </button>

        {generatedLink && (
          <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 space-y-2">
            <p className="font-sans text-xs font-medium text-foreground">Your invite link:</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={generatedLink}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-sans text-xs text-foreground"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  toast({ title: "Copied!" });
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Token history */}
      {tokens.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-serif text-sm font-semibold text-foreground">Recent Invite Links</h3>
          {tokens.map((t) => {
            const expired = isExpired(t.expires_at);
            const used = !!t.used_by;
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[10px] text-muted-foreground">
                      ...{t.token.slice(-12)}
                    </code>
                    {used ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    ) : expired ? (
                      <span className="font-sans text-[10px] text-destructive">Expired</span>
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!used && !expired && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copyLink(t.token)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteToken(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-sans text-muted-foreground">
                  <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>Expires {new Date(t.expires_at).toLocaleDateString()}</span>
                  {used && t.used_at && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-500">Used {new Date(t.used_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InviteLinkGenerator;
