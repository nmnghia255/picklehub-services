import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  REQUIRED_SUBSCRIPTION_KEY,
  REQUIRED_SUBSCRIPTION_QUERY_PARAM_KEY,
  UserSubscriptionGuard,
} from './user-subscription.guard';
import axios from 'axios';

jest.mock('axios');

describe('UserSubscriptionGuard', () => {
  let guard: UserSubscriptionGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'SUBSCRIPTION_SERVICE_URL') return 'http://subscription-service';
        if (key === 'SERVICE_INTERNAL_TOKEN') return 'token';
        return null;
      }),
    } as any;

    guard = new UserSubscriptionGuard(reflector, configService);
    jest.clearAllMocks();
  });

  const createMockContext = (userId?: string, query?: any, headers?: any): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { userId } : undefined,
          query: query || {},
          headers: headers || {},
        }),
      }),
    } as any;
  };

  it('allows requests when no subscription metadata is required', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    const result = await guard.canActivate(createMockContext());

    expect(result).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when a required subscription has no authenticated user', async () => {
    mockRequiredPlan('GROUP_OWNER');

    await expect(guard.canActivate(createMockContext())).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException if user does not have active subscription', async () => {
    mockRequiredPlan('GROUP_OWNER');
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { hasAccess: false },
    });

    await expect(guard.canActivate(createMockContext('user-123'))).rejects.toThrow(ForbiddenException);
  });

  it('allows request if user has active subscription', async () => {
    mockRequiredPlan('GROUP_OWNER');
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { hasAccess: true },
    });

    const result = await guard.canActivate(createMockContext('user-123'));

    expect(result).toBe(true);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/internal/subscriptions/verify'),
      expect.objectContaining({
        params: { userId: 'user-123', planType: 'GROUP_OWNER' },
      }),
    );
  });

  it('bypasses query param checks if query param is missing and required', async () => {
    mockRequiredPlan('GROUP_OWNER', 'checkParam');

    const result = await guard.canActivate(createMockContext('user-123', {}));

    expect(result).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('enforces check if query param is present and required', async () => {
    mockRequiredPlan('GROUP_OWNER', 'checkParam');
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: { hasAccess: true },
    });

    const result = await guard.canActivate(createMockContext('user-123', { checkParam: 'true' }));

    expect(result).toBe(true);
    expect(axios.get).toHaveBeenCalled();
  });

  it('bypasses verify if internal token matches', async () => {
    mockRequiredPlan('GROUP_OWNER');

    const result = await guard.canActivate(
      createMockContext(undefined, {}, { 'x-internal-token': 'token' })
    );

    expect(result).toBe(true);
    expect(axios.get).not.toHaveBeenCalled();
  });

  function mockRequiredPlan(planType: string, queryParam?: string) {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) => {
      if (key === REQUIRED_SUBSCRIPTION_KEY) return planType;
      if (key === REQUIRED_SUBSCRIPTION_QUERY_PARAM_KEY) return queryParam;
      return undefined;
    });
  }
});
