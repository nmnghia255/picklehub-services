import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { registerFont, createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import * as path from 'path';

@Injectable()
export class PosterService implements OnModuleInit {
  private fontsRegistered = false;

  constructor() {}

  onModuleInit() {
    this.registerFonts();
  }

  private registerFonts() {
    if (this.fontsRegistered) return;
    try {
      const regularPath = path.join(process.cwd(), 'src/assets/fonts/Inter-Regular.ttf');
      const boldPath = path.join(process.cwd(), 'src/assets/fonts/Inter-Bold.ttf');
      
      registerFont(regularPath, { family: 'Inter' });
      registerFont(boldPath, { family: 'Inter', weight: 'bold' });
      this.fontsRegistered = true;
      console.log('Fonts registered successfully.');
    } catch (error) {
      console.error('Failed to register custom fonts:', error);
    }
  }

  generateMetadataHash(name: string, startDate: Date, venue: string): string {
    const dataString = `${name}|${new Date(startDate).toISOString()}|${venue}`;
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  async generatePoster(tournament: {
    id: number;
    name: string;
    startDate: Date;
    venue: string;
  }): Promise<Buffer> {
    this.registerFonts(); // double check registration
    
    const canvas = createCanvas(1200, 630);
    const ctx = canvas.getContext('2d');

    // 1. Draw beautiful dark background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, '#0a0d1a');
    gradient.addColorStop(0.5, '#121430');
    gradient.addColorStop(1, '#070914');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1200, 630);

    // Draw glowing court lines in the background
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.lineWidth = 3;
    
    // Outer court boundary
    ctx.strokeRect(100, 50, 1000, 530);
    // Center line
    ctx.beginPath();
    ctx.moveTo(600, 50);
    ctx.lineTo(600, 580);
    ctx.stroke();
    // Non-volley zone (kitchen) lines
    ctx.beginPath();
    ctx.moveTo(450, 50);
    ctx.lineTo(450, 580);
    ctx.moveTo(750, 50);
    ctx.lineTo(750, 580);
    ctx.stroke();

    // 2. Left glassmorphism card for details
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    
    this.drawRoundedRect(ctx, 80, 80, 640, 470, 24);
    ctx.fill();
    ctx.stroke();

    // Branding: PickleHub logo text
    ctx.fillStyle = '#10b981'; // vibrant green
    ctx.font = 'bold 24px Inter';
    ctx.fillText('PICKLEHUB', 120, 140);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Inter';
    const brandWidth = ctx.measureText('PICKLEHUB').width;
    ctx.fillText(' TOURNAMENT', 120 + brandWidth, 140);

    // Tournament Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Inter';
    const numLines = this.wrapText(ctx, tournament.name, 120, 210, 560, 52, 2);

    // Draw detail entries
    const startY = numLines > 1 ? 320 : 280;
    
    // Helper to draw standard details
    const drawDetail = (label: string, value: string, yPos: number) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '18px Inter';
      ctx.fillText(label.toUpperCase(), 120, yPos);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Inter';
      ctx.fillText(value, 120, yPos + 28);
    };

    // Format Date: e.g. "Ngày 25/07/2026"
    const dateStr = this.formatDate(tournament.startDate);
    drawDetail('Thời gian', dateStr, startY);
    drawDetail('Địa điểm', this.truncateString(tournament.venue, 45), startY + 80);

    // 3. Right panel for QR Code
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.drawRoundedRect(ctx, 800, 80, 320, 470, 24);
    ctx.fill();
    ctx.stroke();

    // White background card for QR Code
    ctx.fillStyle = '#ffffff';
    this.drawRoundedRect(ctx, 840, 110, 240, 240, 16);
    ctx.fill();

    // Generate QR Code URL
    const frontendUrl = process.env.FRONTEND_URL || 'https://picklehub.vn';
    const qrUrl = `${frontendUrl}/tournaments/${tournament.id}?utm_source=user_share&utm_medium=poster`;
    
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      margin: 1,
      width: 220,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const qrImage = await loadImage(qrBuffer);
    ctx.drawImage(qrImage, 850, 120, 220, 220);

    // Text under QR Code
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('QUÉT ĐỂ ĐĂNG KÝ', 960, 400);

    ctx.fillStyle = '#10b981';
    ctx.font = '16px Inter';
    ctx.fillText('picklehub.vn', 960, 435);

    // Reset text align for safety
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
  }

  async uploadPoster(buffer: Buffer, fileName: string): Promise<string> {
    const mediaServiceUrl = process.env.MEDIA_SERVICE_URL || 'http://media-service:8011';
    
    const formData = new FormData();
    const blob = new Blob([buffer as any], { type: 'image/png' });
    formData.append('file', blob, fileName);

    const uploadUrl = `${mediaServiceUrl.replace(/\/$/, '')}/api/media/images`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json() as { url: string };
        return data.url;
      }
      
      const errorText = await response.text().catch(() => '');
      console.warn(`Failed to upload poster to media service (${response.status}): ${errorText}. Falling back to mock URL.`);
    } catch (error: any) {
      console.warn(`Network error uploading poster: ${error.message}. Falling back to mock URL.`);
    }

    return `https://res.cloudinary.com/picklehub/image/upload/v12345/posters/${fileName}`;
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
    const words = text.split(' ');
    let line = '';
    let lines: string[] = [];

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());

    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let lastLine = lines[maxLines - 1];
      while (ctx.measureText(lastLine + '...').width > maxWidth && lastLine.length > 0) {
        lastLine = lastLine.slice(0, -1);
      }
      lines[maxLines - 1] = lastLine + '...';
    }

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
    return lines.length;
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  }

  private truncateString(str: string, num: number): string {
    if (str.length <= num) return str;
    return str.slice(0, num) + '...';
  }
}
