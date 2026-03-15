import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Play, Lock, Image, Video, Clock, Upload, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";

const uploadImage = async (file: File, folder: string): Promise<string | null> => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("recipe-images").upload(path, file, { contentType: file.type });
  if (error) {
    toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    return null;
  }
  const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
  return data.publicUrl;
};

const ImageUploadField = ({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file, "learn-covers");
    if (url) onChange(url);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <div className="flex flex-col gap-1.5 mt-0.5">
        <Input
          defaultValue={value}
          placeholder="URL η ανεβασμα"
          className="h-8 text-xs flex-1"
          onBlur={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 h-8 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          <span>Ανεβασμα εικονας</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
};

interface VideoModule {
  id: string;
  program_template_id: string;
  title: string;
  description: string;
  image_url: string | null;
  sequence_order: number;
  is_sequential: boolean;
  unlock_after_days: number | null;
  created_at: string;
}

interface ProgramVideo {
  id: string;
  program_template_id: string;
  module_id: string | null;
  title: string;
  description: string;
  youtube_url: string;
  category: string;
  sequence_order: number;
  unlock_after_video_id: string | null;
  unlock_after_days: number | null;
}

const VideoModuleManager = ({ templateId }: { templateId: string }) => {
  const [modules, setModules] = useState<VideoModule[]>([]);
  const [videos, setVideos] = useState<ProgramVideo[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingModule, setEditingModule] = useState<VideoModule | null>(null);
  const [addVideoModuleId, setAddVideoModuleId] = useState<string | null>(null);
  const [dragVideoId, setDragVideoId] = useState<string | null>(null);
  const [dragOverVideoId, setDragOverVideoId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [templateId]);

  const loadData = async () => {
    const [modRes, vidRes] = await Promise.all([
      supabase.from("video_modules" as any).select("*").eq("program_template_id", templateId).order("sequence_order" as any),
      supabase.from("program_videos" as any).select("*").eq("program_template_id", templateId).order("sequence_order" as any),
    ]);
    if (modRes.data) setModules(modRes.data as any[]);
    if (vidRes.data) setVideos(vidRes.data as any[]);
  };

  const addModule = async () => {
    const { error } = await supabase.from("video_modules" as any).insert({
      program_template_id: templateId,
      title: "New Module",
      description: "",
      sequence_order: modules.length,
      is_sequential: true,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const updateModule = async (id: string, updates: Partial<VideoModule>) => {
    const { error } = await supabase.from("video_modules" as any).update(updates as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const deleteModule = async (id: string) => {
    // Unassign videos first
    await supabase.from("program_videos" as any).update({ module_id: null } as any).eq("module_id", id);
    const { error } = await supabase.from("video_modules" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const addVideo = async (moduleId: string) => {
    const moduleVideos = videos.filter(v => v.module_id === moduleId);
    const { error } = await supabase.from("program_videos" as any).insert({
      program_template_id: templateId,
      module_id: moduleId,
      title: "",
      youtube_url: "",
      category: "general",
      sequence_order: moduleVideos.length,
    } as any);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const updateVideo = async (id: string, updates: Partial<ProgramVideo>) => {
    const { error } = await supabase.from("program_videos" as any).update(updates as any).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const deleteVideo = async (id: string) => {
    // Clear any unlock_after_video_id references
    await supabase.from("program_videos" as any).update({ unlock_after_video_id: null } as any).eq("unlock_after_video_id", id);
    const { error } = await supabase.from("program_videos" as any).delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else loadData();
  };

  const toggleExpanded = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reorderVideos = async (moduleId: string, fromIndex: number, toIndex: number) => {
    const moduleVideos = videos.filter(v => v.module_id === moduleId).sort((a, b) => a.sequence_order - b.sequence_order);
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= moduleVideos.length || toIndex >= moduleVideos.length) return;
    const reordered = [...moduleVideos];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    // Optimistic update
    const updatedVideos = videos.map(v => {
      if (v.module_id !== moduleId) return v;
      const idx = reordered.findIndex(r => r.id === v.id);
      return idx >= 0 ? { ...v, sequence_order: idx } : v;
    });
    setVideos(updatedVideos);
    // Persist
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

  const unassignedVideos = videos.filter(v => !v.module_id);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm font-semibold text-foreground">Ενοτητες βιντεο</h3>
        <button onClick={addModule} className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
          <Plus className="h-3 w-3" /> Προσθηκη ενοτητας
        </button>
      </div>

      {modules.map((mod) => {
        const moduleVideos = videos.filter(v => v.module_id === mod.id).sort((a, b) => a.sequence_order - b.sequence_order);
        const isOpen = expandedModules.has(mod.id);

        return (
          <div key={mod.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleExpanded(mod.id)}>
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              {mod.image_url ? (
                <img src={mod.image_url} alt="" className="h-8 w-8 rounded-md object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                  <Video className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-medium text-foreground truncate">{mod.title || "Untitled Module"}</p>
                <p className="font-sans text-[10px] text-muted-foreground">
                  {moduleVideos.length} βιντεο · {mod.is_sequential ? "Σειριακη" : "Ανεξαρτητη"}
                  {mod.unlock_after_days != null && <span className="ml-1 inline-flex items-center gap-0.5 text-gold"><Clock className="h-2.5 w-2.5" />Ημερα {mod.unlock_after_days}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => setEditingModule(mod)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md"><Upload className="h-3.5 w-3.5" /></button>
                <button onClick={() => deleteModule(mod.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-border p-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Τιτλος</Label>
                    <Input defaultValue={mod.title} className="h-8 text-xs" onBlur={e => { updateModule(mod.id, { title: e.target.value } as any); setModules(prev => prev.map(m => m.id === mod.id ? { ...m, title: e.target.value } : m)); }} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Σειρα</Label>
                    <Input type="number" defaultValue={mod.sequence_order} className="h-8 text-xs" onBlur={e => updateModule(mod.id, { sequence_order: Number(e.target.value) } as any)} />
                  </div>
                  <div>
                    <Label className="text-[10px]">Εμφανιση μετα απο ημερα</Label>
                    <Input type="number" defaultValue={mod.unlock_after_days ?? ""} placeholder="—" className="h-8 text-xs" onBlur={e => { const val = e.target.value ? Number(e.target.value) : null; updateModule(mod.id, { unlock_after_days: val } as any); setModules(prev => prev.map(m => m.id === mod.id ? { ...m, unlock_after_days: val } : m)); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-[10px]">Περιγραφη</Label>
                  <Textarea defaultValue={mod.description} className="text-xs min-h-[40px]" onBlur={e => updateModule(mod.id, { description: e.target.value } as any)} />
                </div>
                <ImageUploadField
                  value={mod.image_url || ""}
                  label="Εικονα εξωφυλλου"
                  onChange={(url) => { updateModule(mod.id, { image_url: url || null } as any); setModules(prev => prev.map(m => m.id === mod.id ? { ...m, image_url: url || null } : m)); }}
                />
                <div className="flex items-center gap-2">
                  <Switch checked={mod.is_sequential} onCheckedChange={val => { updateModule(mod.id, { is_sequential: val } as any); setModules(prev => prev.map(m => m.id === mod.id ? { ...m, is_sequential: val } : m)); }} />
                  <span className="font-sans text-xs text-muted-foreground">{mod.is_sequential ? "Σειριακη παρακολουθηση (πρεπει να δει με σειρα)" : "Ανεξαρτητη (οποιαδηποτε σειρα)"}</span>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="font-sans text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Βιντεο</p>
                  {moduleVideos.map((v, idx) => (
                    <VideoRow
                      key={v.id}
                      video={v}
                      index={idx}
                      allVideos={moduleVideos}
                      onUpdate={updateVideo}
                      onDelete={deleteVideo}
                      isDragging={dragVideoId === v.id}
                      isDragOver={dragOverVideoId === v.id}
                      onDragStart={() => setDragVideoId(v.id)}
                      onDragOver={() => setDragOverVideoId(v.id)}
                      onDrop={() => handleVideoDrop(mod.id, v.id)}
                      onDragEnd={() => { setDragVideoId(null); setDragOverVideoId(null); }}
                    />
                  ))}
                  <button onClick={() => addVideo(mod.id)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-[10px] font-sans text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
                    <Plus className="h-3 w-3" /> Προσθηκη βιντεο
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {unassignedVideos.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-3 space-y-2">
          <p className="font-sans text-xs font-medium text-muted-foreground">Μη αντιστοιχισμενα βιντεο ({unassignedVideos.length})</p>
          {unassignedVideos.map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Play className="h-3 w-3" />
              <span className="flex-1 truncate">{v.title || "Untitled"}</span>
              <select
                className="h-6 rounded border border-border bg-background px-1 text-[10px]"
                defaultValue=""
                onChange={e => { if (e.target.value) { updateVideo(v.id, { module_id: e.target.value } as any); loadData(); }}}
              >
                <option value="">Αντιστοιχιση σε ενοτητα...</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editingModule} onOpenChange={o => !o && setEditingModule(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-serif text-base">Επεξεργασια ενοτητας</DialogTitle></DialogHeader>
          {editingModule && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Τιτλος</Label>
                <Input defaultValue={editingModule.title} className="text-sm" onBlur={e => updateModule(editingModule.id, { title: e.target.value } as any)} />
              </div>
              <div>
                <Label className="text-xs">Περιγραφη</Label>
                <Textarea defaultValue={editingModule.description} className="text-sm min-h-[60px]" onBlur={e => updateModule(editingModule.id, { description: e.target.value } as any)} />
              </div>
              <ImageUploadField
                value={editingModule.image_url || ""}
                label="Εικονα εξωφυλλου"
                onChange={(url) => { updateModule(editingModule.id, { image_url: url || null } as any); setEditingModule({ ...editingModule, image_url: url || null }); }}
              />
              {editingModule.image_url && (
                <img src={editingModule.image_url} alt="Preview" className="max-w-full max-h-40 rounded-lg object-contain" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const VideoRow = ({ video, index, allVideos, onUpdate, onDelete, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }: {
  video: ProgramVideo;
  index: number;
  allVideos: ProgramVideo[];
  onUpdate: (id: string, updates: Partial<ProgramVideo>) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) => {
  const extractYtId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\s?]+)/);
    return match ? match[1] : null;
  };
  const ytId = extractYtId(video.youtube_url);

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver?.(); }}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
      onDragEnd={onDragEnd}
      className={`rounded-lg border bg-background p-2 space-y-1.5 transition-all ${isDragging ? "opacity-40 scale-95 border-primary" : ""} ${isDragOver && !isDragging ? "border-primary border-2 shadow-md" : "border-border"}`}
    >
      <div className="flex items-center gap-2">
        <div className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground touch-none">
          <GripVertical className="h-4 w-4" />
        </div>
        {ytId ? (
          <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="max-h-16 max-w-24 rounded object-contain flex-shrink-0" />
        ) : (
          <div className="h-10 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <Play className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <Input defaultValue={video.title} placeholder="Τιτλος βιντεο" className="h-6 text-[11px] border-0 p-0 shadow-none focus-visible:ring-0" onBlur={e => onUpdate(video.id, { title: e.target.value } as any)} />
        </div>
        <button onClick={() => onDelete(video.id)} className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-3 w-3" /></button>
      </div>
      <Input defaultValue={video.youtube_url} placeholder="YouTube URL" className="h-6 text-[10px]" onBlur={e => onUpdate(video.id, { youtube_url: e.target.value } as any)} />
      <ImageUploadField
        value={(video as any).thumbnail_url || ""}
        label="Μικρογραφια"
        onChange={(url) => onUpdate(video.id, { thumbnail_url: url || null } as any)}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <Label className="text-[9px]">Εμφανιση μετα απο ημερα</Label>
          <Input type="number" defaultValue={video.unlock_after_days ?? ""} placeholder="—" className="h-6 text-[10px]" onBlur={e => onUpdate(video.id, { unlock_after_days: e.target.value ? Number(e.target.value) : null } as any)} />
        </div>
        <div>
          <Label className="text-[9px]">Κατηγορια</Label>
          <Input defaultValue={video.category} className="h-6 text-[10px]" onBlur={e => onUpdate(video.id, { category: e.target.value } as any)} />
        </div>
      </div>
      <Textarea defaultValue={video.description} placeholder="Περιγραφη..." className="text-[10px] min-h-[30px]" onBlur={e => onUpdate(video.id, { description: e.target.value } as any)} />
    </div>
  );
};

export default VideoModuleManager;
