import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      // Get token from auth payload or query string
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) throw new Error('No token provided');

      // Verify token
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      client.data.user = decoded;
      client.join(`user_${decoded.sub}`);
      console.log(
        `Client connected and authenticated: ${client.id}, User: ${decoded.sub}, joined user_${decoded.sub}`,
      );
    } catch (error) {
      console.log(`Client connection failed: ${client.id}`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_chat')
  handleJoinChat(client: Socket, chatId: string) {
    client.join(chatId);
  }

  @SubscribeMessage('typing')
  handleTyping(
    client: Socket,
    payload: { chatId: string; isTyping: boolean; userId: string },
  ) {
    client.to(payload.chatId).emit('typing', payload);
  }

  // Called from ChatService after saving message to DB
  broadcastMessage(chatId: string, message: any) {
    this.server.to(chatId).emit('new_message', message);
  }
}
