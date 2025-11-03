import { registerAs } from "@nestjs/config";

export default registerAs("mediasoup", () => ({
  listenIps: [
    {
      ip: "0.0.0.0",
      announcedIp: null,
    },
  ],
  numWorkers: 1,
  webRtcServer: {
    listenInfos: [
      {
        protocol: "udp",
        ip: "0.0.0.0",
        port: 40000,
      },
      {
        protocol: "tcp",
        ip: "0.0.0.0",
        port: 40000,
      },
    ],
  },
  workerSettings: {
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  },
  mediaCodecs: [
    {
      kind: "audio",
      mimeType: "audio/opus",
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
      },
    },
  ],
  jwtSecret: "smartcar-secret",
  vehicleApiKeys: [],
  defaultChannel: "global",
}));
