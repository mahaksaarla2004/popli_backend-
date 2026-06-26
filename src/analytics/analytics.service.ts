import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getCreatorDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        reels: {
          select: {
            viewsCount: true,
            likesCount: true,
            commentsCount: true,
            sharesCount: true,
          },
        },
      },
    });

    if (!user) throw new Error('User not found');

    const totalViews = user.reels.reduce(
      (sum, reel) => sum + reel.viewsCount,
      0,
    );
    const totalEngagement = user.reels.reduce(
      (sum, reel) =>
        sum + reel.likesCount + reel.commentsCount + reel.sharesCount,
      0,
    );

    return {
      totalViews,
      totalEngagement,
      totalEarnings: user.wallet?.inrEarnings || 0,
      coinBalance: user.wallet?.coinBalance || 0,
      followers: user.followersCount,
    };
  }

  async trackEvent(userId: string, eventName: string, metadata?: any) {
    console.log(
      `[ANALYTICS] Event: ${eventName} | User: ${userId} | Metadata:`,
      metadata,
    );
    return { success: true };
  }

  async getReelAnalytics(reelId: string, userId: string) {
    const reel = await this.prisma.reel.findUnique({ where: { id: reelId } });
    if (!reel) throw new Error('Reel not found');
    if (reel.creatorId !== userId) throw new Error('Unauthorized');

    const overview = {
      totalViews: reel.viewsCount,
      totalLikes: reel.likesCount,
      totalComments: reel.commentsCount,
      totalShares: reel.sharesCount,
    };

    // Earnings
    const ledgers = await this.prisma.walletLedger.findMany({
      where: { reelId, userId, source: 'GIFT_RECEIVED' },
    });
    const giftEarnings = ledgers.reduce((sum, l) => sum + l.credit, 0);

    const viewLedgers = await this.prisma.walletLedger.findMany({
      where: { reelId, userId, source: 'VIEW_EARNING' },
    });
    const viewEarnings = viewLedgers.reduce((sum, l) => sum + l.credit, 0);
    const totalEarnings = giftEarnings + viewEarnings;

    // Top Gifters (Using Notifications as proxy for sender details since Ledger lacks senderId)
    const giftNotifs = await this.prisma.notification.findMany({
      where: { postId: reelId, type: 'GIFT' },
    });

    const giftersMap = new Map();
    for (const notif of giftNotifs) {
      if (!notif.senderId) continue;
      const meta = notif.metaData as any;
      const amount = meta?.giftAmount || 0;
      
      if (giftersMap.has(notif.senderId)) {
        const current = giftersMap.get(notif.senderId);
        current.totalGiftCoins += amount;
        current.giftCount += 1;
      } else {
        giftersMap.set(notif.senderId, {
          userId: notif.senderId,
          username: 'User', // Will update below
          avatar: notif.senderAvatar || '',
          totalGiftCoins: amount,
          giftCount: 1,
        });
      }
    }

    const topGifters = Array.from(giftersMap.values()).sort((a, b) => b.totalGiftCoins - a.totalGiftCoins).slice(0, 10);
    if (topGifters.length > 0) {
      const senders = await this.prisma.user.findMany({
        where: { id: { in: topGifters.map((g) => g.userId) } },
        select: { id: true, username: true },
      });
      for (const gifter of topGifters) {
        const u = senders.find((s) => s.id === gifter.userId);
        if (u) gifter.username = u.username;
      }
    }

    // Audience
    const countryGroups = await this.prisma.viewEvent.groupBy({
      by: ['country'],
      where: { reelId, country: { not: null } },
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
      take: 5,
    });
    const stateGroups = await this.prisma.viewEvent.groupBy({
      by: ['state'],
      where: { reelId, state: { not: null } },
      _count: { state: true },
      orderBy: { _count: { state: 'desc' } },
      take: 5,
    });
    const cityGroups = await this.prisma.viewEvent.groupBy({
      by: ['city'],
      where: { reelId, city: { not: null } },
      _count: { city: true },
      orderBy: { _count: { city: 'desc' } },
      take: 5,
    });

    return {
      overview,
      earnings: {
        viewEarnings,
        giftEarnings,
        totalEarnings,
      },
      topGifters,
      audience: {
        countries: countryGroups.map((c) => ({ name: c.country, count: c._count.country })),
        states: stateGroups.map((s) => ({ name: s.state, count: s._count.state })),
        cities: cityGroups.map((c) => ({ name: c.city, count: c._count.city })),
      },
    };
  }
}
