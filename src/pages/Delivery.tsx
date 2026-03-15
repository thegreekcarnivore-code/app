import { useState, useEffect, useCallback } from "react";
import AiSearchLoader from "@/components/AiSearchLoader";
import SavedDrawer from "@/components/SavedDrawer";
import HistoryDrawer from "@/components/HistoryDrawer";
import { MapPin, Loader2, Navigation, AlertCircle, Truck } from "lucide-react";
import { usePageActions } from "@/context/PageActionsContext";
import { useRecommendationHistory } from "@/hooks/useRecommendationHistory";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import RestaurantCard from "@/components/RestaurantCard";
import InlineConcierge from "@/components/InlineConcierge";
import MealTimeSelector from "@/components/MealTimeSelector";
import SearchParamsSummary from "@/components/SearchParamsSummary";
import PriceTierSelector from "@/components/PriceTierSelector";
import LocationInput from "@/components/LocationInput";
import { useLanguage } from "@/context/LanguageContext";
import logo from "@/assets/logo.png";



interface MealOption {
  dish: string;
  englishName?: string;
  isRecommended: boolean;
  lowCarbTip?: string;
}

interface DeliveryRestaurant {
  name: string;
  cuisine: string;
  distance: string;
  rating: number;
  reviewCount?: number;
  averagePrice?: string;
  whyThisPlace: string;
  mealOptions?: MealOption[];
  orderingPhrase: string;
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
}

interface DeliveryResult {
  summary: string;
  locationName?: string;
  restaurants: DeliveryRestaurant[];
  whatToAvoid: string;
}

type View = "home" | "meal-select" | "price-select" | "loading" | "results";

