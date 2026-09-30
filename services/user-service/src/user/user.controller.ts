import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  PublicUserProfile,
  ApiResponse,
  UserProfile,
  UserService,
} from './user.service';

interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

@ApiTags('users')
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get my profile',
    description:
      'Returns the authenticated user profile in a standard ApiResponse<T> envelope, creates a profile row when it does not exist yet, and includes linked DUPR data when available.',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'The authenticated user profile was returned successfully.',
    schema: {
      example: {
        success: true,
        message: 'User profile fetched successfully',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'seed-user@picklehub.com',
          name: 'Picklehub Seed User',
          fullName: 'Nguyen Van A',
          avatarUrl: 'https://cdn.example.com/avatars/user-123.png',
          bio: 'Competitive pickleball player.',
          gender: 'MALE',
          selfRating: 2.5,
          preferredHand: 'RIGHT',
          phoneNumber: '0901234567',
          address: '123 Nguyen Van Linh, District 7, HCMC',
          dupr: null,
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'The request is missing or has an invalid access token.',
    schema: {
      example: {
        success: false,
        error: 'Invalid access token',
      },
    },
  })
  @Get('me')
  getMyProfile(
    @Req() request: AuthenticatedRequest,
  ): Promise<ApiResponse<UserProfile>> {
    return this.userService.getMyProfile(
      request.user.id,
      request.user.email,
      request.user.name,
      request.user.avatarUrl,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update my profile',
    description:
      'Updates editable profile fields for the authenticated user and returns the updated profile in a standard ApiResponse<T> envelope. Allowed fields are fullName, avatarUrl, bio, gender, selfRating, preferredHand, phoneNumber, and address.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @SwaggerApiResponse({
    status: 200,
    description: 'The profile was updated successfully.',
    schema: {
      example: {
        success: true,
        message: 'User profile updated successfully',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'seed-user@picklehub.com',
          name: 'Picklehub Seed User',
          fullName: 'Nguyen Van A',
          avatarUrl: 'https://cdn.example.com/avatars/user-123.png',
          bio: 'Competitive pickleball player.',
          gender: 'MALE',
          selfRating: 2.5,
          preferredHand: 'RIGHT',
          phoneNumber: '0901234567',
          address: '123 Nguyen Van Linh, District 7, HCMC',
          dupr: null,
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'The payload contains invalid or unsupported fields.',
    schema: {
      example: {
        success: false,
        error: 'Bad Request',
        errors: {
          totalMatchesPlayed: 'should not exist',
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'The request is missing or has an invalid access token.',
    schema: {
      example: {
        success: false,
        error: 'Invalid access token',
      },
    },
  })
  @Patch('me')
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() data: UpdateProfileDto,
  ): Promise<ApiResponse<UserProfile>> {
    return this.userService.updateProfile(request.user.id, data);
  }

  @ApiOperation({
    summary: 'Get a public profile',
    description:
      'Returns a sanitized public profile view for another user by id in a standard ApiResponse<T> envelope, including DUPR data when linked.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Target user id.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'The public profile was returned successfully.',
    schema: {
      example: {
        success: true,
        message: 'Public user profile fetched successfully',
        data: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'seed-user@picklehub.com',
          name: 'Picklehub Seed User',
          fullName: 'Nguyen Van A',
          avatarUrl: 'https://cdn.example.com/avatars/user-123.png',
          bio: 'Competitive pickleball player.',
          gender: 'MALE',
          selfRating: 2.5,
          preferredHand: 'RIGHT',
          phoneNumber: '0901234567',
          address: '123 Nguyen Van Linh, District 7, HCMC',
          dupr: null,
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'The requested user profile does not exist.',
    schema: {
      example: {
        success: false,
        error: 'User profile not found',
      },
    },
  })
  @Get(':id')
  getPublicProfile(
    @Param('id') id: string,
  ): Promise<ApiResponse<PublicUserProfile>> {
    return this.userService.getPublicProfile(id);
  }
}
