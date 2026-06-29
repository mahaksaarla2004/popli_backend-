import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`Notification client connected: ${client.id}`);

    // Check if token exists, we can extract user ID and join room
    // Here we assume the client will emit 'join_notifications'
  }

  handleDisconnect(client: Socket) {
    console.log(`Notification client disconnected: ${client.id}`);
  }

  async sendNotificationToUser(userId: string, notification: any) {
    try {
      const sender = notification.senderId
        ? await this.prisma.user.findUnique({
            where: { id: notification.senderId },
          })
        : null;
      const meta = notification.metaData || {};
      const payload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        actorId: notification.senderId,
        actorName: notification.type === 'SYSTEM' ? 'Popli System' : sender
          ? sender.name
          : notification.senderAvatar
            ? 'User'
            : 'User',
        actorAvatar: sender
          ? sender.avatar
          : notification.senderAvatar || null,
        targetType: meta.targetType || (notification.postId ? 'REEL' : 'USER'),
        reelId: notification.postId,
        reelThumbnail: meta.reelThumbnail,
        postId: notification.postId,
        postThumbnail: meta.reelThumbnail,
        storyId: meta.storyId,
        storyThumbnail: meta.storyThumbnail,
        commentId: notification.commentId,
        commentText: meta.commentText,
        giftId: meta.giftId,
        giftType: meta.giftType,
        giftAmount: meta.giftAmount,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
        aggregatedCount: 1,
      };

      // Emit new_notification
      // Note: We use the same channel as chat sockets or global sockets, assuming user joined a room.
      // E.g. 'user_USERID' room if auth is managed globally.
      this.server.to(`user_${userId}`).emit('new_notification', payload);
      this.server.emit(`new_notification_${userId}`, payload); // Fallback for simple listeners

      // Emit unread count
      const unreadCount = await this.prisma.notification.count({
        where: { userId, isRead: false, isActive: true },
      });
      this.server
        .to(`user_${userId}`)
        .emit('notification:unread-count', { count: unreadCount });
      this.server.emit(`notification:unread-count_${userId}`, {
        count: unreadCount,
      }); // Fallback
    } catch (error) {
      console.error('Failed to emit notification via socket:', error);
    }
  }
}
