"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades + lifts children in once they scroll into view. No-ops (renders visible immediately)
 * under prefers-reduced-motion via the transition-duration override in globals.css. */
export function Reveal({ children, delayMs = 0 }: { children: ReactNode; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal${visible ? " reveal--visible" : ""}`} style={{ transitionDelay: `${delayMs}ms` }}>
      {children}
    </div>
  );
}
