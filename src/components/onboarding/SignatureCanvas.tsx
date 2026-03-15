import { useRef, useEffect, useCallback } from "react";

interface Props {
  onSignatureChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}

const SignatureCanvas = ({ onSignatureChange, width = 400, height = 150 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [width, height]);

  const getPosTouchNative = (e: TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY,
    };
  };

  const getPosMouse = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  // Native touch handlers (non-passive to allow preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pos = getPosTouchNative(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      isDrawingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pos = getPosTouchNative(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasDrawnRef.current = true;
    };

    const handleTouchEnd = () => {
      isDrawingRef.current = false;
      if (hasDrawnRef.current && canvas) {
        onSignatureChange(canvas.toDataURL("image/png"));
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onSignatureChange]);

  // Mouse handlers (React props are fine for desktop)
  const startDrawMouse = (e: React.MouseEvent) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPosMouse(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
  };

  const drawMouse = (e: React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPosMouse(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    hasDrawnRef.current = true;
  };

  const endDrawMouse = () => {
    isDrawingRef.current = false;
    if (hasDrawnRef.current && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    hasDrawnRef.current = false;
    onSignatureChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border-2 border-dashed border-border overflow-hidden" style={{ touchAction: "none" }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair"
          style={{ maxWidth: width, touchAction: "none" }}
          onMouseDown={startDrawMouse}
          onMouseMove={drawMouse}
          onMouseUp={endDrawMouse}
          onMouseLeave={endDrawMouse}
        />
      </div>
      <button onClick={clear} className="text-[10px] font-sans text-muted-foreground hover:text-foreground transition-colors">
        Clear signature
      </button>
    </div>
  );
};

export default SignatureCanvas;
