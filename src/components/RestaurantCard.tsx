import { useState, useEffect } from "react";
import { Star, Clock, MapPin, ExternalLink, Image, Bookmark, BookmarkCheck, Copy, Car, Footprints, DollarSign, CheckCircle2, Globe, CalendarPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSavedRestaurants, SavedSource } from "@/context/SavedRestaurantsContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import AddToCalendarDialog from "@/components/AddToCalendarDialog";
import IconButtonWithTooltip from "@/components/IconButtonWithTooltip";
import { CourseCarouselList } from "@/components/CourseCarousel";

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

interface RestaurantData {
  id: string;
  name: string;
  rating: number;
  reviewCount?: number;
  distance: string;
  walkingTime?: string;
  drivingTime?: string;
  averagePrice?: string;
  whyThisPlace: string;
  whatToOrder?: string;
  mealOptions?: MealOption[];
  powerPhrase: string;
  cuisine: string;
  kitchenHours?: string;
  address?: string;
  photoQuery?: string;
  verificationNote?: string;
  deliveryTime?: string;
  orderingMethod?: string;
  dietBadges?: string[];
  googleMapsUrl?: string;
  appleMapsUrl?: string;
  websiteUrl?: string;
  photoReference?: string;
  directionHint?: string;
  michelinStars?: number;
}

