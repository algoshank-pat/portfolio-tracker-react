// Click-to-zoom image: opens a full-screen viewer with zoom buttons, wheel/pinch zoom and drag to pan.

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button, Icon } from "./ui";
import s from "./ZoomableImage.module.css";

const MIN = 1;
const MAX = 4;

export function ZoomableImage({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  return (
    <>
      <button ref={opener} type="button" className={s.thumb} onClick={() => setOpen(true)} aria-label={`Open larger view: ${alt}`}>
        <img src={src} alt={alt} width={width} height={height} className={s.thumbImg} loading="lazy" />
        <span className={s.thumbHint} aria-hidden="true">
          <Icon name="zoom" className={s.hintIcon} /> Click to zoom
        </span>
      </button>
      {open && createPortal(<Viewer src={src} alt={alt} onClose={close} />, document.body)}
    </>
  );
}

function Viewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1.6);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));
  const zoom = (f: number) => setScale((z) => clamp(+(z * f).toFixed(3)));
  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoom(1.25);
      else if (e.key === "-") zoom(0.8);
      else if (e.key === "0") reset();
      else if (e.key.startsWith("Arrow")) {
        const d = 40;
        setPos((p) => ({
          x: p.x + (e.key === "ArrowLeft" ? d : e.key === "ArrowRight" ? -d : 0),
          y: p.y + (e.key === "ArrowUp" ? d : e.key === "ArrowDown" ? -d : 0),
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale };
    }
  };

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, next);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setScale(clamp(pinch.current.scale * (dist / pinch.current.dist)));
    } else if (pointers.current.size === 1) {
      setPos((p) => ({ x: p.x + next.x - prev.x, y: p.y + next.y - prev.y }));
    }
  };

  const up = (e: RPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={alt} ref={dialog} tabIndex={-1}>
      <div className={s.toolbar}>
        <span className={s.toolbarTitle}>{alt}</span>
        <div className={s.tools}>
          <Button variant="secondary" size="small" onClick={() => zoom(0.8)} aria-label="Zoom out">
            <Icon name="minus" style={{ width: 16, height: 16 }} />
          </Button>
          <span className={s.zoomLevel} aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="secondary" size="small" onClick={() => zoom(1.25)} aria-label="Zoom in">
            <Icon name="plus" style={{ width: 16, height: 16 }} />
          </Button>
          <Button variant="secondary" size="small" onClick={reset}>
            Fit
          </Button>
          <Button size="small" onClick={onClose} aria-label="Close">
            <Icon name="close" style={{ width: 16, height: 16 }} />
          </Button>
        </div>
      </div>
      <div
        className={s.stage}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.1 : 0.9)}
        onDoubleClick={() => (scale > 1.05 ? reset() : setScale(2))}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className={s.full}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
        />
      </div>
      <p className={s.help}>Drag to pan · scroll or pinch to zoom · double-click to toggle · Esc to close</p>
    </div>
  );
}
