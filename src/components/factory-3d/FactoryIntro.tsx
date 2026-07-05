"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FactoryScene } from "./FactoryScene";
import { LoadingOverlay } from "./LoadingOverlay";
import { AmbienceToggle } from "./AmbienceToggle";

gsap.registerPlugin(ScrollTrigger);

const CAPTIONS = [
  { at: 0, title: "YASAR INDUSTRIES", subtitle: "The Digital Factory" },
  { at: 0.35, title: "Engineering the Future", subtitle: "of Smart Apparel" },
  { at: 0.7, title: "Step Inside", subtitle: "Scroll to enter" },
];

export function FactoryIntro() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: (self) => {
        progressRef.current = self.progress;
        setScrolled(self.progress > 0.01);
        let idx = 0;
        for (let i = 0; i < CAPTIONS.length; i++) {
          if (self.progress >= CAPTIONS[i].at) idx = i;
        }
        setCaptionIndex((prev) => (prev === idx ? prev : idx));
      },
    });
    return () => trigger.kill();
  }, []);

  const caption = CAPTIONS[captionIndex];

  return (
    <section ref={sectionRef} className="relative h-[400vh] bg-black">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <FactoryScene progressRef={progressRef} />
          </Suspense>
        </Canvas>

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-24 text-center px-6">
          <h1 className="text-4xl font-semibold tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] sm:text-6xl">
            {caption.title}
          </h1>
          <p className="mt-3 text-sm uppercase tracking-[0.4em] text-amber-200/80">
            {caption.subtitle}
          </p>
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center transition-opacity duration-500 ${
            scrolled ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center gap-2 text-white/60">
            <span className="text-xs uppercase tracking-[0.3em]">Scroll to enter</span>
            <div className="h-8 w-px animate-pulse bg-white/40" />
          </div>
        </div>

        <AmbienceToggle />
        <LoadingOverlay />
      </div>
    </section>
  );
}
