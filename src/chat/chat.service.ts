import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/chat.dto';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async getChats(userId: string) {
    return this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        chat: {
          include: {
            participants: {
              where: { userId: { not: userId } },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { chat: { lastMessageAt: 'desc' } },
    });
  }

  async getOrCreateChat(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error('Cannot create a chat with yourself');
    }

    // Find existing chat where both users are participants
    const existingChats = await this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        chat: {
          include: { participants: true },
        },
      },
    });

    const chat = existingChats.find(
      (cp) =>
        cp.chat.participants.some((p) => p.userId === targetUserId) &&
        !cp.chat.isGroup,
    );

    if (chat) {
      return chat.chat;
    }

    // Create new chat
    return this.prisma.chat.create({
      data: {
        isGroup: false,
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
    });
  }

  async getMessages(chatId: string) {
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async sendMessage(chatId: string, senderId: string, dto: SendMessageDto) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId,
        text: dto.text,
        mediaUrl: dto.mediaUrl,
      },
      include: {
        sender: { select: { id: true, username: true, avatar: true } },
      },
    });

    await this.prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessage: dto.text || 'Media',
        lastMessageAt: new Date(),
      },
    });

    await this.prisma.chatParticipant.updateMany({
      where: { chatId, userId: { not: senderId } },
      data: { unreadCount: { increment: 1 } },
    });

    if (this.chatGateway) {
      this.chatGateway.broadcastMessage(chatId, message);
    }

    return message;
  }

  async markRead(chatId: string, userId: string) {
    return this.prisma.chatParticipant.update({
      where: {
        chatId_userId: { chatId, userId },
      },
      data: { unreadCount: 0 },
    });
  }

  async markMessageRead(chatId: string, messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.chatId !== chatId)
      throw new Error('Message does not belong to this chat');

    // We only update if the current user is NOT the sender (i.e. they are the receiver reading it)
    if (message.senderId !== userId && message.status !== 'read') {
      return this.prisma.message.update({
        where: { id: messageId },
        data: { status: 'read' },
      });
    }

    return message;
  }

  async deleteChat(chatId: string, userId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!participant) throw new NotFoundException('Chat not found for user');

    // Deleting the chat will cascade delete messages and participants
    return this.prisma.chat.delete({ where: { id: chatId } });
  }

  async deleteMessage(chatId: string, messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new Error('You can only delete your own messages');
    }

    return this.prisma.message.delete({ where: { id: messageId } });
  }

  async reactToMessage(
    chatId: string,
    messageId: string,
    userId: string,
    emoji: string | null,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');

    let reactions: Record<string, string> = {};
    if (message.reactions && typeof message.reactions === 'object') {
      reactions = { ...(message.reactions as Record<string, string>) };
    }

    if (emoji) {
      reactions[userId] = emoji;
    } else {
      delete reactions[userId];
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { reactions },
    });
  }
}
