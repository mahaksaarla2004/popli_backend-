import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { ChatService } from '../chat/chat.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateReelDto, AddCommentDto } from './dto/reels.dto';
import { HashtagsService } from '../hashtags/hashtags.service';
import { extractHashtags } from '../utils/hashtags.util';
import { ChallengesGateway } from '../challenges/challenges.gateway';
import { checkAndProcessReferral } from '../utils/referral.util';

@Injectable()
export class ReelsService {
  constructor(
    private prisma: PrismaService,
    private chatService: ChatService,
    private notificationsGateway: NotificationsGateway,
    private hashtagsService: HashtagsService,
    private challengesGateway: ChallengesGateway
  ) {}

  async createReel(creatorId: string, dto: CreateReelDto) {
    let layersData = dto.layersData;
    if (typeof layersData === 'string') {
      try {
        layersData = JSON.parse(layersData);
      } catch (e) {}
    }

    const { taggedUserIds, challengeId, ...restDto } = dto;

    if (challengeId) {
      const challenge = await this.prisma.challenge.findUnique({
        where: { id: challengeId },
        select: { maxSubmissionsPerUser: true, status: true }
      });
      if (!challenge || challenge.status !== 'ACTIVE') {
        throw new BadRequestException('Challenge is not active or does not exist');
      }

      const existingReelsCount = await this.prisma.reel.count({
        where: { creatorId, challengeId }
      });

      if (existingReelsCount >= challenge.maxSubmissionsPerUser) {
        throw new BadRequestException(`You have reached the maximum allowed submissions (${challenge.maxSubmissionsPerUser}) for this challenge`);
      }
    }

    const reel = await this.prisma.reel.create({
      data: {
        ...restDto,
        layersData,
        creatorId,
        ...(challengeId && { challengeId }),
        ...(taggedUserIds && taggedUserIds.length > 0 && {
          taggedUsers: {
            connect: taggedUserIds.map((id) => ({ id })),
          },
        }),
      },
    });

    if (challengeId) {
      // Auto-join the challenge if they aren't already a participant
      const existingParticipant = await this.prisma.challengeParticipant.findUnique({
        where: { challengeId_userId: { challengeId, userId: creatorId } },
      });
      if (!existingParticipant) {
        await this.prisma.challengeParticipant.create({
          data: { challengeId, userId: creatorId },
        });
        await this.prisma.challenge.update({
          where: { id: challengeId },
          data: { participantCount: { increment: 1 } },
        });
      }
    }

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
                type: NotificationType.TAG,
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

    // Process hashtags asynchronously
    if (dto.description) {
      const hashtags = extractHashtags(dto.description);
      this.hashtagsService.processHashtags(reel.id, hashtags).catch(err => {
        console.error('Failed to process hashtags for reel', err);
      });
    }

    // Trigger referral check (first post requirement)
    checkAndProcessReferral(this.prisma, creatorId).catch(err => {
      console.error('Referral process error on reel creation', err);
    });

    return reel;
  }

