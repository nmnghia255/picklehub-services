import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { EquipmentUsageService } from './equipment-usage.service';
import { CreateUsageLogDto } from './dto/create-usage-log.dto';
import { ListUsageLogQueryDto } from './dto/list-usage-log-query.dto';

type AuthRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags('Equipment')
@Controller('api/groups/:groupId/equipment/:equipmentId/usages')
@ApiBearerAuth('access-token')
export class EquipmentUsageController {
  constructor(private readonly equipmentUsageService: EquipmentUsageService) { }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/groups/:groupId/equipment/:equipmentId/usages
  // ─────────────────────────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Log an equipment usage event',
    description: `
**Role required:** OWNER

Records how many units of the equipment were consumed in a session.

---

### Append-only

Usage logs **cannot be updated or deleted** — they form an immutable audit trail.
If the owner made a mistake (wrong quantity), they should submit a **new corrective log entry**
and explain in the \`note\` field (e.g. \`"Correction: previous entry was wrong, actual usage was 2 balls"\`).

---

### Backdating (\`usedAt\`)

The owner may set \`usedAt\` to a past datetime if they forgot to log a previous session.
The field **cannot be a future date**.
If omitted, it defaults to the current server time.

---

### When to call this

- After each practice/play session, the owner logs how many balls were used.
- If some equipment was damaged or lost, note it in the \`note\` field.

---

### Frontend integration

\`\`\`
// Owner submits usage after Tuesday practice
POST /api/groups/{groupId}/equipment/{equipmentId}/usages
{
  "quantityUsed": 3,
  "note": "1 ball cracked, other 2 still usable",
  "usedAt": "2026-06-20T08:00:00Z"
}
\`\`\`
`,
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'equipmentId', description: 'Equipment UUID.' })
  @ApiBody({ type: CreateUsageLogDto })
  @ApiResponse({
    status: 201,
    description: 'Usage logged successfully.',
    schema: {
      example: {
        message: 'Usage logged successfully',
        data: {
          id: 'log-uuid-1111',
          groupId: 'group-uuid-2222',
          equipmentId: 'equip-uuid-3333',
          quantityUsed: 3,
          note: '1 ball cracked during session',
          usedAt: '2026-06-20T08:00:00.000Z',
          loggedById: 'user-uuid-4444',
          createdAt: '2026-06-20T10:30:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or usedAt is in the future.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group or equipment not found (or equipment is deleted).' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async logUsage(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('equipmentId') equipmentId: string,
    @Body() dto: CreateUsageLogDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentUsageService.logUsage(equipmentId, groupId, userId, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /api/groups/:groupId/equipment/:equipmentId/usages
  // ─────────────────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List usage history for an equipment item',
    description: `
**Role required:** MEMBER (any member, including owner)

Returns a paginated list of usage log entries for a single equipment item,
with filters for date range and sort direction.

---

### Filters

| Param | Description |
|---|---|
| \`fromDate\` | Only logs where \`usedAt >= fromDate\` (ISO date, e.g. \`2026-06-01\`) |
| \`toDate\` | Only logs where \`usedAt <= toDate 23:59:59\` (ISO date, e.g. \`2026-06-30\`) |
| \`sortOrder\` | \`desc\` = newest first (default) · \`asc\` = oldest first |
| \`page\` / \`limit\` | Standard pagination |

---

### Frontend integration

\`\`\`
// Show full history for a ball box (newest first)
GET /api/groups/{groupId}/equipment/{equipmentId}/usages

// Filter to just this month
GET /api/groups/{groupId}/equipment/{equipmentId}/usages?fromDate=2026-06-01&toDate=2026-06-30
\`\`\`
`,
  })
  @ApiParam({ name: 'groupId', description: 'Group UUID.' })
  @ApiParam({ name: 'equipmentId', description: 'Equipment UUID.' })
  @ApiResponse({
    status: 200,
    description: 'List usage logs successfully.',
    schema: {
      example: {
        message: 'List usage logs successfully',
        data: [
          {
            id: 'log-uuid-1111',
            groupId: 'group-uuid-2222',
            equipmentId: 'equip-uuid-3333',
            quantityUsed: 3,
            note: '1 ball cracked during session',
            usedAt: '2026-06-20T08:00:00.000Z',
            loggedById: 'user-uuid-4444',
            createdAt: '2026-06-20T10:30:00.000Z',
          },
          {
            id: 'log-uuid-5555',
            groupId: 'group-uuid-2222',
            equipmentId: 'equip-uuid-3333',
            quantityUsed: 4,
            note: null,
            usedAt: '2026-06-18T08:00:00.000Z',
            loggedById: 'user-uuid-4444',
            createdAt: '2026-06-18T10:15:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 5,
          totalPages: 1,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not a member of this group.' })
  @ApiNotFoundResponse({ description: 'Group or equipment not found (or equipment is deleted).' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async listUsageLogs(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('equipmentId') equipmentId: string,
    @Query() query: ListUsageLogQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.equipmentUsageService.listUsageLogs(equipmentId, groupId, userId, query);
  }
}
