import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, FileSignature, Globe, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import SignatureCanvas from "@/components/onboarding/SignatureCanvas";

const POLICY_VERSION = "2.0";

const POLICY_EL = `# Όροι Συνεργασίας, Χρήσης & Προστασίας Δεδομένων
**Alexandros The Greek Carnivore**

Καλώς ήρθες στην πλατφόρμα coaching του **Alexandros The Greek Carnivore**. Το παρόν έγγραφο εξηγεί με καθαρό τρόπο πώς λειτουργεί το πρόγραμμα, τι χρειάζεται από εσένα και πώς χρησιμοποιούνται τα προσωπικά σου δεδομένα ώστε να μπορέσεις να προχωρήσεις με ασφάλεια και σαφήνεια.

---

## 1. Σκοπός της πλατφόρμας
Η πλατφόρμα υπάρχει για να υποστηρίζει τη συνεργασία σου μέσα στο πρόγραμμα coaching. Από εδώ μπορείς να βλέπεις το πλάνο σου, να κάνεις check-ins, να καταγράφεις μετρήσεις, να ανεβάζεις φωτογραφίες προόδου, να λαμβάνεις οδηγίες και να επικοινωνείς με τον coach σου.

## 2. Πώς λειτουργεί το coaching πρόγραμμα
Το πρόγραμμα παρέχει οργανωμένη καθοδήγηση γύρω από τη διατροφή, την καθημερινή εκτέλεση, την παρακολούθηση της προόδου και την υποστήριξη της συνέπειάς σου. Το περιεχόμενο, τα tasks, οι φόρμες, τα μηνύματα και οι εβδομαδιαίες ή περιοδικές αξιολογήσεις αποτελούν μέρος της συνολικής εμπειρίας coaching.

## 3. Τι περιμένουμε από εσένα
Χρησιμοποιώντας την πλατφόρμα, συμφωνείς ότι:

- θα δίνεις ακριβείς και ενημερωμένες πληροφορίες,
- θα συμπληρώνεις τα check-ins, τις μετρήσεις και τα σχετικά στοιχεία με ειλικρίνεια,
- θα χρησιμοποιείς την πλατφόρμα με σεβασμό,
- θα διατηρείς ασφαλή τα προσωπικά στοιχεία σύνδεσής σου,
- θα χρησιμοποιείς το πρόγραμμα ως συνεργατικό εργαλείο coaching και όχι ως υποκατάστατο ιατρικής περίθαλψης.

## 4. Ιατρική αποποίηση
Το πρόγραμμα δεν παρέχει ιατρική διάγνωση ή ιατρική θεραπεία. Οι πληροφορίες, οι οδηγίες και το υλικό της πλατφόρμας έχουν εκπαιδευτικό και coaching χαρακτήρα. Πριν εφαρμόσεις σημαντικές αλλαγές στη διατροφή, στην άσκηση ή σε θέματα που επηρεάζουν την υγεία σου, είναι δική σου ευθύνη να συμβουλευτείς τον προσωπικό σου ιατρό ή τον κατάλληλο επαγγελματία υγείας.

## 5. Μετρήσεις, check-ins και φωτογραφίες προόδου
Για να παραμένει το coaching ουσιαστικό, μπορεί να σου ζητηθεί να υποβάλλεις:

- μετρήσεις σώματος,
- ημερήσια ή εβδομαδιαία check-ins,
- φωτογραφίες προόδου,
- στοιχεία που αφορούν την πορεία, τα συμπτώματα, την ενέργεια ή την εφαρμογή του πλάνου.

Αυτά χρησιμοποιούνται για να αξιολογείται η πορεία σου και να προσαρμόζεται η καθοδήγηση όπου χρειάζεται.

## 6. Πληρωμές και ψηφιακή πρόσβαση
Όταν αγοράζεις ή συμμετέχεις σε ψηφιακό coaching πρόγραμμα, η πρόσβαση παρέχεται μέσω της πλατφόρμας και των σχετικών υπηρεσιών υποστήριξης. Εάν ισχύουν ειδικοί εμπορικοί όροι, αυτοί μπορεί να καθορίζονται στην προσφορά, στη σελίδα πληρωμής ή στη συμφωνία του προγράμματός σου.

## 7. Ορθή χρήση και σεβασμός
Η πλατφόρμα πρέπει να χρησιμοποιείται με σεβασμό προς τον coach, την ομάδα και τα υπόλοιπα μέλη. Δεν επιτρέπεται καταχρηστική, προσβλητική, παραπλανητική ή επιβλαβής χρήση της υπηρεσίας, ούτε αντιγραφή ή αναπαραγωγή του υλικού χωρίς άδεια.

## 8. Ποια δεδομένα μπορεί να συλλέγονται
Για τη λειτουργία του coaching προγράμματος, μπορεί να γίνεται επεξεργασία κατηγοριών δεδομένων όπως:

- στοιχεία λογαριασμού και επικοινωνίας,
- στοιχεία συμμετοχής στο πρόγραμμα,
- μετρήσεις, check-ins και δεδομένα προόδου,
- μηνύματα και σημειώσεις coaching,
- αρχεία ή φωτογραφίες που ανεβάζεις,
- στοιχεία που σχετίζονται με τη διαχείριση της υπηρεσίας και, όπου χρειάζεται, πληρωμών.

## 9. Γιατί χρησιμοποιούνται τα δεδομένα σου
Τα δεδομένα χρησιμοποιούνται ώστε να:

- λειτουργεί ο λογαριασμός σου,
- παρέχεται το coaching πρόγραμμα,
- παρακολουθείται η πρόοδός σου,
- γίνονται προσαρμογές στις οδηγίες και στο περιεχόμενο,
- υπάρχει επικοινωνία και υποστήριξη,
- προστατεύεται η σωστή λειτουργία της υπηρεσίας.

## 10. Αποθήκευση, ασφάλεια και πρόσβαση
Η πλατφόρμα έχει σχεδιαστεί με χρήση επαγγελματικής φιλοξενίας και τεχνικών μέτρων που βοηθούν στην ασφαλή διαχείριση των δεδομένων. Η πρόσβαση στα στοιχεία σου περιορίζεται στο βαθμό που απαιτείται για την παροχή της υπηρεσίας και τη σωστή λειτουργία της πλατφόρμας.

Όπου είναι κατάλληλο, χρησιμοποιείται ευρωπαϊκή υποδομή φιλοξενίας και πρακτικές ευθυγραμμισμένες με τις απαιτήσεις προστασίας προσωπικών δεδομένων. Παρ' όλα αυτά, καμία ψηφιακή υπηρεσία δεν πρέπει να παρουσιάζεται ως απόλυτα άτρωτη και για αυτό εφαρμόζεται πρακτική λογικής και αναλογικής προστασίας των δεδομένων.

## 11. Συνεργαζόμενοι πάροχοι υπηρεσιών
Για να λειτουργεί σωστά η υπηρεσία, μπορεί να χρησιμοποιούνται επιλεγμένοι τρίτοι πάροχοι, όπως υποδομή φιλοξενίας/βάσης δεδομένων, αποστολή email, πληρωμές, προγραμματισμός κλήσεων, επικοινωνία ή άλλες τεχνικές λειτουργίες που σχετίζονται με το coaching. Οι πάροχοι αυτοί χρησιμοποιούνται μόνο στο μέτρο που απαιτείται για τη λειτουργία της υπηρεσίας.

## 12. Τα δικαιώματά σου
Μπορείς να επικοινωνήσεις για αιτήματα σχετικά με τα προσωπικά σου δεδομένα, όπως:

- πρόσβαση,
- διόρθωση,
- ενημέρωση,
- διαγραφή όπου είναι εφικτό,
- απορίες για τον τρόπο χρήσης των δεδομένων σου.

Email επικοινωνίας για θέματα δεδομένων και απορρήτου:
**info@thegreekcarnivore.com**

Υπεύθυνος για τη λειτουργία της υπηρεσίας:
**Alexandros The Greek Carnivore**

## 13. Ενημερώσεις του παρόντος εγγράφου
Το παρόν έγγραφο μπορεί να ενημερώνεται όταν αλλάζουν οι υπηρεσίες, οι διαδικασίες ή οι τεχνικές λειτουργίες της πλατφόρμας. Εάν γίνει ουσιαστική αλλαγή, η νέα έκδοση θα παρουσιαστεί μέσα στην εφαρμογή πριν συνεχίσεις κανονικά.

## 14. Δήλωση αποδοχής
Υπογράφοντας παρακάτω, επιβεβαιώνεις ότι:

- διάβασες το παρόν έγγραφο,
- κατανοείς πώς λειτουργεί το πρόγραμμα και η πλατφόρμα,
- αποδέχεσαι τους όρους συνεργασίας και χρήσης,
- ενημερώθηκες για τον τρόπο με τον οποίο χρησιμοποιούνται τα δεδομένα σου στο πλαίσιο της υπηρεσίας.

_Όταν ολοκληρώσεις την υπογραφή, ανοίγει κανονικά το coaching dashboard σου._`;

