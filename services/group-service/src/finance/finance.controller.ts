import { Controller, Get, UseGuards, Request, Param, UnauthorizedException, Query, HttpCode, HttpStatus } from "@nestjs/common";
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse,
  ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiForbiddenResponse,
  ApiInternalServerErrorResponse, ApiBody
} from "@nestjs/swagger";
import { FinanceService } from "./finance.service";
import { FinanceSummaryQueryDto } from "./dto/finance-summary-query.dto";
import { ListCreditBalanceQueryDto } from "./dto/list-credit-balance.dto";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { ListTransactionQueryDto } from "./dto/list-transaction.dto";
import { VerifyTransactionDto } from "./dto/verify-transaction.dto";
import { RemindFeeDto } from "./dto/remind-fee.dto";
import { ListDebtsQueryDto } from "./dto/list-debts-query.dto";
import { RefundMemberDto } from "../group/dto/refund-member.dto";
import { Body, Patch, Post } from "@nestjs/common";

type AuthRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags('Finance')
@Controller('api/groups/:groupId/finances')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) { }

  @Get('summary')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get group finance summary (Owner/Member)',
    description: `Get a summary of financial status of the group.
    
    Fields in data:
    - totalExpense: Total amount of all expenses created in the group.
    - totalRequiredCollection: Total amount of fees required to be collected from members.
    - totalExpectedRevenue: Total expected revenue (equivalent to required collection).
    - totalCollected: Total amount of fees actually collected/verified from members.
    - outstandingAmount: Total amount of debt remaining (totalExpectedRevenue - totalCollected).
    - netBalance: The group's net balance (totalCollected - totalExpense).
    - creditBalanceList: List of members with positive credit balances (who paid more than their required fees).`,
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get finance summary successfully',
    schema: {
      example: {
        message: 'Get finance summary successfully',
        data: {
          totalExpense: 4000000,
          totalRequiredCollection: 4000000,
          totalExpectedRevenue: 4000000,
          totalCollected: 210000,
          outstandingAmount: 3790000,
          netBalance: -3790000,
          creditBalanceList: [
            {
              userId: '123e4567-e89b-12d3-a456-426614174000',
              creditBalance: 50000,
              user: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                name: 'Alex Nguyen',
                email: 'alex@example.com',
                avatarUrl: 'https://example.com/avatar/alex.png',
              }
            }
          ]
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid group id' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiForbiddenResponse({ description: 'Only group members can view finance details.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async getFinanceSummary(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Query() financeSummaryQueryDto: FinanceSummaryQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.summaryGroupFinance(groupId, userId, financeSummaryQueryDto);
  }

  @Get('credit-balances')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List members with credit balance (Owner/Member)',
    description: 'List group members that have a positive credit balance with pagination and simple filters.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get credit balance list successfully',
    schema: {
      example: {
        message: 'Get credit balance list successfully',
        data: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            creditBalance: 150000,
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Alex Nguyen',
              email: 'alex@example.com',
              avatarUrl: 'https://example.com/avatar/alex.png',
            },
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid group id or invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiForbiddenResponse({ description: 'Only group members can view credit balances.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  async getCreditBalances(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Query() listCreditBalanceQueryDto: ListCreditBalanceQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.listMembersWithCreditBalance(groupId, userId, listCreditBalanceQueryDto);
  }

  @Post('transactions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit a payment transaction (Member)',
    description: `Member submits a payment transaction for their outstanding debt.
    The transaction is created with status 'PENDING_REVIEW'.
    
    TransactionStatus values:
    - PENDING_REVIEW: waiting for admin approval,
    - VERIFIED: admin verified the transaction,
    - REJECTED: admin rejected the transaction`,
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 201,
    description: 'Transaction submitted successfully. Please wait for admin verification.',
    schema: {
      example: {
        message: 'Transaction submitted successfully. Please wait for admin verification.',
        data: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          groupId: '123e4567-e89b-12d3-a456-426614174002',
          userId: '123e4567-e89b-12d3-a456-426614174003',
          amount: 500000,
          receiptUrl: 'https://example.com/receipt.jpg',
          status: 'PENDING_REVIEW',
          createdAt: '2026-06-06T12:00:00.000Z',
          updatedAt: '2026-06-06T12:00:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid payload.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  async createTransaction(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.createTransaction(groupId, userId, dto);
  }

  @Get('transactions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List transactions',
    description: `Admin retrieves the list of transactions.
    
    TransactionStatus values:
    - PENDING_REVIEW: waiting for admin approval
    - VERIFIED: admin verified the transaction,
    - REJECTED: admin rejected the transaction`,
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'List transactions successfully',
    schema: {
      example: {
        message: 'List transactions successfully',
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            groupId: '123e4567-e89b-12d3-a456-426614174002',
            userId: '123e4567-e89b-12d3-a456-426614174003',
            amount: 500000,
            receiptUrl: 'https://example.com/receipt.jpg',
            status: 'PENDING_REVIEW',
            createdAt: '2026-06-06T12:00:00.000Z',
            updatedAt: '2026-06-06T12:00:00.000Z',
            user: {
              id: '123e4567-e89b-12d3-a456-426614174003',
              name: 'John Doe',
              email: 'john@example.com',
              avatarUrl: 'https://example.com/avatar.png'
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
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiForbiddenResponse({ description: 'Only group owner can view transactions.' })
  async listTransactions(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Query() query: ListTransactionQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.listTransactions(groupId, userId, query);
  }

  @Patch('transactions/:txId/verify')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify a transaction  (Owner)',
    description: `Admin verifies a transaction and count credit for members.
    
    VerifyTransactionStatus: VERIFIED or REJECTED. 
    - If VERIFIED, the transaction status updates to 'VERIFIED' and auto-allocates to group payments.
    - If REJECTED, the status updates to 'REJECTED'.
    `,
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'txId', description: 'Transaction id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Transaction verified and auto-allocated successfully',
    schema: {
      example: {
        message: 'Transaction verified and auto-allocated successfully',
        data: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          groupId: '123e4567-e89b-12d3-a456-426614174002',
          userId: '123e4567-e89b-12d3-a456-426614174003',
          amount: 500000,
          receiptUrl: 'https://example.com/receipt.jpg',
          status: 'VERIFIED',
          verifiedById: '123e4567-e89b-12d3-a456-426614174009',
          createdAt: '2026-06-06T12:00:00.000Z',
          updatedAt: '2026-06-06T12:15:00.000Z'
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Transaction is not pending review.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group or transaction not found.' })
  @ApiForbiddenResponse({ description: 'Only group owner can verify transactions.' })
  async verifyTransaction(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('txId') txId: string,
    @Body() dto: VerifyTransactionDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.verifyTransaction(txId, groupId, userId, dto);
  }

  @Get('me/debt')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get my debt (Member)',
    description: `Member get their current total debt and details of unpaid payments.

    Payment status:
    - UNPAID: member has not paid yet,
    - PARTIALLY_PAID: member has paid part of the amount,
    - PAID: member has paid the full amount,
    - OVERPAID: member has paid more than the required amount.`,
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get my debt successfully',
    schema: {
      example: {
        message: 'Get my debt successfully',
        data: {
          totalRequired: 650000,
          totalPaid: 150000,
          netBalance: -500000,
          debt: 500000,
          unpaidPayments: [
            {
              id: '123e4567-e89b-12d3-a456-426614174005',
              expenseTitle: 'Pickleball court fee June',
              requiredFee: 300000,
              guestCount: 2,
              guestFee: 100000,
              amountPaid: 100000,
              debt: 200000,
              status: 'PARTIALLY_PAID'
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174006',
              expenseTitle: 'Pickleball balls July',
              requiredFee: 300000,
              guestCount: 0,
              guestFee: 0,
              amountPaid: 0,
              debt: 300000,
              status: 'UNPAID'
            }
          ]
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  async getMyDebt(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.getMyDebt(groupId, userId);
  }

  @Get('debts')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List members with outstanding debt (Owner)',
    description: 'Lists all group members with a net outstanding debt (total debt > credit balance), including user profile details, outstanding balance, and breakdown of unpaid payments. Requires owner permission.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get group debts list successfully',
    schema: {
      example: {
        message: 'Get group debts list successfully',
        data: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            creditBalance: 0,
            totalRequired: 600000,
            totalPaid: 100000,
            netBalance: -500000,
            debt: 500000,
            unpaidPayments: [
              {
                id: '123e4567-e89b-12d3-a456-426614174005',
                expenseTitle: 'Pickleball court fee June',
                requiredFee: 300000,
                amountPaid: 100000,
                debt: 200000,
                status: 'PARTIALLY_PAID',
                createdAt: '2026-06-06T12:00:00.000Z'
              }
            ],
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Alex Nguyen',
              email: 'alex@example.com',
              avatarUrl: 'https://example.com/avatar.png'
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
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiForbiddenResponse({ description: 'Only group owner can view debts list.' })
  async listDebts(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Query() query: ListDebtsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.listMembersWithDebt(groupId, userId, query);
  }

  @Post('remind')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remind debt (Owner)',
    description: 'Owner sends notifications to remind members of their debt. Optionally can send emails.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Reminders sent successfully',
    schema: {
      example: {
        message: 'Reminders sent successfully',
        data: {
          usersNotified: 2
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiForbiddenResponse({ description: 'Only group owner can remind debt.' })
  async remindDebt(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Body() dto: RemindFeeDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.remindDebt(groupId, userId, dto);
  }
}

// #region FinanceRefundController
@ApiTags('Group Members')
@Controller('api/groups/:groupId/members')
@ApiBearerAuth('access-token')
export class FinanceRefundController {
  constructor(private readonly financeService: FinanceService) { }

  @Post(':memberId/refund')
  @ApiOperation({
    summary: 'Refund member credit (Owner)',
    description: 'Owner refunds member credit balance outside the system.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'memberId', description: 'Target member user id (UUID).' })
  @ApiBody({ type: RefundMemberDto })
  @ApiResponse({ status: 200, description: 'Refund processed successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Caller is not OWNER.' })
  @ApiResponse({ status: 404, description: 'Group or member not found.' })
  @HttpCode(HttpStatus.OK)
  async refundCredit(
    @Request() req: AuthRequest,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() dto: RefundMemberDto,
  ) {
    const callerId = req.user?.userId;
    if (!callerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.refundMemberCredit(callerId, groupId, memberId, dto);
  }
}
// #endregion
