import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto, ReactStoryDto, CreateHighlightDto } from './dto/stories.dto';

@Injectable()
export class StoriesService {
  constructor(private prisma: PrismaService) {}

  async createStory(creatorId: string, dto: CreateStoryDto) {
    // Expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    let layersData = dto.layersData;
    if (typeof layersData === 'string') {
      try { layersData = JSON.parse(layersData); } catch (e) {}
    }
    
    return this.prisma.story.create({
      data: {
        ...dto,
        layersData,
        creatorId,
        expiresAt,
      }
    });
  }

  async getActiveStories(userId: string) {
    // Only return stories that haven't expired
    return this.prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
      },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        viewers: { where: { userId }, select: { id: true } } // checking if current user viewed
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markViewed(storyId: string, userId: string) {
    return this.prisma.storyViewer.upsert({
      where: { storyId_userId: { storyId, userId } },
      update: { viewedAt: new Date() },
      create: { storyId, userId },
    });
  }

  async reactToStory(storyId: string, userId: string, dto: ReactStoryDto) {
    return this.prisma.storyReaction.create({
      data: {
        storyId,
        userId,
        emoji: dto.emoji,
      }
    });
  }

  async getArchivedStories(creatorId: string) {
    return this.prisma.storyArchive.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createHighlight(creatorId: string, dto: CreateHighlightDto) {
    return this.prisma.storyHighlight.create({
      data: {
        ...dto,
        creatorId,
      }
    });
  }

  async getHighlights(creatorId: string) {
    return this.prisma.storyHighlight.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    if (story.creatorId !== userId) {
      throw new UnauthorizedException('You can only delete your own stories');
    }
    
    return this.prisma.story.delete({
      where: { id: storyId }
    });
  }
}
