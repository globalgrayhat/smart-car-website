/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
} from 'mediasoup/node/lib/types';

export type MediaRole = 'ADMIN' | 'BROADCAST_MANAGER' | 'VIEWER' | 'VEHICLE';

export interface MediasoupPeer {
  id: string;
  userId?: number | null;
  username?: string | null;
  role: MediaRole;
  channelId: string;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  isBroadcaster: boolean;
  vehicleKey?: string;
}

export interface MediasoupRoom {
  id: string;
  router: Router;
  peers: Map<string, MediasoupPeer>;
}

export interface CreateTransportOpts {
  peerId: string;
  direction: 'send' | 'recv';
}
