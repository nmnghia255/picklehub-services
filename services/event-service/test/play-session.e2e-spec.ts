import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { GroupPlaySessionController } from '../src/social/group-play-session.controller';
import { PublicPlaySessionController } from '../src/social/social.controller';
import { PlaySessionAuthGuard } from '../src/social/guards/social-auth.guard';
import { PlaySessionService } from '../src/social/social.service';

class TestPlaySessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string; 'x-test-user-id'?: string };
      playSessionAuth?: { userId: string };
    }>();

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing/invalid JWT.');
    }

    if (authHeader === 'Bearer forbidden') {
      throw new ForbiddenException('Forbidden by test guard');
    }

    request.playSessionAuth = {
      userId: request.headers['x-test-user-id'] ?? 'test-user-id',
    };

    return true;
  }
}

describe('Play Session API (e2e)', () => {
  let app: INestApplication<App>;

  const playSessionServiceMock = {
    create: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    kick: jest.fn(),
    listParticipants: jest.fn(),
  };

  const authHeader = {
    Authorization: 'Bearer valid-token',
  };

  const sessionId = '3a0c173f-e79c-49a8-b67c-c4260db7ff89';
  const groupId = '84fd92fc-14f5-4f27-ac0a-27255eb9be55';
  const userId = '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47';
  const targetUserId = 'd3387cc5-cbd4-4832-a22e-d463bb2e2df1';

  beforeAll(async () => {
    const moduleFixtureBuilder = Test.createTestingModule({
      controllers: [PublicPlaySessionController, GroupPlaySessionController],
      providers: [
        {
          provide: PlaySessionService,
          useValue: playSessionServiceMock,
        },
      ],
    });

    moduleFixtureBuilder
      .overrideGuard(PlaySessionAuthGuard)
      .useClass(TestPlaySessionAuthGuard);

    const moduleFixture: TestingModule = await moduleFixtureBuilder.compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    playSessionServiceMock.create.mockResolvedValue({
      message: 'Play session created',
      data: {
        id: sessionId,
        title: 'Morning Session',
      },
    });

    playSessionServiceMock.list.mockResolvedValue({
      message: 'Successfully retrieved play sessions',
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    });

    playSessionServiceMock.get.mockResolvedValue({
      message: 'Play session fetched',
      data: {
        id: sessionId,
      },
    });

    playSessionServiceMock.update.mockResolvedValue({
      message: 'Play session updated',
      data: {
        id: sessionId,
        title: 'Updated Session',
      },
    });

    playSessionServiceMock.remove.mockResolvedValue({
      message: 'Play session deleted',
    });

    playSessionServiceMock.join.mockResolvedValue({
      message: 'Join request submitted and pending host approval',
      data: {
        id: 'participant-id',
        playSessionId: sessionId,
        userId,
        status: 'PENDING',
      },
    });

    playSessionServiceMock.leave.mockResolvedValue({
      message: 'Left successfully',
      data: {
        playSessionId: sessionId,
        userId,
        leftWaitlist: false,
        promotedUserIds: [],
      },
    });

    playSessionServiceMock.kick.mockResolvedValue({
      message: 'Participant removed',
      data: {
        playSessionId: sessionId,
        userId: targetUserId,
        promotedUserIds: [],
      },
    });

    playSessionServiceMock.listParticipants.mockResolvedValue({
      message: 'Participants fetched',
      data: [],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Layer 1: smoke CRUD happy path', () => {
    it('POST /api/play-sessions should create session', async () => {
      await request(app.getHttpServer())
        .post('/api/play-sessions')
        .set(authHeader)
        .set('x-test-user-id', userId)
        .send({
          title: 'Morning Session',
          description: 'Friendly games',
          startTime: '2026-05-01T07:00:00.000Z',
          endTime: '2026-05-01T09:00:00.000Z',
        })
        .expect(201)
        .expect({
          message: 'Play session created',
          data: {
            id: sessionId,
            title: 'Morning Session',
          },
        });

      expect(playSessionServiceMock.create).toHaveBeenCalledTimes(1);
    });

    it('GET /api/play-sessions should list sessions', async () => {
      await request(app.getHttpServer())
        .get('/api/play-sessions')
        .set(authHeader)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Successfully retrieved play sessions');
          expect(Array.isArray(res.body.data)).toBe(true);
        });

      expect(playSessionServiceMock.list).toHaveBeenCalledTimes(1);
    });

    it('GET /api/play-sessions/:id should fetch detail', async () => {
      await request(app.getHttpServer())
        .get(`/api/play-sessions/${sessionId}`)
        .set(authHeader)
        .expect(200)
        .expect({
          message: 'Play session fetched',
          data: {
            id: sessionId,
          },
        });

      expect(playSessionServiceMock.get).toHaveBeenCalledTimes(1);
    });

    it('PATCH /api/play-sessions/:id should update session', async () => {
      await request(app.getHttpServer())
        .patch(`/api/play-sessions/${sessionId}`)
        .set(authHeader)
        .send({ title: 'Updated Session' })
        .expect(200)
        .expect({
          message: 'Play session updated',
          data: {
            id: sessionId,
            title: 'Updated Session',
          },
        });

      expect(playSessionServiceMock.update).toHaveBeenCalledTimes(1);
    });

    it('DELETE /api/play-sessions/:id should delete session', async () => {
      await request(app.getHttpServer())
        .delete(`/api/play-sessions/${sessionId}`)
        .set(authHeader)
        .expect(200)
        .expect({
          message: 'Play session deleted',
        });

      expect(playSessionServiceMock.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Layer 2: auth / forbidden / not found', () => {
    it('returns 401 when missing bearer token', async () => {
      await request(app.getHttpServer())
        .get(`/api/play-sessions/${sessionId}`)
        .expect(401);
    });

    it('returns 403 when guard denies group route', async () => {
      await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/play-sessions/${sessionId}`)
        .set('Authorization', 'Bearer forbidden')
        .expect(403);
    });

    it('returns 404 when service throws not found', async () => {
      playSessionServiceMock.get.mockRejectedValueOnce(
        new NotFoundException('Play session not found'),
      );

      await request(app.getHttpServer())
        .get(`/api/play-sessions/${sessionId}`)
        .set(authHeader)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Play session not found');
        });
    });
  });

  describe('Layer 3: join / leave / kick edge cases', () => {
    it('join returns WAITLISTED response when session is full', async () => {
      playSessionServiceMock.join.mockResolvedValueOnce({
        message: 'Play session is full. You have been added to the waitlist',
        data: {
          id: 'participant-id',
          playSessionId: sessionId,
          userId,
          status: 'WAITLISTED',
          requestedSlots: 2,
        },
      });

      await request(app.getHttpServer())
        .post(`/api/play-sessions/${sessionId}/join`)
        .set(authHeader)
        .set('x-test-user-id', userId)
        .send({ guestsCount: 1 })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('added to the waitlist');
          expect(res.body.data.status).toBe('WAITLISTED');
        });

      expect(playSessionServiceMock.join).toHaveBeenCalledTimes(1);
    });

    it('leave returns 403 when cutoff rule blocks leaving', async () => {
      playSessionServiceMock.leave.mockRejectedValueOnce(
        new ForbiddenException('Cannot leave within 2 hours before start time'),
      );

      await request(app.getHttpServer())
        .delete(`/api/play-sessions/${sessionId}/participants/me`)
        .set(authHeader)
        .set('x-test-user-id', userId)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toBe('Cannot leave within 2 hours before start time');
        });
    });

    it('kick returns 400 when trying to kick self', async () => {
      playSessionServiceMock.kick.mockRejectedValueOnce(
        new BadRequestException('Use leave endpoint to remove yourself'),
      );

      await request(app.getHttpServer())
        .delete(`/api/play-sessions/${sessionId}/participants/${userId}`)
        .set(authHeader)
        .set('x-test-user-id', userId)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Use leave endpoint to remove yourself');
        });
    });

    it('kick returns 404 when target participant is not found', async () => {
      playSessionServiceMock.kick.mockRejectedValueOnce(
        new NotFoundException('Participant not found'),
      );

      await request(app.getHttpServer())
        .delete(`/api/groups/${groupId}/play-sessions/${sessionId}/participants/${targetUserId}`)
        .set(authHeader)
        .set('x-test-user-id', userId)
        .expect(404)
        .expect((res) => {
          expect(res.body.message).toBe('Participant not found');
        });
    });

    it('returns 400 when route UUID is invalid', async () => {
      await request(app.getHttpServer())
        .delete('/api/play-sessions/invalid-id/participants/me')
        .set(authHeader)
        .expect(400);
    });
  });
});
