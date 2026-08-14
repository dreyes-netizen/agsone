"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type SyntheticEvent } from "react";

// `scale` throughout this hook is always relative to the image's *natural*
// pixel size — 1 == "100%" (one image pixel per CSS pixel). "Fit" is just
// whatever scale makes the image contain within the current viewport, which
// varies with window size, so it's tracked as `fitScale` rather than a fixed
// constant. Min zoom is fit (you can't zoom out past seeing the whole image);
// max is 4x natural size (400%), comfortably inside the 300-500% the spec
// asks for, and never below fit for a huge image opened in a small window.
const MAX_ZOOM_STEP = 1.4;
const DOUBLE_CLICK_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 24;

type Point = { x: number; y: number };
type Size = { width: number; height: number };

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Real zoom + pan for a single image inside a viewport container — wheel,
 * buttons, double-click, and touch pinch/pan/double-tap all drive the same
 * `scale`/`translate` state via one anchored-zoom formula, so every input
 * method feels consistent. No library: Pointer Events cover mouse + touch +
 * pen uniformly, and `touch-action: none` on the image (set by the consumer)
 * replaces the need for manual preventDefault on touchmove.
 */
export function useImageZoomPan(src: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // Gesture bookkeeping — refs, not state: they change every pointermove and
  // must never trigger a re-render on their own.
  const pointers = useRef<Map<number, Point>>(new Map());
  const dragStart = useRef<{ pointer: Point; translate: Point } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number; local: Point } | null>(null);
  const lastTap = useRef<{ time: number; point: Point } | null>(null);
  // Tracked independently of `dragStart` (which only starts when the image
  // is already zoomed in / pannable): a double-tap-to-zoom-in must still be
  // detected while the image is at "fit" and there's nothing to pan.
  const tapStart = useRef<{ pointer: Point; time: number; pointerType: string } | null>(null);
  // Whether the user has manually zoomed away from "fit" for the current
  // image — tracked explicitly by the actions that zoom (zoomKeepingPoint,
  // pinch) and reset by fit()/a new image, rather than derived from
  // scale===fitScale: deriving it from `isFit` is a trap, since `isFit` is
  // (correctly) false before the image has even loaded, which clobbered this
  // flag to false pre-load and made every image open at whatever `scale`
  // happened to still be instead of fit.
  const userZoomed = useRef(false);

  const fitScale = containerSize && natural
    ? Math.min(containerSize.width / natural.width, containerSize.height / natural.height)
    : 1;
  const minScale = fitScale;
  const maxScale = Math.max(fitScale, 4);

  // Reset transform state for a new image — actual scale/translate are set
  // once its natural size is known (onImageLoad), so start "unfit" briefly
  // rather than flashing at the previous image's zoom level. Adjusted during
  // render (React's documented pattern for resetting state when a prop
  // changes) rather than in an effect, to avoid the extra cascading render.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setNatural(null);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }
  // Ref mutations aren't allowed during render (only the state resets above
  // are — React's blessed "adjust state when a prop changes" exception).
  // natural is reset to null in the same render, so the "fit once known"
  // effect below bails out until the new image loads, by which point this
  // has already committed.
  useEffect(() => { userZoomed.current = false; }, [src]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setContainerSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // `zoomKeepingPoint` is attached to a native wheel listener that's only
  // re-attached when its identity changes (see the wheel effect below), so
  // it must read live scale/translate through refs rather than closing over
  // the state variables directly — otherwise wheel-zooming after a pan would
  // jump back to a stale translate.
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  const translateRef = useRef(translate);
  useEffect(() => { translateRef.current = translate; }, [translate]);

  const clampTranslate = useCallback((p: Point, atScale: number): Point => {
    if (!natural || !containerSize) return { x: 0, y: 0 };
    const scaledW = natural.width * atScale;
    const scaledH = natural.height * atScale;
    const maxX = Math.max(0, (scaledW - containerSize.width) / 2);
    const maxY = Math.max(0, (scaledH - containerSize.height) / 2);
    return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) };
  }, [natural, containerSize]);

  // Zoom to `nextScale` while keeping the image point currently under
  // `screenPoint` (viewport coordinates) visually fixed — used by wheel,
  // buttons (anchored at container center), and double-click/tap.
  const zoomKeepingPoint = useCallback((nextScale: number, screenPoint: Point) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const clamped = clamp(nextScale, minScale, maxScale);
    const prevScale = scaleRef.current;
    const prevTranslate = translateRef.current;
    const local = {
      x: (screenPoint.x - center.x - prevTranslate.x) / prevScale,
      y: (screenPoint.y - center.y - prevTranslate.y) / prevScale,
    };
    const nextTranslate = {
      x: prevTranslate.x + (prevScale - clamped) * local.x,
      y: prevTranslate.y + (prevScale - clamped) * local.y,
    };
    setScale(clamped);
    setTranslate(clampTranslate(nextTranslate, clamped));
    userZoomed.current = true;
  }, [minScale, maxScale, clampTranslate]);

  const containerCenterPoint = useCallback((): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
  }, []);

  const zoomIn = useCallback(() => zoomKeepingPoint(scale * MAX_ZOOM_STEP, containerCenterPoint()), [scale, zoomKeepingPoint, containerCenterPoint]);
  const zoomOut = useCallback(() => zoomKeepingPoint(scale / MAX_ZOOM_STEP, containerCenterPoint()), [scale, zoomKeepingPoint, containerCenterPoint]);
  const zoomTo100 = useCallback(() => zoomKeepingPoint(1, containerCenterPoint()), [zoomKeepingPoint, containerCenterPoint]);
  const fit = useCallback(() => {
    userZoomed.current = false;
    setScale(fitScale);
    setTranslate({ x: 0, y: 0 });
  }, [fitScale]);

  const onImageLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNatural({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  // Fit once natural size + container size are both known, and re-fit on
  // window resize as long as the user hasn't manually zoomed since.
  useEffect(() => {
    if (!natural || !containerSize) return;
    const nextFit = Math.min(containerSize.width / natural.width, containerSize.height / natural.height);
    if (!userZoomed.current) {
      setScale(nextFit);
      setTranslate({ x: 0, y: 0 });
      return;
    }
    const clamped = clamp(scaleRef.current, nextFit, Math.max(nextFit, 4));
    setScale(clamped);
    setTranslate(clampTranslate(translateRef.current, clamped));
  }, [natural, containerSize, clampTranslate]);

  const isFit = natural !== null && Math.abs(scale - fitScale) < 0.005;

  // Non-passive wheel listener — React's onWheel can't reliably preventDefault
  // (some browsers attach the root listener as passive), so attach directly.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0018);
      zoomKeepingPoint(scaleRef.current * factor, { x: e.clientX, y: e.clientY });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomKeepingPoint]);

  const canPan = natural !== null && scale > fitScale + 0.005;

  function pointerToPoint(e: ReactPointerEvent): Point {
    return { x: e.clientX, y: e.clientY };
  }

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLImageElement>) => {
    if (!natural) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, pointerToPoint(e));

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const rect = containerRef.current?.getBoundingClientRect();
      const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
      const mid = midpoint(a, b);
      pinchStart.current = {
        dist: distance(a, b),
        scale,
        local: { x: (mid.x - center.x - translate.x) / scale, y: (mid.y - center.y - translate.y) / scale },
      };
      dragStart.current = null;
      tapStart.current = null;
    } else if (pointers.current.size === 1) {
      tapStart.current = { pointer: pointerToPoint(e), time: Date.now(), pointerType: e.pointerType };
      if (canPan) {
        dragStart.current = { pointer: pointerToPoint(e), translate };
        setIsPanning(true);
      }
    }
  }, [natural, scale, translate, canPan]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLImageElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, pointerToPoint(e));

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const rect = containerRef.current?.getBoundingClientRect();
      const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
      const dist = distance(a, b);
      const nextScale = clamp(pinchStart.current.scale * (dist / pinchStart.current.dist), minScale, maxScale);
      const mid = midpoint(a, b);
      const nextTranslate = {
        x: mid.x - center.x - nextScale * pinchStart.current.local.x,
        y: mid.y - center.y - nextScale * pinchStart.current.local.y,
      };
      setScale(nextScale);
      setTranslate(clampTranslate(nextTranslate, nextScale));
      userZoomed.current = true;
    } else if (pointers.current.size === 1 && dragStart.current) {
      const p = pointerToPoint(e);
      const next = {
        x: dragStart.current.translate.x + (p.x - dragStart.current.pointer.x),
        y: dragStart.current.translate.y + (p.y - dragStart.current.pointer.y),
      };
      setTranslate(clampTranslate(next, scale));
    }
  }, [scale, minScale, maxScale, clampTranslate]);

  const endPointer = useCallback((e: ReactPointerEvent<HTMLImageElement>) => {
    const point = pointerToPoint(e);
    const tap = tapStart.current;
    const wasTap = e.pointerType === "touch" && tap !== null && tap.pointerType === "touch"
      && pointers.current.size === 1 && distance(point, tap.pointer) < DOUBLE_TAP_DIST;

    if (wasTap) {
      const now = Date.now();
      if (lastTap.current && now - lastTap.current.time < DOUBLE_TAP_MS && distance(point, lastTap.current.point) < DOUBLE_TAP_DIST) {
        if (isFit) zoomKeepingPoint(DOUBLE_CLICK_SCALE, point); else fit();
        lastTap.current = null;
      } else {
        lastTap.current = { time: now, point };
      }
    }

    pointers.current.delete(e.pointerId);
    tapStart.current = null;
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) {
      dragStart.current = null;
      setIsPanning(false);
    }
  }, [isFit, zoomKeepingPoint, fit]);

  const onDoubleClick = useCallback((e: ReactMouseEvent<HTMLImageElement>) => {
    const point = { x: e.clientX, y: e.clientY };
    if (isFit) zoomKeepingPoint(DOUBLE_CLICK_SCALE, point); else fit();
  }, [isFit, zoomKeepingPoint, fit]);

  return {
    containerRef,
    imageRef,
    scale,
    zoomPercent: Math.round(scale * 100),
    isFit,
    canZoomIn: scale < maxScale - 0.005,
    canZoomOut: scale > minScale + 0.005,
    canPan,
    isPanning,
    transformStyle: { transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` },
    zoomIn,
    zoomOut,
    zoomTo100,
    fit,
    onImageLoad,
    imageHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onDoubleClick,
    },
  };
}
