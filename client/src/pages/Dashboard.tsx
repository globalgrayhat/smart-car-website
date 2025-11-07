import React, { useEffect, useRef } from "react";
import { useMedia } from "../media/MediaContext";
import ScreenActionBar from "../components/screen/ScreenActionBar";
import ScreenStatusCard from "../components/screen/ScreenStatusCard";
import ScreenToolsCard from "../components/screen/ScreenToolsCard";
import StreamInfoCard from "../components/screen/StreamInfoCard";
import JoinRequestsPanel from "../components/admin/JoinRequestsPanel";
import IncomingCameraBar from "../components/admin/IncomingCameraBar";
import ScreenPreview from "../components/screen/ScreenPreview";

const Dashboard: React.FC = () => {
  const media = useMedia() as any;

  const connStatus: "connecting" | "connected" | "disconnected" =
    media?.connStatus ?? "disconnected";
  const lastDisconnect: number | null = media?.lastDisconnect ?? null;
  const screen = media?.screen ?? null;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ربط تيار الشاشة مع عنصر الفيديو
  useEffect(() => {
    if (screen && videoRef.current && typeof screen.bindVideo === "function") {
      screen.bindVideo(videoRef.current);
    }
  }, [screen]);

  const isMobile =
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;

  const isSharing = !!screen?.isSharing;
  const isBroadcasting = !!screen?.isBroadcasting;
  const isRecording = !!screen?.isRecording;
  const screenId = screen?.id ?? null;

  const handleShare = () => {
    if (!screen || connStatus !== "connected") return;
    screen.start?.({ mobile: isMobile });
  };

  const handleStopShare = () => {
    screen?.stop?.();
  };

  const handleStartBroadcast = () => {
    if (!screen || !isSharing || connStatus !== "connected") return;
    screen.startBroadcast?.();
  };

  const handleStopBroadcast = () => {
    screen?.stopBroadcast?.();
  };

  const handleCapture = () => {
    screen?.capture?.();
  };

  const handleStartRecording = () => {
    if (!screen || !isSharing) return;
    screen.startRecording?.();
  };

  const handleStopRecording = () => {
    screen?.stopRecording?.();
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* شريط الطلبات الحية (كاميرا / انضمام) */}
      <IncomingCameraBar />

      {/* طلبات الانضمام من قاعدة البيانات */}
      <JoinRequestsPanel />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* منطقة المعاينة والتحكم */}
        <section className="space-y-4 lg:col-span-8">
          <div>
            <h2 className="text-xl font-semibold text-white">
              لوحة إدارة البث
            </h2>
            <p className="text-sm text-slate-400">
              مشاركة شاشة المضيف، بدء البث المباشر، مراقبة الطلبات، والتحكم
              بجودة البث.
            </p>
          </div>

          <div
            className="
              relative w-full overflow-hidden border rounded-lg
              bg-slate-950/40 border-slate-800
              min-h-[180px] max-h-[65vh]
              md:min-h-[240px] md:max-h-[80vh]
            "
          >
            <ScreenPreview
              videoRef={videoRef}
              isSharing={isSharing}
              isBroadcasting={isBroadcasting}
              isRecording={isRecording}
              isMobile={isMobile}
              connStatus={connStatus}
            />
          </div>

          <ScreenActionBar
            isSharing={isSharing}
            isBroadcasting={isBroadcasting}
            isRecording={isRecording}
            connStatus={connStatus}
            onShare={handleShare}
            onStopShare={handleStopShare}
            onStartBroadcast={handleStartBroadcast}
            onStopBroadcast={handleStopBroadcast}
            onCapture={handleCapture}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        </section>

        {/* كروت الحالة والمعلومات */}
        <aside className="space-y-4 lg:col-span-4">
          <ScreenStatusCard
            connStatus={connStatus}
            lastDisconnect={lastDisconnect}
          />
          <ScreenToolsCard
            isSharing={isSharing}
            connStatus={connStatus}
            onShare={handleShare}
            onStopShare={handleStopShare}
          />
          <StreamInfoCard
            isSharing={isSharing}
            isBroadcasting={isBroadcasting}
            screenId={screenId}
          />
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;
