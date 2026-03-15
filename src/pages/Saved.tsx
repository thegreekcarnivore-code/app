import { motion } from "framer-motion";
import { Bookmark, Trash2, MapPin } from "lucide-react";
import { useSavedRestaurants, SavedRestaurant } from "@/context/SavedRestaurantsContext";
import RestaurantCard from "@/components/RestaurantCard";

const Saved = () => {
  const { saved } = useSavedRestaurants();

  // Group by city
  const grouped = saved.reduce<Record<string, SavedRestaurant[]>>((acc, r) => {
    const city = r.city || "Unknown";
    if (!acc[city]) acc[city] = [];
    acc[city].push(r);
    return acc;
  }, {});

  const cities = Object.keys(grouped).sort();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="px-6 pt-14 pb-24 space-y-8"
    >
      <div className="space-y-1">
        <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-gold">Collection</p>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Saved Restaurants</h1>
        <p className="font-sans text-sm text-muted-foreground mt-2">
          Your curated shortlist, organized by city.
        </p>
      </div>

      {cities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bookmark className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="font-sans text-sm text-muted-foreground">No saved restaurants yet.</p>
          <p className="font-sans text-xs text-muted-foreground mt-1">
            Tap the bookmark icon on any recommendation to save it here.
          </p>
        </div>
      ) : (
        cities.map((city) => (
          <div key={city} className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-gold" />
              <h2 className="font-serif text-lg font-semibold text-foreground">{city}</h2>
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
              />
            ))}
          </div>
        ))
      )}
    </motion.div>
  );
};

export default Saved;
