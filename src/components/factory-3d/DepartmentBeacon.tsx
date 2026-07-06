"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { Department } from "./departments";
import type { ProgressRef } from "./types";

export function DepartmentBeacon({
  department,
  progressRef,
}: {
  department: Department;
  progressRef: ProgressRef;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const panelMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const progress = progressRef.current;
    const mid = (department.start + department.end) / 2;
    const spread = (department.end - department.start) * 1.4;
    const proximity = 1 - THREE.MathUtils.clamp(Math.abs(progress - mid) / spread, 0, 1);
    const pulse = 0.85 + 0.15 * Math.sin(clock.getElapsedTime() * 2.5);
    const intensity = (0.5 + proximity * 2.5) * pulse;

    if (lightRef.current) lightRef.current.intensity = intensity;
    if (panelMatRef.current) panelMatRef.current.emissiveIntensity = 0.6 + proximity * 1.6;
    if (ringRef.current) ringRef.current.rotation.z = clock.getElapsedTime() * 0.6;
  });

  const [x, y, z] = department.propPosition;
  const facing = x >= 0 ? -1 : 1;

  return (
    <group position={[x, y, z]}>
      {/* pylon */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 3.2, 10]} />
        <meshStandardMaterial color="#20232c" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* rotating accent ring */}
      <mesh ref={ringRef} position={[0, 3.1, 0]}>
        <torusGeometry args={[0.55, 0.05, 8, 20]} />
        <meshStandardMaterial
          color={department.color}
          emissive={department.color}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>

      {/* label panel */}
      <mesh position={[facing * 0.9, 3.1, 0]} rotation={[0, facing * Math.PI * 0.15, 0]}>
        <planeGeometry args={[2.6, 0.85]} />
        <meshStandardMaterial
          ref={panelMatRef}
          color="#0b0e16"
          emissive={department.color}
          emissiveIntensity={0.6}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[facing * 0.9, 3.1, 0.05]}
        rotation={[0, facing * Math.PI * 0.15, 0]}
        fontSize={0.26}
        color="#f8fafc"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.3}
        textAlign="center"
      >
        {`${department.icon}  ${department.name}`}
      </Text>

      <pointLight ref={lightRef} position={[0, 2.2, 0]} color={department.color} intensity={1} distance={9} />

      {/* crate props for a bit of set-dressing */}
      <mesh position={[0.7, 0.4, 0.6]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color="#2a2d36" roughness={0.9} />
      </mesh>
      <mesh position={[-0.6, 0.3, -0.5]} rotation={[0, -0.4, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#23262f" roughness={0.9} />
      </mesh>
    </group>
  );
}
