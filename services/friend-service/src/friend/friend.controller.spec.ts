import { Test, TestingModule } from '@nestjs/testing';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { AuthProxyGuard } from '../guards/auth-proxy.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { FriendQueryDto, SortOrder } from './dto/friend-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';

describe('FriendController', () => {
  let controller: FriendController;
  let service: FriendService;

  const mockFriendService = {
    sendRequest: jest.fn(),
    acceptRequest: jest.fn(),
    rejectRequest: jest.fn(),
    cancelRequest: jest.fn(),
    listIncomingRequests: jest.fn(),
    listOutgoingRequests: jest.fn(),
    listFriends: jest.fn(),
    removeFriend: jest.fn(),
    checkFriendship: jest.fn(),
    searchFriends: jest.fn(),
    searchUsers: jest.fn(),
  };

  const mockAuthProxyGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendController],
      providers: [
        {
          provide: FriendService,
          useValue: mockFriendService,
        },
        {
          provide: AuthProxyGuard,
          useValue: mockAuthProxyGuard,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FriendController>(FriendController);
    service = module.get<FriendService>(FriendService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sendRequest', () => {
    it('should call friendService.sendRequest', async () => {
      const dto: SendFriendRequestDto = { receiverId: 'target-123' };
      const req = { user: { sub: 'caller-123' } };
      mockFriendService.sendRequest.mockResolvedValue({ id: 'req-1' });

      const result = await controller.sendRequest(req, dto);

      expect(service.sendRequest).toHaveBeenCalledWith('caller-123', dto);
      expect(result).toEqual({ id: 'req-1' });
    });
  });

  describe('acceptRequest', () => {
    it('should call friendService.acceptRequest', async () => {
      const req = { user: { sub: 'caller-123' } };
      mockFriendService.acceptRequest.mockResolvedValue({ id: 'req-1', status: 'ACCEPTED' });

      const result = await controller.acceptRequest(req, 'req-1');

      expect(service.acceptRequest).toHaveBeenCalledWith('caller-123', 'req-1');
      expect(result).toEqual({ id: 'req-1', status: 'ACCEPTED' });
    });
  });

  describe('listFriends', () => {
    it('should call friendService.listFriends with query and return enriched data', async () => {
      const req = { user: { sub: 'caller-123' } };
      const query: FriendQueryDto = { page: 1, limit: 10, sortOrder: SortOrder.DESC };
      const expected = {
        data: [
          {
            id: 'f-1',
            userId: 'caller-123',
            friendId: 'friend-456',
            friend: { id: 'friend-456', name: 'Jane Doe', email: 'jane@example.com' },
            mutualFriendsCount: 2,
            createdAt: new Date(),
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockFriendService.listFriends.mockResolvedValue(expected);

      const result = await controller.listFriends(req, query);

      expect(service.listFriends).toHaveBeenCalledWith('caller-123', query);
      expect(result).toEqual(expected);
    });
  });

  describe('listIncoming', () => {
    it('should call friendService.listIncomingRequests and include sender profile', async () => {
      const req = { user: { sub: 'caller-123' } };
      const query: FriendQueryDto = { page: 1, limit: 5, sortOrder: SortOrder.ASC };
      const expected = {
        data: [
          {
            id: 'r-1',
            senderId: 'sender-999',
            sender: { id: 'sender-999', name: 'John', email: 'john@example.com' },
            receiverId: 'caller-123',
            receiver: null,
            status: 'PENDING',
            mutualFriendsCount: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
      };
      mockFriendService.listIncomingRequests.mockResolvedValue(expected);

      const result = await controller.listIncoming(req, query);

      expect(service.listIncomingRequests).toHaveBeenCalledWith('caller-123', query);
      expect(result).toEqual(expected);
    });
  });

  describe('listOutgoing', () => {
    it('should call friendService.listOutgoingRequests and include receiver profile', async () => {
      const req = { user: { sub: 'caller-123' } };
      const query: FriendQueryDto = { page: 2, limit: 10, sortOrder: SortOrder.DESC };
      const expected = {
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      };
      mockFriendService.listOutgoingRequests.mockResolvedValue(expected);

      const result = await controller.listOutgoing(req, query);

      expect(service.listOutgoingRequests).toHaveBeenCalledWith('caller-123', query);
      expect(result).toEqual(expected);
    });
  });

  describe('checkFriendship', () => {
    it('should return areFriends and mutualFriendsCount', async () => {
      const req = { user: { sub: 'caller-123' } };
      mockFriendService.checkFriendship.mockResolvedValue({ areFriends: true, mutualFriendsCount: 3 });

      const result = await controller.checkFriendship(req, 'target-456');

      expect(service.checkFriendship).toHaveBeenCalledWith('caller-123', 'target-456');
      expect(result).toEqual({ areFriends: true, mutualFriendsCount: 3 });
    });
  });

  describe('searchFriends', () => {
    it('should call friendService.searchFriends and return matching friends', async () => {
      const req = { user: { sub: 'caller-123' } };
      const query: SearchQueryDto = { q: 'jane', page: 1, limit: 10 };
      const expected = {
        data: [
          {
            friendId: 'friend-456',
            name: 'Jane Doe',
            email: 'jane@example.com',
            mutualFriendsCount: 2,
            friendsSince: new Date(),
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockFriendService.searchFriends.mockResolvedValue(expected);

      const result = await controller.searchFriends(req, query);

      expect(service.searchFriends).toHaveBeenCalledWith('caller-123', query);
      expect(result).toEqual(expected);
    });

    it('should return empty data when no friends match the search term', async () => {
      const req = { user: { sub: 'caller-123' } };
      const query: SearchQueryDto = { q: 'zzznomatch', page: 1, limit: 10 };
      const expected = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      mockFriendService.searchFriends.mockResolvedValue(expected);

      const result = await controller.searchFriends(req, query);

      expect(service.searchFriends).toHaveBeenCalledWith('caller-123', query);
      expect(result).toEqual(expected);
    });
  });

  describe('searchUsers', () => {
    it('should call friendService.searchUsers and return global user results', async () => {
      const req = { user: { sub: 'caller-123' } };
      const query: SearchQueryDto = { q: 'john', page: 1, limit: 10 };
      const expected = {
        data: [
          {
            id: 'user-789',
            name: 'John Smith',
            email: 'john@example.com',
            isFriend: false,
            mutualFriendsCount: 1,
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockFriendService.searchUsers.mockResolvedValue(expected);

      const result = await controller.searchUsers(req, query);

      expect(service.searchUsers).toHaveBeenCalledWith('caller-123', query);
      expect(result).toEqual(expected);
    });

    it('should flag isFriend=true for users who are already friends', async () => {
      const req = { user: { sub: 'caller-123' } };
      const query: SearchQueryDto = { q: 'jane', page: 1, limit: 10 };
      const expected = {
        data: [
          {
            id: 'friend-456',
            name: 'Jane Doe',
            email: 'jane@example.com',
            isFriend: true,
            mutualFriendsCount: 4,
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockFriendService.searchUsers.mockResolvedValue(expected);

      const result = await controller.searchUsers(req, query);

      expect(result.data[0].isFriend).toBe(true);
    });
  });
});
