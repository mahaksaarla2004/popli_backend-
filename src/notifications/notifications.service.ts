import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: string, take: number = 20, cursor?: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, isActive: true },
      take: take + 1, // Fetch one extra to determine if there's a next page
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } },
      },
    });
    
    let nextCursor: typeof cursor | undefined = undefined;
    if (notifications.length > take) {
      const nextItem = notifications.pop();
      if (nextItem) nextCursor = nextItem.id;
    }

    return {
      notifications,
      nextCursor,
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false, isActive: true },
    });
    return { count };
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false, isActive: true },
      data: { isRead: true },
    });
  }
}
