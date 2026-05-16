// pitchiq/frontend/src/lib/socket.ts

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || '', {
      // Dynamic auth: reads the latest token on every connect/reconnect,
      // so a refreshed access token is always sent (15-min expiry).
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}

export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
