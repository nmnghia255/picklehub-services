import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentFavoriteService } from './equipment-favorite.service';
import { PrismaService } from '../../prisma.service';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { GroupMemberRole, FavoriteQuantityType, EquipmentCondition } from '@prisma/client';
import { UpsertFavoriteItemDto } from '../dto/upsert-favorite-item.dto';

describe('EquipmentFavoriteService', () => {
  let service: EquipmentFavoriteService;
  let prisma: PrismaService;

  const mockPrisma = {
    group: {
      findUnique: jest.fn(),
    },
    groupMember: {
      findUnique: jest.fn(),
    },
    groupEquipmentFavorite: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    groupEquipment: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentFavoriteService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EquipmentFavoriteService>(EquipmentFavoriteService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listFavorites', () => {
    it('should return favorite templates list if member requests', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-id',
        role: GroupMemberRole.MEMBER,
      });
      mockPrisma.groupEquipmentFavorite.findMany.mockResolvedValue([
        { id: 'fav-1', name: 'Ball', usageCount: 5 },
      ]);

      const result = await service.listFavorites('group-id', 'user-id');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Ball');
      expect(prisma.groupEquipmentFavorite.findMany).toHaveBeenCalledWith({
        where: { groupId: 'group-id', isActive: true },
        orderBy: { usageCount: 'desc' },
      });
    });

    it('should throw ForbiddenException if user is not member of group', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(service.listFavorites('group-id', 'user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateFavorite', () => {
    const dto: UpsertFavoriteItemDto = {
      name: 'New Paddle Name',
      defaultQuantity: 4,
      defaultCost: 1500000,
    };

    it('should throw ForbiddenException if user is not group owner', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-id',
        role: GroupMemberRole.MEMBER, // not owner
      });

      await expect(
        service.updateFavorite('fav-id', 'group-id', 'user-id', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if duplicate name exists in group', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-id',
        role: GroupMemberRole.OWNER,
      });
      mockPrisma.groupEquipmentFavorite.findFirst
        .mockResolvedValueOnce({ id: 'fav-id', name: 'Old Name' }) // for existing template
        .mockResolvedValueOnce({ id: 'other-id', name: 'New Paddle Name' }); // for duplicate name check

      await expect(
        service.updateFavorite('fav-id', 'group-id', 'user-id', dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should update template properties correctly if caller is owner', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-id',
        role: GroupMemberRole.OWNER,
      });
      mockPrisma.groupEquipmentFavorite.findFirst
        .mockResolvedValueOnce({ id: 'fav-id', name: 'Old Name' }) // for existing template
        .mockResolvedValueOnce(null); // no duplicate

      mockPrisma.groupEquipmentFavorite.update.mockResolvedValue({
        id: 'fav-id',
        name: 'New Paddle Name',
        defaultQuantity: 4,
        defaultCost: 1500000,
      });

      const result = await service.updateFavorite('fav-id', 'group-id', 'user-id', dto);

      expect(result.data.name).toBe('New Paddle Name');
      expect(prisma.groupEquipmentFavorite.update).toHaveBeenCalled();
    });
  });

  describe('deleteFavorite', () => {
    it('should delete favorite template successfully if caller is owner', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-id',
        role: GroupMemberRole.OWNER,
      });
      mockPrisma.groupEquipmentFavorite.findFirst.mockResolvedValue({
        id: 'fav-id',
        name: 'Joola Paddle',
      });

      const result = await service.deleteFavorite('fav-id', 'group-id', 'user-id');

      expect(result.message).toBe('Favorite equipment template deleted successfully');
      expect(prisma.groupEquipmentFavorite.delete).toHaveBeenCalledWith({
        where: { id: 'fav-id' },
      });
      expect(prisma.groupEquipment.updateMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group-id',
          name: 'Joola Paddle',
          deletedAt: null,
          isFavorite: true,
        },
        data: { isFavorite: false },
      });
    });
  });
});
