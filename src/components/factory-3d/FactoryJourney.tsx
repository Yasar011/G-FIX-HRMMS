"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FactoryScene } from "./FactoryScene";
import { LoadingOverlay } from "./LoadingOverlay";
import { AmbienceToggle } from "./AmbienceToggle";
import { DEPARTMENTS, departmentAt } from "./departments";
import {
  CreativePanel,
  DispatchPanel,
  HrPanel,
  ProductionPanel,
  QualityPanel,
  ReceptionPanel,
} from "./DepartmentPanels";
import { YBotChat } from "./YBotChat";
import type { SiteContent } from "@/lib/site-content";
import type { Project } from "@/lib/projects";
import type { Photo } from "@/lib/photography";
import type { Certificate } from "@/lib/certificates";

gsap.registerPlugin(ScrollTrigger);

const JOURNEY_HEIGHT_VH = 900;

export function FactoryJourney({
  content,
  projects,
  photos,
  certificates,
}: {
  content: SiteContent;
  projects: Project[];
  photos: Photo[];
  certificates: Certificate[];
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [deptIndex, setDeptIndex] = useState(0);

  useEffect(() => {
    if (!sectionRef.current) return;
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: (self) => {
        progressRef.current = self.progress;
        setProgress(self.progress);
        const dept = departmentAt(self.progress);
        const idx = DEPARTMENTS.indexOf(dept);
        setDeptIndex((prev) => (prev === idx ? prev : idx));
      },
    });
    return () => trigger.kill();
  }, []);

  const department = DEPARTMENTS[deptIndex];
  const isReception = department.id === "reception";
  const localProgress =
    (progress - department.start) / (department.end - department.start || 1);
  const showPanel = localProgress > 0.25;

  const jumpTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const target = DEPARTMENTS[index];
    const rect = section.getBoundingClientRect();
    const sectionTop = rect.top + window.scrollY;
    const sectionHeight = section.offsetHeight;
    window.scrollTo({
      top: sectionTop + target.start * sectionHeight + 1,
      behavior: "smooth",
    });
  };

  return (
    <section ref={sectionRef} className="relative bg-sky-100" style={{ height: `${JOURNEY_HEIGHT_VH}vh` }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <FactoryScene progressRef={progressRef} />
          </Suspense>
        </Canvas>

        {/* scrim so the title always reads, regardless of sky brightness behind it */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-60 bg-gradient-to-b from-black/40 to-transparent" />

        {/* progress rail across the top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-white/10">
          <div
            className="h-full transition-[width] duration-150"
            style={{ width: `${progress * 100}%`, background: department.color }}
          />
        </div>

        {/* department quick nav */}
        <div className="pointer-events-auto absolute left-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
          {DEPARTMENTS.map((dept, i) => {
            const active = i === deptIndex;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => jumpTo(i)}
                title={`${dept.name} — ${dept.subtitle}`}
                className={`group flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-3 backdrop-blur transition-all ${
                  active
                    ? "border-white/40 bg-black/55"
                    : "border-white/10 bg-black/30 hover:border-white/30"
                }`}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm transition"
                  style={{
                    background: active ? dept.color : "rgba(255,255,255,0.08)",
                  }}
                >
                  {dept.icon}
                </span>
                <span
                  className={`overflow-hidden whitespace-nowrap text-xs font-medium text-white transition-all ${
                    active ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0 group-hover:max-w-[140px] group-hover:opacity-80"
                  }`}
                >
                  {dept.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        {/* title / kicker */}
        <div className="pointer-events-none absolute inset-x-0 top-20 z-10 flex flex-col items-center text-center px-6">
          {isReception ? (
            <>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.45em] text-white/70">
                Portfolio of Yasar C H
              </p>
              <h1 className="font-heading text-5xl font-bold tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-7xl">
                YASAR INDUSTRIES
              </h1>
              <p
                className="mt-3 font-mono text-xs uppercase tracking-[0.4em]"
                style={{ color: department.color }}
              >
                The Digital Factory
              </p>
            </>
          ) : (
            <>
              <p
                className="font-mono text-xs uppercase tracking-[0.4em]"
                style={{ color: department.color }}
              >
                {department.icon} {department.name}
              </p>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.55)] sm:text-5xl">
                {department.subtitle}
              </h1>
            </>
          )}
        </div>

        {/* content panel */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center px-6 transition-opacity duration-700 ${
            showPanel ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pointer-events-auto">
            {department.id === "reception" && (
              <ReceptionPanel content={content} accent={department.color} />
            )}
            {department.id === "hr" && <HrPanel content={content} accent={department.color} />}
            {department.id === "production" && (
              <ProductionPanel projects={projects} accent={department.color} />
            )}
            {department.id === "innovation" && <YBotChat />}
            {department.id === "creative" && (
              <CreativePanel photos={photos} accent={department.color} />
            )}
            {department.id === "quality" && (
              <QualityPanel certificates={certificates} accent={department.color} />
            )}
            {department.id === "dispatch" && (
              <DispatchPanel content={content} accent={department.color} />
            )}
          </div>
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center transition-opacity duration-500 ${
            progress > 0.01 ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 text-white/80 backdrop-blur">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em]">Scroll to enter</span>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <AmbienceToggle />
        <LoadingOverlay />
      </div>
    </section>
  );
}
