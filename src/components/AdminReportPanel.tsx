import { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, ThumbsUp, Pencil, Loader2, RotateCcw, CalendarDays, MessageSquare, ArrowLeft, Send, History, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

interface AdminReportPanelProps {
  userId: string;
}

type ReportMode = "weekly" | "overall" | "custom" | null;

const AdminReportPanel = ({ userId }: AdminReportPanelProps) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [report, setReport] = useState<string | null>(null);
  const [clientMessage, setClientMessage] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackScope, setFeedbackScope] = useState<"client" | "global">("client");
  const [accepted, setAccepted] = useState(false);
  const [previousFeedbacks, setPreviousFeedbacks] = useState<string[]>([]);
  const [mode, setMode] = useState<ReportMode>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [viewingPastReport, setViewingPastReport] = useState<any | null>(null);

  useEffect(() => {
    fetchPastReports();
  }, [userId]);

  const fetchPastReports = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("report_feedback" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("is_accepted", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setPastReports((data as any[]) || []);
    } catch (e) {
      console.error("Failed to fetch past reports:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleModeGenerate = (selectedMode: "weekly" | "overall" | "custom") => {
    setMode(selectedMode);
    generateReport(undefined, selectedMode);
  };

  const generateReport = async (feedback?: string, overrideMode?: ReportMode) => {
    const activeMode = overrideMode || mode || "overall";
    setLoading(true);
    setAccepted(false);
    setShowFeedback(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            userId,
            feedback: feedback || undefined,
            previousReport: feedback ? report : undefined,
            mode: activeMode,
            customQuestion: activeMode === "custom" ? customQuestion : undefined,
            lang,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate report");
      }

      const data = await response.json();
      setReport(data.report);
      setClientMessage(data.clientMessage || "");
      if (feedback) {
        setPreviousFeedbacks(prev => [...prev, feedback]);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!report || !user) return;
    try {
      const { data: feedbackRow, error } = await supabase
        .from("report_feedback" as any)
        .insert({
          user_id: userId,
          admin_id: user.id,
          report_content: report,
          is_accepted: true,
          scope: "client",
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (previousFeedbacks.length > 0) {
        const lastFeedback = previousFeedbacks[previousFeedbacks.length - 1];
        await supabase.from("report_instructions" as any).insert({
          scope: feedbackScope,
          user_id: feedbackScope === "client" ? userId : null,
          instruction: lastFeedback,
          source_feedback_id: (feedbackRow as any)?.id || null,
        } as any);
      }

      setAccepted(true);
      fetchPastReports();
      toast.success(lang === "en" ? "Report accepted and saved" : "Η αναφορά αποδέχθηκε και αποθηκεύτηκε");
    } catch (e: any) {
      toast.error(e.message || "Failed to save report");
    }
  };

  const handleRequestChanges = () => {
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;

    if (user) {
      try {
        await supabase.from("report_feedback" as any).insert({
          user_id: userId,
          admin_id: user.id,
          report_content: report || "",
          feedback: feedbackText,
          is_accepted: false,
          scope: feedbackScope,
        } as any);
      } catch (e) {
        console.error("Failed to save feedback:", e);
      }
    }

    await generateReport(feedbackText);
    setFeedbackText("");
  };

  const resetToModeSelection = () => {
    setReport(null);
    setClientMessage("");
    setCopied(false);
    setAccepted(false);
    setPreviousFeedbacks([]);
    setMode(null);
    setCustomQuestion("");
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(clientMessage);
      setCopied(true);
      toast.success(lang === "en" ? "Message copied!" : "Το μήνυμα αντιγράφηκε!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Viewing a past report
  if (viewingPastReport) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                {lang === "en" ? "Past Report" : "Παλαιότερη Αναφορά"}
                <span className="text-xs font-sans font-normal text-muted-foreground ml-2">
                  {format(new Date(viewingPastReport.created_at), "MMM d, yyyy · HH:mm")}
                </span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setViewingPastReport(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                {lang === "en" ? "Back" : "Πίσω"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert font-sans">
              <ReactMarkdown>{viewingPastReport.report_content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mode selection screen
  if (!report && !loading && mode === null) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Card
            className="cursor-pointer border-amber-500/30 hover:border-amber-500/60 transition-colors"
            onClick={(e) => { e.stopPropagation(); handleModeGenerate("weekly"); }}
          >
            <CardContent className="flex items-center gap-3 p-3">
              <div className="h-9 w-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-xs font-semibold">
                  {lang === "en" ? "Weekly Check-in" : "Εβδομαδιαίος Έλεγχος"}
                </h3>
                <p className="text-[10px] text-muted-foreground font-sans">
                  {lang === "en" ? "Last 7 days" : "Τελευταίες 7 μέρες"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-primary/30 hover:border-primary/60 transition-colors"
            onClick={(e) => { e.stopPropagation(); handleModeGenerate("overall"); }}
          >
            <CardContent className="flex items-center gap-3 p-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif text-xs font-semibold">
                  {lang === "en" ? "Overall Report" : "Συνολική Αναφορά"}
                </h3>
                <p className="text-[10px] text-muted-foreground font-sans">
                  {lang === "en" ? "Full analysis" : "Πλήρης ανάλυση"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-muted-foreground/20">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-serif text-xs font-semibold">
                {lang === "en" ? "Ask Something Specific" : "Ρωτήστε κάτι συγκεκριμένο"}
              </h3>
            </div>
            <Textarea
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder={
                lang === "en"
                  ? "e.g. 'How is their protein intake trending?'"
                  : "π.χ. 'Πώς εξελίσσεται η πρόσληψη πρωτεΐνης;'"
              }
              className="min-h-[60px] text-xs"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!customQuestion.trim()}
                onClick={() => handleModeGenerate("custom")}
              >
                <Send className="h-3 w-3 mr-1" />
                {lang === "en" ? "Ask" : "Ρωτήστε"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Past Reports History */}
        {pastReports.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-serif flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                {lang === "en" ? "Previous Reports" : "Προηγούμενες Αναφορές"}
                <span className="text-xs font-sans font-normal text-muted-foreground">
                  ({pastReports.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pastReports.map((pr: any) => {
                const isExpanded = expandedReportId === pr.id;
                const preview = pr.report_content?.slice(0, 150) || "";
                return (
                  <div
                    key={pr.id}
                    className="border rounded-md p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setViewingPastReport(pr)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium font-sans">
                          {format(new Date(pr.created_at), "MMM d, yyyy · HH:mm")}
                        </p>
                        <p className="text-xs text-muted-foreground font-sans truncate mt-0.5">
                          {preview.replace(/[#*]/g, "").trim()}...
                        </p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {loadingHistory && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground font-sans text-sm">
              {mode === "weekly"
                ? (lang === "en" ? "Analyzing last 7 days..." : "Ανάλυση τελευταίων 7 ημερών...")
                : mode === "custom"
                ? (lang === "en" ? "Analyzing your question..." : "Ανάλυση του ερωτήματός σας...")
                : (lang === "en" ? "Analyzing client data..." : "Ανάλυση δεδομένων πελάτη...")}
            </p>
          </CardContent>
        </Card>
      )}

      {report && !loading && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  {mode === "weekly" ? <CalendarDays className="h-5 w-5 text-amber-500" /> :
                   mode === "custom" ? <MessageSquare className="h-5 w-5" /> :
                   <FileText className="h-5 w-5" />}
                  {mode === "weekly"
                    ? (lang === "en" ? "Weekly Check-in" : "Εβδομαδιαίος Έλεγχος")
                    : mode === "custom"
                    ? (lang === "en" ? "Custom Analysis" : "Προσαρμοσμένη Ανάλυση")
                    : (lang === "en" ? "Client Report" : "Αναφορά Πελάτη")}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={resetToModeSelection}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {lang === "en" ? "Back" : "Πίσω"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert font-sans">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Client Message - Copy-paste for messaging */}
          {clientMessage && (
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-serif flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    {lang === "en" ? "Message for Client" : "Μήνυμα για τον Πελάτη"}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyMessage}
                    className="gap-1.5"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied
                      ? (lang === "en" ? "Copied!" : "Αντιγράφηκε!")
                      : (lang === "en" ? "Copy" : "Αντιγραφή")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-3 text-sm font-sans whitespace-pre-wrap leading-relaxed">
                  {clientMessage}
                </div>
              </CardContent>
            </Card>
          )}

          {!accepted && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button onClick={handleAccept} variant="default" className="flex-1">
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  {lang === "en" ? "Accept Report" : "Αποδοχή Αναφοράς"}
                </Button>
                <Button onClick={handleRequestChanges} variant="outline" className="flex-1">
                  <Pencil className="h-4 w-4 mr-2" />
                  {lang === "en" ? "Request Changes" : "Αίτημα Αλλαγών"}
                </Button>
              </div>

              {showFeedback && (
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <Textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={
                        lang === "en"
                          ? "Describe what should change..."
                          : "Περιγράψτε τι πρέπει να αλλάξει..."
                      }
                      className="min-h-[100px]"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={feedbackScope === "global"}
                          onCheckedChange={(v) => setFeedbackScope(v ? "global" : "client")}
                        />
                        <Label className="text-xs text-muted-foreground font-sans">
                          {feedbackScope === "global"
                            ? (lang === "en" ? "Apply to all clients" : "Εφαρμογή σε όλους τους πελάτες")
                            : (lang === "en" ? "This client only" : "Μόνο αυτός ο πελάτης")}
                        </Label>
                      </div>
                      <Button
                        onClick={handleSubmitFeedback}
                        disabled={!feedbackText.trim()}
                        size="sm"
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {lang === "en" ? "Regenerate" : "Αναδημιουργία"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {accepted && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground font-sans mb-3">
                {lang === "en" ? "Report accepted ✓" : "Η αναφορά αποδέχθηκε ✓"}
              </p>
              <Button variant="outline" size="sm" onClick={resetToModeSelection}>
                {lang === "en" ? "Generate New Report" : "Νέα Αναφορά"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminReportPanel;
