import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Event service welcome endpoint',
    description: 'Returns a simple message to confirm event-service is reachable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is reachable',
    schema: {
      example: {
        message: 'Event service is running',
      },
    },
  })
  getHello(): { message: string } {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns runtime health information for event-service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      example: {
        status: 'ok',
        service: 'event-service',
        timestamp: '2026-03-24T07:00:00.000Z',
      },
    },
  })
  healthCheck(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'event-service',
      timestamp: new Date().toISOString(),
    };
  }
}
