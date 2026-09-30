import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async create(tournamentId: number, createDto: CreateTransactionDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const createdTx = await tx.financialTransaction.create({
        data: {
          tournamentId,
          ...createDto,
        },
      });
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'FINANCE_TX_CREATE',
          newValue: createdTx as any,
        },
      });
      return createdTx;
    });
  }

  async findAll(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    return this.prisma.financialTransaction.findMany({
      where: { tournamentId },
      orderBy: { date: 'desc' },
    });
  }

  async updateStatus(tournamentId: number, transactionId: number, statusDto: UpdateTransactionStatusDto) {
    const transaction = await this.prisma.financialTransaction.findFirst({
      where: { id: transactionId, tournamentId },
    });
    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found in tournament ${tournamentId}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Update the transaction status
      const updatedTx = await tx.financialTransaction.update({
        where: { id: transactionId },
        data: { status: statusDto.status },
      });

      // Synchronize with Registration if description contains a Registration ID (e.g. "Reg ID: 123")
      const regIdMatch = transaction.description.match(/Reg ID:\s*(\d+)/i);
      if (regIdMatch) {
        const registrationId = parseInt(regIdMatch[1], 10);
        // Find if this registration exists
        const registration = await tx.registration.findFirst({
          where: { id: registrationId, tournamentId },
        });
        if (registration) {
          // If we are confirming payment, we update registration's paymentStatus
          await tx.registration.update({
            where: { id: registrationId },
            data: { paymentStatus: statusDto.status },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'FINANCE_TX_STATUS_CHANGE',
          oldValue: transaction as any,
          newValue: updatedTx as any,
        },
      });

      return updatedTx;
    });
  }

  async getReport(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where: { tournamentId },
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let totalRefund = 0;

    for (const tx of transactions) {
      if (tx.status === 'completed') {
        if (tx.type === 'income') {
          totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
          totalExpense += tx.amount;
        } else if (tx.type === 'refund') {
          totalRefund += tx.amount;
        }
      }
    }

    const netProfit = totalIncome - totalExpense - totalRefund;

    return {
      summary: {
        totalIncome,
        totalExpense,
        totalRefund,
        netProfit,
      },
      transactionsCount: transactions.length,
    };
  }

  async remove(tournamentId: number, transactionId: number) {
    const transaction = await this.prisma.financialTransaction.findFirst({
      where: { id: transactionId, tournamentId },
    });
    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found in tournament ${tournamentId}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deletedTx = await tx.financialTransaction.delete({
        where: { id: transactionId },
      });
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'FINANCE_TX_DELETE',
          oldValue: deletedTx as any,
        },
      });
      return deletedTx;
    });
  }
}
