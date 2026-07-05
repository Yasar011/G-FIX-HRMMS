"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PUFF_COUNT = 14;
const dummy = new THREE.Object3D();

export function ChimneySmoke({
  position,
  riseHeight = 6,
  spread = 0.6,
}: {
  position: [number, number, number];
  riseHeight?: number;
  spread?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const seeds = useMemo(
    () =>
      Array.from({ length: PUFF_COUNT }, (_, i) => ({
        offset: (i / PUFF_COUNT) * riseHeight,
        speed: 0.35 + Math.random() * 0.25,
        wobble: Math.random() * Math.PI * 2,
        scale: 0.35 + Math.random() * 0.45,
      })),
    [riseHeight]
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = clock.getElapsedTime();

    seeds.forEach((seed, i) => {
      const life = ((t * seed.speed + seed.offset) % riseHeight) / riseHeight;
      const y = life * riseHeight;
      const wobbleX = Math.sin(t * 0.6 + seed.wobble) * spread * life;
      const wobbleZ = Math.cos(t * 0.5 + seed.wobble) * spread * life;
      const scale = seed.scale * (0.6 + life * 1.4);
      const opacity = 1 - life;

      dummy.position.set(wobbleX, y, wobbleZ);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(0.6, 0.6, 0.65).multiplyScalar(0.5 + opacity * 0.5));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, PUFF_COUNT]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial
          color="#9ca3af"
          transparent
          opacity={0.35}
          depthWrite={false}
          roughness={1}
        />
      </instancedMesh>
    </group>
  );
}
