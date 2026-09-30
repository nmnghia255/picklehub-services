/// <reference types="jest" />

import {
  INestApplication,
  CanActivate,
  ExecutionContext,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Gender, PreferredHand } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JwtAuthGuard } from '../src/guards/jwt-auth.guard';
import { PrismaService } from '../src/prisma.service';

const authenticatedUserId = '550e8400-e29b-41d4-a716-446655440000';
const otherUserId = '11111111-2222-3333-4444-555555555555';

interface UserRecord {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  gender: Gender | null;
  selfRating: number;
  preferredHand: PreferredHand | null;
  phoneNumber: string | null;
  address: string | null;
  duprProfile?: any;
}

interface PrismaUserDelegateMock {
  findUnique: (args: {
    where: { id: string };
    include?: Record<string, boolean>;
  }) => Promise<Record<string, unknown> | UserRecord | null>;
  create: (args: { data: { id: string } }) => Promise<UserRecord>;
  update: (args: {
    where: { id: string };
    data: Partial<Omit<UserRecord, 'id'>>;
    include?: Record<string, boolean>;
  }) => Promise<UserRecord>;
  upsert: (args: {
    where: { id: string };
    update: any;
    create: { id: string };
  }) => Promise<UserRecord>;
}

interface PrismaServiceMock {
  user: PrismaUserDelegateMock;
}

interface ValidationErrorResponse {
  message: string[] | string;
}

function createDefaultUser(id: string): UserRecord {
  return {
    id,
    fullName: null,
    avatarUrl: null,
    bio: null,
    gender: null,
    selfRating: 2.5,
    preferredHand: null,
    phoneNumber: null,
    address: null,
    duprProfile: null,
  };
}

function createPrismaMock(): {
  prismaMock: PrismaServiceMock;
  store: Map<string, UserRecord>;
} {
  const store = new Map<string, UserRecord>();

  const prismaMock: PrismaServiceMock = {
    user: {
      findUnique: ({ where, include }) => {
        const record = store.get(where.id);
        if (!record) {
          return Promise.resolve(null);
        }
        return Promise.resolve(record);
      },
      create: ({ data }) => {
        const record = createDefaultUser(data.id);
        store.set(data.id, record);
        return Promise.resolve(record);
      },
      update: ({ where, data, include }) => {
        const currentRecord = store.get(where.id);
        if (!currentRecord) {
          return Promise.reject(new Error('Profile must exist before update'));
        }
        const updatedRecord: UserRecord = {
          ...currentRecord,
          ...data,
        };
        store.set(where.id, updatedRecord);
        return Promise.resolve(updatedRecord);
      },
      upsert: ({ where, update, create }) => {
        let record = store.get(where.id);
        if (!record) {
          record = createDefaultUser(create.id);
          store.set(create.id, record);
        } else {
          record = { ...record, ...update };
          store.set(where.id, record);
        }
        return Promise.resolve(record);
      },
    },
  };

  return { prismaMock, store };
}

@Injectable()
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id: string } }>();
    request.user = { id: authenticatedUserId };
    return true;
  }
}

describe('User profile API (e2e)', () => {
  let app: INestApplication<App>;
  let prismaMock: PrismaServiceMock;
  let store: Map<string, UserRecord>;

  beforeEach(async () => {
    const mock = createPrismaMock();
    prismaMock = mock.prismaMock;
    store = mock.store;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('users');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /users/me creates and returns the authenticated profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'User profile fetched successfully',
      data: {
        id: authenticatedUserId,
        email: undefined,
        name: undefined,
        fullName: null,
        avatarUrl: null,
        bio: null,
        gender: null,
        selfRating: 2.5,
        preferredHand: null,
        phoneNumber: null,
        address: null,
        dupr: null,
      }
    });
    expect(prismaMock.user.upsert).toBeDefined();
    expect(store.get(authenticatedUserId)).toEqual({
      id: authenticatedUserId,
      fullName: null,
      avatarUrl: null,
      bio: null,
      gender: null,
      selfRating: 2.5,
      preferredHand: null,
      phoneNumber: null,
      address: null,
      duprProfile: null,
    });
  });

  it('PATCH /users/me updates only editable profile fields', async () => {
    store.set(authenticatedUserId, createDefaultUser(authenticatedUserId));

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', 'Bearer test-token')
      .send({
        fullName: 'Nguyen Van A',
        avatarUrl: 'https://cdn.example.com/avatars/user-123.png',
        bio: 'Competitive pickleball player.',
        gender: Gender.MALE,
        preferredHand: PreferredHand.RIGHT,
      })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'User profile updated successfully',
      data: {
        id: authenticatedUserId,
        email: undefined,
        name: undefined,
        fullName: 'Nguyen Van A',
        avatarUrl: 'https://cdn.example.com/avatars/user-123.png',
        bio: 'Competitive pickleball player.',
        gender: Gender.MALE,
        selfRating: 2.5,
        preferredHand: PreferredHand.RIGHT,
        phoneNumber: null,
        address: null,
        dupr: null,
      }
    });
  });

  it('PATCH /users/me rejects system-managed fields', async () => {
    store.set(authenticatedUserId, createDefaultUser(authenticatedUserId));

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', 'Bearer test-token')
      .send({
        skillLevel: 4.9,
      })
      .expect(400);

    const body = response.body as ValidationErrorResponse;
    expect(Array.isArray(body.message)).toBe(true);

    const messages = Array.isArray(body.message)
      ? body.message
      : [body.message];
    expect(messages.some((message) => message.includes('skillLevel'))).toBe(
      true,
    );
  });

  it('GET /users/:id returns a sanitized public profile', async () => {
    store.set(otherUserId, {
      id: otherUserId,
      fullName: 'Tran Thi B',
      avatarUrl: 'https://cdn.example.com/avatars/public-user.png',
      bio: 'Club player and coach.',
      gender: Gender.OTHER,
      selfRating: 3.75,
      preferredHand: PreferredHand.AMBIDEXTROUS,
      phoneNumber: null,
      address: null,
      duprProfile: null,
    });

    const response = await request(app.getHttpServer())
      .get(`/users/${otherUserId}`)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Public user profile fetched successfully',
      data: {
        id: otherUserId,
        email: undefined,
        name: undefined,
        fullName: 'Tran Thi B',
        avatarUrl: 'https://cdn.example.com/avatars/public-user.png',
        bio: 'Club player and coach.',
        gender: Gender.OTHER,
        selfRating: 3.75,
        preferredHand: PreferredHand.AMBIDEXTROUS,
        phoneNumber: null,
        address: null,
        dupr: null,
      }
    });
  });

  it('GET /users/:id returns 404 when the profile is missing', async () => {
    await request(app.getHttpServer())
      .get('/users/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
      .expect(404)
      .expect(({ body }) => {
        const errorBody = body as { message: string };
        expect(errorBody.message).toBe('User profile not found');
      });
  });
});
