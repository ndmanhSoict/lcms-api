import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.validation.js';
import logger from '../shared/constants/logger.js';
import type { RoleType } from '../shared/constants/roles.js';
import { User } from '../models/user.model.js';

interface JwtPayload {
  id: string;
  email: string;
  role: RoleType;
  branchId?: string;
}

type SocketNotificationPayload = Record<string, unknown>;
type SocketMessagePayload = Record<string, unknown>;

let io: Server | null = null;

function getUserRoom(userId: string) {
  return `user:${userId}`;
}

function getHandshakeToken(value: unknown) {
  if (typeof value !== 'string') return null;
  return value.startsWith('Bearer ') ? value.slice(7) : value;
}

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = getHandshakeToken(socket.handshake.auth?.token);
      if (!token) return next(new Error('UNAUTHORIZED'));

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
      const user = await User.findOne({
        _id: decoded.id,
        isActive: true,
        deletedAt: null,
      })
        .select('_id email role branchId')
        .lean();
      if (!user) return next(new Error('UNAUTHORIZED'));

      socket.data.user = {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        branchId: user.branchId?.toString(),
      };

      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', socket => {
    const userId = socket.data.user?.id as string | undefined;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(getUserRoom(userId));
    logger.info(`Socket connected: user=${userId}, socket=${socket.id}`);

    socket.on('disconnect', reason => {
      logger.info(`Socket disconnected: user=${userId}, socket=${socket.id}, reason=${reason}`);
    });
  });

  return io;
}

export function emitNotificationCreated(userId: string, payload: SocketNotificationPayload) {
  io?.to(getUserRoom(userId)).emit('notification:new', payload);
}

export function emitNotificationRead(userId: string, payload: SocketNotificationPayload) {
  io?.to(getUserRoom(userId)).emit('notification:read', payload);
}

export function emitNotificationsReadAll(userId: string, payload: SocketNotificationPayload) {
  io?.to(getUserRoom(userId)).emit('notification:read_all', payload);
}

export function emitNotificationUnreadCount(userId: string, unreadCount: number) {
  io?.to(getUserRoom(userId)).emit('notification:unread_count', { unread_count: unreadCount });
}

export function emitMessageCreated(userId: string, payload: SocketMessagePayload) {
  io?.to(getUserRoom(userId)).emit('message:new', payload);
}

export function emitMessagesRead(userId: string, payload: SocketMessagePayload) {
  io?.to(getUserRoom(userId)).emit('message:read', payload);
}

export function emitMessageUnreadCount(userId: string, unreadCount: number) {
  io?.to(getUserRoom(userId)).emit('message:unread_count', { unread_count: unreadCount });
}
