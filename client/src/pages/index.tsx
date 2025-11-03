// src/pages/index.tsx
// Home page – safe-with-signal version
// - Reads connection from MediaContext
// - Guards against undefined media / streams
// - Shows camera + screen panels even if signal server is late
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
  // ⚠️ media could be undefined for a short time (provider still booting)
  const media = useMedia() as any;

  // connection state – fallbacks
  const connStatus: "connecting" | "connected" | "disconnected" =
    media?.connStatus ?? "disconnected";
  const lastDisconnect: number | null = media?.lastDisconnect ?? null;

  // live streams coming from mediasoup/signal
  const streams: Array<{ kind: string; ownerId: string; onAir?: boolean }> =
    Array.isArray(media?.streams) ? media.streams : [];

  const [isMobile, setIsMobile] = useState(false);
  const [direction, setDirection] = useState("");
  const [batteryLevel, setBatteryLevel] = useState(80);
  const [vehicleCameraOwner, setVehicleCameraOwner] =
    useState<string | null>(null);

  // detect mobile once
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

  // fake battery (just UI)
  useEffect(() => {
    const id = setInterval(() => {
      setBatteryLevel((prev) => {
        const next = prev + (Math.random() > 0.5 ? 1 : -1);
        return Math.max(10, Math.min(100, Math.round(next)));
      });
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // who is streaming camera now (onAir)
  useEffect(() => {
    const cam = streams.find((st) => st.kind === "camera" && st.onAir);
    setVehicleCameraOwner(cam ? cam.ownerId : null);
  }, [streams]);

  return (
    <div className="relative space-y-6 animate-fadeIn">
      <h1 className="mb-4 text-2xl font-bold text-white">
        لوحة التحكم الرئيسية
      </h1>

      {/* viewer join-requests bar (only for VIEWER) */}
      <JoinRequestBar />

      {/* top status cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <ServerStatusCard status={connStatus} lastDisconnect={lastDisconnect} />
        <VehicleStatusCard vehicleCameraOwner={vehicleCameraOwner} />
        <BatteryCard batteryLevel={batteryLevel} />
        <DirectionCard direction={direction} />
      </div>

      {/* main layout */}
      <div className="grid items-start grid-cols-1 gap-6 xl:grid-cols-3">
        {/* screen share (2 cols on desktop) */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <ScreenPanel connStatus={connStatus} isMobile={isMobile} />
        </div>

        {/* camera + car control */}
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
