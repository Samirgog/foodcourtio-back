import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  TelegramWebhookDto,
  SendNotificationDto,
  BroadcastNotificationDto,
  TelegramCommandResponseDto,
  RegisterBotUserDto,
  TelegramCommandType,
  NotificationType,
} from './dto/telegram.dto';
import { User, Role } from '@prisma/client';
import axios from 'axios';
import { TelegramAuthService } from './telegram-auth.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiUrl: string;
  private readonly startTime: Date;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly telegramAuthService: TelegramAuthService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.startTime = new Date();

    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not configured - bot functionality disabled');
    } else {
      this.initializeBot();
    }
  }

  /**
   * Initialize bot settings
   */
  private async initializeBot(): Promise<void> {
    try {
      // Set bot commands
      await this.setBotCommands();
      
      // Set webhook if needed (in production)
      if (process.env.NODE_ENV === 'production') {
        const webhookUrl = `${process.env.API_URL}/api/telegram/webhook`;
        await this.setWebhook(webhookUrl);
      }

      this.logger.log('Telegram bot initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Telegram bot', error.stack);
    }
  }

  /**
   * Set bot commands menu
   */
  private async setBotCommands(): Promise<void> {
    const commands = [
      { command: 'start', description: 'Start using the bot' },
      { command: 'help', description: 'Get help and available commands' },
      { command: 'status', description: 'Check your current status' },
      { command: 'orders', description: 'View pending orders (employees)' },
      { command: 'clockin', description: 'Clock in for your shift (employees)' },
      { command: 'clockout', description: 'Clock out from your shift (employees)' },
      { command: 'menu', description: 'View restaurant menu' },
      { command: 'schedule', description: 'View your work schedule (employees)' },
      { command: 'stats', description: 'View restaurant statistics (managers)' },
    ];

    try {
      await axios.post(`${this.apiUrl}/setMyCommands`, { commands });
      this.logger.log('Bot commands set successfully');
    } catch (error) {
      this.logger.error('Failed to set bot commands', error.stack);
    }
  }

  /**
   * Set webhook URL
   */
  private async setWebhook(url: string): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/setWebhook`, { url });
      this.logger.log(`Webhook set to: ${url}`);
    } catch (error) {
      this.logger.error('Failed to set webhook', error.stack);
    }
  }

  /**
   * Process incoming webhook from Telegram
   */
  async processWebhook(webhookDto: TelegramWebhookDto): Promise<void> {
    try {
      if (webhookDto.message) {
        await this.processMessage(webhookDto.message);
      }

      if (webhookDto.callback_query) {
        await this.processCallbackQuery(webhookDto.callback_query);
      }
    } catch (error) {
      this.logger.error('Error processing webhook', error.stack);
    }
  }

  /**
   * Process incoming message
   */
  private async processMessage(message: any): Promise<void> {
    const chatId = message.chat.id.toString();
    const text = message.text;
    const userId = message.from.id.toString();

    // Register user if not exists
    await this.registerUserIfNeeded(chatId, userId, message.from);

    if (text?.startsWith('/')) {
      await this.processCommand(chatId, text, userId);
    } else {
      // Handle regular messages
      await this.sendMessage(chatId, 'Hi! Use /help to see available commands.');
    }
  }

  /**
   * Process callback query (button presses)
   */
  private async processCallbackQuery(callbackQuery: any): Promise<void> {
    const chatId = callbackQuery.message.chat.id.toString();
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id.toString();

    try {
      // Answer the callback query to remove loading state
      await axios.post(`${this.apiUrl}/answerCallbackQuery`, {
        callback_query_id: callbackQuery.id,
        text: 'Processing...',
      });

      // Process the callback data
      await this.processCallbackData(chatId, data, userId);
    } catch (error) {
      this.logger.error('Error processing callback query', error.stack);
    }
  }

  /**
   * Process callback data from button presses
   */
  private async processCallbackData(chatId: string, data: string, telegramUserId: string): Promise<void> {
    const [action, ...params] = data.split(':');

    switch (action) {
      case 'order_ready':
        await this.markOrderReady(chatId, params[0], telegramUserId);
        break;
      case 'order_complete':
        await this.markOrderComplete(chatId, params[0], telegramUserId);
        break;
      case 'accept_shift':
        await this.acceptShift(chatId, params[0], telegramUserId);
        break;
      case 'view_order':
        await this.viewOrderDetails(chatId, params[0], telegramUserId);
        break;
      default:
        await this.sendMessage(chatId, 'Unknown action.');
    }
  }

  /**
   * Process bot commands
   */
  private async processCommand(chatId: string, command: string, telegramUserId: string): Promise<void> {
    const user = await this.findUserByTelegramId(telegramUserId);
    
    if (!user && !command.startsWith('/start')) {
      await this.sendMessage(
        chatId,
        'Please link your account first by logging into the FoodcourtIO app.'
      );
      return;
    }

    const [cmd] = command.split(' ');

    switch (cmd as TelegramCommandType) {
      case TelegramCommandType.START:
        await this.handleStartCommand(chatId, telegramUserId);
        break;
      case TelegramCommandType.HELP:
        await this.handleHelpCommand(chatId, user);
        break;
      case TelegramCommandType.STATUS:
        await this.handleStatusCommand(chatId, user);
        break;
      case TelegramCommandType.ORDERS:
        await this.handleOrdersCommand(chatId, user);
        break;
      case TelegramCommandType.CLOCK_IN:
        await this.handleClockInCommand(chatId, user);
        break;
      case TelegramCommandType.CLOCK_OUT:
        await this.handleClockOutCommand(chatId, user);
        break;
      case TelegramCommandType.MENU:
        await this.handleMenuCommand(chatId, user);
        break;
      case TelegramCommandType.SCHEDULE:
        await this.handleScheduleCommand(chatId, user);
        break;
      case TelegramCommandType.STATS:
        await this.handleStatsCommand(chatId, user);
        break;
      default:
        await this.sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
    }
  }

  /**
   * Handle /start command
   */
  private async handleStartCommand(chatId: string, telegramUserId: string): Promise<void> {
    const user = await this.findUserByTelegramId(telegramUserId);
    
    if (user) {
      // Check if user is authorized to access the admin panel
      const authResult = await this.telegramAuthService.isUserAuthorized(telegramUserId);
      
      if (authResult.authorized) {
        await this.sendMessage(
          chatId,
          `Welcome back, ${user.name}! 👋\n\nYou have access to the admin panel.\nUse /help to see available commands.`
        );
      } else {
        await this.sendMessage(
          chatId,
          `Welcome back, ${user.name}! 👋

