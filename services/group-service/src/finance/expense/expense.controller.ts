import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UnauthorizedException, Query } from "@nestjs/common";
import {
  ApiOperation, ApiTags, ApiParam, ApiBearerAuth,
  ApiBody, ApiResponse, ApiBadRequestResponse, ApiUnauthorizedResponse,
  ApiNotFoundResponse, ApiForbiddenResponse, ApiInternalServerErrorResponse
} from "@nestjs/swagger";
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
@Controller('api/groups/:groupId/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) { }

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new expense and allocate payments',
    description: 'Creates a new expense within a group and divides it among members.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiBody({ type: CreateExpenseDto, description: 'Expense create payload.' })
  @ApiResponse({
    status: 201,
    description: 'Expense created successfully',
    schema: {
      example: {
        message: 'Expense created successfully',
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          groupId: '123e4567-e89b-12d3-a456-426614174001',
          title: 'Court booking fee for July 2026',
          description: 'Expense for court booking fee on 2026-07-15',
          totalAmount: 100000,
          receiptUrl: 'https://example.com/receipt.jpg',
          expenseDate: '2026-07-15T00:00:00.000Z',
          createdById: '123e4567-e89b-12d3-a456-426614174002',
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-01T12:00:00.000Z',
          payments: [
            {
              id: '123e4567-e89b-12d3-a456-426614174003',
              userId: '123e4567-e89b-12d3-a456-426614174004',
              requiredFee: 50000,
              amountPaid: 0,
              status: 'UNPAID'
            }
          ]
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid group id or invalid expense request payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiForbiddenResponse({ description: 'Only group admins or owners can create expense.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async createExpense(
    @Param('groupId') groupId: string,
    @Req() req: AuthRequest,
    @Body() createExpenseDto: CreateExpenseDto) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.createExpense(groupId, userId, createExpenseDto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List expenses for a group',
    description: 'List expenses within a group with pagination, filtering, and sorting.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get expenses successfully',
    schema: {
      example: {
        message: 'Get expenses successfully',
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            groupId: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Court booking fee for July 2026',
            totalAmount: 100000,
            createdAt: '2026-07-01T12:00:00.000Z',
            createdBy: {
              id: '123e4567-e89b-12d3-a456-426614174002',
              name: 'John Doe',
              email: 'john@example.com',
              avatarUrl: 'https://example.com/avatar.jpg'
            }
          }
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid group id or invalid expense request payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only group members can view expense details.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async getExpenses(
    @Param('groupId') groupId: string,
    @Query() listExpensesQueryDto: ListExpenseQueryDto,
    @Req() req: AuthRequest
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.getExpenses(groupId, userId, listExpensesQueryDto);
  }

  @Get(':expenseId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get details of an expense by ID',
    description: 'Get details of an expense within a group, including its payment allocations.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'expenseId', description: 'Expense id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get expense details successfully',
    schema: {
      example: {
        message: 'Get expense details successfully',
        data: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Court booking fee for July 2026',
          totalAmount: 100000,
          createdBy: {
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'John Doe'
          },
          payments: [
            {
              id: '123e4567-e89b-12d3-a456-426614174003',
              userId: '123e4567-e89b-12d3-a456-426614174004',
              requiredFee: 50000,
              amountPaid: 0,
              status: 'UNPAID',
              user: {
                id: '123e4567-e89b-12d3-a456-426614174004',
                name: 'Jane Smith'
              }
            }
          ]
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid group id or invalid expense request payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only group members can view expense details.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async getExpenseById(
    @Param('groupId') groupId: string,
    @Param('expenseId') expenseId: string,
    @Req() req: AuthRequest
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.getDetailsById(expenseId, groupId, userId);
  }

  @Patch('/:expenseId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update expense details',
    description: 'Update expense details such as title, description, amount, receipt URL, and expense date.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
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
          title: 'Updated Court booking fee',
          totalAmount: 120000
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid amount provided.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only group owners or admins can update expense.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async updateExpense(
    @Param('groupId') groupId: string,
    @Param('expenseId') expenseId: string,
    @Req() req: AuthRequest,
    @Body() updateExpenseDto: UpdateExpenseDto
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.updateExpense(expenseId, groupId, userId, updateExpenseDto);
  }

  @Delete('/:expenseId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete expense',
    description: 'Delete an expense from the group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'expenseId', description: 'Expense id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Expense deleted successfully',
    schema: {
      example: {
        message: 'Expense deleted successfully'
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Cannot delete expense as there are existing payments.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group or Expense not found.' })
  @ApiForbiddenResponse({ description: 'Only group owners or admins can delete expense.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async deleteExpense(
    @Param('groupId') groupId: string,
    @Param('expenseId') expenseId: string,
    @Req() req: AuthRequest
  ) {
    // Get user ID from request
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.expenseService.deleteExpense(expenseId, groupId, userId);
  }

}
