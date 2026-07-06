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
      <fog attach="fog" args={["#dbe9f7", 26, 85]} />
      <FactorySky />

      <ambientLight intensity={1.1} color="#ffffff" />
      <directionalLight
        position={[10, 18, 8]}
        intensity={2}
        color="#fff7e6"
        castShadow
      />
      <hemisphereLight args={["#ffffff", "#cbd9e8", 0.9]} />
      <pointLight position={[0, 5, 16]} intensity={1.6} color="#ffffff" distance={26} />

      <FactoryBuilding progressRef={progressRef} />
      <FactoryCorridor />
      <FactoryDepartments progressRef={progressRef} />

      <PerspectiveCamera makeDefault fov={50} position={[6, 5.5, 28]} />
      <CameraRig progressRef={progressRef} />
    </>
  );
}
