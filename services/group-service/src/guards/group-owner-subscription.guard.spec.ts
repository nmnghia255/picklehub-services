import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { GroupOwnerSubscriptionGuard } from './group-owner-subscription.guard';
import axios from 'axios';

jest.mock('axios');

describe('GroupOwnerSubscriptionGuard', () => {
  let guard: GroupOwnerSubscriptionGuard;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockPrisma: any = {
    group: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrisma as any;
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'SUBSCRIPTION_SERVICE_URL') return 'http://subscription-service';
        if (key === 'SERVICE_INTERNAL_TOKEN') return 'token';
        return null;
      }),
    } as any;

    guard = new GroupOwnerSubscriptionGuard(prisma, configService);
    jest.clearAllMocks();
  });

  const createMockContext = (
    method: string,
    params: any,
    headers: any = {},
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          params,
          headers,
        }),
      }),
    } as any;
  };

  it('allows non-modifying methods (GET) without verification', async () => {
    const context = createMockContext('GET', { groupId: 'g-123' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('allows modifying methods if no groupId or id is present', async () => {
    const context = createMockContext('POST', {});
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('throws NotFoundException if group is not found', async () => {
    const context = createMockContext('PATCH', { groupId: 'g-123' });
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.group.findUnique).toHaveBeenCalledWith({
      where: { id: 'g-123' },
    });
  });

  it('throws ForbiddenException if group owner subscription verification fails', async () => {
    const context = createMockContext('PATCH', { id: 'g-123' });
    mockPrisma.group.findUnique.mockResolvedValue({ id: 'g-123', createdById: 'owner-456' });
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { hasAccess: false },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/internal/subscriptions/verify'),
      expect.objectContaining({
        params: { userId: 'owner-456', planType: 'GROUP_OWNER' },
      }),
    );
  });

  it('allows request if group owner has active subscription', async () => {
    const context = createMockContext('DELETE', { groupId: 'g-123' });
    mockPrisma.group.findUnique.mockResolvedValue({ id: 'g-123', createdById: 'owner-456' });
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { hasAccess: true },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(axios.get).toHaveBeenCalled();
  });

  it('bypasses verify if internal token matches', async () => {
    const context = createMockContext('PATCH', { groupId: 'g-123' }, { 'x-internal-token': 'token' });
    
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });
});
