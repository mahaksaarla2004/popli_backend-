import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Optional
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ChatGateway } from '../chat/chat.gateway';
import {
  CreateStoryDto,
  ReactStoryDto,
  CreateHighlightDto,
} from './dto/stories.dto';

@Injectable()
export class StoriesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private notificationsGateway?: NotificationsGateway,
    @Optional() private chatGateway?: ChatGateway
  ) {}

  async createStory(creatorId: string, dto: CreateStoryDto) {
    // Expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    let layersData = dto.layersData;
    if (typeof layersData === 'string') {
      try {
        layersData = JSON.parse(layersData);
      } catch (e) {}
    }

    let rootOriginalStoryId = dto.originalStoryId || null;
    let rootOriginalOwnerId = dto.originalOwnerId || null;
    let rootOriginalOwnerUsername = dto.originalOwnerUsername || null;

    if (dto.originalStoryId) {
      // 1. Verify original story exists, not expired
      const originalStory = await this.prisma.story.findUnique({
        where: { id: dto.originalStoryId },
        include: { creator: true }
      });

      if (!originalStory) {
        throw new NotFoundException('Original story not found or has been deleted');
      }

      if (new Date() > originalStory.expiresAt) {
        throw new UnauthorizedException('Original story has expired and cannot be shared');
      }

      // Permissions check: Since sharing is triggered from mentions, and we don't have sharesAllowed natively, we just rely on the API unless isCloseFriends blocks it
      if (originalStory.isCloseFriends) {
         throw new UnauthorizedException('Cannot reshare a Close Friends story');
      }

      // Reshare Loop Protection: Always point to root original story
      if (originalStory.originalStoryId) {
        rootOriginalStoryId = originalStory.originalStoryId;
        rootOriginalOwnerId = originalStory.originalOwnerId;
        rootOriginalOwnerUsername = originalStory.originalOwnerUsername;
      } else {
        rootOriginalStoryId = originalStory.id;
        rootOriginalOwnerId = originalStory.creatorId;
        rootOriginalOwnerUsername = originalStory.creator.username;
      }
    }

    // Create the story and archive it immediately since we don't have a cron job
    const [story, archive] = await this.prisma.$transaction([
      this.prisma.story.create({
        data: {
          mediaUrl: dto.mediaUrl,
          mediaType: dto.mediaType,
          isCloseFriends: dto.isCloseFriends,
          repliesAllowed: dto.repliesAllowed,
          layersData,
          creatorId,
          expiresAt,
          originalStoryId: rootOriginalStoryId,
          originalOwnerId: rootOriginalOwnerId,
          originalOwnerUsername: rootOriginalOwnerUsername,
        },
        include: { creator: { select: { id: true, username: true, avatar: true, name: true } } }
      }),
      this.prisma.storyArchive.create({
        data: {
          creatorId,
          mediaUrl: dto.mediaUrl,
          mediaType: dto.mediaType,
          createdAt: new Date(),
          originalStoryId: rootOriginalStoryId,
          originalOwnerId: rootOriginalOwnerId,
          originalOwnerUsername: rootOriginalOwnerUsername,
        },
      }),
    ]);

    // Handle Mentions Async without blocking
    let finalMentionUserIds = dto.mentionedUserIds ? [...dto.mentionedUserIds] : [];
    if (rootOriginalOwnerId && rootOriginalOwnerId !== creatorId) {
      if (!finalMentionUserIds.includes(rootOriginalOwnerId)) {
        finalMentionUserIds.push(rootOriginalOwnerId);
      }
    }

    if ((dto.mentionedUsernames && dto.mentionedUsernames.length > 0) || finalMentionUserIds.length > 0) {
      this.processStoryMentions(story, creatorId, dto.mentionedUsernames, finalMentionUserIds).catch(err => {
        console.error('Failed to process story mentions:', err);
      });
    }

    return story;
  }

  private async processStoryMentions(story: any, creatorId: string, usernames?: string[], userIds?: string[]) {
    try {
      // Find valid users matching either ID or Username
      const validUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            { id: { in: userIds || [] } },
            { username: { in: usernames || [] } }
          ]
        },
        select: { id: true, username: true }
      });

      // Filter out duplicates and self-mentions
      const uniqueValidUserIds = Array.from(new Set(validUsers.map(u => u.id))).filter(id => id !== creatorId);

      for (const mentionedUserId of uniqueValidUserIds) {
        // Wrap each user process in its own try/catch to isolate failures
        try {
          // 1. Create Notification
          const notification = await this.prisma.notification.create({
            data: {
              userId: mentionedUserId,
              senderId: creatorId,
              senderAvatar: story.creator.avatar,
              type: 'STORY_MENTION' as any,
              postId: story.id, // Store story ID here
              title: 'Story Mention',
              body: `@${story.creator.username} mentioned you in their story.`,
            }
          });

          // 2. Emit Notification via Gateway (Optional chaining to avoid crashes if gateway is missing)
          if (this.notificationsGateway) {
            this.notificationsGateway.sendNotificationToUser(mentionedUserId, {
              ...notification,
              senderName: story.creator.name || story.creator.username,
            });
          }

          // 3. Find or Create Chat
          let chat = await this.prisma.chat.findFirst({
            where: {
              AND: [
                { participants: { some: { userId: creatorId } } },
                { participants: { some: { userId: mentionedUserId } } },
                { isGroup: false }
              ]
            }
          });

          if (!chat) {
            chat = await this.prisma.chat.create({
              data: {
                isGroup: false,
                participants: { 
                  create: [{ userId: creatorId }, { userId: mentionedUserId }] 
                }
              }
            });
          }

          // 4. Create DM Card Message
          const message = await this.prisma.message.create({
            data: {
              chatId: chat.id,
              senderId: creatorId,
              type: 'STORY_MENTION' as any,
              storyId: story.id,
              mediaUrl: story.mediaUrl,
              text: 'Mentioned you in their story',
            },
            include: { sender: { select: { id: true, username: true, avatar: true, name: true } } }
          });

          // Update Chat
          await this.prisma.chat.update({
            where: { id: chat.id },
            data: { lastMessage: 'Mentioned you in their story', lastMessageAt: new Date() }
          });

          await this.prisma.chatParticipant.updateMany({
            where: { chatId: chat.id, userId: mentionedUserId },
            data: { unreadCount: { increment: 1 } }
          });

          // 5. Emit Message via ChatGateway
          if (this.chatGateway) {
            this.chatGateway.server.to(chat.id).emit('new_message', message);
          }

        } catch (innerErr) {
          console.error(`Failed to process mention for user ${mentionedUserId}:`, innerErr);
        }
      }
    } catch (e) {
      console.error('Outer mention processing failed:', e);
    }
  }

  async getActiveStories(userId: string) {
    // Get the list of user IDs that this user follows
    const following = await this.prisma.follows.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });
    const followingIds = following.map((f: any) => f.followingId);
    
    // Include user's own ID
    const validCreatorIds = [...followingIds, userId];

    // Only return stories that haven't expired AND are from followed users or self
    return this.prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        creatorId: { in: validCreatorIds }
      },
      include: {
        creator: { select: { id: true, username: true, avatar: true } },
        viewers: { where: { userId }, select: { id: true } }, // checking if current user viewed
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markViewed(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { creatorId: true }
    });

    if (story && story.creatorId === userId) {
      return null;
    }

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
      },
    });
  }

  async interactWithStory(storyId: string, userId: string, dto: any) {
    // Upsert so a user can change their vote if needed, or prevent duplicates easily
    return this.prisma.storyInteraction.upsert({
      where: {
        storyId_layerId_userId: {
          storyId,
          layerId: dto.layerId,
          userId,
        }
      },
      update: {
        type: dto.type,
        value: dto.value,
      },
      create: {
        storyId,
        layerId: dto.layerId,
        userId,
        type: dto.type,
        value: dto.value,
      }
    });
  }

  async getStoryInteractions(storyId: string) {
    return this.prisma.storyInteraction.findMany({
      where: { storyId },
      include: {
        user: { select: { id: true, username: true, avatar: true, name: true } }
      }
    });
  }

  async getStoryViewers(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { creatorId: true },
    });

    if (!story) throw new NotFoundException('Story not found');
    if (story.creatorId !== userId) {
      throw new UnauthorizedException('Only the story creator can see viewers');
    }

    return this.prisma.storyViewer.findMany({
      where: { storyId },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true }
        }
      },
      orderBy: { viewedAt: 'desc' }
    });
  }

  async getArchivedStories(creatorId: string) {
    return this.prisma.storyArchive.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHighlight(creatorId: string, dto: CreateHighlightDto) {
    return this.prisma.storyHighlight.create({
      data: {
        ...dto,
        creatorId,
      },
    });
  }

  async getHighlights(creatorId: string) {
    return this.prisma.storyHighlight.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHighlightStories(highlightId: string) {
    const highlight = await this.prisma.storyHighlight.findUnique({
      where: { id: highlightId },
    });
    if (!highlight) throw new NotFoundException('Highlight not found');

    // Fetch the actual stories from the archive
    return this.prisma.storyArchive.findMany({
      where: {
        id: { in: highlight.storyIds }
      },
      // Preserve order from highlight.storyIds if possible, or order by createdAt
      orderBy: { createdAt: 'asc' }
    });
  }

  async deleteStory(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) throw new NotFoundException('Story not found');
    if (story.creatorId !== userId) {
      throw new UnauthorizedException('You can only delete your own stories');
    }

    return this.prisma.story.delete({
      where: { id: storyId },
    });
  }

  async deleteHighlight(highlightId: string, userId: string) {
    const highlight = await this.prisma.storyHighlight.findUnique({
      where: { id: highlightId },
    });
    if (!highlight) {
      throw new NotFoundException('Highlight not found');
    }
    if (highlight.creatorId !== userId) {
      throw new UnauthorizedException('You can only delete your own highlights');
    }

    return this.prisma.storyHighlight.delete({
      where: { id: highlightId },
    });
  }
}
