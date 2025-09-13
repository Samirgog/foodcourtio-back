import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  CreateNotificationDto,
  BulkNotificationDto,
  NotificationPreferenceDto,
  NotificationSettingsDto,
  MarkNotificationReadDto,
  TestNotificationDto,
  NotificationResponseDto,
  NotificationStatsDto,
  NotificationChannel,
  NotificationTemplate,
} from './dto/notification.dto';
import { Role, User } from '@prisma/client';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Create and send a notification' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Notification created and sent successfully',
    type: NotificationResponseDto,
  })
  async createNotification(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.notificationsService.createNotification(createNotificationDto);
  }

  @Post('bulk')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Send bulk notifications to multiple recipients' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bulk notifications sent successfully',
    schema: {
      type: 'object',
      properties: {
        sent: { type: 'number' },
        failed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async sendBulkNotification(
    @Body() bulkNotificationDto: BulkNotificationDto,
    @CurrentUser() currentUser: User,
  ) {
    const result = await this.notificationsService.sendBulkNotification(bulkNotificationDto);
    
    return {
      ...result,
      message: `Notifications sent to ${result.sent} recipients, ${result.failed} failed`,
    };
  }

  @Get('my-notifications')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: 'boolean',
    description: 'Show only unread notifications',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User notifications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        notifications: {
          type: 'array',
          items: { $ref: '#/components/schemas/NotificationResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async getMyNotifications(
    @CurrentUser() currentUser: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    const showUnreadOnly = unreadOnly === 'true';

    const { notifications, total } = await this.notificationsService.getUserNotifications(
      currentUser.id,
      pageNum,
      limitNum,
      showUnreadOnly,
    );

    return {
      notifications,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Patch(':id/read')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification marked as read successfully',
  })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.notificationsService.markAsRead(id, currentUser.id);
    return { message: 'Notification marked as read' };
  }

  @Get('stats')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiQuery({
    name: 'restaurantId',
    required: false,
    description: 'Filter by restaurant ID (restaurant owners only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification statistics retrieved successfully',
    type: NotificationStatsDto,
  })
  async getNotificationStats(
    @CurrentUser() currentUser: User,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.notificationsService.getNotificationStats(
      currentUser.role === Role.SUPERADMIN ? undefined : currentUser.id,
      restaurantId,
    );
  }

  @Post('test')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Send test notification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test notification sent successfully',
  })
  async sendTestNotification(
    @Body() testNotificationDto: TestNotificationDto,
    @CurrentUser() currentUser: User,
  ) {
    await this.notificationsService.createNotification({
      template: NotificationTemplate.SYSTEM_MAINTENANCE,
      recipientId: testNotificationDto.recipientId,
      channels: [testNotificationDto.channel],
      customTitle: 'Test Notification',
      customMessage: testNotificationDto.message || 'This is a test notification from FoodcourtIO.',
    });

    return { message: 'Test notification sent successfully' };
  }

  // Event-triggered notifications (called by other modules)

  @Post('events/order-created')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Trigger order created notifications' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order created notifications sent',
  })
  async onOrderCreated(
    @Body() data: { orderId: string },
    @CurrentUser() currentUser: User,
  ) {
    await this.notificationsService.onOrderCreated(data.orderId);
    return { message: 'Order created notifications sent' };
  }

  @Post('events/order-status-updated')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Trigger order status update notifications' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order status update notifications sent',
  })
  async onOrderStatusUpdated(
    @Body() data: { orderId: string; status: string },
    @CurrentUser() currentUser: User,
  ) {
    await this.notificationsService.onOrderStatusUpdated(data.orderId, data.status);
    return { message: 'Order status update notifications sent' };
  }

  @Post('events/payment-received')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Trigger payment received notifications' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment received notifications sent',
  })
  async onPaymentReceived(
    @Body() data: { paymentId: string },
    @CurrentUser() currentUser: User,
  ) {
    await this.notificationsService.onPaymentReceived(data.paymentId);
    return { message: 'Payment received notifications sent' };
  }

  // User notification preferences

  @Get('preferences')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get user notification preferences' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification preferences retrieved successfully',
  })
  async getNotificationPreferences(@CurrentUser() currentUser: User) {
    // Implementation would fetch from database
    return {
      emailEnabled: true,
      telegramEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      frequency: 'INSTANT',
      templates: {
        [NotificationTemplate.ORDER_CREATED]: {
          enabled: true,
          channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
        },
        [NotificationTemplate.ORDER_STATUS_UPDATED]: {
          enabled: true,
          channels: [NotificationChannel.TELEGRAM, NotificationChannel.PUSH],
        },
        [NotificationTemplate.PAYMENT_RECEIVED]: {
          enabled: true,
          channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
        },
        // ... other templates
      },
    };
  }

  @Patch('preferences')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification preferences updated successfully',
  })
  async updateNotificationPreferences(
    @Body() notificationSettingsDto: NotificationSettingsDto,
    @CurrentUser() currentUser: User,
  ) {
    // Implementation would save to database
    return { message: 'Notification preferences updated successfully' };
  }

  // Restaurant-specific notifications

  @Post('restaurant/:restaurantId/broadcast')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Broadcast notification to restaurant staff' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Broadcast sent to restaurant staff',
  })
  async broadcastToRestaurantStaff(
    @Param('restaurantId') restaurantId: string,
    @Body() broadcastData: {
      title: string;
      message: string;
      roles?: string[];
      urgent?: boolean;
    },
    @CurrentUser() currentUser: User,
  ) {
    const result = await this.notificationsService.sendBulkNotification({
      template: NotificationTemplate.SYSTEM_MAINTENANCE, // Generic template
      targetCriteria: {
        restaurantIds: [restaurantId],
        roles: broadcastData.roles || ['MANAGER', 'CASHIER', 'COOK', 'WAITER'],
      },
      channels: broadcastData.urgent
        ? [NotificationChannel.TELEGRAM, NotificationChannel.PUSH]
        : [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      customTitle: broadcastData.title,
      customMessage: broadcastData.message,
    });

    return {
      ...result,
      message: `Broadcast sent to ${result.sent} staff members`,
    };
  }

  @Get('restaurant/:restaurantId/stats')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get notification statistics for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Restaurant notification statistics retrieved successfully',
    type: NotificationStatsDto,
  })
  async getRestaurantNotificationStats(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.notificationsService.getNotificationStats(undefined, restaurantId);
  }

  // System-wide notifications (superadmin only)

  @Post('system/emergency-broadcast')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Send emergency broadcast to all users (superadmin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emergency broadcast sent successfully',
  })
  async sendEmergencyBroadcast(
    @Body() emergencyData: {
      title: string;
      message: string;
      targetRestaurants?: string[];
      roles?: string[];
    },
    @CurrentUser() currentUser: User,
  ) {
    const result = await this.notificationsService.sendBulkNotification({
      template: NotificationTemplate.SYSTEM_MAINTENANCE,
      targetCriteria: {
        restaurantIds: emergencyData.targetRestaurants,
        roles: emergencyData.roles,
      },
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL, NotificationChannel.PUSH],
      priority: 'URGENT' as any,
      customTitle: `🚨 ${emergencyData.title}`,
      customMessage: emergencyData.message,
    });

    return {
      ...result,
      message: `Emergency broadcast sent to ${result.sent} users`,
    };
  }

  @Get('system/health')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Get notification system health' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification system health retrieved',
  })
  async getSystemHealth(@CurrentUser() currentUser: User) {
    return {
      status: 'healthy',
      scheduledJobsRunning: true,
      telegramBotConnected: true,
      emailServiceConnected: true,
      smsServiceConnected: false,
      pushServiceConnected: true,
      lastProcessedScheduledNotification: new Date(),
      pendingNotifications: 0,
      failedNotificationsLast24h: 0,
    };
  }

  // Utility endpoints

  @Get('templates/available')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get available notification templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available notification templates',
  })
  async getAvailableTemplates() {
    return {
      templates: Object.values(NotificationTemplate).map(template => ({
        id: template,
        name: template.replace(/_/g, ' ').toLowerCase(),
        description: `Template for ${template.replace(/_/g, ' ').toLowerCase()} notifications`,
        channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
        priority: 'NORMAL',
      })),
    };
  }

  @Get('channels/available')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get available notification channels' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available notification channels',
  })
  async getAvailableChannels() {
    return {
      channels: [
        {
          id: NotificationChannel.TELEGRAM,
          name: 'Telegram',
          description: 'Send notifications via Telegram bot',
          enabled: true,
          requiresSetup: 'User must link Telegram account',
        },
        {
          id: NotificationChannel.EMAIL,
          name: 'Email',
          description: 'Send notifications via email',
          enabled: true,
          requiresSetup: 'Valid email address required',
        },
        {
          id: NotificationChannel.SMS,
          name: 'SMS',
          description: 'Send notifications via SMS',
          enabled: false,
          requiresSetup: 'Phone number required (not implemented)',
        },
        {
          id: NotificationChannel.PUSH,
          name: 'Push Notifications',
          description: 'Browser/app push notifications',
          enabled: true,
          requiresSetup: 'Browser permission required',
        },
        {
          id: NotificationChannel.IN_APP,
          name: 'In-App',
          description: 'Notifications within the application',
          enabled: true,
          requiresSetup: 'None',
        },
      ],
    };
  }
}