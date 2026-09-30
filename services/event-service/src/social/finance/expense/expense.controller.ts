import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UnauthorizedException, Query } from "@nestjs/common";
import {
  ApiOperation, ApiTags, ApiParam, ApiBearerAuth,
  ApiBody, ApiResponse, ApiBadRequestResponse, ApiUnauthorizedResponse,
  ApiNotFoundResponse, ApiForbiddenResponse, ApiInternalServerErrorResponse,
  ApiConflictResponse
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";
import { ExpenseService } from "./expense.service";

// DTOs
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { ListExpenseQueryDto } from "./dto/list-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

type AuthRequest = Request & {
    user?: {
        userId: string;
        userName?: string;
        email?: string;
        roles?: string[];
    };
};

@ApiTags('Expense')
@Controller('api/socials/:socialId/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) { }

  // #region POST /socials/:socialId/expenses

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new expense',
    description: 'Creates a new expense within a social.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiBody({ type: CreateExpenseDto, description: 'Expense create payload.' })
  @ApiResponse({
    status: 201,
    description: 'Expense created successfully',
    schema: {
      example: {
        message: 'Expense created successfully',
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          socialId: '123e4567-e89b-12d3-a456-426614174001',
          title: 'New Expense For Court Booking',
          description: 'This is expense for court booking fee, total 3 courts for 2 hours from 6pm to 8pm on 20/06 at ABC Sports Center.',
          amount: 900000,
          receiptUrl: 'https://example.com/receipt.jpg',
          expenseDate: '2024-06-01T12:00:00.000Z',
          createdById: '123e4567-e89b-12d3-a456-426614174002',
          createdAt: '2024-06-01T12:00:00.000Z',
        }
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid social id or invalid expense request payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social not found.' })
  @ApiForbiddenResponse({ description: 'Only social organizers can create expense.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async createExpense(
    @Param('socialId') socialId: string,
    @Req() req: AuthRequest,
    @Body() createExpenseDto: CreateExpenseDto) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.createExpense(socialId, userId, createExpenseDto);
  }

  // #endregion

  // #region GET /socials/:socialId/expenses

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List expenses for a social',
    description: 'List expenses within a social with pagination, filtering, and sorting.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get expenses successfully',
    schema: {
      example: {
        message: 'Get expenses successfully',
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            socialId: '123e4567-e89b-12d3-a456-426614174001',
            title: 'New Expense For Court Booking',
            description: 'This is expense for court booking fee, total 3 courts for 2 hours from 6pm to 8pm on 20/06 at ABC Sports Center.',
            amount: 900000,
            receiptUrl: 'https://example.com/receipt.jpg',
            expenseDate: '2024-06-01T12:00:00.000Z',
            createdById: '123e4567-e89b-12d3-a456-426614174002',
            createdAt: '2024-06-01T12:00:00.000Z',
            createdBy: {
              id: '123e4567-e89b-12d3-a456-426614174002',
              name: 'John Doe',
              email: 'john.doe@example.com',
              avatarUrl: 'https://example.com/avatar.jpg',
            }
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            socialId: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Old Fund',
            description: 'This is an old fund for our project.',
            amount: 500,
            receiptUrl: null,
            createdById: '123e4567-e89b-12d3-a456-426614174002',
            createdAt: '2024-05-01T12:00:00.000Z',
            createdBy: {
              id: '123e4567-e89b-12d3-a456-426614174002',
              name: 'John Doe',
              email: 'john.doe@example.com',
              avatarUrl: 'https://example.com/avatar.jpg',
            }
          }
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        }
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid social id or invalid expense request payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only social members can view expense details.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async getExpenses(
    @Param('socialId') socialId: string,
    @Query() listExpensesQueryDto: ListExpenseQueryDto,
    @Req() req: AuthRequest
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.getExpenses(socialId, userId, listExpensesQueryDto);
  }

  // #endregion

  // #region GET /socials/:socialId/expenses/:expenseId

  @Get(':expenseId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get details of an expense by ID',
    description: 'Get details of an expense within a social.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiParam({ name: 'expenseId', description: 'Expense id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get expenses successfully',
    schema: {
      example: {
        message: 'Get expense details successfully',
        data:
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          socialId: '123e4567-e89b-12d3-a456-426614174001',
          title: 'New Expense For Court Booking',
          description: 'This is an expense for court booking fee, total 3 courts for 2 hours from 6pm to 8pm on 20/06 at ABC Sports Center.',
          amount: 100000,
          receiptUrl: 'https://example.com/receipt.jpg',
          expenseDate: '2024-06-01T12:00:00.000Z',
          createdById: '123e4567-e89b-12d3-a456-426614174002',
          createdAt: '2024-06-01T12:00:00.000Z',
          createdBy: {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'John Doe',
            email: 'john.doe@example.com',
            avatarUrl: 'https://example.com/avatar.jpg',
          }
        }
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid social id or invalid expense request payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only social members can view expense details.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async getExpenseById(
    @Param('socialId') socialId: string,
    @Param('expenseId') expenseId: string,
    @Req() req: AuthRequest
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.getDetailsById(expenseId, socialId, userId);
  }

  // #endregion

  // #region PATCH /socials/:socialId/expenses/:expenseId

  @Patch('/:expenseId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update expense details',
    description: 'Update expense details such as title, description, amount, receipt URL, and expense date.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiParam({ name: 'expenseId', description: 'Expense id (UUID).' })
  @ApiBody({ type: UpdateExpenseDto, description: 'Expense update payload.' })
  @ApiResponse({
    status: 200,
    description: 'Expense updated successfully',
    schema: {
      example: {
        message: 'Expense updated successfully',
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          socialId: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Updated Expense',
          description: 'New description for the expense.',
          amount: 120000,
          receiptUrl: 'https://example.com/receipt.jpg',
          expenseDate: '2024-06-15T12:00:00.000Z',
          createdById: '123e4567-e89b-12d3-a456-426614174002',
          createdAt: '2024-06-01T12:00:00.000Z',
        }
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid amount provided.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only social owners or admins can update expense.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async updateExpense(
    @Param('socialId') socialId: string,
    @Param('expenseId') expenseId: string,
    @Req() req: AuthRequest,
    @Body() updateExpenseDto: UpdateExpenseDto
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.updateExpense(expenseId, socialId, userId, updateExpenseDto);
  }

  // #endregion

  // #region DELETE /socials/:socialId/expenses/:expenseId

  @Delete('/:expenseId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete expense',
    description: 'Delete an expense from the social.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiParam({ name: 'expenseId', description: 'Expense id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Expense deleted successfully'
  })
  @ApiBadRequestResponse({ description: 'Cannot delete expense amount as there are existing payments.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only social owners or admins can delete expense.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async deleteExpense(
    @Param('socialId') socialId: string,
    @Param('expenseId') expenseId: string,
    @Req() req: AuthRequest
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.deleteExpense(expenseId, socialId, userId);
  }

  // #endregion
}
