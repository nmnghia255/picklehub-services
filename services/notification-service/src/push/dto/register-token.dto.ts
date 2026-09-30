import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTokenDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description:
      'Expo push token obtained via `Notifications.getExpoPushTokenAsync()` from expo-notifications. ' +
      'Must start with "ExponentPushToken[" to be a valid Expo push token.',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    example: 'android',
    description: 'Platform of the device. Primary target is Android.',
    required: false,
    enum: ['android', 'ios'],
  })
  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: 'android' | 'ios';
}
