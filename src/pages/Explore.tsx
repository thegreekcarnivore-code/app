import { useState, useEffect, useCallback } from "react";
import AiSearchLoader from "@/components/AiSearchLoader";
import SavedDrawer from "@/components/SavedDrawer";
import HistoryDrawer from "@/components/HistoryDrawer";
import { MapPin, Loader2, Navigation, AlertCircle, Compass, Landmark, Baby, Palmtree, Building2, Heart, FlaskConical, Mountain, Flame, PartyPopper, Laugh, Music, Theater, Briefcase, ChevronDown, ChevronUp, Clock, Plus, Utensils, Car, Bookmark, BookmarkCheck, CalendarPlus, DollarSign } from "lucide-react";
import IconButtonWithTooltip from "@/components/IconButtonWithTooltip";
import { usePageActions } from "@/context/PageActionsContext";
import { useRecommendationHistory } from "@/hooks/useRecommendationHistory";
import { useSavedActivities } from "@/context/SavedActivitiesContext";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import RestaurantCard from "@/components/RestaurantCard";
import InlineConcierge from "@/components/InlineConcierge";
import PriceTierSelector from "@/components/PriceTierSelector";
import SearchParamsSummary from "@/components/SearchParamsSummary";
import DistanceSlider from "@/components/DistanceSlider";
import LocationInput from "@/components/LocationInput";
import { useLanguage } from "@/context/LanguageContext";
import AddToCalendarDialog from "@/components/AddToCalendarDialog";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";



interface MealOption {
  dish: string;
  localName?: string;
  englishName?: string;
  isRecommended: boolean;
  lowCarbTip?: string;
  dishPrice?: string;
  dishPageUrl?: string;
}

interface ActivityRestaurant {
  name: string;
  cuisine: string;
  distance: string;
  rating: number;
  reviewCount?: number;
  averagePrice?: string;
  whyThisPlace: string;
  mealOptions?: MealOption[];
  orderingPhrase: string;
  address?: string;
  googleMapsUrl?: string;
  appleMapsUrl?: string;
  photoReference?: string;
  distanceFromUser?: string;
  drivingTime?: string;
  michelinStars?: number;
}

interface Activity {
  name: string;
  category: string;
  shortDescription: string;
  fullStory: string;
  visitingHours: string;
  address: string;
  entryPrice?: string;
  googleMapsUrl: string;
  appleMapsUrl: string;
  nearbyRestaurants: ActivityRestaurant[];
  photoReference?: string;
  distanceFromUser?: string;
  drivingTime?: string;
}

const EVENT_CATEGORIES = ["comedy", "musicCategory", "opera", "businessEvents"] as const;

const CATEGORY_CONFIG = [
  { group: "places" as const, items: [
    { key: "sightseeing", icon: Landmark },
    { key: "kidFriendly", icon: Baby },
    { key: "relaxing", icon: Palmtree },
    { key: "museum", icon: Building2 },
    { key: "forADate", icon: Heart },
    { key: "science", icon: FlaskConical },
    { key: "adventure", icon: Mountain },
    { key: "extremeAdventure", icon: Flame },
    { key: "nightlife", icon: PartyPopper },
  ]},
  { group: "events" as const, items: [
    { key: "comedy", icon: Laugh },
    { key: "musicCategory", icon: Music },
    { key: "opera", icon: Theater },
    { key: "businessEvents", icon: Briefcase },
  ]},
];

