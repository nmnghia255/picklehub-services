import { IsString, IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventType, Gender } from '@prisma/client';

export class CreateEventDto {
  @ApiProperty({ description: 'The name of the event category', example: 'Men Singles 3.5+' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'The match type', enum: EventType, example: 'Singles' })
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ description: 'The skill rating range allowed', example: '3.0 - 3.5' })
  @IsString()
  skillRange: string;

  @ApiProperty({ description: 'The gender division of the event', enum: Gender, example: 'Men' })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ description: 'Maximum number of participants/teams in the event', example: 16 })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ description: 'Entry registration fee for the event', example: 200000 })
  @IsInt()
  @Min(0)
  entryFee: number;
}
