import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  CreateNotificationDto,
  BulkNotificationDto,
  NotificationPreferenceDto,
  NotificationSettingsDto,
  MarkNotificationReadDto,
  TestNotificationDto,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationTemplate,
} from './dto/notification.dto';
import { User, Role } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  
  // Template definitions
  private readonly templates: Record<NotificationTemplate, {
    title: string;
    message: string;
    channels: NotificationChannel[];
    priority: NotificationPriority;
  }> = {
    [NotificationTemplate.ORDER_CREATED]: {
      title: '🔔 New Order Received!',
      message: 'Order #{orderNumber} from {customerName} - ${amount}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      priority: NotificationPriority.HIGH,
    },
    [NotificationTemplate.ORDER_STATUS_UPDATED]: {
      title: '📱 Order Status Update',
      message: 'Your order #{orderNumber} is now {status}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.PUSH],
      priority: NotificationPriority.NORMAL,
    },
    [NotificationTemplate.PAYMENT_RECEIVED]: {
      title: '💰 Payment Received',
      message: 'Payment of ${amount} received for order #{orderNumber}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      priority: NotificationPriority.NORMAL,
    },
    [NotificationTemplate.PAYMENT_FAILED]: {
      title: '❌ Payment Failed',
      message: 'Payment failed for order #{orderNumber}. Please try again.',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL, NotificationChannel.PUSH],
      priority: NotificationPriority.HIGH,
    },
    [NotificationTemplate.EMPLOYEE_CLOCKED_IN]: {
      title: '👋 Employee Clocked In',
      message: '{employeeName} has clocked in for their shift',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      priority: NotificationPriority.LOW,
    },
    [NotificationTemplate.EMPLOYEE_CLOCKED_OUT]: {
      title: '👋 Employee Clocked Out',
      message: '{employeeName} has clocked out. Hours worked: {hoursWorked}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      priority: NotificationPriority.LOW,
    },
    [NotificationTemplate.SHIFT_REMINDER]: {
      title: '⏰ Shift Reminder',
      message: 'Your shift starts in {timeUntil} at {restaurant}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.PUSH],
      priority: NotificationPriority.NORMAL,
    },
    [NotificationTemplate.SHIFT_MISSED]: {
      title: '⚠️ Shift Missed',
      message: '{employeeName} missed their scheduled shift starting at {shiftTime}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL],
      priority: NotificationPriority.HIGH,
    },
    [NotificationTemplate.EMPLOYEE_INVITED]: {
      title: '🎉 You\'re Invited to Join!',
      message: 'You\'ve been invited to join {restaurantName} as {role}. Use the link to accept.',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL],
      priority: NotificationPriority.NORMAL,
    },
    [NotificationTemplate.RESTAURANT_PUBLISHED]: {
      title: '🚀 Restaurant Published',
      message: 'Congratulations! {restaurantName} is now live and accepting orders.',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      priority: NotificationPriority.NORMAL,
    },
    [NotificationTemplate.SYSTEM_MAINTENANCE]: {
      title: '🔧 System Maintenance',
      message: 'System maintenance scheduled for {maintenanceTime}. Expected duration: {duration}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL, NotificationChannel.PUSH],
      priority: NotificationPriority.HIGH,
    },
    [NotificationTemplate.COMMISSION_REPORT]: {
      title: '📊 Weekly Commission Report',
      message: 'Commission earned this week: ${commission}. Total sales: ${totalSales}',
      channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
      priority: NotificationPriority.LOW,
    },
    [NotificationTemplate.DAILY_SALES_REPORT]: {
      title: '📈 Daily Sales Report',
      message: 'Today\'s sales: ${dailySales}. Orders: {orderCount}. Average order: ${averageOrder}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.EMAIL],
      priority: NotificationPriority.LOW,
    },
    [NotificationTemplate.INVENTORY_LOW]: {
      title: '📦 Low Inventory Alert',
      message: 'Low stock alert for {productName}. Only {quantity} remaining.',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      priority: NotificationPriority.HIGH,
    },
    [NotificationTemplate.CUSTOMER_FEEDBACK]: {
      title: '⭐ New Customer Feedback',
      message: 'New {rating}-star review: "{feedback}" for order #{orderNumber}',
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      priority: NotificationPriority.LOW,
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create and send a notification
   */
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<any> {
    const template = this.templates[createNotificationDto.template];
    
    if (!template) {
      throw new Error(`Unknown notification template: ${createNotificationDto.template}`);
    }

    // Get recipient user
    const recipient = await this.prisma.user.findUnique({
      where: { id: createNotificationDto.recipientId },
    });

    if (!recipient) {
      throw new Error('Recipient not found');
    }

    // Get user notification preferences
    const preferences = await this.getUserPreferences(recipient.id);
    
    // Merge template with custom content
    const title = createNotificationDto.customTitle || template.title;
    const message = createNotificationDto.customMessage || template.message;
    
    // Replace template variables
    const finalTitle = this.replaceTemplateVariables(title, createNotificationDto.templateVariables || {});
    const finalMessage = this.replaceTemplateVariables(message, createNotificationDto.templateVariables || {});

    // Determine channels to use (user preference + template defaults)
    const channels = this.determineChannels(
      createNotificationDto.channels,
      template.channels,
      preferences,
      createNotificationDto.template
    );

    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        type: createNotificationDto.template as any, // Cast template as NotificationType
        template: createNotificationDto.template as any,
        title: finalTitle,
        message: finalMessage,
        user: {
          connect: { id: createNotificationDto.recipientId }
        },
        channels: channels as any[],
        priority: Number(createNotificationDto.priority || template.priority),
        status: createNotificationDto.scheduledAt ? NotificationStatus.PENDING : NotificationStatus.SENT,
        scheduledAt: createNotificationDto.scheduledAt ? new Date(createNotificationDto.scheduledAt) : null,
        relatedEntityId: createNotificationDto.relatedEntityId,
      },
    });

    // Send immediately if not scheduled
    if (!createNotificationDto.scheduledAt) {
      await this.sendNotification(notification.id);
    }

    return notification;
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotification(bulkNotificationDto: BulkNotificationDto): Promise<{ sent: number; failed: number }> {
    const recipients = await this.findRecipientsByTarget(bulkNotificationDto.targetCriteria);
    
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        await this.createNotification({
          template: bulkNotificationDto.template,
          recipientId: recipient.id,
          channels: bulkNotificationDto.channels,
          priority: bulkNotificationDto.priority,
          customTitle: bulkNotificationDto.customTitle,
          customMessage: bulkNotificationDto.customMessage,
          templateVariables: bulkNotificationDto.templateVariables,
          scheduledAt: bulkNotificationDto.scheduledAt,
        });
        sent++;
      } catch (error) {
        this.logger.error(`Failed to send notification to ${recipient.id}`, error.stack);
        failed++;
      }
    }

    this.logger.log(`Bulk notification sent: ${sent} successful, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Send actual notification through channels
   */
  private async sendNotification(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            telegramId: true,
            username: true,
          },
        },
      },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    const deliveryResults: Record<string, any> = {};

    for (const channel of notification.channels as NotificationChannel[]) {
      try {
        switch (channel) {
          case NotificationChannel.TELEGRAM:
            await this.sendTelegramNotification(notification);
            deliveryResults[channel] = { status: NotificationStatus.DELIVERED, deliveredAt: new Date() };
            break;
          case NotificationChannel.EMAIL:
            await this.sendEmailNotification(notification);
            deliveryResults[channel] = { status: NotificationStatus.DELIVERED, deliveredAt: new Date() };
            break;
          case NotificationChannel.SMS:
            await this.sendSmsNotification(notification);
            deliveryResults[channel] = { status: NotificationStatus.DELIVERED, deliveredAt: new Date() };
            break;
          case NotificationChannel.PUSH:
            await this.sendPushNotification(notification);
            deliveryResults[channel] = { status: NotificationStatus.DELIVERED, deliveredAt: new Date() };
            break;
          case NotificationChannel.IN_APP:
            // In-app notifications are stored in database and delivered via WebSocket/polling
            deliveryResults[channel] = { status: NotificationStatus.DELIVERED, deliveredAt: new Date() };
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification`, error.stack);
        deliveryResults[channel] = { 
          status: NotificationStatus.FAILED, 
          error: error.message 
        };
      }
    }

    // Update notification status
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.SENT as any,
        sentAt: new Date(),
        deliveryResults,
      },
    });
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegramNotification(notification: any): Promise<void> {
    if (!notification.user.telegramId) {
      throw new Error('User has no Telegram ID');
    }

    const buttons = notification.actionButtons?.map((btn: any) => ({
      text: btn.text,
      callback_data: btn.action,
      url: btn.url,
    }));

    await this.telegramService.sendNotification({
      chatId: notification.user.telegramId,
      type: notification.template,
      title: notification.title,
      message: notification.message,
      buttons,
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any): Promise<void> {
    // Implementation would use email service (SendGrid, AWS SES, etc.)
    this.logger.log(`Email notification sent to ${notification.user.email || 'no-email'}`);
    
    // Mock implementation - would integrate with actual email service
    if (notification.user.email) {
      // await this.emailService.send({
      //   to: notification.recipient.email,
      //   subject: notification.title,
      //   html: this.generateEmailTemplate(notification),
      // });
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSmsNotification(notification: any): Promise<void> {
    // Implementation would use SMS service (Twilio, AWS SNS, etc.)
    this.logger.log(`SMS notification sent to ${notification.user.phone || 'no-phone'}`);
    
    // Mock implementation - would integrate with actual SMS service
    if (notification.user.phone) {
      // await this.smsService.send({
      //   to: notification.recipient.phone,
      //   message: `${notification.title}\n\n${notification.message}`,
      // });
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: any): Promise<void> {
    // Implementation would use push service (Firebase, AWS SNS, etc.)
    this.logger.log(`Push notification sent to user ${notification.user.id}`);
    
    // Mock implementation - would integrate with actual push service
    // await this.pushService.send({
    //   userId: notification.recipient.id,
    //   title: notification.title,
    //   body: notification.message,
    //   data: notification.actionButtons,
    // });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new Error('Notification not found or access denied');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.READ as any,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    unreadOnly: boolean = false
  ): Promise<{ notifications: any[]; total: number }> {
    const skip = (page - 1) * limit;
    const where: any = { recipientId: userId };
    
    if (unreadOnly) {
      where.status = { not: NotificationStatus.READ };
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId?: string, restaurantId?: string): Promise<any> {
    const where: any = {};
    
    if (userId) {
      where.recipientId = userId;
    }
    
    if (restaurantId) {
      where.recipient = {
        OR: [
          { role: Role.RESTAURANT_OWNER, restaurants: { some: { id: restaurantId } } },
          { role: Role.EMPLOYEE, employees: { some: { restaurantId } } },
        ],
      };
    }

    const [totalSent, totalDelivered, totalRead, totalFailed] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ 
        where: { ...where, status: { in: [NotificationStatus.DELIVERED, NotificationStatus.READ] } }
      }),
      this.prisma.notification.count({ 
        where: { ...where, status: NotificationStatus.READ }
      }),
      this.prisma.notification.count({ 
        where: { ...where, status: NotificationStatus.FAILED }
      }),
    ]);

    return {
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      readRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
    };
  }

  /**
   * Process scheduled notifications (runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledNotifications(): Promise<void> {
    const scheduledNotifications = await this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.PENDING as any,
        scheduledAt: {
          lte: new Date(),
        },
      },
      take: 100, // Process in batches
    });

    for (const notification of scheduledNotifications) {
      try {
        await this.sendNotification(notification.id);
        this.logger.log(`Scheduled notification sent: ${notification.id}`);
      } catch (error) {
        this.logger.error(`Failed to send scheduled notification ${notification.id}`, error.stack);
        
        // Mark as failed
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.FAILED as any },
        });
      }
    }
  }

  /**
   * Send shift reminders (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendShiftReminders(): Promise<void> {
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1);
    
    const upcomingShifts = await this.prisma.shift.findMany({
      where: {
        startTime: {
          gte: nextHour,
          lte: new Date(nextHour.getTime() + 60 * 60 * 1000), // Next hour
        },
        status: 'SCHEDULED' as any,
      },
      include: {
        employee: {
          include: {
            user: true,
            restaurant: true,
          },
        },
      },
    });

    for (const shift of upcomingShifts) {
      if (shift.employee.user) {
        await this.createNotification({
          template: NotificationTemplate.SHIFT_REMINDER,
          recipientId: shift.employee.user.id,
          channels: [NotificationChannel.TELEGRAM, NotificationChannel.PUSH],
          templateVariables: {
            timeUntil: '1 hour',
            restaurant: shift.employee.restaurant.name,
            shiftTime: shift.startTime.toLocaleTimeString(),
          },
        });
      }
    }
  }

  /**
   * Helper methods
   */
  private replaceTemplateVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
    });
    
    return result;
  }

  private async getUserPreferences(userId: string): Promise<any> {
    // Implementation would fetch from database
    // For now, return defaults
    return {
      emailEnabled: true,
      telegramEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      frequency: 'INSTANT',
    };
  }

  private determineChannels(
    requestedChannels: NotificationChannel[],
    templateChannels: NotificationChannel[],
    userPreferences: any,
    template: NotificationTemplate,
  ): NotificationChannel[] {
    // Logic to determine which channels to use based on:
    // 1. User requested channels
    // 2. Template defaults
    // 3. User preferences
    // 4. Quiet hours
    
    return requestedChannels.length > 0 ? requestedChannels : templateChannels;
  }

  private async findRecipientsByTarget(targetCriteria: any): Promise<User[]> {
    const where: any = {};
    
    if (targetCriteria.userIds?.length > 0) {
      where.id = { in: targetCriteria.userIds };
    }
    
    if (targetCriteria.roles?.length > 0) {
      where.role = { in: targetCriteria.roles };
    }
    
    if (targetCriteria.restaurantIds?.length > 0) {
      where.OR = [
        { role: Role.RESTAURANT_OWNER, restaurants: { some: { id: { in: targetCriteria.restaurantIds } } } },
        { role: Role.EMPLOYEE, employees: { some: { restaurantId: { in: targetCriteria.restaurantIds } } } },
      ];
    }

    return this.prisma.user.findMany({ where });
  }

  /**
   * Event handlers for automatic notifications
   */
  async onOrderCreated(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          include: {
            employees: {
              where: { isActive: true },
              include: { user: true },
            },
          },
        },
      },
    });

    if (!order) return;

    // Notify restaurant staff
    for (const employee of order.restaurant.employees) {
      if (employee.user && ['MANAGER', 'CASHIER', 'COOK'].includes(employee.role)) {
        await this.createNotification({
          template: NotificationTemplate.ORDER_CREATED,
          recipientId: employee.user.id,
          channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
          templateVariables: {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            amount: (order.totalAmount / 100).toFixed(2),
          },
          relatedEntityId: orderId,
          relatedEntityType: 'order',
        });
      }
    }
  }

  async onOrderStatusUpdated(orderId: string, newStatus: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    });

    if (!order || !order.customer) return;

    await this.createNotification({
      template: NotificationTemplate.ORDER_STATUS_UPDATED,
      recipientId: order.customer.id,
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.PUSH],
      templateVariables: {
        orderNumber: order.orderNumber,
        status: newStatus.toLowerCase(),
      },
      relatedEntityId: orderId,
      relatedEntityType: 'order',
    });
  }

  async onPaymentReceived(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            restaurant: {
              include: {
                owner: true,
              },
            },
          },
        },
      },
    });

    if (!payment) return;

    // Notify restaurant owner
    await this.createNotification({
      template: NotificationTemplate.PAYMENT_RECEIVED,
      recipientId: payment.order.restaurant.owner.id,
      channels: [NotificationChannel.TELEGRAM, NotificationChannel.IN_APP],
      templateVariables: {
        amount: (payment.amount / 100).toFixed(2),
        orderNumber: payment.order.orderNumber,
      },
      relatedEntityId: paymentId,
      relatedEntityType: 'payment',
    });
  }
}