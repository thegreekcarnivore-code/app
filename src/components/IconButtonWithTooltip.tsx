import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface IconButtonWithTooltipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string;
  children: React.ReactNode;
}

const IconButtonWithTooltip = forwardRef<HTMLButtonElement, IconButtonWithTooltipProps>(
  ({ tooltip, children, className, ...props }, ref) => (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button ref={ref} className={cn(className)} {...props}>
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
);

IconButtonWithTooltip.displayName = "IconButtonWithTooltip";

export default IconButtonWithTooltip;
