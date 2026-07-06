"use client";

import { useMemo } from "react";
import * as THREE from "three";

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 bottomColor;
  void main() {
    float h = normalize(vWorldPosition).y;
    vec3 sky = mix(midColor, topColor, clamp(pow(max(h, 0.0), 0.5), 0.0, 1.0));
    sky = mix(bottomColor, sky, smoothstep(-0.05, 0.15, h));
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export function FactorySky() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color("#4fa8ff") },
      midColor: { value: new THREE.Color("#bfe0ff") },
      bottomColor: { value: new THREE.Color("#eef6ff") },
    }),
    []
  );

  return (
    <mesh scale={[1, 1, 1]}>
      <sphereGeometry args={[500, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        depthWrite={false}
      />
    </mesh>
  );
}
