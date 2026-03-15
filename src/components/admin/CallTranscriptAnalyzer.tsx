import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Send, StickyNote, Check, User, Users, CheckCheck, History, ChevronDown, ChevronRight, Trash2, Copy, UserX } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Participant {
  user_id: string;
  email: string;
}

interface Summary {
  user_id: string;
  name: string;
  email: string;
  summary: string;
  is_admin: boolean;
  note_title: string;
  matched: boolean;
}

interface ClientProfile {
  id: string;
  email: string;
  display_name: string | null;
}

interface HistoryRecord {
  id: string;
  transcript: string;
  summaries: Summary[];
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callTitle: string;
  callId: string;
  participants: Participant[];
}

const CallTranscriptAnalyzer = ({ open, onOpenChange, callTitle, callId, participants }: Props) => {
  const { user } = useAuth();
  const [transcript, setTranscript] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [sentMessages, setSentMessages] = useState<Set<string>>(new Set());
  const [savedNotes, setSavedNotes] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  const [allProfiles, setAllProfiles] = useState<ClientProfile[]>([]);
  const [profileMap, setProfileMap] = useState<Map<number, string>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  // History state
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(null);
  const [loadedHistoryId, setLoadedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchProfiles();
      fetchHistory();
    }
  }, [open, callId]);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("approved", true)
      .order("email");
    if (data) setAllProfiles(data as ClientProfile[]);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("call_transcript_history" as any)
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: false });
    if (data) setHistory(data as unknown as HistoryRecord[]);
  };

  const saveToHistory = async (transcriptText: string, sums: Summary[]) => {
    if (!user) return;
    await supabase.from("call_transcript_history" as any).insert({
      call_id: callId,
      admin_id: user.id,
      transcript: transcriptText,
      summaries: sums as any,
    } as any);
    fetchHistory();
  };

  const deleteHistoryEntry = async (id: string) => {
    await supabase.from("call_transcript_history" as any).delete().eq("id", id);
    setHistory(prev => prev.filter(h => h.id !== id));
    if (expandedHistoryId === id) setExpandedHistoryId(null);
    if (expandedTranscriptId === id) setExpandedTranscriptId(null);
    if (loadedHistoryId === id) {
      setLoadedHistoryId(null);
      setSummaries([]);
    }
  };

  const loadFromHistory = (record: HistoryRecord) => {
    const sums = record.summaries as unknown as Summary[];
    setSummaries(sums);
    setTranscript(record.transcript);
    setSentMessages(new Set());
    setSavedNotes(new Set());
    setLoadedHistoryId(record.id);

    // Auto-match profiles
    const newMap = new Map<number, string>();
    const allSelected = new Set<number>();
    sums.forEach((s, idx) => {
      if (s.matched) {
        const match = allProfiles.find(p => p.id === s.user_id) ||
          allProfiles.find(p => p.email?.toLowerCase() === s.email?.toLowerCase());
        if (match) {
          newMap.set(idx, match.id);
          allSelected.add(idx);
        }
      }
    });
    setProfileMap(newMap);
    setSelected(allSelected);
  };

  const backToInput = () => {
    setSummaries([]);
    setTranscript("");
    setLoadedHistoryId(null);
    setSentMessages(new Set());
    setSavedNotes(new Set());
    setProfileMap(new Map());
    setSelected(new Set());
  };

  const analyze = async () => {
    if (!transcript.trim()) return;
    setAnalyzing(true);
    setSummaries([]);
    setSentMessages(new Set());
    setSavedNotes(new Set());
    setProfileMap(new Map());
    setSelected(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-call-transcript`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript,
          participants: [
            ...participants,
            { user_id: user?.id, email: user?.email },
          ],
          callTitle,
          adminEmail: user?.email,
          callId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const sums: Summary[] = data.summaries || [];
      setSummaries(sums);

      // Auto-save to history
      await saveToHistory(transcript, sums);

      // Auto-match profiles
      const newMap = new Map<number, string>();
      const allSelected = new Set<number>();
      sums.forEach((s, idx) => {
        if (s.matched) {
          const match = allProfiles.find(p => p.id === s.user_id) ||
            allProfiles.find(p => p.email?.toLowerCase() === s.email?.toLowerCase());
          if (match) {
            newMap.set(idx, match.id);
            allSelected.add(idx);
          }
        }
      });
      setProfileMap(newMap);
      setSelected(allSelected);

      toast({ title: "Transcript analyzed", description: `Generated ${sums.length} personalized summaries.` });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const getResolvedProfile = (idx: number): ClientProfile | null => {
    const profileId = profileMap.get(idx);
    if (!profileId) return null;
    return allProfiles.find(p => p.id === profileId) || null;
  };

  const copyToClipboard = async (idx: number) => {
    const s = summaries[idx];
    try {
      await navigator.clipboard.writeText(s.summary);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const sendMessage = async (idx: number) => {
    if (!user) return;
    const profile = getResolvedProfile(idx);
    if (!profile) return;
    const s = summaries[idx];
    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: profile.id,
        content: s.summary,
        is_automated: true,
      } as any);
      if (error) throw error;
      setSentMessages(prev => new Set(prev).add(String(idx)));
      toast({ title: `Message sent to ${profile.display_name || profile.email}` });
    } catch (e: any) {
      toast({ title: "Error sending", description: e.message, variant: "destructive" });
    }
  };

  const saveNote = async (idx: number) => {
    if (!user) return;
    const profile = getResolvedProfile(idx);
    if (!profile) return;
    const s = summaries[idx];
    try {
      const { error } = await supabase.from("client_notes" as any).insert({
        user_id: profile.id,
        created_by: user.id,
        category: "meeting_note",
        title: s.note_title || `Call: ${callTitle}`,
        content: s.summary,
      } as any);
      if (error) throw error;
      setSavedNotes(prev => new Set(prev).add(String(idx)));
      toast({ title: `Note saved for ${profile.display_name || profile.email}` });
    } catch (e: any) {
      toast({ title: "Error saving note", description: e.message, variant: "destructive" });
    }
  };

  const sendAndSaveSelected = async () => {
    setSendingAll(true);
    for (const idx of selected) {
      const profile = getResolvedProfile(idx);
      if (!profile) continue;
      const isAdmin = profile.id === user?.id;
      if (!sentMessages.has(String(idx))) await sendMessage(idx);
      if (!isAdmin && !savedNotes.has(String(idx))) await saveNote(idx);
    }
    setSendingAll(false);
    toast({ title: "Done!", description: "Messages sent and notes saved for selected participants." });
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === summaries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(summaries.map((_, i) => i)));
    }
  };

  const assignedCount = [...selected].filter(idx => profileMap.has(idx)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-gold" />
            Call Transcript — {callTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Participants summary */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-sans">
            <Users className="h-3 w-3" />
            {participants.map(p => p.email).join(", ")}
            {user?.email && `, ${user.email} (you)`}
          </div>

          {/* History section */}
          {history.length > 0 && summaries.length === 0 && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-sans font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
                {historyOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <History className="h-3 w-3" />
                Past Analyses ({history.length})
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {history.map(record => (
                  <div key={record.id} className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-sans">
                        {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                        {" · "}
                        {(record.summaries as Summary[]).length} summaries
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadFromHistory(record)}
                          className="gap-1 text-[10px] h-6 px-2"
                        >
                          <FileText className="h-2.5 w-2.5" />
                          Load & Send
                        </Button>
                        <button
                          onClick={() => deleteHistoryEntry(record.id)}
                          className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Transcript preview - collapsible */}
                    <Collapsible open={expandedTranscriptId === record.id} onOpenChange={(o) => setExpandedTranscriptId(o ? record.id : null)}>
                      <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-sans text-muted-foreground hover:text-foreground transition-colors">
                        {expandedTranscriptId === record.id ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                        <FileText className="h-2.5 w-2.5" />
                        Transcript ({record.transcript.split(/\s+/).length} words)
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1">
                        <div className="text-[10px] font-sans text-foreground/70 bg-background rounded-md p-2 max-h-[200px] overflow-y-auto whitespace-pre-wrap border border-border">
                          {record.transcript}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Summaries - collapsible */}
                    <Collapsible open={expandedHistoryId === record.id} onOpenChange={(o) => setExpandedHistoryId(o ? record.id : null)}>
                      <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-sans text-muted-foreground hover:text-foreground transition-colors">
                        {expandedHistoryId === record.id ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                        <Users className="h-2.5 w-2.5" />
                        Generated Summaries
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 space-y-1.5">
                        {(record.summaries as Summary[]).map((s, sIdx) => (
                          <div key={sIdx} className="rounded-md border border-border bg-background p-2 space-y-1">
                            <div className="flex items-center gap-1">
                              <User className="h-2.5 w-2.5 text-gold" />
                              <span className="text-[10px] font-sans font-medium">{s.name}</span>
                              {s.is_admin && (
                                <span className="rounded-full bg-gold/10 px-1 py-0.5 text-[8px] text-gold">Coach</span>
                              )}
                              {s.matched === false && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 gap-0.5 text-muted-foreground border-dashed">
                                  <UserX className="h-2 w-2" />
                                  External
                                </Badge>
                              )}
                            </div>
                            <p className="text-[10px] font-sans text-foreground/70 leading-relaxed whitespace-pre-wrap">
                              {s.summary}
                            </p>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Transcript input */}
          {summaries.length === 0 && (
            <>
              <div>
                <Label className="text-[10px]">Paste the full call transcript below</Label>
                <Textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder="Paste the entire conversation transcript here..."
                  className="text-xs min-h-[200px] mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {transcript.length > 0 ? `${transcript.split(/\s+/).length} words` : "The AI will identify each participant and generate a personal summary."}
                </p>
              </div>
              <Button
                onClick={analyze}
                disabled={analyzing || !transcript.trim()}
                className="w-full gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90"
              >
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {analyzing ? "Analyzing transcript..." : "Analyze & Generate Summaries"}
              </Button>
            </>
          )}

          {/* Results */}
          {summaries.length > 0 && (
            <>
              {/* Bulk actions bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selected.size === summaries.length && summaries.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <p className="text-xs font-sans font-medium text-foreground">
                    {selected.size} of {summaries.length} selected
                  </p>
                </div>
                <Button
                  onClick={sendAndSaveSelected}
                  disabled={sendingAll || assignedCount === 0}
                  size="sm"
                  className="gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90 text-[10px]"
                >
                  {sendingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                  Send & Save Selected ({assignedCount})
                </Button>
              </div>

              <div className="space-y-3">
                {summaries.map((s, idx) => {
                  const resolvedProfile = getResolvedProfile(idx);
                  const isSent = sentMessages.has(String(idx));
                  const isNoteSaved = savedNotes.has(String(idx));
                  const isAdmin = resolvedProfile?.id === user?.id;
                  const isExternal = s.matched === false && !resolvedProfile;

                  return (
                    <div key={idx} className={`rounded-xl border bg-card p-3 space-y-2 ${isExternal ? "border-dashed border-muted-foreground/40" : "border-border"}`}>
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={selected.has(idx)}
                          onCheckedChange={() => toggleSelect(idx)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <User className="h-3.5 w-3.5 text-gold" />
                            <span className="text-xs font-sans font-medium text-foreground">
                              {s.name}
                            </span>
                            {s.email && (
                              <span className="text-[10px] text-muted-foreground font-sans">
                                ({s.email})
                              </span>
                            )}
                            {isExternal && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 text-muted-foreground border-dashed">
                                <UserX className="h-2.5 w-2.5" />
                                External
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Label className="text-[9px] text-muted-foreground whitespace-nowrap">Assign to:</Label>
                            <Select
                              value={profileMap.get(idx) || ""}
                              onValueChange={(val) => {
                                setProfileMap(prev => {
                                  const next = new Map(prev);
                                  next.set(idx, val);
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 text-[10px] flex-1">
                                <SelectValue placeholder="Select profile..." />
                              </SelectTrigger>
                              <SelectContent>
                                {allProfiles.map(p => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.display_name || p.email}
                                    {p.display_name && <span className="text-muted-foreground ml-1">({p.email})</span>}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {resolvedProfile && (
                            <div className="flex items-center gap-1 text-[9px] text-primary font-sans">
                              <Check className="h-2.5 w-2.5" />
                              Linked to {resolvedProfile.display_name || resolvedProfile.email}
                              {isAdmin && (
                                <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[8px] text-gold ml-1">Coach</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <Textarea
                        value={s.summary}
                        onChange={(e) => {
                          setSummaries(prev => prev.map((item, i) => i === idx ? { ...item, summary: e.target.value } : item));
                        }}
                        className="text-xs font-sans text-foreground/80 leading-relaxed ml-6 min-h-[80px]"
                      />

                      <div className="flex items-center gap-1.5 pl-6">
                        {/* Copy button — always available */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(idx)}
                          className="gap-1 text-[10px] h-7"
                        >
                          {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === idx ? "Copied" : "Copy"}
                        </Button>

                        {resolvedProfile && (
                          <>
                            <Button
                              size="sm"
                              variant={isSent ? "secondary" : "outline"}
                              disabled={isSent}
                              onClick={() => sendMessage(idx)}
                              className="gap-1 text-[10px] h-7"
                            >
                              {isSent ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                              {isSent ? "Sent" : "Send Message"}
                            </Button>
                            {!isAdmin && (
                              <Button
                                size="sm"
                                variant={isNoteSaved ? "secondary" : "outline"}
                                disabled={isNoteSaved}
                                onClick={() => saveNote(idx)}
                                className="gap-1 text-[10px] h-7"
                              >
                                {isNoteSaved ? <Check className="h-3 w-3" /> : <StickyNote className="h-3 w-3" />}
                                {isNoteSaved ? "Saved" : "Save as Note"}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                variant="outline"
                onClick={backToInput}
                className="w-full text-xs"
              >
                {loadedHistoryId ? "Back to History" : "Analyze Another Transcript"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CallTranscriptAnalyzer;
