import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { ListEquipmentQueryDto } from './dto/list-equipment-query.dto';
import { UpdateFavoriteStatusDto } from './dto/update-favorite-status.dto';

type AuthRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags('Equipment')
@Controller('api/groups/:groupId/equipment')
@ApiBearerAuth('access-token')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) { }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/groups/:groupId/equipment
  // ─────────────────────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add group equipment (Owner)',
    description: 'Records a new physical equipment item owned by the group. Optional auto-expense creation.',
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiBody({ type: CreateEquipmentDto })
  @ApiResponse({
    status: 201,
    description: 'Equipment created successfully.',
    schema: {
      example: {
        message: 'Equipment created successfully',
        data: {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          groupId: '11111111-2222-3333-4444-555555555555',
          name: 'Bóng Dura 40+',
          description: 'Hộp 12 quả cho luyện tập',
          quantity: 12,
          condition: 'NEW',
          purchaseCost: 180000,
          purchasedAt: '2026-06-20T00:00:00.000Z',
          expenseId: 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj',
          createdById: 'aaaaaaaa-1111-2222-3333-444444444444',
          deletedAt: null,
          createdAt: '2026-06-20T10:30:00.000Z',
          updatedAt: '2026-06-20T10:30:00.000Z',
          expense: {
            id: 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj',
            title: 'Mua vật dụng: Bóng Dura 40+',
            totalAmount: 180000,
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or memberIds contains non-members.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async createEquipment(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Body() dto: CreateEquipmentDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentService.createEquipment(groupId, userId, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/groups/:groupId/equipment
  // ─────────────────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List group equipment (Owner/Member)',
    description: 'Returns a paginated list of all active (non-deleted) equipment items for the group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiResponse({
    status: 200,
    description: 'List equipment successfully.',
    schema: {
      example: {
        message: 'List equipment successfully',
        data: [
          {
            id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            name: 'Bóng Dura 40+',
            description: 'Hộp 12 quả cho luyện tập',
            quantity: 12,
            condition: 'NEW',
            purchaseCost: 180000,
            purchasedAt: '2026-06-20T00:00:00.000Z',
            deletedAt: null,
            createdAt: '2026-06-20T10:30:00.000Z',
            updatedAt: '2026-06-20T10:30:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not a member of this group.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async listEquipment(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Query() query: ListEquipmentQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentService.listEquipment(groupId, userId, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/groups/:groupId/equipment/:equipmentId
  // ─────────────────────────────────────────────────────────────────────────────
  @Get(':equipmentId')
  @ApiOperation({
    summary: 'Get equipment details (Owner/Member)',
    description: 'Returns full details for a single equipment item with linked expense and caller payment status.',
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'equipmentId', description: 'Equipment UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Get equipment details successfully.',
    schema: {
      example: {
        message: 'Get equipment details successfully',
        data: {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          groupId: '11111111-2222-3333-4444-555555555555',
          name: 'Bóng Dura 40+',
          description: 'Hộp 12 quả',
          quantity: 12,
          condition: 'NEW',
          purchaseCost: 180000,
          purchasedAt: '2026-06-20T00:00:00.000Z',
          deletedAt: null,
          createdById: 'aaaaaaaa-1111-2222-3333-444444444444',
          createdAt: '2026-06-20T10:30:00.000Z',
          updatedAt: '2026-06-20T10:30:00.000Z',
          expense: {
            id: 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj',
            title: 'Mua vật dụng: Bóng Dura 40+',
            totalAmount: 180000,
          },
          myPayment: {
            id: 'pppppppp-qqqq-rrrr-ssss-tttttttttttt',
            requiredFee: 15000,
            amountPaid: 0,
            outstandingFee: 15000,
            status: 'UNPAID',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not a member of this group.' })
  @ApiNotFoundResponse({ description: 'Group or equipment not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async getEquipmentById(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('equipmentId') equipmentId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentService.getEquipmentById(equipmentId, groupId, userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /api/groups/:groupId/equipment/:equipmentId
  // ─────────────────────────────────────────────────────────────────────────────
  @Patch(':equipmentId')
  @ApiOperation({
    summary: 'Update equipment metadata (Owner)',
    description: 'Updates descriptive metadata (name, quantity, condition) of an equipment item.',
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'equipmentId', description: 'Equipment UUID.' })
  @ApiBody({ type: UpdateEquipmentDto })
  @ApiResponse({
    status: 200,
    description: 'Equipment updated successfully.',
    schema: {
      example: {
        message: 'Equipment updated successfully',
        data: {
          id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          name: 'Bóng Dura 40+',
          quantity: 10,
          condition: 'WORN',
          updatedAt: '2026-06-21T08:00:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group or equipment not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async updateEquipment(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('equipmentId') equipmentId: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentService.updateEquipment(equipmentId, groupId, userId, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /api/groups/:groupId/equipment/:equipmentId
  // ─────────────────────────────────────────────────────────────────────────────
  @Delete(':equipmentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete equipment (Owner)',
    description: 'Marks the equipment as deleted (soft-delete). Linked financial records are fully preserved.',
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'equipmentId', description: 'Equipment UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Equipment soft-deleted successfully.',
    schema: {
      example: {
        message:
          'Equipment soft-deleted successfully. Financial records linked to this item are preserved.',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group or equipment not found (or already deleted).' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async softDeleteEquipment(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('equipmentId') equipmentId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentService.softDeleteEquipment(equipmentId, groupId, userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /api/groups/:groupId/equipment/:equipmentId/favorite
  // ─────────────────────────────────────────────────────────────────────────────
  @Patch(':equipmentId/favorite')
  @ApiOperation({
    summary: 'Toggle equipment favorite status (Owner)',
    description: 'Marks or unmarks an equipment item as favorite to save as a quick-input template.',
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'equipmentId', description: 'Equipment UUID.' })
  @ApiBody({ type: UpdateFavoriteStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Favorite status updated successfully.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group or equipment not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async toggleFavoriteStatus(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('equipmentId') equipmentId: string,
    @Body() dto: UpdateFavoriteStatusDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentService.toggleFavoriteStatus(
      groupId,
      equipmentId,
      userId,
      dto.isFavorite,
    );
  }
}
