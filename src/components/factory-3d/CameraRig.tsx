"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ProgressRef } from "./types";

const positionCurve = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(6, 5.5, 28),
    new THREE.Vector3(3, 4.2, 16),
    new THREE.Vector3(0, 2.6, 8.5),
    new THREE.Vector3(0, 1.7, 3.4),
    new THREE.Vector3(0, 1.6, -6),
  ],
  false,
  "catmullrom",
  0.5
);

const lookAtCurve = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(0, 3, 0),
    new THREE.Vector3(0, 2.8, 0),
    new THREE.Vector3(0, 2, 0),
    new THREE.Vector3(0, 1.6, -4),
    new THREE.Vector3(0, 1.6, -20),
  ],
  false,
  "catmullrom",
  0.5
);

export function CameraRig({ progressRef }: { progressRef: ProgressRef }) {
  const { camera } = useThree();
  const currentLookAt = useMemo(() => new THREE.Vector3(0, 3, 0), []);

  useFrame(({ clock }) => {
    const t = THREE.MathUtils.clamp(progressRef.current, 0, 1);
    const pos = positionCurve.getPoint(t);
    const look = lookAtCurve.getPoint(t);

    const bobY = Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
    camera.position.lerp(new THREE.Vector3(pos.x, pos.y + bobY, pos.z), 0.12);
    currentLookAt.lerp(look, 0.12);
    camera.lookAt(currentLookAt);
  });

  return null;
}
