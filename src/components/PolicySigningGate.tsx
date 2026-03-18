import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import SignatureCanvas from "@/components/onboarding/SignatureCanvas";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, Globe, ShieldCheck, FileSignature, Sparkles } from "lucide-react";

const POLICY_VERSION = "1.0";

const POLICY_EL = `# Πολιτικές & Διαδικασίες
**Alexandros The Greek Carnivore**

Έγγραφο Πολιτικής και Διαδικασιών για την Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης "The Greek Carnivore"

---

## 1. Εισαγωγή
Καλώς ήρθατε στην Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης, η οποία λειτουργεί διαδικτυακά στην Ελλάδα. Το παρόν έγγραφο πολιτικής και διαδικασιών καθορίζει τις κατευθυντήριες γραμμές και τους όρους χρήσης της πλατφόρμας μας. Χρησιμοποιώντας τις υπηρεσίες μας, αποδέχεστε να συμμορφώνεστε με αυτές τις πολιτικές και διαδικασίες.

## 2. Χωρίς Ιατρικές Συμβουλές
Η Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης μας έχει σχεδιαστεί για να παρέχει γενικές πληροφορίες και πόρους σχετικά με τη διατροφή και την άσκηση. Δεν παρέχουμε ιατρικές συμβουλές και αυτές οι πληροφορίες δεν αντικαθιστούν καμία τρέχουσα θεραπεία. Το περιεχόμενο που διατίθεται στην πλατφόρμα μας είναι μόνο για ενημερωτικούς σκοπούς και δεν πρέπει να θεωρείται υποκατάστατο για επαγγελματική ιατρική συμβουλή, διάγνωση ή θεραπεία.

## 3. Συμβουλή με τον Προσωπικό σας Ιατρό
Πριν ξεκινήσετε οποιοδήποτε νέο πρόγραμμα διατροφής ή άσκησης, συνιστούμε να συμβουλευτείτε τον προσωπικό σας ιατρό. Κάθε άτομο έχει μοναδικές ανάγκες υγείας, και η συμβουλή ενός επαγγελματία υγείας μπορεί να σας βοηθήσει να εξασφαλίσετε ότι το πρόγραμμα είναι κατάλληλο για εσάς. Η ομάδα και η πλατφόρμα μας δεν φέρουν ευθύνη για οποιαδήποτε θέματα υγείας που μπορεί να προκύψουν πριν, κατά τη διάρκεια, ή μετά τη χρήση των υπηρεσιών μας. Εάν δεν παρατηρήσετε βελτίωση ή αντιμετωπίζετε δυσκολίες, προτείνουμε να αναζητήσετε επαγγελματική ιατρική καθοδήγηση.

## 4. Χωρίς Επιστροφές
Δεδομένου ότι η Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης μας προσφέρει ψηφιακά προϊόντα και υπηρεσίες, δεν παρέχουμε επιστροφές, αποζημιώσεις ή ανταλλαγές. Μόλις αγοραστεί μια συνδρομή, θεωρείται οριστική.

## 5. Αποτελέσματα και Ευθύνη
Αναγνωρίζουμε ότι τα ατομικά αποτελέσματα από τη χρήση της Υπηρεσίας Διαδικτυακής Διατροφής και Άσκησης μας ενδέχεται να διαφέρουν. Δεν εγγυόμαστε συγκεκριμένα αποτελέσματα, απώλεια βάρους ή επιτεύγματα φυσικής κατάστασης. Είναι σημαντικό να αναγνωρίσετε ότι η επίτευξη στόχων υγείας και φυσικής κατάστασης εξαρτάται από διάφορους παράγοντες, όπως η δέσμευση του ατόμου, η τήρηση του προγράμματος και η συνολική κατάσταση της υγείας του.

## 6. Ευθύνη Χρήστη
Χρησιμοποιώντας την υπηρεσία μας, οι χρήστες συμφωνούν με τις παρακάτω ευθύνες:

- **Ακριβείς Πληροφορίες:** Οι χρήστες πρέπει να παρέχουν ακριβείς και ενημερωμένες πληροφορίες κατά την εγγραφή και τη χρήση της εφαρμογής.
- **Συμμόρφωση:** Οι χρήστες πρέπει να συμμορφώνονται με όλους τους ισχύοντες νόμους και κανονισμούς κατά τη χρήση της πλατφόρμας.
- **Προσωπική Ασφάλεια:** Οι χρήστες είναι υπεύθυνοι για την ασφάλειά τους κατά τη διάρκεια οποιασδήποτε φυσικής δραστηριότητας που προτείνεται από την εφαρμογή και θα πρέπει να χρησιμοποιούν κατάλληλη προσοχή για να αποφύγουν τραυματισμούς.
- **Σεβαστή Συμπεριφορά:** Οι χρήστες αναμένεται να διατηρούν ένα σεβαστό και θετικό περιβάλλον εντός της εφαρμογής, αποφεύγοντας οποιαδήποτε προσβλητική, καταχρηστική ή επιβλαβή συμπεριφορά προς άλλα μέλη ή το προσωπικό.

## 7. Περιορισμοί Ηλικίας
Η Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης μας απευθύνεται σε άτομα ηλικίας 18 ετών και άνω. Εάν είστε κάτω των 18 ετών, πρέπει να λάβετε τη συγκατάθεση και την επίβλεψη των γονέων σας για να χρησιμοποιήσετε την πλατφόρμα μας.

## 8. Πνευματική Ιδιοκτησία
Όλο το περιεχόμενο, τα υλικά και η πνευματική ιδιοκτησία που παρέχονται στην πλατφόρμα μας προστατεύονται από πνευματικά δικαιώματα και άλλους ισχύοντες νόμους. Οι χρήστες δεν επιτρέπεται να αναπαράγουν, να διανέμουν ή να χρησιμοποιούν οποιοδήποτε περιεχόμενο χωρίς την ρητή άδειά μας.

## 9. Προστασία Προσωπικών Δεδομένων
Δίνουμε μεγάλη σημασία στην προστασία των προσωπικών δεδομένων και δεν θα μοιραστούμε τις προσωπικές σας πληροφορίες εκτός εάν απαιτείται από το νόμο.

## 10. Τροποποίηση Πολιτικών
Διατηρούμε το δικαίωμα να τροποποιήσουμε αυτές τις πολιτικές και διαδικασίες ανά πάσα στιγμή. Οποιεσδήποτε αλλαγές θα κοινοποιούνται μέσω της εφαρμογής ή μέσω email.

## 11. Φωτογραφίες Προόδου
Παρακαλώ ανεβάστε αμέσως μια φωτογραφία από μπροστά, από το πλάι και από πίσω μόλις αποκτήσετε πρόσβαση στην εφαρμογή προπόνησής σας. Αθλητικό σουτιέν, φανελάκι ή σορτς. Όχι εσώρουχα, αυτό είναι απαραίτητο και θα χρειαστεί να ανεβάζετε φωτογραφίες και στατιστικά στοιχεία κάθε εβδομάδα για να παραμένετε σε τροχιά.

---

Χρησιμοποιώντας την Υπηρεσία Διαδικτυακής Διατροφής και Άσκησης μας, αναγνωρίζετε ότι έχετε διαβάσει, κατανοήσει και συμφωνείτε να συμμορφωθείτε με αυτές τις πολιτικές και διαδικασίες. Εάν δεν συμφωνείτε με οποιοδήποτε μέρος αυτού του εγγράφου, θα πρέπει να αποφύγετε τη χρήση της πλατφόρμας μας.

Εάν έχετε οποιεσδήποτε ερωτήσεις ή ανησυχίες σχετικά με τις πολιτικές και τις διαδικασίες μας, παρακαλούμε επικοινωνήστε με την ομάδα υποστήριξης στη διεύθυνση: **thegreekcarnivore@gmail.com**

**Αλέξανδρος The Greek Carnivore**

*Παρακαλούμε υπογράψτε παρακάτω για να δηλώσετε ότι συμφωνείτε με τους όρους χρήσης. Αφού ολοκληρώσετε, κάντε κλικ στο κουμπί «Αποθήκευση» για να αποθηκεύσετε το έγγραφο.*`;

