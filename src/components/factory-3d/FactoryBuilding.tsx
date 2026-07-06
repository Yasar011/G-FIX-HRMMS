"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { ChimneySmoke } from "./ChimneySmoke";
import type { ProgressRef } from "./types";

function WindowGrid({ progressRef }: { progressRef: ProgressRef }) {
  const materials = useRef<THREE.MeshStandardMaterial[]>([]);

  const windows = useMemo(() => {
    const cols = 6;
    const rows = 3;
    const list: { x: number; y: number; flicker: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        list.push({
          x: -5.25 + c * 2.1,
          y: 1.6 + r * 1.5,
          flicker: Math.random(),
        });
      }
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    const progress = progressRef.current;
    const base = 0.35 + THREE.MathUtils.smoothstep(progress, 0.22, 0.5) * 1.1;
    const t = clock.getElapsedTime();
    materials.current.forEach((mat, i) => {
      if (!mat) return;
      const flicker = 0.85 + 0.15 * Math.sin(t * 2 + windows[i].flicker * 10);
      mat.emissiveIntensity = base * flicker * 1.4;
    });
  });

  return (
    <group>
      {windows.map((w, i) => (
        <mesh key={i} position={[w.x, w.y, 5.01]}>
          <planeGeometry args={[1.1, 0.9]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) materials.current[i] = m;
            }}
            color="#0b1220"
            emissive="#fbbf24"
            emissiveIntensity={0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function EntranceGlow({ progressRef }: { progressRef: ProgressRef }) {
  const leftRef = useRef<THREE.PointLight>(null);
  const rightRef = useRef<THREE.PointLight>(null);
  const signRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const progress = progressRef.current;
    const glow = 1 + THREE.MathUtils.smoothstep(progress, 0.4, 0.75) * 3;
    const pulse = 0.9 + 0.1 * Math.sin(clock.getElapsedTime() * 3);
    if (leftRef.current) leftRef.current.intensity = glow * pulse;
    if (rightRef.current) rightRef.current.intensity = glow * pulse;
    if (signRef.current) {
      const mat = signRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + THREE.MathUtils.smoothstep(progress, 0.3, 0.6) * 1.2;
    }
  });

  return (
    <group>
      {/* door recess */}
      <mesh position={[0, 1.4, 4.98]}>
        <boxGeometry args={[2.4, 2.8, 0.3]} />
        <meshStandardMaterial color="#04050a" roughness={0.9} />
      </mesh>

      {/* neon strips flanking the entrance */}
      <mesh position={[-1.4, 1.4, 5.15]}>
        <boxGeometry args={[0.08, 2.8, 0.08]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      <mesh position={[1.4, 1.4, 5.15]}>
        <boxGeometry args={[0.08, 2.8, 0.08]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} toneMapped={false} />
      </mesh>

      <pointLight ref={leftRef} position={[-1.4, 1.8, 6]} color="#f59e0b" intensity={1} distance={8} />
      <pointLight ref={rightRef} position={[1.4, 1.8, 6]} color="#f59e0b" intensity={1} distance={8} />

      {/* walkway glow line */}
      <mesh position={[0, 0.02, 9]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 10]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.4} toneMapped={false} transparent opacity={0.7} />
      </mesh>

      {/* sign */}
      <mesh ref={signRef} position={[0, 4.6, 5.05]}>
        <planeGeometry args={[6, 0.9]} />
        <meshStandardMaterial color="#0b1220" emissive="#22d3ee" emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 4.6, 5.2]}
        fontSize={0.42}
        color="#e0f7fa"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
      >
        YASAR INDUSTRIES
      </Text>
    </group>
  );
}

export function FactoryBuilding({ progressRef }: { progressRef: ProgressRef }) {
  return (
    <group>
      {/* main body */}
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 6, 10]} />
        <meshStandardMaterial color="#2b3040" metalness={0.35} roughness={0.6} />
      </mesh>

      {/* roof */}
      <mesh position={[0, 6.15, 0]} castShadow>
        <boxGeometry args={[12.6, 0.3, 10.6]} />
        <meshStandardMaterial color="#1c2029" metalness={0.4} roughness={0.55} />
      </mesh>

      {/* chimneys */}
      {[-4, 4].map((x) => (
        <group key={x}>
          <mesh position={[x, 7.6, -1.5]} castShadow>
            <cylinderGeometry args={[0.5, 0.6, 3, 12]} />
            <meshStandardMaterial color="#2a2d36" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[x, 9.15, -1.5]}>
            <torusGeometry args={[0.5, 0.06, 8, 16]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
          <ChimneySmoke position={[x, 9.2, -1.5]} />
        </group>
      ))}

      <WindowGrid progressRef={progressRef} />
      <EntranceGlow progressRef={progressRef} />

      {/* ground */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#181a22" roughness={1} />
      </mesh>
    </group>
  );
}
