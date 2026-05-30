import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Module-level reference so routes can emit events without circular imports
let _io: SocketServer | null = null;
export function getIo(): SocketServer {
  if (!_io) throw new Error('Socket.IO not initialised yet');
  return _io;
}

export function setupSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: config.frontendUrl,
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, config.jwt.secret) as { userId: string; role: string; companyId: string };
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      socket.data.companyId = payload.companyId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  _io = io;

  io.on('connection', (socket: Socket) => {
    const { userId, companyId } = socket.data as { userId: string; companyId: string };

    // Join company room for broadcasts
    socket.join(`company:${companyId}`);
    socket.join(`user:${userId}`);

    // Session events — accept both plain string and { sessionId } object from clients
    socket.on('session:join', (payload: string | { sessionId: string }) => {
      const sessionId = typeof payload === 'string' ? payload : payload.sessionId;
      if (sessionId) socket.join(`session:${sessionId}`);
    });

    socket.on('session:leave', (payload: string | { sessionId: string }) => {
      const sessionId = typeof payload === 'string' ? payload : payload.sessionId;
      if (sessionId) socket.leave(`session:${sessionId}`);
    });

    socket.on('session:message', (data: { sessionId: string; message: unknown }) => {
      socket.to(`session:${data.sessionId}`).emit('session:message', data.message);
    });

    socket.on('session:status', (data: { sessionId: string; status: string }) => {
      io.to(`session:${data.sessionId}`).emit('session:status', data);
    });

    socket.on('disconnect', () => {
      socket.leave(`company:${companyId}`);
      socket.leave(`user:${userId}`);
    });
  });

  return io;
}
