import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import logo from "@/assets/logo.png";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)] dark:[background-image:none]" />
      <div className="relative z-10 text-center space-y-4 max-w-xs">
        <img src={logo} alt="The Greek Carnivore" className="mx-auto h-14 w-auto object-contain opacity-80" />
        <div className="space-y-1">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.28em] text-gold">404</p>
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            {lang === "el" ? "Η σελίδα δεν βρέθηκε" : "Page not found"}
          </h1>
          <p className="font-sans text-sm text-muted-foreground">
            {lang === "el"
              ? "Ο σύνδεσμος που ακολούθησες δεν υπάρχει ή έχει αλλάξει."
              : "The link you followed doesn't exist or has moved."}
          </p>
        </div>
        <button
          onClick={() => navigate("/home")}
          className="inline-flex items-center justify-center rounded-2xl border border-gold/30 bg-card px-5 py-2.5 font-sans text-sm font-medium text-foreground transition-all hover:border-gold/60 hover:bg-gold/5"
        >
          {lang === "el" ? "Επιστροφή στην αρχική" : "Back to home"}
        </button>
      </div>
    </div>
  );
};

export default NotFound;
