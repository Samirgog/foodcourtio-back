import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsBoolean,
  IsUUID,
  IsDateString,
} from 'class-validator';

export enum NotificationChannel {
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
}

export enum NotificationTemplate {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_STATUS_UPDATED = 'ORDER_STATUS_UPDATED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  EMPLOYEE_CLOCKED_IN = 'EMPLOYEE_CLOCKED_IN',
  EMPLOYEE_CLOCKED_OUT = 'EMPLOYEE_CLOCKED_OUT',
  SHIFT_REMINDER = 'SHIFT_REMINDER',
  SHIFT_MISSED = 'SHIFT_MISSED',
  EMPLOYEE_INVITED = 'EMPLOYEE_INVITED',
  RESTAURANT_PUBLISHED = 'RESTAURANT_PUBLISHED',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  COMMISSION_REPORT = 'COMMISSION_REPORT',
  DAILY_SALES_REPORT = 'DAILY_SALES_REPORT',
  INVENTORY_LOW = 'INVENTORY_LOW',
  CUSTOMER_FEEDBACK = 'CUSTOMER_FEEDBACK',
}

export class CreateNotificationDto {
  @ApiProperty({ description: 'Notification template type', enum: NotificationTemplate })
  @IsEnum(NotificationTemplate)
  template: NotificationTemplate;

  @ApiProperty({ description: 'Recipient user ID' })
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({ 
    description: 'Notification channels to send through',
    enum: NotificationChannel,
    isArray: true
  })
  @IsEnum(NotificationChannel, { each: true })
  @IsArray()
  channels: NotificationChannel[];

