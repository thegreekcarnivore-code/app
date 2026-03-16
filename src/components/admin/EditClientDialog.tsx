import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, SquareArrowOutUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  onSaved?: () => void;
}

interface EditClientForm {
  display_name: string;
  email: string;
  height_cm: string;
  sex: string;
  date_of_birth: string;
}

const EMPTY_FORM: EditClientForm = {
  display_name: "",
  email: "",
  height_cm: "",
  sex: "",
  date_of_birth: "",
};

const EditClientDialog = ({ open, onOpenChange, userId, userEmail, onSaved }: EditClientDialogProps) => {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [form, setForm] = useState<EditClientForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;

    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, email, height_cm, sex, date_of_birth")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        toast({
          title: lang === "el" ? "Σφάλμα φόρτωσης" : "Failed to load client",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setForm({
        display_name: data?.display_name ?? "",
        email: data?.email ?? userEmail ?? "",
        height_cm: data?.height_cm ? String(data.height_cm) : "",
        sex: data?.sex ?? "",
        date_of_birth: data?.date_of_birth ?? "",
      });
      setLoading(false);
    };

    fetchProfile();
  }, [open, userId, userEmail, lang]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        sex: form.sex || null,
        date_of_birth: form.date_of_birth || null,
      } as any)
      .eq("id", userId);

    setSaving(false);

    if (error) {
      toast({
        title: lang === "el" ? "Σφάλμα ενημέρωσης" : "Failed to update client",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: lang === "el" ? "Ο πελάτης ενημερώθηκε" : "Client updated" });
    onSaved?.();
    onOpenChange(false);
  };

  const openFullProfile = () => {
    onOpenChange(false);
    navigate(`/admin/client/${userId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">
            {lang === "el" ? "Επεξεργασία Πελάτη" : "Edit Client"} — {userEmail}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">
                  {lang === "el" ? "Όνομα" : "Name"}
                </Label>
                <Input
                  value={form.display_name}
                  onChange={(e) => setForm((current) => ({ ...current, display_name: e.target.value }))}
                  placeholder={lang === "el" ? "Όνομα πελάτη" : "Client name"}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">Email</Label>
                <Input value={form.email} disabled className="h-9 text-sm opacity-60" />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">
                  {lang === "el" ? "Ύψος (cm)" : "Height (cm)"}
                </Label>
                <Input
                  type="number"
                  value={form.height_cm}
                  onChange={(e) => setForm((current) => ({ ...current, height_cm: e.target.value }))}
                  placeholder="175"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">
                  {lang === "el" ? "Φύλο" : "Sex"}
                </Label>
                <Select value={form.sex || "unspecified"} onValueChange={(value) => setForm((current) => ({ ...current, sex: value === "unspecified" ? "" : value }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unspecified">{lang === "el" ? "Δεν ορίστηκε" : "Unspecified"}</SelectItem>
                    <SelectItem value="male">{lang === "el" ? "Άνδρας" : "Male"}</SelectItem>
                    <SelectItem value="female">{lang === "el" ? "Γυναίκα" : "Female"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] uppercase tracking-wider">
                  {lang === "el" ? "Ημερ. γέννησης" : "Date of birth"}
                </Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm((current) => ({ ...current, date_of_birth: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={openFullProfile} className="flex-1 gap-2">
                <SquareArrowOutUpRight className="h-4 w-4" />
                {lang === "el" ? "Άνοιγμα πλήρους προφίλ" : "Open full profile"}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                <Save className="h-4 w-4" />
                {saving
                  ? (lang === "el" ? "Αποθήκευση..." : "Saving...")
                  : (lang === "el" ? "Αποθήκευση αλλαγών" : "Save changes")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditClientDialog;
