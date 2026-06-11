import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

@ApiTags('chat')
@Controller('chats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'Get user chats' })
  getChats(@Req() req: any) {
    return this.chatService.getChats(req.user.id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a chat' })
  getMessages(@Param('id') chatId: string) {
    return this.chatService.getMessages(chatId);
  }

  @Post('user/:userId')
  @ApiOperation({ summary: 'Get or create chat with a user' })
  getOrCreateChat(@Param('userId') targetUserId: string, @Req() req: any) {
    return this.chatService.getOrCreateChat(req.user.id, targetUserId);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(
    @Param('id') chatId: string,
    @Req() req: any,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(chatId, req.user.id, dto);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark chat as read' })
  markRead(@Param('id') chatId: string, @Req() req: any) {
    return this.chatService.markRead(chatId, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a chat' })
  deleteChat(@Param('id') chatId: string, @Req() req: any) {
    return this.chatService.deleteChat(chatId, req.user.id);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Delete (unsend) a message' })
  deleteMessage(@Param('id') chatId: string, @Param('messageId') messageId: string, @Req() req: any) {
    return this.chatService.deleteMessage(chatId, messageId, req.user.id);
  }
}
