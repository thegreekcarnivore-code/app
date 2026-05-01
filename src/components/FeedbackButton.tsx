import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HIDDEN_PATHS = ["/auth", "/policy", "/intake", "/billing"];

const FeedbackButton = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("idea");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;
  if (HIDDEN_PATHS.some((p) => location.pathname.startsWith(p))) return null;

  const submit = async () => {
    if (message.trim().length < 10) {
      toast({
        title: lang === "el" ? "Λίγο περισσότερο" : "A bit more, please",
        description: lang === "el" ? "Γράψε τουλάχιστον 10 χαρακτήρες." : "Type at least 10 characters.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("member_feedback" as any).insert({
      user_id: user.id,
      category,
      message: message.trim(),
    } as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    void supabase.functions.invoke("notify-admin-feedback", {
      body: { category, preview: message.trim().slice(0, 200) },
    }).catch(() => {});

    toast({
      title: lang === "el" ? "Ευχαριστούμε!" : "Thanks!",
      description: lang === "el"
        ? "Τα μηνύματα διαβάζονται μία φορά την εβδομάδα από την ομάδα."
        : "Messages are reviewed once a week by the team.",
    });
    setMessage("");
    setCategory("idea");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-lg transition-transform hover:scale-105 sm:bottom-6"
        aria-label="Feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-t-[2rem] bg-card p-6 shadow-xl sm:rounded-[2rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">
                  {lang === "el" ? "Στείλε feedback" : "Send feedback"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {lang === "el"
                    ? "Ιδέες, bugs, αιτήματα συνταγών — όλα διαβάζονται."
                    : "Ideas, bugs, recipe requests — all are read."}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">{lang === "el" ? "Ιδέα" : "Idea"}</SelectItem>
                  <SelectItem value="bug">{lang === "el" ? "Πρόβλημα / bug" : "Bug"}</SelectItem>
                  <SelectItem value="content_request">{lang === "el" ? "Αίτημα περιεχομένου" : "Content request"}</SelectItem>
                  <SelectItem value="praise">{lang === "el" ? "Επαινος" : "Praise"}</SelectItem>
                  <SelectItem value="complaint">{lang === "el" ? "Παράπονο" : "Complaint"}</SelectItem>
                </SelectContent>
              </Select>

              <Textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={lang === "el" ? "Πες μας..." : "Tell us..."}
              />

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {submitting ? (lang === "el" ? "Αποστολή..." : "Sending...") : (lang === "el" ? "Αποστολή" : "Send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackButton;
