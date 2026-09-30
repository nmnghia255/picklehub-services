import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiQuery,
} from '@nestjs/swagger';
import { PlanType } from '@prisma/client';
import { SubscriptionService } from './subscription.service';
import { VnpayIpnParams } from './vnpay.helper';
import { InternalGuard } from '../guards/internal.guard';
import { UseGuards } from '@nestjs/common';

// ─── VNPay IPN Webhook (called by VNPay servers, no JWT needed) ───────────────

@ApiTags('VNPay Webhook')
@Controller('api/subscriptions/vnpay')
export class VnpayController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * VNPay IPN endpoint (server-to-server callback).
   * VNPay will GET this URL with payment result params.
   * Must respond with { RspCode, Message } to acknowledge receipt.
   * Configure this URL in your VNPay merchant portal as the IPN URL.
   */
  @Get('ipn')
  @ApiOperation({
    summary: 'VNPay IPN callback (server-to-server)',
    description:
      '**Called by VNPay servers** after a payment is completed. Do not call this manually.\n\n' +
      'Flow:\n' +
      '1. VNPay sends a GET request with signed payment result query params.\n' +
      '2. This endpoint verifies the HMAC-SHA512 signature.\n' +
      '3. On success (`vnp_ResponseCode = "00"`), the subscription is set to `ACTIVE` and `startDate`/`endDate` are populated.\n' +
      '4. On failure, the subscription is set to `CANCELLED`.\n\n' +
      'Responds with `{ RspCode, Message }` per VNPay IPN specification.',
  })
  @ApiResponse({
    status: 200,
    description: 'IPN acknowledged by the server (always 200 per VNPay spec).',
    schema: {
      oneOf: [
        {
          title: 'Success',
          example: { RspCode: '00', Message: 'Confirm success' },
        },
        {
          title: 'Invalid Signature',
          example: { RspCode: '97', Message: 'Invalid signature' },
        },
        {
          title: 'Order Not Found',
          example: { RspCode: '01', Message: 'Order not found' },
        },
        {
          title: 'Already Processed',
          example: { RspCode: '02', Message: 'Order already confirmed' },
        },
        {
          title: 'Amount Mismatch',
          example: { RspCode: '04', Message: 'Invalid amount' },
        },
      ],
    },
  })
  @HttpCode(HttpStatus.OK)
  async ipn(@Query() params: Record<string, string>) {
    return this.subscriptionService.handleVnpayIpn(params as VnpayIpnParams);
  }
}

// ─── Internal API (called by other microservices) ────────────────────────────

@ApiTags('Internal Subscriptions')
@ApiSecurity('x-internal-token')
@Controller('internal/subscriptions')
@UseGuards(InternalGuard)
export class SubscriptionInternalController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Called by `SubscriptionGuard` in other services to check if a user
   * has an active subscription for a specific plan type.
   *
   * Usage from another service:
   *   GET http://subscription-service:8012/internal/subscriptions/verify?userId=xxx&planType=GROUP_OWNER
   *   Headers: x-internal-token: <SERVICE_INTERNAL_TOKEN>
   */
  @Get('verify')
  @ApiOperation({
    summary: 'Verify user has an active subscription (internal)',
    description:
      'Called by **other microservices** (via `SubscriptionGuard`) to enforce subscription-based access control. ' +
      'Returns `hasAccess: true` if the user has a currently active subscription for the given plan type.\n\n' +
      '**Authentication:** Requires `x-internal-token` header matching `SERVICE_INTERNAL_TOKEN` env var.\n\n' +
      '**Usage example in another service:**\n' +
      '```typescript\n' +
      '@Post()\n' +
      '@UseGuards(JwtAuthGuard, RemoteSubscriptionGuard)\n' +
      '@RequireSubscription(PlanType.GROUP_OWNER)\n' +
      'createGroup() { ... }\n' +
      '```',
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'The user UUID to check.',
    example: '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47',
  })
  @ApiQuery({
    name: 'planType',
    required: true,
    enum: PlanType,
    description: 'The plan type to verify.',
    example: PlanType.GROUP_OWNER,
  })
  @ApiResponse({
    status: 200,
    description: 'Verification result.',
    schema: {
      oneOf: [
        {
          title: 'Has Access',
          example: {
            hasAccess: true,
            planType: 'GROUP_OWNER',
            subscriptionId: 'a3f1c2e4-8b9d-4f2e-9a1b-3c5d7e9f0a2b',
            expiresAt: '2026-07-10T15:30:00.000Z',
          },
        },
        {
          title: 'No Access',
          example: {
            hasAccess: false,
            planType: 'GROUP_OWNER',
            subscriptionId: null,
            expiresAt: null,
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Missing or invalid query parameters.',
    schema: {
      example: {
        statusCode: 400,
        message: 'planType must be one of: SPORT_CENTER_MANAGER, GROUP_OWNER, SOCIAL_HOST, TOURNAMENT_ORGANIZER',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Invalid or missing internal token.',
    schema: {
      example: {
        statusCode: 403,
        message: 'Invalid internal token',
        error: 'Forbidden',
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async verify(
    @Query('userId') userId: string,
    @Query('planType') planType: string,
  ) {
    if (!userId) throw new BadRequestException('userId is required');
    if (!Object.values(PlanType).includes(planType as PlanType)) {
      throw new BadRequestException(
        `planType must be one of: ${Object.values(PlanType).join(', ')}`,
      );
    }
    return this.subscriptionService.verify(userId, planType as PlanType);
  }
}
