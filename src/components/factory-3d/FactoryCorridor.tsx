"use client";

import { useMemo } from "react";
import { CORRIDOR_LENGTH } from "./departments";

const STRIP_SPACING = 6;

export function FactoryCorridor() {
  const strips = useMemo(() => {
    const count = Math.floor(CORRIDOR_LENGTH / STRIP_SPACING);
    return Array.from({ length: count }, (_, i) => -6 - i * STRIP_SPACING);
  }, []);

  return (
    <group>
      {/* floor */}
      <mesh position={[0, 0, -CORRIDOR_LENGTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, CORRIDOR_LENGTH]} />
        <meshStandardMaterial color="#14161d" metalness={0.2} roughness={0.85} />
      </mesh>

      {/* side walls */}
      {[-4.4, 4.4].map((x) => (
        <mesh key={x} position={[x, 2.6, -CORRIDOR_LENGTH / 2]}>
          <boxGeometry args={[0.3, 5.2, CORRIDOR_LENGTH]} />
          <meshStandardMaterial color="#1c1f28" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}

      {/* ceiling */}
      <mesh position={[0, 5.2, -CORRIDOR_LENGTH / 2]}>
        <boxGeometry args={[9, 0.3, CORRIDOR_LENGTH]} />
        <meshStandardMaterial color="#101218" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* overhead light strips */}
      {strips.map((z) => (
        <mesh key={z} position={[0, 5.02, z]}>
          <boxGeometry args={[3.2, 0.06, 0.5]} />
          <meshStandardMaterial color="#cfe8ff" emissive="#8fd6ff" emissiveIntensity={1.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
