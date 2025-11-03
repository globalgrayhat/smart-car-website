// src/pages/Dashboard.tsx
// Admin / manager dashboard
// - Uses MediaContext screen module
// - Guards against screen not yet initialized
// - Shows incoming camera / join requests

import React, { useEffect, useRef } from "react";
import { useMedia } from "../media/MediaContext";
import ScreenActionBar from "../components/screen/ScreenActionBar";
import ScreenStatusCard from "../components/screen/ScreenStatusCard";
import ScreenToolsCard from "../components/screen/ScreenToolsCard";
import StreamInfoCard from "../components/screen/StreamInfoCard";
import JoinRequestsPanel from "../components/admin/JoinRequestsPanel";
import IncomingCameraBar from "../components/admin/IncomingCameraBar";

const Dashboard: React.FC = () => {
  const media = useMedia() as any;

  // socket / mediasoup connection status
  const connStatus: "connecting" | "connected" | "disconnected" =
    media?.connStatus ?? "disconnected";
  const lastDisconnect: number | null = media?.lastDisconnect ?? null;

  // screen module: may be null while initializing
  const screen = media?.screen ?? null;

  // local video ref for binding screen stream
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // bind screen stream to local <video> once screen is ready
  useEffect(() => {
    if (screen && videoRef.current && typeof screen.bindVideo === "function") {
      screen.bindVideo(videoRef.current);
    }
  }, [screen]);

  // simple mobile check
  const isMobile =
    typeof window !== "undefined" ? window.innerWidth <= 768 : false;

  // screen control handlers
  const handleShare = () => screen?.start?.();
  const handleStopShare = () => screen?.stop?.();
  const handleStartBroadcast = () => screen?.startBroadcast?.();
  const handleStopBroadcast = () => screen?.stopBroadcast?.();
  const handleCapture = () => screen?.capture?.();
  const handleStartRecording = () => screen?.startRecording?.();
  const handleStopRecording = () => screen?.stopRecording?.();

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 animate-fadeIn">
      {/* LEFT / MAIN AREA */}
      <div className="space-y-6 xl:col-span-2">
        {/* incoming cameras bar for admin */}
        <IncomingCameraBar />

        {/* SCREEN SHARE BLOCK (updated) */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          {/* header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                مشاركة الشاشة
              </h2>
              <p className="text-xs text-slate-400">
                هنا تظهر الشاشة التي تبثها للمشاهدين.
              </p>
            </div>

            {/* small status pill (sharing / idle) */}
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                screen?.isSharing
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-800 text-slate-300 border border-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  screen?.isSharing ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
              {screen?.isSharing ? "يبث الحين" : "مافي بث"}
            </div>
          </div>

          {/* video container
              - aspect-video to keep 16:9
              - relative so we can overlay fallback and floating buttons */}
          <div
            className={`relative w-full overflow-hidden rounded-xl bg-slate-950/40 border border-slate-900 ${
              isMobile ? "h-[240px]" : "aspect-video"
            }`}
          >
            {/* actual video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
                screen?.isSharing ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* fallback overlay when screen is NOT sharing */}
            {!screen?.isSharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                {/* simple inline icon (you can swap with lucide-react) */}
                <div className="flex items-center justify-center border rounded-full w-14 h-14 bg-slate-900/80 border-slate-700">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-7 h-7 text-slate-200"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M3 5h18v11H3z" />
                    <path d="M10 21h4" />
                    <path d="M12 16v5" />
                    <path d="m10 9 4 2-4 2V9Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    مافي بث شاشة حالياً
                  </p>
                  <p className="text-xs text-slate-400">
                    اضغط "بدء المشاركة" عشان تظهر هنا.
                  </p>
                </div>
                <button
                  onClick={handleShare}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded-md bg-emerald-500 hover:bg-emerald-600 transition"
                >
                  بدء المشاركة
                </button>
              </div>
            )}

            {/* floating controls when sharing */}
            {screen?.isSharing && (
              <div className="absolute flex gap-2 top-3 right-3">
                <button
                    onClick={handleCapture}
                    className="px-2 py-1 text-[10px] bg-slate-900/70 border border-slate-700 rounded-md text-white hover:bg-slate-900"
                  >
                    Capture
                  </button>
                <button
                  onClick={handleStopShare}
                  className="px-2 py-1 text-[10px] bg-red-500/80 hover:bg-red-500 rounded-md text-white"
                >
                  Stop
                </button>
              </div>
            )}
          </div>

          {/* action bar (original component) */}
          <ScreenActionBar
            isSharing={screen?.isSharing ?? false}
            isBroadcasting={screen?.isBroadcasting ?? false}
            isRecording={screen?.isRecording ?? false}
            connStatus={connStatus}
            onShare={handleShare}
            onStopShare={handleStopShare}
            onStartBroadcast={handleStartBroadcast}
            onStopBroadcast={handleStopBroadcast}
            onCapture={handleCapture}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />

          {/* download last recording (if present) */}
          {screen?.recordUrl && (
            <a
              href={screen.recordUrl}
              download="screen-recording.webm"
              className="inline-block mt-3 text-xs underline text-emerald-400"
            >
              Download last recording
            </a>
          )}

          {/* show init hint if screen not ready */}
          {!screen && (
            <p className="mt-3 text-[10px] text-slate-500">
              Initializing screen module from server…
            </p>
          )}
        </div>

        {/* notes / ops block */}
        <div className="p-4 border rounded-lg bg-slate-900/50 border-slate-800">
          <h2 className="mb-2 text-lg font-semibold text-white">
            ملاحظات التشغيل
          </h2>
          <p className="text-sm text-slate-300">
            اكتب توجيهات البث، تنبيهات السواق، أو تعليمات الطوارئ هنا.
          </p>
        </div>
      </div>

      {/* RIGHT / SIDE AREA */}
      <div className="space-y-4">
        {/* list of join requests */}
        <JoinRequestsPanel />

        {/* connection / screen status */}
        <ScreenStatusCard
          connStatus={connStatus}
          lastDisconnect={lastDisconnect}
        />

        {/* quick screen tools */}
        <ScreenToolsCard
          isSharing={screen?.isSharing ?? false}
          connStatus={connStatus}
          onShare={handleShare}
          onStopShare={handleStopShare}
        />

        {/* stream info / id / status */}
        <StreamInfoCard
          isSharing={screen?.isSharing ?? false}
          isBroadcasting={screen?.isBroadcasting ?? false}
          screenId={screen?.streamId ?? null}
        />
      </div>
    </div>
  );
};

export default Dashboard;
