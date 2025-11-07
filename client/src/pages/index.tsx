// Home page:
// - High-level overview for main dashboard.
// - Reads connection & streams from MediaContext.
// - Shows server status, vehicle status, battery, direction, screen and camera panels.
// - Integrates JoinRequestBar for viewers.
// - Arabic UI text, English comments.

import React, { useEffect, useState } from "react";
import { useMedia } from "../media/MediaContext";

import ServerStatusCard from "../components/home/ServerStatusCard";
import VehicleStatusCard from "../components/home/VehicleStatusCard";
import BatteryCard from "../components/home/BatteryCard";
import DirectionCard from "../components/home/DirectionCard";
import ScreenPanel from "../components/home/ScreenPanel";
import CameraPanel from "../components/home/CameraPanel";
import JoinRequestBar from "../components/JoinRequestBar";

const Home: React.FC = () => {
  const media = useMedia() as any;

  // Connection status from MediaContext with safe fallback
  const connStatus: "connecting" | "connected" | "disconnected" =
    media?.connStatus ?? "disconnected";
  const lastDisconnect: number | null = media?.lastDisconnect ?? null;

  // Streams array: depends on mediasoup integration; keep it defensive
  const streams: Array<{ kind: string; ownerId: string; onAir?: boolean }> =
    Array.isArray(media?.streams) ? media.streams : [];

  const [isMobile, setIsMobile] = useState(false);
  const [direction, setDirection] = useState("");
  const [batteryLevel, setBatteryLevel] = useState(80);
  const [vehicleCameraOwner, setVehicleCameraOwner] =
    useState<string | null>(null);

  // Detect mobile layout once and on resize
  useEffect(() => {
    const check = () => {
      const mobile =
        window.innerWidth <= 768 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fake battery fluctuation (purely visual)
  useEffect(() => {
    const id = setInterval(() => {
      setBatteryLevel((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = prev + delta;
        return Math.max(10, Math.min(100, Math.round(next)));
      });
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // Determine who is currently streaming vehicle camera (onAir)
  useEffect(() => {
    const cam = streams.find((st) => st.kind === "camera" && st.onAir);
    setVehicleCameraOwner(cam ? cam.ownerId : null);
  }, [streams]);

  return (
    <div className="relative space-y-6 animate-fadeIn">
      <h1 className="mb-4 text-2xl font-bold text-white">
        لوحة التحكم الرئيسية
      </h1>

      {/* Viewer join-requests quick bar (for requesting VIEW / CAMERA / SCREEN / CONTROL) */}
      <JoinRequestBar />

      {/* Top status summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <ServerStatusCard status={connStatus} lastDisconnect={lastDisconnect} />
        <VehicleStatusCard vehicleCameraOwner={vehicleCameraOwner} />
        <BatteryCard batteryLevel={batteryLevel} />
        <DirectionCard direction={direction} />
      </div>

      {/* Main layout: screen + camera/control */}
      <div className="grid items-start grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Screen share block (takes 2 columns on desktop) */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <ScreenPanel connStatus={connStatus} isMobile={isMobile} />
        </div>

        {/* Camera panel + direction control */}
        <div className="flex flex-col gap-4">
          <CameraPanel
            connStatus={connStatus}
            onDirectionChange={setDirection}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
