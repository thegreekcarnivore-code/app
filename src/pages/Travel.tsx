import { useState, useEffect } from "react";
import AiSearchLoader from "@/components/AiSearchLoader";
import { motion } from "framer-motion";
import { Plus, Plane, MapPin, Utensils, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import RestaurantCard from "@/components/RestaurantCard";
import MealTimeSelector from "@/components/MealTimeSelector";
import SearchParamsSummary from "@/components/SearchParamsSummary";
import PriceTierSelector from "@/components/PriceTierSelector";
import { useLanguage } from "@/context/LanguageContext";
import { usePageActions } from "@/context/PageActionsContext";

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
  websiteUrl?: string;
}

interface Recommendation {
  summary: string;
  locationName?: string;
  restaurants: Restaurant[];
  whatToAvoid: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  isAirport: boolean;
}

type EventView = "idle" | "meal-select" | "price-select" | "loading";

const Travel = () => {
  const { t, lang } = useLanguage();
  const { registerActions, clearActions } = usePageActions();
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [isAirport, setIsAirport] = useState(false);

  useEffect(() => {
    registerActions({ featureKey: "travel", featureLabel: "Travel" });
    return () => clearActions();
  }, [registerActions, clearActions]);

  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [eventView, setEventView] = useState<EventView>("idle");
  const [selectedMealTime, setSelectedMealTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPriceTier, setSelectedPriceTier] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  const addEvent = () => {
    if (!title || !date) return;
    setEvents([...events, { id: Date.now().toString(), title, date, time, location, isAirport }]);
    setTitle("");
    setDate("");
    setTime("");
    setLocation("");
    setIsAirport(false);
  };

  const startSearch = (event: Event) => {
    setActiveEvent(event.id);
    setRecommendation(null);
    setEventView("meal-select");
  };

  const handleMealSelect = (mealTime: string) => {
    setSelectedMealTime(mealTime);
    setEventView("price-select");
  };

  const handlePriceTierSelect = async (tier: string) => {
    setSelectedPriceTier(tier);
    const event = events.find(e => e.id === activeEvent);
    if (!event) return;
    setEventView("loading");
    setLoading(true);

    try {
      // Step 1: Geocode the event location to real coordinates
      let lat = 0, lng = 0;
      if (event.location) {
        const { data: geoData, error: geoError } = await supabase.functions.invoke("geocode", {
          body: { address: event.location },
        });
        if (!geoError && geoData?.latitude && geoData?.longitude) {
          lat = geoData.latitude;
          lng = geoData.longitude;
        }
      }

      if (lat === 0 && lng === 0) {
        toast({ title: "Couldn't find location", description: "Please enter a more specific address or city.", variant: "destructive" });
        setLoading(false);
        setEventView("idle");
        return;
      }

      // Step 2: Use recommend-restaurants with real coordinates (full verification pipeline)
      const context = event.isAirport
        ? `I'm at ${event.location} airport. Find low-carb, high-protein, satiating food options available in airport terminals.`
        : `I'm near ${event.location}. This is for a ${event.title} event.`;

      const { data, error } = await supabase.functions.invoke("recommend-restaurants", {
        body: { latitude: lat, longitude: lng, context, mealTime: selectedMealTime, priceTier: tier, lang },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRecommendation(data as Recommendation);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Couldn't find options", description: "Try sharing more details in the concierge chat.", variant: "destructive" });
    }
    setLoading(false);
    setEventView("idle");
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 pt-14 pb-24 space-y-8">
      <div className="space-y-1">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">Your Agenda</p>
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-semibold text-foreground">Travel & Events</h1>
        </div>
        <p className="font-sans text-sm text-muted-foreground mt-2">Add events. Tap any to find food options nearby.</p>
      </div>

      <div className="space-y-3">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event or meeting name" className="w-full rounded-xl border border-border bg-card py-3.5 px-4 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold" />
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-border bg-card py-3.5 px-4 font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border border-border bg-card py-3.5 px-4 font-sans text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-gold" />
        </div>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (city, address, or airport)" className="w-full rounded-xl border border-border bg-card py-3.5 px-4 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-gold" />
        <label className="flex items-center gap-3 px-1 cursor-pointer">
          <div
            onClick={() => setIsAirport(!isAirport)}
            className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${isAirport ? "bg-gold border-gold" : "border-border bg-card"}`}
          >
            {isAirport && <Plane className="h-3 w-3 text-gold-foreground" />}
          </div>
          <span className="font-sans text-sm text-foreground">This is an airport or travel hub</span>
        </label>
        <button data-guide="search-button" onClick={addEvent} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3.5 font-sans text-sm font-semibold text-gold-foreground transition-opacity hover:opacity-90">
          <Plus className="h-4 w-4" />
          Add to Agenda
        </button>
      </div>

      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="space-y-3">
              <button
                onClick={() => startSearch(event)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-left transition-colors hover:border-gold/40"
              >
                {event.isAirport ? <Plane className="h-4 w-4 text-gold shrink-0" /> : <Calendar className="h-4 w-4 text-gold shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground truncate">{event.title}</p>
                  <p className="font-sans text-xs text-muted-foreground">{event.date}{event.time ? ` · ${event.time}` : ""}</p>
                  {event.location && (
                    <p className="font-sans text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {event.location}
                    </p>
                  )}
                </div>
                <Utensils className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>

              {/* Meal time selector */}
              {activeEvent === event.id && eventView === "meal-select" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pl-4 border-l-2 border-gold/20">
                  <MealTimeSelector onSelect={handleMealSelect} isLoading={false} />
                </motion.div>
              )}

              {/* Price tier selector */}
              {activeEvent === event.id && eventView === "price-select" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pl-4 border-l-2 border-gold/20">
                  <PriceTierSelector onSelect={handlePriceTierSelect} isLoading={false} />
                </motion.div>
              )}

              {/* Loading */}
              {activeEvent === event.id && eventView === "loading" && (
                <AiSearchLoader feature="travel" compact />
              )}

              {/* Results */}
              {activeEvent === event.id && recommendation && !loading && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pl-4 border-l-2 border-gold/20">
                  <SearchParamsSummary mealTime={selectedMealTime} priceTier={selectedPriceTier} />
                  <p className="font-serif text-sm leading-relaxed text-foreground">{recommendation.summary}</p>
                  {recommendation.restaurants.map((r, i) => (
                    <RestaurantCard
                      key={r.name + i}
                      restaurant={{
                        id: String(i),
                        name: r.name,
                        rating: r.rating,
                        reviewCount: r.reviewCount,
                        distance: r.distance,
                        walkingTime: r.walkingTime,
                        drivingTime: r.drivingTime,
                        averagePrice: r.averagePrice,
                        whyThisPlace: r.whyThisPlace,
                        whatToOrder: r.whatToOrder,
                        mealOptions: r.mealOptions,
                        powerPhrase: r.orderingPhrase,
                        cuisine: r.cuisine,
                        kitchenHours: r.kitchenHours,
                        address: r.address,
                        photoQuery: r.photoQuery,
                        verificationNote: r.verificationNote,
                        googleMapsUrl: r.googleMapsUrl,
                        appleMapsUrl: r.appleMapsUrl,
                        photoReference: r.photoReference,
                        websiteUrl: r.websiteUrl,
                      }}
                      index={i}
                      city={r.address || event.location || "Nearby"}
                    />
                  ))}
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground mb-1">What to Avoid</p>
                    <p className="font-sans text-sm text-foreground/80">{recommendation.whatToAvoid}</p>
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="font-sans text-sm text-muted-foreground">No events yet.</p>
          <p className="font-sans text-xs text-muted-foreground mt-1">Add meetings, flights, or trips above.</p>
        </div>
      )}
    </motion.div>
  );
};

export default Travel;
