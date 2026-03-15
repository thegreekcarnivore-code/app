import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageCheckmarksProps {
  isRead: boolean;
  className?: string;
}

const MessageCheckmarks = ({ isRead, className }: MessageCheckmarksProps) => {
  return (
    <span className={cn("inline-flex items-center ml-1", className)}>
      {isRead ? (
        <span className="inline-flex items-center text-gold">
          <Check className="h-3 w-3" strokeWidth={2.5} />
          <Check className="h-3 w-3 -ml-1.5" strokeWidth={2.5} />
        </span>
      ) : (
        <Check className="h-3 w-3 text-muted-foreground" strokeWidth={2.5} />
      )}
    </span>
  );
};

export default MessageCheckmarks;
