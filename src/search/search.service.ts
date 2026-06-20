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
        name: { contains: cleanQuery, mode: 'insensitive' },
      },
      take: 10,
      orderBy: { usageCount: 'desc' },
    });

    const reels = await this.prisma.reel.findMany({
      where: {
        OR: [
          { description: { contains: cleanQuery, mode: 'insensitive' } },
          { category: { contains: cleanQuery, mode: 'insensitive' } },
          {
            hashtags: {
              some: {
                hashtag: {
                  name: { contains: cleanQuery, mode: 'insensitive' },
                },
              },
            },
          },
        ],
      },
      take: 10,
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
      },
    });

    return { users, reels, hashtags };
  }

  async searchLocations(query: string) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10`,
        {
          headers: {
            'User-Agent': 'PopliApp/1.0',
          },
        },
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((item: any) => ({
        locationName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        placeId: item.place_id.toString(),
      }));
    } catch (error) {
      console.error('Location search failed:', error);
      return [];
    }
  }
}
