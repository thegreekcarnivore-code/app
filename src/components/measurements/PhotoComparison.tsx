import { useState, useRef, useCallback } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

interface PhotoComparisonProps {
  url1: string;
  url2: string;
  onClose: () => void;
}

interface ImageState {
  scale: number;
  x: number;
  y: number;
}

const defaultState: ImageState = { scale: 1, x: 0, y: 0 };

const PhotoComparison = ({ url1, url2, onClose }: PhotoComparisonProps) => {
  const { lang } = useLanguage();
  const [img1, setImg1] = useState<ImageState>({ ...defaultState });
  const [img2, setImg2] = useState<ImageState>({ ...defaultState });

  const dragRef = useRef<{ side: "left" | "right"; startX: number; startY: number; startTx: number; startTy: number } | null>(null);

  const handleWheel = useCallback((side: "left" | "right", e: React.WheelEvent) => {
    e.preventDefault();
    const setter = side === "left" ? setImg1 : setImg2;
    setter((prev) => ({
      ...prev,
      scale: Math.max(0.5, Math.min(5, prev.scale - e.deltaY * 0.002)),
    }));
  }, []);

  const handlePointerDown = useCallback((side: "left" | "right", e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const state = side === "left" ? img1 : img2;
    dragRef.current = { side, startX: e.clientX, startY: e.clientY, startTx: state.x, startTy: state.y };
  }, [img1, img2]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { side, startX, startY, startTx, startTy } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const setter = side === "left" ? setImg1 : setImg2;
    setter((prev) => ({ ...prev, x: startTx + dx, y: startTy + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const resetZoom = () => {
    setImg1({ ...defaultState });
    setImg2({ ...defaultState });
  };

  const renderImage = (url: string, state: ImageState, side: "left" | "right") => (
    <div
      className="flex-1 overflow-hidden bg-black relative touch-none select-none"
      onWheel={(e) => handleWheel(side, e)}
      onPointerDown={(e) => handlePointerDown(side, e)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{
          transform: `translate(${state.x}px, ${state.y}px) scale(${state.scale})`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 border-b border-white/10">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10 gap-1.5">
          <X className="h-4 w-4" />
          {lang === "en" ? "Close" : "Κλείσιμο"}
        </Button>
        <span className="text-xs font-sans text-white/60">
          {lang === "en" ? "Drag to pan • Scroll to zoom" : "Σύρετε • Κύλιση για ζουμ"}
        </span>
        <Button variant="ghost" size="sm" onClick={resetZoom} className="text-white hover:bg-white/10 gap-1.5">
          <RotateCcw className="h-4 w-4" />
          {lang === "en" ? "Reset" : "Επαναφορά"}
        </Button>
      </div>

      {/* Images side by side */}
      <div className="flex-1 flex">
        {renderImage(url1, img1, "left")}
        <div className="w-px bg-white/20" />
        {renderImage(url2, img2, "right")}
      </div>
    </div>
  );
};

export default PhotoComparison;
