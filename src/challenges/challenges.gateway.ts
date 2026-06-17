import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/challenges' })
export class ChallengesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`[ChallengesGateway] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[ChallengesGateway] Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinChallengeRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() challengeId: string,
  ) {
    client.join(`challenge_${challengeId}`);
    console.log(`[ChallengesGateway] Client ${client.id} joined challenge_${challengeId}`);
  }

  @SubscribeMessage('leaveChallengeRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() challengeId: string,
  ) {
    client.leave(`challenge_${challengeId}`);
    console.log(`[ChallengesGateway] Client ${client.id} left challenge_${challengeId}`);
  }

  /**
   * Broadcasts when a new user joins the challenge
   */
  broadcastParticipantJoined(challengeId: string, count: number) {
    this.server.to(`challenge_${challengeId}`).emit('participant_joined', { count });
  }

  /**
   * Broadcasts when the leaderboard needs to refresh or score updates
   */
  broadcastLeaderboardUpdate(challengeId: string) {
    this.server.to(`challenge_${challengeId}`).emit('leaderboard_updated', { challengeId });
  }

  /**
   * Broadcasts challenge status changes (e.g. COMPLETED, PAUSED)
   */
  broadcastStatusChange(challengeId: string, status: string) {
    this.server.to(`challenge_${challengeId}`).emit('status_changed', { status });
  }
}
