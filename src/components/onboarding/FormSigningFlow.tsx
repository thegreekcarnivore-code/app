import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import SignatureCanvas from "./SignatureCanvas";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, ChevronRight } from "lucide-react";

interface Props {
  enrollmentId: string;
  templateId: string;
  onComplete: () => void;
}

const FormSigningFlow = ({ enrollmentId, templateId, onComplete }: Props) => {
  const { user } = useAuth();
  const [forms, setForms] = useState<any[]>([]);
  const [signedFormIds, setSignedFormIds] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullName, setFullName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadForms();
  }, [templateId, enrollmentId]);

  const loadForms = async () => {
    const [formsRes, sigsRes] = await Promise.all([
      supabase.from("program_forms" as any).select("*").eq("program_template_id", templateId).order("sort_order" as any),
      supabase.from("client_form_signatures" as any).select("form_id").eq("enrollment_id", enrollmentId).eq("user_id", user!.id),
    ]);
    if (formsRes.data) setForms(formsRes.data as any[]);
    if (sigsRes.data) {
      const ids = new Set((sigsRes.data as any[]).map((s: any) => s.form_id));
      setSignedFormIds(ids);
      // Find first unsigned form
      if (formsRes.data) {
        const firstUnsigned = (formsRes.data as any[]).findIndex((f: any) => !ids.has(f.id));
        if (firstUnsigned === -1) onComplete();
        else setCurrentIndex(firstUnsigned);
      }
    }
  };

  const signForm = async () => {
    const form = forms[currentIndex];
    if (!form || !fullName.trim() || !signatureDataUrl) {
      toast({ title: "Please type your full name and draw your signature", variant: "destructive" });
      return;
    }

    setSaving(true);

    // Upload signature image
    const blob = await fetch(signatureDataUrl).then((r) => r.blob());
    const path = `${user!.id}/${form.id}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("client_form_signatures" as any).insert({
      user_id: user!.id,
      form_id: form.id,
      enrollment_id: enrollmentId,
      full_name: fullName,
      signature_url: path,
    } as any);

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const newSigned = new Set(signedFormIds);
    newSigned.add(form.id);
    setSignedFormIds(newSigned);
    setFullName("");
    setSignatureDataUrl(null);

    // Move to next unsigned form
    const nextUnsigned = forms.findIndex((f, i) => i > currentIndex && !newSigned.has(f.id));
    if (nextUnsigned !== -1) {
      setCurrentIndex(nextUnsigned);
    } else {
      // Check if all done
      const allSigned = forms.every((f) => newSigned.has(f.id));
      if (allSigned) onComplete();
    }
  };

  if (forms.length === 0) {
    return <div className="flex justify-center py-8"><div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  }

  const currentForm = forms[currentIndex];
  if (!currentForm) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Progress */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          {forms.map((f, i) => (
            <div key={f.id} className={`flex-1 h-1.5 rounded-full transition-colors ${signedFormIds.has(f.id) ? "bg-gold" : i === currentIndex ? "bg-gold/50" : "bg-muted"}`} />
          ))}
        </div>
        <h1 className="font-serif text-lg font-semibold text-foreground">{currentForm.title}</h1>
        <p className="font-sans text-xs text-muted-foreground">Form {currentIndex + 1} of {forms.length} — Please read and sign below</p>
      </div>

      {/* Form content */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="prose prose-sm max-w-none font-sans text-foreground">
          <ReactMarkdown>{currentForm.content || "*(Form content will be provided)*"}</ReactMarkdown>
        </div>
      </ScrollArea>

      {/* Signing area */}
      <div className="border-t border-border px-6 py-4 space-y-3 bg-card">
        <div>
          <Label className="font-sans text-xs">Full Legal Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Type your full name..." className="text-sm" />
        </div>
        <div>
          <Label className="font-sans text-xs">Signature</Label>
          <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
        </div>
        <button
          onClick={signForm}
          disabled={saving || !fullName.trim() || !signatureDataUrl}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Signing..." : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              I agree and sign
              {currentIndex < forms.length - 1 && <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default FormSigningFlow;
