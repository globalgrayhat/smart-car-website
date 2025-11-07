// Mediasoup configuration with VP8 + H264 support and safe defaults.

import { registerAs } from '@nestjs/config';

export default registerAs('mediasoup', () => ({
  listenIps: [
    {
      ip: '0.0.0.0',
      // Use your real machine IP if accessed from LAN/Internet, or keep 127.0.0.1 for local only.
      announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
    },
  ],
  numWorkers: 1,
  webRtcServer: {
    listenInfos: [
      {
        protocol: 'udp',
        ip: '0.0.0.0',
        port: 40000,
      },
      {
        protocol: 'tcp',
        ip: '0.0.0.0',
        port: 40000,
      },
    ],
  },
  workerSettings: {
    rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 49999,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  // Both VP8 and H264 enabled so Chrome/Firefox/Safari can send video.
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      rtcpFeedback: [
        { type: 'nack' },
        { type: 'nack', parameter: 'pli' },
        { type: 'ccm', parameter: 'fir' },
        { type: 'goog-remb' },
      ],
    },
    {
      kind: 'video',
      mimeType: 'video/H264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
      },
      rtcpFeedback: [
        { type: 'nack' },
        { type: 'nack', parameter: 'pli' },
        { type: 'ccm', parameter: 'fir' },
        { type: 'goog-remb' },
      ],
    },
  ],
  jwtSecret: process.env.JWT_SECRET || 'smartcar-secret',
  vehicleApiKeys: [],
  defaultChannel: 'global',
}));
