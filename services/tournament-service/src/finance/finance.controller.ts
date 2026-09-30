import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import * as express from 'express';
import { FinanceService } from './finance.service';
import { FinanceExportService } from './finance-export.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';
import { TransactionResponseDto, FinanceReportResponseDto } from './dto/finance-response.dto';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import { RequireSubscription } from '../guards/subscription.guard';

@ApiTags('Tournament Finance')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
@Controller(':tournamentId')
@RequireSubscription('TOURNAMENT_ORGANIZER')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly financeExportService: FinanceExportService,
  ) {}

  @Post('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Post a financial transaction',
    description: 'Enables tournament organizers to record manual income, expenses, or refunds. Status starts as pending or completed.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiResponse({ status: 201, description: 'Transaction recorded successfully.', type: TransactionResponseDto })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    return this.financeService.create(tournamentId, createTransactionDto);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get all tournament transactions',
    description: 'Retrieves a list of all transactions recorded for the tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully.', type: [TransactionResponseDto] })
  findAll(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.financeService.findAll(tournamentId);
  }

  @Patch('transactions/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update transaction status',
    description: 'Enables organizers to confirm a pending transaction (double check reconciliation). Also updates related registrations.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction status updated successfully.', type: TransactionResponseDto })
  updateStatus(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() statusDto: UpdateTransactionStatusDto,
  ) {
    return this.financeService.updateStatus(tournamentId, id, statusDto);
  }

  @Get('finance/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get financial P&L report',
    description: 'Calculates the total income, expenses, refunds, and net profit of the tournament based on completed transactions.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiResponse({ status: 200, description: 'P&L report retrieved successfully.', type: FinanceReportResponseDto })
  getReport(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.financeService.getReport(tournamentId);
  }

  @Delete('transactions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a transaction',
    description: 'Deletes a transaction record by ID.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction deleted.', type: TransactionResponseDto })
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.financeService.remove(tournamentId, id);
  }

  @Get('finance/report/export')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Export financial P&L report',
    description: 'Generates and downloads the financial report in Excel or PDF format.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiQuery({ name: 'format', required: true, enum: ['excel', 'pdf'], description: 'Export format: excel or pdf' })
  @ApiResponse({ status: 200, description: 'Report exported successfully.' })
  async exportReport(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query('format') format: string,
    @Res() res: express.Response,
  ) {
    if (format === 'pdf') {
      const buffer = await this.financeExportService.generatePdf(tournamentId);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="finance_report_${tournamentId}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } else {
      const buffer = await this.financeExportService.generateExcel(tournamentId);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="finance_report_${tournamentId}.xlsx"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    }
  }
}
