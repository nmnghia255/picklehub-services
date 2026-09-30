import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { CheckInService } from './check-in.service';
import { CheckInRequestDto } from './dto/check-in-request.dto';
import { CheckInResponseDto } from './dto/check-in-response.dto';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Tournament Check-ins')
@Controller(':tournamentId')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post('registrations/:registrationId/check-in')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Check in a player',
    description: 'Enables tournament organizers or check-in counters to record VĐV attendance at the venue.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'registrationId', type: Number, description: 'The registration ID' })
  @ApiResponse({ status: 201, description: 'Check-in state recorded successfully.', type: CheckInResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid check-in state or registration not approved.' })
  performCheckIn(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('registrationId', ParseIntPipe) registrationId: number,
    @Body() checkInRequestDto: CheckInRequestDto,
  ) {
    return this.checkInService.performCheckIn(tournamentId, registrationId, checkInRequestDto.player);
  }

  @Get('check-ins')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get all tournament check-ins',
    description: 'Retrieves check-in logs and attendance list for the tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiResponse({ status: 200, description: 'Check-in list retrieved successfully.', type: [CheckInResponseDto] })
  getCheckIns(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.checkInService.getCheckIns(tournamentId);
  }
}
