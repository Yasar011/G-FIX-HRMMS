"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { FactorySky } from "./FactorySky";
import { FactoryBuilding } from "./FactoryBuilding";
import { CameraRig } from "./CameraRig";
import type { ProgressRef } from "./types";

export function FactoryScene({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <>
      <fog attach="fog" args={["#05060a", 10, 55]} />
      <FactorySky />

      <ambientLight intensity={0.35} color="#3b3f6b" />
      <directionalLight
        position={[10, 14, 6]}
        intensity={0.8}
        color="#9fb4ff"
        castShadow
      />
      <hemisphereLight args={["#2a2f66", "#05060a", 0.4]} />

      <FactoryBuilding progressRef={progressRef} />

      <PerspectiveCamera makeDefault fov={50} position={[6, 5.5, 28]} />
      <CameraRig progressRef={progressRef} />
    </>
  );
}
