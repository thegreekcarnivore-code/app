import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Plus, Trash2, Edit2, ExternalLink, Users, User, Calendar, Loader2, Tag, Send, FileText, Copy, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import CallTranscriptAnalyzer from "./CallTranscriptAnalyzer";
import { format } from "date-fns";
import { Textarea as NotifyTextarea } from "@/components/ui/textarea";

interface Category {
  id: string;
  name: string;
}

interface CategoryAssignment {
  user_id: string;
  category_id: string;
}

interface VideoCall {
  id: string;
  title: string;
  meeting_url: string;
  call_type: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
  guest_emails?: string[];
  participants?: { user_id: string; email: string }[];
}

interface ClientOption {
  id: string;
  email: string;
}

const VideoCallsPanel = () => {
  const { user } = useAuth();
  const [calls, setCalls] = useState<VideoCall[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCall, setEditingCall] = useState<VideoCall | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [callType, setCallType] = useState("one_on_one");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [generatingZoom, setGeneratingZoom] = useState(false);
  const [inputTimezone, setInputTimezone] = useState<string>("Europe/Zurich");
  const [showAllTimezones, setShowAllTimezones] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [manualEmailInput, setManualEmailInput] = useState("");
  const [inputDate, setInputDate] = useState("");
  const [inputHour, setInputHour] = useState("12");
  const [inputMinute, setInputMinute] = useState("00");
  const [catAssignments, setCatAssignments] = useState<CategoryAssignment[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [notifyCall, setNotifyCall] = useState<VideoCall | null>(null);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [sendingNotify, setSendingNotify] = useState(false);
  const [transcriptCall, setTranscriptCall] = useState<VideoCall | null>(null);
  const [alreadyNotifiedEmails, setAlreadyNotifiedEmails] = useState<Set<string>>(new Set());
  const [alreadyInAppNotifiedEmails, setAlreadyInAppNotifiedEmails] = useState<Set<string>>(new Set());
  const [editNotifiedEmails, setEditNotifiedEmails] = useState<Set<string>>(new Set());
  const [editInAppNotifiedUserIds, setEditInAppNotifiedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCalls();
    fetchClients();
    fetchCategories();
  }, []);

  const fetchCalls = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("video_calls" as any)
      .select("*")
      .order("scheduled_at", { ascending: false });

    if (data) {
      // Fetch participants for each call
      const callIds = (data as any[]).map((c: any) => c.id);
      const { data: participants } = await supabase
        .from("video_call_participants" as any)
        .select("video_call_id, user_id")
        .in("video_call_id", callIds.length > 0 ? callIds : ["none"]);

      // Get participant emails
      const userIds = [...new Set((participants as any[] || []).map((p: any) => p.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, email").in("id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.email]));

      const enriched = (data as any[]).map((call: any) => ({
        ...call,
        participants: (participants as any[] || [])
          .filter((p: any) => p.video_call_id === call.id)
          .map((p: any) => ({ user_id: p.user_id, email: profileMap.get(p.user_id) || "Unknown" })),
      }));

      setCalls(enriched);
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("approved", true)
      .order("email");
    if (data) setClients(data.filter((c: any) => c.id !== user?.id) as ClientOption[]);
  };

  const fetchCategories = async () => {
    const [catRes, assignRes] = await Promise.all([
      supabase.from("client_categories" as any).select("id, name").order("name"),
      supabase.from("client_category_assignments" as any).select("user_id, category_id"),
    ]);
    if (catRes.data) setCategories(catRes.data as any);
    if (assignRes.data) setCatAssignments(assignRes.data as any);
  };

  const openCreate = () => {
    setEditingCall(null);
    setTitle("");
    setMeetingUrl("");
    setCallType("one_on_one");
    setScheduledAt("");
    setInputDate("");
    setInputHour("12");
    setInputMinute("00");
    setDuration(30);
    setNotes("");
    setSelectedParticipants([]);
    setManualEmails([]);
    setManualEmailInput("");
    setEditNotifiedEmails(new Set());
    setEditInAppNotifiedUserIds(new Set());
    setDialogOpen(true);
  };

  const openEdit = async (call: VideoCall) => {
    setEditingCall(call);
    populateForm(call, false);
    setDialogOpen(true);

    // Fetch email-sent status for this call
    const { data: sentRows } = await supabase
      .from("call_notifications_sent" as any)
      .select("email")
      .eq("video_call_id", call.id);
    setEditNotifiedEmails(new Set((sentRows as any[] || []).map((r: any) => r.email.toLowerCase())));

    // Fetch in-app sent status
    const participantIds = (call.participants || []).map(p => p.user_id);
    if (participantIds.length > 0) {
      const { data: msgRows } = await supabase
        .from("messages" as any)
        .select("receiver_id")
        .eq("sender_id", user?.id)
        .eq("is_automated", true)
        .in("receiver_id", participantIds)
        .ilike("content", `%${call.meeting_url}%`);
      setEditInAppNotifiedUserIds(new Set((msgRows as any[] || []).map((r: any) => r.receiver_id)));
    } else {
      setEditInAppNotifiedUserIds(new Set());
    }
  };

  const openDuplicate = (call: VideoCall) => {
    setEditingCall(null);
    populateForm(call, true);
    setDialogOpen(true);
  };

  const populateForm = (call: VideoCall, isDuplicate: boolean) => {
    setTitle(call.title);
    setMeetingUrl(isDuplicate ? "" : call.meeting_url);
    setCallType(call.call_type);
    setDuration(call.duration_minutes);
    setNotes(call.notes || "");
    setSelectedParticipants(call.participants?.map(p => p.user_id) || []);
    setManualEmails(isDuplicate ? (call.guest_emails || []) : (call.guest_emails || []));
    setManualEmailInput("");

    if (isDuplicate) {
      // Clear date so admin picks a new one
      setInputDate("");
      setInputHour("12");
      setInputMinute("00");
      setScheduledAt("");
    } else {
      const scheduledDate = call.scheduled_at ? new Date(call.scheduled_at) : null;
      if (scheduledDate) {
        const localStr = scheduledDate.toLocaleString("en-US", { timeZone: "Europe/Zurich" });
        const localDate = new Date(localStr);
        setInputDate(format(localDate, "yyyy-MM-dd"));
        setInputHour(String(localDate.getHours()));
        setInputMinute(String(Math.round(localDate.getMinutes() / 5) * 5).padStart(2, "0"));
        setScheduledAt(format(localDate, "yyyy-MM-dd'T'HH:mm"));
      } else {
        setInputDate("");
        setInputHour("12");
        setInputMinute("00");
        setScheduledAt("");
      }
    }
  };

  // Convert the datetime-local value (entered in chosen timezone) to a proper UTC ISO string
  const localInputToUTC = (localDateStr: string): string => {
    // datetime-local gives us a naive datetime string like "2026-02-27T20:40"
    // We need to interpret it in the selected timezone
    const d = new Date(localDateStr);
    // Get the browser's interpretation vs the target timezone
    const browserStr = d.toLocaleString("en-US");
    const targetStr = d.toLocaleString("en-US", { timeZone: inputTimezone });
    const browserDate = new Date(browserStr);
    const targetDate = new Date(targetStr);
    // offset = how much the target tz differs from browser local
    const offsetMs = targetDate.getTime() - browserDate.getTime();
    // Subtract offset to get UTC
    return new Date(d.getTime() - offsetMs).toISOString();
  };

  const buildGoogleCalendarUrl = (callTitle: string, startUtc: string, durationMin: number, url: string, callNotes: string, extraEmails: string[] = []) => {
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const start = new Date(startUtc);
    const end = new Date(start.getTime() + durationMin * 60000);
    const participantEmails = [
      ...selectedParticipants.map(uid => clients.find(c => c.id === uid)?.email).filter(Boolean),
      ...extraEmails,
    ];
    const greekDate = start.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Athens" });
    const greekTime = start.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" });
    const descParts = [
      `Κλήση Zoom`,
      `📅 ${greekDate}, ώρα ${greekTime} (ώρα Ελλάδας)`,
      `⏱ Διάρκεια: ${durationMin} λεπτά`,
      callNotes ? `\n${callNotes}` : "",
      `\n📋 Οδηγίες:`,
      `• Βεβαιωθείτε ότι έχετε εγκαταστήσει το Zoom πριν την κλήση`,
      `• Δοκιμάστε την κάμερα και το μικρόφωνό σας εκ των προτέρων`,
      `• Συνδεθείτε 2-3 λεπτά νωρίτερα για να βεβαιωθείτε ότι όλα λειτουργούν σωστά`,
      `• Χρησιμοποιήστε τον σύνδεσμο στην τοποθεσία για να συνδεθείτε`,
    ].filter(Boolean).join("\n");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: callTitle,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: descParts,
      location: url,
      crm: "AVAILABLE",
      ctz: "Europe/Zurich",
    });
    if (participantEmails.length > 0) {
      params.set("add", participantEmails.join(","));
    }
    params.set("guestCanModify", "0");
    params.set("guestCanInviteOthers", "0");
    params.set("guestCanSeeOtherGuests", "0");
    return `https://calendar.google.com/calendar/render?${params}`;
  };

  const updateScheduledAt = (date: string, hour: string, minute: string) => {
    if (date) {
      setScheduledAt(`${date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`);
    } else {
      setScheduledAt("");
    }
  };

  const getOtherTimezonePreview = (localDateStr: string): { label: string; time: string } | null => {
    if (!localDateStr) return null;
    try {
      const utcIso = localInputToUTC(localDateStr);
      const utcDate = new Date(utcIso);
      // Always show Switzerland and Greece previews (whichever isn't currently selected)
      const previews: { tz: string; flag: string }[] = [];
      if (inputTimezone !== "Europe/Zurich") previews.push({ tz: "Europe/Zurich", flag: "🇨🇭 Switzerland" });
      if (inputTimezone !== "Europe/Athens") previews.push({ tz: "Europe/Athens", flag: "🇬🇷 Greece" });
      const parts = previews.map(({ tz, flag }) => {
        const time = utcDate.toLocaleString("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          day: "numeric",
          month: "short",
          hour12: false,
        });
        return `${flag}: ${time}`;
      });
      return { label: "", time: parts.join("  ·  ") };
    } catch {
      return null;
    }
  };

  const handleSave = async () => {
    if (!title || !meetingUrl || !scheduledAt) {
      toast({ title: "Please fill in title, URL and date", variant: "destructive" });
      return;
    }

    const utcIso = localInputToUTC(scheduledAt);

    if (editingCall) {
      // Update
      const { error } = await supabase
        .from("video_calls" as any)
        .update({ title, meeting_url: meetingUrl, call_type: callType, scheduled_at: utcIso, duration_minutes: duration, notes: notes || null, guest_emails: manualEmails } as any)
        .eq("id", editingCall.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

      // Replace participants
      await supabase.from("video_call_participants" as any).delete().eq("video_call_id", editingCall.id);
      if (selectedParticipants.length > 0) {
        await supabase.from("video_call_participants" as any).insert(
          selectedParticipants.map(uid => ({ video_call_id: editingCall.id, user_id: uid })) as any
        );
      }
      toast({ title: "Video call updated" });
    } else {
      // Create
      const { data: newCall, error } = await supabase
        .from("video_calls" as any)
        .insert({ title, meeting_url: meetingUrl, call_type: callType, scheduled_at: utcIso, duration_minutes: duration, notes: notes || null, guest_emails: manualEmails, created_by: user?.id } as any)
        .select("id")
        .single();
      if (error || !newCall) { toast({ title: "Error", description: error?.message, variant: "destructive" }); return; }

      if (selectedParticipants.length > 0) {
        await supabase.from("video_call_participants" as any).insert(
          selectedParticipants.map(uid => ({ video_call_id: (newCall as any).id, user_id: uid })) as any
        );
      }
      toast({ title: "Video call created" });

      // Auto-open Google Calendar with the event
      const calUrl = buildGoogleCalendarUrl(title, utcIso, duration, meetingUrl, notes, manualEmails);
      window.open(calUrl, "_blank", "noopener,noreferrer");
    }

    setDialogOpen(false);
    fetchCalls();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("video_calls" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Video call deleted" }); fetchCalls(); }
  };

  const toggleParticipant = (uid: string) => {
    setSelectedParticipants(prev =>
      prev.includes(uid) ? prev.filter(p => p !== uid) : [...prev, uid]
    );
  };

  const formatGreekTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const time = d.toLocaleString("el-GR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" });
    const date = d.toLocaleString("el-GR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Athens" });
    return { time, date };
  };

  const openNotify = async (call: VideoCall) => {
    const { time, date } = formatGreekTime(call.scheduled_at);
    const defaultMsg = `Καλησπέρα {First_Name} ! Αρχίζουμε στις ${time} ώρα Ελλάδας, ${date}!\nΟ σύνδεσμος για την συνάντηση:\n${call.meeting_url}`;
    setNotifyMessage(defaultMsg);
    setNotifyCall(call);

    // Fetch already-sent email notifications for this call
    const { data: sentRows } = await supabase
      .from("call_notifications_sent" as any)
      .select("email")
      .eq("video_call_id", call.id);
    if (sentRows) {
      setAlreadyNotifiedEmails(new Set((sentRows as any[]).map((r: any) => r.email.toLowerCase())));
    } else {
      setAlreadyNotifiedEmails(new Set());
    }

    // Best-effort fetch for in-app sends: participants who already have an automated message containing this meeting URL
    const participantIds = (call.participants || []).map(p => p.user_id);
    if (participantIds.length > 0) {
      const { data: msgRows } = await supabase
        .from("messages" as any)
        .select("receiver_id")
        .eq("sender_id", user?.id)
        .eq("is_automated", true)
        .in("receiver_id", participantIds)
        .ilike("content", `%${call.meeting_url}%`);

      if (msgRows) {
        const sentUserIds = new Set((msgRows as any[]).map((r: any) => r.receiver_id));
        const sentEmails = new Set(
          (call.participants || [])
            .filter(p => sentUserIds.has(p.user_id))
            .map(p => p.email.toLowerCase())
        );
        setAlreadyInAppNotifiedEmails(sentEmails);
      } else {
        setAlreadyInAppNotifiedEmails(new Set());
      }
    } else {
      setAlreadyInAppNotifiedEmails(new Set());
    }
  };

  const handleSendNotify = async () => {
    if (!notifyCall || !user) return;
    const participants = notifyCall.participants || [];
    const guestEmails = notifyCall.guest_emails || [];
    if (participants.length === 0 && guestEmails.length === 0) {
      toast({ title: "No participants to notify", variant: "destructive" });
      return;
    }
    setSendingNotify(true);
    try {
      // Fetch display names for registered participants
      const userIds = participants.map(p => p.user_id);
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Send in-app messages to registered participants only.
      // This currently may hit a backend trigger bug if app.settings.supabase_url is not configured,
      // so handle it separately and continue with email delivery.
      let inAppError: any = null;
      if (participants.length > 0) {
        const messages = participants.map(p => {
          const profile = profileMap.get(p.user_id);
          const firstName = profile?.display_name?.split(" ")[0] || profile?.email?.split("@")[0] || "there";
          const personalMsg = notifyMessage.replace(/\{First_Name\}/g, firstName);
          return { sender_id: user.id, receiver_id: p.user_id, content: personalMsg, is_automated: true };
        });
        const { error: msgInsertError } = await supabase.from("messages").insert(messages);
        if (msgInsertError) {
          console.warn("In-app notification insert failed:", msgInsertError);
          inAppError = msgInsertError;
        }
      }

      // Build email recipients: registered participants + guest emails
      const emailRecipients = [
        ...participants.map(p => {
          const profile = profileMap.get(p.user_id);
          const firstName = profile?.display_name?.split(" ")[0] || profile?.email?.split("@")[0] || "there";
          return { email: profile?.email || p.email, first_name: firstName };
        }),
        ...guestEmails.map(email => ({
          email,
          first_name: email.split("@")[0] || "there",
        })),
      ].filter(r => r.email);

      if (emailRecipients.length > 0) {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke("notify-call-participants", {
          body: {
            recipients: emailRecipients,
            message_template: notifyMessage,
            meeting_url: notifyCall.meeting_url,
            scheduled_at: notifyCall.scheduled_at,
            duration_minutes: notifyCall.duration_minutes,
            video_call_id: notifyCall.id,
          },
        });
        if (emailError) {
          console.warn("Email notification failed:", emailError);
          toast({
            title: inAppError ? "Notifications partially failed" : "In-app messages sent!",
            description: `Email delivery failed: ${emailError.message || "Unknown error"}${inAppError ? " · In-app also failed" : ""}`,
            variant: "destructive"
          });
        } else if (emailResult?.errors?.length > 0) {
          toast({
            title: "Partial email delivery",
            description: `${emailResult.emails_sent} sent, ${emailResult.emails_skipped || 0} already notified, ${emailResult.errors.length} failed${inAppError ? " · In-app failed" : ""}`,
            variant: "destructive"
          });
        } else {
          const sent = emailResult?.emails_sent || 0;
          const skipped = emailResult?.emails_skipped || 0;
          const desc = skipped > 0
            ? `${sent} email(s) sent, ${skipped} already notified${inAppError ? " · In-app failed" : ""}`
            : `${sent} email(s) sent${inAppError ? " · In-app failed" : ""}`;
          toast({
            title: inAppError ? "Email sent, in-app failed" : "Notifications sent!",
            description: desc,
            variant: inAppError ? "destructive" : undefined,
          });
        }
      } else if (participants.length > 0) {
        if (inAppError) {
          toast({ title: "In-app notifications failed", description: inAppError.message || "Unknown error", variant: "destructive" });
        } else {
          toast({ title: "In-app messages sent!", description: `${participants.length} participant(s) notified.` });
        }
      }
    } catch (e: any) {
      toast({ title: "Error sending notifications", description: e.message, variant: "destructive" });
    }
    setSendingNotify(false);
    setNotifyCall(null);
  };

  const filteredClients = filterCategory === "all"
    ? clients
    : clients.filter(c => catAssignments.some(a => a.user_id === c.id && a.category_id === filterCategory));

  const isPast = (date: string) => new Date(date) < new Date();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-sans text-xs text-muted-foreground">Schedule video calls with clients using Google Meet, Zoom, or any link.</p>
        <Button onClick={openCreate} size="sm" className="gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90">
          <Plus className="h-3.5 w-3.5" />
          New Call
        </Button>
      </div>

      {calls.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Video className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="font-sans text-sm text-muted-foreground">No video calls scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map(call => (
            <div
              key={call.id}
              className={`rounded-xl border border-border bg-card px-4 py-3 space-y-2 ${isPast(call.scheduled_at) ? "opacity-80" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    {call.call_type === "group" ? (
                      <Users className="h-4 w-4 text-gold shrink-0" />
                    ) : (
                      <User className="h-4 w-4 text-gold shrink-0" />
                    )}
                    <span className="font-sans text-sm font-semibold text-foreground truncate">{call.title}</span>
                    <span className="rounded-full bg-charcoal/10 px-2 py-0.5 text-[10px] font-sans font-medium text-foreground/70 shrink-0">
                      {call.call_type === "group" ? "Group" : "1-on-1"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-sans font-medium text-foreground/90">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(call.scheduled_at), "MMM d, yyyy · HH:mm")}
                    <span>· {call.duration_minutes} min</span>
                  </div>
                  {call.participants && call.participants.length > 0 && (
                    <p className="text-[11px] font-sans font-medium text-foreground/85">
                      👥 {call.participants.map(p => p.email).join(", ")}
                      {call.guest_emails && call.guest_emails.length > 0 && (
                        <span className="text-muted-foreground"> + {call.guest_emails.join(", ")} (external)</span>
                      )}
                    </p>
                  )}
                  {(!call.participants || call.participants.length === 0) && call.guest_emails && call.guest_emails.length > 0 && (
                    <p className="text-[11px] font-sans font-medium text-foreground/85">
                      👥 {call.guest_emails.join(", ")} (external)
                    </p>
                  )}
                  {call.notes && (
                    <p className="text-[11px] font-sans font-medium text-foreground/80 italic">{call.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {((call.participants && call.participants.length > 0) || (call.guest_emails && call.guest_emails.length > 0)) && (
                    <>
                      <button onClick={() => setTranscriptCall(call)} className="flex items-center gap-1 rounded-lg bg-primary/5 px-2 py-1.5 text-primary hover:bg-primary/10 transition-colors" title="Analyze call transcript">
                        <FileText className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">Transcript</span>
                      </button>
                      <button
                        onClick={() => {
                          const participantEmails = (call.participants || [])
                            .map(p => p.email)
                            .filter(e => e && e !== "Unknown");
                          const fmtD = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                          const start = new Date(call.scheduled_at);
                          const end = new Date(start.getTime() + call.duration_minutes * 60000);
                          const greekDate = start.toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Athens" });
                          const greekTime = start.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Athens" });
                          const descriptionParts = [
                            `Κλήση Zoom`,
                            `📅 ${greekDate}, ώρα ${greekTime} (ώρα Ελλάδας)`,
                            `⏱ Διάρκεια: ${call.duration_minutes} λεπτά`,
                            call.notes ? `\n${call.notes}` : "",
                            `\n📋 Οδηγίες:`,
                            `• Βεβαιωθείτε ότι έχετε εγκαταστήσει το Zoom πριν την κλήση`,
                            `• Δοκιμάστε την κάμερα και το μικρόφωνό σας εκ των προτέρων`,
                            `• Συνδεθείτε 2-3 λεπτά νωρίτερα για να βεβαιωθείτε ότι όλα λειτουργούν σωστά`,
                            `• Χρησιμοποιήστε τον σύνδεσμο στην τοποθεσία για να συνδεθείτε`,
                          ].filter(Boolean).join("\n");
                          const params = new URLSearchParams({
                            action: "TEMPLATE",
                            text: call.title,
                            dates: `${fmtD(start)}/${fmtD(end)}`,
                            details: descriptionParts,
                            location: call.meeting_url,
                            crm: "AVAILABLE",
                            ctz: "Europe/Zurich",
                          });
                          if (participantEmails.length > 0) params.set("add", participantEmails.join(","));
                          window.open(`https://calendar.google.com/calendar/render?${params}`, "_blank", "noopener,noreferrer");
                        }}
                        className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2 py-1.5 text-green-600 hover:bg-green-500/20 transition-colors"
                        title="Add to Google Calendar"
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">Calendar</span>
                      </button>
                      <button onClick={() => openNotify(call)} className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1.5 text-gold hover:bg-gold/20 transition-colors" title="Notify participants">
                        <Send className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">Notify</span>
                      </button>
                    </>
                  )}
                  <a
                    href={call.meeting_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1.5 text-gold hover:bg-gold/20 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">Join</span>
                  </a>
                  <button onClick={() => openDuplicate(call)} className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-muted-foreground hover:bg-muted/80 transition-colors" title="Duplicate call">
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">Duplicate</span>
                  </button>
                  <button onClick={() => openEdit(call)} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-primary hover:bg-primary/20 transition-colors">
                    <Edit2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">Edit</span>
                  </button>
                  <button onClick={() => handleDelete(call.id)} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive hover:bg-destructive/20 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">
              {editingCall ? "Edit Video Call" : "Schedule Video Call"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[10px]">Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly check-in" className="text-sm" />
            </div>
            <div>
              <Label className="text-[10px]">Meeting URL</Label>
              <div className="flex gap-1.5">
                <Input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." className="text-sm flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generatingZoom}
                  onClick={async () => {
                    setGeneratingZoom(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("create-zoom-meeting", {
                        body: {
                          topic: title || "Coaching Session",
                          duration,
                          start_time: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
                          type: "scheduled",
                        },
                      });
                      if (error || data?.error) throw new Error(data?.error || error?.message);
                      setMeetingUrl(data.join_url);
                      toast({ title: "Zoom link generated!" });
                    } catch (e: any) {
                      toast({ title: "Zoom error", description: e.message, variant: "destructive" });
                    }
                    setGeneratingZoom(false);
                  }}
                  className="gap-1 shrink-0 text-[10px] border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                >
                  {generatingZoom ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />}
                  Zoom
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Type</Label>
                <Select value={callType} onValueChange={setCallType}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_on_one">1-on-1</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px]">Duration (min)</Label>
                <Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Date & Time</Label>
              <div className="flex gap-1 mt-0.5 mb-1 rounded-lg border border-border bg-background p-0.5 flex-wrap">
                {[
                  { tz: "Europe/Zurich", label: "🇨🇭 Switzerland" },
                  { tz: "Europe/Athens", label: "🇬🇷 Greece" },
                  ...(showAllTimezones ? [
                    { tz: "Europe/London", label: "🇬🇧 UK" },
                    { tz: "Europe/Berlin", label: "🇩🇪 Germany" },
                    { tz: "Europe/Paris", label: "🇫🇷 France" },
                    { tz: "Europe/Madrid", label: "🇪🇸 Spain" },
                    { tz: "Europe/Lisbon", label: "🇵🇹 Portugal" },
                    { tz: "Europe/Istanbul", label: "🇹🇷 Turkey" },
                    { tz: "Asia/Dubai", label: "🇦🇪 UAE" },
                    { tz: "America/New_York", label: "🇺🇸 US East" },
                    { tz: "America/Chicago", label: "🇺🇸 US Central" },
                    { tz: "America/Denver", label: "🇺🇸 US Mountain" },
                    { tz: "America/Los_Angeles", label: "🇺🇸 US Pacific" },
                    { tz: "America/Sao_Paulo", label: "🇧🇷 Brazil" },
                    { tz: "Asia/Kolkata", label: "🇮🇳 India" },
                    { tz: "Asia/Shanghai", label: "🇨🇳 China" },
                    { tz: "Asia/Tokyo", label: "🇯🇵 Japan" },
                    { tz: "Asia/Seoul", label: "🇰🇷 South Korea" },
                    { tz: "Australia/Sydney", label: "🇦🇺 Australia" },
                    { tz: "Pacific/Auckland", label: "🇳🇿 New Zealand" },
                  ] : []),
                ].map(({ tz, label }) => (
                  <button
                    key={tz}
                    onClick={() => setInputTimezone(tz)}
                    className={`rounded-md px-2 py-1 text-[10px] font-sans font-medium transition-all ${inputTimezone === tz ? "bg-gold text-gold-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => setShowAllTimezones(!showAllTimezones)}
                  className="rounded-md px-2 py-1 text-[10px] font-sans font-medium text-primary hover:text-primary/80 transition-all"
                >
                  {showAllTimezones ? "Less ▲" : "More ▼"}
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={inputDate}
                  onChange={e => {
                    setInputDate(e.target.value);
                    updateScheduledAt(e.target.value, inputHour, inputMinute);
                  }}
                  className="text-sm flex-1"
                />
                <Select value={inputHour} onValueChange={h => { setInputHour(h); updateScheduledAt(inputDate, h, inputMinute); }}>
                  <SelectTrigger className="w-[70px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="self-center text-sm font-medium">:</span>
                <Select value={inputMinute} onValueChange={m => { setInputMinute(m); updateScheduledAt(inputDate, inputHour, m); }}>
                  <SelectTrigger className="w-[70px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const val = String(i * 5).padStart(2, "0");
                      return <SelectItem key={val} value={val}>{val}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              {scheduledAt && (() => {
                const preview = getOtherTimezonePreview(scheduledAt);
                return preview ? (
                  <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
                    {preview.time}
                  </p>
                ) : null;
              })()}
            </div>
            <div>
              <Label className="text-[10px]">Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Topics to discuss..." rows={2} className="text-sm" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px]">Participants ({selectedParticipants.length + manualEmails.length} selected)</Label>
                <button
                  onClick={() => {
                    const visibleClients = filteredClients;
                    const allSelected = visibleClients.every(c => selectedParticipants.includes(c.id));
                    if (allSelected) {
                      setSelectedParticipants(prev => prev.filter(id => !visibleClients.some(c => c.id === id)));
                    } else {
                      setSelectedParticipants(prev => [...new Set([...prev, ...visibleClients.map(c => c.id)])]);
                    }
                  }}
                  className="text-[10px] font-sans font-medium text-gold hover:underline"
                >
                  {filteredClients.every(c => selectedParticipants.includes(c.id)) && filteredClients.length > 0 ? "Deselect All" : "Select All"}
                </button>
              </div>
              {/* Category filter */}
              {categories.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1.5">
                  <button
                    onClick={() => setFilterCategory("all")}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-sans font-medium transition-all ${filterCategory === "all" ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    All
                  </button>
                  {categories.map(cat => {
                    const count = catAssignments.filter(a => a.category_id === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setFilterCategory(cat.id)}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-sans font-medium transition-all flex items-center gap-1 ${filterCategory === cat.id ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {cat.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border mt-1 divide-y divide-border">
                {filteredClients.map(c => {
                  const emailSent = editNotifiedEmails.has(c.email.toLowerCase());
                  const inAppSent = editInAppNotifiedUserIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleParticipant(c.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-sans transition-colors ${
                        selectedParticipants.includes(c.id) ? "bg-gold/10 text-gold" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                        selectedParticipants.includes(c.id) ? "border-gold bg-gold text-gold-foreground" : "border-border"
                      }`}>
                        {selectedParticipants.includes(c.id) && "✓"}
                      </span>
                      <span className="flex-1 text-left">{c.email}</span>
                      {emailSent && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">email sent</Badge>}
                      {inAppSent && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">in-app sent</Badge>}
                    </button>
                  );
                })}
                {filteredClients.length === 0 && (
                  <p className="text-center text-[11px] font-sans text-muted-foreground py-3">No clients in this category.</p>
                )}
              </div>
              {/* Manual email input */}
              <div className="mt-2">
                <Label className="text-[10px]">Add email manually</Label>
                <div className="flex gap-1.5 mt-0.5">
                  <Input
                    type="email"
                    value={manualEmailInput}
                    onChange={e => setManualEmailInput(e.target.value)}
                    placeholder="someone@example.com"
                    className="text-sm flex-1"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (manualEmailInput && manualEmailInput.includes("@") && !manualEmails.includes(manualEmailInput)) {
                          setManualEmails(prev => [...prev, manualEmailInput]);
                          setManualEmailInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (manualEmailInput && manualEmailInput.includes("@") && !manualEmails.includes(manualEmailInput)) {
                        setManualEmails(prev => [...prev, manualEmailInput]);
                        setManualEmailInput("");
                      }
                    }}
                    className="shrink-0 text-[10px]"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                {manualEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {manualEmails.map(email => (
                      <span key={email} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-sans">
                        {email}
                        <button onClick={() => setManualEmails(prev => prev.filter(e => e !== email))} className="text-destructive hover:text-destructive/80">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleSave} className="w-full gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90">
              <Video className="h-4 w-4" />
              {editingCall ? "Update Call" : "Schedule Call"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify Participants Dialog */}
      <Dialog open={!!notifyCall} onOpenChange={(open) => !open && setNotifyCall(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">Notify Participants</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-[11px] font-sans text-muted-foreground space-y-1">
              <p>Sending to {(notifyCall?.participants?.length || 0) + (notifyCall?.guest_emails?.length || 0)} recipient(s):</p>
              <div className="space-y-0.5">
                {notifyCall?.participants?.map(p => {
                  const emailSent = alreadyNotifiedEmails.has(p.email.toLowerCase());
                  const inAppSent = alreadyInAppNotifiedEmails.has(p.email.toLowerCase());
                  return (
                    <div key={p.user_id} className="flex items-center gap-1.5 flex-wrap">
                      {(emailSent || inAppSent) && <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />}
                      <span className={emailSent || inAppSent ? "opacity-80" : ""}>{p.email}</span>
                      {emailSent && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">email sent</Badge>}
                      {inAppSent && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">in-app sent</Badge>}
                    </div>
                  );
                })}
                {notifyCall?.guest_emails?.map(email => {
                  const emailSent = alreadyNotifiedEmails.has(email.toLowerCase());
                  return (
                    <div key={email} className="flex items-center gap-1.5 flex-wrap">
                      {emailSent && <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />}
                      <span className={emailSent ? "opacity-80" : ""}>{email}</span>
                      <span className="italic text-[10px]">(external)</span>
                      {emailSent && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">email sent</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-[10px]">Message (use {"{First_Name}"} for personalization)</Label>
              <NotifyTextarea value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} rows={6} className="text-sm mt-1" />
            </div>
            <Button onClick={handleSendNotify} disabled={sendingNotify} className="w-full gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90">
              {sendingNotify ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to All Participants
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transcript Analyzer Dialog */}
      {transcriptCall && (
        <CallTranscriptAnalyzer
          open={!!transcriptCall}
          onOpenChange={(open) => !open && setTranscriptCall(null)}
          callTitle={transcriptCall.title}
          callId={transcriptCall.id}
          participants={transcriptCall.participants || []}
        />
      )}
    </div>
  );
};

export default VideoCallsPanel;
