export interface Restaurant {
  id: string;
  name: string;
  rating: number;
  distance: string;
  whyThisPlace: string;
  whatToOrder: string;
  powerPhrase: string;
  cuisine: string;
  kitchenHours?: string;
  address?: string;
  photoQuery?: string;
}

export interface Recommendation {
  bestMoveNow: string;
  restaurants: Restaurant[];
  whatToAvoid: string;
}

export const recommendations: Record<string, Recommendation> = {
  "quick-dinner": {
    bestMoveNow: "Head to Nobu. Light, clean, impressive without trying. Order the black cod — universally safe, universally respected.",
    restaurants: [
      {
        id: "1",
        name: "Nobu",
        rating: 4.7,
        distance: "0.8 km",
        whyThisPlace: "Effortlessly elegant. No one questions a Nobu choice.",
        whatToOrder: "Black Cod Miso, edamame, sparkling water with yuzu.",
        powerPhrase: "I keep it simple here — the cod speaks for itself.",
        cuisine: "Japanese",
      },
      {
        id: "2",
        name: "Locanda Verde",
        rating: 4.5,
        distance: "1.2 km",
        whyThisPlace: "Warm, understated Italian. Perfect for unwinding.",
        whatToOrder: "Sheep's milk ricotta appetizer, branzino, glass of Vermentino.",
        powerPhrase: "This is my neighborhood spot when I need something grounding.",
        cuisine: "Italian",
      },
      {
        id: "3",
        name: "The Grill",
        rating: 4.6,
        distance: "1.5 km",
        whyThisPlace: "Classic American power dining without the noise.",
        whatToOrder: "Dover sole, Caesar salad, still water.",
        powerPhrase: "Old school, done right. No surprises — that's the point.",
        cuisine: "American",
      },
    ],
    whatToAvoid: "Skip heavy pasta dishes and fried appetizers this late. Avoid wine if you have early calls — sparkling water with citrus reads just as confident.",
  },
  "business-dinner": {
    bestMoveNow: "Book The Grill at The Seagram Building. Power venue, neutral menu, zero risk. Let the room do the talking.",
    restaurants: [
      {
        id: "4",
        name: "The Grill",
        rating: 4.6,
        distance: "1.5 km",
        whyThisPlace: "The quintessential power dining room. Clients feel important here.",
        whatToOrder: "Dover sole tableside, wedge salad, Sancerre for the table.",
        powerPhrase: "I thought we deserved somewhere with a little gravitas tonight.",
        cuisine: "American",
      },
      {
        id: "5",
        name: "Le Bernardin",
        rating: 4.8,
        distance: "2.1 km",
        whyThisPlace: "Three Michelin stars. Says everything without saying anything.",
        whatToOrder: "Chef's tasting, let the sommelier guide wine. Trust the room.",
        powerPhrase: "I trust Eric Ripert with everything — shall we let the kitchen lead?",
        cuisine: "French",
      },
    ],
    whatToAvoid: "No sushi — chopstick fumbling kills authority. No trendy spots your client hasn't heard of. No shared plates — this isn't brunch.",
  },
  "hotel-breakfast": {
    bestMoveNow: "Order room service: poached eggs, avocado, black coffee. Skip the buffet — you're not here to browse.",
    restaurants: [
      {
        id: "6",
        name: "In-Room Dining",
        rating: 4.2,
        distance: "0 km",
        whyThisPlace: "Privacy, speed, control. Start your day on your terms.",
        whatToOrder: "Poached eggs, smoked salmon, sourdough, black coffee. Fresh berries.",
        powerPhrase: "I had a quiet breakfast in — needed the headspace before today.",
        cuisine: "International",
      },
    ],
    whatToAvoid: "Skip the continental buffet — it's designed for tourists. Avoid pastries and juice (sugar crash by 10am). No heavy cooked breakfast unless you have a light lunch planned.",
  },
  "food-delivery": {
    bestMoveNow: "Order from Sweetgreen or a Mediterranean spot. Clean, arrives well, no mess. You'll feel sharp, not sluggish.",
    restaurants: [
      {
        id: "7",
        name: "Sweetgreen",
        rating: 4.3,
        distance: "Delivery",
        whyThisPlace: "Consistent, clean, travels well. No surprises.",
        whatToOrder: "Harvest Bowl, extra protein. Skip the dressing — olive oil and lemon.",
        powerPhrase: "I keep delivery simple — fuel, not an event.",
        cuisine: "Health",
      },
      {
        id: "8",
        name: "Dig Inn",
        rating: 4.1,
        distance: "Delivery",
        whyThisPlace: "Hearty but clean. Good when you need substance.",
        whatToOrder: "Roasted salmon plate, charred broccoli, brown rice.",
        powerPhrase: "Sometimes you just need a proper plate without the fuss.",
        cuisine: "Farm-to-table",
      },
    ],
    whatToAvoid: "No pizza delivery — it's comfort, not fuel. No Thai or Indian for delivery (reheats poorly, smells linger). No sushi delivery below premium tier.",
  },
  "at-restaurant": {
    bestMoveNow: "Scan for grilled fish or a clean protein with vegetables. Skip the specials — they're margin plays. Ask the server what the kitchen does best.",
    restaurants: [],
    whatToAvoid: "Avoid anything deep-fried, heavy cream sauces, or bread baskets. Skip dessert — order an espresso instead. If the wine list is unfamiliar, ask for 'a dry white, medium body' and let the sommelier work.",
  },
  "emergency": {
    bestMoveNow: "Grilled chicken breast, steamed vegetables, still water. Available everywhere. Zero risk, zero thought required. You're covered.",
    restaurants: [],
    whatToAvoid: "Don't overthink it. The emergency option exists so you don't have to decide. Grilled protein + vegetables + water. Done. Move on to what matters.",
  },
};

export const needOptions = [
  { id: "quick-dinner", label: "Quick dinner", description: "A sharp recommendation, right now" },
  { id: "business-dinner", label: "Business dinner", description: "Impress without overthinking" },
  { id: "hotel-breakfast", label: "Hotel breakfast", description: "Start the day clean and sharp" },
  { id: "food-delivery", label: "Food delivery", description: "Clean fuel, delivered" },
  { id: "at-restaurant", label: "At a restaurant", description: "What should I order here?" },
  { id: "emergency", label: "Emergency safe option", description: "No thinking required" },
];
