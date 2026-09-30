import { Test, TestingModule } from '@nestjs/testing';
import { TournamentsService } from './tournaments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentStatus, EventType, Gender, RegistrationStatus } from '@prisma/client';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SportCenterClient } from '../clients/sport-center.client';
import { UserClient } from '../clients/user.client';
import { PosterService } from './poster/poster.service';
import { NotificationClient } from '../clients/notification.client';
import * as jwt from 'jsonwebtoken';

describe('TournamentsService', () => {
  let service: TournamentsService;
  let prisma: any;
  let scClient: any;
  let uClient: any;
  let posterServiceMock: any;

  const mockPrismaService: any = {
    tournament: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tournamentPoster: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    socialIntegration: {
      findMany: jest.fn(),
    },
    registration: {
      findMany: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    tournamentEvent: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    prize: {
      count: jest.fn(),
    },
    sponsor: {
      count: jest.fn(),
    },
    seed: {
      count: jest.fn(),
    },
    groupStageGroup: {
      count: jest.fn(),
    },
    match: {
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
  };

  const mockSportCenterClient = {
    getCenter: jest.fn(),
  };

  const mockUserClient = {
    getUserProfile: jest.fn(),
  };

  const mockPosterService = {
    generateMetadataHash: jest.fn(() => 'mockhash'),
    generatePoster: jest.fn(() => Buffer.from('mockbuffer')),
    uploadPoster: jest.fn(() => 'http://media-service/poster.png'),
  };

  const mockNotificationClient = {
    sendEmail: jest.fn(),
    sendInAppNotification: jest.fn(),
    getUserEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SportCenterClient,
          useValue: mockSportCenterClient,
        },
        {
          provide: UserClient,
          useValue: mockUserClient,
        },
        {
          provide: PosterService,
          useValue: mockPosterService,
        },
        {
          provide: NotificationClient,
          useValue: mockNotificationClient,
        },
      ],
    }).compile();

    service = module.get<TournamentsService>(TournamentsService);
    prisma = module.get<PrismaService>(PrismaService);
    scClient = module.get<SportCenterClient>(SportCenterClient);
    uClient = module.get<UserClient>(UserClient);
    posterServiceMock = module.get<PosterService>(PosterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Tournament',
      venue: 'Test Venue',
      startDate: '2026-07-15T08:00:00Z',
      endDate: '2026-07-17T18:00:00Z',
      registrationStartDate: '2026-07-01T08:00:00Z',
      registrationEndDate: '2026-07-10T18:00:00Z',
    };

    it('should successfully create a tournament', async () => {
      mockPrismaService.tournament.create.mockResolvedValue({ id: 1, ...createDto });

      const result = await service.create(createDto as any, 'organizer-1');

      expect(mockPrismaService.tournament.create).toHaveBeenCalled();
      expect(result.id).toEqual(1);
    });

    it('should throw BadRequestException if registrationStartDate is after registrationEndDate', async () => {
      const invalidDto = {
        ...createDto,
        registrationStartDate: '2026-07-11T08:00:00Z',
      };

      await expect(service.create(invalidDto as any, 'organizer-1')).rejects.toThrow(
        new BadRequestException('registrationStartDate cannot be after registrationEndDate'),
      );
    });

    it('should throw BadRequestException if registrationEndDate is after startDate', async () => {
      const invalidDto = {
        ...createDto,
        registrationEndDate: '2026-07-16T08:00:00Z',
      };

      await expect(service.create(invalidDto as any, 'organizer-1')).rejects.toThrow(
        new BadRequestException('registrationEndDate cannot be after startDate'),
      );
    });

    it('should throw BadRequestException if startDate is after endDate', async () => {
      const invalidDto = {
        ...createDto,
        startDate: '2026-07-18T08:00:00Z',
      };

      await expect(service.create(invalidDto as any, 'organizer-1')).rejects.toThrow(
        new BadRequestException('startDate cannot be after endDate'),
      );
    });
  });

  describe('update', () => {
    const existingTournament = {
      id: 1,
      name: 'Existing Tournament',
      venue: 'Existing Venue',
      startDate: new Date('2026-07-15T08:00:00Z'),
      endDate: new Date('2026-07-17T18:00:00Z'),
      registered: 5,
      status: TournamentStatus.draft,
      registrationStartDate: new Date('2026-07-01T08:00:00Z'),
      registrationEndDate: new Date('2026-07-10T18:00:00Z'),
    };

    beforeEach(() => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(existingTournament);
      mockPrismaService.registration.findMany.mockResolvedValue([]);
    });

    it('should successfully update tournament info', async () => {
      const updateDto = {
        name: 'Updated Tournament Name',
      };
      mockPrismaService.tournament.update.mockResolvedValue({ ...existingTournament, ...updateDto });

      const result = await service.update(1, updateDto as any);

      expect(mockPrismaService.tournament.update).toHaveBeenCalled();
      expect(result.name).toEqual('Updated Tournament Name');
    });

    it('should throw BadRequestException if next registrationStartDate is after next registrationEndDate', async () => {
      const updateDto = {
        registrationStartDate: '2026-07-12T08:00:00Z', // existing end is 2026-07-10
      };

      await expect(service.update(1, updateDto as any)).rejects.toThrow(
        new BadRequestException('registrationStartDate cannot be after registrationEndDate'),
      );
    });

    it('should throw BadRequestException if next registrationEndDate is after next startDate', async () => {
      const updateDto = {
        registrationEndDate: '2026-07-16T08:00:00Z', // existing start is 2026-07-15
      };

      await expect(service.update(1, updateDto as any)).rejects.toThrow(
        new BadRequestException('registrationEndDate cannot be after startDate'),
      );
    });
  });

  describe('findAll', () => {
    it('should apply search filter for name or venue with default active statuses', async () => {
      mockPrismaService.tournament.findMany.mockResolvedValue([]);
      mockPrismaService.tournament.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, 'Summer');

      expect(mockPrismaService.tournament.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['published', 'open_registration', 'closed_registration', 'in_progress'],
          },
          OR: [
            { name: { contains: 'Summer', mode: 'insensitive' } },
            { venue: { contains: 'Summer', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw ForbiddenException when querying draft status', async () => {
      await expect(service.findAll(1, 10, 'draft')).rejects.toThrow(
        new ForbiddenException('Cannot query draft tournaments publicly.'),
      );
    });
  });

  describe('findOne', () => {
    it('should return tournament details and calculate correct participantCount', async () => {
      const tournament = {
        id: 1,
        name: 'Tourney',
        events: [],
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(tournament);
      mockPrismaService.registration.findMany.mockResolvedValue([
        { playerId: 'p1', partnerId: null }, // Singles = 1
        { playerId: 'p2', partnerId: 'p3' }, // Doubles = 2
      ]);

      const result = await service.findOne(1);

      expect(mockPrismaService.tournament.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { events: true },
      });
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
        where: { tournamentId: 1, status: 'approved' },
        select: { playerId: true, partnerId: true },
      });
      expect(result.participantCount).toEqual(3);
    });
  });

  describe('discover', () => {
    const mockTournaments = [
      {
        id: 1,
        name: 'Ha Noi Summer Open',
        venue: 'Sân Pickleball Hà Nội, Ba Đình',
        startDate: new Date('2026-07-01'),
        status: TournamentStatus.open_registration,
        centerIds: ['center-A'],
        events: [
          { id: 10, skillRange: '3.0-4.0', gender: Gender.Mixed },
        ],
        registrations: [
          { playerId: 'friend-1', partnerId: null },
        ],
      },
      {
        id: 2,
        name: 'HCM Championship',
        venue: 'Sân PickleHub D1, Hồ Chí Minh',
        startDate: new Date('2026-07-05'),
        status: TournamentStatus.published,
        centerIds: ['center-B'],
        events: [
          { id: 20, skillRange: '4.5+', gender: Gender.Men },
        ],
        registrations: [],
      },
    ];

    it('should throw ForbiddenException if query.status is draft', async () => {
      await expect(service.discover({ status: 'draft' })).rejects.toThrow(
        new ForbiddenException('Cannot query draft tournaments publicly.'),
      );
    });

    it('should return paginated tournaments with guest sorting (open_registration first)', async () => {
      mockPrismaService.tournament.findMany.mockResolvedValue(mockTournaments);

      const result = await service.discover({ page: 1, limit: 10 });

      expect(result.data.length).toBe(2);
      expect(result.data[0].id).toBe(1); // open_registration is first
      expect(result.data[1].id).toBe(2); // published is second
      expect(result.meta.total).toBe(2);
    });

    it('should personalize scoring for authenticated users', async () => {
      // Mock decodes token and returns user ID 'user-1'
      const token = jwt.sign({ sub: 'user-1' }, 'secret');
      const authHeader = `Bearer ${token}`;

      // Mock user profile: gender female, rating 3.5, lives in Hanoi
      mockUserClient.getUserProfile.mockResolvedValue({
        id: 'user-1',
        gender: 'FEMALE',
        selfRating: 3.5,
        address: 'Quận Ba Đình, Hà Nội',
      });

      // Mock favorite centers: center-A is favorited
      mockSportCenterClient.getCenter.mockResolvedValue({
        data: [{ id: 'center-A' }],
      });

      mockPrismaService.tournament.findMany.mockResolvedValue(mockTournaments);

      const result = await service.discover({ page: 1, limit: 10 }, authHeader);

      expect(result.data.length).toBe(2);

      // Ha Noi Summer Open (ID 1):
      // - open_registration (+100)
      // - Hanoi city match (+150)
      // - center-A is favorite (+200)
      // - female matches ANY event, and 3.5 is within 3.0-4.0 skill range (+80)
      // Total score = 100 + 150 + 200 + 80 = 530.

      // - published (+50)
      // - no location match (Hanoi vs HCM)
      // - center-B is not favorite
      // - no friend match
      // - skill/gender mismatch (female does not match MALE event, and 3.5 does not match 4.5+)
      // Total score = 50.
      const tournament2 = result.data.find(t => t.id === 2) as any;
      expect(tournament2.personalizedScore).toBe(50);

      // Verification of sort order: tournament 1 has higher score, should be first
      expect(result.data[0].id).toBe(1);
    });

    it('should calculate score using GPS coordinates and Haversine formula', async () => {
      const token = jwt.sign({ sub: 'user-1' }, 'secret');
      const authHeader = `Bearer ${token}`;

      // User profile in Hanoi
      mockUserClient.getUserProfile.mockResolvedValue({
        id: 'user-1',
        gender: 'MALE',
        selfRating: 3.5,
        address: 'Hanoi, Vietnam',
        latitude: 21.0285,
        longitude: 105.8542,
      });

      mockSportCenterClient.getCenter.mockResolvedValue({ data: [] });
      mockPrismaService.team.findMany.mockResolvedValue([]);

      const mockTournamentsWithCoords = [
        {
          id: 1,
          name: 'Close Tournament Hanoi',
          venue: 'Hanoi Venue',
          startDate: new Date('2026-07-01'),
          status: TournamentStatus.published,
          latitude: 21.0300,
          longitude: 105.8500,
          events: [],
          registrations: [],
        },
        {
          id: 2,
          name: 'Far Tournament HCMC',
          venue: 'HCMC Venue',
          startDate: new Date('2026-07-02'),
          status: TournamentStatus.published,
          latitude: 10.7769,
          longitude: 106.7009,
          events: [],
          registrations: [],
        },
      ];

      mockPrismaService.tournament.findMany.mockResolvedValue(mockTournamentsWithCoords);

      const result = await service.discover({ page: 1, limit: 10 }, authHeader);

      expect(result.data.length).toBe(2);

      // Close Tournament Hanoi (ID 1):
      // - published (+50)
      // - coordinate distance is ~0.46 km (<= 15 km -> +150 score)
      // Total score = 50 + 150 = 200.
      const tournament1 = result.data.find(t => t.id === 1) as any;
      expect(tournament1.personalizedScore).toBe(200);

      // Far Tournament HCMC (ID 2):
      // - published (+50)
      // - coordinate distance is ~1138 km (no proximity score)
      // Total score = 50.
      const tournament2 = result.data.find(t => t.id === 2) as any;
      expect(tournament2.personalizedScore).toBe(50);
    });

    it('should fallback to guest flow when authenticated flow personalization throws an error', async () => {
      const token = jwt.sign({ sub: 'user-1' }, 'secret');
      const authHeader = `Bearer ${token}`;

      // Mock userProfile fetch to throw an error
      mockUserClient.getUserProfile.mockRejectedValue(new Error('User service down'));

      mockPrismaService.tournament.findMany.mockResolvedValue(mockTournaments);

      const result = await service.discover({ page: 1, limit: 10 }, authHeader);

      expect(result.data.length).toBe(2);
      expect(result.data[0].id).toBe(1); // open_registration is first (standard fallback/guest order)
      expect(result.data[0].personalizedScore).toBeNull(); // fallback has null score
    });
  });

  describe('updateStatus and metadata tests', () => {
    it('should allow valid transitions (draft -> published)', async () => {
      const draftTournament = {
        id: 1,
        status: TournamentStatus.draft,
        paymentBankName: 'Vietcombank',
        paymentAccountName: 'John Doe',
        paymentAccountNumber: '123456789',
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(draftTournament);
      mockPrismaService.tournamentEvent.count.mockResolvedValue(1);
      mockPrismaService.prize.count.mockResolvedValue(1);
      mockPrismaService.sponsor.count.mockResolvedValue(1);
      mockPrismaService.tournament.update.mockResolvedValue({ id: 1, status: TournamentStatus.published });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const res = await service.updateStatus(1, { status: TournamentStatus.published });
      expect(res.status).toEqual(TournamentStatus.published);
    });

    it('should block invalid transitions', async () => {
      const draftTournament = { id: 1, status: TournamentStatus.draft };
      mockPrismaService.tournament.findUnique.mockResolvedValue(draftTournament);

      await expect(
        service.updateStatus(1, { status: TournamentStatus.completed }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow open_registration to closed_registration when end date passed', async () => {
      const openTournament = {
        id: 1,
        status: TournamentStatus.open_registration,
        registrationEndDate: new Date(Date.now() - 10000),
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(openTournament);
      mockPrismaService.tournament.update.mockResolvedValue({ id: 1, status: TournamentStatus.closed_registration });
      mockPrismaService.auditLog.create.mockResolvedValue({});

      const res = await service.updateStatus(1, { status: TournamentStatus.closed_registration });
      expect(res.status).toEqual(TournamentStatus.closed_registration);
    });

    it('should reject draft to published if missing events, prizes, sponsors or payment info', async () => {
      // 1. Missing events
      let t = { id: 1, status: TournamentStatus.draft };
      mockPrismaService.tournament.findUnique.mockResolvedValue(t);
      mockPrismaService.tournamentEvent.count.mockResolvedValue(0);
      await expect(service.updateStatus(1, { status: TournamentStatus.published })).rejects.toThrow(
        /at least one event category/
      );

      // 2. Missing prizes
      mockPrismaService.tournamentEvent.count.mockResolvedValue(1);
      mockPrismaService.prize.count.mockResolvedValue(0);
      await expect(service.updateStatus(1, { status: TournamentStatus.published })).rejects.toThrow(
        /at least one prize configured/
      );

      // 3. Missing sponsors
      mockPrismaService.prize.count.mockResolvedValue(1);
      mockPrismaService.sponsor.count.mockResolvedValue(0);
      await expect(service.updateStatus(1, { status: TournamentStatus.published })).rejects.toThrow(
        /at least one sponsor added/
      );

      // 4. Missing payment details
      mockPrismaService.sponsor.count.mockResolvedValue(1);
      await expect(service.updateStatus(1, { status: TournamentStatus.published })).rejects.toThrow(
        /payment transfer details/
      );
    });

    it('should reject published to open_registration if start date not reached', async () => {
      const t = {
        id: 1,
        status: TournamentStatus.published,
        registrationStartDate: new Date(Date.now() + 100000),
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(t);
      await expect(service.updateStatus(1, { status: TournamentStatus.open_registration })).rejects.toThrow(
        /registration start date has not been reached/
      );
    });

    it('should reject open_registration to closed_registration if end date not reached', async () => {
      const t = {
        id: 1,
        status: TournamentStatus.open_registration,
        registrationEndDate: new Date(Date.now() + 100000),
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(t);
      await expect(service.updateStatus(1, { status: TournamentStatus.closed_registration })).rejects.toThrow(
        /registration end date has not been reached/
      );
    });

    it('should reject closed_registration to in_progress if conditions not met', async () => {
      // 1. Start date not reached
      let t = {
        id: 1,
        status: TournamentStatus.closed_registration,
        startDate: new Date(Date.now() + 100000),
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(t);
      await expect(service.updateStatus(1, { status: TournamentStatus.in_progress })).rejects.toThrow(
        /start date has not been reached/
      );

      // 2. No events
      t = {
        id: 1,
        status: TournamentStatus.closed_registration,
        startDate: new Date(Date.now() - 10000),
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(t);
      mockPrismaService.tournamentEvent.findMany.mockResolvedValue([]);
      await expect(service.updateStatus(1, { status: TournamentStatus.in_progress })).rejects.toThrow(
        /no events configured/
      );

      // 3. Seeding not generated or locked
      mockPrismaService.tournamentEvent.findMany.mockResolvedValue([{ id: 10, name: 'Event A' }]);
      mockPrismaService.team.count.mockResolvedValue(2);
      mockPrismaService.seed.count.mockImplementation(async ({ where }: any) => {
        if (where.status && where.status.not === 'locked') return 1; // unlocked seed exists
        return 2;
      });
      await expect(service.updateStatus(1, { status: TournamentStatus.in_progress })).rejects.toThrow(
        /locked/
      );

      // 4. Groups not drawn
      mockPrismaService.seed.count.mockImplementation(async ({ where }: any) => {
        if (where && where.status && where.status.not === 'locked') return 0;
        return 2;
      });
      mockPrismaService.groupStageGroup.count.mockResolvedValue(0);
      await expect(service.updateStatus(1, { status: TournamentStatus.in_progress })).rejects.toThrow(
        /Groups have not been drawn/
      );

      // 5. Matches not generated
      mockPrismaService.groupStageGroup.count.mockResolvedValue(2);
      mockPrismaService.match.count.mockResolvedValue(0);
      await expect(service.updateStatus(1, { status: TournamentStatus.in_progress })).rejects.toThrow(
        /Matches have not been generated/
      );

      // 6. Matches not scheduled
      mockPrismaService.match.count.mockImplementation(async ({ where }: any) => {
        if (where && where.OR) return 1; // unscheduled match exists
        return 10;
      });
      await expect(service.updateStatus(1, { status: TournamentStatus.in_progress })).rejects.toThrow(
        /not been scheduled/
      );
    });

    it('should reject in_progress to completed if there are pending matches', async () => {
      const t = { id: 1, status: TournamentStatus.in_progress };
      mockPrismaService.tournament.findUnique.mockResolvedValue(t);
      mockPrismaService.match.count.mockResolvedValue(1); // 1 pending match

      await expect(service.updateStatus(1, { status: TournamentStatus.completed })).rejects.toThrow(
        /still matches in progress or scheduled/
      );
    });

    it('should support updating description', async () => {
      const existing = {
        id: 1,
        name: 'Test',
        status: TournamentStatus.draft,
        startDate: new Date('2026-07-15T08:00:00Z'),
        endDate: new Date('2026-07-17T18:00:00Z'),
      };
      mockPrismaService.tournament.findUnique.mockResolvedValue(existing);
      mockPrismaService.tournament.update.mockResolvedValue({ ...existing, description: 'Updated Desc' });

      const res = await service.update(1, { description: 'Updated Desc' });
      expect(res.description).toEqual('Updated Desc');
    });
  });

  describe('getShareLink', () => {
    let originalFrontendUrl: string | undefined;

    beforeAll(() => {
      originalFrontendUrl = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://picklehub.vn';
    });

    afterAll(() => {
      process.env.FRONTEND_URL = originalFrontendUrl;
    });

    const mockTournament = {
      id: 1,
      name: 'Saigon Winter Open 2026',
      status: TournamentStatus.published,
    };

    it('should throw NotFoundException if tournament does not exist', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);
      await expect(service.getShareLink(999)).rejects.toThrow(NotFoundException);
    });

    it('should generate valid share URL with default UTM parameters', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(mockTournament);
      const res = await service.getShareLink(1);
      expect(res.shareUrl).toBe('https://picklehub.vn/tournaments/1?utm_source=user_share&utm_medium=native_share');
    });

    it('should generate valid share URL with custom UTM parameters', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(mockTournament);
      const res = await service.getShareLink(1, 'custom_src', 'custom_med');
      expect(res.shareUrl).toBe('https://picklehub.vn/tournaments/1?utm_source=custom_src&utm_medium=custom_med');
    });
  });

  describe('getPoster', () => {
    const mockTournament = {
      id: 1,
      name: 'Saigon Winter Open 2026',
      startDate: new Date('2026-08-20T08:00:00Z'),
      venue: 'Saigon Pickleball Arena, District 7',
      status: TournamentStatus.published,
    };

    it('should throw NotFoundException if tournament does not exist', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);
      await expect(service.getPoster(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if tournament is in draft status', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        ...mockTournament,
        status: TournamentStatus.draft,
      });
      await expect(service.getPoster(1)).rejects.toThrow(ForbiddenException);
    });

    it('should redirect if poster cache exists and matches hash', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(mockTournament);
      mockPrismaService.tournamentPoster.findUnique.mockResolvedValue({
        id: 1,
        imageUrl: 'http://cloudinary.com/poster.png',
        metadataHash: 'mockhash',
      });

      const result = await service.getPoster(1);
      expect(result).toEqual({
        type: 'redirect',
        url: 'http://cloudinary.com/poster.png',
      });
    });

    it('should generate and upload poster on cache miss', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(mockTournament);
      mockPrismaService.tournamentPoster.findUnique.mockResolvedValue(null);
      mockPrismaService.tournamentPoster.upsert.mockResolvedValue({});

      const result = await service.getPoster(1);
      expect(result.type).toBe('buffer');
      expect(mockPosterService.generatePoster).toHaveBeenCalled();
      expect(mockPosterService.uploadPoster).toHaveBeenCalled();
      expect(mockPrismaService.tournamentPoster.upsert).toHaveBeenCalled();
    });
  });
});




