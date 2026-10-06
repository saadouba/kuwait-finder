"use client";

import { Float, MeshDistortMaterial, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const skyline = [
  [-7.2, -3.5, 0.55, 1.35, 0.48], [-6.35, -3.2, 0.62, 2.0, 0.52],
  [-5.45, -3.9, 0.48, 1.05, 0.6], [-4.55, -3.3, 0.72, 2.5, 0.58],
  [-3.55, -4.4, 0.58, 1.55, 0.64], [-2.7, -3.8, 0.52, 2.15, 0.6],
  [2.85, -3.8, 0.55, 1.65, 0.58], [3.7, -3.4, 0.75, 2.55, 0.55],
  [4.7, -4.1, 0.48, 1.25, 0.62], [5.55, -3.7, 0.63, 2.05, 0.5],
  [6.5, -4.2, 0.58, 1.45, 0.62], [7.3, -3.6, 0.72, 2.3, 0.54],
] as const;

function Skyline() {
  return (
    <group position={[0, 0, -1.8]}>
      {skyline.map(([x, z, width, height, depth], index) => (
        <group key={`${x}-${index}`} position={[x, height / 2 - 0.05, z]}>
          <mesh>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? "#172448" : "#101b35"}
              emissive={index % 3 === 0 ? "#233a79" : "#111f45"}
              emissiveIntensity={0.42}
              metalness={0.52}
              roughness={0.55}
            />
          </mesh>
          {index % 2 === 0 && (
            <mesh position={[0, height / 2 + 0.15, 0]}>
              <cylinderGeometry args={[0.015, 0.035, 0.32, 6]} />
              <meshBasicMaterial color="#8b78ff" transparent opacity={0.72} />
            </mesh>
          )}
          <mesh position={[0, -height / 2 + 0.035, depth / 2 + 0.006]}>
            <planeGeometry args={[width * 0.84, 0.018]} />
            <meshBasicMaterial color="#37e5db" transparent opacity={0.62} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function KuwaitTower({ position, height, scale = 1 }: { position: [number, number, number]; height: number; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.085, 0.19, height, 16]} />
        <meshStandardMaterial color="#7184bd" metalness={0.84} roughness={0.22} emissive="#243e83" emissiveIntensity={0.62} />
      </mesh>
      <mesh position={[0, height * 0.57, 0]}>
        <sphereGeometry args={[0.3, 24, 24]} />
        <meshStandardMaterial color="#a7dfff" metalness={0.42} roughness={0.17} emissive="#238bf5" emissiveIntensity={1.7} />
      </mesh>
      <mesh position={[0, height * 0.79, 0]}>
        <sphereGeometry args={[0.48, 32, 32]} />
        <meshStandardMaterial color="#aeeaff" metalness={0.38} roughness={0.16} emissive="#19c9ff" emissiveIntensity={1.35} />
      </mesh>
      <mesh position={[0, height * 0.79, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.018, 8, 48]} />
        <meshBasicMaterial color="#b8fff6" />
      </mesh>
      <mesh position={[0, height + 0.22, 0]}>
        <cylinderGeometry args={[0.012, 0.045, 0.46, 8]} />
        <meshStandardMaterial color="#9bdcff" emissive="#39b7ff" emissiveIntensity={1.3} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.38, 0.48, 0.15, 24]} />
        <meshStandardMaterial color="#2b447f" metalness={0.6} roughness={0.32} emissive="#132c66" emissiveIntensity={0.65} />
      </mesh>
      <pointLight position={[0, height * 0.82, 0.2]} color="#36d6ff" intensity={4.1} distance={4.5} decay={2} />
    </group>
  );
}

function Sea() {
  const seaRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (seaRef.current) seaRef.current.position.y = -0.32 + Math.sin(clock.elapsedTime * 0.38) * 0.035;
  });

  return (
    <group>
      <mesh ref={seaRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]}>
        <planeGeometry args={[28, 20, 24, 20]} />
        <MeshDistortMaterial color="#0a2045" emissive="#0e477b" emissiveIntensity={1.05} metalness={0.72} roughness={0.27} distort={0.12} speed={0.2} />
      </mesh>
      {[2.4, 3.8, 5.5].map((radius, index) => (
        <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.27 + index * 0.002, 0.08]}>
          <ringGeometry args={[radius, radius + 0.012, 96]} />
          <meshBasicMaterial color={index === 0 ? "#38dddc" : "#567bff"} transparent opacity={0.1 - index * 0.02} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function SceneRig() {
  const rig = useRef<THREE.Group>(null);
  const mouse = useRef(new THREE.Vector2());

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      mouse.current.set((event.clientX / window.innerWidth) * 2 - 1, 1 - (event.clientY / window.innerHeight) * 2);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useFrame(({ camera, clock }, delta) => {
    const x = mouse.current.x;
    const y = mouse.current.y;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, x * 0.19, 1.1, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.45 + y * 0.11, 1.1, delta);
    camera.lookAt(0, 1.75, 0);
    if (rig.current) {
      rig.current.rotation.y = Math.sin(clock.elapsedTime * 0.13) * 0.018 + x * 0.013;
      rig.current.rotation.x = -y * 0.006;
    }
  });

  return (
    <group ref={rig}>
      <Stars radius={42} depth={28} count={240} factor={2.3} saturation={0.3} fade speed={0.12} />
      <Skyline />
      <KuwaitTower position={[-1.28, 0, 0.1]} height={4.0} scale={0.9} />
      <KuwaitTower position={[0, 0, 0.25]} height={5.15} scale={1.08} />
      <KuwaitTower position={[1.28, 0, 0.35]} height={3.55} scale={0.88} />
      <Sea />
      <Float speed={0.65} rotationIntensity={0.08} floatIntensity={0.16}>
        <mesh position={[3.6, 3.6, -1.2]}>
          <icosahedronGeometry args={[0.22, 0]} />
          <meshStandardMaterial color="#c8a4ff" emissive="#885aff" emissiveIntensity={2.3} metalness={0.2} roughness={0.2} />
        </mesh>
      </Float>
      <Sparkles count={54} scale={[15, 6, 8]} size={1.6} speed={0.22} opacity={0.62} color="#b4edff" noise={0.7} />
      <ambientLight intensity={0.86} color="#8aabff" />
      <hemisphereLight color="#9acfff" groundColor="#110d2b" intensity={0.8} />
      <directionalLight position={[3, 7, 5]} intensity={1.15} color="#b2e7ff" />
      <pointLight position={[-4, 2, 2]} intensity={2.1} color="#6e56ff" distance={12} />
      <pointLight position={[4, 1, 3]} intensity={1.7} color="#19e5d3" distance={10} />
    </group>
  );
}

export default function KuwaitScene() {
  return (
    <Canvas
      dpr={[1, 1.35]}
      camera={{ position: [0, 2.45, 10], fov: 38, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power", stencil: false }}
      frameloop="always"
      aria-label="Procedural night scene of the Kuwait Towers above a glowing sea"
    >
      <color attach="background" args={["#070915"]} />
      <fog attach="fog" args={["#070915", 13, 31]} />
      <SceneRig />
    </Canvas>
  );
}
