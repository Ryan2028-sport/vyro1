import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { useLoader } from "@react-three/fiber";
import { TextureLoader, MeshStandardMaterial, Box3, Vector3 } from "three";
import type { Group } from "three";

function Band() {
  const ref = useRef<Group>(null);
  const fbx = useLoader(FBXLoader, "/models/band.fbx");
  const texture = useLoader(TextureLoader, "/models/polished-silver.jpg");
  const [normalizedScale, setNormalizedScale] = useState(1);
  const [offset, setOffset] = useState(new Vector3());

  useEffect(() => {
    fbx.traverse((child) => {
      if ("isMesh" in child && child.isMesh) {
        (child as unknown as { material: MeshStandardMaterial }).material =
          new MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.9,
            roughness: 0.15,
            envMapIntensity: 1.5,
          });
      }
    });

    // Auto-scale: measure the bounding box and normalize to fit the scene
    const box = new Box3().setFromObject(fbx);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const targetSize = 2.5;
      setNormalizedScale(targetSize / maxDim);
      setOffset(center.multiplyScalar(targetSize / maxDim));
    }
  }, [fbx, texture]);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.y += 0.008;
    ref.current.position.y = -offset.y + Math.sin(Date.now() * 0.0015) * 0.12;
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      <primitive
        object={fbx}
        scale={normalizedScale}
        position={[-offset.x, -offset.y, -offset.z]}
        rotation={[0.3, 0, 0.15]}
      />
    </group>
  );
}

function BandScene() {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 5], fov: 35 }}
      className="!h-full !w-full"
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.6} />
      <pointLight position={[0, -2, 3]} intensity={0.3} />
      <Suspense fallback={null}>
        <Band />
        <Environment preset="studio" />
      </Suspense>
    </Canvas>
  );
}

function LoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
    </div>
  );
}

export function BandSyncScreen({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="flex h-screen w-full flex-col bg-white">
      {/* Top text */}
      <div className="px-6 pt-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Sync your Vyro
        </h1>
        <p className="mt-2 text-[14px] text-gray-500">
          Connect your band to start tracking performance
        </p>
      </div>

      {/* 3D band viewer */}
      <div className="flex-1 px-4">
        <Suspense fallback={<LoadingFallback />}>
          <BandScene />
        </Suspense>
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-10">
        <button
          onClick={onContinue}
          className="h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors active:bg-gray-800"
        >
          Sync Now
        </button>
        <button
          onClick={onContinue}
          className="mt-3 w-full text-center text-[13px] text-gray-400 transition-colors hover:text-gray-600"
        >
          Set up later
        </button>
      </div>
    </div>
  );
}
