"use client";

import { PerspectiveCamera } from "@react-three/drei";
import { FactorySky } from "./FactorySky";
import { FactoryBuilding } from "./FactoryBuilding";
import { FactoryCorridor } from "./FactoryCorridor";
import { FactoryDepartments } from "./FactoryDepartments";
import { CameraRig } from "./CameraRig";
import type { ProgressRef } from "./types";

export function FactoryScene({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <>
      <fog attach="fog" args={["#221c3d", 16, 70]} />
      <FactorySky />

      <ambientLight intensity={0.65} color="#585fa8" />
      <directionalLight
        position={[10, 14, 6]}
        intensity={1.3}
        color="#c9d4ff"
        castShadow
      />
      <hemisphereLight args={["#4c53a0", "#161327", 0.7]} />
      <pointLight position={[0, 5, 16]} intensity={2.2} color="#eef2ff" distance={26} />

      <FactoryBuilding progressRef={progressRef} />
      <FactoryCorridor />
      <FactoryDepartments progressRef={progressRef} />

      <PerspectiveCamera makeDefault fov={50} position={[6, 5.5, 28]} />
      <CameraRig progressRef={progressRef} />
    </>
  );
}