interface Props {
  restaurant: RestaurantData;
  index: number;
  city?: string;
  latitude?: number;
  longitude?: number;
  source?: SavedSource;
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

const PHOTO_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/place-photo`;

const RestaurantCard = ({ restaurant, index, city = "Unknown", latitude, longitude, source = "restaurant" }: Props) => {
  const [showPhotos, setShowPhotos] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { addRestaurant, removeRestaurant, isSaved, saved } = useSavedRestaurants();
  const { t } = useLanguage();

  useEffect(() => {
    if (!restaurant.photoReference) return;
    let cancelled = false;
    const fetchPhoto = async () => {
      try {
        const session = (await (await import("@/integrations/supabase/client")).supabase.auth.getSession()).data.session;
        if (!session?.access_token) return;
        const res = await fetch(
          `${PHOTO_BASE}?ref=${encodeURIComponent(restaurant.photoReference!)}&maxwidth=400`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (!cancelled) setPhotoUrl(URL.createObjectURL(blob));
      } catch {/* ignore */}
    };
    fetchPhoto();
    return () => {cancelled = true;};
  }, [restaurant.photoReference]);

  const isBookmarked = isSaved(restaurant.name, city);

  const handleToggleSave = () => {
    if (isBookmarked) {
      const item = saved.find((r) => r.name === restaurant.name && r.city === city);
      if (item) removeRestaurant(item.id);
      toast({ title: t("removed"), description: `${restaurant.name} ${t("removedFromSaved")}` });
    } else {
      addRestaurant({ ...restaurant, city, source });
      toast({ title: t("saved"), description: `${restaurant.name} ${t("addedToCollection")}` });
    }
  };

  const handleCopyAddress = async () => {
    const text = restaurant.address ? `${restaurant.name}, ${restaurant.address}` : restaurant.name;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("copied"), description: t("addressCopied") });
    } catch {
      toast({ title: t("failedToCopy"), variant: "destructive" });
    }
  };

  const handleUber = () => {
    const dropoffName = encodeURIComponent(restaurant.name);
    const uberDeepLink = restaurant.address ?
    `uber://?action=setPickup&dropoff[nickname]=${dropoffName}&dropoff[formatted_address]=${encodeURIComponent(restaurant.address)}` :
    `uber://?action=setPickup&dropoff[nickname]=${dropoffName}`;
    const uberWebFallback = `https://m.uber.com/ul/?action=setPickup&drop[0]=${encodeURIComponent(restaurant.address || restaurant.name)}`;
    const timeout = setTimeout(() => {window.open(uberWebFallback, "_blank", "noopener,noreferrer");}, 500);
    window.location.href = uberDeepLink;
    window.addEventListener("blur", () => clearTimeout(timeout), { once: true });
  };

  const searchQuery = restaurant.address ? `${restaurant.name}, ${restaurant.address}` : restaurant.name;
  const encodedQuery = encodeURIComponent(searchQuery);
  const appleMapsUrl = restaurant.appleMapsUrl || `https://maps.apple.com/?q=${encodedQuery}`;
  const googleMapsUrl = restaurant.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  const photoSearchUrl = restaurant.photoQuery ?
  `https://www.google.com/search?q=${encodeURIComponent(restaurant.photoQuery)}&udm=2` :
  `https://www.google.com/search?q=${encodeURIComponent(restaurant.name)}&udm=2`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.08, duration: 0.4, ease: "easeOut" }} className="rounded-2xl border border-border bg-card overflow-hidden card-lift card-inset relative">
      {/* Photo */}
      {photoUrl &&
      <div className="relative h-44 w-full overflow-hidden">
          <img src={photoUrl} alt={restaurant.name} loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-card/20 to-transparent" />
        </div>
      }

      <div className="p-6 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-1.5">
              {restaurant.name}
              {restaurant.michelinStars && restaurant.michelinStars > 0 && (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: restaurant.michelinStars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-red-600 text-red-600" />
                  ))}
                </span>
              )}
            </h3>
            <p className="text-xs font-sans text-muted-foreground tracking-wide">{restaurant.cuisine} · {restaurant.distance}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-gold">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span className="text-xs font-sans font-medium">{restaurant.rating}{restaurant.reviewCount != null && <span className="text-muted-foreground ml-1">({restaurant.reviewCount})</span>}</span>
            </div>
            <IconButtonWithTooltip tooltip={isBookmarked ? "Remove from saved" : "Save"} onClick={handleToggleSave} className="p-1 transition-colors hover:text-gold">
              {isBookmarked ? <BookmarkCheck className="h-4 w-4 text-gold fill-gold/20" /> : <Bookmark className="h-4 w-4 text-muted-foreground" />}
            </IconButtonWithTooltip>
          </div>
        </div>

        {/* Distance / Time / Price row */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-sans text-foreground/70">
          {restaurant.walkingTime && <span className="flex items-center gap-1"><Footprints className="h-3 w-3 text-gold" />{restaurant.walkingTime}</span>}
          {restaurant.drivingTime && <span className="flex items-center gap-1"><Car className="h-3 w-3 text-gold" />{restaurant.drivingTime}</span>}
          {restaurant.averagePrice && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-gold" />{restaurant.averagePrice}</span>}
        </div>

        {/* Airport direction hint */}
        {restaurant.directionHint &&
        <div className="flex items-start gap-1.5 text-xs font-sans rounded-lg bg-gold/5 border border-gold/20 px-3 py-2">
            <MapPin className="h-3 w-3 text-gold mt-0.5 shrink-0" />
            <span className="text-foreground/80 italic">{restaurant.directionHint}</span>
          </div>
        }

        {/* Delivery-specific info */}
        {restaurant.deliveryTime &&
        <div className="flex items-center gap-1.5 text-xs font-sans">
            <Clock className="h-3 w-3 text-gold" />
            <span className="text-foreground/80">{t("deliveryTime")}: {restaurant.deliveryTime}</span>
          </div>
        }
        {restaurant.orderingMethod && <p className="text-xs font-sans text-foreground/70">{t("orderVia")}: {restaurant.orderingMethod}</p>}
        {restaurant.dietBadges && restaurant.dietBadges.length > 0 &&
        <div className="flex flex-wrap gap-1.5">
            {restaurant.dietBadges.map((badge) =>
          <span key={badge} className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] font-sans font-medium text-gold">{badge}</span>
          )}
          </div>
        }

        {restaurant.kitchenHours &&
        <div className="flex items-center gap-1.5 text-xs font-sans">
            <Clock className="h-3 w-3 text-gold" />
            <span className="text-foreground/80">{restaurant.kitchenHours}</span>
          </div>
        }

        {/* Why here */}
        <div className="space-y-2 text-sm font-sans">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{t("whyHere")}</p>
            <p className="text-foreground/80">{restaurant.whyThisPlace}</p>
          </div>

          {restaurant.mealOptions && restaurant.mealOptions.length > 0 ?
          <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("whatToOrder")}</p>
              <CourseCarouselList mealOptions={restaurant.mealOptions} websiteUrl={restaurant.websiteUrl} restaurantName={restaurant.name} />
            </div> :
          restaurant.whatToOrder ?
          <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">{t("orderThis")}</p>
              <p className="text-foreground/80">{restaurant.whatToOrder}</p>
            </div> :
          null}

          <div>
            <p className="text-[10px] uppercase tracking-widest text-gold mb-0.5">{t("howToOrder")}</p>
            <p className="italic text-foreground/70">"{restaurant.powerPhrase}"</p>
          </div>
        </div>

        {restaurant.verificationNote &&
        <div className="flex items-center gap-1.5 text-[10px] font-sans text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {restaurant.verificationNote}
          </div>
        }

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => openExternal(appleMapsUrl)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
            <MapPin className="h-3 w-3" />{t("appleMaps")}
          </button>
          <button onClick={() => openExternal(googleMapsUrl)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
            <ExternalLink className="h-3 w-3" />{t("googleMaps")}
          </button>
          <button onClick={handleUber} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
            <Car className="h-3 w-3" />{t("uber")}
          </button>
          <button onClick={handleCopyAddress} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
            <Copy className="h-3 w-3" />{t("copyAddress")}
          </button>
          <button onClick={() => setShowPhotos(!showPhotos)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
            <Image className="h-3 w-3" />{showPhotos ? t("hidePhotos") : t("seePhotos")}
          </button>
          {restaurant.websiteUrl &&
          <button onClick={() => openExternal(ensureProtocol(restaurant.websiteUrl!))} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
              <Globe className="h-3 w-3" />{t("website")}
            </button>
          }
          <AddToCalendarDialog
            name={restaurant.name}
            address={restaurant.address}
            description={`${restaurant.whyThisPlace}\n\n"${restaurant.powerPhrase}"`}
            trigger={
              <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
                <CalendarPlus className="h-3 w-3" />{t("calendar")}
              </button>
            }
          />
        </div>

        <AnimatePresence>
          {showPhotos &&
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <button onClick={() => openExternal(photoSearchUrl)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-4 py-3 text-xs font-sans font-medium text-gold transition-colors hover:bg-gold/10">
                <Image className="h-4 w-4" />
                {t("viewPhotosOf")} {restaurant.name} →
              </button>
            </motion.div>
          }
        </AnimatePresence>
      </div>
    </motion.div>);

};

export default RestaurantCard;