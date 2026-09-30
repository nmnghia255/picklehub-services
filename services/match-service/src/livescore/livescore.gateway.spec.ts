import { Test, TestingModule } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import { LivescoreGateway } from './livescore.gateway';
import { MatchService } from '../match/match.service';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { ScorePointDto } from './dto/score-point.dto';
import { UndoPointDto } from './dto/undo-point.dto';
import { MatchStatus } from '@prisma/client';

describe('LivescoreGateway', () => {
  let gateway: LivescoreGateway;
  let matchService: any;
  let mockSocket: any;

  beforeEach(async () => {
    matchService = {
      getRawMatch: jest.fn(),
      scorePoint: jest.fn(),
      undoPoint: jest.fn(),
    };

    mockSocket = {
      id: 'socket-client-1',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      user: {
        sub: 'referee-1',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LivescoreGateway,
        { provide: MatchService, useValue: matchService },
      ],
    })
      .overrideGuard(WsAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    gateway = module.get<LivescoreGateway>(LivescoreGateway);
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleJoinMatch', () => {
    it('should join the client to the match room and return joined status', () => {
      const payload = { matchId: 'm1' };
      const result = gateway.handleJoinMatch(payload, mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('match_m1');
      expect(result).toEqual({ joined: 'match_m1' });
    });
  });

  describe('handleLeaveMatch', () => {
    it('should leave the client from the match room and return left status', () => {
      const payload = { matchId: 'm1' };
      const result = gateway.handleLeaveMatch(payload, mockSocket);

      expect(mockSocket.leave).toHaveBeenCalledWith('match_m1');
      expect(result).toEqual({ left: 'match_m1' });
    });
  });

  describe('handleScorePoint', () => {
    it('should throw WsException if match is not found', async () => {
      matchService.getRawMatch.mockResolvedValue(null);

      const payload: ScorePointDto = {
        matchId: 'm1',
        setId: 1,
        scoringTeam: 'TEAM_A',
      };

      await expect(gateway.handleScorePoint(payload, mockSocket)).rejects.toThrow(
        WsException,
      );
    });

    it('should throw WsException if client user is not the referee', async () => {
      matchService.getRawMatch.mockResolvedValue({
        id: 'm1',
        refereeId: 'different-referee',
      });

      const payload: ScorePointDto = {
        matchId: 'm1',
        setId: 1,
        scoringTeam: 'TEAM_A',
      };

      await expect(gateway.handleScorePoint(payload, mockSocket)).rejects.toThrow(
        WsException,
      );
    });

    it('should process the point, update the score, and broadcast the change', async () => {
      const mockMatch = {
        id: 'm1',
        refereeId: 'referee-1',
        scoreA: 1,
        scoreB: 0,
        sets: [[1, 0]],
        status: MatchStatus.LIVE,
      };

      matchService.getRawMatch.mockResolvedValue(mockMatch);
      matchService.scorePoint.mockResolvedValue(mockMatch);

      const payload: ScorePointDto = {
        matchId: 'm1',
        setId: 1,
        scoringTeam: 'TEAM_A',
      };

      const result = await gateway.handleScorePoint(payload, mockSocket);

      expect(matchService.scorePoint).toHaveBeenCalledWith('m1', 1, 'TEAM_A');
      expect(gateway.server.to).toHaveBeenCalledWith('match_m1');
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'match-event',
        expect.objectContaining({
          event: 'point-scored',
          matchId: 'm1',
          status: MatchStatus.LIVE,
        }),
      );
      expect(result.event).toBe('point-scored');
    });
  });

  describe('handleUndoPoint', () => {
    it('should throw WsException if client user is not the referee', async () => {
      matchService.getRawMatch.mockResolvedValue({
        id: 'm1',
        refereeId: 'different-referee',
      });

      const payload: UndoPointDto = {
        matchId: 'm1',
      };

      await expect(gateway.handleUndoPoint(payload, mockSocket)).rejects.toThrow(
        WsException,
      );
    });

    it('should undo the point, recalculate, and broadcast the change', async () => {
      const mockMatch = {
        id: 'm1',
        refereeId: 'referee-1',
        scoreA: 0,
        scoreB: 0,
        sets: [[0, 0]],
        status: MatchStatus.LIVE,
      };

      matchService.getRawMatch.mockResolvedValue(mockMatch);
      matchService.undoPoint.mockResolvedValue(mockMatch);

      const payload: UndoPointDto = {
        matchId: 'm1',
      };

      const result = await gateway.handleUndoPoint(payload, mockSocket);

      expect(matchService.undoPoint).toHaveBeenCalledWith('m1');
      expect(gateway.server.to).toHaveBeenCalledWith('match_m1');
      expect(gateway.server.emit).toHaveBeenCalledWith(
        'match-event',
        expect.objectContaining({
          event: 'point-undone',
          matchId: 'm1',
        }),
      );
      expect(result.event).toBe('point-undone');
    });
  });
});
