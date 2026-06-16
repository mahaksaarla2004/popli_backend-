import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { CreateReelDto, AddCommentDto } from './dto/reels.dto';

@Injectable()
export class ReelsService {
  constructor(
    private prisma: PrismaService,
    private chatService: ChatService
  ) {}

  async createReel(creatorId: string, dto: CreateReelDto) {
    let layersData = dto.layersData;
    if (typeof layersData === 'string') {
      try {
        layersData = JSON.parse(layersData);
      } catch (e) {}
    }

    const { taggedUserIds, ...restDto } = dto;

    const reel = await this.prisma.reel.create({
      data: {
        ...restDto,
        layersData,
        creatorId,
        ...(taggedUserIds && taggedUserIds.length > 0 && {
          taggedUsers: {
            connect: taggedUserIds.map((id) => ({ id })),
          },
        }),
      },
    });

    if (taggedUserIds && taggedUserIds.length > 0) {
      const creator = await this.prisma.user.findUnique({
        where: { id: creatorId },
        select: { id: true, name: true, avatar: true },
      });

      if (creator) {
        for (const taggedUserId of taggedUserIds) {
          if (taggedUserId !== creatorId) {
            // Send Notification
            await this.prisma.notification.create({
              data: {
                userId: taggedUserId,
                type: 'tag',
                title: 'You were tagged!',
                body: `${creator.name} tagged you in a new post/reel.`,
                senderId: creatorId,
                senderAvatar: creator.avatar || 'https://i.pravatar.cc/150',
              },
            });

            // Send Chat Message
            try {
              const chat = await this.chatService.getOrCreateChat(creatorId, taggedUserId);
              await this.chatService.sendMessage(chat.id, creatorId, {
                text: `Hey! I tagged you in my new post/reel.`,
              });
            } catch (err) {
              console.error('Failed to send chat message for tagging', err);
            }
          }
        }
      }
    }

    return reel;
  }

  async getFeed(page: number = 1, limit: number = 10, category?: string, excludeIds: string[] = []) {
    // We ignore skip (page) for the database query because we are randomizing
    // We fetch a larger pool (e.g., 50) of recent reels that haven't been seen yet
    const where: any = category && category !== 'all' ? { category } : {};
    
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    const pool = await this.prisma.reel.findMany({
      where,
      take: 100, // Increased pool size for better randomness across large datasets
      orderBy: { createdAt: 'desc' }, // Get recent ones to keep feed fresh
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatar: true, isVerified: true },
        },
        taggedUsers: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    // Fisher-Yates Shuffle for true algorithmic randomness
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Return the requested limit
    return shuffled.slice(0, limit);
  }

  async getFollowingFeed(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const follows = await this.prisma.follows.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = follows.map(f => f.followingId);

    console.log(`[getFollowingFeed] User ${userId} follows:`, followingIds);

    const reels = await this.prisma.reel.findMany({
      where: { creatorId: { in: followingIds } },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isVerified: true,
          },
        },
        taggedUsers: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    console.log(`[getFollowingFeed] Returning ${reels.length} reels.`);
    return reels;
  }

