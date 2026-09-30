import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const authenticatedUserId = '550e8400-e29b-41d4-a716-446655440000';

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: authenticatedUserId };
    return true;
  }
}

describe('Calendar API (e2e)', () => {
  let app: INestApplication<App>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    process.env.SPORT_CENTER_SERVICE_URL = 'http://sport-center-service';
    process.env.EVENT_SERVICE_URL = 'http://event-service';
    process.env.MATCH_SERVICE_URL = 'http://match-service';
    process.env.TOURNAMENT_SERVICE_URL = 'http://tournament-service';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /me/calendar successfully aggregates items from all 4 microservices', async () => {
    mockedAxios.post.mockImplementation((url, data, config) => {
      if (url.includes('sport-center-service')) {
        return Promise.resolve({
          status: 200,
          data: [
            {
              id: 'booking-1',
              date: '2026-06-12T00:00:00.000Z',
              status: 'CONFIRMED',
              paymentStatus: 'PAID',
              center: {
                id: 'center-1',
                name: 'Kỳ Hòa Pickleball',
                address: 'Sư Vạn Hạnh, Q10',
              },
              bookingItems: [
                {
                  startTime: '08:00',
                  endTime: '09:00',
                  court: { name: 'Sân 1' },
                },
              ],
            },
          ],
        });
      }
      if (url.includes('event-service')) {
        return Promise.resolve({
          status: 200,
          data: [
            {
              id: 'social-1',
              title: 'Giao lưu cuối tuần',
              description: 'Vui vẻ là chính',
              startTime: '2026-06-12T10:00:00.000Z',
              endTime: '2026-06-12T12:00:00.000Z',
              locationName: 'Sân Kỳ Hòa',
              locationAddress: 'Q10',
              sportCenterId: 'center-1',
              creatorId: authenticatedUserId,
              status: 'UPCOMING',
            },
          ],
        });
      }
      if (url.includes('match-service')) {
        return Promise.resolve({
          status: 200,
          data: [
            {
              id: 'match-1',
              scheduledAt: '2026-06-12T14:00:00.000Z',
              courtId: 'court-1',
              status: 'PENDING_CONFIRM',
              teamA: [{ id: authenticatedUserId, name: 'User A', fullName: 'Nguyen Van A' }],
              teamB: [{ id: 'user-2', name: 'User B', fullName: 'Tran Van B' }],
              refereeId: null,
              court: { name: 'Sân 2', address: 'Q10' },
              scoreA: 11,
              scoreB: 9,
            },
          ],
        });
      }
      if (url.includes('tournament-service')) {
        return Promise.resolve({
          status: 200,
          data: {
            tournaments: [
              {
                id: 10,
                name: 'Vô Địch Kỳ Hòa',
                description: 'Giải đấu giao hữu',
                startDate: '2026-06-12T07:00:00.000Z',
                endDate: '2026-06-12T18:00:00.000Z',
                location: 'Sân Pickleball Kỳ Hòa',
                status: 'active',
              },
            ],
            matches: [
              {
                id: 20,
                time: '2026-06-12T16:00:00.000Z',
                tournamentId: 10,
                refereeId: null,
                status: 'scheduled',
                tournament: { name: 'Vô Địch Kỳ Hòa', location: 'Sân Pickleball Kỳ Hòa' },
                team1: {
                  player1Id: authenticatedUserId,
                  player1Name: 'Nguyen Van A',
                  player2Id: null,
                  player2Name: null,
                  name: 'Team A',
                },
                team2: {
                  player1Id: 'user-2',
                  player1Name: 'Tran Van B',
                  player2Id: null,
                  player2Name: null,
                  name: 'Team B',
                },
                score: '11-7',
              },
            ],
          },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const response = await request(app.getHttpServer())
      .get('/me/calendar?startDate=2026-06-01&endDate=2026-06-30')
      .expect(200);

    const { success, data } = response.body;
    expect(success).toBe(true);
    expect(data.warnings).toHaveLength(0);
    expect(data.items).toHaveLength(5);

    // Verify ordering
    const times = data.items.map((item: any) => item.startTime);
    const sortedTimes = [...times].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    expect(times).toEqual(sortedTimes);

    // Verify individual items mapping
    const bookingItem = data.items.find((item: any) => item.type === 'BOOKING');
    expect(bookingItem).toBeDefined();
    expect(bookingItem.title).toBe('Booking Sân 1 - Kỳ Hòa Pickleball');
    expect(bookingItem.role).toBe('PLAYER');
    expect(bookingItem.metadata.bookingId).toBe('booking-1');

    const socialItem = data.items.find((item: any) => item.type === 'SOCIAL_SESSION');
    expect(socialItem).toBeDefined();
    expect(socialItem.role).toBe('HOST');
    expect(socialItem.status).toBe('UPCOMING');

    const matchItem = data.items.find((item: any) => item.type === 'MATCH_PRACTICE');
    expect(matchItem).toBeDefined();
    expect(matchItem.role).toBe('PLAYER');
    expect(matchItem.metadata.opponentNames).toContain('Tran Van B');

    const tourItem = data.items.find((item: any) => item.type === 'TOURNAMENT');
    expect(tourItem).toBeDefined();
    expect(tourItem.status).toBe('LIVE'); // mapped from 'active'

    const tourMatchItem = data.items.find((item: any) => item.type === 'MATCH_TOURNAMENT');
    expect(tourMatchItem).toBeDefined();
    expect(tourMatchItem.title).toBe('Tournament Match Vô Địch Kỳ Hòa: Team A vs Team B');
    expect(tourMatchItem.metadata.opponentNames).toContain('Tran Van B');
  });

  it('GET /me/calendar survives partial service failures and reports warnings', async () => {
    mockedAxios.post.mockImplementation((url, data, config) => {
      if (url.includes('sport-center-service')) {
        return Promise.reject(new Error('Network error'));
      }
      if (url.includes('event-service')) {
        return Promise.resolve({
          status: 200,
          data: [],
        });
      }
      if (url.includes('match-service')) {
        return Promise.reject(new Error('Request failed with status code 500'));
      }
      if (url.includes('tournament-service')) {
        return Promise.resolve({
          status: 200,
          data: { tournaments: [], matches: [] },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const response = await request(app.getHttpServer())
      .get('/me/calendar')
      .expect(200);

    const { success, data } = response.body;
    expect(success).toBe(true);
    expect(data.items).toHaveLength(0);
    expect(data.warnings).toHaveLength(2);
    expect(data.warnings[0]).toContain('sport-center-service');
    expect(data.warnings[1]).toContain('match-service');
  });
});
