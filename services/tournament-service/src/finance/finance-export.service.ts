import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';

@Injectable()
export class FinanceExportService {
  constructor(private readonly prisma: PrismaService) {}

  private async getReportData(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    const transactions = await this.prisma.financialTransaction.findMany({
      where: { tournamentId },
      orderBy: { date: 'desc' },
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
      tournamentName: tournament.name,
      transactions,
      summary: {
        totalIncome,
        totalExpense,
        totalRefund,
        netProfit,
      },
    };
  }

  async generateExcel(tournamentId: number): Promise<Buffer> {
    const { tournamentName, transactions, summary } = await this.getReportData(tournamentId);

    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo Tài chính');

    // Title
    worksheet.mergeCells('A1:F1');
    const titleRow = worksheet.getCell('A1');
    titleRow.value = `BÁO CÁO TÀI CHÍNH - ${tournamentName.toUpperCase()}`;
    titleRow.font = { name: 'Arial', size: 16, bold: true };
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    worksheet.addRow([]); // Blank row

    // Summary Section
    worksheet.addRow(['TỔNG THU HỢP LỆ', summary.totalIncome, 'VND']);
    worksheet.addRow(['TỔNG CHI PHÍ', summary.totalExpense, 'VND']);
    worksheet.addRow(['TỔNG HOÀN TIỀN', summary.totalRefund, 'VND']);
    worksheet.addRow(['LỢI NHUẬN RÒNG', summary.netProfit, 'VND']);

    // Style summary rows
    for (let i = 3; i <= 6; i++) {
      worksheet.getCell(`A${i}`).font = { bold: true };
      worksheet.getCell(`B${i}`).font = { bold: true };
      worksheet.getCell(`B${i}`).numFmt = '#,##0';
    }

    worksheet.addRow([]); // Blank row

    // Headers for transactions table
    const headers = ['Mã GD', 'Ngày giao dịch', 'Nội dung chi tiết', 'Phân loại', 'Số tiền (VND)', 'Trạng thái'];
    worksheet.addRow(headers);
    
    const headerRow = worksheet.getRow(8);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'medium' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Set columns configuration for alignment & width
    worksheet.columns = [
      { key: 'id', width: 10, alignment: { horizontal: 'center' } },
      { key: 'date', width: 18, alignment: { horizontal: 'center' } },
      { key: 'description', width: 50 },
      { key: 'type', width: 15, alignment: { horizontal: 'center' } },
      { key: 'amount', width: 22, alignment: { horizontal: 'right' } },
      { key: 'status', width: 15, alignment: { horizontal: 'center' } },
    ];

    // Data rows
    for (const tx of transactions) {
      const row = worksheet.addRow([
        tx.id,
        new Date(tx.date).toLocaleDateString('vi-VN'),
        tx.description,
        tx.type === 'income' ? 'Thu nhập' : tx.type === 'expense' ? 'Chi phí' : 'Hoàn phí',
        tx.amount,
        tx.status === 'completed' ? 'Hoàn thành' : tx.status === 'verifying' ? 'Đang duyệt' : 'Chờ xử lý',
      ]);
      row.getCell(5).numFmt = '#,##0';
    }

    return Buffer.from(await workbook.xlsx.writeBuffer() as any);
  }

  async generatePdf(tournamentId: number): Promise<Buffer> {
    const { tournamentName, transactions, summary } = await this.getReportData(tournamentId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: any) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: any) => reject(err));

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('BAO CAO TAI CHINH', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(tournamentName.toUpperCase(), { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(12).font('Helvetica-Bold').text('TONG HOP KET QUA (P&L SUMMARY):', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica')
        .text(`Tong Thu Nhap (Completed Income):  ${summary.totalIncome.toLocaleString()} VND`)
        .text(`Tong Chi Phi (Completed Expense):  ${summary.totalExpense.toLocaleString()} VND`)
        .text(`Tong Hoan Tien (Completed Refund):  ${summary.totalRefund.toLocaleString()} VND`);
      
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica-Bold').text(`Loi Nhuan Rong (Net Profit):           ${summary.netProfit.toLocaleString()} VND`);
      doc.moveDown(2);

      // Table Title
      doc.fontSize(12).font('Helvetica-Bold').text('DANH SACH CAC GIAO DICH CHI TIET (TRANSACTIONS):', { underline: true });
      doc.moveDown(0.5);

      // Draw table headers
      const startX = 50;
      let startY = doc.y;

      doc.fontSize(9).font('Helvetica-Bold')
        .text('Ma GD', startX, startY)
        .text('Ngay', startX + 50, startY)
        .text('Noi dung', startX + 110, startY)
        .text('Loai', startX + 310, startY)
        .text('So tien', startX + 370, startY)
        .text('Trang thai', startX + 440, startY);
      
      doc.moveTo(startX, startY + 12).lineTo(550, startY + 12).stroke();
      doc.moveDown(1);
      startY += 18;

      // Draw transaction rows
      doc.font('Helvetica');
      for (const tx of transactions) {
        if (startY > 700) {
          doc.addPage();
          startY = 50;
          doc.font('Helvetica');
        }

        const dateStr = new Date(tx.date).toLocaleDateString('vi-VN');
        const amountStr = tx.amount.toLocaleString();

        doc.fontSize(8)
          .text(tx.id.toString(), startX, startY)
          .text(dateStr, startX + 50, startY)
          .text(tx.description, startX + 110, startY, { width: 190, height: 20 })
          .text(tx.type.toUpperCase(), startX + 310, startY)
          .text(amountStr, startX + 370, startY)
          .text(tx.status.toUpperCase(), startX + 440, startY);

        startY += 25;
      }

      doc.end();
    });
  }
}
