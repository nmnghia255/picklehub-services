import { Controller, Post, Get, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, BadRequestException, Headers, UnauthorizedException, Query, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation, ApiCreatedResponse, ApiBadRequestResponse, ApiInternalServerErrorResponse, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { CloudinaryService } from './cloudinary/cloudinary.service';

@ApiTags('media')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('images')
  @ApiOperation({ summary: 'Upload an image to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload (png, jpeg, jpg). Max size: 5MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Image successfully uploaded',
    schema: {
      example: {
        url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/picklehub/sample.jpg',
        publicId: 'picklehub/sample',
        format: 'jpg',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (e.g., file too large, invalid format, or missing file)',
    schema: {
      example: {
        message: 'Validation failed (expected size is less than 5242880)',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'An error occurred during upload to Cloudinary',
    schema: {
      example: {
        message: 'Unknown Cloudinary Error',
        error: 'Internal Server Error',
        statusCode: 500,
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB max
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
        ],
      }),
    ) file: any,
  ) {
    const result = await this.cloudinaryService.uploadFile(file, 'picklehub');
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
    };
  }

  @Post('csv')
  @ApiOperation({ summary: 'Upload a CSV file to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file to upload. Max size: 10MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'CSV successfully uploaded',
    schema: {
      example: {
        url: 'https://res.cloudinary.com/demo/raw/upload/v1234567890/picklehub/reports/revenue-report.csv',
        publicId: 'picklehub/reports/revenue-report',
        format: 'csv',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (e.g., file too large, invalid format, or missing file)',
  })
  @ApiInternalServerErrorResponse({
    description: 'An error occurred during upload to Cloudinary',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 }),
        ],
      }),
    ) file: any,
    @Headers('x-internal-service-token') serviceToken?: string,
  ) {
    const validToken = process.env.SERVICE_INTERNAL_TOKEN;
    if (!serviceToken || serviceToken !== validToken) {
      throw new UnauthorizedException('Invalid service token');
    }

    const mimeType = String(file?.mimetype ?? '').toLowerCase();
    const originalName = String(file?.originalname ?? '').toLowerCase();
    const isCsvMimeType = ['text/csv', 'application/csv', 'application/vnd.ms-excel'].includes(mimeType);
    const isCsvExtension = originalName.endsWith('.csv');

    if (!isCsvMimeType && !isCsvExtension) {
      throw new BadRequestException('Validation failed (expected type is text/csv, application/csv, or application/vnd.ms-excel)');
    }

    const result = await this.cloudinaryService.uploadFile(file, 'picklehub/reports', 'raw');
    return {
      url: (result as any).secure_url ?? (result as any).url,
      publicId: result.public_id,
      format: result.format,
    };
  }

  @Post('documents')
  @ApiOperation({ summary: 'Upload a document file to Cloudinary (e.g., for coach certifications)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file to upload (pdf only). Max size: 10MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Document successfully uploaded',
    schema: {
      example: {
        url: 'https://res.cloudinary.com/demo/raw/upload/v1234567890/picklehub/documents/certificate.pdf',
        publicId: 'picklehub/documents/certificate',
        format: 'pdf',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (e.g., file too large, invalid format, or missing file)',
  })
  @ApiInternalServerErrorResponse({
    description: 'An error occurred during upload to Cloudinary',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 10 }), // 10MB
        ],
      }),
    ) file: any,
  ) {
    const mimeType = String(file?.mimetype ?? '').toLowerCase();
    const originalName = String(file?.originalname ?? '').toLowerCase();
    const validMimeTypes = [
      'application/pdf',
    ];
    
    const isValidMime = validMimeTypes.includes(mimeType);
    const isValidExt = originalName.match(/\.(pdf)$/);

    if (!isValidMime && !isValidExt) {
      throw new BadRequestException('Validation failed (expected type is pdf)');
    }

    const result = await this.cloudinaryService.uploadFile(file, 'picklehub/documents', 'raw');
    const cloudinaryUrl = (result as any).secure_url ?? (result as any).url;
    
    // For PDFs, we proxy the download to attach the correct extension and bypass Cloudinary's block
    const finalUrl = `https://api.picklehub.vn/api/media/documents/download?url=${encodeURIComponent(cloudinaryUrl)}&filename=${encodeURIComponent(originalName)}`;

    return {
      url: finalUrl,
      publicId: result.public_id,
      format: result.format,
    };
  }

  @Get('documents/download')
  @ApiOperation({ summary: 'Proxy download for raw documents (bypasses Cloudinary PDF restrictions)' })
  async downloadDocument(
    @Query('url') url: string,
    @Query('filename') filename: string,
    @Res() res: any,
  ) {
    if (!url || !filename) {
      throw new BadRequestException('url and filename query parameters are required');
    }
    
    if (!url.startsWith('https://res.cloudinary.com/')) {
      throw new BadRequestException('Invalid URL');
    }

    const https = require('https');
    https.get(url, (cloudinaryRes: any) => {
      res.setHeader('Content-Type', filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      cloudinaryRes.pipe(res);
    }).on('error', (err: any) => {
      res.status(500).send('Error downloading file');
    });
  }

  @Get('health')
  @ApiOperation({ summary: 'Check service health status' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'ok',
        service: 'media-service',
        timestamp: '2024-03-05T10:51:28Z',
      },
    },
  })
  healthCheck() {
    return {
      status: 'ok',
      service: 'media-service',
      timestamp: new Date().toISOString(),
    };
  }
}