const POLICY_EN = `# Policies & Procedures
**Alexandros The Greek Carnivore**

Policy and Procedures Document for the Online Nutrition and Exercise Service "The Greek Carnivore"

---

## 1. Introduction
Welcome to the Online Nutrition and Exercise Service, which operates online in Greece. This policy and procedures document sets out the guidelines and terms of use for our platform. By using our services, you agree to comply with these policies and procedures.

## 2. No Medical Advice
Our Online Nutrition and Exercise Service is designed to provide general information and resources related to nutrition and exercise. We do not provide medical advice and this information does not replace any current treatment. The content available on our platform is for informational purposes only and should not be considered a substitute for professional medical advice, diagnosis, or treatment.

## 3. Consult Your Personal Physician
Before starting any new nutrition or exercise program, we recommend consulting your personal physician. Each individual has unique health needs, and the advice of a healthcare professional can help ensure that the program is right for you. Our team and platform bear no responsibility for any health issues that may arise before, during, or after using our services. If you do not notice improvement or experience difficulties, we recommend seeking professional medical guidance.

## 4. No Refunds
Since our Online Nutrition and Exercise Service offers digital products and services, we do not provide refunds, reimbursements, or exchanges. Once a subscription is purchased, it is considered final.

## 5. Results and Liability
We acknowledge that individual results from using our Online Nutrition and Exercise Service may vary. We do not guarantee specific results, weight loss, or fitness achievements. It is important to recognize that achieving health and fitness goals depends on various factors, including individual commitment, adherence to the program, and overall health status.

## 6. User Responsibility
By using our service, users agree to the following responsibilities:

- **Accurate Information:** Users must provide accurate and up-to-date information during registration and use of the application.
- **Compliance:** Users must comply with all applicable laws and regulations when using the platform.
- **Personal Safety:** Users are responsible for their safety during any physical activity suggested by the application and should exercise appropriate caution to avoid injuries.
- **Respectful Behavior:** Users are expected to maintain a respectful and positive environment within the application, avoiding any offensive, abusive, or harmful behavior towards other members or staff.

## 7. Age Restrictions
Our Online Nutrition and Exercise Service is intended for individuals aged 18 and over. If you are under 18, you must obtain parental consent and supervision to use our platform.

## 8. Intellectual Property
All content, materials, and intellectual property provided on our platform are protected by copyright and other applicable laws. Users may not reproduce, distribute, or use any content without our express permission.

## 9. Privacy Protection
We place great importance on the protection of personal data and will not share your personal information unless required by law.

## 10. Policy Modifications
We reserve the right to modify these policies and procedures at any time. Any changes will be communicated through the application or via email.

## 11. Progress Photos
Please immediately upload a photo from the front, side, and back once you gain access to your training application. Sports bra, tank top, or shorts. No underwear — this is mandatory and you will need to upload photos and statistics every week to stay on track.

---

By using our Online Nutrition and Exercise Service, you acknowledge that you have read, understood, and agree to comply with these policies and procedures. If you do not agree with any part of this document, you should refrain from using our platform.

If you have any questions or concerns about our policies and procedures, please contact the support team at: **thegreekcarnivore@gmail.com**

**Alexandros The Greek Carnivore**

*Please sign below to indicate that you agree to the terms of use. Once completed, click the "Save" button to save the document.*`;

