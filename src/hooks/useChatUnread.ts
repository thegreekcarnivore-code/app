import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useChatUnread = () => {
  const { user, isAdmin } = useAuth();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Client: fetch admin ID
  useEffect(() => {
    if (isAdmin || !user) return;
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setAdminId(data[0].user_id);
      });
  }, [user, isAdmin]);

  // Client: unread count
  useEffect(() => {
    if (!user || isAdmin || !adminId) return;

    const fetchUnread = async () => {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("sender_id", adminId)
        .eq("receiver_id", user.id)
        .is("read_at", null);
      setUnreadCount(count ?? 0);
    };

    fetchUnread();
    const channel = supabase
      .channel("chat-unread-hook")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, adminId, isAdmin]);

  // Admin: total unread count
  useEffect(() => {
    if (!isAdmin || !user) return;

    const fetchAdminUnread = async () => {
      const { data } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", user.id)
        .neq("sender_id", user.id)
        .is("read_at", null);
      setUnreadCount(data?.length ?? 0);
    };

    fetchAdminUnread();
    const channel = supabase
      .channel("admin-unread-hook")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchAdminUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, user]);

  return unreadCount;
};
