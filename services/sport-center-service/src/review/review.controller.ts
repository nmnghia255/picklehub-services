import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UnauthorizedException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Reviews')
@Controller('sport-centers/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a review for a sport center' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully.',
    type: ReviewResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      centerId: '660e8400-e29b-41d4-a716-446655440000',
      userId: '770e8400-e29b-41d4-a716-446655440000',
      rating: 4,
      comment: 'Great place! Well maintained courts and friendly staff.',
      createdAt: '2024-05-21T10:30:00.000Z',
      updatedAt: '2024-05-21T10:30:00.000Z',
    },
  })
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createReviewDto: CreateReviewDto) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.reviewService.create(userId, createReviewDto);
  }

  @Get('center/:centerId')
  @ApiOperation({ summary: 'Get all reviews for a sport center' })
  @ApiResponse({
    status: 200,
    description: 'Reviews fetched successfully.',
    isArray: true,
    type: ReviewResponseDto,
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        centerId: '660e8400-e29b-41d4-a716-446655440000',
        userId: '770e8400-e29b-41d4-a716-446655440000',
        userName: 'John Doe',
        rating: 5,
        comment: 'Excellent facility! Great service and maintenance.',
        createdAt: '2024-05-21T10:30:00.000Z',
        updatedAt: '2024-05-21T10:30:00.000Z',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        centerId: '660e8400-e29b-41d4-a716-446655440000',
        userId: '770e8400-e29b-41d4-a716-446655440001',
        userName: 'Jane Smith',
        rating: 4,
        comment: 'Good courts and friendly staff.',
        createdAt: '2024-05-20T15:45:00.000Z',
        updatedAt: '2024-05-20T15:45:00.000Z',
      },
    ],
  })
  findByCenterId(@Param('centerId', new ParseUUIDPipe()) centerId: string) {
    return this.reviewService.findByCenterId(centerId);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update your review' })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully.',
    type: ReviewResponseDto,
    example: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      centerId: '660e8400-e29b-41d4-a716-446655440000',
      userId: '770e8400-e29b-41d4-a716-446655440000',
      rating: 5,
      comment: 'Updated comment: Excellent facility overall!',
      createdAt: '2024-05-21T10:30:00.000Z',
      updatedAt: '2024-05-21T12:00:00.000Z',
    },
  })
  @UseGuards(JwtAuthGuard)
  update(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.reviewService.update(id, userId, updateReviewDto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete your review' })
  @ApiResponse({
    status: 200,
    description: 'Review deleted successfully.',
    example: { message: 'Review deleted successfully' },
  })
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.reviewService.remove(id, userId);
  }
}
