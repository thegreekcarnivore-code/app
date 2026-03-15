import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { Heart, MessageCircle, Send, Image as ImageIcon, X, Users, Loader2, Settings, Camera, Trash2, UserPlus, Plus, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GroupMember {
  user_id: string;
  profiles?: { display_name: string | null; avatar_url: string | null; email: string | null };
}

interface Post {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  mentions: string[];
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null };
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string | null; avatar_url: string | null };
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface Group {
  id: string;
  name: string;
  description: string;
  cover_image_url: string | null;
}

const GroupFeed = () => {
  const { user, isAdmin } = useAuth();
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const queryClient = useQueryClient();
  const [newPost, setNewPost] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [signedMediaUrls, setSignedMediaUrls] = useState<Map<string, string>>(new Map());
  const [coverSignedUrl, setCoverSignedUrl] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Fetch groups the user belongs to
  const { data: groups = [] } = useQuery({
    queryKey: ["user-groups", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("groups" as any)
        .select("id, name, description, cover_image_url")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Group[];
    },
    enabled: !!user,
  });

  const activeGroup = groups[0] || null;

  // Sign cover image
  useEffect(() => {
    if (!activeGroup?.cover_image_url) { setCoverSignedUrl(null); return; }
    getSignedUrl("group-media", activeGroup.cover_image_url).then(setCoverSignedUrl);
  }, [activeGroup?.cover_image_url]);

  // Fetch all approved profiles for admin member management
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-all-profiles-community"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("approved", true)
        .order("display_name");
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin,
  });

  // Fetch members for @mention
  const { data: members = [] } = useQuery({
    queryKey: ["group-members", activeGroup?.id],
    queryFn: async () => {
      if (!activeGroup) return [];
      const { data, error } = await supabase
        .from("group_members" as any)
        .select("user_id, profiles:user_id(display_name, avatar_url, email)")
        .eq("group_id", activeGroup.id);
      if (error) throw error;
      return (data as any[]) as GroupMember[];
    },
    enabled: !!activeGroup,
  });

  // Fetch posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["group-posts", activeGroup?.id],
    queryFn: async () => {
      if (!activeGroup) return [];
      const { data, error } = await supabase
        .from("group_posts" as any)
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("group_id", activeGroup.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) as Post[];
    },
    enabled: !!activeGroup,
  });

  // Sign media URLs for posts
  useEffect(() => {
    const allUrls = posts.flatMap((p) => p.media_urls || []);
    if (allUrls.length === 0) return;
    const unsigned = allUrls.filter((u) => !signedMediaUrls.has(u));
    if (unsigned.length === 0) return;
    Promise.all(unsigned.map(async (url) => {
      const signed = await getSignedUrl("group-media", url);
      return [url, signed] as [string, string | null];
    })).then((results) => {
      setSignedMediaUrls((prev) => {
        const next = new Map(prev);
        results.forEach(([url, signed]) => { if (signed) next.set(url, signed); });
        return next;
      });
    });
  }, [posts]);

  // Realtime subscription
  useEffect(() => {
    if (!activeGroup) return;
    const channel = supabase
      .channel(`group-${activeGroup.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_posts", filter: `group_id=eq.${activeGroup.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["group-posts", activeGroup.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["group-comments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_post_likes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["group-likes"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeGroup?.id, queryClient]);

  // Post creation
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user || !activeGroup) return;
      setUploading(true);
      
      // Upload files
      const mediaUrls: string[] = [];
      for (const file of selectedFiles) {
        const ext = file.name.split(".").pop();
        const path = `${activeGroup.id}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("group-media").upload(path, file);
        if (error) throw error;
        mediaUrls.push(path);
      }

      // Parse @mentions
      const mentionRegex = /@(\w+)/g;
      const mentionsList: string[] = [];
      let match;
      while ((match = mentionRegex.exec(newPost)) !== null) {
        if (match[1] === "everyone") {
          mentionsList.push("everyone");
        } else {
          const member = members.find((m) => m.profiles?.display_name?.toLowerCase().includes(match![1].toLowerCase()));
          if (member) mentionsList.push(member.user_id);
        }
      }

      const { error } = await supabase
        .from("group_posts" as any)
        .insert({
          group_id: activeGroup.id,
          user_id: user.id,
          content: newPost.trim(),
          media_urls: mediaUrls,
          mentions: mentionsList,
        } as any);
      if (error) throw error;

      // Create notifications for group members
      const notifyUserIds = mentionsList.includes("everyone")
        ? members.filter((m) => m.user_id !== user.id).map((m) => m.user_id)
        : mentionsList.filter((id) => id !== user.id);

      // If no explicit mentions, notify all members
      const targetIds = notifyUserIds.length > 0 ? notifyUserIds : members.filter((m) => m.user_id !== user.id).map((m) => m.user_id);

      const displayName = members.find((m) => m.user_id === user.id)?.profiles?.display_name || "Someone";

      if (targetIds.length > 0) {
        await supabase.from("client_notifications" as any).insert(
          targetIds.map((uid) => ({
            user_id: uid,
            type: "group_post",
            title: `${displayName} ${isGreek ? "δημοσίευσε στην" : "posted in"} ${activeGroup.name}`,
            body: newPost.trim().slice(0, 100),
            link: "/community",
          }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-posts", activeGroup?.id] });
      setNewPost("");
      setSelectedFiles([]);
      setUploading(false);
    },
    onError: () => {
      setUploading(false);
      toast({ title: isGreek ? "Σφάλμα" : "Error", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.filter((f) => f.size > 20 * 1024 * 1024);
    if (oversized.length > 0) {
      toast({
        title: isGreek ? "Αρχείο πολύ μεγάλο" : "File too large",
        description: isGreek ? "Μέγιστο 20MB ανά αρχείο" : "Maximum 20MB per file",
        variant: "destructive",
      });
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  // Admin: upload cover image
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeGroup || !user) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: isGreek ? "Αρχείο πολύ μεγάλο" : "File too large", variant: "destructive" });
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `covers/${activeGroup.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("group-media").upload(path, file);
    if (uploadErr) { toast({ title: "Upload error", variant: "destructive" }); return; }
    const { error: updateErr } = await supabase.from("groups" as any).update({ cover_image_url: path } as any).eq("id", activeGroup.id);
    if (updateErr) { toast({ title: "Update error", variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["user-groups"] });
    toast({ title: isGreek ? "Εικόνα ενημερώθηκε!" : "Cover updated!" });
  };

  // Admin: update group info
  const updateGroupMutation = useMutation({
    mutationFn: async () => {
      if (!activeGroup) return;
      const { error } = await supabase.from("groups" as any).update({ name: editName.trim(), description: editDesc.trim() } as any).eq("id", activeGroup.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-groups"] });
      setEditDialogOpen(false);
      toast({ title: isGreek ? "Ομάδα ενημερώθηκε!" : "Group updated!" });
    },
  });

  // Admin: add members (batch)
  const addMemberMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      if (!activeGroup || userIds.length === 0) return;
      const { error } = await supabase.from("group_members" as any).insert(
        userIds.map((uid) => ({ group_id: activeGroup.id, user_id: uid })) as any
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", activeGroup?.id] });
      setSelectedUserIds(new Set());
      toast({ title: isGreek ? "Μέλη προστέθηκαν!" : "Members added!" });
    },
  });

  // Admin: remove member
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!activeGroup) return;
      const { error } = await supabase.from("group_members" as any).delete().eq("group_id", activeGroup.id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members", activeGroup?.id] });
      toast({ title: isGreek ? "Μέλος αφαιρέθηκε" : "Member removed" });
    },
  });

  // Admin: delete group
  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      if (!activeGroup) return;
      const { error } = await supabase.from("groups" as any).delete().eq("id", activeGroup.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-groups"] });
      toast({ title: isGreek ? "Ομάδα διαγράφηκε" : "Group deleted" });
    },
  });

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableProfiles = allProfiles.filter((p) => !memberUserIds.has(p.id));

  if (!activeGroup) {
    return (
      <div className="pt-14 pb-24 px-5">
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <h2 className="font-serif text-lg font-semibold text-foreground">
            {isGreek ? "Κοινότητα" : "Community"}
          </h2>
          <p className="text-sm font-sans text-muted-foreground max-w-xs">
            {isGreek ? "Δεν ανήκεις σε κάποια ομάδα ακόμα. Ο coach σου θα σε προσθέσει σύντομα!" : "You're not part of any group yet. Your coach will add you soon!"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14 pb-24 px-5 space-y-4">
      {/* Cover image */}
      <div className="relative -mx-5 -mt-14">
        <div className="h-40 bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
          {coverSignedUrl && (
            <img src={coverSignedUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        {isAdmin && (
          <>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            <button
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-2 right-2 rounded-full bg-background/80 backdrop-blur p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Camera className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Group header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl font-semibold text-foreground">{activeGroup.name}</h1>
          {isAdmin && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { setEditName(activeGroup.name); setEditDesc(activeGroup.description); setEditDialogOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAddMemberOpen(!addMemberOpen)}>
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm(isGreek ? "Διαγραφή ομάδας;" : "Delete group?")) deleteGroupMutation.mutate(); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        {activeGroup.description && (
          <p className="text-xs font-sans text-muted-foreground">{activeGroup.description}</p>
        )}
        <p className="text-[10px] font-sans text-muted-foreground">
          {members.length} {isGreek ? "μέλη" : "members"}
        </p>

        {/* Admin: member chips */}
        {isAdmin && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-sans">
                <span className="text-foreground">{m.profiles?.display_name || m.profiles?.email || "User"}{m.profiles?.display_name && m.profiles?.email && <span className="text-muted-foreground ml-0.5">({m.profiles.email})</span>}</span>
                <button onClick={() => removeMemberMutation.mutate(m.user_id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Admin: add members inline */}
        {isAdmin && addMemberOpen && (
          <div className="space-y-2 pt-1">
            <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1">
              {availableProfiles.length === 0 && (
                <p className="text-xs text-muted-foreground">{isGreek ? "Όλοι οι χρήστες είναι ήδη μέλη" : "All users are already members"}</p>
              )}
              {availableProfiles.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50 cursor-pointer text-xs font-sans">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(p.id)}
                    onChange={(e) => {
                      setSelectedUserIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(p.id); else next.delete(p.id);
                        return next;
                      });
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">{p.display_name || p.email || p.id.slice(0, 8)}{p.display_name && p.email && <span className="text-muted-foreground ml-1">({p.email})</span>}</span>
                </label>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => addMemberMutation.mutate(Array.from(selectedUserIds))}
              disabled={selectedUserIds.size === 0}
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              {isGreek ? `Προσθήκη ${selectedUserIds.size > 0 ? `(${selectedUserIds.size})` : ""}` : `Add ${selectedUserIds.size > 0 ? `(${selectedUserIds.size})` : ""}`}
            </Button>
          </div>
        )}
      </div>

      {/* Edit group dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isGreek ? "Επεξεργασία Ομάδας" : "Edit Group"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={isGreek ? "Όνομα ομάδας" : "Group name"} />
            <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder={isGreek ? "Περιγραφή" : "Description"} className="min-h-[60px]" />
            <Button onClick={() => updateGroupMutation.mutate()} disabled={!editName.trim()}>
              {isGreek ? "Αποθήκευση" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New post composer */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder={isGreek ? "Μοιράσου κάτι με την ομάδα..." : "Share something with the group..."}
            className="min-h-[60px] resize-none text-sm"
          />
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((f, i) => (
                <div key={i} className="relative rounded-lg border border-border p-1.5 text-xs font-sans text-muted-foreground flex items-center gap-1.5">
                  {f.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <span>📎</span>}
                  <span className="max-w-[100px] truncate">{f.name}</span>
                  <button onClick={() => setSelectedFiles((prev) => prev.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
                {isGreek ? "Φωτό/Βίντεο" : "Photo/Video"}
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => postMutation.mutate()}
              disabled={(!newPost.trim() && selectedFiles.length === 0) || uploading}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isGreek ? "Δημοσίευση" : "Post"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Posts feed */}
      {postsLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id || ""}
            isGreek={isGreek}
            members={members}
            signedMediaUrls={signedMediaUrls}
            expandedComments={expandedComments}
            onToggleComments={(id) => setExpandedComments((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })}
            commentInput={commentInputs[post.id] || ""}
            onCommentInputChange={(val) => setCommentInputs((prev) => ({ ...prev, [post.id]: val }))}
          />
        ))}
      </div>
    </div>
  );
};

// Separate PostCard component for each post
const PostCard = ({
  post, currentUserId, isGreek, members, signedMediaUrls, expandedComments, onToggleComments, commentInput, onCommentInputChange,
}: {
  post: Post;
  currentUserId: string;
  isGreek: boolean;
  members: GroupMember[];
  signedMediaUrls: Map<string, string>;
  expandedComments: Set<string>;
  onToggleComments: (id: string) => void;
  commentInput: string;
  onCommentInputChange: (val: string) => void;
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const authorName = post.profiles?.display_name || "User";
  const authorInitial = authorName.charAt(0).toUpperCase();

  // Fetch likes
  const { data: likes = [] } = useQuery({
    queryKey: ["group-likes", post.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_post_likes" as any)
        .select("user_id")
        .eq("post_id", post.id);
      return (data as any[] || []).map((l: any) => l.user_id as string);
    },
  });

  const isLiked = likes.includes(currentUserId);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await supabase.from("group_post_likes" as any).delete().eq("post_id", post.id).eq("user_id", currentUserId);
      } else {
        await supabase.from("group_post_likes" as any).insert({ post_id: post.id, user_id: currentUserId } as any);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["group-likes", post.id] }),
  });

  // Fetch comments
  const { data: comments = [] } = useQuery({
    queryKey: ["group-comments", post.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_comments" as any)
        .select("*, profiles:user_id(display_name, avatar_url)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      return (data as any[] || []) as Comment[];
    },
    enabled: expandedComments.has(post.id),
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("group_comments" as any)
        .insert({ post_id: post.id, user_id: user.id, content } as any);
      if (error) throw error;

      // Notify post author if not self
      if (post.user_id !== user.id) {
        const myName = members.find((m) => m.user_id === user.id)?.profiles?.display_name || "Someone";
        await supabase.from("client_notifications" as any).insert({
          user_id: post.user_id,
          type: "group_comment",
          title: `${myName} ${isGreek ? "σχολίασε τη δημοσίευσή σου" : "commented on your post"}`,
          body: content.slice(0, 100),
          link: "/community",
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-comments", post.id] });
      onCommentInputChange("");
    },
  });

  // Render @mentions with highlight
  const renderContent = (text: string) => {
    return text.replace(/@(\w+)/g, (match) => match);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Author header */}
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              {post.profiles?.avatar_url && <AvatarImage src={post.profiles.avatar_url} />}
              <AvatarFallback className="text-xs font-serif bg-primary/10 text-primary">{authorInitial}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-sans font-semibold text-foreground">{authorName}</p>
              <p className="text-[10px] font-sans text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: isGreek ? el : enUS })}
              </p>
            </div>
          </div>

          {/* Content */}
          {post.content && (
            <p className="text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed">
              {post.content.split(/(@\w+)/g).map((part, i) =>
                part.startsWith("@") ? (
                  <span key={i} className="text-primary font-semibold">{part}</span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>
          )}

          {/* Media */}
          {post.media_urls && post.media_urls.length > 0 && (
            <div className={`grid gap-2 ${post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {post.media_urls.map((url, i) => {
                const signedUrl = signedMediaUrls.get(url);
                if (!signedUrl) return <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />;
                const isVideo = url.match(/\.(mp4|mov|webm)$/i);
                return isVideo ? (
                  <video key={i} src={signedUrl} controls className="rounded-lg w-full max-h-64 object-cover" />
                ) : (
                  <img key={i} src={signedUrl} alt="" className="rounded-lg w-full max-h-64 object-cover" loading="lazy" />
                );
              })}
            </div>
          )}

          {/* Like + Comment buttons */}
          <div className="flex items-center gap-4 pt-1 border-t border-border">
            <button
              onClick={() => likeMutation.mutate()}
              className="flex items-center gap-1.5 text-sm font-sans transition-colors hover:text-primary"
            >
              <Heart className={`h-4 w-4 ${isLiked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              <span className={isLiked ? "text-primary font-medium" : "text-muted-foreground"}>
                {likes.length > 0 ? likes.length : ""} {isGreek ? "Μου αρέσει" : "Like"}
              </span>
            </button>
            <button
              onClick={() => onToggleComments(post.id)}
              className="flex items-center gap-1.5 text-sm font-sans text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              {isGreek ? "Σχόλια" : "Comment"}
            </button>
          </div>

          {/* Comments section */}
          <AnimatePresence>
            {expandedComments.has(post.id) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2 pt-2"
              >
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      <AvatarFallback className="text-[9px] font-serif bg-muted text-muted-foreground">
                        {(c.profiles?.display_name || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs font-sans font-semibold text-foreground">{c.profiles?.display_name || "User"}</p>
                      <p className="text-xs font-sans text-foreground/80">{c.content}</p>
                      <p className="text-[9px] font-sans text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: isGreek ? el : enUS })}
                      </p>
                    </div>
                  </div>
                ))}
                <form
                  onSubmit={(e) => { e.preventDefault(); if (commentInput.trim()) commentMutation.mutate(commentInput.trim()); }}
                  className="flex gap-2"
                >
                  <Input
                    value={commentInput}
                    onChange={(e) => onCommentInputChange(e.target.value)}
                    placeholder={isGreek ? "Γράψε σχόλιο..." : "Write a comment..."}
                    className="h-8 text-xs"
                  />
                  <Button type="submit" size="sm" variant="ghost" disabled={!commentInput.trim()} className="h-8 w-8 p-0 shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default GroupFeed;
