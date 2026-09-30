import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';

export class BookingItemDto {
  @ApiProperty({ description: 'Sport-center court id', example: 'c0010000-c001-4000-8000-000000020001' })
  @IsUUID('all')
  courtId!: string;

  @ApiProperty({ description: 'Slot start (HH:mm, 30-min aligned)', example: '17:30' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ description: 'Slot end (HH:mm, 30-min aligned)', example: '19:00' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:mm' })
  endTime!: string;
}

export class MultiDayBookingItemDto {
  @ApiProperty({ description: 'Booking date (YYYY-MM-DD)', example: '2026-06-20' })
  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ApiProperty({ type: [BookingItemDto], description: 'Court/time slots to book in this center on this date' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items!: BookingItemDto[];
}

export class CreateBookingDto {
  @ApiProperty({ description: 'A selected center id', example: 'c0000000-c000-4000-8000-000000000002' })
  @IsUUID('all')
  centerId!: string;

  @ApiProperty({ type: [MultiDayBookingItemDto], description: 'List of bookings per day' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MultiDayBookingItemDto)
  bookings!: MultiDayBookingItemDto[];

  @ApiPropertyOptional({ description: 'Name attached to the bookings', example: 'Tournament Organizer' })
  @IsOptional()
  @IsString()
  playerName?: string;

  @ApiProperty({ description: 'Contact phone for the bookings', example: '+84 90 123 4567' })
  @IsString()
  @MaxLength(20)
  phoneNumber!: string;
}

