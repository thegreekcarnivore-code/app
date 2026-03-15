import { Bookmark, MapPin, Clock, Car } from "lucide-react";
import IconButtonWithTooltip from "@/components/IconButtonWithTooltip";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useSavedRestaurants, SavedSource, SavedRestaurant } from "@/context/SavedRestaurantsContext";
import { useSavedActivities, SavedActivity } from "@/context/SavedActivitiesContext";
import RestaurantCard from "@/components/RestaurantCard";
import { useLanguage } from "@/context/LanguageContext";

interface SavedDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: SavedSource;
}

const SOURCE_LABELS: Record<SavedSource, { en: string; el: string }> = {
  restaurant: { en: "Saved Restaurants", el: "Αποθηκευμένα Εστιατόρια" },
  delivery: { en: "Saved Delivery", el: "Αποθηκευμένες Παραδόσεις" },
  explore: { en: "Saved Activities", el: "Αποθηκευμένες Δραστηριότητες" },
  shopping: { en: "Saved Shops", el: "Αποθηκευμένα Καταστήματα" },
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

const SavedDrawer = ({ open, onOpenChange, source }: SavedDrawerProps) => {
  const { getSavedBySource } = useSavedRestaurants();
  const { savedActivities, removeActivity } = useSavedActivities();
  const { lang } = useLanguage();

  const items = getSavedBySource(source);
  const label = SOURCE_LABELS[source];

  // Group restaurants by city
  const grouped = items.reduce<Record<string, SavedRestaurant[]>>((acc, r) => {
    const city = r.city || "Unknown";
    if (!acc[city]) acc[city] = [];
    acc[city].push(r);
    return acc;
  }, {});
  Object.values(grouped).forEach(group =>
    group.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  );
  const cities = Object.keys(grouped).sort();

  // Group activities by city (for explore source)
  const activityGrouped = savedActivities.reduce<Record<string, SavedActivity[]>>((acc, a) => {
    const city = a.city || "Unknown";
    if (!acc[city]) acc[city] = [];
    acc[city].push(a);
    return acc;
  }, {});
  Object.values(activityGrouped).forEach(group =>
    group.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  );
  const activityCities = Object.keys(activityGrouped).sort();

  const hasActivities = source === "explore" && savedActivities.length > 0;
  const hasRestaurants = cities.length > 0;
  const isEmpty = !hasActivities && !hasRestaurants;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] pb-6">
        <DrawerTitle className="px-4 pt-4 font-serif text-xl">
          {lang === "en" ? label.en : label.el}
        </DrawerTitle>
        <div className="overflow-y-auto px-4 py-3 space-y-5">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bookmark className="h-7 w-7 text-muted-foreground/40 mb-2" />
              <p className="font-sans text-sm text-muted-foreground">
                {lang === "en" ? "No saved items yet." : "Δεν υπάρχουν αποθηκευμένα."}
              </p>
              <p className="font-sans text-xs text-muted-foreground mt-1">
                {lang === "en"
                  ? "Tap the bookmark icon on any recommendation to save it here."
                  : "Πατήστε το εικονίδιο σελιδοδείκτη για αποθήκευση."}
              </p>
            </div>
          ) : (
            <>
              {/* Saved Activities (explore only) */}
              {hasActivities && activityCities.map((city) => (
                <div key={`act-${city}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gold" />
                    <h2 className="font-serif text-base font-semibold text-foreground">{city}</h2>
                    <span className="text-xs font-sans text-muted-foreground">
                      ({activityGrouped[city].length})
                    </span>
                  </div>
                  {activityGrouped[city].map((activity) => (
                    <div key={activity.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <h3 className="font-serif text-sm font-semibold text-foreground leading-tight">{activity.name}</h3>
                          <span className="inline-block rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] font-sans font-medium text-gold">{activity.category}</span>
                        </div>
                        <IconButtonWithTooltip
                          tooltip="Remove"
                          onClick={() => removeActivity(activity.id)}
                          className="p-1 rounded-full text-gold hover:bg-muted transition-colors shrink-0"
                          aria-label="Remove"
                        >
                          <Bookmark className="h-4 w-4 fill-current" />
                        </IconButtonWithTooltip>
                      </div>
                      <p className="font-sans text-xs text-foreground/80 leading-relaxed line-clamp-2">{activity.shortDescription}</p>
                      {(activity.distanceFromUser || activity.drivingTime) && (
                        <div className="flex items-center gap-3 text-xs font-sans text-foreground/70">
                          {activity.distanceFromUser && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gold" />{activity.distanceFromUser}</span>}
                          {activity.drivingTime && <span className="flex items-center gap-1"><Car className="h-3 w-3 text-gold" />{activity.drivingTime}</span>}
                        </div>
                      )}
                      {activity.address && (
                        <p className="text-xs font-sans text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{activity.address}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {activity.googleMapsUrl && (
                          <button onClick={() => openExternal(activity.googleMapsUrl)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
                            <MapPin className="h-3 w-3" />Google Maps
                          </button>
                        )}
                        {activity.appleMapsUrl && (
                          <button onClick={() => openExternal(activity.appleMapsUrl)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
                            <MapPin className="h-3 w-3" />Apple Maps
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Separator if both sections exist */}
              {hasActivities && hasRestaurants && (
                <div className="pt-2">
                  <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">
                    {lang === "en" ? "Nearby Restaurants" : "Κοντινα Εστιατορια"}
                  </p>
                </div>
              )}

              {/* Saved Restaurants */}
              {cities.map((city) => (
                <div key={city} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gold" />
                    <h2 className="font-serif text-base font-semibold text-foreground">{city}</h2>
                    <span className="text-xs font-sans text-muted-foreground">
                      ({grouped[city].length})
                    </span>
                  </div>
                  {grouped[city].map((r, i) => (
                    <RestaurantCard
                      key={r.id}
                      restaurant={r}
                      index={i}
                      city={r.city}
                      source={source}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default SavedDrawer;
