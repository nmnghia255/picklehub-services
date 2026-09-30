import { ApiProperty } from '@nestjs/swagger';

export class TournamentCenterCourtDto {
  @ApiProperty({ example: 'e3bc6784-b972-4e92-9b01-f21ddb56dd63' })
  courtId!: string;

  @ApiProperty({ example: 'San 1' })
  name!: string;

  @ApiProperty({ example: 'INDOOR', nullable: true })
  type!: string | null;

  @ApiProperty({ example: 'ACTIVE', nullable: true })
  status!: string | null;
}

export class TournamentCenterDto {
  @ApiProperty({ example: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a' })
  centerId!: string;

  @ApiProperty({ example: 'PickleHub District 1', nullable: true })
  name!: string | null;

  @ApiProperty({ example: '123 Nguyen Hue, District 1', nullable: true })
  address!: string | null;

  @ApiProperty({ example: 'ACTIVE', nullable: true })
  status!: string | null;

  @ApiProperty({ description: 'False if the center no longer resolves in sport-center', example: true })
  exists!: boolean;

  @ApiProperty({ type: [TournamentCenterCourtDto] })
  courts!: TournamentCenterCourtDto[];
}

export class CenterListResponseDto {
  @ApiProperty({ type: [TournamentCenterDto] })
  data!: TournamentCenterDto[];

  @ApiProperty({ description: 'List metadata', example: { total: 2 } })
  meta!: { total: number };
}
