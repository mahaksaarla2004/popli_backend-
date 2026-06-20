import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class SocialService {
  constructor(private prisma: PrismaService) {}

  async toggleFollow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

    const existingFollow = await this.prisma.follows.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existingFollow) {
      await this.prisma.follows.delete({
        where: { followerId_followingId: { followerId, followingId } },
      });
      await this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { decrement: 1 } },
      });
      await this.prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { decrement: 1 } },
      });
      return { following: false };
    } else {
      await this.prisma.follows.create({ data: { followerId, followingId } });
      await this.prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { increment: 1 } },
      });
      const followingUser = await this.prisma.user.update({
        where: { id: followingId },
        data: { followersCount: { increment: 1 } },
      });

      const follower = await this.prisma.user.findUnique({
        where: { id: followerId },
      });

      if (follower) {
        await this.prisma.notification.create({
          data: {
            userId: followingId,
            type: NotificationType.FOLLOW,
            title: 'New Follower',
            body: `started following you.`,
            senderId: followerId,
            senderAvatar: follower.avatar || 'https://i.pravatar.cc/150',
            metaData: { targetType: 'USER' },
          },
        });
      }

      return { following: true };
    }
  }

  async getFollowers(userId: string) {
    return this.prisma.follows.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  }

  async getFollowing(userId: string) {
    return this.prisma.follows.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  }

  async toggleBlock(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new Error('Cannot block yourself');
    }

    const existingBlock = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });

    if (existingBlock) {
      await this.prisma.block.delete({ where: { id: existingBlock.id } });
      return { blocked: false };
    } else {
      // Also remove follow relationships if blocking
      const existingFollows = await this.prisma.follows.findMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId },
          ],
        },
      });

      for (const follow of existingFollows) {
        await this.prisma.follows.delete({
          where: {
            followerId_followingId: {
              followerId: follow.followerId,
              followingId: follow.followingId,
            },
          },
        });
        await this.prisma.user.update({
          where: { id: follow.followerId },
          data: { followingCount: { decrement: 1 } },
        });
        await this.prisma.user.update({
          where: { id: follow.followingId },
          data: { followersCount: { decrement: 1 } },
        });
      }
      await this.prisma.block.create({ data: { blockerId, blockedId } });
      return { blocked: true };
    }
  }

  async getBlockedUsers(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
    return blocks.map((b) => b.blocked);
  }
}
