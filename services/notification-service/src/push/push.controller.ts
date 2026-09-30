import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiInternalServerErrorResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { PushService } from './push.service.js';
import { RegisterTokenDto } from './dto/register-token.dto.js';

@ApiTags('Push Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // ─── POST /api/push/tokens ────────────────────────────────────────────────

  @Post('tokens')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a device push token',
    description: `
Saves an Expo Push Token for the authenticated user so the backend can deliver
push notifications to this device.

**📱 Mobile guide:**
1. Call \`Notifications.getExpoPushTokenAsync({ projectId })\` from \`expo-notifications\`.
2. POST the result here right after login and on every app startup (tokens can rotate).
3. Re-registering the same token is **idempotent** — no duplicate rows are created.
4. Android: also call \`Notifications.setNotificationChannelAsync('default', ...)\` in your app.
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Token registered (or updated if it already existed).',
    schema: {
      example: {
        message: 'Push token registered successfully.',
        data: {
          id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
          userId: 'd3387cc5-cbd4-4832-a22e-d463bb2e2df1',
          token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
          platform: 'android',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid token format or platform value.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT Bearer token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async registerToken(@Req() req: any, @Body() dto: RegisterTokenDto) {
    const userId = req.user.userId as string;
    const data = await this.pushService.registerToken(userId, dto);
    return { message: 'Push token registered successfully.', data };
  }

  // ─── DELETE /api/push/tokens/:token ──────────────────────────────────────

  @Delete('tokens/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unregister a device push token',
    description: `
Removes an Expo Push Token for the authenticated user.

**📱 Mobile guide:** Call this on logout or when the user revokes notification permissions.
Use \`encodeURIComponent(token)\` when building the URL since the token contains brackets.
    `,
  })
  @ApiParam({
    name: 'token',
    description: 'Full Expo push token string (e.g. ExponentPushToken[xxx...])',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  @ApiResponse({
    status: 200,
    description: 'Token removed. Returns deleted count (0 if token was not found for this user).',
    schema: {
      example: {
        message: 'Push token unregistered successfully.',
        data: { deleted: 1 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT Bearer token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async unregisterToken(@Req() req: any, @Param('token') token: string) {
    const userId = req.user.userId as string;
    const data = await this.pushService.unregisterToken(userId, token);
    return { message: 'Push token unregistered successfully.', data };
  }

  // ─── GET /api/push/tokens ────────────────────────────────────────────────

  @Get('tokens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List my registered push tokens',
    description: 'Returns all active push tokens for the current user. Useful for debugging.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of registered tokens.',
    schema: {
      example: {
        message: 'Push tokens retrieved successfully.',
        data: [
          {
            token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
            platform: 'android',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT Bearer token.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async getMyTokens(@Req() req: any) {
    const userId = req.user.userId as string;
    const data = await this.pushService.getMyTokens(userId);
    return { message: 'Push tokens retrieved successfully.', data };
  }
}
