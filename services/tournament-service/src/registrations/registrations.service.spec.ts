import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { RegistrationStatus, TournamentStatus, EventType, Gender, EventStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DuprService } from './dupr.service';
import { NotificationClient } from '../clients/notification.client';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let prisma: any;

  const mockDuprService = {
    verifyOrFetchRating: jest.fn((duprId: string, fallbackRating: number) => Promise.resolve(fallbackRating)),
  };

  const mockPrismaService: any = {
    tournament: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tournamentEvent: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    registration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    team: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    financialTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DuprService,
          useValue: mockDuprService,
        },
        {
          provide: NotificationClient,
          useValue: {
            getUserEmail: jest.fn(async (id) => `mock-${id}@example.com`),
            sendEmail: jest.fn(async () => true),
          },
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateRegistrationDto = {
      playerId: 'player-1',
      playerName: 'Player One',
      playerRating: 4.0,
      playerGender: 'M',
      playerAge: 25,
      paymentStatus: 'pending',
    };

    const doublesDto: CreateRegistrationDto = {
      ...createDto,
      partnerId: 'partner-1',
      partnerName: 'Partner One',
      partnerGender: 'F',
      partnerAge: 23,
    };

    beforeEach(() => {
      // Mock tournament exists and open
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: 1,
        status: TournamentStatus.open_registration,
      });
      // Mock event exists
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        name: 'Mixed Doubles 4.0',
        type: EventType.Doubles,
        gender: Gender.Mixed,
        participants: 0,
        capacity: 16,
        entryFee: 100,
        status: EventStatus.open,
      });
      // Mock no duplicate registration
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      // Mock active registrations count to be empty
      mockPrismaService.registration.findMany.mockResolvedValue([]);
    });

    it('should successfully register a doubles team in Mixed event', async () => {
      mockPrismaService.registration.create.mockResolvedValue({ id: 99 });
      mockPrismaService.financialTransaction.create.mockResolvedValue({});

      const result = await service.create(1, 10, doublesDto);

      expect(mockPrismaService.registration.create).toHaveBeenCalled();
      expect(result.id).toEqual(99);
    });

    it('should throw BadRequestException if registering for Doubles event without partner details', async () => {
      await expect(service.create(1, 10, createDto)).rejects.toThrow(
        new BadRequestException('Partner information (ID, name, and gender) is required for Doubles events'),
      );
    });

    it('should throw BadRequestException if partner is provided in Singles event', async () => {
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Men,
        type: EventType.Singles,
        participants: 0,
        capacity: 16,
      });

      const invalidDto = {
        ...createDto,
        partnerId: 'partner-1',
        partnerName: 'Partner One',
      };

      await expect(service.create(1, 10, invalidDto)).rejects.toThrow(
        new BadRequestException('Partner information is not allowed for Singles events'),
      );
    });

    it('should throw BadRequestException if gender is not male in Men event', async () => {
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Men,
        type: EventType.Singles,
        participants: 0,
        capacity: 16,
      });

      const invalidDto = { ...createDto, playerGender: 'F' as const };

      await expect(service.create(1, 10, invalidDto)).rejects.toThrow(
        new BadRequestException('Only male players can register for Men\'s events'),
      );
    });

    it('should throw BadRequestException if partner is not male in Men event', async () => {
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Men,
        type: EventType.Doubles,
        participants: 0,
        capacity: 16,
      });

      const invalidDto = {
        ...createDto,
        partnerId: 'partner-1',
        partnerName: 'Partner One',
        partnerGender: 'F' as const,
      };

      await expect(service.create(1, 10, invalidDto)).rejects.toThrow(
        new BadRequestException('Partner must be male for Men\'s events'),
      );
    });

    it('should throw BadRequestException if gender is not female in Women event', async () => {
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Women,
        type: EventType.Singles,
        participants: 0,
        capacity: 16,
      });

      const invalidDto = { ...createDto, playerGender: 'M' as const };

      await expect(service.create(1, 10, invalidDto)).rejects.toThrow(
        new BadRequestException('Only female players can register for Women\'s events'),
      );
    });

    it('should throw BadRequestException if partners have same gender in Mixed event', async () => {
      const invalidDto = {
        ...createDto,
        partnerId: 'partner-1',
        partnerName: 'Partner One',
        partnerGender: 'M' as const,
      };

      await expect(service.create(1, 10, invalidDto)).rejects.toThrow(
        new BadRequestException('Mixed doubles requires partners of different genders'),
      );
    });

    it('should throw BadRequestException if male capacity limit reached in Mixed event', async () => {
      // Mock capacity limit is 2 teams (2 males, 2 females)
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Mixed,
        type: EventType.Doubles,
        participants: 0,
        capacity: 2,
        entryFee: 100,
      });

      // Mock 2 active male registrations exist
      mockPrismaService.registration.findMany.mockResolvedValue([
        { playerGender: 'M', partnerGender: 'F' }, // 1 male
        { playerGender: 'M', partnerGender: null }, // 1 male
      ]);

      // Attempt to register a 3rd male
      await expect(service.create(1, 10, doublesDto)).rejects.toThrow(
        new BadRequestException('Registration failed: Male capacity limit reached for this Mixed event.'),
      );
    });

    it('should throw BadRequestException if female capacity limit reached in Mixed event', async () => {
      // Mock capacity limit is 1 team (1 male, 1 female)
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Mixed,
        type: EventType.Doubles,
        participants: 0,
        capacity: 1,
        entryFee: 100,
      });

      // Mock 1 active female registration exists
      mockPrismaService.registration.findMany.mockResolvedValue([
        { playerGender: 'F', partnerGender: null },
      ]);

      const femaleDoublesDto = {
        ...doublesDto,
        playerGender: 'F' as const,
        partnerGender: 'M' as const,
      };

      // Attempt to register another female
      await expect(service.create(1, 10, femaleDoublesDto)).rejects.toThrow(
        new BadRequestException('Registration failed: Female capacity limit reached for this Mixed event.'),
      );
    });

    it('should throw BadRequestException if registration has not started yet', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: 1,
        status: TournamentStatus.open_registration,
        registrationStartDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        registrationEndDate: null,
      });

      await expect(service.create(1, 10, doublesDto)).rejects.toThrow(
        new BadRequestException('Registration for this tournament has not started yet.'),
      );
    });

    it('should throw BadRequestException if registration has closed', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({
        id: 1,
        status: TournamentStatus.open_registration,
        registrationStartDate: null,
        registrationEndDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      await expect(service.create(1, 10, doublesDto)).rejects.toThrow(
        new BadRequestException('Registration for this tournament has closed.'),
      );
    });
  });

  describe('update', () => {
    const existingRegistration = {
      id: 5,
      tournamentId: 1,
      eventId: 10,
      playerId: 'player-1',
      playerName: 'Player One',
      playerRating: 4.0,
      playerGender: 'M',
      playerAge: 25,
      paymentStatus: 'pending',
      status: RegistrationStatus.pending,
      partnerId: 'partner-1',
      partnerName: 'Partner One',
      partnerRating: 3.5,
      partnerGender: 'F',
      partnerAge: 23,
    };

    beforeEach(() => {
      mockPrismaService.registration.findFirst.mockResolvedValue(existingRegistration);
      mockPrismaService.tournamentEvent.findUnique.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Mixed,
        participants: 0,
        capacity: 16,
        type: EventType.Doubles,
      });
      mockPrismaService.registration.findMany.mockResolvedValue([]);
      mockPrismaService.team.create.mockResolvedValue({ id: 200 });
      mockPrismaService.tournamentEvent.update.mockResolvedValue({});
      mockPrismaService.tournament.update.mockResolvedValue({});
      mockPrismaService.registration.update.mockResolvedValue({ id: 5, status: RegistrationStatus.approved });
    });

    it('should approve registration and copy age/gender to team', async () => {
      const updateDto: UpdateRegistrationDto = { status: RegistrationStatus.approved };

      const result = await service.update(1, 5, updateDto);

      expect(mockPrismaService.team.create).toHaveBeenCalledWith({
        data: {
          tournamentId: 1,
          eventId: 10,
          player1Id: 'player-1',
          player1Name: 'Player One',
          player1Rating: 4.0,
          player1Age: 25,
          player1Gender: 'M',
          player2Id: 'partner-1',
          player2Name: 'Partner One',
          player2Rating: 3.5,
          player2Age: 23,
          player2Gender: 'F',
          avgRating: 3.75,
        },
      });
      expect(result.status).toEqual(RegistrationStatus.approved);
    });

    it('should throw BadRequestException if approved and gender capacity exceeded for Mixed event (when transitioning from rejected)', async () => {
      // Setup existing registration as rejected
      const rejectedRegistration = { ...existingRegistration, status: RegistrationStatus.rejected };
      mockPrismaService.registration.findFirst.mockResolvedValue(rejectedRegistration);

      mockPrismaService.tournamentEvent.findUnique.mockResolvedValue({
        id: 10,
        tournamentId: 1,
        gender: Gender.Mixed,
        participants: 0,
        capacity: 1,
        type: EventType.Doubles,
      });

      // Mock capacity filled
      mockPrismaService.registration.findMany.mockResolvedValue([
        { playerGender: 'M', partnerGender: 'F', status: RegistrationStatus.pending },
      ]);

      const updateDto: UpdateRegistrationDto = { status: RegistrationStatus.approved };

      await expect(service.update(1, 5, updateDto)).rejects.toThrow(
        new BadRequestException('Cannot approve: Male capacity limit reached for this Mixed event.'),
      );
    });
  });
});