const POLICY_EN = `# Coaching Terms, Platform Use & Data Notice
**Alexandros The Greek Carnivore**

Welcome to the coaching platform of **Alexandros The Greek Carnivore**. This document explains in clear language how the program works, what is expected from you, and how your personal data may be used so that you can continue with clarity and confidence.

---

## 1. Purpose of the platform
This platform supports your coaching experience. It is where you may view your plan, complete check-ins, record measurements, upload progress photos, receive guidance, and communicate with your coach.

## 2. How the coaching program works
The program provides structured guidance around nutrition, daily execution, progress tracking, and accountability support. Tasks, forms, messages, weekly or periodic reviews, and program materials are all part of the coaching experience.

## 3. What is expected from you
By using the platform, you agree that you will:

- provide accurate and up-to-date information,
- complete check-ins, measurements, and related entries honestly,
- use the platform respectfully,
- keep your login credentials secure,
- use the program as a coaching tool and not as a substitute for medical care.

## 4. Medical disclaimer
This program does not provide medical diagnosis or medical treatment. The guidance, content, and support provided through the platform are educational and coaching-based in nature. Before making significant changes to your diet, exercise, or health-related routines, you are responsible for consulting your physician or the appropriate healthcare professional.

## 5. Measurements, check-ins, and progress photos
To keep the coaching process meaningful, you may be asked to submit:

- body measurements,
- daily or weekly check-ins,
- progress photos,
- details related to your progress, symptoms, energy, or implementation of the plan.

These are used to review your progress and adjust guidance where needed.

## 6. Payments and digital access
When you purchase or participate in a digital coaching program, access is delivered through the platform and related support services. If specific commercial terms apply, they may be set out in your offer, checkout page, or program agreement.

## 7. Proper use and respectful conduct
The platform must be used respectfully toward the coach, the team, and other members. Abusive, misleading, harmful, or improper use of the service is not allowed. Program material may not be copied or redistributed without permission.

## 8. What data may be processed
In order to operate the coaching service, the platform may process categories of data such as:

- account and contact information,
- program participation information,
- measurements, check-ins, and progress data,
- coaching messages and notes,
- files or photos you upload,
- service-management and, where relevant, payment-related information.

## 9. Why your data is used
Your data may be used to:

- operate your account,
- deliver the coaching service,
- review your progress,
- adapt guidance and content,
- provide communication and support,
- protect the proper operation of the platform.

## 10. Storage, security, and access
The platform is designed using professional hosting and technical measures that support secure handling of data. Access to your information is limited to what is reasonably necessary to deliver the service and operate the platform correctly.

Where appropriate, European-hosted infrastructure and data-protection-aligned practices are used. At the same time, no digital service should be described as absolutely immune to risk, so data handling is approached with reasonable and proportionate safeguards.

## 11. Service providers
Selected third-party providers may be used to operate the service properly, including infrastructure/database hosting, email delivery, payments, call scheduling, communication, or other technical service functions related to the coaching experience. These providers are used only to the extent necessary to run the service.

## 12. Your data rights
You may contact us regarding your personal data for requests such as:

- access,
- correction,
- update,
- deletion where applicable,
- questions about how your data is used.

Privacy and data contact email:
**info@thegreekcarnivore.com**

Responsible identity for the service:
**Alexandros The Greek Carnivore**

## 13. Updates to this document
This document may be updated when services, processes, or technical platform features change. If a material change is made, the new version will be presented in the app before you continue as normal.

## 14. Acceptance
By signing below, you confirm that:

- you have read this document,
- you understand how the program and platform work,
- you accept the coaching and usage terms,
- you have been informed about how your data may be used within the service.

_Once your signature is saved, your coaching dashboard will open normally._`;