const Delivery = () => {
  const [view, setView] = useState<View>("home");
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<DeliveryRestaurant[]>([]);
  const [locationName, setLocationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMealTime, setSelectedMealTime] = useState<string>("");
  const [selectedPriceTier, setSelectedPriceTier] = useState<string>("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [noMoreResults, setNoMoreResults] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { t, lang } = useLanguage();
  const { history, loading: historyLoading, fetchHistory, saveToHistory, deleteEntry } = useRecommendationHistory("delivery");
  const { registerActions, clearActions } = usePageActions();

  const openSaved = useCallback(() => setSavedOpen(true), []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);

  useEffect(() => {
    registerActions({ hasSaved: true, hasHistory: true, onOpenSaved: openSaved, onOpenHistory: openHistory, featureKey: "delivery", featureLabel: "Delivery" });
    return () => clearActions();
  }, [registerActions, clearActions, openSaved, openHistory]);

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t("locationNotSupported"), variant: "destructive" });
      return;
    }
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocationName(`${latitude}, ${longitude} (±${Math.round(accuracy)}m)`);
        setCoords({ lat: latitude, lng: longitude });
        setView("meal-select");
      },
      () => toast({ title: t("locationDenied"), variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleManualLocation = (c: { lat: number; lng: number }, name: string) => {
    setCoords(c);
    setLocationName(name);
    setView("meal-select");
  };

  const handleMealSelect = (mealTime: string) => {
    setSelectedMealTime(mealTime);
    setView("price-select");
  };

  const handlePriceTierSelect = async (tier: string) => {
    setSelectedPriceTier(tier);
    if (!coords) return;

    setView("loading");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("recommend-restaurants", {
        body: { latitude: coords.lat, longitude: coords.lng, mealTime: selectedMealTime, priceTier: tier, mode: "delivery", lang },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const rec = data as DeliveryResult;
      setResult(rec);
      setAllRestaurants(rec.restaurants);
      setNoMoreResults(false);
      const finalLocation = rec.locationName || locationName;
      if (rec.locationName) setLocationName(rec.locationName);
      setView("results");

      // Auto-save to history
      saveToHistory({ latitude: coords.lat, longitude: coords.lng, mealTime: selectedMealTime, priceTier: tier, mode: "delivery" }, rec as unknown as Record<string, any>, finalLocation);
    } catch (e: any) {
      console.error("Delivery error:", e);
      setError(e.message || "Failed to get delivery options");
      setView("home");
      toast({ title: t("couldntFetchDelivery"), variant: "destructive" });
    }
  };

  const handleHistorySelect = (entry: import("@/hooks/useRecommendationHistory").HistoryEntry) => {
    const rec = entry.response_data as unknown as DeliveryResult;
    setResult(rec);
    setAllRestaurants(rec.restaurants);
    setNoMoreResults(false);
    setLocationName(entry.location_name);
    if (entry.request_params.latitude && entry.request_params.longitude) {
      setCoords({ lat: entry.request_params.latitude, lng: entry.request_params.longitude });
    }
    setView("results");
  };

  const handleLoadMore = async () => {
    if (!coords || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const excludeNames = allRestaurants.map(r => r.name);
      const { data, error: fnError } = await supabase.functions.invoke("recommend-restaurants", {
        body: { latitude: coords.lat, longitude: coords.lng, mealTime: selectedMealTime, priceTier: selectedPriceTier, mode: "delivery", exclude: excludeNames, lang },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const rec = data as DeliveryResult;
      if (rec.restaurants.length === 0) {
        setNoMoreResults(true);
      } else {
        setAllRestaurants(prev => [...prev, ...rec.restaurants]);
      }
    } catch (e: any) {
      console.error("Load more error:", e);
      toast({ title: t("couldntFetchDelivery"), variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="px-6 pt-14 pb-24 relative">
      <AnimatePresence mode="wait">
        {view === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-10">
            <div className="space-y-1 text-center">
              <img src={logo} alt="The Greek Carnivore" className="mx-auto h-24 w-auto object-contain" />
              <h1 className="font-serif text-xl font-semibold text-foreground mt-2">{t("appName")}</h1>
              <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{t("delivery")}</p>
              <p className="font-sans text-sm text-muted-foreground mt-3 leading-relaxed">{t("deliveryDescription")}</p>
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
            <InlineConcierge mode="delivery" />
          </motion.div>
        )}

        {view === "meal-select" && (
          <motion.div key="meal-select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            <button onClick={() => { setView("home"); setCoords(null); }} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <MealTimeSelector onSelect={handleMealSelect} isLoading={false} />
          </motion.div>
        )}

        {view === "price-select" && (
          <motion.div key="price-select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            <button onClick={() => setView("meal-select")} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <PriceTierSelector onSelect={handlePriceTierSelect} isLoading={false} />
          </motion.div>
        )}

        {view === "loading" && <AiSearchLoader feature="delivery" />}

        {view === "results" && result && (
          <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <button onClick={() => { setView("home"); setResult(null); setCoords(null); }} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <SearchParamsSummary mealTime={selectedMealTime} priceTier={selectedPriceTier} />
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-2">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gold" />
                <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("deliveryOptions")}</p>
              </div>
              <p className="font-serif text-lg leading-relaxed text-foreground">{result.summary}</p>
            </motion.div>
            {allRestaurants.length > 0 && (
              <div className="space-y-3">
                {allRestaurants.map((r, i) => (
                  <RestaurantCard key={r.name + i} restaurant={{ id: String(i), name: r.name, rating: r.rating, reviewCount: r.reviewCount, distance: r.distance, averagePrice: r.averagePrice, whyThisPlace: r.whyThisPlace, mealOptions: r.mealOptions, powerPhrase: r.orderingPhrase, cuisine: r.cuisine, kitchenHours: r.kitchenHours, address: r.address, photoQuery: r.photoQuery, verificationNote: r.verificationNote, deliveryTime: r.deliveryTime, orderingMethod: r.orderingMethod, dietBadges: r.dietBadges, googleMapsUrl: r.googleMapsUrl, appleMapsUrl: r.appleMapsUrl, websiteUrl: r.websiteUrl, photoReference: r.photoReference }} index={i} city={r.address || locationName || "Nearby"} source="delivery" />
                ))}
              </div>
            )}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="rounded-2xl border border-border bg-card p-6 space-y-1.5 card-inset">
              <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-muted-foreground font-medium">{t("whatToAvoid")}</p>
              <p className="font-sans text-sm text-foreground/80 leading-relaxed">{result.whatToAvoid}</p>
            </motion.div>
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore || noMoreResults}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t("loadingMoreOptions")}</>
              ) : noMoreResults ? (
                t("noMoreOptions")
              ) : (
                t("showMoreOptions")
              )}
            </button>
            <button onClick={() => { if (coords) setView("meal-select"); else handleShareLocation(); }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <Navigation className="h-4 w-4" />
              {t("newSearch")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <SavedDrawer open={savedOpen} onOpenChange={setSavedOpen} source="delivery" />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} history={history} loading={historyLoading} onFetch={fetchHistory} onSelect={handleHistorySelect} onDelete={deleteEntry} />
    </div>
  );
};

export default Delivery;