  @ApiProperty({ description: 'Notification priority', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiProperty({ description: 'Custom notification title', required: false })
  @IsString()
  @IsOptional()
  customTitle?: string;

  @ApiProperty({ description: 'Custom notification message', required: false })
  @IsString()
  @IsOptional()
  customMessage?: string;

  @ApiProperty({ description: 'Template variables for dynamic content', required: false })
  @IsObject()
  @IsOptional()
  templateVariables?: Record<string, any>;

  @ApiProperty({ description: 'Schedule notification for later', required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({ description: 'Related entity ID (order, payment, etc.)', required: false })
  @IsString()
  @IsOptional()
  relatedEntityId?: string;

  @ApiProperty({ description: 'Related entity type', required: false })
  @IsString()
  @IsOptional()
  relatedEntityType?: string;

  @ApiProperty({ description: 'Action buttons for interactive notifications', required: false })
  @IsArray()
  @IsOptional()
  actionButtons?: {
    text: string;
    action: string;
    url?: string;
  }[];
}

export class BulkNotificationDto {
  @ApiProperty({ description: 'Notification template type', enum: NotificationTemplate })
  @IsEnum(NotificationTemplate)
  template: NotificationTemplate;

  @ApiProperty({ description: 'Target criteria for recipients' })
  @IsObject()
  targetCriteria: {
    restaurantIds?: string[];
    roles?: string[];
    userIds?: string[];
    locations?: string[];
  };

  @ApiProperty({ 
    description: 'Notification channels to send through',
    enum: NotificationChannel,
    isArray: true
  })
  @IsEnum(NotificationChannel, { each: true })
  @IsArray()
  channels: NotificationChannel[];

  @ApiProperty({ description: 'Notification priority', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiProperty({ description: 'Custom notification title', required: false })
  @IsString()
  @IsOptional()
  customTitle?: string;

  @ApiProperty({ description: 'Custom notification message', required: false })
  @IsString()
  @IsOptional()
  customMessage?: string;

  @ApiProperty({ description: 'Template variables for dynamic content', required: false })
  @IsObject()
  @IsOptional()
  templateVariables?: Record<string, any>;

  @ApiProperty({ description: 'Schedule notification for later', required: false })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}

export class NotificationPreferenceDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Notification template preferences' })
  @IsObject()
  preferences: Record<NotificationTemplate, {
    channels: NotificationChannel[];
    enabled: boolean;
    frequency?: 'INSTANT' | 'HOURLY' | 'DAILY' | 'WEEKLY';
  }>;
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ description: 'Notification template', enum: NotificationTemplate })
  template: NotificationTemplate;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiProperty({ description: 'Notification message' })
  message: string;

  @ApiProperty({ description: 'Recipient user ID' })
  recipientId: string;

  @ApiProperty({ description: 'Notification channels', enum: NotificationChannel, isArray: true })
  channels: NotificationChannel[];

  @ApiProperty({ description: 'Notification priority', enum: NotificationPriority })
  priority: NotificationPriority;

  @ApiProperty({ description: 'Notification status', enum: NotificationStatus })
  status: NotificationStatus;

  @ApiProperty({ description: 'Scheduled send time', required: false })
  scheduledAt?: Date;

  @ApiProperty({ description: 'Actual send time', required: false })
  sentAt?: Date;

  @ApiProperty({ description: 'Delivery confirmation time', required: false })
  deliveredAt?: Date;

  @ApiProperty({ description: 'Read confirmation time', required: false })
  readAt?: Date;

  @ApiProperty({ description: 'Creation time' })
  createdAt: Date;

  @ApiProperty({ description: 'Related entity ID', required: false })
  relatedEntityId?: string;

  @ApiProperty({ description: 'Related entity type', required: false })
  relatedEntityType?: string;

  @ApiProperty({ description: 'Action buttons', required: false })
  actionButtons?: {
    text: string;
    action: string;
    url?: string;
  }[];

  @ApiProperty({ description: 'Delivery results by channel', required: false })
  deliveryResults?: Record<NotificationChannel, {
    status: NotificationStatus;
    error?: string;
    deliveredAt?: Date;
  }>;
}

export class NotificationStatsDto {
  @ApiProperty({ description: 'Total notifications sent' })
  totalSent: number;

  @ApiProperty({ description: 'Total notifications delivered' })
  totalDelivered: number;

  @ApiProperty({ description: 'Total notifications read' })
  totalRead: number;

  @ApiProperty({ description: 'Total notifications failed' })
  totalFailed: number;

  @ApiProperty({ description: 'Delivery rate percentage' })
  deliveryRate: number;

  @ApiProperty({ description: 'Read rate percentage' })
  readRate: number;

  @ApiProperty({ description: 'Stats by channel' })
  statsByChannel: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
  }>;

  @ApiProperty({ description: 'Stats by template' })
  statsByTemplate: Record<NotificationTemplate, {
    sent: number;
    delivered: number;
    read: number;
  }>;

  @ApiProperty({ description: 'Recent activity (last 24h)' })
  recentActivity: {
    hour: number;
    sent: number;
    delivered: number;
  }[];
}

export class MarkNotificationReadDto {
  @ApiProperty({ description: 'Notification ID' })
  @IsUUID()
  @IsNotEmpty()
  notificationId: string;

  @ApiProperty({ description: 'Read timestamp', required: false })
  @IsDateString()
  @IsOptional()
  readAt?: string;
}

export class NotificationSettingsDto {
  @ApiProperty({ description: 'Enable email notifications', default: true })
  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @ApiProperty({ description: 'Enable SMS notifications', default: false })
  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;

  @ApiProperty({ description: 'Enable Telegram notifications', default: true })
  @IsBoolean()
  @IsOptional()
  telegramEnabled?: boolean;

  @ApiProperty({ description: 'Enable push notifications', default: true })
  @IsBoolean()
  @IsOptional()
  pushEnabled?: boolean;

  @ApiProperty({ description: 'Quiet hours start (24h format)', required: false })
  @IsString()
  @IsOptional()
  quietHoursStart?: string;

  @ApiProperty({ description: 'Quiet hours end (24h format)', required: false })
  @IsString()
  @IsOptional()
  quietHoursEnd?: string;

  @ApiProperty({ description: 'Timezone for quiet hours', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ description: 'Notification frequency preference' })
  @IsEnum(['INSTANT', 'HOURLY', 'DAILY'])
  @IsOptional()
  frequency?: 'INSTANT' | 'HOURLY' | 'DAILY';
}

export class TestNotificationDto {
  @ApiProperty({ description: 'Recipient user ID for test' })
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({ description: 'Test notification channel', enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ description: 'Test message', required: false })
  @IsString()
  @IsOptional()
  message?: string;
}