import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { el, enUS } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface MeasurementCommentsProps {
  measurementId: string;
  measurementUserId: string;
}

interface Comment {
  id: string;
  measurement_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

const MeasurementComments = ({ measurementId, measurementUserId }: MeasurementCommentsProps) => {
  const { lang } = useLanguage();
  const { user, isAdmin } = useAuth();
  const isGreek = lang === "el";
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [] } = useQuery({
    queryKey: ["measurement-comments", measurementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_comments" as any)
        .select("*")
        .eq("measurement_id", measurementId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as Comment[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("measurement_comments" as any)
        .insert({ measurement_id: measurementId, user_id: user?.id, content } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurement-comments", measurementId] });
      setNewComment("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addMutation.mutate(newComment.trim());
  };

  const isOwnComment = (c: Comment) => c.user_id === user?.id;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="pl-4 border-l-2 border-primary/20 space-y-2 mt-2 mb-1">
          {comments.map((c) => (
            <div key={c.id} className="space-y-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-sans font-semibold text-foreground">
                  {isOwnComment(c)
                    ? (isGreek ? "Εσύ" : "You")
                    : (isGreek ? "Coach" : "Coach")}
                </span>
                <span className="text-[10px] font-sans text-muted-foreground">
                  {format(new Date(c.created_at), "d MMM, HH:mm", { locale: isGreek ? el : enUS })}
                </span>
              </div>
              <p className="text-sm font-sans text-foreground/90">{c.content}</p>
            </div>
          ))}

          <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={isGreek ? "Σχόλιο..." : "Comment..."}
              className="h-8 text-sm"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              disabled={!newComment.trim() || addMutation.isPending}
              className="h-8 w-8 p-0 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MeasurementComments;
