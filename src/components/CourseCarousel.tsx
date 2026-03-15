import { useState } from "react";
import { Star, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface MealOption {
  dish: string;
  localName?: string;
  englishName?: string;
  isRecommended: boolean;
  lowCarbTip?: string;
  pricePerKg?: string;
  dishPrice?: string;
  dishPageUrl?: string;
  course?: "starter" | "main" | "dessert";
}

const ensureProtocol = (url: string) => {
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
};

const openExternal = (url: string) => {
  if (!url) return;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};

const courseOrder = ["starter", "main", "dessert"] as const;
const courseLabels: Record<string, string> = {
  starter: "Starter",
  main: "Main Course",
  dessert: "Dessert",
};

function CourseSection({
  label,
  options,
  websiteUrl,
  restaurantName,
}: {
  label: string;
  options: MealOption[];
  websiteUrl?: string;
  restaurantName: string;
}) {
  const [idx, setIdx] = useState(0);
  const hasMultiple = options.length > 1;
  const option = options[idx];

  const dishSearchUrl =
    option.dishPageUrl ||
    (websiteUrl ? ensureProtocol(websiteUrl) : null) ||
    `https://www.google.com/search?q=${encodeURIComponent(`${option.dish} ${restaurantName} menu`)}`;

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
        {label}
      </p>
      <div
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 ${
          option.isRecommended ? "bg-gold/10 border border-gold/20" : ""
        }`}
      >
        {hasMultiple && (
          <button
            onClick={() => setIdx((i) => (i - 1 + options.length) % options.length)}
            className="p-0.5 text-muted-foreground hover:text-gold transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {option.isRecommended && (
              <Star className="h-3.5 w-3.5 text-gold fill-gold mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <button
                onClick={() => openExternal(dishSearchUrl)}
                className="text-left group"
              >
                <p
                  className={`text-sm font-semibold group-hover:text-gold transition-colors ${
                    option.isRecommended ? "text-foreground" : "text-foreground/90"
                  }`}
                >
                  {option.dish}
                  <ExternalLink className="inline h-2.5 w-2.5 ml-1 opacity-40" />
                </p>
              </button>
              {option.localName && option.localName !== option.dish && (
                <p className="text-sm font-serif font-medium text-foreground/80">
                  {option.localName}
                </p>
              )}
              {option.englishName && option.englishName !== option.dish && (
                <p className="text-sm font-serif font-medium text-muted-foreground">
                  {option.englishName}
                </p>
              )}
              {option.dishPrice && (
                <p className="text-xs font-medium text-gold mt-0.5">{option.dishPrice}</p>
              )}
              {option.lowCarbTip && (
                <p className="text-xs font-medium italic mt-0.5 text-sidebar-border bg-transparent">
                  💡 {option.lowCarbTip}
                </p>
              )}
              {option.pricePerKg && (
                <p className="text-xs text-muted-foreground mt-0.5">{option.pricePerKg}</p>
              )}
            </div>
          </div>
        </div>

        {hasMultiple && (
          <button
            onClick={() => setIdx((i) => (i + 1) % options.length)}
            className="p-0.5 text-muted-foreground hover:text-gold transition-colors shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {hasMultiple && (
        <p className="text-[10px] text-muted-foreground text-center">
          {idx + 1}/{options.length}
        </p>
      )}
    </div>
  );
}

export function CourseCarouselList({
  mealOptions,
  websiteUrl,
  restaurantName,
}: {
  mealOptions: MealOption[];
  websiteUrl?: string;
  restaurantName: string;
}) {
  const grouped = new Map<string, MealOption[]>();
  for (const opt of mealOptions) {
    const c = opt.course || "main";
    if (!grouped.has(c)) grouped.set(c, []);
    grouped.get(c)!.push(opt);
  }

  return (
    <div className="space-y-2.5">
      {courseOrder
        .filter((c) => grouped.has(c))
        .map((course) => (
          <CourseSection
            key={course}
            label={courseLabels[course]}
            options={grouped.get(course)!}
            websiteUrl={websiteUrl}
            restaurantName={restaurantName}
          />
        ))}
    </div>
  );
}