  async getUserReels(userId: string) {
    return this.prisma.reel.findMany({
      where: { creatorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isVerified: true,
          },
        },
        taggedUsers: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });
  }

  async getReelById(reelId: string) {
    console.log("getReelById called with:", reelId);
    const reel = await this.prisma.reel.findUnique({
      where: { id: reelId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isVerified: true,
          },
        },
        taggedUsers: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!reel) throw new NotFoundException('Reel not found');
    return reel;
  }

  async getNearbyFeed(
    lat: number,
    lng: number,
    radiusKm: number = 50,
    page: number = 1,
    limit: number = 10,
  ) {
    const offset = (page - 1) * limit;
    // Using raw SQL Haversine formula for distance calculation without PostGIS
    return this.prisma.$queryRaw`
      SELECT r.*, u.username, u.avatar, u."isVerified",
      (6371 * acos(cos(radians(${lat})) * cos(radians(r.latitude)) * cos(radians(r.longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(r.latitude)))) AS distance
      FROM "Reel" r
      JOIN "User" u ON r."creatorId" = u.id
      WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      HAVING (6371 * acos(cos(radians(${lat})) * cos(radians(r.latitude)) * cos(radians(r.longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(r.latitude)))) < ${radiusKm}
      ORDER BY distance ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async toggleLike(reelId: string, userId: string) {
    const existingLike = await this.prisma.like.findUnique({
      where: { reelId_userId: { reelId, userId } },
    });

    if (existingLike) {
      await this.prisma.like.delete({ where: { id: existingLike.id } });
      const reel = await this.prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { decrement: 1 } },
      });
      await this.prisma.user.update({
        where: { id: reel.creatorId },
        data: { totalLikesReceived: { decrement: 1 } },
      });
      return { liked: false };
    } else {
      await this.prisma.like.create({ data: { reelId, userId } });
      const reel = await this.prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { increment: 1 } },
      });
      await this.prisma.user.update({
        where: { id: reel.creatorId },
        data: { totalLikesReceived: { increment: 1 } },
      });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (reel.creatorId !== userId && user) {
        await this.prisma.notification.create({
          data: {
            userId: reel.creatorId,
            type: 'like',
            title: 'New Like',
            body: `${user.name} liked your reel.`,
            senderId: userId,
            senderAvatar: user.avatar || 'https://i.pravatar.cc/150',
          },
        });
      }
      return { liked: true };
    }
  }

  async toggleSave(reelId: string, userId: string) {
    const existingSave = await this.prisma.save.findUnique({
      where: { reelId_userId: { reelId, userId } },
    });

    if (existingSave) {
      await this.prisma.save.delete({ where: { id: existingSave.id } });
      await this.prisma.reel.update({
        where: { id: reelId },
        data: { savesCount: { decrement: 1 } },
      });
      return { saved: false };
    } else {
      await this.prisma.save.create({ data: { reelId, userId } });
      await this.prisma.reel.update({
        where: { id: reelId },
        data: { savesCount: { increment: 1 } },
      });
      return { saved: true };
    }
  }

  async addComment(reelId: string, userId: string, dto: AddCommentDto) {
    const comment = await this.prisma.comment.create({
      data: {
        text: dto.text,
        reelId,
        userId,
        parentId: dto.parentId || null,
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    });

    const reel = await this.prisma.reel.update({
      where: { id: reelId },
      data: { commentsCount: { increment: 1 } },
    });

    // Notify Reel Creator (if not self and not a reply to someone else)
    if (reel.creatorId !== userId && comment.user && !dto.parentId) {
      await this.prisma.notification.create({
        data: {
          userId: reel.creatorId,
          type: 'comment',
          title: 'New Comment',
          body: `${comment.user.name} commented: "${dto.text}"`,
          senderId: userId,
          senderAvatar: comment.user.avatar || 'https://i.pravatar.cc/150',
        },
      });
    }

    // Handle Mentions and Reply Notification
    const mentionRegex = /@([\w.-]+)/g;
    const mentions = [...dto.text.matchAll(mentionRegex)].map((m) => m[1]);

    // If it's a reply, notify the parent comment's user
    if (dto.parentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        include: { user: true },
      });
      if (parentComment && parentComment.userId !== userId) {
        await this.prisma.notification.create({
          data: {
            userId: parentComment.userId,
            type: 'reply',
            title: 'New Reply',
            body: `${comment.user.name} replied to your comment.`,
            senderId: userId,
            senderAvatar: comment.user.avatar || 'https://i.pravatar.cc/150',
          },
        });
      }
    }

    // Send Mention Notifications
    if (mentions.length > 0) {
      const mentionedUsers = await this.prisma.user.findMany({
        where: { username: { in: mentions } },
      });
      for (const mUser of mentionedUsers) {
        if (mUser.id !== userId) {
          await this.prisma.notification.create({
            data: {
              userId: mUser.id,
              type: 'mention',
              title: 'You were mentioned',
              body: `${comment.user.name} mentioned you in a comment.`,
              senderId: userId,
              senderAvatar: comment.user.avatar || 'https://i.pravatar.cc/150',
            },
          });
        }
      }
    }

    return comment;
  }

  async getComments(reelId: string) {
    return this.prisma.comment.findMany({
      where: { reelId, parentId: null }, // Only fetch top-level comments
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            isVerified: true,
          },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
  }

  async toggleCommentLike(commentId: string, userId: string) {
    const existingLike = await this.prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });

    if (existingLike) {
      await this.prisma.commentLike.delete({ where: { id: existingLike.id } });
      await this.prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
      });
      return { liked: false };
    } else {
      await this.prisma.commentLike.create({ data: { commentId, userId } });
      const comment = await this.prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      });
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (comment.userId !== userId && user) {
        await this.prisma.notification.create({
          data: {
            userId: comment.userId,
            type: 'comment_like',
            title: 'Comment Liked',
            body: `${user.name} liked your comment.`,
            senderId: userId,
            senderAvatar: user.avatar || 'https://i.pravatar.cc/150',
          },
        });
      }
      return { liked: true };
    }
  }

  async incrementView(reelId: string, userId?: string) {
    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel) throw new NotFoundException('Reel not found');

    // Rule 3: Creator cannot count own views for earnings (or public views typically)
    // DISABLED FOR LOCAL TESTING so you can see your own views in Analytics
    /*
    if (userId && reel.creatorId === userId) {
      return { success: true, ignored: true, reason: 'creator' };
    }
    */

    if (userId) {
      // Rule 2: One view per user per video
      const existingHistory = await this.prisma.watchHistory.findUnique({
        where: { userId_reelId: { userId, reelId } },
      });

      if (existingHistory) {
        // User already watched. Update history time but do not increment earnings view
        await this.prisma.watchHistory.update({
          where: { userId_reelId: { userId, reelId } },
          data: { watchedAt: new Date() },
        });

        // Still increment the public viewsCount for ego, but not pendingEarningsViews
        await this.prisma.reel.update({
          where: { id: reelId },
          data: { viewsCount: { increment: 1 } },
        });

        return { success: true, ignored: true, reason: 'duplicate' };
      }

      // First time viewing! Count towards earnings.
      await this.prisma.watchHistory.create({
        data: { userId, reelId },
      });

      const updatedReel = await this.prisma.reel.update({
        where: { id: reelId },
        data: {
          viewsCount: { increment: 1 },
          pendingEarningsViews: { increment: 1 }, // Keep for potential hourly ledger creation
        },
      });

      // INSTANT EARNINGS: Add to wallet immediately (0.005 gross -> minus 10% TDS -> 0.0045 net per view)
      await this.prisma.wallet.update({
        where: { userId: updatedReel.creatorId },
        data: { inrEarnings: { increment: 0.0045 } }
      });
    } else {
      // Anonymous view. Do not count towards earnings, just public viewsCount.
      await this.prisma.reel.update({
        where: { id: reelId },
        data: { viewsCount: { increment: 1 } },
      });
    }

    return { success: true };
  }

  async getLikedReels(userId: string) {
    const likes = await this.prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reel: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
    return likes.map((l) => l.reel);
  }

  async getWatchHistory(userId: string) {
    const history = await this.prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      include: {
        reel: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
    return history.map((h) => h.reel);
  }

  async deleteReel(reelId: string, userId: string) {
    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel) {
      return { success: true, message: 'Reel already deleted' };
    }
    if (reel.creatorId !== userId) {
      throw new UnauthorizedException('You can only delete your own reels');
    }
    return this.prisma.reel.delete({
      where: { id: reelId },
    });
  }
}
