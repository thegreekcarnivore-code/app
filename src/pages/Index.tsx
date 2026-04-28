import { useState, useEffect, useCallback } from "react";
import AiSearchLoader from "@/components/AiSearchLoader";
import SavedDrawer from "@/components/SavedDrawer";
import HistoryDrawer from "@/components/HistoryDrawer";
import { MapPin, Loader2, Navigation, AlertCircle } from "lucide-react";
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
import AirportSecuritySelector from "@/components/AirportSecuritySelector";
import ScopeToggle from "@/components/ScopeToggle";
import DistanceSlider from "@/components/DistanceSlider";
import LocationInput from "@/components/LocationInput";
import UpcomingCalls from "@/components/UpcomingCalls";
import { useLanguage } from "@/context/LanguageContext";
import logo from "@/assets/logo.png";


interface MealOption {
  dish: string;
  englishName?: string;
  isRecommended: boolean;
  lowCarbTip?: string;
}

interface Restaurant {
  name: string;
  cuisine: string;
  distance: string;
  walkingTime?: string;
  drivingTime?: string;
  rating: number;
  reviewCount?: number;
  averagePrice?: string;
  whyThisPlace: string;
  whatToOrder?: string;
  mealOptions?: MealOption[];
  orderingPhrase: string;
  kitchenHours?: string;
  address?: string;
  photoQuery?: string;
  verificationNote?: string;
  googleMapsUrl?: string;
  appleMapsUrl?: string;
  photoReference?: string;
  menuVerified?: boolean;
}

interface Recommendation {
  summary: string;
  locationName?: string;
  restaurants: Restaurant[];
  whatToAvoid: string;
}

type View = "home" | "airport-check" | "airport-security" | "meal-select" | "price-select" | "loading" | "results";

