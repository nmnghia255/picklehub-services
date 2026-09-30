import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GroupStageMembershipResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 10 })
  groupId: number;

  @ApiProperty({ example: 101 })
  teamId: number;

  @ApiProperty({ example: 'John / Jane' })
  teamName: string;

  @ApiPropertyOptional({ example: 1 })
  seed: number | null;

  @ApiProperty({ example: 3 })
  wins: number;

  @ApiProperty({ example: 1 })
  draws: number;

  @ApiProperty({ example: 0 })
  losses: number;

  @ApiProperty({ example: 10 })
  points: number;

  @ApiProperty({ example: 6 })
  gameDiff: number;

  @ApiProperty({ example: false })
  isAdvanced: boolean;
}

export class GroupStageGroupResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Group A' })
  name: string;

  @ApiProperty({ example: 0 })
  order: number;

  @ApiProperty({ type: [GroupStageMembershipResponseDto] })
  memberships: GroupStageMembershipResponseDto[];
}