const openExternal = (url: string) => {
  if (!url) return;
  // Use window.open for maximum compatibility across mobile and desktop
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Fallback: programmatic anchor click (handles popup blockers on some mobile browsers)
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

const AuthPhoto = ({ photoRef, alt }: { photoRef: string; alt: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session?.access_token || cancelled) return setFailed(true);
        const res = await fetch(
          `${PHOTO_BASE}?ref=${encodeURIComponent(photoRef)}&maxwidth=600`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (!res.ok || cancelled) {
          if (!cancelled) setFailed(true);
          return;
        }
        const blob = await res.blob();
        if (!cancelled) setSrc(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [photoRef]);
  if (!src || failed) return null;
  return (
    <div className="relative h-40 w-full overflow-hidden">
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
    </div>
  );
};

type View = "home" | "setup" | "loading" | "results";

const Explore = () => {
  const [view, setView] = useState<View>("home");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 2), "yyyy-MM-dd"));
  const [preferredLanguages, setPreferredLanguages] = useState("");
  const [kidAges, setKidAges] = useState("");
  const [priceTier, setPriceTier] = useState<string>("value");
  const [maxDistance, setMaxDistance] = useState(15);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showRestaurantsFor, setShowRestaurantsFor] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { t, lang } = useLanguage();
  const [savedOpen, setSavedOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { addActivity, removeActivity, isSaved: isActivitySaved, getActivityId } = useSavedActivities();
  const { history, loading: historyLoading, fetchHistory, saveToHistory, deleteEntry } = useRecommendationHistory("explore");
  const { registerActions, clearActions } = usePageActions();
  const openSaved = useCallback(() => setSavedOpen(true), []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);

  useEffect(() => {
    registerActions({ hasSaved: true, hasHistory: true, onOpenSaved: openSaved, onOpenHistory: openHistory, featureKey: "explore", featureLabel: "Explore" });
    return () => clearActions();
  }, [registerActions, clearActions, openSaved, openHistory]);

  const hasEventCategory = selectedCategories.some(c => EVENT_CATEGORIES.includes(c as any));

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t("locationNotSupported"), variant: "destructive" });
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)} (±${Math.round(accuracy)}m)`);
        setCoords({ lat: latitude, lng: longitude });
        setView("setup");
      },
      () => toast({ title: t("locationDenied"), description: t("enableLocation"), variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleManualLocation = (c: { lat: number; lng: number }, name: string) => {
    setCoords(c);
    setLocationName(name);
    setView("setup");
  };

  const toggleCategory = (key: string) => {
    setSelectedCategories(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    );
  };

  const toggleRestaurantsFor = (index: number) => {
    setShowRestaurantsFor(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const fetchActivities = async (pageNum: number, existingNames: string[] = []) => {
    if (!coords) return;
    try {
      const { data, error: fnError } = await supabase.functions.invoke("explore-activities", {
        body: {
          latitude: coords.lat,
          longitude: coords.lng,
          categories: selectedCategories,
          lang,
          dateFrom,
          dateTo,
          preferredLanguages: preferredLanguages || undefined,
          kidAges: kidAges || undefined,
          priceTier,
          maxDistance,
          page: pageNum,
          previousNames: existingNames,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const newActivities = (data.activities || []) as Activity[];
      setHasMore(data.hasMore ?? newActivities.length >= 10);
      return newActivities;
    } catch (e: any) {
      console.error("Explore error:", e);
      toast({ title: t("couldntFetch"), description: t("tryAgain"), variant: "destructive" });
      return [];
    }
  };

  const handleExplore = async () => {
    if (selectedCategories.length === 0) return;

    setView("loading");
    setActivities([]);
    setPage(1);
    setExpandedIndex(null);
    setShowRestaurantsFor(new Set());
    const results = await fetchActivities(1);
    if (results && results.length > 0) {
      setActivities(results);
      setView("results");

      // Auto-save to history
      if (coords) {
        const params = { latitude: coords.lat, longitude: coords.lng, categories: selectedCategories, priceTier, maxDistance, mode: "explore" };
        saveToHistory(params, { activities: results }, locationName);
      }
    } else {
      setView("setup");
    }
  };

  const handleHistorySelect = (entry: import("@/hooks/useRecommendationHistory").HistoryEntry) => {
    const data = entry.response_data;
    const cachedActivities = (data.activities || []) as Activity[];
    setActivities(cachedActivities);
    setLocationName(entry.location_name);
    if (entry.request_params.latitude && entry.request_params.longitude) {
      setCoords({ lat: entry.request_params.latitude, lng: entry.request_params.longitude });
    }
    setView("results");
  };

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const existingNames = activities.map(a => a.name);
    const moreResults = await fetchActivities(nextPage, existingNames);
    if (moreResults && moreResults.length > 0) {
      setActivities(prev => [...prev, ...moreResults]);
      setPage(nextPage);
    } else {
      setHasMore(false);
    }
    setIsLoadingMore(false);
  };

  return (
    <div className="px-6 pt-14 pb-24 relative">
      <AnimatePresence mode="wait">
        {view === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-10">
            <div className="space-y-1 text-center">
              <img src={logo} alt="The Greek Carnivore" className="mx-auto h-24 w-auto object-contain" />
              <h1 className="font-serif text-xl font-semibold text-foreground mt-2">{t("appName")}</h1>
              <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{t("explore")}</p>
              <p className="font-sans text-sm text-muted-foreground mt-3 leading-relaxed">{t("exploreDescription")}</p>
            </div>
            <div data-guide="location-options" className="space-y-4">
              <button data-guide="search-button" onClick={handleShareLocation} className="shimmer-gold gold-glow flex w-full items-center justify-center gap-3 rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 shadow-gold-md">
                <Navigation className="h-4 w-4" />
                {t("shareLocation")}
              </button>
              <LocationInput onLocation={handleManualLocation} />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="font-sans text-sm text-destructive">{error}</p>
              </div>
            )}
            <InlineConcierge />
          </motion.div>
        )}

        {view === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <button onClick={() => { setView("home"); setCoords(null); }} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}

            {/* Date range */}
            <div className="space-y-2">
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("whenVisiting")}</p>
              <div className="flex gap-3">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="flex-1 bg-card border-border text-foreground" />
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="flex-1 bg-card border-border text-foreground" />
              </div>
            </div>

            {/* Category chips */}
            <div className="space-y-4">
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("selectInterests")}</p>
              {CATEGORY_CONFIG.map(group => (
                <div key={group.group} className="space-y-2">
                  <p className="text-xs font-sans font-medium text-muted-foreground">{t(group.group)}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map(({ key, icon: Icon }) => {
                      const selected = selectedCategories.includes(key);
                      return (
                         <button
                          key={key}
                          onClick={() => toggleCategory(key)}
                          className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-sans font-medium border transition-all duration-200 hover:scale-[1.02] ${
                            selected
                              ? "border-gold bg-gold/10 text-gold"
                              : "border-border text-muted-foreground hover:border-foreground/30"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {t(key as any)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Kid ages input */}
            <AnimatePresence>
              {selectedCategories.includes("kidFriendly") && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="space-y-1">
                    <label className="text-xs font-sans font-medium text-muted-foreground">{t("childrenAges")}</label>
                    <Input
                      value={kidAges}
                      onChange={e => setKidAges(e.target.value)}
                      placeholder={t("childrenAgesPlaceholder")}
                      className="bg-card border-border text-foreground"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Language input for events */}
            <AnimatePresence>
              {hasEventCategory && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <Input
                    value={preferredLanguages}
                    onChange={e => setPreferredLanguages(e.target.value)}
                    placeholder={t("preferredLanguages")}
                    className="bg-card border-border text-foreground"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Price tier */}
            <PriceTierSelector onSelect={(tier) => setPriceTier(tier)} isLoading={false} selected={priceTier} />

            {/* Distance slider */}
            <DistanceSlider value={maxDistance} onChange={setMaxDistance} />

            {/* Explore button */}
            <button
              onClick={handleExplore}
              disabled={selectedCategories.length === 0}
              className="shimmer-gold flex w-full items-center justify-center gap-3 rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-40 shadow-gold-md"
            >
              <Compass className="h-4 w-4" />
              {t("exploreButton")}
            </button>
          </motion.div>
        )}

        {view === "loading" && <AiSearchLoader feature="activities" />}

        {view === "results" && (
          <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <button onClick={() => setView("setup")} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <SearchParamsSummary priceTier={priceTier} maxDistance={maxDistance} categories={selectedCategories} dateRange={{ from: dateFrom, to: dateTo }} />
            <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("topActivities")}</p>

            <div className="space-y-3">
              {activities.map((activity, i) => {
                const isExpanded = expandedIndex === i;
                const showingRestaurants = showRestaurantsFor.has(i);
                const hasPhoto = !!activity.photoReference;

                return (
                  <motion.div
                    key={activity.name + i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * (i % 10), duration: 0.3 }}
                    className="rounded-2xl border border-border bg-card overflow-hidden card-lift card-inset"
                  >
                    {/* Photo */}
                    {hasPhoto && (
                      <AuthPhoto photoRef={activity.photoReference!} alt={activity.name} />
                    )}

                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                      className="w-full p-5 text-left space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1.5">
                          <h3 className="font-serif text-lg font-semibold text-foreground leading-tight">{activity.name}</h3>
                          <span className="inline-block rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] font-sans font-medium text-gold">{activity.category}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 shrink-0">
                          <IconButtonWithTooltip
                            tooltip={isActivitySaved(activity.name, locationName) ? "Remove from saved" : "Save activity"}
                            onClick={(e) => {
                              e.stopPropagation();
                              const saved = isActivitySaved(activity.name, locationName);
                              if (saved) {
                                const id = getActivityId(activity.name, locationName);
                                if (id) removeActivity(id);
                                toast({ title: lang === "en" ? "Removed from saved" : "Αφαιρέθηκε από αποθηκευμένα" });
                              } else {
                                addActivity({
                                  name: activity.name,
                                  category: activity.category,
                                  shortDescription: activity.shortDescription,
                                  fullStory: activity.fullStory,
                                  visitingHours: activity.visitingHours,
                                  address: activity.address,
                                  googleMapsUrl: activity.googleMapsUrl,
                                  appleMapsUrl: activity.appleMapsUrl,
                                  photoReference: activity.photoReference,
                                  distanceFromUser: activity.distanceFromUser,
                                  drivingTime: activity.drivingTime,
                                  city: locationName,
                                });
                                toast({ title: lang === "en" ? "Activity saved!" : "Η δραστηριότητα αποθηκεύτηκε!" });
                              }
                            }}
                            className="p-1 rounded-full transition-colors hover:bg-muted"
                            aria-label="Save activity"
                          >
                            {isActivitySaved(activity.name, locationName) ? (
                              <BookmarkCheck className="h-4 w-4 text-gold" />
                            ) : (
                              <Bookmark className="h-4 w-4 text-muted-foreground" />
                            )}
                          </IconButtonWithTooltip>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                      {/* Distance & driving time */}
                      {(activity.distanceFromUser || activity.drivingTime) && (
                        <div className="flex items-center gap-3 text-xs font-sans text-foreground/70">
                          {activity.distanceFromUser && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gold" />{activity.distanceFromUser}</span>}
                          {activity.drivingTime && <span className="flex items-center gap-1"><Car className="h-3 w-3 text-gold" />{activity.drivingTime}</span>}
                        </div>
                      )}
                      <p className="font-sans text-sm text-foreground/80 leading-relaxed line-clamp-2">{activity.shortDescription}</p>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                            <p className="font-sans text-sm text-foreground/80 leading-relaxed">{activity.fullStory}</p>

                            {(activity.visitingHours || activity.entryPrice) && (
                              <div className="flex flex-wrap items-center gap-3 text-xs font-sans">
                                {activity.visitingHours && (
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-gold" />
                                    <span className="text-foreground/80">{t("visitingHours")}: {activity.visitingHours}</span>
                                  </span>
                                )}
                                {activity.entryPrice && (
                                  <span className="flex items-center gap-1.5">
                                    <DollarSign className="h-3 w-3 text-gold" />
                                    <span className="text-foreground/80">{activity.entryPrice}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {activity.address && (
                              <div className="flex items-center gap-1.5 text-xs font-sans text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{activity.address}</span>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                const searchQuery = activity.address ? `${activity.name}, ${activity.address}` : activity.name;
                                const encodedQ = encodeURIComponent(searchQuery);
                                const gUrl = activity.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodedQ}`;
                                const aUrl = activity.appleMapsUrl || `https://maps.apple.com/?q=${encodedQ}`;
                                return (
                                  <>
                                    <button onClick={() => openExternal(gUrl)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
                                      <MapPin className="h-3 w-3" />{t("googleMaps")}
                                    </button>
                                    <button onClick={() => openExternal(aUrl)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
                                      <MapPin className="h-3 w-3" />{t("appleMaps")}
                                    </button>
                                    <AddToCalendarDialog
                                      name={activity.name}
                                      address={activity.address}
                                      description={activity.shortDescription}
                                      trigger={
                                        <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-sans font-medium text-foreground/80 transition-colors hover:border-gold/40 hover:text-gold">
                                          <CalendarPlus className="h-3 w-3" />{t("calendar")}
                                        </button>
                                      }
                                    />
                                  </>
                                );
                              })()}
                            </div>

                            {/* Toggle restaurants button */}
                            {activity.nearbyRestaurants && activity.nearbyRestaurants.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <button
                                  onClick={() => toggleRestaurantsFor(i)}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/20 bg-gold/5 py-3 text-xs font-sans font-medium text-gold transition-colors hover:bg-gold/10"
                                >
                                  <Utensils className="h-3.5 w-3.5" />
                                  {showingRestaurants ? t("hideRestaurantsLabel") : t("showRestaurants")}
                                </button>

                                <AnimatePresence>
                                  {showingRestaurants && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25 }}
                                      className="overflow-hidden space-y-2"
                                    >
                                      <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("nearbyRestaurants")}</p>
                                      {activity.nearbyRestaurants.map((r, ri) => (
                                        <RestaurantCard
                                          key={r.name + ri}
                                          restaurant={{
                                            id: `${i}-${ri}`,
                                            name: r.name,
                                            rating: r.rating,
                                            reviewCount: r.reviewCount,
                                            distance: r.distanceFromUser || r.distance,
                                            drivingTime: r.drivingTime,
                                            averagePrice: r.averagePrice,
                                            whyThisPlace: r.whyThisPlace,
                                            mealOptions: r.mealOptions,
                                            powerPhrase: r.orderingPhrase,
                                            cuisine: r.cuisine,
                                            address: r.address,
                                            googleMapsUrl: r.googleMapsUrl,
                                            appleMapsUrl: r.appleMapsUrl,
                                            photoReference: r.photoReference,
                                          }}
                                          index={ri}
                                          city={r.address || locationName || "Nearby"}
                                          latitude={coords?.lat}
                                          longitude={coords?.lng}
                                          source="explore"
                                        />
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 text-gold animate-spin" />
                    {t("loadingMore")}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t("loadMore")}
                  </>
                )}
              </button>
            )}

            {!hasMore && activities.length > 0 && (
              <p className="text-center font-sans text-xs text-muted-foreground py-4">{t("noMoreActivities")}</p>
            )}

            <button onClick={() => { setView("setup"); setActivities([]); setPage(1); setHasMore(true); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <Navigation className="h-4 w-4" />
              {t("newSearch")}
            </button>

            <InlineConcierge />
          </motion.div>
        )}
      </AnimatePresence>
      <SavedDrawer open={savedOpen} onOpenChange={setSavedOpen} source="explore" />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} history={history} loading={historyLoading} onFetch={fetchHistory} onSelect={handleHistorySelect} onDelete={deleteEntry} />
    </div>
  );
};

export default Explore;
