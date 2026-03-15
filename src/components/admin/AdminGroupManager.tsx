import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Users, Trash2, UserPlus } from "lucide-react";

interface Group {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface GroupMemberRow {
  id: string;
  user_id: string;
  group_id: string;
  joined_at: string;
  profiles?: { display_name: string | null; email: string | null };
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
}

const AdminGroupManager = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const isGreek = lang === "el";
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Group[];
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("approved", true)
        .order("display_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("groups" as any).insert({
        name: newName.trim(),
        description: newDesc.trim(),
        created_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      toast({ title: isGreek ? "Ομάδα δημιουργήθηκε!" : "Group created!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
      toast({ title: isGreek ? "Ομάδα διαγράφηκε" : "Group deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-foreground">
          {isGreek ? "Ομάδες Κοινότητας" : "Community Groups"}
        </h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {isGreek ? "Νέα Ομάδα" : "New Group"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isGreek ? "Δημιουργία Ομάδας" : "Create Group"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={isGreek ? "Όνομα ομάδας" : "Group name"}
              />
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={isGreek ? "Περιγραφή (προαιρετικά)" : "Description (optional)"}
                className="min-h-[60px]"
              />
              <Button onClick={() => createMutation.mutate()} disabled={!newName.trim()}>
                {isGreek ? "Δημιουργία" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          allProfiles={allProfiles}
          isGreek={isGreek}
          onDelete={() => deleteMutation.mutate(group.id)}
          addMemberOpen={addMemberGroupId === group.id}
          onToggleAddMember={() => setAddMemberGroupId(addMemberGroupId === group.id ? null : group.id)}
          selectedUserId={selectedUserId}
          onSelectedUserIdChange={setSelectedUserId}
        />
      ))}

      {groups.length === 0 && (
        <p className="text-sm font-sans text-muted-foreground text-center py-8">
          {isGreek ? "Δεν υπάρχουν ομάδες ακόμα" : "No groups yet"}
        </p>
      )}
    </div>
  );
};

const GroupCard = ({
  group, allProfiles, isGreek, onDelete, addMemberOpen, onToggleAddMember, selectedUserId, onSelectedUserIdChange,
}: {
  group: Group;
  allProfiles: Profile[];
  isGreek: boolean;
  onDelete: () => void;
  addMemberOpen: boolean;
  onToggleAddMember: () => void;
  selectedUserId: string;
  onSelectedUserIdChange: (v: string) => void;
}) => {
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["admin-group-members", group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members" as any)
        .select("*, profiles:user_id(display_name, email)")
        .eq("group_id", group.id);
      if (error) throw error;
      return (data as any[]) as GroupMemberRow[];
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("group_members" as any).insert({ group_id: group.id, user_id: userId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-group-members", group.id] });
      onSelectedUserIdChange("");
      toast({ title: isGreek ? "Μέλος προστέθηκε!" : "Member added!" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.from("group_members" as any).delete().eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-group-members", group.id] });
      toast({ title: isGreek ? "Μέλος αφαιρέθηκε" : "Member removed" });
    },
  });

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableProfiles = allProfiles.filter((p) => !memberUserIds.has(p.id));

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-serif text-base font-semibold text-foreground">{group.name}</h4>
            {group.description && <p className="text-xs font-sans text-muted-foreground">{group.description}</p>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onToggleAddMember} className="gap-1 text-xs">
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Members list */}
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-sans">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                  {(m.profiles?.display_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground">{m.profiles?.display_name || m.profiles?.email || "User"}{m.profiles?.display_name && m.profiles?.email && <span className="text-muted-foreground ml-0.5">({m.profiles.email})</span>}</span>
              <button onClick={() => removeMemberMutation.mutate(m.id)} className="text-muted-foreground hover:text-destructive ml-0.5">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-xs text-muted-foreground">{isGreek ? "Κανένα μέλος" : "No members"}</p>
          )}
        </div>

        {/* Add member */}
        {addMemberOpen && (
          <div className="flex gap-2 items-center">
            <Select value={selectedUserId} onValueChange={onSelectedUserIdChange}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder={isGreek ? "Επιλογή χρήστη..." : "Select user..."} />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || p.email || p.id.slice(0, 8)}
                    {p.display_name && p.email && <span className="text-muted-foreground ml-1">({p.email})</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => { if (selectedUserId) addMemberMutation.mutate(selectedUserId); }}
              disabled={!selectedUserId}
              className="h-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminGroupManager;
