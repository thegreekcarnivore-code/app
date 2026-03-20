import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Lock, CheckCircle2, Video, ChevronLeft, Maximize2, Minimize2, X,
  Plus, Trash2, Settings2, Search, Filter, BookOpen, Trophy, Clock, Upload, Loader2, GripVertical
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageActions } from "@/context/PageActionsContext";

interface VideoModule {
  id: string;
  program_template_id: string;
  title: string;
  description: string;
  image_url: string | null;
  sequence_order: number;
  is_sequential: boolean;
  unlock_after_days: number | null;
}

interface VideoItem {
  id: string;
  title: string;
  description: string;
  youtube_url: string;
  category: string;
  sequence_order: number;
  unlock_after_video_id: string | null;
  unlock_after_days: number | null;
  module_id: string | null;
  thumbnail_url: string | null;
}

const extractYoutubeId = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s?]+)/);
  return match ? match[1] : null;
};

/* ── Circular Progress Ring ── */
const ProgressRing = ({ progress, size = 80, strokeWidth = 6, className = "" }: { progress: number; size?: number; strokeWidth?: number; className?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))" strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="hsl(var(--gold))"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>
      <span className="absolute font-sans text-sm font-bold text-foreground">{progress}%</span>
    </div>
  );
};

/* ── Mini donut for cards ── */
const MiniDonut = ({ progress, size = 36 }: { progress: number; size?: number }) => {
  const sw = 3;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const o = c - (progress / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted)/0.5)" strokeWidth={sw} fill="hsl(var(--card)/0.85)" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--gold))" strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={o} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="fill-foreground" style={{ fontSize: 8, fontFamily: 'sans-serif', fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        {progress}%
      </text>
    </svg>
  );
};

/* ── Edit Module Dialog with Upload ── */
const EditModuleDialog = ({ editingModule, onClose, onUpdate }: {
  editingModule: VideoModule | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, any>) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingModule) return;
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `learn-covers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("recipe-images").upload(path, file, { contentType: file.type });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      onUpdate(editingModule.id, { image_url: data.publicUrl });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={!!editingModule} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-serif text-base">Επεξεργασια ενοτητας</DialogTitle></DialogHeader>
        {editingModule && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Τιτλος</Label>
              <Input defaultValue={editingModule.title} className="text-sm" onBlur={e => onUpdate(editingModule.id, { title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Περιγραφη</Label>
              <Textarea defaultValue={editingModule.description} className="text-sm min-h-[60px]" onBlur={e => onUpdate(editingModule.id, { description: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Εικονα εξωφυλλου</Label>
              <div className="flex flex-col gap-1.5 mt-0.5">
                <Input defaultValue={editingModule.image_url || ""} placeholder="URL η ανεβασμα" className="text-sm" onBlur={e => onUpdate(editingModule.id, { image_url: e.target.value || null })} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 h-8 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  <span>Ανεβασμα εικονας</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </div>
            </div>
            {editingModule.image_url && (
              <img src={editingModule.image_url} alt="Preview" className="w-full h-32 rounded-xl object-cover" />
            )}
            <div>
              <Label className="text-xs">Σειρα</Label>
              <Input type="number" defaultValue={editingModule.sequence_order} className="text-sm w-24" onBlur={e => onUpdate(editingModule.id, { sequence_order: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch checked={editingModule.is_sequential} onCheckedChange={val => onUpdate(editingModule.id, { is_sequential: val })} />
              <span className="font-sans text-xs text-muted-foreground">
                {editingModule.is_sequential ? "Σειριακη παρακολουθηση (πρεπει να δει με σειρα)" : "Ανεξαρτητη (οποιαδηποτε σειρα)"}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ── Video Thumbnail Upload (URL + file) ── */
const VideoThumbnailUpload = ({ value, onChange, isGreek }: { value: string; onChange: (url: string) => void; isGreek: boolean }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `learn-covers/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("recipe-images").upload(path, file, { contentType: file.type });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      onChange(data.publicUrl);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <Label className="text-xs">{isGreek ? "Thumbnail (προαιρετικό)" : "Custom Thumbnail (optional)"}</Label>
      <div className="flex flex-col gap-1.5 mt-0.5">
        <Input defaultValue={value} placeholder="URL ή ανέβασμα" className="text-sm" onBlur={e => onChange(e.target.value)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 h-8 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          <span>{isGreek ? "Ανέβασμα εικόνας" : "Upload image"}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {value && <img src={value} alt="Thumbnail" className="max-w-full max-h-32 rounded-lg object-contain mt-1.5" />}
    </div>
  );
};

type FilterMode = "all" | "in_progress" | "completed" | "locked";

