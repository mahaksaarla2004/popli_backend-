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
        reels: { select: { viewsCount: true, likesCount: true, commentsCount: true, sharesCount: true } }
      }
    });

    if (!user) throw new Error('User not found');

    const totalViews = user.reels.reduce((sum, reel) => sum + reel.viewsCount, 0);
    const totalEngagement = user.reels.reduce((sum, reel) => sum + reel.likesCount + reel.commentsCount + reel.sharesCount, 0);

    return {
      totalViews,
      totalEngagement,
      totalEarnings: user.wallet?.inrEarnings || 0,
      coinBalance: user.wallet?.coinBalance || 0,
      followers: user.followersCount,
    };
  }
}
