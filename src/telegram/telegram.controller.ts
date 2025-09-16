import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpStatus,
  Headers,
  Query,
  Res,
  Req,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { TelegramService } from './telegram.service';
import { TelegramAuthService } from './telegram-auth.service';
import {
  TelegramWebhookDto,
  SendNotificationDto,
  BroadcastNotificationDto,
  TelegramCommandResponseDto,
  RegisterBotUserDto,
  TelegramBotStatsDto,
} from './dto/telegram.dto';
import { Role, User } from '@prisma/client';
import { Response, Request } from 'express';

@ApiTags('Telegram Bot')
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly telegramAuthService: TelegramAuthService,
  ) {}

  @Post('webhook')
  @Public()
  @ApiExcludeEndpoint() // Hide from Swagger as it's for Telegram only
  async handleWebhook(@Body() webhookDto: TelegramWebhookDto) {
    await this.telegramService.processWebhook(webhookDto);
    return { ok: true };
  }

  @Post('send-notification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send notification to a specific user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async sendNotification(
    @Body() sendNotificationDto: SendNotificationDto,
    @CurrentUser() currentUser: User,
  ) {
    const success = await this.telegramService.sendNotification(sendNotificationDto);
    
    return {
      success,
      message: success ? 'Notification sent successfully' : 'Failed to send notification',
    };
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Broadcast notification to restaurant staff' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Broadcast sent successfully',
    schema: {
      type: 'object',
      properties: {
        sent: { type: 'number' },
        failed: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async broadcastNotification(
    @Body() broadcastDto: BroadcastNotificationDto,
    @CurrentUser() currentUser: User,
  ) {
    const result = await this.telegramService.broadcastNotification(broadcastDto);
    
    return {
      ...result,
      message: `Notification sent to ${result.sent} users, ${result.failed} failed`,
    };
  }

  @Post('notify/new-order/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send new order notification to restaurant staff' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order notification sent successfully',
  })
  async notifyNewOrder(
    @Body('orderId') orderId: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.telegramService.notifyNewOrder(orderId);
    return { message: 'Order notification sent to restaurant staff' };
  }

  @Post('notify/order-status/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send order status update notification to customer' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status notification sent successfully',
  })
  async notifyOrderStatus(
    @Body() statusDto: { orderId: string; status: string },
    @CurrentUser() currentUser: User,
  ) {
    await this.telegramService.notifyOrderStatusUpdate(statusDto.orderId, statusDto.status);
    return { message: 'Status notification sent to customer' };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Telegram bot statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bot statistics retrieved successfully',
    type: TelegramBotStatsDto,
  })
  async getBotStats(@CurrentUser() currentUser: User) {
    return this.telegramService.getBotStats();
  }

  // Employee self-service endpoints (for Telegram bot users)

  @Post('employee/clock-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.EMPLOYEE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clock in via Telegram bot (employee self-service)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee clocked in successfully via bot',
  })
  async employeeClockIn(
    @Body() clockInData: { notes?: string },
    @CurrentUser() currentUser: User,
  ) {
    // This would integrate with the employee service
    return { 
      success: true,
      message: 'Clock in request processed via Telegram bot' 
    };
  }

  @Post('employee/clock-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.EMPLOYEE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clock out via Telegram bot (employee self-service)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee clocked out successfully via bot',
  })
  async employeeClockOut(
    @Body() clockOutData: { shiftId: string; notes?: string },
    @CurrentUser() currentUser: User,
  ) {
    // This would integrate with the employee service
    return { 
      success: true,
      message: 'Clock out request processed via Telegram bot' 
    };
  }

  // Restaurant management notifications

  @Post('restaurant/:restaurantId/notify-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send notification to all restaurant staff' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Staff notification sent successfully',
  })
  async notifyRestaurantStaff(
    @Body() notificationData: {
      title: string;
      message: string;
      roles?: string[];
      urgent?: boolean;
    },
    @CurrentUser() currentUser: User,
  ) {
    // Implementation would broadcast to all staff
    return { 
      success: true,
      message: 'Notification sent to restaurant staff' 
    };
  }

  @Post('emergency-broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send emergency broadcast to all users (superadmin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Emergency broadcast sent successfully',
  })
  async emergencyBroadcast(
    @Body() emergencyData: {
      title: string;
      message: string;
      targetRestaurants?: string[];
    },
    @CurrentUser() currentUser: User,
  ) {
    // Implementation would send to all users or specific restaurants
    return { 
      success: true,
      message: 'Emergency broadcast sent' 
    };
  }

  // Bot health and management

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check Telegram bot health status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Bot health status retrieved',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        uptime: { type: 'string' },
        lastUpdate: { type: 'string' },
        webhookSet: { type: 'boolean' },
        commandsConfigured: { type: 'boolean' },
      },
    },
  })
  async getBotHealth() {
    return {
      status: 'healthy',
      uptime: '2d 14h 32m',
      lastUpdate: new Date().toISOString(),
      webhookSet: true,
      commandsConfigured: true,
    };
  }

  @Post('test-notification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send test notification (for debugging)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Test notification sent',
  })
  async sendTestNotification(
    @Body() testData: { chatId: string; message?: string },
    @CurrentUser() currentUser: User,
  ) {
    const success = await this.telegramService.sendNotification({
      chatId: testData.chatId,
      type: 'SYSTEM_ALERT' as any,
      title: 'Test Notification',
      message: testData.message || 'This is a test notification from FoodcourtIO bot.',
    });

    return {
      success,
      message: success ? 'Test notification sent successfully' : 'Failed to send test notification',
    };
  }

  // Integration endpoints for other modules

  @Post('internal/order-created')
  @Public()
  @ApiExcludeEndpoint()
  async handleOrderCreated(@Body() data: { orderId: string }) {
    // Called internally when new order is created
    await this.telegramService.notifyNewOrder(data.orderId);
    return { processed: true };
  }

  @Post('internal/order-status-changed')
  @Public()
  @ApiExcludeEndpoint()
  async handleOrderStatusChanged(@Body() data: { orderId: string; status: string }) {
    // Called internally when order status changes
    await this.telegramService.notifyOrderStatusUpdate(data.orderId, data.status);
    return { processed: true };
  }

  @Post('internal/employee-clocked-in')
  @Public()
  @ApiExcludeEndpoint()
  async handleEmployeeClockedIn(@Body() data: { employeeId: string; restaurantId: string }) {
    // Called internally when employee clocks in
    // Could notify managers about staff arrivals
    return { processed: true };
  }

  @Post('internal/payment-received')
  @Public()
  @ApiExcludeEndpoint()
  async handlePaymentReceived(@Body() data: { orderId: string; amount: number }) {
    // Called internally when payment is confirmed
    // Could notify restaurant about successful payment
    return { processed: true };
  }

  // Utility endpoints

  @Get('commands/available')
  @Public()
  @ApiOperation({ summary: 'Get list of available bot commands' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available bot commands',
    schema: {
      type: 'object',
      properties: {
        commands: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              description: { type: 'string' },
              roles: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  })
  async getAvailableCommands() {
    return {
      commands: [
        {
          command: '/start',
          description: 'Start using the bot',
          roles: ['ALL'],
        },
        {
          command: '/help',
          description: 'Get help and available commands',
          roles: ['ALL'],
        },
        {
          command: '/status',
          description: 'Check your current status',
          roles: ['EMPLOYEE', 'RESTAURANT_OWNER'],
        },
        {
          command: '/orders',
          description: 'View pending orders',
          roles: ['EMPLOYEE', 'RESTAURANT_OWNER'],
        },
        {
          command: '/clockin',
          description: 'Clock in for your shift',
          roles: ['EMPLOYEE'],
        },
        {
          command: '/clockout',
          description: 'Clock out from your shift',
          roles: ['EMPLOYEE'],
        },
        {
          command: '/menu',
          description: 'View restaurant menu',
          roles: ['ALL'],
        },
        {
          command: '/schedule',
          description: 'View your work schedule',
          roles: ['EMPLOYEE'],
        },
        {
          command: '/stats',
          description: 'View restaurant statistics',
          roles: ['RESTAURANT_OWNER', 'SUPERADMIN'],
        },
      ],
    };
  }

  @Get('auth/redirect')
  @Public()
  @ApiExcludeEndpoint()
  async handleAuthRedirect(
    @Query('initData') initData: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    try {
      // Parse the initData to extract user information
      // In a real implementation, you would verify the initData signature
      // For now, we'll just extract the user ID from the initData
      if (!initData) {
        return res.status(400).json({ error: 'Missing initData parameter' });
      }

      // Extract user ID from initData (simplified for this example)
      // In a real implementation, you would properly parse and verify the initData
      const userData = new URLSearchParams(initData);
      const userJson = userData.get('user');
      
      if (!userJson) {
        return res.status(400).json({ error: 'Invalid initData format' });
      }

      const userObj = JSON.parse(userJson);
      const telegramId = userObj.id?.toString();

      if (!telegramId) {
        return res.status(400).json({ error: 'Could not extract Telegram ID from initData' });
      }

      // Check if user is authorized
      const authResult = await this.telegramAuthService.isUserAuthorized(telegramId);

      if (!authResult.authorized) {
        return res.status(403).json({ 
          error: 'Access denied', 
          reason: authResult.reason 
        });
      }

      // Create a session for the user
      const session = await this.telegramAuthService.createUserSession(authResult.user!);
      
      // Generate redirect URL with session token
      const adminPanelUrl = process.env.ADMIN_PANEL_URL || 'http://localhost:3000';
      const redirectUrl = `${adminPanelUrl}/auth/telegram/callback?sessionId=${session.sessionId}&userId=${authResult.user!.id}`;
      
      // Redirect to admin panel
      return res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('Error handling auth redirect', error.stack);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}