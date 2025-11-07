// client/src/components/GlobalAlertStrip.tsx
import React, { useEffect, useState } from "react";

type Alert = { kind: "signal" | "broadcast"; message: string };

const GlobalAlertStrip: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const onSignalDown = (e: Event) => {
      const reason = (e as CustomEvent).detail?.reason || "غير معروف";
      setAlerts((a) => [...a, { kind: "signal", message: `انقطع اتصال الإشارة: ${reason}` }]);
    };
    const onSignalUp = () => {
      setAlerts((a) => a.filter((x) => x.kind !== "signal"));
    };
    const onCastDown = (e: Event) => {
      const reason = (e as CustomEvent).detail?.reason || "انقطاع البث";
      setAlerts((a) => [...a, { kind: "broadcast", message: `انقطاع البث: ${reason} — نحاول إعادة التوصيل…` }]);
    };
    const onCastUp = () => {
      setAlerts((a) => a.filter((x) => x.kind !== "broadcast"));
    };

    window.addEventListener("signal:down", onSignalDown as any);
    window.addEventListener("signal:up", onSignalUp as any);
    window.addEventListener("broadcast:down", onCastDown as any);
    window.addEventListener("broadcast:up", onCastUp as any);

    return () => {
      window.removeEventListener("signal:down", onSignalDown as any);
      window.removeEventListener("signal:up", onSignalUp as any);
      window.removeEventListener("broadcast:down", onCastDown as any);
      window.removeEventListener("broadcast:up", onCastUp as any);
    };
  }, []);

  if (alerts.length === 0) return null;
  const last = alerts[alerts.length - 1];
  const styles =
    last.kind === "signal"
      ? "bg-amber-500/15 border-amber-500/40 text-amber-100"
      : "bg-red-500/10 border-red-500/40 text-red-100";

  return (
    <div className={`px-3 py-2 border rounded-md mx-4 my-2 text-[12px] ${styles}`}>
      {last.message}
    </div>
  );
};

export default GlobalAlertStrip;
