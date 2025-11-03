// src/services/devices.ts
import { api } from "./api";

export type SignalDeviceDto = {
  ownerId: string | null;   // socket.id if online
  userId: number | null;    // owner user id (if known)
  label: string;
  streamId: string | null;
  onAir: boolean;
};

/**
 * some backends return 401 for public users
 * so we try public fetch as a fallback
 */
async function fallbackPublicList(): Promise<SignalDeviceDto[]> {
  const res = await fetch("/api/signal/devices", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    return [];
  }
  return (await res.json()) as SignalDeviceDto[];
}

export const devicesApi = {
  /**
   * list all devices (online + db)
   * - first try with auth
   * - if 401 -> try public
   */
  async list() {
    try {
      return await api.get<SignalDeviceDto[]>("/signal/devices");
    } catch (err: any) {
      const msg = err?.message?.toString() || "";
      if (msg.includes("Unauthorized") || msg.includes("401")) {
        return await fallbackPublicList();
      }
      throw err;
    }
  },

  attach: (ownerId: string) =>
    api.post(`/signal/devices/${ownerId}/attach`),

  cameraOn: (ownerId: string) =>
    api.post(`/signal/devices/${ownerId}/camera/on`),

  cameraOff: (ownerId: string) =>
    api.post(`/signal/devices/${ownerId}/camera/off`),
};
