import { Test, TestingModule } from '@nestjs/testing';
import { MatchService } from './match.service';
import { PrismaService } from '../prisma.service';
import { MatchStatus, MatchType, WinnerTeam } from '@prisma/client';
import axios from 'axios';
import { getQueueToken } from '@nestjs/bullmq';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MatchService - Livescore Integration (USAP Rules)', () => {
  let service: MatchService;
  let prisma: any;

  beforeEach(async () => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockResolvedValue({ status: 200, data: [] });
    mockedAxios.get.mockResolvedValue({ status: 200, data: [] });

    prisma = {
      match: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      matchScoreHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: getQueueToken('match-sync'),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MatchService>(MatchService);
  });

  it('scorePoint và undoPoint trả về đầy đủ object livescore theo luật USAP', async () => {
    const mockMatch = {
      id: 'match-1',
      status: MatchStatus.LIVE,
      matchType: MatchType.DOUBLES,
      startedAt: new Date(),
      finishedAt: null,
      teamA: ['player-a1', 'player-a2'],
      teamB: ['player-b1', 'player-b2'],
      courtId: 'court-1',
      refereeId: 'referee-1',
      createdById: 'creator-1',
    };

    prisma.match.findUnique.mockResolvedValue(mockMatch);
    prisma.match.update.mockImplementation((args: any) =>
      Promise.resolve({
        ...mockMatch,
        ...args.data,
      }),
    );

    // Điểm đầu tiên: Đội A thắng loạt bóng.
    const mockHistoryAfterPoint1 = [
      { id: 'h1', setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() },
    ];
    prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistoryAfterPoint1);

    const result = await service.scorePoint('match-1', 1, 'TEAM_A');

    // Kiểm tra cấu trúc livescore trả về
    expect(result.livescore).toBeDefined();
    expect(result.livescore.scoreCall).toBe('1 - 0 - 2');
    expect(result.livescore.servingTeam).toBe('TEAM_A');
    expect(result.livescore.serverNumber).toBe(2);
    expect(result.livescore.servingPlayerId).toBe('player-a1');
    expect(result.livescore.positions.teamA.right.id).toBe('player-a2'); // Giao bóng ghi điểm -> Đảo chỗ
    expect(result.livescore.positions.teamA.left?.id).toBe('player-a1');

    // Điểm thứ hai: Đội B thắng loạt bóng -> Fault Server 2 -> Side-out sang B.
    const mockHistoryAfterPoint2 = [
      { id: 'h1', setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() },
      { id: 'h2', setId: 1, scoringTeam: 'TEAM_B', timestamp: new Date() },
    ];
    prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistoryAfterPoint2);

    const result2 = await service.scorePoint('match-1', 1, 'TEAM_B');
    expect(result2.livescore.scoreCall).toBe('0 - 1 - 1'); // Điểm B (0) - Điểm A (1) - Lượt 1
    expect(result2.livescore.servingTeam).toBe('TEAM_B');
    expect(result2.livescore.serverNumber).toBe(1);
    expect(result2.livescore.servingPlayerId).toBe('player-b1'); // B1 đứng phải giao

    // Test hoàn tác (Undo)
    prisma.matchScoreHistory.findFirst.mockResolvedValue({ id: 'h2', setId: 1, scoringTeam: 'TEAM_B' });
    prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistoryAfterPoint1); // Sau khi xóa h2, chỉ còn h1

    const resultUndo = await service.undoPoint('match-1');
    expect(resultUndo.livescore.scoreCall).toBe('1 - 0 - 2'); // Trở lại trạng thái điểm 1
    expect(resultUndo.livescore.servingTeam).toBe('TEAM_A');
    expect(resultUndo.livescore.serverNumber).toBe(2);
  });

  it('hỗ trợ thể thức bestOfSets, pointsToWin động và chuyển sang PENDING_CONFIRM khi đủ set thắng (không chứa set 0-0 thừa)', async () => {
    const mockMatch = {
      id: 'match-5set-15pts',
      status: MatchStatus.LIVE,
      matchType: MatchType.SINGLES,
      bestOfSets: 5,
      pointsToWin: 15,
      startedAt: new Date(),
      finishedAt: null,
      teamA: ['player-a1'],
      teamB: ['player-b1'],
      courtId: 'court-1',
      refereeId: 'referee-1',
      createdById: 'creator-1',
    };

    prisma.match.findUnique.mockResolvedValue(mockMatch);

    let updatedData: any = null;
    prisma.match.update.mockImplementation((args: any) => {
      updatedData = args.data;
      return Promise.resolve({
        ...mockMatch,
        ...args.data,
      });
    });

    // Tạo lịch sử ghi điểm: A thắng 3 set liên tiếp (mỗi set 15 điểm)
    const history: any[] = [];
    for (let i = 0; i < 15; i++) {
      history.push({ id: `h1-${i}`, setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    // Set 2: B giao bóng trước nên quả đầu của A chỉ là Side-out (không điểm), cần 16 quả thắng để lên 15 điểm
    for (let i = 0; i < 16; i++) {
      history.push({ id: `h2-${i}`, setId: 2, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    // Set 3: điểm quyết định (quả thứ 15 để thắng set 3 và thắng cả trận)
    for (let i = 0; i < 14; i++) {
      history.push({ id: `h3-${i}`, setId: 3, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    prisma.matchScoreHistory.findMany.mockResolvedValue(history);

    // Phát quả quyết định của set 3
    const finalHistory = [
      ...history,
      { id: 'h3-final', setId: 3, scoringTeam: 'TEAM_A', timestamp: new Date() },
    ];
    prisma.matchScoreHistory.findMany.mockResolvedValue(finalHistory);

    const result = await service.scorePoint('match-5set-15pts', 3, 'TEAM_A');

    // Trận đấu phải chuyển sang trạng thái PENDING_CONFIRM, không được là CONFIRMED hay LIVE
    expect(result.status).toBe(MatchStatus.PENDING_CONFIRM);
    expect(result.scoreA).toBe(3); // A thắng 3 set
    expect(result.scoreB).toBe(0);

    // Sets array chỉ được dài đúng 3 sets, tuyệt đối không có set 4 và set 5 [0, 0] thừa
    expect(updatedData).toBeDefined();
    expect(updatedData.sets).toBeDefined();
    expect(updatedData.sets).toHaveLength(3); // Chỉ chứa 3 set thực tế
    expect(updatedData.sets).toEqual([
      [15, 0],
      [15, 0],
      [15, 0],
    ]);
  });

  it('hỗ trợ thể thức 1 set - chạm 21 điểm (1 - 21)', async () => {
    const mockMatch = {
      id: 'match-1set-21pts',
      status: MatchStatus.LIVE,
      matchType: MatchType.SINGLES,
      bestOfSets: 1,
      pointsToWin: 21,
      startedAt: new Date(),
      finishedAt: null,
      teamA: ['player-a1'],
      teamB: ['player-b1'],
      courtId: 'court-1',
      refereeId: 'referee-1',
      createdById: 'creator-1',
    };

    prisma.match.findUnique.mockResolvedValue(mockMatch);

    let updatedData: any = null;
    prisma.match.update.mockImplementation((args: any) => {
      updatedData = args.data;
      return Promise.resolve({ ...mockMatch, ...args.data });
    });

    const history: any[] = [];
    for (let i = 0; i < 20; i++) {
      history.push({ id: `h1-${i}`, setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    prisma.matchScoreHistory.findMany.mockResolvedValue(history);

    const finalHistory = [
      ...history,
      { id: 'h1-final', setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() },
    ];
    prisma.matchScoreHistory.findMany.mockResolvedValue(finalHistory);

    const result = await service.scorePoint('match-1set-21pts', 1, 'TEAM_A');
    expect(result.status).toBe(MatchStatus.PENDING_CONFIRM);
    expect(result.scoreA).toBe(1);
    expect(result.scoreB).toBe(0);
    expect(updatedData.sets).toHaveLength(1);
    expect(updatedData.sets).toEqual([[21, 0]]);
  });

  it('hỗ trợ thể thức 3 sets - chạm 15 điểm (3 - 15)', async () => {
    const mockMatch = {
      id: 'match-3set-15pts',
      status: MatchStatus.LIVE,
      matchType: MatchType.SINGLES,
      bestOfSets: 3,
      pointsToWin: 15,
      startedAt: new Date(),
      finishedAt: null,
      teamA: ['player-a1'],
      teamB: ['player-b1'],
      courtId: 'court-1',
      refereeId: 'referee-1',
      createdById: 'creator-1',
    };

    prisma.match.findUnique.mockResolvedValue(mockMatch);

    let updatedData: any = null;
    prisma.match.update.mockImplementation((args: any) => {
      updatedData = args.data;
      return Promise.resolve({ ...mockMatch, ...args.data });
    });

    const history: any[] = [];
    for (let i = 0; i < 15; i++) {
      history.push({ id: `h1-${i}`, setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    for (let i = 0; i < 15; i++) {
      history.push({ id: `h2-${i}`, setId: 2, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    prisma.matchScoreHistory.findMany.mockResolvedValue(history);

    const finalHistory = [
      ...history,
      { id: 'h2-final', setId: 2, scoringTeam: 'TEAM_A', timestamp: new Date() },
    ];
    prisma.matchScoreHistory.findMany.mockResolvedValue(finalHistory);

    const result = await service.scorePoint('match-3set-15pts', 2, 'TEAM_A');
    expect(result.status).toBe(MatchStatus.PENDING_CONFIRM);
    expect(result.scoreA).toBe(2);
    expect(result.scoreB).toBe(0);
    expect(updatedData.sets).toHaveLength(2);
    expect(updatedData.sets).toEqual([[15, 0], [15, 0]]);
  });

  it('hỗ trợ thể thức 5 sets - chạm 11 điểm (5 - 11)', async () => {
    const mockMatch = {
      id: 'match-5set-11pts',
      status: MatchStatus.LIVE,
      matchType: MatchType.SINGLES,
      bestOfSets: 5,
      pointsToWin: 11,
      startedAt: new Date(),
      finishedAt: null,
      teamA: ['player-a1'],
      teamB: ['player-b1'],
      courtId: 'court-1',
      refereeId: 'referee-1',
      createdById: 'creator-1',
    };

    prisma.match.findUnique.mockResolvedValue(mockMatch);

    let updatedData: any = null;
    prisma.match.update.mockImplementation((args: any) => {
      updatedData = args.data;
      return Promise.resolve({ ...mockMatch, ...args.data });
    });

    const history: any[] = [];
    for (let i = 0; i < 11; i++) {
      history.push({ id: `h1-${i}`, setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    for (let i = 0; i < 12; i++) {
      history.push({ id: `h2-${i}`, setId: 2, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    for (let i = 0; i < 10; i++) {
      history.push({ id: `h3-${i}`, setId: 3, scoringTeam: 'TEAM_A', timestamp: new Date() });
    }
    prisma.matchScoreHistory.findMany.mockResolvedValue(history);

    const finalHistory = [
      ...history,
      { id: 'h3-final', setId: 3, scoringTeam: 'TEAM_A', timestamp: new Date() },
    ];
    prisma.matchScoreHistory.findMany.mockResolvedValue(finalHistory);

    const result = await service.scorePoint('match-5set-11pts', 3, 'TEAM_A');
    expect(result.status).toBe(MatchStatus.PENDING_CONFIRM);
    expect(result.scoreA).toBe(3);
    expect(result.scoreB).toBe(0);
    expect(updatedData.sets).toHaveLength(3);
    expect(updatedData.sets).toEqual([[11, 0], [11, 0], [11, 0]]);
  });
});
