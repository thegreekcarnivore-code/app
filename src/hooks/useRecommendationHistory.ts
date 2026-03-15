import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface HistoryEntry {
  id: string;
  tab: string;
  request_params: Record<string, any>;
  response_data: Record<string, any>;
  location_name: string;
  created_at: string;
}


export function useRecommendationHistory(tab: string) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("recommendation_history" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("tab", tab)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setHistory(data as unknown as HistoryEntry[]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const saveToHistory = useCallback(
    async (params: Record<string, any>, responseData: Record<string, any>, locationName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("recommendation_history" as any).insert({
        user_id: user.id,
        tab,
        request_params: params,
        response_data: responseData,
        location_name: locationName,
      } as any);
    },
    [tab]
  );

  const deleteEntry = useCallback(async (id: string) => {
    await supabase.from("recommendation_history" as any).delete().eq("id", id);
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { history, loading, fetchHistory, saveToHistory, deleteEntry };
}
