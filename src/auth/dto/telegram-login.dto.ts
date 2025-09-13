import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TelegramLoginDto {
  @ApiProperty({
    description: 'Telegram init data string from mini app',
    example: 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397...',
  })
  @IsString()
  @IsNotEmpty()
  initData: string;
}

export class TelegramUserData {
  @ApiProperty({ description: 'Telegram user ID' })
  id: number;

  @ApiProperty({ description: 'User first name' })
  first_name: string;

  @ApiProperty({ description: 'User last name', required: false })
  last_name?: string;

  @ApiProperty({ description: 'Username', required: false })
  username?: string;

  @ApiProperty({ description: 'Language code', required: false })
  language_code?: string;

  @ApiProperty({ description: 'Profile photo URL', required: false })
  photo_url?: string;

  @ApiProperty({ description: 'Whether user allows write access', required: false })
  allows_write_to_pm?: boolean;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  access_token: string;

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    telegramId: string;
    name: string;
    username?: string;
    avatar?: string;
    role: string;
  };

  @ApiProperty({ description: 'Whether this is a new user registration' })
  isNewUser: boolean;
}