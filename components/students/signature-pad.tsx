"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type SignaturePadHandle = {
  /** Returns a PNG data URL, or null if the pad is empty. */
  toDataURL: () => string | null;
  /** Wipes the canvas. */
  clear: () => void;
  /** True if the user has drawn anything since the last clear. */
  isEmpty: () => boolean;
};

type Props = {
  /** Optional className for the wrapper. */
  className?: string;
  /** Pixel height of the drawing area. Defaults to 16rem (256px). */
  heightClassName?: string;
  /** Called whenever the pad goes from empty → has-ink or vice versa. */
  onInkChange?: (hasInk: boolean) => void;
};

/**
 * Touch + mouse + pen friendly signature canvas. Uses pointer events with
 * pointer capture so a stroke isn't lost if the finger drifts off the pad.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  function SignaturePad({ className, heightClassName, onInkChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const hasInk = useRef(false);

    function getCtx(): CanvasRenderingContext2D | null {
      const c = canvasRef.current;
      if (!c) return null;
      return c.getContext("2d");
    }

    function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }

    function setStroke(ctx: CanvasRenderingContext2D) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      function resize() {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintBackground(ctx, rect.width, rect.height);
        setStroke(ctx);
        // Resizing wipes the bitmap; reflect that in the empty flag.
        hasInk.current = false;
        onInkChange?.(false);
      }

      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      return () => ro.disconnect();
    }, [onInkChange]);

    useImperativeHandle(
      ref,
      () => ({
        toDataURL: () => {
          if (!hasInk.current) return null;
          return canvasRef.current?.toDataURL("image/png") ?? null;
        },
        clear: () => {
          const ctx = getCtx();
          const canvas = canvasRef.current;
          if (!ctx || !canvas) return;
          const rect = canvas.getBoundingClientRect();
          paintBackground(ctx, rect.width, rect.height);
          setStroke(ctx);
          if (hasInk.current) {
            hasInk.current = false;
            onInkChange?.(false);
          }
        },
        isEmpty: () => !hasInk.current,
      }),
      [onInkChange],
    );

    function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      drawing.current = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Some Safari versions throw on capture for non-touch pointers; ignore.
      }
      const rect = canvas.getBoundingClientRect();
      last.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const prev = last.current ?? { x, y };
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      last.current = { x, y };
      if (!hasInk.current) {
        hasInk.current = true;
        onInkChange?.(true);
      }
    }

    function pointerUp() {
      drawing.current = false;
      last.current = null;
    }

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onPointerLeave={pointerUp}
        className={cn(
          "block w-full rounded-lg border border-[#222] bg-white touch-none cursor-crosshair select-none",
          heightClassName ?? "h-64 md:h-80",
          className,
        )}
      />
    );
  },
);
