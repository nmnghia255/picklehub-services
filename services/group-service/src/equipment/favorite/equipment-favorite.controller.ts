import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
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
} from '@nestjs/swagger';
import { EquipmentFavoriteService } from './equipment-favorite.service';
import { UpsertFavoriteItemDto } from '../dto/upsert-favorite-item.dto';

type AuthRequest = Request & {
  user?: {
    userId: string;
  };
};

@ApiTags('Equipment Favorites')
@Controller('api/groups/:groupId/equipment-favorites')
@ApiBearerAuth('access-token')
export class EquipmentFavoriteController {
  constructor(private readonly favoriteService: EquipmentFavoriteService) { }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/groups/:groupId/equipment-favorites
  // ─────────────────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'Get favorite equipment templates',
    description: `
**Role required:** MEMBER

Returns the list of favorite equipment templates for a group, sorted by usageCount in descending order.
Useful for rendering the dropdown menu when adding a new item.
`,
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Get favorite equipment templates successfully.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not a member of this group.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async listFavorites(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.favoriteService.listFavorites(groupId, userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUT /api/groups/:groupId/equipment-favorites/:id
  // ─────────────────────────────────────────────────────────────────────────────
  @Put(':id')
  @ApiOperation({
    summary: 'Update a favorite equipment template details',
    description: `
**Role required:** OWNER

Updates the default properties of a favorite equipment template (name, default quantity, condition, cost, etc).
`,
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'id', description: 'Favorite template UUID.' })
  @ApiBody({ type: UpsertFavoriteItemDto })
  @ApiResponse({
    status: 200,
    description: 'Favorite equipment template updated successfully.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group or template not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async updateFavorite(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
    @Body() dto: UpsertFavoriteItemDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.favoriteService.updateFavorite(id, groupId, userId, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /api/groups/:groupId/equipment-favorites/:id
  // ─────────────────────────────────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a favorite equipment template',
    description: `
**Role required:** OWNER

Removes a favorite equipment template from the templates catalog.
Note: This action does NOT delete any physical equipment items (purchase instances) linked to this name.
`,
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'id', description: 'Favorite template UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Favorite equipment template deleted successfully.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group or template not found.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async deleteFavorite(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.favoriteService.deleteFavorite(id, groupId, userId);
  }
}
