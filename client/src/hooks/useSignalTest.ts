// frontend/src/hooks/useSignalTest.ts
// Minimal hook to test a raw socket.io signalling server.
// Used in Settings page: user types URL → we connect → we expose status.
// It also fires global "signal connected/disconnected" events.

 /* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  notifySignalConnected,
  notifySignalDisconnected,
} from "../utils/signalEvents";

export type ConnStatus = "connecting" | "connected" | "disconnected";

export function useSignalTest(initialUrl: string) {
  // current server url (user can change it from UI)
  const [serverUrl, setServerUrl] = useState(initialUrl);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>("disconnected");
  const prevStatusRef = useRef<ConnStatus>("disconnected");

  useEffect(() => {
    if (!serverUrl) return;

    // open raw socket.io
    const s = io(serverUrl, {
      transports: ["websocket"],
      autoConnect: true,
    });
    setSocket(s);
    setConnStatus("connecting");

    const handleConnect = () => {
      setConnStatus((prev) => {
        // fire global event only when status actually changes
        if (prev !== "connected") {
          notifySignalConnected();
        }
        prevStatusRef.current = "connected";
        return "connected";
      });
    };

    const handleDisconnect = () => {
      setConnStatus((prev) => {
        if (prev !== "disconnected") {
          notifySignalDisconnected();
        }
        prevStatusRef.current = "disconnected";
        return "disconnected";
      });
    };

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleDisconnect);

    // cleanup on unmount / url change
    return () => {
      s.disconnect();
      setConnStatus("disconnected");
    };
  }, [serverUrl]);

  return {
    serverUrl,       // current url
    setServerUrl,    // UI can update it
    socket,          // raw socket.io
    connStatus,      // "connected" | "disconnected" | "connecting"
  };
}
