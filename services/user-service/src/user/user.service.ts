import { Injectable, NotFoundException } from '@nestjs/common';
import { Gender, PreferredHand, User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import axios, { AxiosInstance } from 'axios';
import { GeocodingService } from '../geocoding/geocoding.service';


export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  error?: string;
  errors?: Record<string, string>;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  gender: Gender | null;
  selfRating: number;
  preferredHand: PreferredHand | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  dupr?: DuprInfo | null;
}

export type PublicUserProfile = UserProfile;

type UserProfileRecord = Pick<
  User,
  | 'id'
  | 'fullName'
  | 'avatarUrl'
  | 'bio'
  | 'gender'
  | 'selfRating'
  | 'preferredHand'
  | 'phoneNumber'
  | 'address'
  | 'city'
  | 'district'
  | 'latitude'
  | 'longitude'
>;

type DuprProfileRecord = {
  duprId: string;
  rating: number | null;
  singlesRating: number | null;
  doublesRating: number | null;
  lastSyncedAt: Date | null;
};

type UserProfileWithDupr = UserProfileRecord & {
  duprProfile: DuprProfileRecord | null;
};

type DuprInfo = {
  duprId: string;
  rating?: number | null;
  singlesRating?: number | null;
  doublesRating?: number | null;
  lastSyncedAt?: Date | null;
};

