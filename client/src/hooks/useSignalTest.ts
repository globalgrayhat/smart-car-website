// client/src/hooks/useSignalTest.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  notifySignalConnected,
  notifySignalDisconnected,
} from "../utils/signalEvents";

export type ConnStatus = "connecting" | "connected" | "disconnected";

const HEARTBEAT_EVERY_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 12000;

export function useSignalTest(initialUrl: string) {
  const [serverUrl, setServerUrl] = useState(initialUrl);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("disconnected");
  const prevStatusRef = useRef<ConnStatus>("disconnected");

  const hbTimer = useRef<number | null>(null);
  const hbWaitTimer = useRef<number | null>(null);
  const backoffRef = useRef(1000); // 1s → مضاعف حتى 30s

  useEffect(() => {
    if (!serverUrl) return;

    const s = io(serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 30000,
    });

    setSocket(s);
    setConnStatus("connecting");

    const markConnected = () => {
      setConnStatus((prev) => {
        if (prev !== "connected") notifySignalConnected();
        prevStatusRef.current = "connected";
        window.dispatchEvent(new CustomEvent("signal:up"));
        return "connected";
      });
      backoffRef.current = 1000; // reset
      startHeartbeat();
    };

    const markDisconnected = (reason = "server-disconnect") => {
      stopHeartbeat();
      setConnStatus((prev) => {
        if (prev !== "disconnected") notifySignalDisconnected();
        prevStatusRef.current = "disconnected";
        window.dispatchEvent(new CustomEvent("signal:down", { detail: { reason } }));
        return "disconnected";
      });
    };

    const startHeartbeat = () => {
      stopHeartbeat();
      hbTimer.current = window.setInterval(() => {
        try {
          s.emit("hb", Date.now());
          if (hbWaitTimer.current) window.clearTimeout(hbWaitTimer.current);
          hbWaitTimer.current = window.setTimeout(() => {
            // no pong in time → consider down
            markDisconnected("heartbeat-timeout");
            s.disconnect();
            // manual reconnect after backoff
            const d = Math.min(30000, backoffRef.current);
            backoffRef.current = Math.min(30000, backoffRef.current * 2);
            setTimeout(() => {
              s.connect();
            }, d);
          }, HEARTBEAT_TIMEOUT_MS);
        } catch {
          // ignore
        }
      }, HEARTBEAT_EVERY_MS);

      s.off("hb:pong");
      s.on("hb:pong", () => {
        if (hbWaitTimer.current) {
          window.clearTimeout(hbWaitTimer.current);
          hbWaitTimer.current = null;
        }
      });
    };

    const stopHeartbeat = () => {
      if (hbTimer.current) window.clearInterval(hbTimer.current);
      hbTimer.current = null;
      if (hbWaitTimer.current) window.clearTimeout(hbWaitTimer.current);
      hbWaitTimer.current = null;
    };

    s.on("connect", markConnected);
    s.on("disconnect", () => markDisconnected("socket-disconnect"));
    s.on("connect_error", () => markDisconnected("connect-error"));

    return () => {
      stopHeartbeat();
      s.removeAllListeners();
      s.disconnect();
      setConnStatus("disconnected");
    };
  }, [serverUrl]);

  return { serverUrl, setServerUrl, socket, connStatus };
}
