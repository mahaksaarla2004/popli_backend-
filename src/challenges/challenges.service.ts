import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ChallengesGateway } from './challenges.gateway';

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: ChallengesGateway
  ) { }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncChallengeScores() {
    this.logger.log('Starting Challenge Score Sync...');
    // Find all active challenges
    const activeChallenges = await this.prisma.challenge.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true }
    });

    for (const challenge of activeChallenges) {
      // Get all reels for this challenge
      const reels = await this.prisma.reel.findMany({
        where: { challengeId: challenge.id, challengeApprovalStatus: 'APPROVED' },
        select: { creatorId: true, viewsCount: true, likesCount: true, commentsCount: true, sharesCount: true }
      });

      // Aggregate scores per creator
      const creatorScores = new Map<string, { views: number, likes: number, comments: number, shares: number, total: number }>();
      
      for (const reel of reels) {
        const current = creatorScores.get(reel.creatorId) || { views: 0, likes: 0, comments: 0, shares: 0, total: 0 };
        current.views += reel.viewsCount;
        current.likes += reel.likesCount;
        current.comments += reel.commentsCount;
        current.shares += reel.sharesCount;
        
        // Define scoring algorithm (configurable in future)
        current.total = current.views * 1 + current.likes * 5 + current.comments * 10 + current.shares * 15;
        
        creatorScores.set(reel.creatorId, current);
      }

      // Upsert into ChallengeScore
      for (const [participantId, score] of creatorScores.entries()) {
        await this.prisma.challengeScore.upsert({
          where: { challengeId_participantId: { challengeId: challenge.id, participantId } },
          create: {
            challengeId: challenge.id,
            participantId,
            views: score.views,
            likes: score.likes,
            comments: score.comments,
            shares: score.shares,
            totalScore: score.total
          },
          update: {
            views: score.views,
            likes: score.likes,
            comments: score.comments,
            shares: score.shares,
            totalScore: score.total
          }
        });

        // Also update the main participant table for backward compatibility in APIs
        await this.prisma.challengeParticipant.updateMany({
          where: { challengeId: challenge.id, userId: participantId },
          data: { score: score.total }
        });
      }
      
      this.gateway.broadcastLeaderboardUpdate(challenge.id);
    }
    this.logger.log('Challenge Score Sync Completed.');
  }

  // ------------------ ADMIN ------------------
  async createChallenge(data: any) {
    return this.prisma.challenge.create({ data });
  }

  async updateChallenge(id: string, data: any) {
    const updated = await this.prisma.challenge.update({ where: { id }, data });
    if (data.status) {
      this.gateway.broadcastStatusChange(id, data.status);
    }
    return updated;
  }

  async deleteChallenge(id: string) {
    return this.prisma.challenge.delete({ where: { id } });
  }

  // ------------------ PUBLIC ------------------
  async getActiveChallenges(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    return this.prisma.challenge.findMany({
      where: {
        status: { in: ['ACTIVE'] }
      },
      skip,
      take: limit,
      orderBy: { endDate: 'asc' },
    });
  }

  async getChallenge(id: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: {
        _count: { select: { participants: true, reels: true } }
      }
    });
    if (!challenge) throw new NotFoundException('Challenge not found');
    return challenge;
  }

  async joinChallenge(userId: string, challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || challenge.status !== 'ACTIVE' || challenge.endDate < new Date()) {
      throw new BadRequestException('Challenge is not active or has expired');
    }

    const existing = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
    });

    if (existing) {
      throw new BadRequestException('You have already joined this challenge');
    }

    // Update participant count
    const updated = await this.prisma.challenge.update({
      where: { id: challengeId },
      data: { participantCount: { increment: 1 } }
    });

    const participant = await this.prisma.challengeParticipant.create({
      data: { challengeId, userId },
    });

    this.gateway.broadcastParticipantJoined(challengeId, updated.participantCount);

    await this.prisma.notification.create({
      data: {
        userId,
        type: 'CHALLENGE_JOINED',
        title: 'Joined Challenge!',
        body: `You successfully joined the ${challenge.title} challenge. Good luck!`,
      }
    });

    return participant;
  }

  async getLeaderboard(challengeId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const participants = await this.prisma.challengeParticipant.findMany({
      where: { challengeId },
      orderBy: { score: 'desc' },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } }
      }
    });

    return participants.map((p, index) => ({
      user: p.user,
      score: p.score,
      reelsCount: 0, // Optionally calculate this if still needed, or remove
      rank: skip + index + 1
    }));
  }

  async getChallengeReels(challengeId: string, page = 1, limit = 10, sort = 'latest') {
    const skip = (page - 1) * limit;

    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { requiresApproval: true }
    });

    const whereClause: any = { challengeId };
    if (challenge?.requiresApproval) {
      whereClause.challengeApprovalStatus = 'APPROVED';
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'top') {
      orderBy = { likesCount: 'desc' };
    }

    return this.prisma.reel.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy,
      include: {
        creator: { select: { id: true, name: true, username: true, avatar: true } },
        _count: { select: { likes: true, comments: true } }
      }
    });
  }

  // --- ADMIN FUNCTIONS ---

  async getAdminChallenges(page = 1, limit = 10, search?: string, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.challenge.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.challenge.count({ where })
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getChallengeParticipants(challengeId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.challengeParticipant.findMany({
        where: { challengeId },
        skip,
        take: limit,
        orderBy: { score: 'desc' },
        include: {
          user: { select: { id: true, name: true, username: true, avatar: true } }
        }
      }),
      this.prisma.challengeParticipant.count({ where: { challengeId } })
    ]);

    return { data, meta: { total, page, limit } };
  }

  async getAdminChallengeReels(challengeId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.reel.findMany({
        where: { challengeId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: { select: { id: true, name: true, username: true, avatar: true } }
        }
      }),
      this.prisma.reel.count({ where: { challengeId } })
    ]);

    return { data, meta: { total, page, limit } };
  }

  async approveReel(reelId: string, status: 'APPROVED' | 'REJECTED') {
    const reel = await this.prisma.reel.update({
      where: { id: reelId },
      data: { challengeApprovalStatus: status },
      include: { challenge: true }
    });

    if (reel.challenge) {
      await this.prisma.notification.create({
        data: {
          userId: reel.creatorId,
          type: status === 'APPROVED' ? 'CHALLENGE_APPROVED' : 'CHALLENGE_REJECTED',
          title: `Challenge Entry ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
          body: `Your entry for the ${reel.challenge.title} challenge has been ${status.toLowerCase()}.`,
        }
      });
    }

    return reel;
  }

  async freezeLeaderboardAndSelectWinners(challengeId: string, winnerUserIds: string[]) {
    // Transactional process to freeze leaderboard and queue rewards
    return this.prisma.$transaction(async (tx) => {
      // 1. Mark challenge as COMPLETED
      const challenge = await tx.challenge.update({
        where: { id: challengeId },
        data: { status: 'COMPLETED' }
      });

      // 2. Create pending reward transactions
      const rewardSplit = challenge.rewardPool / winnerUserIds.length;

      const transactions = [];
      for (const winnerId of winnerUserIds) {
        // Prevent duplicates
        const existing = await tx.challengeRewardTransaction.findUnique({
          where: { challengeId_winnerUserId: { challengeId, winnerUserId: winnerId } }
        });

        if (!existing) {
          const trans = await tx.challengeRewardTransaction.create({
            data: {
              challengeId,
              winnerUserId: winnerId,
              rewardAmount: rewardSplit,
              rewardType: 'INR',
              status: 'PENDING'
            }
          });
          transactions.push(trans);
        }
      }

      return { challenge, queuedRewards: transactions.length };
    });
  }

  async processRewardTransaction(txId: string) {
    // Process single reward transaction to Wallet
    const txData = await this.prisma.challengeRewardTransaction.findUnique({
      where: { id: txId },
      include: { challenge: true }
    });

    if (!txData || txData.status === 'COMPLETED') {
      throw new BadRequestException('Transaction not found or already completed');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Update transaction to PROCESSING
        await tx.challengeRewardTransaction.update({
          where: { id: txId },
          data: { status: 'PROCESSING' }
        });

        // Add to user wallet
        await tx.wallet.upsert({
          where: { userId: txData.winnerUserId },
          create: {
            userId: txData.winnerUserId,
            inrEarnings: txData.rewardType === 'INR' ? txData.rewardAmount : 0,
            coinBalance: txData.rewardType === 'COINS' ? txData.rewardAmount : 0,
          },
          update: {
            inrEarnings: txData.rewardType === 'INR' ? { increment: txData.rewardAmount } : undefined,
            coinBalance: txData.rewardType === 'COINS' ? { increment: txData.rewardAmount } : undefined,
          }
        });

        // Log transaction
        const wallet = await tx.wallet.findUnique({ where: { userId: txData.winnerUserId } });
        if (wallet) {
          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: 'CHALLENGE_REWARD',
              amount: txData.rewardAmount,
              currency: txData.rewardType,
              description: `Reward for winning challenge: ${txData.challenge.title}`,
              status: 'SUCCESS'
            }
          });
        }

        // Mark as completed
        await tx.challengeRewardTransaction.update({
          where: { id: txId },
          data: { status: 'COMPLETED', processedAt: new Date() }
        });

        // Send notification
        await tx.notification.create({
          data: {
            userId: txData.winnerUserId,
            type: 'CHALLENGE_WIN',
            title: 'You Won a Challenge!',
            body: `Congratulations! You won ₹${txData.rewardAmount} in the ${txData.challenge.title} challenge.`,
          }
        });
      });

      return { success: true, message: 'Reward processed successfully' };
    } catch (error) {
      // Mark as failed if wallet update fails
      await this.prisma.challengeRewardTransaction.update({
        where: { id: txId },
        data: { status: 'FAILED' }
      });
      throw new BadRequestException('Failed to process reward. Transaction marked as FAILED.');
    }
  }

  async getAdminChallengeRewards(challengeId: string) {
    return this.prisma.challengeRewardTransaction.findMany({
      where: { challengeId },
      include: {
        winner: { select: { id: true, name: true, username: true, avatar: true } }
      }
    });
  }

  async getChallengeAnalytics(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: {
        participantCount: true,
        viewsCount: true,
        likesCount: true,
        sharesCount: true,
      }
    });
    
    if (!challenge) throw new NotFoundException('Challenge not found');
    
    return {
      totalParticipants: challenge.participantCount,
      totalViews: challenge.viewsCount,
      totalLikes: challenge.likesCount,
      totalShares: challenge.sharesCount,
    };
  }
}
