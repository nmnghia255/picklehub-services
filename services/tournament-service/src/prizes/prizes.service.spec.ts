import { Test, TestingModule } from '@nestjs/testing';
import { PrizesService } from './prizes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrizeDto } from './dto/create-prize.dto';
import { UpdatePrizeDto } from './dto/update-prize.dto';
import { NotFoundException } from '@nestjs/common';

describe('PrizesService', () => {
  let service: PrizesService;
  let prisma: any;

  const mockPrismaService: any = {
    tournament: {
      findUnique: jest.fn(),
    },
    tournamentEvent: {
      findFirst: jest.fn(),
    },
    team: {
      findFirst: jest.fn(),
    },
    prize: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    financialTransaction: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrizesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PrizesService>(PrizesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreatePrizeDto = {
      name: 'Giải Nhất',
      rewardType: 'cash',
      value: 5000000,
      description: 'Cup + 5M VND',
      eventId: 10,
    };

    it('should create a prize successfully when tournament and event exist', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({ id: 10, tournamentId: 1 });
      mockPrismaService.prize.create.mockResolvedValue({ id: 100, ...createDto, tournamentId: 1 });

      const result = await service.create(1, createDto);

      expect(mockPrismaService.tournament.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.tournamentEvent.findFirst).toHaveBeenCalledWith({
        where: { id: 10, tournamentId: 1 },
      });
      expect(mockPrismaService.prize.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          tournamentId: 1,
        },
      });
      expect(result).toEqual({ id: 100, ...createDto, tournamentId: 1 });
    });

    it('should throw NotFoundException if tournament does not exist', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue(null);

      await expect(service.create(1, createDto)).rejects.toThrow(
        new NotFoundException('Tournament with ID 1 not found'),
      );
    });

    it('should throw NotFoundException if event does not exist in the tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue(null);

      await expect(service.create(1, createDto)).rejects.toThrow(
        new NotFoundException('Event with ID 10 not found in tournament 1'),
      );
    });
  });

  describe('findAll', () => {
    it('should return all prizes for a tournament', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.prize.findMany.mockResolvedValue([
        { id: 100, name: 'First Place', tournamentId: 1 },
      ]);

      const result = await service.findAll(1);

      expect(mockPrismaService.tournament.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPrismaService.prize.findMany).toHaveBeenCalledWith({
        where: { tournamentId: 1 },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([{ id: 100, name: 'First Place', tournamentId: 1 }]);
    });

    it('should filter by eventId if provided', async () => {
      mockPrismaService.tournament.findUnique.mockResolvedValue({ id: 1 });
      mockPrismaService.prize.findMany.mockResolvedValue([]);

      await service.findAll(1, 10);

      expect(mockPrismaService.prize.findMany).toHaveBeenCalledWith({
        where: { tournamentId: 1, eventId: 10 },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the prize if found and tournament ID matches', async () => {
      mockPrismaService.prize.findUnique.mockResolvedValue({ id: 100, tournamentId: 1 });

      const result = await service.findOne(1, 100);

      expect(mockPrismaService.prize.findUnique).toHaveBeenCalledWith({ where: { id: 100 } });
      expect(result).toEqual({ id: 100, tournamentId: 1 });
    });

    it('should throw NotFoundException if prize does not exist', async () => {
      mockPrismaService.prize.findUnique.mockResolvedValue(null);

      await expect(service.findOne(1, 100)).rejects.toThrow(
        new NotFoundException('Prize with ID 100 not found in tournament 1'),
      );
    });

    it('should throw NotFoundException if prize exists but tournament ID does not match', async () => {
      mockPrismaService.prize.findUnique.mockResolvedValue({ id: 100, tournamentId: 2 });

      await expect(service.findOne(1, 100)).rejects.toThrow(
        new NotFoundException('Prize with ID 100 not found in tournament 1'),
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdatePrizeDto = { name: 'Giải Nhất Cập Nhật', eventId: 20 };

    it('should update the prize successfully', async () => {
      mockPrismaService.prize.findUnique.mockResolvedValue({ id: 100, tournamentId: 1 });
      mockPrismaService.tournamentEvent.findFirst.mockResolvedValue({ id: 20, tournamentId: 1 });
      mockPrismaService.prize.update.mockResolvedValue({ id: 100, name: 'Giải Nhất Cập Nhật', tournamentId: 1 });

      const result = await service.update(1, 100, updateDto);

      expect(mockPrismaService.tournamentEvent.findFirst).toHaveBeenCalledWith({
        where: { id: 20, tournamentId: 1 },
      });
      expect(mockPrismaService.prize.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: updateDto,
      });
      expect(result.name).toEqual('Giải Nhất Cập Nhật');
    });
  });

  describe('remove', () => {
    it('should delete the prize and related financial transactions in a transaction', async () => {
      mockPrismaService.prize.findUnique.mockResolvedValue({ id: 100, tournamentId: 1 });
      mockPrismaService.prize.delete.mockResolvedValue({ id: 100 });

      const result = await service.remove(1, 100);

      expect(mockPrismaService.financialTransaction.deleteMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 1,
          description: {
            startsWith: 'Prize ID: 100 Award',
          },
        },
      });
      expect(mockPrismaService.prize.delete).toHaveBeenCalledWith({
        where: { id: 100 },
      });
      expect(result).toEqual({ id: 100 });
    });
  });

  describe('awardPrize', () => {
    beforeEach(() => {
      mockPrismaService.prize.findUnique.mockResolvedValue({
        id: 100,
        tournamentId: 1,
        name: 'First Place',
        rewardType: 'cash',
        value: 5000000,
      });
      mockPrismaService.team.findFirst.mockResolvedValue({ id: 200, tournamentId: 1 });
      mockPrismaService.prize.update.mockResolvedValue({ id: 100, winnerTeamId: 200 });
    });

    it('should award prize to a team and create a financial transaction if cash prize', async () => {
      const result = await service.awardPrize(1, 100, 200);

      expect(mockPrismaService.team.findFirst).toHaveBeenCalledWith({
        where: { id: 200, tournamentId: 1 },
      });
      expect(mockPrismaService.financialTransaction.deleteMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 1,
          description: {
            startsWith: 'Prize ID: 100 Award',
          },
        },
      });
      expect(mockPrismaService.financialTransaction.create).toHaveBeenCalledWith({
        data: {
          tournamentId: 1,
          description: 'Prize ID: 100 Award to Team: 200 - First Place',
          type: 'expense',
          amount: 5000000,
          status: 'completed',
        },
      });
      expect(mockPrismaService.prize.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { winnerTeamId: 200 },
      });
      expect(result).toEqual({ id: 100, winnerTeamId: 200 });
    });

    it('should not create a financial transaction if reward type is not cash', async () => {
      mockPrismaService.prize.findUnique.mockResolvedValue({
        id: 100,
        tournamentId: 1,
        name: 'First Place',
        rewardType: 'trophy',
        value: 0,
      });

      await service.awardPrize(1, 100, 200);

      expect(mockPrismaService.financialTransaction.create).not.toHaveBeenCalled();
    });

    it('should allow un-awarding by passing null winnerTeamId and delete transaction', async () => {
      mockPrismaService.prize.update.mockResolvedValue({ id: 100, winnerTeamId: null });

      const result = await service.awardPrize(1, 100, null);

      expect(mockPrismaService.team.findFirst).not.toHaveBeenCalled();
      expect(mockPrismaService.financialTransaction.deleteMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 1,
          description: {
            startsWith: 'Prize ID: 100 Award',
          },
        },
      });
      expect(mockPrismaService.financialTransaction.create).not.toHaveBeenCalled();
      expect(mockPrismaService.prize.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { winnerTeamId: null },
      });
      expect(result.winnerTeamId).toBeNull();
    });

    it('should throw NotFoundException if team does not exist in the tournament', async () => {
      mockPrismaService.team.findFirst.mockResolvedValue(null);

      await expect(service.awardPrize(1, 100, 200)).rejects.toThrow(
        new NotFoundException('Team with ID 200 not found in tournament 1'),
      );
    });
  });
});
