import { Test } from '@nestjs/testing';
import { CenterService } from './center.service';
import { PrismaService } from '../prisma.service';
import { ConfigService } from '@nestjs/config';
import { GeocodingService } from '../geocoding/geocoding.service';

describe('CenterService - findActive Proximity Sorting', () => {
  let service: CenterService;
  let prisma: {
    $transaction: jest.Mock;
    sportCenter: {
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
    };
    favourite: {
      findMany: jest.Mock;
    };
    review: {
      groupBy: jest.Mock;
    };
  };
  let configService: {
    get: jest.Mock;
  };
  let geocodingService: {
    geocode: jest.Mock;
  };

  const mockCenters = [
    {
      id: 'center-1',
      name: 'PickleHub Downtown',
      address: '123 Main St, District 1, HCMC',
      latitude: '10.776900',
      longitude: '106.700900',
      createdAt: new Date(),
      services: [],
      products: [],
      _count: { courts: 5 },
    },
    {
      id: 'center-2',
      name: 'PickleHub Riverside',
      address: '456 River Ave, District 2, HCMC',
      latitude: '10.798300',
      longitude: '106.732400',
      createdAt: new Date(),
      services: [],
      products: [],
      _count: { courts: 8 },
    },
    {
      id: 'center-3',
      name: 'PickleHub Remote',
      address: 'No Coordinates Center',
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      services: [],
      products: [],
      _count: { courts: 2 },
    },
  ];

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
      sportCenter: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({}),
      },
      favourite: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      review: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'USER_SERVICE_URL') return 'http://user-service:8006';
        if (key === 'SERVICE_INTERNAL_TOKEN') return 'test-token';
        return defaultValue !== undefined ? defaultValue : null;
      }),
    };

    geocodingService = {
      geocode: jest.fn().mockResolvedValue({
        latitude: 10.7769,
        longitude: 106.7009,
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
      }),
    };

    // Mock global fetch
    global.fetch = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CenterService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: GeocodingService, useValue: geocodingService },
      ],
    }).compile();

    service = moduleRef.get(CenterService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findActive proximity sorting logic', () => {
    it('should return default order (createdAt desc) when no coordinates are provided', async () => {
      prisma.sportCenter.findMany.mockResolvedValue(mockCenters);
      prisma.sportCenter.count.mockResolvedValue(mockCenters.length);

      const result = await service.findActive({ limit: 10, offset: 0 }, 'user-1');

      expect(result.data).toHaveLength(3);
      expect(result.data[0].distance).toBeNull();
      expect(prisma.sportCenter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 0,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should sort by proximity when live coordinates are provided in query params', async () => {
      prisma.sportCenter.findMany.mockResolvedValue(mockCenters);

      // User coordinates close to Center 1 (Downtown): lat 10.77, lon 106.70
      const result = await service.findActive(
        { limit: 10, offset: 0, latitude: 10.775, longitude: 106.701 },
        'user-1',
      );

      expect(result.data).toHaveLength(3);
      // Downtown (center-1) should be first
      expect(result.data[0].id).toBe('center-1');
      expect(result.data[0].distance).toBeLessThan(result.data[1].distance);
      // Remote center without coords should be last (distance is null)
      expect(result.data[2].id).toBe('center-3');
      expect(result.data[2].distance).toBeNull();
    });

    it('should fallback to user profile coordinates when query params are missing', async () => {
      // Mock fetch resolving to user profile close to Center 2 (Riverside)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            latitude: 10.80,
            longitude: 106.73,
          },
        ]),
      });

      prisma.sportCenter.findMany.mockResolvedValue(mockCenters);

      const result = await service.findActive({ limit: 10, offset: 0 }, 'user-1');

      expect(global.fetch).toHaveBeenCalled();
      expect(result.data).toHaveLength(3);
      // Riverside (center-2) should be first as user profile location is close to it
      expect(result.data[0].id).toBe('center-2');
      expect(result.data[1].id).toBe('center-1');
      expect(result.data[2].id).toBe('center-3');
    });

    it('should fallback to default ordering when profile coordinates fetch fails or is null', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Internal Error',
      });

      prisma.sportCenter.findMany.mockResolvedValue(mockCenters);
      prisma.sportCenter.count.mockResolvedValue(mockCenters.length);

      const result = await service.findActive({ limit: 10, offset: 0 }, 'user-1');

      expect(global.fetch).toHaveBeenCalled();
      expect(result.data).toHaveLength(3);
      expect(result.data[0].distance).toBeNull();
    });

    it('should fallback to standard database pagination when personalization calculations throw an error', async () => {
      // Mock prisma.sportCenter.findMany to throw an error on the first call (inside personalized path)
      prisma.sportCenter.findMany
        .mockRejectedValueOnce(new Error('Simulated database error'))
        .mockResolvedValueOnce(mockCenters);
      prisma.sportCenter.count.mockResolvedValue(mockCenters.length);

      const result = await service.findActive(
        { limit: 10, offset: 0, latitude: 10.775, longitude: 106.701 },
        'user-1',
      );

      expect(result.data).toHaveLength(3);
      expect(result.data[0].distance).toBeNull();
    });
  });

  describe('create and update geocoding triggers', () => {
    it('should trigger geocoding on center creation if address is provided', async () => {
      const dto = {
        name: 'New Center',
        address: '123 Main St, District 1, HCMC',
        phone: '12345678',
        openTime: '08:00',
        closeTime: '22:00',
        basePrice: 50000,
        paymentAccountName: 'OWNER',
        paymentAccountNumber: '123456789',
        paymentBankName: 'Vietcombank',
      };

      prisma.sportCenter.count.mockResolvedValue(0);
      prisma.sportCenter.create.mockResolvedValue({ id: 'new-center-id', ...dto });

      const result = await service.create('owner-123', dto);

      expect(geocodingService.geocode).toHaveBeenCalledWith(dto.address);
      expect(prisma.sportCenter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            address: dto.address,
            latitude: 10.7769,
            longitude: 106.7009,
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('should trigger geocoding on update if address is updated', async () => {
      const dto = {
        address: 'New Updated St, District 1, HCMC',
      };

      prisma.sportCenter.findFirst.mockResolvedValue({ id: 'center-1', ownerId: 'owner-123' });
      prisma.sportCenter.update.mockResolvedValue({ id: 'center-1' });

      await service.update('center-1', dto);

      expect(geocodingService.geocode).toHaveBeenCalledWith(dto.address);
      expect(prisma.sportCenter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'center-1' },
          data: expect.objectContaining({
            address: dto.address,
            latitude: 10.7769,
            longitude: 106.7009,
          }),
        }),
      );
    });
  });
});
