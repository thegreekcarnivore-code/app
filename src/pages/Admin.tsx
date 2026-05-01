import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { Check, X, Link2, LogOut, Users, Shield, Activity, Ruler, Home, DollarSign, StickyNote, FileText, MessageCircle, BookOpen, Clock, Settings2, Trash2, Video, Tag, ListTodo, Sparkles, ClipboardCheck, UserPlus, Mail, UserCheck, Send, RefreshCw, Pencil, KeyRound, Rocket, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AddClientDialog from "@/components/admin/AddClientDialog";
import ProgramTemplateList from "@/components/admin/ProgramTemplateList";
import LaunchReadinessPanel from "@/components/admin/LaunchReadinessPanel";
import FeedbackInboxPanel from "@/components/admin/FeedbackInboxPanel";
import AdminGroupManager from "@/components/admin/AdminGroupManager";
import InviteClientPanel from "@/components/admin/InviteClientPanel";
import IconButtonWithTooltip from "@/components/IconButtonWithTooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import ClientNotesPanel from "@/components/ClientNotesPanel";
import AdminReportPanel from "@/components/AdminReportPanel";
import ClientProgramDialog from "@/components/ClientProgramDialog";
import EditEnrollmentDialog from "@/components/admin/EditEnrollmentDialog";
import ApproveUserDialog from "@/components/admin/ApproveUserDialog";
import EditFeatureAccessDialog from "@/components/admin/EditFeatureAccessDialog";
import EditClientDialog from "@/components/admin/EditClientDialog";
import VideoCallsPanel from "@/components/admin/VideoCallsPanel";
import ClientCategoriesPanel from "@/components/admin/ClientCategoriesPanel";
import AdminTodoPanel from "@/components/admin/AdminTodoPanel";
import ChatBubble from "@/components/ChatBubble";
import ClientAccountabilityPanel from "@/components/admin/ClientAccountabilityPanel";
import FinanceDashboard from "@/components/admin/FinanceDashboard";
import { useChatUnread } from "@/hooks/useChatUnread";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo.png";

interface InvitationInfo {
  id: string;
  status: string;
  created_at: string;
  resent_at: string | null;
  program_template_id: string | null;
  program_name: string | null;
  start_date: string | null;
  language: string;
  feature_access: any;
  measurement_day: number | null;
  group_id: string | null;
}

interface PendingUser {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  approved: boolean;
  last_login_at: string | null;
  _isVirtualInvite?: boolean;
  _inviteStatus?: "pending" | "used";
  _inviteProgramName?: string | null;
  _inviteStartDate?: string | null;
}

interface DuplicateProfileCandidate {
  email: string;
  auth_profile_id: string | null;
  legacy_profile_id: string | null;
  auth_approved: boolean | null;
  legacy_approved: boolean | null;
  auth_display_name: string | null;
  legacy_display_name: string | null;
  auth_created_at: string | null;
  legacy_created_at: string | null;
  auth_last_login_at: string | null;
  legacy_last_login_at: string | null;
  source_programs: number;
  source_groups: number;
  source_notes: number;
  source_measurements: number;
  source_messages: number;
  can_merge: boolean;
  review_reason: string | null;
}

interface AdminCategory {
  id: string;
  name: string;
}

interface AdminCategoryAssignment {
  user_id: string;
  category_id: string;
}


interface UserActivity {
  user_id: string;
  action_count: number;
  last_inquiry_at: string | null;
}

interface UserCost {
  user_id: string;
  total_cost: number;
  openai_cost: number;
  google_cost: number;
}

interface UserEnrollmentInfo {
  program_name: string;
  start_date: string;
  duration_weeks: number;
}

const ADMIN_TABS = [
  { key: "users", label: "Clients", icon: Users, description: "Client records, approvals, invitations, and direct actions." },
  { key: "invites", label: "Invites", icon: Link2, description: "Direct-entry email access, invite history, and reconnect flows." },
  { key: "programs", label: "Programs", icon: BookOpen, description: "Program templates, structure, and assigned content." },
  { key: "launch", label: "Launch", icon: Rocket, description: "End-to-end Metamorphosis pipeline status — what's ready, what needs config, what's missing." },
  { key: "feedback", label: "Feedback", icon: Inbox, description: "Member ideas, bugs, content requests, praise, and complaints — review and respond." },
  { key: "calls", label: "Calls", icon: Video, description: "Upcoming calls, schedules, and participation management." },
  { key: "categories", label: "Categories", icon: Tag, description: "Client grouping, tagging, and access segmentation." },
  { key: "todo", label: "To-Do", icon: ListTodo, description: "Operational tasks, follow-ups, and accountability actions." },
  { key: "groups", label: "Groups", icon: Users, description: "Community groups and shared client cohorts." },
  { key: "finance", label: "Finance", icon: DollarSign, description: "Revenue visibility, offer tracking, and business metrics." },
] as const;

const Admin = () => {
  const { user, signOut } = useAuth();
  const { lang, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [accountabilityOpen, setAccountabilityOpen] = useState(false);
  const [chatTargetClientId, setChatTargetClientId] = useState<string | null>(null);
  const unreadCount = useChatUnread();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [activityMap, setActivityMap] = useState<Map<string, UserActivity>>(new Map());
  const [costMap, setCostMap] = useState<Map<string, UserCost>>(new Map());
  const [enrollmentMap, setEnrollmentMap] = useState<Map<string, UserEnrollmentInfo>>(new Map());
  const [aiMsgCountMap, setAiMsgCountMap] = useState<Map<string, number>>(new Map());
  const [awaitingPaymentSet, setAwaitingPaymentSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "invites" | "programs" | "launch" | "feedback" | "calls" | "categories" | "todo" | "groups" | "finance">("users");
  const [userCategory, setUserCategory] = useState<string>("all");
  const [userSort, setUserSort] = useState<"newest" | "last-login">("newest");
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [adminCatAssignments, setAdminCatAssignments] = useState<AdminCategoryAssignment[]>([]);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const deleteUserObj = users.find(u => u.id === deleteUserId);
  const [selectedNotesUserId, setSelectedNotesUserId] = useState<string | null>(null);
  const [selectedReportUserId, setSelectedReportUserId] = useState<string | null>(null);
  const [selectedProgramUserId, setSelectedProgramUserId] = useState<string | null>(null);
  const [editClientUserId, setEditClientUserId] = useState<string | null>(null);
  const selectedNotesUser = users.find(u => u.id === selectedNotesUserId);
  const selectedReportUser = users.find(u => u.id === selectedReportUserId);
  const selectedProgramUser = users.find(u => u.id === selectedProgramUserId);
  const editClientUser = users.find(u => u.id === editClientUserId);
  const [editEnrollmentUserId, setEditEnrollmentUserId] = useState<string | null>(null);
  const editEnrollmentUser = users.find(u => u.id === editEnrollmentUserId);
  const [approveUserId, setApproveUserId] = useState<string | null>(null);
  const approveUser2 = users.find(u => u.id === approveUserId);
  const [editAccessUserId, setEditAccessUserId] = useState<string | null>(null);
  const editAccessUser = users.find(u => u.id === editAccessUserId);
  const [pendingTaskMap, setPendingTaskMap] = useState<Map<string, number>>(new Map());
  const [todoClientFilter, setTodoClientFilter] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingUser[]>([]);
  const [usedInvitationEmails, setUsedInvitationEmails] = useState<Set<string>>(new Set());
  const [invitationMap, setInvitationMap] = useState<Map<string, InvitationInfo>>(new Map());
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [reconnectingEmail, setReconnectingEmail] = useState<string | null>(null);
  const [resettingPasswordEmail, setResettingPasswordEmail] = useState<string | null>(null);
  const [copyingAccessEmail, setCopyingAccessEmail] = useState<string | null>(null);
  const [copyingResetEmail, setCopyingResetEmail] = useState<string | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateProfileCandidate[]>([]);
  const [mergeCandidate, setMergeCandidate] = useState<DuplicateProfileCandidate | null>(null);
  const [mergingDuplicateEmail, setMergingDuplicateEmail] = useState<string | null>(null);

  useEffect(() => {
    checkAdmin();
  }, [user]);

  const refreshAdminData = async () => {
    await Promise.all([
      fetchUsers(),
      fetchActivity(),
      fetchCosts(),
      fetchEnrollments(),
      fetchAdminCategories(),
      fetchAiMsgCounts(),
      fetchPendingTasks(),
      fetchInvitations(),
      fetchAwaitingPayment(),
      fetchDuplicateCandidates(),
    ]);
  };

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (data) {
      setIsAdmin(true);
      await refreshAdminData();
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name, created_at, approved, last_login_at" as any)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data) setUsers(data as any);
  };


  const fetchActivity = async () => {
    const { data } = await supabase
      .from("user_activity")
      .select("user_id, action_count, last_inquiry_at");
    if (data) {
      const map = new Map<string, UserActivity>();
      for (const row of data) {
        map.set(row.user_id, row as UserActivity);
      }
      setActivityMap(map);
    }
  };

  const fetchCosts = async () => {
    const { data } = await supabase
      .from("api_usage" as any)
      .select("user_id, service, estimated_cost")
      .order("created_at" as any, { ascending: false })
      .limit(5000);
    if (data) {
      const map = new Map<string, UserCost>();
      for (const row of data as any[]) {
        const existing = map.get(row.user_id) || { user_id: row.user_id, total_cost: 0, openai_cost: 0, google_cost: 0 };
        const cost = Number(row.estimated_cost) || 0;
        existing.total_cost += cost;
        if (row.service === "openai") existing.openai_cost += cost;
        else if (row.service === "google_maps") existing.google_cost += cost;
        map.set(row.user_id, existing);
      }
      setCostMap(map);
    }
  };

  const fetchEnrollments = async () => {
    const { data } = await supabase
      .from("client_program_enrollments")
      .select("user_id, start_date, program_template_id, status, duration_weeks_override")
      .eq("status", "active") as any;
    if (!data || data.length === 0) return;

    const templateIds = [...new Set(data.map((d: any) => d.program_template_id))] as string[];
    const { data: templates } = await supabase
      .from("program_templates")
      .select("id, name, duration_weeks")
      .in("id", templateIds);

    const templateMap = new Map<string, { name: string; duration_weeks: number }>();
    if (templates) {
      for (const t of templates) templateMap.set(t.id, { name: t.name, duration_weeks: t.duration_weeks });
    }

    const map = new Map<string, UserEnrollmentInfo>();
    for (const row of data as any[]) {
      const tmpl = templateMap.get(row.program_template_id);
      if (tmpl) {
        map.set(row.user_id, {
          program_name: tmpl.name,
          start_date: row.start_date,
          duration_weeks: row.duration_weeks_override ?? tmpl.duration_weeks,
        });
      }
    }
    setEnrollmentMap(map);
  };

  const fetchAdminCategories = async () => {
    const [catRes, assignRes] = await Promise.all([
      supabase.from("client_categories" as any).select("id, name").order("name"),
      supabase.from("client_category_assignments" as any).select("user_id, category_id"),
    ]);
    if (catRes.data) setAdminCategories(catRes.data as any);
    if (assignRes.data) setAdminCatAssignments(assignRes.data as any);
  };

  const fetchPendingTasks = async () => {
    const { data } = await supabase
      .from("admin_tasks" as any)
      .select("client_id")
      .is("completed_at", null)
      .not("client_id", "is", null);
    if (data) {
      const map = new Map<string, number>();
      for (const row of data as any[]) {
        map.set(row.client_id, (map.get(row.client_id) || 0) + 1);
      }
      setPendingTaskMap(map);
    }
  };

  const fetchAiMsgCounts = async () => {
    const { data } = await supabase
      .from("ai_chat_messages")
      .select("user_id")
      .eq("role", "user")
      .limit(5000);
    if (data) {
      const map = new Map<string, number>();
      for (const row of data as any[]) {
        map.set(row.user_id, (map.get(row.user_id) || 0) + 1);
      }
      setAiMsgCountMap(map);
    }
  };

  const fetchAwaitingPayment = async () => {
    const { data } = await supabase
      .from("client_programs")
      .select("user_id, prospect_email, payment_status")
      .eq("payment_status", "offer_sent");
    if (data) {
      const set = new Set<string>();
      for (const row of data as any[]) {
        if (row.user_id) set.add(row.user_id);
        if (row.prospect_email) set.add(row.prospect_email.toLowerCase());
      }
      setAwaitingPaymentSet(set);
    }
  };

  const fetchInvitations = async () => {
    // Fetch ALL invitations (pending + used) to build a complete map
    const { data: allInvitations } = await supabase
      .from("email_invitations" as any)
      .select("id, email, language, status, created_at, program_template_id, start_date, feature_access, measurement_day, group_id")
      .order("created_at", { ascending: false });

    if (!allInvitations) return;

    // Fetch program names
    const templateIds = [...new Set((allInvitations as any[]).filter(p => p.program_template_id).map(p => p.program_template_id))];
    let templateNameMap = new Map<string, string>();
    if (templateIds.length > 0) {
      const { data: templates } = await supabase
        .from("program_templates")
        .select("id, name")
        .in("id", templateIds);
      if (templates) {
        for (const t of templates) templateNameMap.set(t.id, t.name);
      }
    }

    // Build invitation lookup map (email -> most recent invitation)
    const invMap = new Map<string, InvitationInfo>();
    for (const inv of allInvitations as any[]) {
      const email = inv.email?.toLowerCase();
      if (email && !invMap.has(email)) {
        invMap.set(email, {
          id: inv.id,
          status: inv.status,
          created_at: inv.created_at,
          resent_at: inv.resent_at || null,
          program_template_id: inv.program_template_id,
          program_name: inv.program_template_id ? templateNameMap.get(inv.program_template_id) || null : null,
          start_date: inv.start_date,
          language: inv.language,
          feature_access: inv.feature_access,
          measurement_day: inv.measurement_day,
          group_id: inv.group_id,
        });
      }
    }
    setInvitationMap(invMap);

    // Build virtual entries only for pending invitations
    const pendingOnly = (allInvitations as any[]).filter(inv => inv.status === "pending");
    const virtualUsers: PendingUser[] = pendingOnly.map(inv => ({
      id: `inv-${inv.id}`,
      email: inv.email,
      display_name: null,
      created_at: inv.created_at,
      approved: false,
      last_login_at: null,
      _isVirtualInvite: true,
      _inviteStatus: "pending" as const,
      _inviteProgramName: inv.program_template_id ? templateNameMap.get(inv.program_template_id) || null : null,
      _inviteStartDate: inv.start_date,
    }));
    setPendingInvitations(virtualUsers);

    // Used invitation emails set
    const usedEmails = new Set((allInvitations as any[]).filter(i => i.status === "used").map(i => i.email));
    setUsedInvitationEmails(usedEmails);
  };

  const fetchDuplicateCandidates = async () => {
    const { data, error } = await supabase.rpc("list_duplicate_profile_candidates");
    if (error) {
      console.error("Failed to load duplicate profile candidates:", error.message);
      setDuplicateCandidates([]);
      return;
    }
    setDuplicateCandidates(((data as any[]) || []) as DuplicateProfileCandidate[]);
  };

  const handleResendInvite = async (email: string) => {
    const invInfo = invitationMap.get(email.toLowerCase());
    if (!invInfo) return;
    setResendingEmail(email);
    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: {
        email: email.toLowerCase(),
        language: invInfo.language,
        feature_access: invInfo.feature_access,
        program_template_id: invInfo.program_template_id,
        start_date: invInfo.start_date,
        measurement_day: invInfo.measurement_day,
        group_id: invInfo.group_id,
        resend: true,
      },
    });
    setResendingEmail(null);
    if (error || data?.error) {
      toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Access link resent", description: `A fresh direct-entry link was sent to ${email}` });
      fetchInvitations();
    }
  };

  const handleSendReconnect = async (email: string, language?: string) => {
    setReconnectingEmail(email);
    const { data, error } = await supabase.functions.invoke("send-reconnect-email", {
      body: { email: email.toLowerCase(), language: language || "el" },
    });
    setReconnectingEmail(null);
    if (error || data?.error) {
      toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({
        title: data?.restored_access ? "Access granted & reconnect email sent" : "Reconnect email sent",
        description: data?.restored_access
          ? `${email} can now use the direct login link immediately.`
          : `Reminder sent to ${email}`,
      });
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    setResettingPasswordEmail(email);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { email: email.toLowerCase() },
    });
    setResettingPasswordEmail(null);

    if (error || data?.error) {
      toast({
        title: "Password reset failed",
        description: error?.message || data?.error || "Could not send the password reset email.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Password reset sent",
      description: `A reset link was sent to ${email}.`,
    });
  };

  const handleCopyAccessLink = async (email: string, language?: string) => {
    setCopyingAccessEmail(email);
    const { data, error } = await supabase.functions.invoke("access-link", {
      body: {
        action: "create",
        purpose: "magic_login",
        email: email.toLowerCase(),
        language: language || "el",
        redirect_path: "/home",
      },
    });
    setCopyingAccessEmail(null);

    if (error || !data?.url) {
      toast({
        title: "Link generation failed",
        description: error?.message || data?.error || "Could not create the direct app link.",
        variant: "destructive",
      });
      return;
    }

    await navigator.clipboard.writeText(data.url);
    toast({
      title: "Direct access link copied",
      description: data.url,
    });
  };

  const handleCopyResetLink = async (email: string) => {
    setCopyingResetEmail(email);
    const { data, error } = await supabase.functions.invoke("access-link", {
      body: {
        action: "create",
        purpose: "password_reset",
        email: email.toLowerCase(),
      },
    });
    setCopyingResetEmail(null);

    if (error || !data?.url) {
      toast({
        title: "Link generation failed",
        description: error?.message || data?.error || "Could not create the password reset link.",
        variant: "destructive",
      });
      return;
    }

    await navigator.clipboard.writeText(data.url);
    toast({
      title: "Reset link copied",
      description: data.url,
    });
  };

  const handleMergeDuplicate = async () => {
    if (!mergeCandidate?.legacy_profile_id || !mergeCandidate.auth_profile_id) return;

    setMergingDuplicateEmail(mergeCandidate.email);
    const { error } = await supabase.rpc("merge_duplicate_profiles_admin", {
      _source_user_id: mergeCandidate.legacy_profile_id,
      _target_user_id: mergeCandidate.auth_profile_id,
    });
    setMergingDuplicateEmail(null);

    if (error) {
      toast({ title: "Merge failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Profiles merged",
      description: `${mergeCandidate.email} now keeps the current login profile and all migrated client data under one account.`,
    });
    setMergeCandidate(null);
    await refreshAdminData();
  };

  const approveUser = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ approved: true })
      .eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User approved" });
      fetchUsers();
    }
  };

  const denyUser = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ approved: false })
      .eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User denied" });
      fetchUsers();
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { user_id: deleteUserId },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "User deleted" });
      setUsers(prev => prev.filter(u => u.id !== deleteUserId));
    }
    setDeleteUserId(null);
  };

  // Deduplicate: exclude virtual invitations if a real profile already exists for that email
  const realUserEmails = new Set(users.map(u => u.email?.toLowerCase()).filter(Boolean));
  const orphanInvitations = pendingInvitations.filter(inv => !realUserEmails.has(inv.email?.toLowerCase() || ""));

  // Merge real users + orphan virtual invitation entries
  const allUsers = userCategory === "invited"
    ? orphanInvitations
    : [
        ...users.map(u => ({
          ...u,
          _isVirtualInvite: false as const,
          _inviteStatus: (usedInvitationEmails.has(u.email || "") ? "used" : undefined) as "used" | undefined,
        })),
        ...(userCategory === "all" ? orphanInvitations : []),
      ];

  const filteredUsers = allUsers.filter(u => {
    if (userCategory === "invited") return true;
    if (userCategory === "approved") return u.approved;
    if (userCategory === "pending") return !u.approved && !u._isVirtualInvite;
    if (userCategory === "enrolled") return enrollmentMap.has(u.id);
    if (userCategory !== "all") {
      return adminCatAssignments.some(a => a.user_id === u.id && a.category_id === userCategory);
    }
    return true;
  }).sort((a, b) => {
    if (userSort === "last-login") {
      const aTime = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
      const bTime = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      return bTime - aTime;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const pendingApprovals = users.filter((u) => !u.approved).length;
  const activeEnrollments = enrollmentMap.size;
  const clientsWithPendingTasks = Array.from(pendingTaskMap.values()).filter((count) => count > 0).length;
  const awaitingPaymentCount = new Set(
    [
      ...users
        .filter((u) => awaitingPaymentSet.has(u.id) || (u.email ? awaitingPaymentSet.has(u.email.toLowerCase()) : false))
        .map((u) => u.id),
      ...orphanInvitations
        .filter((u) => (u.email ? awaitingPaymentSet.has(u.email.toLowerCase()) : false))
        .map((u) => u.id),
    ],
  ).size;
  const summaryCards = [
    { key: "clients", label: "Active client records", value: users.length, icon: Users },
    { key: "approvals", label: "Awaiting approval", value: pendingApprovals, icon: Shield },
    { key: "enrollments", label: "Active enrollments", value: activeEnrollments, icon: ClipboardCheck },
    { key: "invites", label: "Pending invitations", value: orphanInvitations.length, icon: Mail },
  ];
  const urgentActionCards = [
    {
      key: "approvals",
      label: "Client approvals",
      value: pendingApprovals,
      detail: "Profiles waiting before onboarding can start.",
      action: () => {
        setActiveTab("users");
        setUserCategory("pending");
      },
    },
    {
      key: "invites",
      label: "Outstanding invites",
      value: orphanInvitations.length,
      detail: "Invite emails sent but not yet attached to real profiles.",
      action: () => setActiveTab("invites"),
    },
    {
      key: "todo",
      label: "Clients with tasks due",
      value: clientsWithPendingTasks,
      detail: "Clients carrying unfinished follow-up items.",
      action: () => setActiveTab("todo"),
    },
    {
      key: "payments",
      label: "Awaiting payment",
      value: awaitingPaymentCount,
      detail: "Prospects or clients currently sitting in offer-sent status.",
      action: () => {
        setActiveTab("users");
        setUserCategory("all");
      },
    },
  ];
  const activeTabMeta = ADMIN_TABS.find((tab) => tab.key === activeTab) ?? ADMIN_TABS[0];
  const mergeSafeCandidates = duplicateCandidates.filter((candidate) => candidate.can_merge);
  const reviewOnlyCandidates = duplicateCandidates.filter((candidate) => !candidate.can_merge);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <h1 className="font-serif text-xl text-foreground">Access Denied</h1>
          <p className="font-sans text-sm text-muted-foreground">You don't have admin privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 pt-14 pb-24">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <img src={logo} alt="The Greek Carnivore" className="h-12 w-auto object-contain" />
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.28em] text-gold">Coaching Operations</p>
              <h1 className="font-serif text-2xl font-semibold text-foreground">Admin Panel</h1>
              <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
                Keep client operations, enrollment flow, follow-ups, and business visibility in one controlled workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconButtonWithTooltip
              tooltip="Messages"
              onClick={(e) => { e.stopPropagation(); setChatOpen(!chatOpen); }}
              className="relative z-50 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-sans font-medium">Messages</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </IconButtonWithTooltip>
            <IconButtonWithTooltip
              tooltip="Accountability Tracker"
              onClick={(e) => { e.stopPropagation(); setAccountabilityOpen(true); }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-xs font-sans font-medium">Tracker</span>
            </IconButtonWithTooltip>
            <button onClick={() => navigate("/home")} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-3 w-3" />
              Home
            </button>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {lang === "en" ? "Ελ" : "EN"}
            </button>
            <button onClick={signOut} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="h-3 w-3" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ key, label, value, icon: Icon }) => (
            <div key={key} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-sans text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                  <p className="mt-2 font-serif text-2xl font-semibold text-foreground">{value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Needs attention now</p>
              <h2 className="font-serif text-lg font-semibold text-foreground">Priority scan</h2>
              <p className="font-sans text-sm text-muted-foreground">
                Jump straight to the parts of the operation that are most likely to block momentum.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {urgentActionCards.map((card) => (
                <button
                  key={card.key}
                  onClick={card.action}
                  className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4 text-left transition-all hover:border-gold/35 hover:shadow-sm"
                >
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{card.label}</p>
                  <p className="mt-2 font-serif text-2xl font-semibold text-foreground">{card.value}</p>
                  <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Workspace</p>
              <h2 className="font-serif text-lg font-semibold text-foreground">{activeTabMeta.label}</h2>
              <p className="font-sans text-sm text-muted-foreground">{activeTabMeta.description}</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {ADMIN_TABS.filter(t => ["users","invites","programs","launch","feedback","finance"].includes(t.key)).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex min-w-fit items-center gap-2 rounded-full px-3 py-2 font-sans text-xs font-medium transition-all ${activeTab === key ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {key === "users" ? `${label} (${users.length + orphanInvitations.length})` : label}
                </button>
              ))}
              <div className="w-px self-stretch bg-border/60 mx-1 shrink-0" />
              {ADMIN_TABS.filter(t => ["calls","categories","todo","groups"].includes(t.key)).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex min-w-fit items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-[11px] font-medium transition-all ${activeTab === key ? "bg-gold/20 text-gold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="font-serif text-lg font-semibold text-foreground">Client workspace</h3>
                    <p className="font-sans text-sm text-muted-foreground">
                      Review approvals, enrollment progress, pending work, and direct client actions from one queue.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {pendingApprovals > 0 && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-sans font-medium text-amber-600">
                        {pendingApprovals} approvals waiting
                      </span>
                    )}
                    {mergeSafeCandidates.length > 0 && (
                      <span className="rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1 text-[11px] font-sans font-medium text-destructive">
                        {mergeSafeCandidates.length} duplicate access requests need merge
                      </span>
                    )}
                    {clientsWithPendingTasks > 0 && (
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-sans font-medium text-gold">
                        {clientsWithPendingTasks} clients with pending tasks
                      </span>
                    )}
                    {orphanInvitations.length > 0 && (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-sans font-medium text-primary">
                        {orphanInvitations.length} invite-only records
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "approved", "pending", "enrolled", "invited"] as const).map(cat => {
                      const counts = { all: users.length + orphanInvitations.length, approved: users.filter(u => u.approved).length, pending: users.filter(u => !u.approved).length, enrolled: users.filter(u => enrollmentMap.has(u.id)).length, invited: orphanInvitations.length };
                      return (
                        <button
                          key={cat}
                          onClick={() => setUserCategory(cat)}
                          className={`rounded-full px-3 py-1 font-sans text-[11px] font-medium transition-all ${userCategory === cat ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                        >
                          {cat.charAt(0).toUpperCase() + cat.slice(1)} ({counts[cat]})
                        </button>
                      );
                    })}
                    {adminCategories.map(cat => {
                      const count = adminCatAssignments.filter(a => a.category_id === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setUserCategory(cat.id)}
                          className={`flex items-center gap-1 rounded-full px-3 py-1 font-sans text-[11px] font-medium transition-all ${userCategory === cat.id ? "bg-gold text-gold-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {cat.name} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setUserSort("newest")}
                      className={`rounded-full px-3 py-1 font-sans text-[11px] font-medium transition-all ${userSort === "newest" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      Newest First
                    </button>
                    <button
                      onClick={() => setUserSort("last-login")}
                      className={`rounded-full px-3 py-1 font-sans text-[11px] font-medium transition-all ${userSort === "last-login" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                    >
                      Last Login
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setAddClientOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-gold px-3 py-2 font-sans text-[11px] font-semibold text-gold-foreground hover:opacity-90 transition-opacity shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Client
                </button>
              </div>
            </div>

            {(mergeSafeCandidates.length > 0 || reviewOnlyCandidates.length > 0) && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="space-y-1">
                  <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-gold">Duplicate access requests</p>
                  <h3 className="font-serif text-lg font-semibold text-foreground">Merge migrated profile data into the current login profile</h3>
                  <p className="font-sans text-sm text-muted-foreground">
                    These clients now have two profile rows with the same email. Keep the auth-linked login profile, move all migrated client data into it, and remove the legacy duplicate.
                  </p>
                </div>

                {mergeSafeCandidates.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {mergeSafeCandidates.map((candidate) => (
                      <div key={candidate.email} className="rounded-[1.5rem] border border-destructive/20 bg-destructive/5 p-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="space-y-3">
                            <div>
                              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-destructive">Safe to merge now</p>
                              <h4 className="font-serif text-xl font-semibold text-foreground">{candidate.email}</h4>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Current login profile</p>
                                <p className="mt-2 font-sans text-xs text-foreground">{candidate.auth_display_name || "No display name yet"}</p>
                                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{candidate.auth_profile_id}</p>
                                <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                                  Created {candidate.auth_created_at ? new Date(candidate.auth_created_at).toLocaleString() : "Unknown"}
                                </p>
                                <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                                  Last login {candidate.auth_last_login_at ? new Date(candidate.auth_last_login_at).toLocaleString() : "No login yet"}
                                </p>
                                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${candidate.auth_approved ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                                  {candidate.auth_approved ? "Approved" : "Pending"}
                                </span>
                              </div>

                              <div className="rounded-2xl border border-border/70 bg-background/80 p-3">
                                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Imported duplicate to absorb</p>
                                <p className="mt-2 font-sans text-xs text-foreground">{candidate.legacy_display_name || "No display name"}</p>
                                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{candidate.legacy_profile_id}</p>
                                <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                                  Created {candidate.legacy_created_at ? new Date(candidate.legacy_created_at).toLocaleString() : "Unknown"}
                                </p>
                                <p className="mt-1 font-sans text-[11px] text-muted-foreground">
                                  Last login {candidate.legacy_last_login_at ? new Date(candidate.legacy_last_login_at).toLocaleString() : "No recorded login"}
                                </p>
                                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${candidate.legacy_approved ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                                  {candidate.legacy_approved ? "Approved" : "Pending"}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-sans text-foreground">{candidate.source_programs} programs</span>
                              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-sans text-foreground">{candidate.source_groups} groups</span>
                              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-sans text-foreground">{candidate.source_notes} notes</span>
                              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-sans text-foreground">{candidate.source_measurements} measurements</span>
                              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-sans text-foreground">{candidate.source_messages} messages</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setMergeCandidate(candidate)}
                            className="inline-flex items-center justify-center rounded-full bg-gold px-4 py-2 text-xs font-semibold text-gold-foreground transition-opacity hover:opacity-90 shrink-0"
                          >
                            {mergingDuplicateEmail === candidate.email ? "Merging..." : "Merge Profiles"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {reviewOnlyCandidates.length > 0 && (
                  <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Review only</p>
                    <div className="mt-3 space-y-2">
                      {reviewOnlyCandidates.map((candidate) => (
                        <div key={candidate.email} className="flex flex-col gap-1 rounded-2xl border border-border/70 bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-sans text-sm font-medium text-foreground">{candidate.email}</p>
                            <p className="font-sans text-xs text-muted-foreground">{candidate.review_reason || "Requires manual review before merge."}</p>
                          </div>
                          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                            Review only
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {filteredUsers.map((u) => {
              const isVirtual = u._isVirtualInvite;
              const activity = !isVirtual ? activityMap.get(u.id) : undefined;
              const cost = !isVirtual ? costMap.get(u.id) : undefined;
              const enrollment = !isVirtual ? enrollmentMap.get(u.id) : undefined;
              const daysIn = enrollment ? Math.max(0, Math.floor((Date.now() - new Date(enrollment.start_date).getTime()) / 86400000)) : null;
              const totalDays = enrollment ? enrollment.duration_weeks * 7 : null;
              const inviteInfo = !isVirtual && u.email ? invitationMap.get(u.email.toLowerCase()) : undefined;

              // Determine status badge
              let statusBadge: React.ReactNode = null;
              if (isVirtual) {
                statusBadge = (
                  <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[10px] gap-1">
                    <Mail className="h-2.5 w-2.5" />
                    Direct access sent
                  </Badge>
                );
              } else if (!u.last_login_at && inviteInfo && inviteInfo.status === "used") {
                statusBadge = (
                  <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px] gap-1">
                    <UserCheck className="h-2.5 w-2.5" />
                    Profile Created · Awaiting Login
                  </Badge>
                );
              }

              // Check if awaiting payment (by user_id or prospect_email)
              const isAwaitingPayment = !isVirtual
                ? awaitingPaymentSet.has(u.id)
                : u.email ? awaitingPaymentSet.has(u.email.toLowerCase()) : false;

              // Show resend button for: virtual invites OR real users who never logged in and have an invitation
              const showResend = isVirtual || (!u.last_login_at && inviteInfo);

              return (
                <div key={u.id} className="rounded-xl border border-border bg-card px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {isVirtual ? (
                        <span className="font-sans text-sm text-foreground">
                          {u.email || "No email"}
                        </span>
                      ) : (
                        <button onClick={() => navigate(`/admin/client/${u.id}`)} className="font-sans text-sm text-foreground hover:text-primary hover:underline transition-colors text-left">
                          {u.display_name ? <><span className="font-medium">{u.display_name}</span>{" — "}</> : null}{u.email || "No email"}
                        </button>
                      )}
                      {statusBadge && <span className="ml-2 inline-flex align-middle">{statusBadge}</span>}
                      {isAwaitingPayment && (
                        <span className="ml-2 inline-flex align-middle">
                          <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                            <DollarSign className="h-2.5 w-2.5" />
                            ⏳ Αναμονή Πληρωμής
                          </Badge>
                        </span>
                      )}
                      {isVirtual && u._inviteProgramName && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-medium text-primary">
                          <BookOpen className="h-3 w-3" />
                          {u._inviteProgramName}
                          {u._inviteStartDate && ` · starts ${new Date(u._inviteStartDate).toLocaleDateString()}`}
                        </span>
                      )}
                      {!isVirtual && enrollment && daysIn !== null && totalDays !== null && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditEnrollmentUserId(u.id); }}
                          className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                        >
                          <BookOpen className="h-3 w-3" />
                          {enrollment.program_name} · {daysIn} of {totalDays} days
                        </button>
                      )}
                      <p className="font-sans text-[10px] text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                        {!isVirtual && <> · {u.approved ? "✅ Approved" : "⏳ Pending"}</>}
                        {isVirtual
                          ? <> · Invited{u.email && invitationMap.get(u.email.toLowerCase())?.resent_at ? ` · Resent ${new Date(invitationMap.get(u.email.toLowerCase())!.resent_at!).toLocaleDateString()}` : ""}</>
                          : u.last_login_at
                            ? ` · Last login: ${new Date(u.last_login_at).toLocaleString()}`
                            : " · Never logged in"
                        }
                        {!isVirtual && (aiMsgCountMap.get(u.id) || 0) > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            · <Sparkles className="h-2.5 w-2.5 inline text-accent-foreground" /> {aiMsgCountMap.get(u.id)} AI msgs
                          </span>
                        )}
                      </p>
                      {/* Invitation info line for real users */}
                      {!isVirtual && inviteInfo && (
                        <p className="font-sans text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="h-2.5 w-2.5 text-gold" />
                          Invited on {new Date(inviteInfo.created_at).toLocaleDateString()}
                          {inviteInfo.resent_at && <> · Resent {new Date(inviteInfo.resent_at).toLocaleDateString()}</>}
                          {inviteInfo.program_name && <> · {inviteInfo.program_name}</>}
                          {inviteInfo.start_date && <> · starts {new Date(inviteInfo.start_date).toLocaleDateString()}</>}
                        </p>
                      )}
                    </div>
                    {!isVirtual && (pendingTaskMap.get(u.id) || 0) > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setTodoClientFilter(u.id); setActiveTab("todo"); }}
                        className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/15 px-3 py-1.5 text-gold hover:bg-gold/25 transition-colors shrink-0"
                      >
                        <ListTodo className="h-3.5 w-3.5" />
                        <span className="font-sans text-xs font-semibold">{pendingTaskMap.get(u.id)} pending</span>
                      </button>
                    )}
                  </div>
                  {/* Action buttons — limited for virtual invites */}
                  {isVirtual ? (
                    <div className="flex items-center gap-1.5">
                      <IconButtonWithTooltip tooltip="Resend Access Link" onClick={() => u.email && handleResendInvite(u.email)} className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1.5 text-gold hover:bg-gold/20 transition-colors">
                        <Send className="h-4 w-4" />
                        <span className="text-[10px] font-medium">{resendingEmail === u.email ? "Sending..." : "Resend Link"}</span>
                      </IconButtonWithTooltip>
                      <IconButtonWithTooltip tooltip="Cancel Invitation" onClick={async () => {
                        const realId = u.id.replace("inv-", "");
                        await supabase.from("email_invitations" as any).delete().eq("id", realId);
                        toast({ title: "Invitation cancelled" });
                        fetchInvitations();
                      }} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive hover:bg-destructive/20 transition-colors">
                        <Trash2 className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Cancel</span>
                      </IconButtonWithTooltip>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <IconButtonWithTooltip tooltip="Edit Client" onClick={() => setEditClientUserId(u.id)} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-primary hover:bg-primary/20 transition-colors">
                        <Pencil className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Edit</span>
                      </IconButtonWithTooltip>
                      <IconButtonWithTooltip tooltip="View Data" onClick={() => navigate(`/admin/client/${u.id}?view=data`)} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-primary hover:bg-primary/20 transition-colors">
                        <Ruler className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Data</span>
                      </IconButtonWithTooltip>
                      <IconButtonWithTooltip tooltip="Client Notes" onClick={() => setSelectedNotesUserId(u.id)} className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1.5 text-accent-foreground hover:bg-accent/80 transition-colors">
                        <StickyNote className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Notes</span>
                      </IconButtonWithTooltip>
                      <IconButtonWithTooltip tooltip="Generate Report" onClick={() => setSelectedReportUserId(u.id)} className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1.5 text-gold hover:bg-gold/20 transition-colors">
                        <FileText className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Report</span>
                      </IconButtonWithTooltip>
                      <IconButtonWithTooltip tooltip="Feature Access" onClick={() => setEditAccessUserId(u.id)} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-primary hover:bg-primary/20 transition-colors">
                        <Settings2 className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Access</span>
                      </IconButtonWithTooltip>
                      <IconButtonWithTooltip tooltip="Message Client" onClick={() => { setChatTargetClientId(u.id); setChatOpen(true); }} className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1.5 text-gold hover:bg-gold/20 transition-colors">
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Message</span>
                      </IconButtonWithTooltip>
                      {!u.approved ? (
                        <IconButtonWithTooltip tooltip="Approve User" onClick={() => setApproveUserId(u.id)} className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1.5 text-emerald-500 hover:bg-emerald-500/20 transition-colors">
                          <Check className="h-4 w-4" />
                          <span className="text-[10px] font-medium">Approve</span>
                        </IconButtonWithTooltip>
                      ) : (
                        <IconButtonWithTooltip tooltip="Deny User" onClick={() => denyUser(u.id)} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive hover:bg-destructive/20 transition-colors">
                          <X className="h-4 w-4" />
                          <span className="text-[10px] font-medium">Deny</span>
                        </IconButtonWithTooltip>
                      )}
                      <IconButtonWithTooltip tooltip="Delete User" onClick={() => setDeleteUserId(u.id)} className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive hover:bg-destructive/20 transition-colors">
                        <Trash2 className="h-4 w-4" />
                        <span className="text-[10px] font-medium">Delete</span>
                      </IconButtonWithTooltip>
                      {showResend && u.email && (
                        <IconButtonWithTooltip tooltip="Resend Direct Access Link" onClick={() => handleResendInvite(u.email!)} className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1.5 text-gold hover:bg-gold/20 transition-colors">
                          <Send className="h-4 w-4" />
                          <span className="text-[10px] font-medium">{resendingEmail === u.email ? "Sending..." : "Resend Link"}</span>
                        </IconButtonWithTooltip>
                      )}
                      {u.email && (
                        <IconButtonWithTooltip tooltip="Send Password Reset" onClick={() => handleSendPasswordReset(u.email!)} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-primary hover:bg-primary/20 transition-colors">
                          <KeyRound className="h-4 w-4" />
                          <span className="text-[10px] font-medium">
                            {resettingPasswordEmail === u.email ? "Sending..." : "Reset Password"}
                          </span>
                        </IconButtonWithTooltip>
                      )}
                      {u.email && (
                        <IconButtonWithTooltip tooltip="Copy Direct Access Link" onClick={() => handleCopyAccessLink(u.email!, inviteInfo?.language)} className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-1.5 text-gold hover:bg-gold/20 transition-colors">
                          <Link2 className="h-4 w-4" />
                          <span className="text-[10px] font-medium">
                            {copyingAccessEmail === u.email ? "Creating..." : "Copy Access"}
                          </span>
                        </IconButtonWithTooltip>
                      )}
                      {u.email && (
                        <IconButtonWithTooltip tooltip="Copy Reset Link" onClick={() => handleCopyResetLink(u.email!)} className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1.5 text-primary hover:bg-primary/20 transition-colors">
                          <Link2 className="h-4 w-4" />
                          <span className="text-[10px] font-medium">
                            {copyingResetEmail === u.email ? "Creating..." : "Copy Reset"}
                          </span>
                        </IconButtonWithTooltip>
                      )}
                      {u.email && (
                        <IconButtonWithTooltip tooltip={u.approved ? "Send Reconnect Email" : "Grant Access & Reconnect"} onClick={() => handleSendReconnect(u.email!, inviteInfo?.language)} className="flex items-center gap-1 rounded-lg bg-accent px-2 py-1.5 text-accent-foreground hover:bg-accent/80 transition-colors">
                          <RefreshCw className="h-4 w-4" />
                          <span className="text-[10px] font-medium">
                            {reconnectingEmail === u.email ? "Sending..." : u.approved ? "Reconnect" : "Grant & Reconnect"}
                          </span>
                        </IconButtonWithTooltip>
                      )}
                    </div>
                  )}
                  {!isVirtual && (
                    <div className="flex items-center gap-3 text-[10px] font-sans text-muted-foreground flex-wrap">
                      {activity && (
                        <>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-gold" />
                            {activity.action_count} searches
                          </span>
                          {activity.last_inquiry_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last: {new Date(activity.last_inquiry_at).toLocaleDateString()}
                            </span>
                          )}
                        </>
                      )}
                      {cost && cost.total_cost > 0 && (
                        <span className="flex items-center gap-1" title={`OpenAI: $${(cost.openai_cost / 10).toFixed(2)} | Google: $${(cost.google_cost / 10).toFixed(2)}`}>
                          <DollarSign className="h-3 w-3 text-gold" />
                          Est. cost: ${(cost.total_cost / 10).toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredUsers.length === 0 && (
              <p className="text-center font-sans text-sm text-muted-foreground py-8">No users in this category.</p>
            )}
          </div>
        )}

        {activeTab === "invites" && (
          <div className="space-y-8">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="space-y-1 mb-4">
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-gold">Direct entry access</p>
                <h3 className="font-serif text-lg font-semibold text-foreground">Invite and grant access in one step</h3>
                <p className="font-sans text-sm text-muted-foreground">
                  Admin-issued invite emails now approve the client immediately and send a direct-entry login link to the app.
                </p>
              </div>
              <InviteClientPanel />
            </div>
          </div>
        )}

        {activeTab === "programs" && <ProgramTemplateList />}

        {activeTab === "launch" && <LaunchReadinessPanel />}

        {activeTab === "feedback" && <FeedbackInboxPanel />}

        {activeTab === "calls" && <VideoCallsPanel />}

        {activeTab === "categories" && <ClientCategoriesPanel />}

        {activeTab === "todo" && <AdminTodoPanel clientFilter={todoClientFilter} onClearFilter={() => setTodoClientFilter(null)} />}

        {activeTab === "groups" && <AdminGroupManager />}

        {activeTab === "finance" && <FinanceDashboard />}
      </motion.div>

      <Dialog open={!!selectedNotesUserId} onOpenChange={(open) => !open && setSelectedNotesUserId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">
              Notes — {selectedNotesUser?.email || "Client"}
            </DialogTitle>
          </DialogHeader>
          {selectedNotesUserId && <ClientNotesPanel userId={selectedNotesUserId} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReportUserId} onOpenChange={(open) => !open && setSelectedReportUserId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-base">
              Report — {selectedReportUser?.email || "Client"}
            </DialogTitle>
          </DialogHeader>
          {selectedReportUserId && <AdminReportPanel userId={selectedReportUserId} />}
        </DialogContent>
      </Dialog>

      {selectedProgramUserId && (
        <ClientProgramDialog
          open={!!selectedProgramUserId}
          onOpenChange={(open) => !open && setSelectedProgramUserId(null)}
          userId={selectedProgramUserId}
          userEmail={selectedProgramUser?.email || "Client"}
        />
      )}

      {editEnrollmentUserId && (
        <EditEnrollmentDialog
          open={!!editEnrollmentUserId}
          onOpenChange={(open) => !open && setEditEnrollmentUserId(null)}
          userId={editEnrollmentUserId}
          userEmail={editEnrollmentUser?.email || "Client"}
          onSaved={() => fetchEnrollments()}
        />
      )}

      {approveUserId && (
        <ApproveUserDialog
          open={!!approveUserId}
          onOpenChange={(open) => !open && setApproveUserId(null)}
          userId={approveUserId}
          userEmail={approveUser2?.email || "Client"}
          onApproved={() => fetchUsers()}
        />
      )}

      {editAccessUserId && (
        <EditFeatureAccessDialog
          open={!!editAccessUserId}
          onOpenChange={(open) => !open && setEditAccessUserId(null)}
          userId={editAccessUserId}
          userEmail={editAccessUser?.email || "Client"}
        />
      )}

      {editClientUserId && (
        <EditClientDialog
          open={!!editClientUserId}
          onOpenChange={(open) => !open && setEditClientUserId(null)}
          userId={editClientUserId}
          userEmail={editClientUser?.email || "Client"}
          onSaved={() => fetchUsers()}
        />
      )}

      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete User</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm">
              This will permanently delete <strong>{deleteUserObj?.email}</strong> and all their data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-sans text-xs">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!mergeCandidate} onOpenChange={(open) => !open && setMergeCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Merge duplicate client profiles</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm leading-relaxed">
              Keep the current login profile for <strong>{mergeCandidate?.email}</strong>, move all migrated client data from the imported duplicate into it, and remove the duplicate row after the transfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-2xl border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground">
            <p>Keep current login profile: <span className="font-mono text-[11px] text-foreground">{mergeCandidate?.auth_profile_id}</span></p>
            <p className="mt-1">Move imported duplicate data from: <span className="font-mono text-[11px] text-foreground">{mergeCandidate?.legacy_profile_id}</span></p>
            <p className="mt-2 text-foreground">Nothing outside this same-email client pair will be touched.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMergeDuplicate}
              className="bg-gold text-gold-foreground hover:bg-gold/90 font-sans text-xs"
            >
              {mergingDuplicateEmail === mergeCandidate?.email ? "Merging..." : "Keep current login profile and merge data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChatBubble open={chatOpen} onOpenChange={(open) => { setChatOpen(open); if (!open) setChatTargetClientId(null); }} initialClientId={chatTargetClientId} />
      <ClientAccountabilityPanel open={accountabilityOpen} onOpenChange={setAccountabilityOpen} />
      <AddClientDialog open={addClientOpen} onOpenChange={setAddClientOpen} onClientAdded={() => { fetchUsers(); fetchEnrollments(); fetchInvitations(); }} />
    </div>
  );
};

export default Admin;