@Injectable()
export class UserService {
  private readonly authAxios: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocodingService: GeocodingService,
  ) {
    const authServiceUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:8001';
    const token = process.env.SERVICE_INTERNAL_TOKEN ?? '';

    this.authAxios = axios.create({
      baseURL: authServiceUrl,
      headers: {
        'x-internal-token': token,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  private successResponse<T>(message: string, data: T): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  private toUserProfile(
    profile: UserProfileWithDupr,
    email?: string,
    name?: string | null,
    avatarUrl?: string | null,
  ): UserProfile {
    return {
      id: profile.id,
      email,
      name,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl || avatarUrl || null,
      bio: profile.bio,
      gender: profile.gender,
      selfRating: profile.selfRating,
      preferredHand: profile.preferredHand,
      phoneNumber: profile.phoneNumber,
      address: profile.address,
      city: profile.city,
      district: profile.district,
      latitude: profile.latitude ? Number(profile.latitude) : null,
      longitude: profile.longitude ? Number(profile.longitude) : null,

      dupr: profile.duprProfile
        ? {
          duprId: profile.duprProfile.duprId,
          rating: profile.duprProfile.rating,
          singlesRating: profile.duprProfile.singlesRating,
          doublesRating: profile.duprProfile.doublesRating,
          lastSyncedAt: profile.duprProfile.lastSyncedAt,
        }
        : null,
    };
  }

  private async fetchAuthInfo(
    userId: string,
  ): Promise<{ email?: string; name?: string | null; avatarUrl?: string | null } | null> {
    try {
      const res = await this.authAxios.get<{ email?: string; name?: string | null; avatarUrl?: string | null }>(
        `/api/auth/internal/users/${userId}`,
        {
          validateStatus: () => true,
        },
      );
      if (res.status === 200 && res.data) {
        return {
          email: res.data.email,
          name: res.data.name,
          avatarUrl: res.data.avatarUrl,
        };
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  private async syncAuthInfo(
    userId: string,
    updates: { name?: string; avatarUrl?: string },
  ): Promise<void> {
    try {
      const res = await this.authAxios.patch(
        `/api/auth/internal/users/${userId}`,
        updates,
        {
          validateStatus: () => true,
        },
      );
      if (res.status !== 200) {
        console.error(
          `Failed to sync profile updates to auth-service: status ${res.status}`,
        );
      }
    } catch (e: any) {
      console.error(
        `Failed to sync profile updates to auth-service: ${e.message}`,
      );
    }
  }

  private shouldSync(lastSyncedAt?: Date | null): boolean {
    if (!lastSyncedAt) return true;

    const diff = Date.now() - new Date(lastSyncedAt).getTime();
    return diff > 1000 * 60 * 60; // 1h
  }

  private async ensureProfileExists(userId: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    });
  }

  async getMyProfile(
    userId: string,
    email?: string,
    name?: string | null,
    avatarUrl?: string | null,
  ): Promise<ApiResponse<UserProfile>> {
    await this.ensureProfileExists(userId);

    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        duprProfile: true,
      },
    });

    if (
      profile?.duprProfile &&
      this.shouldSync(profile.duprProfile.lastSyncedAt)
    ) {
      this.syncDuprProfile(userId).catch(() => { });
    }

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    let userEmail = email;
    let userName = name;
    let userAvatarUrl = avatarUrl;
    if (!userEmail) {
      const authInfo = await this.fetchAuthInfo(userId);
      if (authInfo) {
        userEmail = authInfo.email;
        userName = authInfo.name;
        userAvatarUrl = authInfo.avatarUrl;
      }
    } else if (userAvatarUrl === undefined) {
      const authInfo = await this.fetchAuthInfo(userId);
      if (authInfo) {
        userAvatarUrl = authInfo.avatarUrl;
      }
    }

    return this.successResponse(
      'User profile fetched successfully',
      this.toUserProfile(profile, userEmail, userName, userAvatarUrl),
    );
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<ApiResponse<UserProfile>> {
    await this.ensureProfileExists(userId);

    const currentProfile = await this.prisma.user.findUnique({ where: { id: userId } });
    const updateData: any = {};

    if (data.fullName !== undefined) {
      updateData.fullName = data.fullName;
    }

    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }

    if (data.bio !== undefined) {
      updateData.bio = data.bio;
    }

    if (data.gender !== undefined) {
      updateData.gender = data.gender;
    }

    if (data.selfRating !== undefined) {
      updateData.selfRating = data.selfRating;
    }

    if (data.preferredHand !== undefined) {
      updateData.preferredHand = data.preferredHand;
    }

    if (data.phoneNumber !== undefined) {
      updateData.phoneNumber = data.phoneNumber;
    }

    if (data.address !== undefined) {
      updateData.address = data.address;

      if (data.address && data.address !== currentProfile?.address) {
        const geocoded = await this.geocodingService.geocode(data.address);
        if (geocoded.city) updateData.city = geocoded.city;
        if (geocoded.district) updateData.district = geocoded.district;
        if (geocoded.latitude !== null) updateData.latitude = geocoded.latitude;
        if (geocoded.longitude !== null) updateData.longitude = geocoded.longitude;
      }
    }

    if (data.city !== undefined) {
      updateData.city = data.city;
    }

    if (data.district !== undefined) {
      updateData.district = data.district;
    }

    if (data.latitude !== undefined) {
      updateData.latitude = data.latitude;
    }

    if (data.longitude !== undefined) {
      updateData.longitude = data.longitude;
    }

    const syncUpdates: { name?: string; avatarUrl?: string } = {};
    if (data.fullName !== undefined) {
      syncUpdates.name = data.fullName;
    }
    if (data.avatarUrl !== undefined) {
      syncUpdates.avatarUrl = data.avatarUrl;
    }

    if (Object.keys(syncUpdates).length > 0) {
      await this.syncAuthInfo(userId, syncUpdates);
    }

    if (Object.keys(updateData).length === 0) {
      const authInfo = await this.fetchAuthInfo(userId);
      return this.getMyProfile(userId, authInfo?.email, authInfo?.name, authInfo?.avatarUrl);
    }

    const profile = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        duprProfile: true,
      },
    });

    const authInfo = await this.fetchAuthInfo(userId);

    return this.successResponse(
      'User profile updated successfully',
      this.toUserProfile(profile, authInfo?.email, authInfo?.name, authInfo?.avatarUrl),
    );
  }

  async getPublicProfile(
    targetUserId: string,
  ): Promise<ApiResponse<PublicUserProfile>> {
    const profile = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        duprProfile: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    const authInfo = await this.fetchAuthInfo(targetUserId);

    return this.successResponse(
      'Public user profile fetched successfully',
      this.toUserProfile(
        profile,
        authInfo?.email,
        authInfo?.name,
        authInfo?.avatarUrl,
      ),
    );
  }

  async linkDupr(userId: string, duprId: string) {
    await this.ensureProfileExists(userId);

    return this.prisma.duprProfile.upsert({
      where: { userId },
      update: {
        duprId,
        lastSyncedAt: null, // force sync lại
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        duprId,
      },
    });
  }

  async syncDuprProfile(userId: string) {
    const profile = await this.prisma.duprProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('DUPR not linked');
    }

    // TODO: fetch data from DUPR and update to duprProfile
    // const duprData = await this.fetchFromDupr(profile.duprId);

    // Mock data for demonstration purposes
    const duprData = {
      rating: 3.0,
      singles: 3.5,
      doubles: 2.5,
    };

    return this.prisma.duprProfile.update({
      where: { userId },
      data: {
        rating: duprData.rating,
        singlesRating: duprData.singles,
        doublesRating: duprData.doubles,
        lastSyncedAt: new Date(),
      },
    });
  }
}
