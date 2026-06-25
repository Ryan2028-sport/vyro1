import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { useLoader } from "@react-three/fiber";
import { TextureLoader, MeshStandardMaterial, Box3, Vector3 } from "three";
import type { Group } from "three";
import { useBluetooth } from "@/hooks/use-bluetooth";
import { useServerFn } from "@tanstack/react-start";
import { updateMyProfile } from "@/lib/profile.functions";
import { Loader2, Bluetooth, Check, AlertCircle } from "lucide-react";

type SyncState = "idle" | "scanning" | "found" | "connecting" | "connected" | "error";

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

function DeviceCard({
  name,
  id,
  isConnecting,
  isConnected,
  onConnect,
}: {
  name: string;
  id: string;
  isConnecting: boolean;
  isConnected: boolean;
  onConnect: () => void;
}) {
  return (
    <button
      onClick={onConnect}
      disabled={isConnecting || isConnected}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
        isConnected
          ? "border-emerald-200 bg-emerald-50"
          : isConnecting
            ? "border-gray-200 bg-gray-50 opacity-70"
            : "border-gray-200 bg-white active:scale-[0.98] hover:border-gray-300"
      }`}
    >
      <div
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          isConnected ? "bg-emerald-100" : "bg-gray-100"
        }`}
      >
        {isConnected ? (
          <Check className="h-5 w-5 text-emerald-600" />
        ) : isConnecting ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        ) : (
          <Bluetooth className="h-5 w-5 text-gray-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900">{name}</div>
        <div className="truncate font-mono text-[10px] text-gray-400">{id.slice(0, 20)}</div>
      </div>
      {isConnected && (
        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          Paired
        </span>
      )}
    </button>
  );
}

export function BandSyncScreen({
  onContinue,
}: {
  onContinue: () => void;
}) {
  const ble = useBluetooth();
  const saveProfile = useServerFn(updateMyProfile);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [connectedDevice, setConnectedDevice] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (ble.devices.length > 0 && syncState === "scanning") {
      setSyncState("found");
    }
  }, [ble.devices.length, syncState]);

  useEffect(() => {
    if (ble.connectionState === "connected" && ble.connectedId) {
      setSyncState("connected");
      const device = ble.devices.find((d) => d.id === ble.connectedId);
      setConnectedDevice({
        id: ble.connectedId,
        name: device?.name || "VYRO Band",
      });
    } else if (ble.connectionState === "failed") {
      setSyncState("error");
    }
  }, [ble.connectionState, ble.connectedId, ble.devices]);

  async function handleSyncNow() {
    setSyncState("scanning");
    await ble.scan([], 15000);
  }

  async function handleConnect(deviceId: string) {
    setSyncState("connecting");
    await ble.connect(deviceId);
  }

  async function handleFinish() {
    if (connectedDevice) {
      try {
        await saveProfile({
          data: {
            paired_band_id: connectedDevice.id,
            paired_band_name: connectedDevice.name,
          },
        });
      } catch {
        // Profile save failed — band is still connected locally, continue anyway
      }
    }
    onContinue();
  }

  const showDeviceList = syncState === "found" || syncState === "connecting" || syncState === "connected";

  return (
    <div className="flex h-screen w-full flex-col bg-white">
      {/* Top text */}
      <div className="px-6 pt-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {syncState === "connected" ? "Band Connected" : "Sync your Vyro"}
        </h1>
        <p className="mt-2 text-[14px] text-gray-500">
          {syncState === "idle" && "Connect your band to start tracking performance"}
          {syncState === "scanning" && "Searching for nearby devices..."}
          {syncState === "found" && "Select your band to connect"}
          {syncState === "connecting" && "Connecting to your band..."}
          {syncState === "connected" && "Your band is paired and ready to go"}
          {syncState === "error" && (ble.error || "Connection failed. Try again.")}
        </p>
      </div>

      {/* Main content area */}
      <div className="flex-1 px-4">
        {!showDeviceList ? (
          <Suspense fallback={<LoadingFallback />}>
            <BandScene />
          </Suspense>
        ) : (
          <div className="mx-auto mt-6 max-w-sm space-y-3">
            {ble.devices.map((device) => (
              <DeviceCard
                key={device.id}
                name={device.name || "Unknown Device"}
                id={device.id}
                isConnecting={syncState === "connecting" && !connectedDevice}
                isConnected={connectedDevice?.id === device.id}
                onConnect={() => handleConnect(device.id)}
              />
            ))}
            {ble.scanning && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Still scanning...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {syncState === "error" && ble.error && (
        <div className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-600">{ble.error}</p>
        </div>
      )}

      {/* Bottom CTAs */}
      <div className="px-6 pb-10">
        {syncState === "idle" && (
          <button
            onClick={handleSyncNow}
            className="h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors active:bg-gray-800"
          >
            Sync Now
          </button>
        )}

        {syncState === "scanning" && (
          <button
            disabled
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 text-[15px] font-semibold text-white opacity-80"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Scanning...
          </button>
        )}

        {syncState === "found" && (
          <button
            onClick={handleSyncNow}
            className="h-[52px] w-full rounded-2xl border border-gray-200 bg-white text-[15px] font-semibold text-gray-900 transition-colors active:bg-gray-50"
          >
            Scan Again
          </button>
        )}

        {syncState === "connecting" && (
          <button
            disabled
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 text-[15px] font-semibold text-white opacity-80"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </button>
        )}

        {syncState === "connected" && (
          <button
            onClick={handleFinish}
            className="h-[52px] w-full rounded-2xl bg-emerald-600 text-[15px] font-semibold text-white transition-colors active:bg-emerald-700"
          >
            Continue
          </button>
        )}

        {syncState === "error" && (
          <button
            onClick={handleSyncNow}
            className="h-[52px] w-full rounded-2xl bg-gray-900 text-[15px] font-semibold text-white transition-colors active:bg-gray-800"
          >
            Try Again
          </button>
        )}

        <button
          onClick={onContinue}
          className="mt-3 w-full text-center text-[13px] text-gray-400 transition-colors hover:text-gray-600"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
