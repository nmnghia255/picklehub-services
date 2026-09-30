import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GroupArchiveGuard } from './group-archive.guard';
import { PrismaService } from '../prisma.service';

describe('GroupArchiveGuard', () => {
  let guard: GroupArchiveGuard;
  let prisma: PrismaService;

  const mockPrisma: any = {
    group: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrisma as any;
    guard = new GroupArchiveGuard(prisma);
    jest.clearAllMocks();
  });

  const createMockContext = (method: string, url: string, params: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          url,
          params,
        }),
      }),
    } as any;
  };

  it('should allow GET requests on any group without checking archive status', async () => {
    const context = createMockContext('GET', '/api/groups/g-123', { id: 'g-123' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
  });

  it('should allow restore requests on an archived group', async () => {
    const context = createMockContext('PATCH', '/api/groups/g-123/restore', { groupId: 'g-123' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockPrisma.group.findUnique).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException if group does not exist', async () => {
    const context = createMockContext('PATCH', '/api/groups/g-123', { id: 'g-123' });
    mockPrisma.group.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if group is ARCHIVED', async () => {
    const context = createMockContext('PATCH', '/api/groups/g-123', { id: 'g-123' });
    mockPrisma.group.findUnique.mockResolvedValue({ id: 'g-123', status: 'ARCHIVED' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow requests on active groups', async () => {
    const context = createMockContext('PATCH', '/api/groups/g-123', { id: 'g-123' });
    mockPrisma.group.findUnique.mockResolvedValue({ id: 'g-123', status: 'ACTIVE' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