const PolicySigningGate = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const [hasSigned, setHasSigned] = useState<boolean | null>(null);
  const [docLang, setDocLang] = useState<"el" | "en">(lang === "el" ? "el" : "en");
  const [fullName, setFullName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || isAdmin) {
      setHasSigned(true);
      return;
    }
    checkSignature();
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

    // Upload signature
    const blob = await fetch(signatureDataUrl).then((r) => r.blob());
    const path = `${user!.id}/policy/${POLICY_VERSION}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });

    if (uploadError) {
      console.error("Signature upload failed:", uploadError);
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(path);

    const { error } = await supabase.from("policy_signatures").insert({
      user_id: user!.id,
      policy_version: POLICY_VERSION,
      full_name: fullName.trim(),
      signature_url: urlData.publicUrl,
    });

    setSaving(false);

    if (error) {
      console.error("Policy signature insert failed:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: docLang === "el" ? "Ευχαριστούμε!" : "Thank you!" });
    setHasSigned(true);
  };

  // Loading state
  if (hasSigned === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already signed — show the app
  if (hasSigned) return <>{children}</>;

  // Show the policy document
  const policyText = docLang === "el" ? POLICY_EL : POLICY_EN;
  const setupPoints = [
    {
      icon: ShieldCheck,
      title: docLang === "el" ? "Καθαρό πλαίσιο συνεργασίας" : "Clear coaching framework",
      body: docLang === "el"
        ? "Εξηγεί πώς δουλεύει το πρόγραμμα, τι περιμένουμε και πώς προστατεύεται η εμπειρία σου."
        : "Explains how the program works, what is expected, and how your coaching experience is protected.",
    },
    {
      icon: FileSignature,
      title: docLang === "el" ? "Ένα τελευταίο βήμα setup" : "One final setup step",
      body: docLang === "el"
        ? "Μόλις υπογράψεις, το dashboard και το υπόλοιπο onboarding ανοίγουν κανονικά."
        : "As soon as you sign, your dashboard and the rest of onboarding open normally.",
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-[10px] font-sans font-semibold uppercase tracking-[0.22em] text-gold">
              <Sparkles className="h-3 w-3" />
              {docLang === "el" ? "Τελικό setup" : "Final setup"}
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-foreground">
                {docLang === "el" ? "Ολοκλήρωσε την πρόσβασή σου" : "Complete your access setup"}
              </h1>
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                {docLang === "el"
                  ? "Αυτό είναι το τελευταίο βήμα πριν ανοίξει πλήρως το coaching dashboard σου."
                  : "This is the last step before your coaching dashboard opens fully."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-border/70 bg-card px-3 py-2 text-right sm:block">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
                {docLang === "el" ? "Βήμα 1/1" : "Step 1/1"}
              </p>
              <p className="font-sans text-xs text-muted-foreground">
                {docLang === "el" ? "Διαβάζεις, υπογράφεις, συνεχίζεις" : "Read, sign, continue"}
              </p>
            </div>
            <button
              onClick={() => setDocLang(docLang === "el" ? "en" : "el")}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              {docLang === "el" ? "English" : "Ελληνικά"}
            </button>
          </div>
        </div>
      </div>

      {/* Document content */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          {setupPoints.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-[1.5rem] border border-border/70 bg-card/80 p-4">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-serif text-lg font-semibold text-foreground">{title}</h2>
              <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
        <div className="prose prose-sm max-w-none font-sans text-foreground
          prose-headings:font-serif prose-headings:text-foreground
          prose-h1:text-xl prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
          prose-p:text-sm prose-p:leading-relaxed prose-p:text-muted-foreground
          prose-li:text-sm prose-li:text-muted-foreground
          prose-strong:text-foreground
          prose-hr:border-border
        ">
          <ReactMarkdown>{policyText}</ReactMarkdown>
        </div>
      </ScrollArea>

      {/* Signing area */}
      <div className="border-t border-border bg-card px-6 py-4 space-y-4">
        <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            {docLang === "el" ? "Πριν συνεχίσεις" : "Before you continue"}
          </p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-muted-foreground">
            {docLang === "el"
              ? "Διάβασε το έγγραφο, γράψε το ονοματεπώνυμό σου και πρόσθεσε την υπογραφή σου. Μόλις αποθηκευτεί, η εφαρμογή θα ανοίξει κανονικά."
              : "Review the document, type your full name, and add your signature. As soon as it is saved, the app will open normally."}
          </p>
        </div>
        <div>
          <Label className="font-sans text-xs">
            {docLang === "el" ? "Ονοματεπώνυμο" : "Full Legal Name"}
          </Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={docLang === "el" ? "Γράψτε το ονοματεπώνυμό σας..." : "Type your full name..."}
            className="text-sm"
          />
        </div>
        <div>
          <Label className="font-sans text-xs">
            {docLang === "el" ? "Υπογραφή" : "Signature"}
          </Label>
          <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
        </div>
        <button
          onClick={handleSign}
          disabled={saving || !fullName.trim() || !signatureDataUrl}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-semibold text-gold-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? (docLang === "el" ? "Αποθήκευση..." : "Saving...") : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {docLang === "el" ? "Συμφωνώ και υπογράφω" : "I agree and sign"}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PolicySigningGate;
