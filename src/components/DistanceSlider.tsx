import { Slider } from "@/components/ui/slider";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  value: number;
  onChange: (km: number) => void;
}

const DistanceSlider = ({ value, onChange }: Props) => {
  const { t, tUp } = useLanguage();

  return (
    <div className="space-y-4" data-guide="distance-slider">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{tUp("maxDistance")}</p>
        <span className="font-sans text-sm font-medium text-foreground">{value >= 80 ? "80+" : value} {t("km")}</span>
      </div>
      <Slider
        min={1}
        max={80}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="[&_[role=slider]]:border-gold [&_[role=slider]]:bg-gold [&_[data-orientation=horizontal]>[data-orientation=horizontal]]:bg-gold"
      />
      <div className="flex justify-between text-[10px] font-sans text-muted-foreground">
        <span>1 {t("km")}</span>
        <span>80+ {t("km")}</span>
      </div>
    </div>
  );
};

export default DistanceSlider;