const PolicySigningGate = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin } = useAuth();
  const [hasSigned, setHasSigned] = useState<boolean | null>(null);
  const [docLang, setDocLang] = useState<"el" | "en">("el");
  const [fullName, setFullName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || isAdmin) {
      setHasSigned(true);
      return;
    }
    void checkSignature();
  }, [user, isAdmin]);

  const checkSignature = async () => {
    const { data } = await supabase
      .from("policy_signatures")
      .select("id")
      .eq("user_id", user!.id)
      .eq("policy_version", POLICY_VERSION)
      .limit(1);
    setHasSigned(!!(data && data.length > 0));
  };

  const handleSign = async () => {
    if (!fullName.trim() || !signatureDataUrl) {
      toast({
        title: docLang === "el" ? "Συμπληρώστε όλα τα πεδία" : "Please complete all fields",
        description: docLang === "el" ? "Γράψτε το ονοματεπώνυμό σας και υπογράψτε" : "Type your full name and draw your signature",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const blob = await fetch(signatureDataUrl).then((response) => response.blob());
    const path = `${user!.id}/policy/${POLICY_VERSION}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("signatures")
      .upload(path, blob, { contentType: "image/png" });

    if (uploadError) {
      toast({
        title: docLang === "el" ? "Αποτυχία αποθήκευσης" : "Save failed",
        description: uploadError.message,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("policy_signatures").insert({
      user_id: user!.id,
      policy_version: POLICY_VERSION,
      full_name: fullName.trim(),
      signature_url: path,
    });

    setSaving(false);

    if (error) {
      toast({
        title: docLang === "el" ? "Σφάλμα" : "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: docLang === "el" ? "Η υπογραφή αποθηκεύτηκε" : "Signature saved",
      description: docLang === "el"
        ? "Η πρόσβασή σου ολοκληρώθηκε και το dashboard ανοίγει κανονικά."
        : "Your access is complete and the dashboard will open normally.",
    });
    setHasSigned(true);
  };

  if (hasSigned === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (hasSigned) return <>{children}</>;

  const policyText = docLang === "el" ? POLICY_EL : POLICY_EN;
  const introPoints = [
    {
      icon: Sparkles,
      title: docLang === "el" ? "Τελευταίο βήμα πριν μπεις" : "Final step before entry",
      body: docLang === "el"
        ? "Διαβάζεις το έγγραφο μία φορά, υπογράφεις και μετά ανοίγει κανονικά ο λογαριασμός σου."
        : "Review the document once, sign it, and your account opens normally.",
    },
    {
      icon: ShieldCheck,
      title: docLang === "el" ? "Όροι + δεδομένα σε ένα σημείο" : "Terms + data in one place",
      body: docLang === "el"
        ? "Το έγγραφο εξηγεί πώς δουλεύει το coaching και πώς χρησιμοποιούνται τα δεδομένα σου μέσα στην υπηρεσία."
        : "The document explains how the coaching works and how your data may be used in the service.",
    },
    {
      icon: FileSignature,
      title: docLang === "el" ? "Καθαρή αποδοχή" : "Clear acceptance",
      body: docLang === "el"
        ? "Γράφεις το ονοματεπώνυμό σου, προσθέτεις υπογραφή και συνεχίζεις χωρίς άλλο εμπόδιο."
        : "Type your full name, add your signature, and continue without another blocker.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      <div className="border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">
              <Sparkles className="h-3 w-3" />
              {docLang === "el" ? "Τελικό setup" : "Final setup"}
            </div>
            <div className="space-y-1">
              <h1 className="font-serif text-2xl font-semibold text-foreground sm:text-3xl">
                {docLang === "el" ? "Διαβάζεις και υπογράφεις πριν συνεχίσεις" : "Review and sign before continuing"}
              </h1>
              <p className="max-w-3xl font-sans text-sm leading-relaxed text-muted-foreground sm:text-base">
                {docLang === "el"
                  ? "Το έγγραφο αυτό συγκεντρώνει τους όρους του coaching προγράμματος και τον τρόπο με τον οποίο χρησιμοποιούνται τα δεδομένα σου μέσα στην πλατφόρμα."
                  : "This document brings together the coaching program terms and how your data may be used within the platform."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-border/70 bg-card px-3 py-2 text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                {docLang === "el" ? "Βήμα 1/1" : "Step 1/1"}
              </p>
              <p className="text-xs text-muted-foreground">
                {docLang === "el" ? "Διαβάζεις, υπογράφεις, συνεχίζεις" : "Read, sign, continue"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDocLang((current) => (current === "el" ? "en" : "el"))}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
            >
              <Globe className="h-4 w-4" />
              {docLang === "el" ? "English" : "Ελληνικά"}
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 sm:px-6">
        <div className="mx-auto grid h-full w-full max-w-7xl gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,420px)]">
          <div className="flex min-h-0 flex-col rounded-[2rem] border border-border/70 bg-card/80 shadow-sm">
            <div className="border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="grid gap-3 md:grid-cols-3">
                {introPoints.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-[1.25rem] border border-border/60 bg-background/70 p-4">
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
                <div
                  className="prose prose-sm max-w-none font-sans text-foreground
                  prose-headings:font-serif prose-headings:text-foreground
                  prose-h1:mb-5 prose-h1:text-3xl
                  prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-xl
                  prose-p:text-base prose-p:leading-8 prose-p:text-muted-foreground
                  prose-li:text-base prose-li:leading-8 prose-li:text-muted-foreground
                  prose-strong:text-foreground
                  prose-hr:border-border"
                >
                  <ReactMarkdown>{policyText}</ReactMarkdown>
                </div>
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0">
            <div className="flex h-full flex-col rounded-[2rem] border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/70 px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                  {docLang === "el" ? "Αποδοχή & Υπογραφή" : "Acceptance & Signature"}
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">
                  {docLang === "el" ? "Ολοκλήρωσε την πρόσβασή σου" : "Complete your access"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {docLang === "el"
                    ? "Δήλωσε ότι διάβασες τους όρους, αποδέχεσαι το πλαίσιο συνεργασίας και ενημερώθηκες για τη χρήση των δεδομένων σου."
                    : "Confirm that you reviewed the terms, accept the coaching framework, and were informed about how your data may be used."}
                </p>
              </div>

              <div className="flex-1 space-y-5 px-5 py-5">
                <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
                    {docLang === "el" ? "Πριν υπογράψεις" : "Before you sign"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {docLang === "el"
                      ? "Ανέβασε μέχρι το τέλος του εγγράφου, βεβαιώσου ότι το έχεις διαβάσει και μετά συμπλήρωσε το ονοματεπώνυμο και την υπογραφή σου."
                      : "Review the agreement fully, then complete your full name and signature below."}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    {docLang === "el" ? "Ονοματεπώνυμο" : "Full name"}
                  </Label>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={docLang === "el" ? "Γράψε το ονοματεπώνυμό σου όπως θέλεις να εμφανίζεται" : "Type your full name as you want it recorded"}
                    className="h-12 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">
                    {docLang === "el" ? "Υπογραφή" : "Signature"}
                  </Label>
                  <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-3">
                    <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {docLang === "el"
                      ? "Η υπογραφή αποθηκεύεται ως αποδεικτικό αποδοχής του παρόντος εγγράφου."
                      : "Your signature is stored as evidence that you accepted this document."}
                  </p>
                </div>
              </div>

              <div className="border-t border-border/70 px-5 py-5">
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={saving || !fullName.trim() || !signatureDataUrl}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? (
                    docLang === "el" ? "Αποθήκευση..." : "Saving..."
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {docLang === "el" ? "Συμφωνώ και υπογράφω" : "I agree and sign"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicySigningGate;
