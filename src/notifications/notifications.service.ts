import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(userId: string, take: number = 30, cursor?: string) {
    const rawNotifications = await this.prisma.notification.findMany({
      where: { userId, isActive: true },
      take: take + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    });

    let nextCursor: typeof cursor | undefined = undefined;
    if (rawNotifications.length > take) {
      const nextItem = rawNotifications.pop();
      if (nextItem) nextCursor = nextItem.id;
    }

    // Extract unique IDs
    const senderIds = [
      ...new Set(
        rawNotifications.map((n) => n.senderId).filter(Boolean) as string[],
      ),
    ];
    const postIds = [
      ...new Set(
        rawNotifications.map((n) => n.postId).filter(Boolean) as string[],
      ),
    ];
    const storyIds = [
      ...new Set(
        rawNotifications
          .map((n) => (n.metaData as any)?.storyId)
          .filter(Boolean) as string[],
      ),
    ];
    const commentIds = [
      ...new Set(
        rawNotifications.map((n) => n.commentId).filter(Boolean) as string[],
      ),
    ];

    // Fetch related data
    const [senders, reels, stories, comments] = await Promise.all([
      senderIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: senderIds } },
            select: { id: true, name: true, username: true, avatar: true },
          })
        : [],
      postIds.length > 0
        ? this.prisma.reel.findMany({
            where: { id: { in: postIds } },
            select: { id: true, thumbnailUrl: true, mediaUrl: true },
          })
        : [],
      storyIds.length > 0
        ? this.prisma.story.findMany({
            where: { id: { in: storyIds } },
            select: { id: true, mediaUrl: true },
          })
        : [],
      commentIds.length > 0
        ? this.prisma.comment.findMany({
            where: { id: { in: commentIds } },
            select: { id: true, text: true },
          })
        : [],
    ]);

    const senderMap = new Map(senders.map((s) => [s.id, s] as [string, any]));
    const reelMap = new Map(
      reels.map((r) => [r.id, r.thumbnailUrl || r.mediaUrl] as [string, any]),
    );
    const storyMap = new Map(stories.map((s) => [s.id, s.mediaUrl] as [string, any]));
    const commentMap = new Map(comments.map((c) => [c.id, c.text] as [string, any]));

    // First pass: map to the new payload structure
    const mappedNotifs = rawNotifications.map((n) => {
      const meta = (n.metaData as any) || {};
      const sender = n.senderId ? senderMap.get(n.senderId) : null;

      const fallbackName = n.body ? n.body.split(' ')[0] : 'User';
      const actorName = sender ? sender.username || sender.name : fallbackName;
      const actorAvatar = sender
        ? sender.avatar
        : n.senderAvatar || 'https://i.pravatar.cc/150';

      let finalCommentText = meta.commentText;
      if (!finalCommentText && n.commentId) {
        finalCommentText = commentMap.get(n.commentId) || undefined;
      }

      return {
        id: n.id,
        type: n.type,
        actorId: n.senderId,
        actorName,
        actorAvatar,
        targetType: meta.targetType || (n.postId ? 'REEL' : 'USER'),
        reelId: n.postId,
        reelThumbnail:
          meta.reelThumbnail || (n.postId ? reelMap.get(n.postId) : undefined),
        postId: n.postId,
        postThumbnail:
          meta.reelThumbnail || (n.postId ? reelMap.get(n.postId) : undefined),
        storyId: meta.storyId,
        storyThumbnail:
          meta.storyThumbnail ||
          (meta.storyId ? storyMap.get(meta.storyId) : undefined),
        commentId: n.commentId,
        commentText: finalCommentText,
        giftId: meta.giftId,
        giftType: meta.giftType,
        giftAmount: meta.giftAmount,
        createdAt: n.createdAt,
        isRead: n.isRead,
        _dateKey: new Date(n.createdAt).toDateString(),
        _rawActorName: actorName,
      } as any;
    });

    // Second pass: Aggregation
    const aggregated: any[] = [];
    const aggMap = new Map<string, any>();

    for (const n of mappedNotifs) {
      // We only aggregate LIKEs for now, or maybe COMMENT_LIKEs.
      // User says: "Aggregate only if: same type, same reelId, same day"
      // Let's aggregate LIKE and COMMENT_LIKE
      const canAggregate = n.type === 'LIKE' || n.type === 'COMMENT_LIKE';

      if (canAggregate && n.reelId) {
        const key = `${n.type}_${n.reelId}_${n._dateKey}`;
        if (aggMap.has(key)) {
          const existing = aggMap.get(key);
          existing.aggregatedCount = (existing.aggregatedCount || 1) + 1;
          existing._multiActor = true;
          existing.actorName = `${existing._rawActorName} and ${existing.aggregatedCount - 1} others`;
        } else {
          n.aggregatedCount = 1;
          n._multiActor = false;
          aggMap.set(key, n);
          aggregated.push(n);
        }
      } else {
        n.aggregatedCount = 1;
        aggregated.push(n);
      }
    }

    // Clean up internal fields
    const finalPayload = aggregated.map((n) => {
      const { _dateKey, _rawActorName, _multiActor, ...rest } = n;
      return rest;
    });

    return {
      notifications: finalPayload,
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
