import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  IsEnum,
  IsArray,
  IsBoolean,
} from 'class-validator';

export enum TelegramCommandType {
  START = '/start',
  HELP = '/help',
  STATUS = '/status',
  ORDERS = '/orders',
  CLOCK_IN = '/clockin',
  CLOCK_OUT = '/clockout',
  MENU = '/menu',
  SCHEDULE = '/schedule',
  STATS = '/stats',
}

export enum NotificationType {
  NEW_ORDER = 'NEW_ORDER',
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  SHIFT_REMINDER = 'SHIFT_REMINDER',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  EMPLOYEE_CLOCK_IN = 'EMPLOYEE_CLOCK_IN',
  EMPLOYEE_CLOCK_OUT = 'EMPLOYEE_CLOCK_OUT',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export class TelegramWebhookDto {
  @ApiProperty({ description: 'Telegram update ID' })
  @IsNumber()
  update_id: number;

  @ApiProperty({ description: 'Message object', required: false })
  @IsObject()
  @IsOptional()
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
  };

  @ApiProperty({ description: 'Callback query object', required: false })
  @IsObject()
  @IsOptional()
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    message: any;
    data: string;
  };
}

export class SendNotificationDto {
  @ApiProperty({ description: 'Telegram chat ID or user ID' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'Additional data for the notification', required: false })
  @IsObject()
  @IsOptional()
  data?: any;

  @ApiProperty({ description: 'Inline keyboard buttons', required: false })
  @IsArray()
  @IsOptional()
  buttons?: {
    text: string;
    callback_data: string;
    url?: string;
  }[];

  @ApiProperty({ description: 'Whether to send silently', default: false })
  @IsBoolean()
  @IsOptional()
  silent?: boolean;
}

export class BroadcastNotificationDto {
  @ApiProperty({ description: 'Restaurant ID to broadcast to' })
  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Target employee roles', required: false })
  @IsArray()
  @IsOptional()
  roles?: string[];

  @ApiProperty({ description: 'Notification type', enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'Additional data for the notification', required: false })
  @IsObject()
  @IsOptional()
  data?: any;

  @ApiProperty({ description: 'Inline keyboard buttons', required: false })
  @IsArray()
  @IsOptional()
  buttons?: {
    text: string;
    callback_data: string;
    url?: string;
  }[];
}

export class TelegramCommandResponseDto {
  @ApiProperty({ description: 'Response message' })
  message: string;

  @ApiProperty({ description: 'Whether the command was successful' })
  success: boolean;

  @ApiProperty({ description: 'Additional data', required: false })
  data?: any;

  @ApiProperty({ description: 'Inline keyboard buttons', required: false })
  buttons?: {
    text: string;
    callback_data: string;
    url?: string;
  }[];
}

export class RegisterBotUserDto {
  @ApiProperty({ description: 'Telegram chat ID' })
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @ApiProperty({ description: 'User ID from the system' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Restaurant ID (for employees)', required: false })
  @IsString()
  @IsOptional()
  restaurantId?: string;
}

export class TelegramBotStatsDto {
  @ApiProperty({ description: 'Total registered bot users' })
  totalUsers: number;

  @ApiProperty({ description: 'Active users (sent message in last 24h)' })
  activeUsers: number;

  @ApiProperty({ description: 'Messages sent today' })
  messagesSentToday: number;

  @ApiProperty({ description: 'Commands processed today' })
  commandsProcessedToday: number;

  @ApiProperty({ description: 'Users by type' })
  usersByType: {
    type: string;
    count: number;
  }[];

  @ApiProperty({ description: 'Most used commands' })
  popularCommands: {
    command: string;
    count: number;
  }[];

  @ApiProperty({ description: 'Bot uptime' })
  uptime: string;
}