  async getFeed(cursor: string | null = null, limit: number = 10, category?: string) {
    const where: any = {
      privacy: { in: ['Public', 'Everyone'] }, // Show public reels in the general feed
      ...(category && category !== 'all' ? { category } : {})
    };
    
    // Using Prisma cursor-based pagination
    const reels = await this.prisma.reel.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's a next page
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatar: true, isVerified: true },
        },
        taggedUsers: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    let nextCursor: string | null = null;
    if (reels.length > limit) {
      const nextItem = reels.pop(); // Remove the extra item
      nextCursor = nextItem?.id || null;
    }

    return {
      reels,
      nextCursor
    };
  }

  async getExploreFeed(page: number = 1, limit: number = 10, category?: string, excludeIds: string[] = []) {
    // We ignore skip (page) for the database query because we are randomizing
    // We fetch a larger pool (e.g., 50) of recent reels that haven't been seen yet
    const where: any = {
      privacy: { in: ['Public', 'Everyone'] }, // Show public reels in explore
      ...(category && category !== 'all' ? { category } : {})
    };
    
    if (excludeIds.length > 0) {
      where.id = { notIn: excludeIds };
    }

    const pool = await this.prisma.reel.findMany({
      where,
      take: 100, // Increased pool size for better randomness across large datasets
      orderBy: { createdAt: 'desc' }, // Get recent ones to keep fresh
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
      where: { 
        creatorId: { in: followingIds },
        privacy: { in: ['Public', 'Friends'] } // Following feed can show friends-only posts
      },
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
      WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL AND r.privacy = 'Public'
      HAVING (6371 * acos(cos(radians(${lat})) * cos(radians(r.latitude)) * cos(radians(r.longitude) - radians(${lng})) + sin(radians(${lat})) * sin(radians(r.latitude)))) < ${radiusKm}
      ORDER BY distance ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async toggleLike(reelId: string, userId: string) {
    const reelCheck = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reelCheck) throw new NotFoundException('Reel not found');
    


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
      
      if (reel.challengeId) {
        await this.prisma.challengeParticipant.update({
          where: { challengeId_userId: { challengeId: reel.challengeId, userId: reel.creatorId } },
          data: { score: { decrement: 5 } }
        }).catch(() => null);
        this.challengesGateway.broadcastLeaderboardUpdate(reel.challengeId);
      }

      return { liked: false };
    } else {
      try {
        await this.prisma.like.create({ data: { reelId, userId } });
        const reel = await this.prisma.reel.update({
          where: { id: reelId },
          data: { likesCount: { increment: 1 } },
        });
        await this.prisma.user.update({
          where: { id: reel.creatorId },
          data: { totalLikesReceived: { increment: 1 } },
        });

        if (reel.challengeId) {
          await this.prisma.challengeParticipant.update({
            where: { challengeId_userId: { challengeId: reel.challengeId, userId: reel.creatorId } },
            data: { score: { increment: 5 } }
          }).catch(() => null);
          this.challengesGateway.broadcastLeaderboardUpdate(reel.challengeId);
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (reel.creatorId !== userId && user) {
          try {
            const notification = await this.prisma.notification.create({
              data: {
                userId: reel.creatorId,
                type: NotificationType.LIKE,
                title: 'New Like',
                body: `${user.name} liked your reel.`,
                senderId: userId,
                senderAvatar: user.avatar || 'https://i.pravatar.cc/150',
                postId: reelId,
              },
            });
            this.notificationsGateway.sendNotificationToUser(reel.creatorId, notification);
          } catch (error) {
            console.error('Failed to create like notification:', error);
          }
        }
      } catch (error: any) {
        // If it's a unique constraint violation (P2002), the like already exists.
        // We can just ignore it to prevent 500 errors on concurrent rapid clicks.
        if (error.code === 'P2002') {
          console.warn('Like already exists (concurrent request caught).');
        } else {
          throw error;
        }
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

    if (reel.challengeId) {
      await this.prisma.challengeParticipant.update({
        where: { challengeId_userId: { challengeId: reel.challengeId, userId: reel.creatorId } },
        data: { score: { increment: 10 } }
      }).catch(() => null);
      this.challengesGateway.broadcastLeaderboardUpdate(reel.challengeId);
    }

    // Notify Reel Creator (if not self and not a reply to someone else)
    if (reel.creatorId !== userId && comment.user && !dto.parentId) {
      try {
        const notification = await this.prisma.notification.create({
          data: {
            userId: reel.creatorId,
            type: NotificationType.COMMENT,
            title: 'New Comment',
            body: `${comment.user.name} commented: "${dto.text}"`,
            senderId: userId,
            senderAvatar: comment.user.avatar || 'https://i.pravatar.cc/150',
            postId: reelId,
            commentId: comment.id,
          },
        });
        this.notificationsGateway.sendNotificationToUser(reel.creatorId, notification);
      } catch (error) {
        console.error('Failed to create comment notification:', error);
      }
    }

    // Handle Mentions and Reply Notification
    const mentionRegex = /@([\w.-]+)/g;
    // Extract unique usernames
    const rawMentions = [...dto.text.matchAll(mentionRegex)].map((m) => m[1]);
    const mentions = Array.from(new Set(rawMentions));

    // If it's a reply, notify the parent comment's user
    if (dto.parentId) {
      try {
        const parentComment = await this.prisma.comment.findUnique({
          where: { id: dto.parentId },
          include: { user: true },
        });
        if (parentComment && parentComment.userId !== userId) {
          const notification = await this.prisma.notification.create({
            data: {
              userId: parentComment.userId,
              type: NotificationType.REPLY,
              title: 'New Reply',
              body: `${comment.user.name} replied to your comment.`,
              senderId: userId,
              senderAvatar: comment.user.avatar || 'https://i.pravatar.cc/150',
              postId: reelId,
              commentId: parentComment.id,
              replyId: comment.id,
            },
          });
          this.notificationsGateway.sendNotificationToUser(parentComment.userId, notification);
        }
      } catch (error) {
        console.error('Failed to create reply notification:', error);
      }
    }

    // Send Mention Notifications
    if (mentions.length > 0) {
      try {
        const mentionedUsers = await this.prisma.user.findMany({
          where: { username: { in: mentions } },
        });
        for (const mUser of mentionedUsers) {
          if (mUser.id !== userId) { // Self Mention Protection
            const notification = await this.prisma.notification.create({
              data: {
                userId: mUser.id,
                type: NotificationType.MENTION,
                title: 'You were mentioned',
                body: `${comment.user.name} mentioned you in a comment.`,
                senderId: userId,
                senderAvatar: comment.user.avatar || 'https://i.pravatar.cc/150',
                postId: reelId,
                commentId: dto.parentId ? dto.parentId : comment.id,
                replyId: dto.parentId ? comment.id : undefined,
              },
            });
            this.notificationsGateway.sendNotificationToUser(mUser.id, notification);
          }
        }
      } catch (error) {
        console.error('Failed to create mention notifications:', error);
      }
    }

    return comment;
  }

  async getComments(reelId: string, userId: string) {
    const comments = await this.prisma.comment.findMany({
      where: { reelId, parentId: null }, // Only fetch top-level comments
      orderBy: { createdAt: 'desc' },
      include: {
        likes: {
          where: { userId }
        },
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
            likes: {
              where: { userId }
            },
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

    const mapCommentWithLike = (c: any) => ({
      ...c,
      isLiked: c.likes && c.likes.length > 0,
      likes: undefined, // remove from response
      replies: c.replies ? c.replies.map((r: any) => ({
        ...r,
        isLiked: r.likes && r.likes.length > 0,
        likes: undefined
      })) : []
    });

    return comments.map(mapCommentWithLike);
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
      
      // Soft delete like notification
      try {
        await this.prisma.notification.updateMany({
          where: {
            type: NotificationType.COMMENT_LIKE,
            commentId: commentId,
            senderId: userId,
          },
          data: { isActive: false },
        });
      } catch (error) {
        console.error('Failed to soft delete comment_like notification:', error);
      }
      
      return { liked: false };
    } else {
      try {
        await this.prisma.commentLike.create({ data: { commentId, userId } });
      } catch (error) {
        if (error.code === 'P2002') return { liked: true };
        throw error;
      }
      const comment = await this.prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      });
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (comment.userId !== userId && user) {
        try {
          const notification = await this.prisma.notification.create({
            data: {
              userId: comment.userId,
              type: NotificationType.COMMENT_LIKE,
              title: 'Comment Liked',
              body: `${user.name} liked your comment.`,
              senderId: userId,
              senderAvatar: user.avatar || 'https://i.pravatar.cc/150',
              postId: comment.reelId,
              commentId: comment.id,
              isActive: true,
            },
          });
          this.notificationsGateway.sendNotificationToUser(comment.userId, notification);
        } catch (error) {
          console.error('Failed to create comment_like notification:', error);
          // If unique constraint fails, we can optionally restore the soft-deleted one
          if (error.code === 'P2002') {
             await this.prisma.notification.updateMany({
               where: {
                 type: NotificationType.COMMENT_LIKE,
                 commentId: comment.id,
                 senderId: userId,
               },
               data: { isActive: true, updatedAt: new Date() },
             });
          }
        }
      }
      return { liked: true };
    }
  }

  async incrementView(
    reelId: string, 
    userId?: string, 
    metrics?: { deviceId?: string; sessionId?: string; ipHash?: string; watchDuration?: number; completionPercent?: number }
  ) {
    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel) throw new NotFoundException('Reel not found');

    // 1. Always log the raw ViewEvent for analytics and future fraud audits
    await this.prisma.viewEvent.create({
      data: {
        reelId,
        userId,
        deviceId: metrics?.deviceId,
        sessionId: metrics?.sessionId,
        ipHash: metrics?.ipHash,
        watchDuration: metrics?.watchDuration || 0,
        completionPercent: metrics?.completionPercent || 0.0,
      }
    });

    let isValidForEarning = false;

    if (userId && reel.creatorId === userId) {
      return { success: true, ignored: true, reason: 'creator' };
    }
    
    // In production, we check if watchDuration >= 10000ms
    const isValidDuration = (metrics?.watchDuration ?? 10000) >= 10000;

    if (userId && isValidDuration) {
      // Check if user already has a ValidView for this reel
      const existingValidView = await this.prisma.validView.findUnique({
        where: { reelId_userId: { reelId, userId } },
      });

      if (!existingValidView) {
        isValidForEarning = true;
        // Insert ValidView
        await this.prisma.validView.create({
          data: {
            reelId,
            userId,
            deviceId: metrics?.deviceId,
          }
        });

        // Award 1 Coin to Viewer for watching
        const viewerWallet = await this.prisma.wallet.upsert({
          where: { userId },
          create: { userId, coinBalance: 1 },
          update: { coinBalance: { increment: 1 } },
        });

        // Record Coin Earning Transaction
        await this.prisma.transaction.create({
          data: {
            walletId: viewerWallet.id,
            type: 'AD_REVENUE',
            amount: 1,
            currency: 'COINS',
            status: 'SUCCESS',
            referenceId: `view_${reelId}_${Date.now()}`,
          }
        });

        // Also record WatchHistory
        await this.prisma.watchHistory.upsert({
          where: { userId_reelId: { userId, reelId } },
          create: { userId, reelId },
          update: { watchedAt: new Date() }
        });
      } else {
        // Just update WatchHistory time
        await this.prisma.watchHistory.update({
          where: { userId_reelId: { userId, reelId } },
          data: { watchedAt: new Date() },
        });
      }
    }

    // 3. Increment public views count only if duration is valid
    if (isValidDuration) {
      await this.prisma.reel.update({
        where: { id: reelId },
        data: { viewsCount: { increment: 1 } },
      });
    }

    // 4. Update Challenge Leaderboard if applicable
    if (reel.challengeId && isValidForEarning && userId) {
      await this.prisma.challengeParticipant.update({
        where: { challengeId_userId: { challengeId: reel.challengeId, userId: reel.creatorId } },
        data: { score: { increment: 1 } }
      }).catch(() => null);
      this.challengesGateway.broadcastLeaderboardUpdate(reel.challengeId);
    }

    return { success: true, isValidForEarning };
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
    
    // Remove hashtags and decrement counts
    await this.hashtagsService.removeHashtagsForReel(reelId);

    return this.prisma.reel.delete({
      where: { id: reelId },
    });
  }
}