const Index = () => {
  const [view, setView] = useState<View>("home");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [locationName, setLocationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [selectedMealTime, setSelectedMealTime] = useState<string>("");
  const [selectedPriceTier, setSelectedPriceTier] = useState<string>("value");
  const [scope, setScope] = useState<"closest" | "best_in_town">("closest");
  const [maxDistance, setMaxDistance] = useState(5);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [airportSide, setAirportSide] = useState<"before_security" | "after_security" | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [noMoreResults, setNoMoreResults] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { t, lang } = useLanguage();
  const { history, loading: historyLoading, fetchHistory, saveToHistory, deleteEntry } = useRecommendationHistory("restaurant");
  const { registerActions, clearActions } = usePageActions();

  const openSaved = useCallback(() => setSavedOpen(true), []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);

  useEffect(() => {
    registerActions({ hasSaved: true, hasHistory: true, onOpenSaved: openSaved, onOpenHistory: openHistory, featureKey: "restaurant", featureLabel: "Restaurant" });
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
        setCoords({ lat: latitude, lng: longitude, accuracy });
        checkAirportAndProceed(latitude, longitude);
      },
      () => {
        toast({ title: t("locationDenied"), description: t("enableLocation"), variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleManualLocation = (c: { lat: number; lng: number }, name: string) => {
    setCoords({ lat: c.lat, lng: c.lng });
    setLocationName(name);
    checkAirportAndProceed(c.lat, c.lng);
  };

  const checkAirportAndProceed = async (lat: number, lng: number) => {
    setView("airport-check");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("recommend-restaurants", {
        body: { latitude: lat, longitude: lng, checkAirportOnly: true, lang },
      });
      if (!fnError && data?.isAirport) {
        setView("airport-security");
        return;
      }
    } catch {
      // If check fails, just skip to meal select
    }
    setAirportSide(null);
    setView("meal-select");
  };

  const handleAirportSideSelect = (side: "before_security" | "after_security") => {
    setAirportSide(side);
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
    await fetchRecommendations(coords.lat, coords.lng, undefined, selectedMealTime, tier, scope, maxDistance);
  };

  const handleScopeChange = async (newScope: "closest" | "best_in_town") => {
    setScope(newScope);
    const newMaxDist = newScope === "best_in_town" ? 20 : maxDistance;
    setMaxDistance(newMaxDist);
    if (!coords) return;
    setIsRefreshing(true);
    await fetchRecommendations(coords.lat, coords.lng, undefined, selectedMealTime, selectedPriceTier, newScope, newMaxDist);
    setIsRefreshing(false);
  };

  const fetchRecommendations = async (
    lat: number, lng: number, context?: string,
    mealTime?: string, priceTier?: string, scopeVal?: string, maxDist?: number
  ) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("recommend-restaurants", {
        body: { latitude: lat, longitude: lng, accuracy: coords?.accuracy, context, mealTime, priceTier, scope: scopeVal, airportSide: airportSide || undefined, maxDistance: maxDist, lang },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const rec = data as Recommendation;
      setResult(rec);
      setAllRestaurants(rec.restaurants);
      setNoMoreResults(false);
      const finalLocation = rec.locationName || locationName;
      if (rec.locationName) setLocationName(rec.locationName);
      setView("results");

      // Auto-save to history
      const params = { latitude: lat, longitude: lng, mealTime, priceTier, scope: scopeVal, maxDistance: maxDist };
      saveToHistory(params, rec as unknown as Record<string, any>, finalLocation);
    } catch (e: any) {
      console.error("Recommendation error:", e);
      setError(e.message || "Failed to get recommendations");
      setView("home");
      toast({ title: t("couldntFetch"), description: t("tryAgain"), variant: "destructive" });
    }
  };

  const handleHistorySelect = (entry: import("@/hooks/useRecommendationHistory").HistoryEntry) => {
    const rec = entry.response_data as unknown as Recommendation;
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
        body: { latitude: coords.lat, longitude: coords.lng, accuracy: coords.accuracy, mealTime: selectedMealTime, priceTier: selectedPriceTier, scope, airportSide: airportSide || undefined, exclude: excludeNames, maxDistance, lang },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      const rec = data as Recommendation;
      if (rec.restaurants.length === 0) {
        setNoMoreResults(true);
      } else {
        setAllRestaurants(prev => [...prev, ...rec.restaurants]);
      }
    } catch (e: any) {
      console.error("Load more error:", e);
      toast({ title: t("couldntFetch"), variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="px-6 pt-14 pb-24 relative">
      <AnimatePresence mode="wait">
        {view === "home" && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-10">
            <div className="space-y-1 text-center">
              <img src={logo} alt="The Greek Carnivore" className="mx-auto h-24 w-auto object-contain" />
              <h1 className="font-serif text-xl font-semibold text-foreground mt-2">{t("appName")}</h1>
              <p className="text-[10px] font-sans uppercase tracking-[0.25em] text-gold font-medium">{t("subtitle")}</p>
              <p className="font-sans text-sm text-muted-foreground mt-3 leading-relaxed">{t("homeDescription")}</p>
            </div>
            <div data-guide="location-options" className="space-y-4">
              <button data-guide="search-button" onClick={handleShareLocation} className="shimmer-gold gold-glow flex w-full items-center justify-center gap-3 rounded-2xl bg-gold py-4 font-sans text-sm font-semibold text-gold-foreground transition-all duration-200 hover:opacity-90 shadow-gold-md">
                <Navigation className="h-4 w-4" />
                {t("shareLocation")}
              </button>
              <LocationInput onLocation={handleManualLocation} />
            </div>
            <UpcomingCalls />
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="font-sans text-sm text-destructive">{error}</p>
              </div>
            )}
            <InlineConcierge />
          </motion.div>
        )}

        {view === "airport-check" && (
          <motion.div key="airport-check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 text-center space-y-4">
            <Loader2 className="h-8 w-8 text-gold animate-spin" />
            <p className="font-serif text-lg text-foreground">{t("checkingAirport")}</p>
          </motion.div>
        )}

        {view === "airport-security" && (
          <motion.div key="airport-security" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
            <button onClick={() => { setView("home"); setCoords(null); setAirportSide(null); }} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <AirportSecuritySelector onSelect={handleAirportSideSelect} />
          </motion.div>
        )}

        {view === "meal-select" && (
          <motion.div key="meal-select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
            <button onClick={() => { setView("home"); setCoords(null); setAirportSide(null); }} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <MealTimeSelector onSelect={handleMealSelect} isLoading={false} />
          </motion.div>
        )}

        {view === "price-select" && (
          <motion.div key="price-select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-8">
            <button onClick={() => setView("meal-select")} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <PriceTierSelector onSelect={handlePriceTierSelect} isLoading={false} />
            <DistanceSlider value={maxDistance} onChange={setMaxDistance} />
          </motion.div>
        )}

        {view === "loading" && <AiSearchLoader feature="restaurant" />}

        {view === "results" && result && (
          <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
            <button onClick={() => { setView("home"); setResult(null); setError(null); setCoords(null); }} className="flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors">{t("back")}</button>
            {locationName && <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground"><MapPin className="h-3 w-3" /><span>{locationName}</span></div>}
            <SearchParamsSummary mealTime={selectedMealTime} priceTier={selectedPriceTier} maxDistance={maxDistance} scope={scope} />
            <div className="flex items-center justify-between">
              <ScopeToggle scope={scope} onChange={handleScopeChange} isLoading={isRefreshing} />
              {isRefreshing && <Loader2 className="h-4 w-4 text-gold animate-spin" />}
            </div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-2">
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">{t("yourBestMove")}</p>
              <p className="font-serif text-lg leading-relaxed text-foreground">{result.summary}</p>
            </motion.div>
            {allRestaurants.length > 0 && (
              <div className="space-y-3">
                {allRestaurants.map((r, i) => (
                  <RestaurantCard key={r.name + i} restaurant={{ id: String(i), name: r.name, rating: r.rating, reviewCount: r.reviewCount, distance: r.distance, walkingTime: r.walkingTime, drivingTime: r.drivingTime, averagePrice: r.averagePrice, whyThisPlace: r.whyThisPlace, whatToOrder: r.whatToOrder, mealOptions: r.mealOptions, powerPhrase: r.orderingPhrase, cuisine: r.cuisine, kitchenHours: r.kitchenHours, address: r.address, photoQuery: r.photoQuery, verificationNote: r.verificationNote, googleMapsUrl: r.googleMapsUrl, appleMapsUrl: r.appleMapsUrl, photoReference: r.photoReference, directionHint: (r as any).directionHint, menuVerified: (r as any).menuVerified }} index={i} city={r.address || locationName || "Nearby"} latitude={coords?.lat} longitude={coords?.lng} source="restaurant" />
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
            <button onClick={() => { if (coords) { setView("meal-select"); } else { handleShareLocation(); } }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 font-sans text-sm font-medium text-foreground transition-colors hover:bg-muted">
              <Navigation className="h-4 w-4" />
              {t("newSearch")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <SavedDrawer open={savedOpen} onOpenChange={setSavedOpen} source="restaurant" />
      <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} history={history} loading={historyLoading} onFetch={fetchHistory} onSelect={handleHistorySelect} onDelete={deleteEntry} />
    </div>
  );
};

export default Index;
