import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchAll(query: string) {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
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

    const reels = await this.prisma.reel.findMany({
      where: {
        OR: [
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
      },
    });

    return { users, reels };
  }
}
