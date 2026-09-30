import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalTokenGuard } from '../guards/internal-token.guard';
import { UserService } from './user.service';

@ApiTags('internal')
@Controller('internal')
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(private readonly userService: UserService) {}

  @Post('batch')
  async getBatchProfiles(@Body() body: { userIds: string[] }) {
    if (!body.userIds || !Array.isArray(body.userIds)) {
      return [];
    }

    const uniqueIds = Array.from(new Set(body.userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return [];

    const profiles = await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const profile = await this.userService.getPublicProfile(id);
          return profile.data;
        } catch {
          return null;
        }
      })
    );

    return profiles.filter(Boolean);
  }
}
