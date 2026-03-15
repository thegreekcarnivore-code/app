import { useState, ReactNode } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  name: string;
  address?: string;
  description?: string;
  trigger: ReactNode;
}

const DURATIONS = [
  { value: "60", label: "1h" },
  { value: "90", label: "1.5h" },
  { value: "120", label: "2h" },
  { value: "180", label: "3h" },
];

const buildGoogleCalendarUrl = (
  title: string,
  startDate: Date,
  durationMinutes: number,
  location: string,
  description: string
) => {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = new Date(startDate.getTime() + durationMinutes * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(startDate)}/${fmt(end)}`,
    location,
    details: description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
};

const AddToCalendarDialog = ({ name, address = "", description = "", trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [hour, setHour] = useState("19");
  const [minute, setMinute] = useState("00");
  const [duration, setDuration] = useState("90");
  const { t } = useLanguage();

  const handleConfirm = () => {
    if (!date) return;
    const start = new Date(date);
    start.setHours(parseInt(hour), parseInt(minute), 0, 0);
    const url = buildGoogleCalendarUrl(
      `Visit ${name}`,
      start,
      parseInt(duration),
      address,
      description
    );
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif text-base">{t("addToCalendar")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm font-sans text-muted-foreground">{name}</p>

          {/* Date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : t("selectDateTime")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {/* Time selectors */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">
                {t("selectDateTime").split(" ")[0] || "Hour"}
              </label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {String(i).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">Min</label>
              <Select value={minute} onValueChange={setMinute}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["00", "15", "30", "45"].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">{t("duration")}</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={!date}
            className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {t("addToCalendar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddToCalendarDialog;