const VideoLibrary = () => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const [modules, setModules] = useState<VideoModule[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [enrollmentStartDate, setEnrollmentStartDate] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<VideoModule | null>(null);
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [editingModule, setEditingModule] = useState<VideoModule | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [showPlayerCompleted, setShowPlayerCompleted] = useState(false);
  const [dragVideoId, setDragVideoId] = useState<string | null>(null);
  const [dragOverVideoId, setDragOverVideoId] = useState<string | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const isGreek = lang === "el";
  const { registerActions, clearActions } = usePageActions();

  useEffect(() => {
    registerActions({ featureKey: "video_library", featureLabel: "Video Library" });
    return () => clearActions();
  }, [registerActions, clearActions]);
  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    if (isAdmin) {
      const { data: templates } = await supabase
        .from("program_templates" as any).select("id").order("created_at" as any).limit(1);
      const { data: enrollments } = await supabase
        .from("client_program_enrollments" as any).select("id, program_template_id, start_date")
        .eq("user_id", user.id).eq("status", "active").limit(1);

      let tplId: string | null = null;
      if (enrollments && (enrollments as any[]).length > 0) {
        const enrollment = (enrollments as any[])[0];
        setEnrollmentId(enrollment.id);
        setEnrollmentStartDate(enrollment.start_date);
        tplId = enrollment.program_template_id;
      } else if (templates && (templates as any[]).length > 0) {
        tplId = (templates as any[])[0].id;
      }
      if (!tplId) return;
      setTemplateId(tplId);

      const [modulesRes, videosRes, progressRes] = await Promise.all([
        supabase.from("video_modules" as any).select("*").eq("program_template_id", tplId).order("sequence_order" as any),
        supabase.from("program_videos" as any).select("*").eq("program_template_id", tplId).order("sequence_order" as any),
        enrollmentId
          ? supabase.from("client_video_progress" as any).select("video_id").eq("enrollment_id", enrollmentId).eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
      ]);
      if (modulesRes.data) setModules(modulesRes.data as any[]);
      if (videosRes.data) setVideos(videosRes.data as any[]);
      if (progressRes.data) setCompletedIds(new Set((progressRes.data as any[]).map((p: any) => p.video_id)));
    } else {
      const { data: enrollments } = await supabase
        .from("client_program_enrollments" as any).select("id, program_template_id, start_date")
        .eq("user_id", user.id).eq("status", "active").limit(1);
      if (!enrollments || (enrollments as any[]).length === 0) return;
      const enrollment = (enrollments as any[])[0];
      setEnrollmentId(enrollment.id);
      setEnrollmentStartDate(enrollment.start_date);
      setTemplateId(enrollment.program_template_id);

      const [modulesRes, videosRes, progressRes] = await Promise.all([
        supabase.from("video_modules" as any).select("*").eq("program_template_id", enrollment.program_template_id).order("sequence_order" as any),
        supabase.from("program_videos" as any).select("*").eq("program_template_id", enrollment.program_template_id).order("sequence_order" as any),
        supabase.from("client_video_progress" as any).select("video_id").eq("enrollment_id", enrollment.id).eq("user_id", user.id),
      ]);
      if (modulesRes.data) setModules(modulesRes.data as any[]);
      if (videosRes.data) setVideos(videosRes.data as any[]);
      if (progressRes.data) setCompletedIds(new Set((progressRes.data as any[]).map((p: any) => p.video_id)));
    }
  };

  const getDaysSinceStart = () => {
    if (!enrollmentStartDate) return 999;
    const start = new Date(enrollmentStartDate);
    return Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isModuleUnlocked = (module: VideoModule) => {
    if (isAdmin) return true;
    if (module.unlock_after_days != null && getDaysSinceStart() < module.unlock_after_days) return false;
    // Cross-module sequential locking: all videos in ALL previous modules must be completed
    const sortedModules = [...modules].sort((a, b) => a.sequence_order - b.sequence_order);
    const modIdx = sortedModules.findIndex(m => m.id === module.id);
    for (let i = 0; i < modIdx; i++) {
      const prevModuleVideos = videos.filter(v => v.module_id === sortedModules[i].id);
      const allCompleted = prevModuleVideos.length > 0 && prevModuleVideos.every(v => completedIds.has(v.id));
      if (!allCompleted) return false;
    }
    return true;
  };

  const isVideoUnlocked = (video: VideoItem, moduleVideos: VideoItem[], module: VideoModule) => {
    if (isAdmin) return true;
    if (!isModuleUnlocked(module)) return false;
    if (video.unlock_after_days != null && getDaysSinceStart() < video.unlock_after_days) return false;
    // Always enforce sequential order: must complete previous video first
    const idx = moduleVideos.findIndex(v => v.id === video.id);
    if (idx === 0) return true;
    return completedIds.has(moduleVideos[idx - 1].id);
  };

  const markWatched = async (videoId: string) => {
    if (!enrollmentId || completedIds.has(videoId)) return;
    const { error } = await supabase.from("client_video_progress" as any).insert({
      user_id: user!.id, video_id: videoId, enrollment_id: enrollmentId,
    } as any);
    if (!error) {
      setCompletedIds(prev => new Set([...prev, videoId]));
      toast({ title: isGreek ? "Σημειώθηκε ως προβεβλημένο ✓" : "Marked as watched ✓" });
    }
  };

  const unmarkWatched = async (videoId: string) => {
    if (!enrollmentId || !completedIds.has(videoId)) return;
    const { error } = await supabase.from("client_video_progress" as any)
      .delete()
      .eq("video_id", videoId)
      .eq("enrollment_id", enrollmentId)
      .eq("user_id", user!.id);
    if (!error) {
      setCompletedIds(prev => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
      toast({ title: isGreek ? "Αναίρεση ολοκλήρωσης" : "Unmarked as watched" });
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const getModuleProgress = (moduleId: string) => {
    const mv = videos.filter(v => v.module_id === moduleId);
    if (mv.length === 0) return 0;
    return Math.round((mv.filter(v => completedIds.has(v.id)).length / mv.length) * 100);
  };

  // ── Stats ──
  const totalVideos = videos.length;
  const totalCompleted = videos.filter(v => completedIds.has(v.id)).length;
  const overallProgress = totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0;
  const completedModules = modules.filter(m => getModuleProgress(m.id) === 100).length;

  // ── Continue Watching ──
  const continueVideo = useMemo(() => {
    for (const mod of modules) {
      if (!isModuleUnlocked(mod)) continue;
      const mv = videos.filter(v => v.module_id === mod.id).sort((a, b) => a.sequence_order - b.sequence_order);
      for (const v of mv) {
        if (!completedIds.has(v.id) && isVideoUnlocked(v, mv, mod)) {
          return { video: v, module: mod };
        }
      }
    }
    return null;
  }, [modules, videos, completedIds]);

  // ── Filtered modules ──
  const filteredModules = useMemo(() => {
    // Show all modules (including locked ones) for everyone
    let result = [...modules];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchingModuleIds = new Set<string>();
      result.forEach(m => { if (m.title.toLowerCase().includes(q)) matchingModuleIds.add(m.id); });
      videos.forEach(v => { if (v.title.toLowerCase().includes(q) && v.module_id) matchingModuleIds.add(v.module_id); });
      result = result.filter(m => matchingModuleIds.has(m.id));
    }
    if (filterMode !== "all") {
      result = result.filter(m => {
        const p = getModuleProgress(m.id);
        if (filterMode === "completed") return p === 100;
        if (filterMode === "in_progress") return p > 0 && p < 100;
        if (filterMode === "locked") return !isModuleUnlocked(m) || p === 0;
        return true;
      });
    }
    return result;
  }, [modules, videos, searchQuery, filterMode, isAdmin]);

  // ── Admin CRUD helpers ──
  const addModule = async () => {
    if (!templateId) return;
    const { error } = await supabase.from("video_modules" as any).insert({
      program_template_id: templateId, title: isGreek ? "Νέο Module" : "New Module",
      description: "", sequence_order: modules.length, is_sequential: true,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const updateModule = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("video_modules" as any).update(updates as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const deleteModule = async (id: string) => {
    await supabase.from("program_videos" as any).update({ module_id: null } as any).eq("module_id", id);
    const { error } = await supabase.from("video_modules" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { loadData(); if (selectedModule?.id === id) setSelectedModule(null); }
  };

  const addVideo = async (moduleId: string) => {
    if (!templateId) return;
    const moduleVideos = videos.filter(v => v.module_id === moduleId);
    const { error } = await supabase.from("program_videos" as any).insert({
      program_template_id: templateId, module_id: moduleId, title: "",
      youtube_url: "", category: "general", sequence_order: moduleVideos.length,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const updateVideo = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase.from("program_videos" as any).update(updates as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const deleteVideo = async (id: string) => {
    await supabase.from("program_videos" as any).update({ unlock_after_video_id: null } as any).eq("unlock_after_video_id", id);
    const { error } = await supabase.from("program_videos" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const reorderVideos = async (moduleId: string, fromIndex: number, toIndex: number) => {
    const moduleVideos = videos.filter(v => v.module_id === moduleId).sort((a, b) => a.sequence_order - b.sequence_order);
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= moduleVideos.length || toIndex >= moduleVideos.length) return;
    const reordered = [...moduleVideos];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    // Optimistic update
    setVideos(prev => prev.map(v => {
      if (v.module_id !== moduleId) return v;
      const idx = reordered.findIndex(r => r.id === v.id);
      return idx >= 0 ? { ...v, sequence_order: idx } : v;
    }));
    await Promise.all(reordered.map((v, i) =>
      supabase.from("program_videos" as any).update({ sequence_order: i } as any).eq("id", v.id)
    ));
  };

  const handleVideoDrop = (moduleId: string, targetVideoId: string) => {
    if (!dragVideoId || dragVideoId === targetVideoId) { setDragVideoId(null); setDragOverVideoId(null); return; }
    const moduleVideos = videos.filter(v => v.module_id === moduleId).sort((a, b) => a.sequence_order - b.sequence_order);
    const fromIndex = moduleVideos.findIndex(v => v.id === dragVideoId);
    const toIndex = moduleVideos.findIndex(v => v.id === targetVideoId);
    reorderVideos(moduleId, fromIndex, toIndex);
    setDragVideoId(null);
    setDragOverVideoId(null);
  };

  // ═══════════════════════════════════════════
  // ── MODULE LISTING VIEW ──
  // ═══════════════════════════════════════════
  if (!selectedModule) {
    const filterOptions: { key: FilterMode; label: string }[] = [
      { key: "all", label: isGreek ? "Όλα" : "All" },
      { key: "in_progress", label: isGreek ? "Σε εξέλιξη" : "In Progress" },
      { key: "completed", label: isGreek ? "Ολοκληρωμένα" : "Completed" },
      { key: "locked", label: isGreek ? "Κλειδωμένα" : "Not Started" },
    ];

    return (
      <div className="pt-16 pb-24 space-y-5 px-1">
        {/* ── Hero Section ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-gold/5"
        >
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-gold/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />

          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-2xl font-bold text-foreground tracking-tight">
                    {isGreek ? "Μαθήματα" : "Learn"}
                  </h1>
                </div>
                <p className="font-sans text-xs text-muted-foreground">
                  {isGreek ? "Η εκπαιδευτική σας βιβλιοθήκη" : "Your learning library"}
                </p>
              </div>

              {/* Admin toggle */}
              {isAdmin && (
                <button
                  onClick={() => setAdminMode(!adminMode)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-sans font-medium transition-all ${
                    adminMode ? "bg-gold text-gold-foreground shadow-md" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {adminMode ? (isGreek ? "Επεξεργασία" : "Editing") : (isGreek ? "Διαχείριση" : "Manage")}
                </button>
              )}
            </div>

            {/* Progress Dashboard */}
            {totalVideos > 0 && !adminMode && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-5 flex items-center gap-5"
              >
                <ProgressRing progress={overallProgress} size={76} strokeWidth={5} />
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div className="text-center rounded-xl bg-muted/40 py-2.5 px-1">
                    <p className="font-sans text-lg font-bold text-foreground">{totalCompleted}</p>
                    <p className="font-sans text-[9px] text-muted-foreground leading-tight">{isGreek ? "Βίντεο" : "Videos"}<br />{isGreek ? "προβλήθηκαν" : "watched"}</p>
                  </div>
                  <div className="text-center rounded-xl bg-muted/40 py-2.5 px-1">
                    <p className="font-sans text-lg font-bold text-foreground">{completedModules}</p>
                    <p className="font-sans text-[9px] text-muted-foreground leading-tight">{isGreek ? "Ενότητες" : "Modules"}<br />{isGreek ? "ολοκληρώθηκαν" : "done"}</p>
                  </div>
                  <div className="text-center rounded-xl bg-muted/40 py-2.5 px-1">
                    <p className="font-sans text-lg font-bold text-gold">{overallProgress}%</p>
                    <p className="font-sans text-[9px] text-muted-foreground leading-tight">{isGreek ? "Συνολικά" : "Overall"}<br />{isGreek ? "πρόοδος" : "progress"}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ── Continue Watching ── */}
        {continueVideo && !adminMode && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={() => {
              setSelectedModule(continueVideo.module);
              setTimeout(() => setPlayingVideo(continueVideo.video), 200);
            }}
            className="w-full text-left rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/8 via-card to-card overflow-hidden hover:border-gold/50 hover:shadow-lg hover:shadow-gold/10 transition-all duration-300 group"
          >
            <div className="flex items-center gap-3 p-3">
              {/* Thumbnail */}
              <div className="relative w-28 h-[72px] rounded-xl overflow-hidden flex-shrink-0">
                {continueVideo.video.thumbnail_url ? (
                  <img src={continueVideo.video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                ) : extractYoutubeId(continueVideo.video.youtube_url) ? (
                  <img src={`https://img.youtube.com/vi/${extractYoutubeId(continueVideo.video.youtube_url)}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gold/20 via-muted to-primary/10 flex items-center justify-center">
                    <Video className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gold/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="h-5 w-5 text-gold-foreground ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="font-sans text-[10px] uppercase tracking-wider text-gold font-semibold">
                  {isGreek ? "Συνεχίστε" : "Continue Watching"}
                </p>
                <p className="font-sans text-sm font-bold text-foreground leading-tight truncate">
                  {continueVideo.video.title || "Untitled"}
                </p>
                <p className="font-sans text-[10px] text-muted-foreground truncate">
                  {continueVideo.module.title}
                </p>
              </div>
            </div>
          </motion.button>
        )}

        {/* ── Search & Filter ── */}
        {!adminMode && modules.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isGreek ? "Αναζήτηση βίντεο ή module..." : "Search videos or modules..."}
                className="pl-9 h-9 text-xs rounded-xl bg-card border-border"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {filterOptions.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterMode(f.key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-sans font-medium transition-all ${
                    filterMode === f.key
                      ? "bg-gold text-gold-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Admin: Add module */}
        {adminMode && (
          <motion.button initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={addModule}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/30 py-4 text-sm font-sans font-medium text-gold hover:border-gold/60 hover:bg-gold/5 transition-all"
          >
            <Plus className="h-4 w-4" /> {isGreek ? "Προσθήκη Module" : "Add Module"}
          </motion.button>
        )}

        {/* ── Module Cards ── */}
        {filteredModules.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-muted to-muted/50 mb-5 shadow-inner">
              <BookOpen className="h-9 w-9 text-muted-foreground/40" />
            </div>
            <h3 className="font-serif text-lg font-bold text-foreground mb-1.5">
              {searchQuery || filterMode !== "all"
                ? (isGreek ? "Δεν βρέθηκαν αποτελέσματα" : "No results found")
                : (isGreek ? "Ξεκινήστε το ταξίδι σας" : "Start your journey")}
            </h3>
            <p className="font-sans text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {searchQuery || filterMode !== "all"
                ? (isGreek ? "Δοκιμάστε μια διαφορετική αναζήτηση ή φίλτρο" : "Try a different search or filter")
                : (isGreek ? "Τα εκπαιδευτικά σας modules θα εμφανιστούν εδώ μόλις γίνουν διαθέσιμα." : "Your learning modules will appear here once they're available.")}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 grid-cols-1">
            {filteredModules.map((mod, i) => {
              const progress = getModuleProgress(mod.id);
              const videoCount = videos.filter(v => v.module_id === mod.id).length;
              const completedCount = videos.filter(v => v.module_id === mod.id && completedIds.has(v.id)).length;
              const isComplete = progress === 100 && videoCount > 0;

              const locked = !isAdmin && !isModuleUnlocked(mod);

              return (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className={`group relative rounded-2xl border bg-card overflow-hidden transition-all duration-300 ${
                    locked
                      ? "border-border/50 opacity-60"
                      : "border-border hover:border-gold/40 hover:shadow-xl hover:shadow-gold/5 hover:-translate-y-0.5"
                  }`}
                >
                  <button
                    onClick={() => { if (!locked) setSelectedModule(mod); }}
                    disabled={locked}
                    className="w-full text-left flex items-stretch"
                  >
                    {/* Small cover image */}
                    <div className="relative w-24 min-h-[5rem] flex-shrink-0 overflow-hidden">
                      {mod.image_url ? (
                        <>
                          <img
                            src={mod.image_url} alt=""
                            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted via-muted/70 to-primary/5 flex items-center justify-center">
                          <Video className="h-6 w-6 text-muted-foreground/20" />
                        </div>
                      )}

                      {/* Completed badge */}
                      {isComplete && (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-gold/90 backdrop-blur-sm px-1.5 py-0.5 shadow-lg">
                          <Trophy className="h-2.5 w-2.5 text-gold-foreground" />
                        </div>
                      )}

                      {/* Lock icon overlay for locked modules */}
                      {locked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                          <Lock className="h-5 w-5 text-white/70" />
                        </div>
                      )}

                      {/* Mini donut progress overlay */}
                      {videoCount > 0 && !isComplete && !locked && (
                        <div className="absolute bottom-1.5 left-1.5">
                          <MiniDonut progress={progress} />
                        </div>
                      )}
                    </div>

                    {/* Text area */}
                    <div className="flex-1 p-3 space-y-1 min-w-0">
                      <h3 className="font-serif text-sm font-bold text-foreground leading-tight truncate">{mod.title || "Untitled"}</h3>
                      {mod.description && (
                        <p className="font-sans text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{mod.description}</p>
                      )}
                      <div className="flex items-center gap-2 pt-0.5">
                        {videoCount > 0 && (
                          <span className="font-sans text-[10px] text-muted-foreground">
                            {completedCount}/{videoCount} {isGreek ? "βίντεο" : "videos"}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-sans font-medium ${
                          mod.is_sequential ? "bg-gold/10 text-gold" : "bg-primary/10 text-primary"
                        }`}>
                          {mod.is_sequential ? (isGreek ? "Σειριακά" : "Sequential") : (isGreek ? "Ανεξάρτητα" : "Independent")}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Admin overlay */}
                  {adminMode && (
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditingModule(mod); }}
                        className="rounded-lg bg-black/60 backdrop-blur-sm p-1.5 text-white/80 hover:text-white transition-colors">
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteModule(mod.id); }}
                        className="rounded-lg bg-black/60 backdrop-blur-sm p-1.5 text-red-400 hover:text-red-300 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Edit module dialog */}
        <EditModuleDialog
          editingModule={editingModule}
          onClose={() => { setEditingModule(null); loadData(); }}
          onUpdate={(id, updates) => {
            updateModule(id, updates);
            setEditingModule(prev => prev ? { ...prev, ...updates } : null);
          }}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ── MODULE DETAIL VIEW ──
  // ═══════════════════════════════════════════
  const moduleVideos = videos.filter(v => v.module_id === selectedModule.id).sort((a, b) => a.sequence_order - b.sequence_order);
  const moduleCompletedCount = moduleVideos.filter(v => completedIds.has(v.id)).length;
  const moduleProgress = moduleVideos.length > 0 ? Math.round((moduleCompletedCount / moduleVideos.length) * 100) : 0;
  const remainingCount = moduleVideos.length - moduleCompletedCount;

  return (
    <div className="pt-16 pb-24 space-y-4 px-1">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {/* Back */}
        <button onClick={() => setSelectedModule(null)} className="flex items-center gap-1.5 font-sans text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> {isGreek ? "Πίσω στα modules" : "Back to modules"}
        </button>

        {/* Module header with image */}
        {selectedModule.image_url ? (
          <div className="relative w-full rounded-2xl overflow-hidden">
            <img src={selectedModule.image_url} alt="" className="w-full h-52 rounded-2xl object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="font-serif text-xl font-bold text-white">{selectedModule.title}</h1>
                {selectedModule.description && (
                  <p className="font-sans text-[11px] text-white/70 mt-1 line-clamp-2">{selectedModule.description}</p>
                )}
              </div>
              {moduleVideos.length > 0 && (
                <ProgressRing progress={moduleProgress} size={52} strokeWidth={4} className="flex-shrink-0" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-xl font-bold text-foreground">{selectedModule.title}</h1>
              {selectedModule.description && <p className="font-sans text-xs text-muted-foreground mt-1">{selectedModule.description}</p>}
            </div>
            {moduleVideos.length > 0 && (
              <ProgressRing progress={moduleProgress} size={52} strokeWidth={4} />
            )}
          </div>
        )}

        {/* Module stats row */}
        {moduleVideos.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-sans text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-gold" />
              {moduleCompletedCount}/{moduleVideos.length} {isGreek ? "ολοκληρωμένα" : "completed"}
            </div>
            {remainingCount > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] font-sans text-muted-foreground">
                <Clock className="h-3 w-3" />
                {remainingCount} {isGreek ? "απομένουν" : "remaining"}
              </div>
            )}
          </div>
        )}

        {selectedModule.is_sequential && (
          <div className="flex items-center gap-2 rounded-xl bg-gold/5 border border-gold/20 px-3 py-2">
            <Lock className="h-3.5 w-3.5 text-gold" />
            <p className="font-sans text-[11px] text-gold">
              {isGreek ? "Παρακολουθήστε τα βίντεο με σειρά για να ξεκλειδώσετε τα επόμενα" : "Watch videos in order to unlock the next"}
            </p>
          </div>
        )}
      </motion.div>

      {/* Admin: add video */}
      {adminMode && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => addVideo(selectedModule.id)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/30 py-3 text-xs font-sans font-medium text-gold hover:border-gold/60 hover:bg-gold/5 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> {isGreek ? "Προσθήκη Βίντεο" : "Add Video"}
        </motion.button>
      )}

      {/* ── Video checklist ── */}
      <div className="space-y-2">
        {moduleVideos.map((video, idx) => {
          const unlocked = isVideoUnlocked(video, moduleVideos, selectedModule);
          const completed = completedIds.has(video.id);
          const ytId = extractYoutubeId(video.youtube_url);
          const isTimeGated = video.unlock_after_days != null && getDaysSinceStart() < video.unlock_after_days;

          return (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              draggable={adminMode}
              onDragStart={(e: any) => { if (adminMode) { e.dataTransfer.effectAllowed = "move"; setDragVideoId(video.id); } }}
              onDragOver={(e: any) => { if (adminMode) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverVideoId(video.id); } }}
              onDrop={(e: any) => { if (adminMode) { e.preventDefault(); handleVideoDrop(selectedModule.id, video.id); } }}
              onDragEnd={() => { setDragVideoId(null); setDragOverVideoId(null); }}
              className={`${adminMode && dragVideoId === video.id ? "opacity-40 scale-95" : ""} ${adminMode && dragOverVideoId === video.id && dragVideoId !== video.id ? "ring-2 ring-primary rounded-2xl" : ""} transition-all`}
            >
              <button
                onClick={() => unlocked && setPlayingVideo(video)}
                disabled={!unlocked}
                className={`w-full text-left rounded-2xl border overflow-hidden transition-all duration-300 ${
                  completed
                    ? "border-gold/30 bg-gradient-to-r from-gold/8 to-card shadow-sm"
                    : unlocked
                      ? "border-border bg-card hover:border-gold/40 hover:shadow-md hover:shadow-gold/5"
                      : "border-border/40 bg-card/50 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Drag handle in admin mode */}
                  {adminMode && (
                    <div className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground touch-none flex-shrink-0">
                      <GripVertical className="h-4 w-4" />
                    </div>
                  )}
                  {/* Checklist number */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-sans font-bold border-2 transition-colors ${
                    completed
                      ? "bg-gold border-gold text-gold-foreground"
                      : unlocked
                        ? "bg-transparent border-muted-foreground/30 text-foreground"
                        : "bg-muted/30 border-muted-foreground/15 text-muted-foreground"
                  }`}>
                    {completed ? <CheckCircle2 className="h-4.5 w-4.5" /> : !unlocked ? <Lock className="h-3.5 w-3.5" /> : idx + 1}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    {unlocked && (video.thumbnail_url
                      ? <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : ytId
                        ? <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-gradient-to-br from-gold/20 via-muted to-primary/10 flex items-center justify-center"><Video className="h-4 w-4 text-muted-foreground/30" /></div>
                    )}
                    {!unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <Lock className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                    {unlocked && !completed && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                          <Play className="h-4 w-4 text-foreground ml-0.5" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-sans text-sm font-semibold leading-tight ${completed ? "text-gold" : "text-foreground"}`}>
                      {video.title || `Video ${idx + 1}`}
                    </p>
                    {video.description && (
                      <p className="font-sans text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{video.description}</p>
                    )}
                    {isTimeGated && (
                      <p className="font-sans text-[10px] text-destructive mt-1 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        {isGreek ? `Ξεκλειδώνει την ημέρα ${video.unlock_after_days}` : `Unlocks on day ${video.unlock_after_days}`}
                      </p>
                    )}
                  </div>

                  {/* Mark/Unmark button on card */}
                  {unlocked && completed && enrollmentId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unmarkWatched(video.id);
                      }}
                      className="flex-shrink-0 w-8 h-8 rounded-full bg-gold flex items-center justify-center text-gold-foreground hover:bg-gold/70 transition-all duration-200"
                      title={isGreek ? "Αναίρεση" : "Undo"}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                  {unlocked && !completed && enrollmentId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markWatched(video.id);
                      }}
                      className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-gold/40 flex items-center justify-center text-gold/60 hover:bg-gold hover:text-gold-foreground hover:border-gold transition-all duration-200"
                      title={isGreek ? "Ολοκληρώθηκε" : "Mark as done"}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </button>

              {/* Admin strip */}
              {adminMode && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-b-xl border border-t-0 border-border/50">
                  <button onClick={() => setEditingVideo(video)} className="font-sans text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    <Settings2 className="h-3 w-3" />
                  </button>
                  <button onClick={() => deleteVideo(video.id)} className="font-sans text-[10px] text-destructive hover:text-destructive/80 transition-colors">
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <span className="font-sans text-[9px] text-muted-foreground ml-auto">
                    #{video.sequence_order} {video.unlock_after_days != null && `· day ${video.unlock_after_days}`}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Edit video dialog */}
      <Dialog open={!!editingVideo} onOpenChange={o => { if (!o) { setEditingVideo(null); loadData(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-serif text-base">{isGreek ? "Επεξεργασία Βίντεο" : "Edit Video"}</DialogTitle></DialogHeader>
          {editingVideo && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{isGreek ? "Τίτλος" : "Title"}</Label>
                <Input defaultValue={editingVideo.title} className="text-sm" onBlur={e => updateVideo(editingVideo.id, { title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">YouTube URL</Label>
                <Input defaultValue={editingVideo.youtube_url} placeholder="https://youtube.com/watch?v=..." className="text-sm" onBlur={e => updateVideo(editingVideo.id, { youtube_url: e.target.value })} />
              </div>
              <VideoThumbnailUpload
                value={(editingVideo as any).thumbnail_url || ""}
                onChange={(url) => updateVideo(editingVideo.id, { thumbnail_url: url || null })}
                isGreek={isGreek}
              />
              <div>
                <Label className="text-xs">{isGreek ? "Περιγραφή" : "Description"}</Label>
                <Textarea defaultValue={editingVideo.description} className="text-sm min-h-[50px]" onBlur={e => updateVideo(editingVideo.id, { description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{isGreek ? "Σειρά" : "Order"}</Label>
                  <Input type="number" defaultValue={editingVideo.sequence_order} className="text-sm" onBlur={e => updateVideo(editingVideo.id, { sequence_order: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">{isGreek ? "Αποκάλυψη μετά ημέρα" : "Reveal after day"}</Label>
                  <Input type="number" defaultValue={editingVideo.unlock_after_days ?? ""} placeholder="—" className="text-sm" onBlur={e => updateVideo(editingVideo.id, { unlock_after_days: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Video player overlay ── */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            ref={playerContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-black/90 to-transparent">
              <p className="font-sans text-xs text-white/80 truncate flex-1 font-medium">{playingVideo.title}</p>
              <div className="flex items-center gap-2">
                <button onClick={toggleFullscreen} className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button onClick={() => setPlayingVideo(null)} className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center bg-black relative">
              <iframe
                src={`https://www.youtube.com/embed/${extractYoutubeId(playingVideo.youtube_url)}?autoplay=1&rel=0&modestbranding=1&playsinline=1&showinfo=0&iv_load_policy=3&fs=0&disablekb=0&origin=${encodeURIComponent(window.location.origin)}`}
                className="w-full h-full max-h-[80vh]"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
              {/* Transparent overlay to block right-click / long-press YouTube links */}
              <div
                className="absolute inset-0 z-10"
                onContextMenu={e => e.preventDefault()}
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => {
                  // Allow clicks to pass through to the iframe for playback controls
                  // by only blocking context menu, not regular clicks
                  e.currentTarget.style.pointerEvents = 'none';
                  setTimeout(() => { e.currentTarget.style.pointerEvents = 'auto'; }, 300);
                }}
              />
            </div>

            <div className="px-4 py-4 bg-gradient-to-t from-black/90 to-transparent space-y-3">
              {playingVideo.description && <p className="font-sans text-[11px] text-white/50 leading-relaxed">{playingVideo.description}</p>}

              <AnimatePresence mode="wait">
                {showPlayerCompleted ? (
                  <motion.div
                    key="completed"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold py-3 shadow-lg"
                  >
                    <CheckCircle2 className="h-5 w-5 text-gold-foreground" />
                    <span className="font-sans text-sm font-bold text-gold-foreground">
                      {isGreek ? "Ολοκληρώθηκε!" : "Completed!"}
                    </span>
                  </motion.div>
                ) : completedIds.has(playingVideo.id) ? (
                  <motion.div
                    key="already-done"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold/20 border border-gold/30 py-3 relative"
                  >
                    <CheckCircle2 className="h-4 w-4 text-gold" />
                    <span className="font-sans text-sm font-semibold text-gold">
                      {isGreek ? "Ολοκληρώθηκε" : "Completed"}
                    </span>
                    <button
                      onClick={() => unmarkWatched(playingVideo.id)}
                      className="absolute right-3 font-sans text-[10px] text-white/50 hover:text-white underline transition-colors"
                    >
                      {isGreek ? "Αναίρεση" : "Undo"}
                    </button>
                  </motion.div>
                ) : enrollmentId ? (
                  <motion.button
                    key="terminate"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => {
                      markWatched(playingVideo.id);
                      setShowPlayerCompleted(true);
                      setTimeout(() => {
                        setShowPlayerCompleted(false);
                        setPlayingVideo(null);
                      }, 1200);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold py-3 font-sans text-sm font-bold text-gold-foreground hover:opacity-90 transition-opacity shadow-lg shadow-gold/20"
                  >
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    {isGreek ? "Ολοκληρώθηκε" : "Terminated"}
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VideoLibrary;
