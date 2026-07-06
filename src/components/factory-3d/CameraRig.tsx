"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ProgressRef } from "./types";
import { DEPARTMENTS } from "./departments";

type Keyframe = {
  t: number;
  position: [number, number, number];
  lookAt: [number, number, number];
};

const last = DEPARTMENTS[DEPARTMENTS.length - 1];

const KEYFRAMES: Keyframe[] = [
  { t: 0, position: [6, 5.5, 28], lookAt: [0, 3, 0] },
  { t: 0.04, position: [3, 4.2, 16], lookAt: [0, 2.8, 0] },
  { t: 0.09, position: [0, 2.6, 8.5], lookAt: [0, 2, 0] },
  { t: 0.14, position: [0, 1.7, 3.4], lookAt: [0, 1.6, -4] },
  ...DEPARTMENTS.slice(1).map((dept) => ({
    t: dept.start,
    position: dept.cameraPosition,
    lookAt: dept.lookAt,
  })),
  {
    t: 1,
    position: [last.cameraPosition[0], last.cameraPosition[1], last.cameraPosition[2] - 4],
    lookAt: last.lookAt,
  },
];

const positionCurve = new THREE.CatmullRomCurve3(
  KEYFRAMES.map((k) => new THREE.Vector3(...k.position)),
  false,
  "catmullrom",
  0.5
);

const lookAtCurve = new THREE.CatmullRomCurve3(
  KEYFRAMES.map((k) => new THREE.Vector3(...k.lookAt)),
  false,
  "catmullrom",
  0.5
);

// CatmullRomCurve3.getPoint expects a parameter uniformly spaced across control
// points, but our keyframes are tagged with arbitrary scroll-progress fractions
// (denser near the entrance, one per department after that). This remaps a
// progress value to the uniform curve parameter so timing matches the tags.
function progressToCurveU(progress: number): number {
  const n = KEYFRAMES.length;
  for (let i = 0; i < n - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (progress <= b.t || i === n - 2) {
      const span = b.t - a.t || 1;
      const local = THREE.MathUtils.clamp((progress - a.t) / span, 0, 1);
      return (i + local) / (n - 1);
    }
  }
  return 1;
}

export function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree();
  const currentLookAt = useMemo(() => new THREE.Vector3(0, 3, 0), []);

  useFrame(({ clock }) => {
    const progress = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    const u = progressToCurveU(progress);
    const pos = positionCurve.getPoint(u);
    const look = lookAtCurve.getPoint(u);

    const bobY = Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
    camera.position.lerp(new THREE.Vector3(pos.x, pos.y + bobY, pos.z), 0.12);
    currentLookAt.lerp(look, 0.12);
    camera.lookAt(currentLookAt);
  });

  return null;
}