${authResult.reason}

You can still receive notifications, but you won't have access to admin features.`
        );
      }
    } else {
      await this.sendMessage(
        chatId,
        `Welcome to FoodcourtIO Bot! 🍔

To get started, please log into the FoodcourtIO app to link your account.

Once linked, you'll be able to receive order notifications and manage your work through this bot.`
      );
    }
  }

  /**
   * Handle /help command
   */
  private async handleHelpCommand(chatId: string, user?: User): Promise<void> {
    let helpText = '🤖 *FoodcourtIO Bot Help*\n\n';
    
    if (!user) {
      helpText += 'Please link your account by logging into the FoodcourtIO app first.\n\n';
      helpText += '/start - Start using the bot';
      await this.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
      return;
    }

    helpText += '*Available Commands:*\n\n';
    helpText += '/status - Check your current status\n';
    
    if (user.role === Role.EMPLOYEE || user.role === Role.RESTAURANT_OWNER) {
      helpText += '/orders - View pending orders\n';
      helpText += '/clockin - Clock in for your shift\n';
      helpText += '/clockout - Clock out from your shift\n';
      helpText += '/schedule - View your work schedule\n';
    }
    
    if (user.role === Role.RESTAURANT_OWNER || user.role === Role.SUPERADMIN) {
      helpText += '/stats - View restaurant statistics\n';
    }
    
    helpText += '/menu - View restaurant menu\n';
    helpText += '/help - Show this help message\n';

    await this.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /status command
   */
  private async handleStatusCommand(chatId: string, user: User): Promise<void> {
    if (!user) return;

    let statusText = `👤 *Your Status*\n\n`;
    statusText += `Name: ${user.name}\n`;
    statusText += `Role: ${user.role}\n`;

    if (user.role === Role.EMPLOYEE) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: user.id },
        include: {
          restaurant: { select: { name: true } },
          shifts: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
        },
      });

      if (employee) {
        statusText += `Restaurant: ${employee.restaurant.name}\n`;
        statusText += `Position: ${employee.role}\n`;
        
        if (employee.shifts.length > 0) {
          statusText += `🟢 Currently clocked in\n`;
          statusText += `Shift started: ${employee.shifts[0].actualStartTime?.toLocaleTimeString() || 'N/A'}\n`;
        } else {
          statusText += `🔴 Not clocked in\n`;
        }
      }
    }

    await this.sendMessage(chatId, statusText, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /orders command
   */
  private async handleOrdersCommand(chatId: string, user: User): Promise<void> {
    if (!user || ![Role.EMPLOYEE, Role.RESTAURANT_OWNER].includes(user.role as any)) {
      await this.sendMessage(chatId, 'This command is only available for restaurant staff.');
      return;
    }

    let restaurantId: string | null = null;

    if (user.role === Role.EMPLOYEE) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: user.id },
        select: { restaurantId: true },
      });
      restaurantId = employee?.restaurantId || null;
    } else if (user.role === Role.RESTAURANT_OWNER) {
      const restaurant = await this.prisma.restaurant.findFirst({
        where: { ownerId: user.id },
        select: { id: true },
      });
      restaurantId = restaurant?.id || null;
    }

    if (!restaurantId) {
      await this.sendMessage(chatId, 'No restaurant assigned to your account.');
      return;
    }

    const pendingOrders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: ['PENDING', 'PREPARING'] },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });

    if (pendingOrders.length === 0) {
      await this.sendMessage(chatId, '✅ No pending orders! All caught up.');
      return;
    }

    let ordersText = `📋 *Pending Orders* (${pendingOrders.length})\n\n`;

    for (const order of pendingOrders) {
      ordersText += `🔥 *Order #${order.orderNumber}*\n`;
      ordersText += `Customer: ${order.customerName}\n`;
      ordersText += `Status: ${order.status}\n`;
      ordersText += `Items: ${order.items.map(item => `${item.quantity}x ${item.product.name}`).join(', ')}\n`;
      ordersText += `Total: $${(order.totalAmount / 100).toFixed(2)}\n`;
      ordersText += `Time: ${order.createdAt.toLocaleTimeString()}\n\n`;
    }

    const buttons = pendingOrders.map(order => ([
      {
        text: `View Order #${order.orderNumber}`,
        callback_data: `view_order:${order.id}`,
      },
    ]));

    await this.sendMessage(chatId, ordersText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  /**
   * Handle clock in command
   */
  private async handleClockInCommand(chatId: string, user: User): Promise<void> {
    if (!user || user.role !== Role.EMPLOYEE) {
      await this.sendMessage(chatId, 'This command is only available for employees.');
      return;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
    });

    if (!employee) {
      await this.sendMessage(chatId, 'Employee record not found.');
      return;
    }

    // Check if already clocked in
    const activeShift = await this.prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        status: 'ACTIVE',
      },
    });

    if (activeShift) {
      await this.sendMessage(chatId, '⚠️ You are already clocked in!');
      return;
    }

    // Create or update shift
    const now = new Date();
    const shift = await this.prisma.shift.create({
      data: {
        employeeId: employee.id,
        startTime: now,
        endTime: new Date(now.getTime() + 8 * 60 * 60 * 1000), // 8 hours default
        actualStartTime: now,
        status: 'ACTIVE',
        notes: 'Clocked in via Telegram bot',
      },
    });

    await this.sendMessage(
      chatId,
      `✅ Clocked in successfully!\n\nTime: ${now.toLocaleTimeString()}\nHave a great shift! 💪`
    );

    this.logger.log(`Employee ${employee.name} clocked in via bot`);
  }

  /**
   * Handle clock out command
   */
  private async handleClockOutCommand(chatId: string, user: User): Promise<void> {
    if (!user || user.role !== Role.EMPLOYEE) {
      await this.sendMessage(chatId, 'This command is only available for employees.');
      return;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
    });

    if (!employee) {
      await this.sendMessage(chatId, 'Employee record not found.');
      return;
    }

    const activeShift = await this.prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        status: 'ACTIVE',
      },
    });

    if (!activeShift) {
      await this.sendMessage(chatId, '⚠️ You are not currently clocked in!');
      return;
    }

    const now = new Date();
    const startTime = activeShift.actualStartTime || activeShift.startTime;
    const hoursWorked = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    await this.prisma.shift.update({
      where: { id: activeShift.id },
      data: {
        actualEndTime: now,
        status: 'COMPLETED',
        notes: activeShift.notes
          ? `${activeShift.notes}\nClocked out via Telegram bot`
          : 'Clocked out via Telegram bot',
      },
    });

    await this.sendMessage(
      chatId,
      `✅ Clocked out successfully!

Time: ${now.toLocaleTimeString()}
Hours worked: ${hoursWorked.toFixed(2)}
Good job today! 👏`
    );

    this.logger.log(`Employee ${employee.name} clocked out via bot`);
  }

  /**
   * Send notification to user
   */
  async sendNotification(notificationDto: SendNotificationDto): Promise<boolean> {
    try {
      const message = `*${notificationDto.title}*\n\n${notificationDto.message}`;
      
      const options: any = {
        parse_mode: 'Markdown',
        disable_notification: notificationDto.silent,
      };

      if (notificationDto.buttons && notificationDto.buttons.length > 0) {
        options.reply_markup = {
          inline_keyboard: [notificationDto.buttons],
        };
      }

      await this.sendMessage(notificationDto.chatId, message, options);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send notification to ${notificationDto.chatId}`, error.stack);
      return false;
    }
  }

  /**
   * Broadcast notification to multiple users
   */
  async broadcastNotification(broadcastDto: BroadcastNotificationDto): Promise<{ sent: number; failed: number }> {
    const whereClause: any = {
      restaurant: { id: broadcastDto.restaurantId },
      user: { telegramId: { not: null } },
    };

    if (broadcastDto.roles && broadcastDto.roles.length > 0) {
      whereClause.role = { in: broadcastDto.roles };
    }

    const employees = await this.prisma.employee.findMany({
      where: whereClause,
      include: {
        user: { select: { telegramId: true } },
      },
    });

    let sent = 0;
    let failed = 0;

    for (const employee of employees) {
      if (employee.user?.telegramId) {
        const success = await this.sendNotification({
          chatId: employee.user.telegramId,
          type: broadcastDto.type,
          title: broadcastDto.title,
          message: broadcastDto.message,
          data: broadcastDto.data,
          buttons: broadcastDto.buttons,
        });

        if (success) sent++;
        else failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Send new order notification to restaurant staff
   */
  async notifyNewOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!order) return;

    const message = `🔔 *New Order Received!*

Order #${order.orderNumber}
Customer: ${order.customerName}
Items: ${order.items.length}
Total: $${(order.totalAmount / 100).toFixed(2)}`;

    const buttons = [
      { text: '👁️ View Details', callback_data: `view_order:${order.id}` },
    ];

    await this.broadcastNotification({
      restaurantId: order.restaurantId,
      roles: ['MANAGER', 'CASHIER', 'COOK'],
      type: NotificationType.NEW_ORDER,
      title: 'New Order',
      message,
      buttons,
    });
  }

  /**
   * Send order status update notification
   */
  async notifyOrderStatusUpdate(orderId: string, newStatus: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { telegramId: true, name: true } },
      },
    });

    if (!order || !order.customer?.telegramId) return;

    let statusEmoji = '';
    let statusText = '';

    switch (newStatus) {
      case 'PREPARING':
        statusEmoji = '👨‍🍳';
        statusText = 'being prepared';
        break;
      case 'READY':
        statusEmoji = '✅';
        statusText = 'ready for pickup';
        break;
      case 'COMPLETED':
        statusEmoji = '🎉';
        statusText = 'completed';
        break;
    }

    const message = `${statusEmoji} Your order #${order.orderNumber} is ${statusText}!`;

    await this.sendNotification({
      chatId: order.customer.telegramId,
      type: NotificationType.ORDER_STATUS_UPDATE,
      title: 'Order Update',
      message,
    });
  }

  /**
   * Send basic message
   */
  private async sendMessage(chatId: string, text: string, options: any = {}): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('Cannot send message: bot token not configured');
      return;
    }

    try {
      await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        ...options,
      });
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}`, error.response?.data || error.stack);
    }
  }

  /**
   * Register user if needed
   */
  private async registerUserIfNeeded(chatId: string, telegramUserId: string, from: any): Promise<void> {
    // This is handled by the main auth system when users link their accounts
    // Just log for now
    this.logger.debug(`Telegram user interaction: ${telegramUserId} (${from.first_name})`);
  }

  /**
   * Find user by Telegram ID
   */
  private async findUserByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  /**
   * Additional handler methods for callback queries
   */
  private async markOrderReady(chatId: string, orderId: string, telegramUserId: string): Promise<void> {
    // Implementation would update order status and notify customer
    await this.sendMessage(chatId, '✅ Order marked as ready!');
  }

  private async markOrderComplete(chatId: string, orderId: string, telegramUserId: string): Promise<void> {
    // Implementation would complete the order
    await this.sendMessage(chatId, '🎉 Order completed!');
  }

  private async acceptShift(chatId: string, shiftId: string, telegramUserId: string): Promise<void> {
    // Implementation would accept a shift assignment
    await this.sendMessage(chatId, '👍 Shift accepted!');
  }

  private async viewOrderDetails(chatId: string, orderId: string, telegramUserId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      await this.sendMessage(chatId, '❌ Order not found.');
      return;
    }

    let orderText = `📋 *Order #${order.orderNumber}*\n\n`;
    orderText += `Customer: ${order.customerName}\n`;
    orderText += `Phone: ${order.customerPhone}\n`;
    orderText += `Status: ${order.status}\n`;
    orderText += `Type: ${order.deliveryType}\n\n`;
    orderText += `*Items:*\n`;

    for (const item of order.items) {
      orderText += `• ${item.quantity}x ${item.product.name}`;
      if (item.variant) orderText += ` (${item.variant})`;
      orderText += ` - $${(item.totalPrice / 100).toFixed(2)}\n`;
      if (item.specialInstructions) {
        orderText += `  📝 ${item.specialInstructions}\n`;
      }
    }

    orderText += `\n*Total: $${(order.totalAmount / 100).toFixed(2)}*\n`;

    if (order.specialInstructions) {
      orderText += `\n📝 Special Instructions:\n${order.specialInstructions}`;
    }

    const buttons = [];
    if (order.status === 'PENDING') {
      buttons.push({ text: '👨‍🍳 Start Preparing', callback_data: `order_preparing:${order.id}` });
    } else if (order.status === 'PREPARING') {
      buttons.push({ text: '✅ Mark Ready', callback_data: `order_ready:${order.id}` });
    } else if (order.status === 'READY') {
      buttons.push({ text: '🎉 Complete Order', callback_data: `order_complete:${order.id}` });
    }

    await this.sendMessage(chatId, orderText, {
      parse_mode: 'Markdown',
      reply_markup: buttons.length > 0 ? { inline_keyboard: [buttons] } : undefined,
    });
  }

  /**
   * Handle remaining command implementations
   */
  private async handleMenuCommand(chatId: string, user: User): Promise<void> {
    await this.sendMessage(chatId, '📱 Please use the FoodcourtIO app to view the full menu with images and details.');
  }

  private async handleScheduleCommand(chatId: string, user: User): Promise<void> {
    if (!user || user.role !== Role.EMPLOYEE) {
      await this.sendMessage(chatId, 'This command is only available for employees.');
      return;
    }
    await this.sendMessage(chatId, '📅 Your schedule is available in the FoodcourtIO app under the Schedule section.');
  }

  private async handleStatsCommand(chatId: string, user: User): Promise<void> {
    if (!user || ![Role.RESTAURANT_OWNER, Role.SUPERADMIN].includes(user.role as any)) {
      await this.sendMessage(chatId, 'This command is only available for restaurant owners and administrators.');
      return;
    }
    await this.sendMessage(chatId, '📊 Detailed statistics are available in the FoodcourtIO web dashboard.');
  }

  /**
   * Get bot statistics
   */
  async getBotStats(): Promise<any> {
    const uptime = Date.now() - this.startTime.getTime();
    const uptimeString = this.formatUptime(uptime);

    return {
      totalUsers: await this.prisma.user.count({
        where: { telegramId: { not: null } },
      }),
      activeUsers: 0, // Would need to track last activity
      messagesSentToday: 0, // Would need to track in database
      commandsProcessedToday: 0, // Would need to track in database
      usersByType: [],
      popularCommands: [],
      uptime: uptimeString,
    };
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }
}