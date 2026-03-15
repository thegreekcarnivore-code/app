import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface SavedActivity {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  fullStory: string;
  visitingHours: string;
  address: string;
  googleMapsUrl: string;
  appleMapsUrl: string;
  photoReference?: string;
  distanceFromUser?: string;
  drivingTime?: string;
  city: string;
  savedAt: string;
}

interface SavedActivitiesContextType {
  savedActivities: SavedActivity[];
  addActivity: (activity: Omit<SavedActivity, "id" | "savedAt">) => void;
  removeActivity: (id: string) => void;
  isSaved: (name: string, city: string) => boolean;
  getActivityId: (name: string, city: string) => string | undefined;
}

const SavedActivitiesContext = createContext<SavedActivitiesContextType | undefined>(undefined);

const STORAGE_KEY = "saved-activities";

export const SavedActivitiesProvider = ({ children }: { children: ReactNode }) => {
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedActivities));
  }, [savedActivities]);

  const addActivity = (activity: Omit<SavedActivity, "id" | "savedAt">) => {
    const newItem: SavedActivity = {
      ...activity,
      id: `${activity.name}-${activity.city}-${Date.now()}`,
      savedAt: new Date().toISOString(),
    };
    setSavedActivities((prev) => [...prev, newItem]);
  };

  const removeActivity = (id: string) => {
    setSavedActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const isSaved = (name: string, city: string) => {
    return savedActivities.some((a) => a.name === name && a.city === city);
  };

  const getActivityId = (name: string, city: string) => {
    return savedActivities.find((a) => a.name === name && a.city === city)?.id;
  };

  return (
    <SavedActivitiesContext.Provider value={{ savedActivities, addActivity, removeActivity, isSaved, getActivityId }}>
      {children}
    </SavedActivitiesContext.Provider>
  );
};

export const useSavedActivities = () => {
  const ctx = useContext(SavedActivitiesContext);
  if (!ctx) throw new Error("useSavedActivities must be used within SavedActivitiesProvider");
  return ctx;
};
