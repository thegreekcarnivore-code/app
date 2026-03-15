import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Video, ExternalLink, Calendar } from "lucide-react";
import { format } from "date-fns";

interface UpcomingCall {
  id: string;
  title: string;
  meeting_url: string;
  call_type: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
}

const UpcomingCalls = () => {
  const { user } = useAuth();
  const [calls, setCalls] = useState<UpcomingCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchUpcoming();
  }, [user]);

  const fetchUpcoming = async () => {
    // Get call IDs where user is a participant
    const { data: participations } = await supabase
      .from("video_call_participants" as any)
      .select("video_call_id")
      .eq("user_id", user!.id);

    if (!participations || participations.length === 0) {
      setLoading(false);
      return;
    }

    const callIds = (participations as any[]).map((p: any) => p.video_call_id);

    const { data } = await supabase
      .from("video_calls" as any)
      .select("id, title, meeting_url, call_type, scheduled_at, duration_minutes, notes")
      .in("id", callIds)
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5);

    if (data) setCalls(data as any);
    setLoading(false);
  };

  if (loading || calls.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-gold" />
        <h3 className="font-serif text-sm font-medium text-foreground">Upcoming Calls</h3>
      </div>
      <div className="space-y-1.5">
        {calls.map(call => (
          <a
            key={call.id}
            href={call.meeting_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-gold/30 hover:bg-gold/5 group"
          >
            <div className="space-y-0.5 min-w-0">
              <p className="font-sans text-sm font-medium text-foreground truncate">{call.title}</p>
              <div className="flex items-center gap-2 text-[10px] font-sans text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(call.scheduled_at), "EEE, MMM d · HH:mm")}
                <span>· {call.duration_minutes} min</span>
              </div>
              {call.notes && (
                <p className="text-[10px] font-sans text-muted-foreground/70 truncate">{call.notes}</p>
              )}
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-gold transition-colors shrink-0 ml-2" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default UpcomingCalls;
