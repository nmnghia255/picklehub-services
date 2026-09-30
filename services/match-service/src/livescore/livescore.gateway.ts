import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MatchService } from '../match/match.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { ScorePointDto } from './dto/score-point.dto';
import { UndoPointDto } from './dto/undo-point.dto';

/**
 * WebSocket Gateway for real-time Livescore updates.
 *
 * Clients connect and join a room per match:
 *   socket.emit('join-match', { matchId: '<uuid>' })
 *
 * Referees send score updates:
 *   socket.emit('score-point', { matchId: '<uuid>', setId: 1, scoringTeam: 'TEAM_A' })
 *   socket.emit('undo-point', { matchId: '<uuid>' })
 *
 * The server broadcasts score changes to that room:
 *   event: 'match-event'
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/matches',
})
export class LivescoreGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LivescoreGateway.name);

  constructor(private readonly matchService: MatchService) {}

  afterInit() {
    this.logger.log('LivescoreGateway initialised — ws://<host>/matches');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to a specific match room.
   * Event: 'join-match'  Payload: { matchId: string }
   */
  @SubscribeMessage('join-match')
  handleJoinMatch(
    @MessageBody() payload: { matchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `match_${payload.matchId}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} joined room ${room}`);
    return { joined: room };
  }

  /**
   * Client leaves a match room.
   * Event: 'leave-match'  Payload: { matchId: string }
   */
  @SubscribeMessage('leave-match')
  handleLeaveMatch(
    @MessageBody() payload: { matchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `match_${payload.matchId}`;
    void client.leave(room);
    this.logger.debug(`Client ${client.id} left room ${room}`);
    return { left: room };
  }

  /**
   * Submit a scored point. (Referee Only)
   * Event: 'score-point'
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('score-point')
  async handleScorePoint(
    @MessageBody() payload: ScorePointDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client as any).user?.sub;
    if (!userId) {
      throw new WsException('Unauthorized');
    }

    const match = await this.matchService.getRawMatch(payload.matchId);
    if (!match) {
      throw new WsException('Match not found');
    }

    if (match.refereeId !== userId) {
      throw new WsException('Forbidden: You are not the assigned referee for this match');
    }

    let updatedMatch: any;
    try {
      updatedMatch = await this.matchService.scorePoint(
        payload.matchId,
        payload.setId,
        payload.scoringTeam,
      );
    } catch (err: any) {
      // NestJS HttpException stores message in err.response.message or err.message
      const errMsg = err?.response?.message ?? err?.message ?? 'Failed to score point';
      throw new WsException(errMsg);
    }

    const response = {
      event: (updatedMatch.status === 'CONFIRMED' || updatedMatch.status === 'PENDING_CONFIRM') ? 'match-completed' : 'point-scored',
      matchId: updatedMatch.id,
      score: {
        scoreA: updatedMatch.scoreA,
        scoreB: updatedMatch.scoreB,
        sets: updatedMatch.sets,
        currentSetId: payload.setId,
        server: payload.scoringTeam,
        servingTeam: (updatedMatch as any).livescore?.servingTeam,
        servingPlayerId: (updatedMatch as any).livescore?.servingPlayerId,
        serverNumber: (updatedMatch as any).livescore?.serverNumber,
        scoreCall: (updatedMatch as any).livescore?.scoreCall,
        positions: (updatedMatch as any).livescore?.positions,
      },
      lastAction: {
        type: 'point',
        team: payload.scoringTeam,
        timestamp: new Date().toISOString(),
      },
      status: updatedMatch.status,
    };

    this.emitMatchUpdate(updatedMatch.id, response);
    return response;
  }

  /**
   * Undo the last scored point. (Referee Only)
   * Event: 'undo-point'
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('undo-point')
  async handleUndoPoint(
    @MessageBody() payload: UndoPointDto,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client as any).user?.sub;
    if (!userId) {
      throw new WsException('Unauthorized');
    }

    const match = await this.matchService.getRawMatch(payload.matchId);
    if (!match) {
      throw new WsException('Match not found');
    }

    if (match.refereeId !== userId) {
      throw new WsException('Forbidden: You are not the assigned referee for this match');
    }

    const updatedMatch = await this.matchService.undoPoint(payload.matchId);

    const setsArray = updatedMatch.sets as any[];
    const currentSetId = Array.isArray(setsArray) && setsArray.length > 0 ? setsArray.length : 1;

    const response = {
      event: 'point-undone',
      matchId: updatedMatch.id,
      score: {
        scoreA: updatedMatch.scoreA,
        scoreB: updatedMatch.scoreB,
        sets: updatedMatch.sets,
        currentSetId: currentSetId,
        server: null,
        servingTeam: (updatedMatch as any).livescore?.servingTeam,
        servingPlayerId: (updatedMatch as any).livescore?.servingPlayerId,
        serverNumber: (updatedMatch as any).livescore?.serverNumber,
        scoreCall: (updatedMatch as any).livescore?.scoreCall,
        positions: (updatedMatch as any).livescore?.positions,
      },
      lastAction: {
        type: 'undo',
        timestamp: new Date().toISOString(),
      },
      status: updatedMatch.status,
    };

    this.emitMatchUpdate(updatedMatch.id, response);
    return response;
  }

  /**
   * Called to broadcast a change to all room subscribers.
   * @param matchId The match UUID
   * @param data    Arbitrary payload (score, status change, etc.)
   */
  emitMatchUpdate(matchId: string, data: Record<string, unknown>) {
    const room = `match_${matchId}`;
    this.server.to(room).emit('match-event', data);
    this.logger.debug(`Emitted match-event to room ${room}: ${data['event']}`);
  }
}
