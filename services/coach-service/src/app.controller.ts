import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'UP', service: 'coach-service' };
  }
}
