import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { UpdateRegistrationDto } from './dto/update-registration.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { RegistrationStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Tournament Registrations')
@Controller()
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) { }

  @Post(':tournamentId/events/:eventId/registrations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Register for a tournament event',
    description: 'Enables a player to sign up (with or without a partner) for a specific event division. Initial status is pending. Enforces gender matching validations based on the event\'s policy, and checks gender-specific capacity limits for Mixed Doubles (e.g. max N males and N females for N teams capacity).',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The target event division ID' })
  @ApiResponse({ status: 201, description: 'Registration initialized successfully.', type: RegistrationResponseDto })
  @ApiResponse({ status: 400, description: 'Tournament closed, capacity exceeded, incorrect gender configuration, or gender capacity limits reached.' })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() createRegistrationDto: CreateRegistrationDto,
  ) {
    return this.registrationsService.create(tournamentId, eventId, createRegistrationDto);
  }

  @Get(':tournamentId/registrations')
  @ApiOperation({
    summary: 'List tournament registrations',
    description: 'Retrieves registrations list for the tournament, filterable by event and status.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiQuery({ name: 'eventId', required: false, type: Number, description: 'Filter by event ID' })
  @ApiQuery({ name: 'status', required: false, enum: RegistrationStatus, description: 'Filter by approval status' })
  @ApiResponse({ status: 200, description: 'Registrations retrieved successfully.', type: [RegistrationResponseDto] })
  findAll(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query('eventId') eventId?: number,
    @Query('status') status?: RegistrationStatus,
  ) {
    return this.registrationsService.findAll(tournamentId, eventId, status);
  }

  @Get(':tournamentId/registrations/:id')
  @ApiOperation({
    summary: 'Get registration details',
    description: 'Retrieves full details of a specific registration.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique registration ID' })
  @ApiResponse({ status: 200, description: 'Registration detail retrieved.', type: RegistrationResponseDto })
  @ApiResponse({ status: 404, description: 'Registration not found.' })
  findOne(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.registrationsService.findOne(tournamentId, id);
  }

  @Patch(':tournamentId/registrations/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update registration status',
    description: 'Allows tournament organizers to approve/reject registrations. Approving creates a team & increments event counts, and maps player age and gender fields to the created Team. Re-validates gender-specific capacities for Mixed events when transitioning from withdrawn/rejected.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique registration ID' })
  @ApiResponse({ status: 200, description: 'Registration status updated.', type: RegistrationResponseDto })
  updateStatus(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRegistrationDto: UpdateRegistrationDto,
  ) {
    return this.registrationsService.update(tournamentId, id, updateRegistrationDto);
  }

  @Patch(':tournamentId/registrations/:id/payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update payment confirmation',
    description: 'Allows tournament organizers to confirm manual payments, updating payment transaction records.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique registration ID' })
  @ApiResponse({ status: 200, description: 'Payment status updated.', type: RegistrationResponseDto })
  updatePayment(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRegistrationDto: UpdateRegistrationDto,
  ) {
    return this.registrationsService.update(tournamentId, id, updateRegistrationDto);
  }

  @Post(':tournamentId/registrations/:id/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Notify as paid and submit payment proof for registration',
    description: 'Enables a player to notify as paid and upload a payment proof (receipt image/screenshot) after their registration is approved.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique registration ID' })
  @ApiResponse({ status: 200, description: 'Payment proof submitted successfully, status changed to verifying.', type: RegistrationResponseDto })
  submitPaymentProof(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() submitPaymentProofDto: SubmitPaymentProofDto,
  ) {
    return this.registrationsService.submitPaymentProof(tournamentId, id, submitPaymentProofDto);
  }

  @Delete(':tournamentId/registrations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete a registration record',
    description: 'Deletes a registration record (if not approved). Also deletes corresponding transaction logs.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique registration ID' })
  @ApiResponse({ status: 200, description: 'Registration deleted successfully.', type: RegistrationResponseDto })
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.registrationsService.remove(tournamentId, id);
  }
}
