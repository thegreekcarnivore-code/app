import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";

export type SavedSource = "restaurant" | "delivery" | "explore" | "shopping";

export interface SavedRestaurant {
  id: string;
  name: string;
  rating: number;
  distance: string;
  whyThisPlace: string;
  whatToOrder?: string;
  powerPhrase: string;
  cuisine: string;
  kitchenHours?: string;
  address?: string;
  photoQuery?: string;
  city: string;
  savedAt: string;
  source: SavedSource;
}

interface SavedRestaurantsContextType {
  saved: SavedRestaurant[];
  addRestaurant: (restaurant: Omit<SavedRestaurant, "id" | "savedAt">) => void;
  removeRestaurant: (id: string) => void;
  isSaved: (name: string, city: string) => boolean;
  getSavedBySource: (source: SavedSource) => SavedRestaurant[];
}

const SavedRestaurantsContext = createContext<SavedRestaurantsContextType | undefined>(undefined);

const STORAGE_KEY = "saved-restaurants";

export const SavedRestaurantsProvider = ({ children }: { children: ReactNode }) => {
  const [saved, setSaved] = useState<SavedRestaurant[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  const addRestaurant = useCallback((restaurant: Omit<SavedRestaurant, "id" | "savedAt">) => {
    const newItem: SavedRestaurant = {
      ...restaurant,
      id: `${restaurant.name}-${restaurant.city}-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
    setSaved((prev) => [...prev, newItem]);
  }, []);

  const removeRestaurant = useCallback((id: string) => {
    setSaved((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const isSaved = useCallback((name: string, city: string) => {
    return saved.some((r) => r.name === name && r.city === city);
  }, [saved]);

  const getSavedBySource = useCallback((source: SavedSource) => {
    return saved.filter((r) => r.source === source);
  }, [saved]);

  const value = useMemo(() => ({ saved, addRestaurant, removeRestaurant, isSaved, getSavedBySource }), [saved, addRestaurant, removeRestaurant, isSaved, getSavedBySource]);

  return (
    <SavedRestaurantsContext.Provider value={value}>
      {children}
    </SavedRestaurantsContext.Provider>
  );
};

export const useSavedRestaurants = () => {
  const ctx = useContext(SavedRestaurantsContext);
  if (!ctx) throw new Error("useSavedRestaurants must be used within SavedRestaurantsProvider");
  return ctx;
};
