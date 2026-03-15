import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Edit2, Calendar, CreditCard, FileText, Link2, Loader2, Send } from "lucide-react";

interface ClientProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

interface Program {
  id: string;
  program_name: string;
  start_date: string;
  end_date: string | null;
  amount_paid: number;
  payment_method: string;
  payment_status: string;
  installments_total: number;
  installments_paid: number;
  agreement_notes: string;
  created_at: string;
  stripe_checkout_session_id?: string | null;
  stripe_subscription_id?: string | null;
  prospect_email?: string | null;
  program_template_id?: string | null;
}

interface ProgramTemplate {
  id: string;
  name: string;
  duration_weeks: number;
}

const emptyForm = {
  program_name: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: "",
  amount_paid: 0,
  payment_method: "",
  payment_status: "pending",
  installments_total: 1,
  installments_paid: 0,
  agreement_notes: "",
  prospect_email: "",
  program_template_id: "",
};

const ClientProgramDialog = ({ open, onOpenChange, userId, userEmail }: ClientProgramDialogProps) => {
  const { lang } = useLanguage();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sendingPaymentLink, setSendingPaymentLink] = useState<string | null>(null);
  const [sendingOffer, setSendingOffer] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);

  useEffect(() => {
    if (open) {
      fetchPrograms();
      fetchTemplates();
    }
  }, [open, userId]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("program_templates")
      .select("id, name, duration_weeks")
      .order("name");
    if (data) setTemplates(data);
  };

  const fetchPrograms = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_programs" as any)
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false });
    if (!error && data) setPrograms(data as any);
    setLoading(false);
  };

  const handleSave = async () => {
    const payload: any = {
      user_id: userId,
      program_name: form.program_name,
      start_date: form.start_date,
      end_date: form.end_date || null,
      amount_paid: form.amount_paid,
      payment_method: form.payment_method,
      payment_status: form.payment_status,
      installments_total: form.installments_total,
      installments_paid: form.installments_paid,
      agreement_notes: form.agreement_notes,
      prospect_email: form.prospect_email || null,
      program_template_id: form.program_template_id || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("client_programs" as any).update(payload as any).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("client_programs" as any).insert(payload as any));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Program updated" : "Program added" });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchPrograms();
    }
  };

  const handleEdit = (p: Program) => {
    setEditingId(p.id);
    setForm({
      program_name: p.program_name,
      start_date: p.start_date,
      end_date: p.end_date || "",
      amount_paid: p.amount_paid,
      payment_method: p.payment_method || "",
      payment_status: p.payment_status,
      installments_total: p.installments_total,
      installments_paid: p.installments_paid,
      agreement_notes: p.agreement_notes || "",
      prospect_email: p.prospect_email || "",
      program_template_id: p.program_template_id || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("client_programs" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Program deleted" });
      fetchPrograms();
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSendPaymentLink = async (p: Program) => {
    setSendingPaymentLink(p.id);
    try {
      const email = p.prospect_email || userEmail;
      const amountCents = Math.round(p.amount_paid * 100);
      const mode = p.installments_total > 1 ? "subscription" : "payment";

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          client_user_id: userId,
          client_email: email,
          program_id: p.id,
          program_name: p.program_name || "Coaching Program",
          amount_cents: mode === "subscription" 
            ? Math.round(amountCents / p.installments_total) 
            : amountCents,
          currency: "eur",
          mode,
          program_template_id: p.program_template_id || "",
          start_date: p.start_date || "",
        },
      });

      if (error) throw error;
      if (data?.url) {
        await navigator.clipboard.writeText(data.url);
        toast({
          title: lang === "en" ? "Payment link copied!" : "Ο σύνδεσμος πληρωμής αντιγράφηκε!",
          description: lang === "en" 
            ? "Send this link to the client to complete payment" 
            : "Στείλτε αυτόν τον σύνδεσμο στον πελάτη για να ολοκληρώσει την πληρωμή",
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to create payment link", variant: "destructive" });
    } finally {
      setSendingPaymentLink(null);
    }
  };

  const handleSendOffer = async (p: Program) => {
    const email = p.prospect_email || userEmail;
    if (!email) {
      toast({ title: "Error", description: lang === "en" ? "No email address" : "Δεν υπάρχει email", variant: "destructive" });
      return;
    }
    setSendingOffer(p.id);
    try {
      const amountCents = Math.round(p.amount_paid * 100);
      const mode = p.installments_total > 1 ? "subscription" : "payment";

      const { data, error } = await supabase.functions.invoke("send-program-offer", {
        body: {
          client_user_id: userId,
          client_email: email,
          program_id: p.id,
          program_name: p.program_name || "Coaching Program",
          amount_cents: mode === "subscription"
            ? Math.round(amountCents / p.installments_total)
            : amountCents,
          currency: "eur",
          mode,
          program_template_id: p.program_template_id || "",
          start_date: p.start_date || "",
          installments_total: p.installments_total,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: lang === "en" ? "Offer sent!" : "Η προσφορά στάλθηκε!",
        description: lang === "en"
          ? `Email sent to ${email} with payment link`
          : `Στάλθηκε email στο ${email} με σύνδεσμο πληρωμής`,
      });
      fetchPrograms();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to send offer", variant: "destructive" });
    } finally {
      setSendingOffer(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            {lang === "en" ? "Client Profile" : "Προφίλ Πελάτη"} — {userEmail}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showForm && (
            <Button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="w-full gap-2" size="sm">
              <Plus className="h-4 w-4" />
              {lang === "en" ? "Add Program" : "Προσθήκη Προγράμματος"}
            </Button>
          )}

          {showForm && (
            <ProgramForm
              form={form}
              setForm={setForm}
              editingId={editingId}
              lang={lang}
              onSave={handleSave}
              onCancel={cancelForm}
              templates={templates}
            />
          )}

          {loading && <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>}
          {programs.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              lang={lang}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSendPaymentLink={handleSendPaymentLink}
              sendingPaymentLink={sendingPaymentLink}
              onSendOffer={handleSendOffer}
              sendingOffer={sendingOffer}
            />
          ))}
          {!loading && programs.length === 0 && !showForm && (
            <p className="text-center text-sm text-muted-foreground py-6">
              {lang === "en" ? "No programs yet" : "Δεν υπάρχουν προγράμματα ακόμα"}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Extracted form component
function ProgramForm({ form, setForm, editingId, lang, onSave, onCancel, templates }: {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  editingId: string | null;
  lang: string;
  onSave: () => void;
  onCancel: () => void;
  templates: ProgramTemplate[];
}) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div>
          <Label className="text-xs">{lang === "en" ? "Program Template" : "Πρότυπο Προγράμματος"}</Label>
          <Select
            value={form.program_template_id || "none"}
            onValueChange={(v) => {
              const tpl = templates.find(t => t.id === v);
              setForm({
                ...form,
                program_template_id: v === "none" ? "" : v,
                ...(tpl ? { program_name: tpl.name } : {}),
              });
            }}
          >
            <SelectTrigger className="mt-1"><SelectValue placeholder={lang === "en" ? "Select template..." : "Επιλογή..."} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{lang === "en" ? "— None —" : "— Κανένα —"}</SelectItem>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name} ({t.duration_weeks}w)</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{lang === "en" ? "Program Name" : "Όνομα Προγράμματος"}</Label>
          <Input value={form.program_name} onChange={(e) => setForm({ ...form, program_name: e.target.value })} placeholder="e.g. 3-Month Carnivore" className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">{lang === "en" ? "Prospect Email (if different)" : "Email Υποψηφίου (αν διαφέρει)"}</Label>
          <Input value={form.prospect_email} onChange={(e) => setForm({ ...form, prospect_email: e.target.value })} placeholder="prospect@example.com" className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{lang === "en" ? "Start Date" : "Ημ. Έναρξης"}</Label>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{lang === "en" ? "End Date" : "Ημ. Λήξης"}</Label>
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">{lang === "en" ? "Amount (€)" : "Ποσό (€)"}</Label>
            <Input type="number" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{lang === "en" ? "Payment Method" : "Μέθοδος Πληρωμής"}</Label>
            <Input value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="e.g. Bank Transfer" className="mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">{lang === "en" ? "Status" : "Κατάσταση"}</Label>
            <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">{lang === "en" ? "Paid" : "Πληρωμένο"}</SelectItem>
                <SelectItem value="pending">{lang === "en" ? "Pending" : "Εκκρεμεί"}</SelectItem>
                <SelectItem value="offer_sent">{lang === "en" ? "Offer Sent" : "Αναμονή Πληρωμής"}</SelectItem>
                <SelectItem value="partial">{lang === "en" ? "Partial" : "Μερικό"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{lang === "en" ? "Installments" : "Δόσεις"}</Label>
            <Input type="number" min={1} value={form.installments_total} onChange={(e) => setForm({ ...form, installments_total: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">{lang === "en" ? "Paid" : "Πληρώθηκαν"}</Label>
            <Input type="number" min={0} value={form.installments_paid} onChange={(e) => setForm({ ...form, installments_paid: Number(e.target.value) })} className="mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs">{lang === "en" ? "Agreement / Notes" : "Συμφωνία / Σημειώσεις"}</Label>
          <Textarea value={form.agreement_notes} onChange={(e) => setForm({ ...form, agreement_notes: e.target.value })} className="mt-1 min-h-[80px]" placeholder={lang === "en" ? "What was agreed..." : "Τι συμφωνήθηκε..."} />
        </div>
        <div className="flex gap-2">
          <Button onClick={onSave} className="flex-1" size="sm">
            {editingId ? (lang === "en" ? "Update" : "Ενημέρωση") : (lang === "en" ? "Save" : "Αποθήκευση")}
          </Button>
          <Button variant="outline" onClick={onCancel} size="sm">
            {lang === "en" ? "Cancel" : "Ακύρωση"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Extracted program card component
function ProgramCard({ program: p, lang, onEdit, onDelete, onSendPaymentLink, sendingPaymentLink, onSendOffer, sendingOffer }: {
  program: Program;
  lang: string;
  onEdit: (p: Program) => void;
  onDelete: (id: string) => void;
  onSendPaymentLink: (p: Program) => void;
  sendingPaymentLink: string | null;
  onSendOffer: (p: Program) => void;
  sendingOffer: string | null;
}) {
  const hasStripeLink = !!p.stripe_checkout_session_id;
  const isSubscription = !!p.stripe_subscription_id;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-sans text-sm font-semibold text-foreground">{p.program_name || "Untitled Program"}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans mt-0.5">
              <Calendar className="h-3 w-3" />
              <span>{p.start_date}{p.end_date ? ` → ${p.end_date}` : ""}</span>
            </div>
            {p.prospect_email && (
              <p className="text-xs text-muted-foreground mt-0.5">📧 {p.prospect_email}</p>
            )}
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(p)} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(p.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-sans text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <CreditCard className="h-3 w-3 text-primary" />
            €{p.amount_paid} · {p.payment_method || "—"}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            p.payment_status === "paid" ? "bg-emerald-500/10 text-emerald-500" :
            p.payment_status === "offer_sent" ? "bg-blue-500/10 text-blue-500" :
            p.payment_status === "partial" ? "bg-amber-500/10 text-amber-500" :
            p.payment_status === "canceled" ? "bg-destructive/10 text-destructive" :
            "bg-destructive/10 text-destructive"
          }`}>
            {p.payment_status === "paid" ? "✓ Paid" :
             p.payment_status === "offer_sent" ? "⏳ Αναμονή Πληρωμής" :
             p.payment_status === "partial" ? "Partial" : 
             p.payment_status === "canceled" ? "Canceled" : "Pending"}
          </span>
          {p.installments_total > 1 && (
            <span>{p.installments_paid}/{p.installments_total} installments</span>
          )}
          {isSubscription && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
              Subscription
            </span>
          )}
        </div>
        {p.agreement_notes && (
          <div className="flex items-start gap-1.5 text-xs font-sans text-muted-foreground bg-muted/50 rounded-md p-2 mt-1">
            <FileText className="h-3 w-3 mt-0.5 shrink-0" />
            <p className="whitespace-pre-wrap">{p.agreement_notes}</p>
          </div>
        )}
        {/* Action buttons when not fully paid */}
        {p.payment_status !== "paid" && p.payment_status !== "canceled" && (
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 text-xs"
              onClick={() => onSendPaymentLink(p)}
              disabled={sendingPaymentLink === p.id}
            >
              {sendingPaymentLink === p.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2 className="h-3 w-3" />
              )}
              {lang === "en" ? "Copy Payment Link" : "Αντιγραφή Συνδέσμου"}
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-2 text-xs"
              onClick={() => onSendOffer(p)}
              disabled={sendingOffer === p.id}
            >
              {sendingOffer === p.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {p.payment_status === "offer_sent"
                ? (lang === "en" ? "Resend Offer" : "Επαναποστολή Προσφοράς")
                : (lang === "en" ? "Send Offer" : "Αποστολή Προσφοράς")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ClientProgramDialog;
