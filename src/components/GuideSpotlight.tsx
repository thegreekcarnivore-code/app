import { useEffect, useState, useCallback, useRef } from "react";
import { useGuideHighlight } from "@/context/GuideHighlightContext";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 4;
const WAIT_TIMEOUT = 60000; // 60s before auto-skip

// Steps that trigger geolocation — after clicking, wait for the location
// flow to complete (indicated by the next step's element appearing in DOM)
const GEOLOCATION_STEPS = new Set(["search-button", "location-options"]);

const GuideSpotlight = () => {
  const { state, advanceStep, dismissHighlight } = useGuideHighlight();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLanguage();
  const [rect, setRect] = useState<Rect | null>(null);
  const [navigated, setNavigated] = useState(false);
  const [urgent, setUrgent] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [geoWaiting, setGeoWaiting] = useState(false);
  const urgentTimer = useRef<ReturnType<typeof setTimeout>>();
  const observerRef = useRef<MutationObserver | null>(null);
  const waitTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup helper
  const cleanupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (waitTimeoutRef.current) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = undefined;
    }
  }, []);

  // Reset state when step changes
  useEffect(() => {
    setUrgent(false);
    setWaiting(false);
    setGeoWaiting(false);
    setRect(null);
    if (urgentTimer.current) clearTimeout(urgentTimer.current);
    cleanupObserver();
  }, [state.target, cleanupObserver]);

  // Start 5s urgency timer once rect is visible
  useEffect(() => {
    if (!rect || !state.active) return;
    if (urgentTimer.current) clearTimeout(urgentTimer.current);
    urgentTimer.current = setTimeout(() => setUrgent(true), 5000);
    return () => {
      if (urgentTimer.current) clearTimeout(urgentTimer.current);
    };
  }, [rect, state.active, state.target]);

  // Step 1: navigate if needed
  useEffect(() => {
    if (!state.active) {
      setNavigated(false);
      setRect(null);
      setWaiting(false);
      setGeoWaiting(false);
      return;
    }
    if (state.navigateTo && location.pathname !== state.navigateTo) {
      navigate(state.navigateTo);
      setNavigated(false);
    } else {
      setNavigated(true);
    }
  }, [state.active, state.navigateTo, location.pathname, navigate]);

  useEffect(() => {
    if (state.active && state.navigateTo && location.pathname === state.navigateTo) {
      setNavigated(true);
    }
  }, [location.pathname, state.active, state.navigateTo]);

  // Measure and scroll to element
  const measureElement = useCallback((el: Element) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
    }, 400);
  }, []);

  // Step 2: find element or watch for it to appear
  useEffect(() => {
    if (!navigated || !state.active || !state.target) return;

    const tryFind = () => {
      const el = document.querySelector(`[data-guide="${state.target}"]`);
      if (el) {
        setWaiting(false);
        cleanupObserver();
        measureElement(el);
        return true;
      }
      return false;
    };

    // Try after a short render delay
    const initialTimer = setTimeout(() => {
      if (tryFind()) return;

      // Element not found — enter waiting mode with MutationObserver
      setWaiting(true);
      setRect(null);

      const observer = new MutationObserver(() => {
        tryFind();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-guide"],
      });
      observerRef.current = observer;

      // Safety timeout — auto-skip after WAIT_TIMEOUT
      waitTimeoutRef.current = setTimeout(() => {
        console.warn(
          `[GuideSpotlight] Target "${state.target}" not found after timeout, skipping.`
        );
        cleanupObserver();
        setWaiting(false);
        setRect(null);
        advanceStep();
      }, WAIT_TIMEOUT);
    }, 300);

    return () => {
      clearTimeout(initialTimer);
      cleanupObserver();
    };
  }, [navigated, state.active, state.target, measureElement, advanceStep, cleanupObserver]);

  // Update position on resize/scroll
  useEffect(() => {
    if (!state.active || !rect) return;
    const handler = () => {
      const el = document.querySelector(`[data-guide="${state.target}"]`);
      if (el) measureElement(el);
    };
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [state.active, rect, state.target, measureElement]);

  // Only advance when user clicks inside the highlighted area
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!rect) return;
    const x = e.clientX;
    const y = e.clientY;
    const inTarget =
      x >= rect.left &&
      x <= rect.left + rect.width &&
      y >= rect.top &&
      y <= rect.top + rect.height;

    if (inTarget) {
      // For container targets like location-options, let the click pass through
      // to the actual interactive child element underneath
      const elUnderneath = document.elementFromPoint(x, y) as HTMLElement | null;
      
      // If this is a geolocation/location-options step, enter waiting mode
      if (state.target && GEOLOCATION_STEPS.has(state.target)) {
        // Click the actual element underneath (button, input, etc.)
        if (elUnderneath) {
          const clickable = elUnderneath.closest("button, a, input") as HTMLElement | null;
          if (clickable) clickable.click();
          else elUnderneath.click();
        }
        
        setRect(null);
        setGeoWaiting(true);

        // Watch for the next step's element to appear
        const nextStep = state.pendingSteps[0];
        if (nextStep) {
          const observer = new MutationObserver(() => {
            const nextEl = document.querySelector(`[data-guide="${nextStep.highlight}"]`);
            if (nextEl) {
              cleanupObserver();
              setGeoWaiting(false);
              advanceStep();
            }
          });
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-guide"],
          });
          observerRef.current = observer;

          waitTimeoutRef.current = setTimeout(() => {
            cleanupObserver();
            setGeoWaiting(false);
            advanceStep();
          }, 30000);
        } else {
          setGeoWaiting(false);
          advanceStep();
        }
        return;
      }

      // Normal step — click the element and advance
      const el = document.querySelector(
        `[data-guide="${state.target}"]`
      ) as HTMLElement | null;
      if (el) el.click();

      setRect(null);
      setWaiting(false);
      advanceStep();
    }
    // Clicking outside does nothing
  };

  const hasMore = state.pendingSteps.length > 0;

  // Close button component
  const CloseButton = ({ className = "" }: { className?: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        cleanupObserver();
        dismissHighlight();
      }}
      className={`flex items-center justify-center rounded-full bg-card/90 border border-border shadow-lg transition-all hover:bg-card hover:border-gold/40 ${className}`}
      style={{ width: 32, height: 32 }}
      aria-label="Close guide"
    >
      <X className="h-4 w-4 text-foreground" />
    </button>
  );

  // Geo-waiting state — show permission prompt guidance
  if (geoWaiting && state.active) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 shadow-lg shadow-gold/20"
        >
          <Loader2 className="h-3.5 w-3.5 text-gold-foreground animate-spin" />
          <span className="font-sans text-xs font-semibold text-gold-foreground whitespace-nowrap">
            {lang === "el"
              ? "Μοιράσου ή γράψε τοποθεσία..."
              : "Share or enter your location..."}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              cleanupObserver();
              dismissHighlight();
            }}
            className="ml-1 flex items-center justify-center rounded-full bg-gold-foreground/20 hover:bg-gold-foreground/30 transition-colors"
            style={{ width: 20, height: 20 }}
          >
            <X className="h-3 w-3 text-gold-foreground" />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Waiting state — show floating indicator, no blocking overlay
  if (waiting && state.active) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 shadow-lg shadow-gold/20"
        >
          <Loader2 className="h-3.5 w-3.5 text-gold-foreground animate-spin" />
          <span className="font-sans text-xs font-semibold text-gold-foreground whitespace-nowrap">
            {state.totalSteps > 1 && (
              <span className="opacity-70 mr-1.5">
                {state.currentStep}/{state.totalSteps}
              </span>
            )}
            {lang === "el"
              ? "Συνέχισε, σε ακολουθώ..."
              : "Go ahead, I'm following..."}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              cleanupObserver();
              dismissHighlight();
            }}
            className="ml-1 flex items-center justify-center rounded-full bg-gold-foreground/20 hover:bg-gold-foreground/30 transition-colors"
            style={{ width: 20, height: 20 }}
          >
            <X className="h-3 w-3 text-gold-foreground" />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!state.active || !rect) return null;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Tooltip position
  const tooltipTop = rect.top + rect.height + 12;
  const tooltipBelow = tooltipTop + 40 < window.innerHeight;
  const tooltipY = tooltipBelow ? tooltipTop : rect.top - 48;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleOverlayClick}
      >
        {/* Close button — top right */}
        <div className="absolute top-4 right-4 z-10" style={{ pointerEvents: "auto" }}>
          <CloseButton />
        </div>

        {/* Dark overlay with cutout */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <mask id="guide-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={8}
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.65)"
            mask="url(#guide-mask)"
            style={{ pointerEvents: "auto", cursor: "default" }}
          />
        </svg>

        {/* Border ring */}
        <motion.div
          className="absolute rounded-lg pointer-events-none"
          style={{
            top: rect.top - 2,
            left: rect.left - 2,
            width: rect.width + 4,
            height: rect.height + 4,
            border: urgent
              ? "3px solid hsl(var(--gold))"
              : "2px solid hsl(var(--gold))",
          }}
          animate={
            urgent
              ? {
                  boxShadow: [
                    "0 0 0 0 hsl(var(--gold) / 0.7)",
                    "0 0 0 8px hsl(var(--gold) / 0)",
                    "0 0 0 0 hsl(var(--gold) / 0.7)",
                  ],
                  scale: [1, 1.03, 1],
                }
              : {
                  boxShadow: [
                    "0 0 0 0 hsl(var(--gold) / 0.4)",
                    "0 0 0 6px hsl(var(--gold) / 0)",
                    "0 0 0 0 hsl(var(--gold) / 0.4)",
                  ],
                }
          }
          transition={{
            duration: urgent ? 0.8 : 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Urgent: tap here arrow */}
        {urgent && (
          <motion.div
            className="absolute pointer-events-none flex items-center gap-1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              top: cy - 10,
              left: rect.left - 48,
            }}
          >
            <motion.span
              className="text-lg"
              animate={{ x: [0, 6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              👉
            </motion.span>
          </motion.div>
        )}

        {/* Tooltip label */}
        {state.label && (() => {
          const labelMaxWidth = Math.min(280, window.innerWidth - 32);
          // Center horizontally on the highlighted element, clamped to screen edges
          const idealLeft = cx - labelMaxWidth / 2;
          const clampedLeft = Math.max(8, Math.min(idealLeft, window.innerWidth - labelMaxWidth - 8));
          return (
            <motion.div
              initial={{ opacity: 0, y: tooltipBelow ? -8 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.25 }}
              className="absolute px-3 py-2 rounded-lg bg-gold text-gold-foreground font-sans text-xs font-semibold shadow-lg pointer-events-none text-center leading-relaxed"
              style={{
                top: tooltipY,
                left: clampedLeft,
                maxWidth: labelMaxWidth,
                width: "max-content",
              }}
            >
              {state.totalSteps > 1 && (
                <span className="mr-1.5 opacity-70">
                  {state.currentStep}/{state.totalSteps}
                </span>
              )}
              {urgent ? "👆 " : ""}
              {state.label}
              {hasMore && <span className="ml-1 opacity-70">→</span>}
            </motion.div>
          );
        })()}
      </motion.div>
    </AnimatePresence>
  );
};

export default GuideSpotlight;
