import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChallengesService {
  constructor(private prisma: PrismaService) {}

  async getActiveChallenges() {
    return this.prisma.challenge.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gt: new Date() },
      },
      include: {
        _count: {
          select: { participants: true }
        }
      },
      orderBy: { endDate: 'asc' },
    });
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

    return this.prisma.challengeParticipant.create({
      data: {
        challengeId,
        userId,
      },
    });
  }

  async getLeaderboard(challengeId: string) {
    return this.prisma.challengeParticipant.findMany({
      where: { challengeId },
      orderBy: { score: 'desc' },
      take: 10,
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    });
  }
}
