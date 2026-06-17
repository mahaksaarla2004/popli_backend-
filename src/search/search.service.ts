import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchAll(query: string) {
    const cleanQuery = query.replace('#', '');
    
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: cleanQuery, mode: 'insensitive' } },
          { name: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isVerified: true,
      },
    });

    const hashtags = await this.prisma.hashtag.findMany({
      where: {
        name: { contains: cleanQuery, mode: 'insensitive' }
      },
      take: 10,
      orderBy: { usageCount: 'desc' }
    });

    const reels = await this.prisma.reel.findMany({
      where: {
        OR: [
          { description: { contains: cleanQuery, mode: 'insensitive' } },
          { category: { contains: cleanQuery, mode: 'insensitive' } },
          { hashtags: { some: { hashtag: { name: { contains: cleanQuery, mode: 'insensitive' } } } } }
        ],
      },
      take: 10,
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
      },
    });

    return { users, reels, hashtags };
  }
}
