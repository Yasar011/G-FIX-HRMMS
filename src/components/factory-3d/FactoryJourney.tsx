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
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-56 bg-gradient-to-b from-black/45 to-transparent" />

        {/* department quick nav */}
        <div className="pointer-events-auto absolute left-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
          {DEPARTMENTS.map((dept, i) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => jumpTo(i)}
              title={`${dept.name} — ${dept.subtitle}`}
              className={`flex h-9 w-9 items-center justify-center rounded-full border text-base transition ${
                i === deptIndex
                  ? "border-amber-300 bg-amber-300/20"
                  : "border-white/15 bg-black/40 hover:border-white/40"
              }`}
            >
              {dept.icon}
            </button>
          ))}
        </div>

        {/* title / kicker */}
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 flex flex-col items-center text-center px-6">
          {isReception ? (
            <>
              <h1 className="text-4xl font-semibold tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] sm:text-6xl">
                YASAR INDUSTRIES
              </h1>
              <p className="mt-3 text-sm uppercase tracking-[0.4em] text-amber-200/80">
                The Digital Factory
              </p>
            </>
          ) : (
            <>
              <p className="text-sm uppercase tracking-[0.4em]" style={{ color: department.color }}>
                {department.icon} {department.name}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)] sm:text-5xl">
                {department.subtitle}
              </h1>
            </>
          )}
        </div>

        {/* content panel */}
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-10 z-10 flex justify-center px-6 transition-opacity duration-700 ${
            showPanel ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pointer-events-auto">
            {department.id === "reception" && <ReceptionPanel content={content} />}
            {department.id === "hr" && <HrPanel content={content} />}
            {department.id === "production" && <ProductionPanel projects={projects} />}
            {department.id === "innovation" && <YBotChat />}
            {department.id === "creative" && <CreativePanel photos={photos} />}
            {department.id === "quality" && <QualityPanel certificates={certificates} />}
            {department.id === "dispatch" && <DispatchPanel content={content} />}
          </div>
        </div>

        <div
          className={`pointer-events-none absolute inset-x-0 bottom-8 z-10 flex justify-center transition-opacity duration-500 ${
            progress > 0.01 ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="flex flex-col items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-white/80 backdrop-blur">
            <span className="text-xs uppercase tracking-[0.3em]">Scroll to enter</span>
          </div>
        </div>

        <AmbienceToggle />
        <LoadingOverlay />
      </div>
    </section>
  );
}
