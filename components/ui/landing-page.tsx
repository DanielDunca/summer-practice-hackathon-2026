"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Globe from "@/components/ui/globe";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

interface ScrollGlobeSection {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  description: string;
  align?: "left" | "center" | "right";
  features?: { icon: string; title: string; description: string }[];
  actions?: { label: string; variant: "primary" | "secondary"; href?: string }[];
}

interface ScrollGlobeProps {
  sections: ScrollGlobeSection[];
  globeConfig?: { positions: { top: string; left: string; scale: number }[] };
  className?: string;
}

const defaultGlobeConfig = {
  positions: [
    { top: "50%", left: "72%", scale: 1.4 },
    { top: "30%", left: "55%", scale: 0.9 },
    { top: "50%", left: "78%", scale: 1.6 },
    { top: "50%", left: "50%", scale: 1.8 },
  ],
};

const parsePercent = (str: string) => parseFloat(str.replace("%", ""));

export function ScrollGlobe({ sections, globeConfig = defaultGlobeConfig, className }: ScrollGlobeProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [globeTransform, setGlobeTransform] = useState("");
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationFrameId = useRef<number>(0);

  const calculatedPositions = useMemo(
    () => globeConfig.positions.map((p) => ({ top: parsePercent(p.top), left: parsePercent(p.left), scale: p.scale })),
    [globeConfig.positions]
  );

  const updateScrollPosition = useCallback(() => {
    const scrollTop = window.pageYOffset;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    setScrollProgress(Math.min(Math.max(scrollTop / docHeight, 0), 1));

    const viewportCenter = window.innerHeight / 2;
    let newActive = 0;
    let minDist = Infinity;
    sectionRefs.current.forEach((ref, i) => {
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      const dist = Math.abs(rect.top + rect.height / 2 - viewportCenter);
      if (dist < minDist) { minDist = dist; newActive = i; }
    });

    const pos = calculatedPositions[newActive];
    setGlobeTransform(
      `translate3d(${pos.left}vw,${pos.top}vh,0) translate3d(-50%,-50%,0) scale3d(${pos.scale},${pos.scale},1)`
    );
    setActiveSection(newActive);
  }, [calculatedPositions]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        animationFrameId.current = requestAnimationFrame(() => { updateScrollPosition(); ticking = false; });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    updateScrollPosition();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [updateScrollPosition]);

  useEffect(() => {
    const pos = calculatedPositions[0];
    setGlobeTransform(`translate3d(${pos.left}vw,${pos.top}vh,0) translate3d(-50%,-50%,0) scale3d(${pos.scale},${pos.scale},1)`);
  }, [calculatedPositions]);

  return (
    <div className={cn("relative w-full max-w-screen overflow-x-hidden min-h-screen bg-white text-zinc-900", className)}>
      {/* Scroll progress bar */}
      <div className="fixed top-0 left-0 w-full h-0.5 bg-zinc-100 z-50">
        <div
          className="h-full bg-zinc-900 will-change-transform"
          style={{ transform: `scaleX(${scrollProgress})`, transformOrigin: "left center", transition: "transform 0.15s ease-out" }}
        />
      </div>

      {/* Nav dots */}
      <div className="hidden sm:flex fixed right-6 lg:right-10 top-1/2 -translate-y-1/2 z-40 flex-col gap-4">
        {sections.map((section, i) => (
          <div key={i} className="relative group flex items-center justify-end gap-2">
            <span
              className={cn(
                "text-xs font-medium text-zinc-500 whitespace-nowrap transition-all duration-300",
                activeSection === i ? "opacity-100 animate-fadeOut" : "opacity-0"
              )}
            >
              {section.badge}
            </span>
            <button
              onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })}
              aria-label={section.badge}
              className={cn(
                "w-2 h-2 rounded-full border-2 transition-all duration-300 hover:scale-125",
                activeSection === i
                  ? "bg-zinc-900 border-zinc-900"
                  : "bg-transparent border-zinc-300 hover:border-zinc-600"
              )}
            />
          </div>
        ))}
      </div>

      {/* Globe */}
      <div
        className="fixed z-10 pointer-events-none will-change-transform transition-all duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ transform: globeTransform, opacity: activeSection === 3 ? 0.35 : 0.9 }}
      >
        <div className="scale-75 sm:scale-90 lg:scale-100">
          <Globe />
        </div>
      </div>

      {/* Sections */}
      {sections.map((section, i) => (
        <section
          key={section.id}
          ref={(el) => { sectionRefs.current[i] = el as HTMLDivElement | null; }}
          className={cn(
            "relative min-h-screen flex flex-col justify-center px-6 sm:px-10 md:px-16 lg:px-20 z-20 py-16",
            section.align === "center" && "items-center text-center",
            section.align === "right" && "items-end text-right",
            (!section.align || section.align === "left") && "items-start text-left"
          )}
        >
          <div className="w-full max-w-lg xl:max-w-2xl">
            {section.badge && (
              <span className="inline-block text-xs font-semibold tracking-widest uppercase text-zinc-400 mb-4">
                {section.badge}
              </span>
            )}

            <h1 className={cn("font-extrabold leading-[1.08] tracking-tight mb-5", i === 0 ? "text-5xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-5xl lg:text-6xl")}>
              {section.subtitle ? (
                <>
                  <span className="text-zinc-900">{section.title}</span>
                  <br />
                  <span className="text-zinc-400">{section.subtitle}</span>
                </>
              ) : (
                <span className="text-zinc-900">{section.title}</span>
              )}
            </h1>

            <p className="text-zinc-500 text-lg sm:text-xl leading-relaxed mb-8 font-light">
              {section.description}
            </p>

            {section.features && (
              <div className="flex flex-col gap-3 mb-8">
                {section.features.map((f) => (
                  <div key={f.title} className="flex items-start gap-4 p-4 rounded-xl border border-zinc-100 bg-white/80 backdrop-blur-sm hover:border-zinc-200 hover:-translate-y-0.5 transition-all duration-200">
                    <span className="text-2xl shrink-0">{f.icon}</span>
                    <div>
                      <p className="font-semibold text-zinc-900 text-sm">{f.title}</p>
                      <p className="text-zinc-500 text-sm leading-relaxed">{f.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {section.actions && (
              <div className={cn("flex flex-col sm:flex-row gap-3", section.align === "center" && "justify-center")}>
                {section.actions.map((a) =>
                  a.href ? (
                    <Link
                      key={a.label}
                      href={a.href}
                      className={cn(
                        "px-7 py-3 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-center",
                        a.variant === "primary"
                          ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/10"
                          : "border-2 border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      {a.label}
                    </Link>
                  ) : (
                    <button
                      key={a.label}
                      className={cn(
                        "px-7 py-3 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                        a.variant === "primary"
                          ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg shadow-zinc-900/10"
                          : "border-2 border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      {a.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
