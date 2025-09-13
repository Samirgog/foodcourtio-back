import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePaymentDto,
  StripePaymentIntentDto,
  ConfirmPaymentDto,
  RefundPaymentDto,
  PaymentWebhookDto,
  CashPaymentDto,
  CardTerminalPaymentDto,
  PaymentMethod,
  PaymentStatus,
} from './dto/payment.dto';
import { Payment, User, Role, PaymentStatus as PrismaPaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import axios from 'axios';
import { createHmac } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private readonly yookassaShopId: string;
  private readonly yookassaSecretKey: string;
  private readonly commissionRate: number = 0.05; // 5% commission

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Stripe
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecretKey) {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-08-16',
      });
    }

    // Initialize YooKassa credentials
    this.yookassaShopId = this.configService.get<string>('YOOKASSA_SHOP_ID') || '';
    this.yookassaSecretKey = this.configService.get<string>('YOOKASSA_SECRET_KEY') || '';
  }

  /**
   * Create a new payment
   */
  async create(createPaymentDto: CreatePaymentDto, currentUser: User): Promise<Payment> {
    try {
      // Verify order exists and user has access
      const order = await this.prisma.order.findUnique({
        where: { id: createPaymentDto.orderId },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              ownerId: true,
            },
          },
          payment: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${createPaymentDto.orderId} not found`);
      }

      if (order.payment) {
        throw new BadRequestException('Order already has a payment');
      }

      // Verify user has access to create payment for this order
      if (currentUser.role === Role.CUSTOMER && order.customerId !== currentUser.id) {
        throw new ForbiddenException('You can only create payments for your own orders');
      }

      // Calculate commission
      const commissionAmount = Math.round(createPaymentDto.amount * this.commissionRate);
      const netAmount = createPaymentDto.amount - commissionAmount;

      // Create payment record
      const payment = await this.prisma.payment.create({
        data: {
          amount: createPaymentDto.amount,
          currency: createPaymentDto.currency || 'USD',
          method: createPaymentDto.method,
          status: PrismaPaymentStatus.PENDING,
          commission: commissionAmount,
          commissionAmount,
          netAmount,
          provider: 'stripe',
          order: {
            connect: { id: createPaymentDto.orderId },
          },
          metadata: {
            customerEmail: createPaymentDto.customerEmail,
            description: createPaymentDto.description,
            returnUrl: createPaymentDto.returnUrl,
            cancelUrl: createPaymentDto.cancelUrl,
          },
        },
        include: {
          order: {
            include: {
              restaurant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Process payment based on method
      let updatedPayment: any = payment;
      switch (createPaymentDto.method) {
        case PaymentMethod.STRIPE:
          updatedPayment = await this.processStripePayment(payment, createPaymentDto, order);
          break;
        case PaymentMethod.YOOKASSA:
          updatedPayment = await this.processYookassaPayment(payment, createPaymentDto, order);
          break;
        case PaymentMethod.CASH:
        case PaymentMethod.CARD_TERMINAL:
          // These are handled manually by restaurant staff
          break;
      }

      this.logger.log(`Payment created: ${payment.id} for order ${order.orderNumber}`);
      return updatedPayment;
    } catch (error) {
      this.logger.error('Error creating payment', error.stack);
      throw error;
    }
  }

  /**
   * Process Stripe payment
   */
  private async processStripePayment(payment: Payment, createPaymentDto: CreatePaymentDto, order: any): Promise<Payment> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: payment.amount,
        currency: payment.currency.toLowerCase(),
        metadata: {
          orderId: payment.orderId,
          paymentId: payment.id,
        },
        description: createPaymentDto.description || `Payment for order ${order.orderNumber}`,
      });

      return await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalPaymentId: paymentIntent.id,
          paymentUrl: `https://checkout.stripe.com/pay/${paymentIntent.client_secret}`,
          metadata: {
            ...payment.metadata as any,
            stripePaymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
          },
        },
        include: {
          order: {
            include: {
              restaurant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Stripe payment creation failed', error.stack);
      throw new BadRequestException(`Stripe payment failed: ${error.message}`);
    }
  }

  /**
   * Process YooKassa payment
   */
  private async processYookassaPayment(payment: Payment, createPaymentDto: CreatePaymentDto, order: any): Promise<Payment> {
    if (!this.yookassaShopId || !this.yookassaSecretKey) {
      throw new BadRequestException('YooKassa is not configured');
    }

    try {
      const idempotencyKey = `payment_${payment.id}_${Date.now()}`;
      
      const yookassaPayment = await axios.post(
        'https://api.yookassa.ru/v3/payments',
        {
          amount: {
            value: (payment.amount / 100).toFixed(2), // Convert cents to rubles
            currency: payment.currency,
          },
          confirmation: {
            type: 'redirect',
            return_url: createPaymentDto.returnUrl || 'https://foodcourtio.com/payment/success',
          },
          capture: true,
          description: createPaymentDto.description || `Payment for order ${order.orderNumber}`,
          metadata: {
            order_id: payment.orderId,
            payment_id: payment.id,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': idempotencyKey,
            Authorization: `Basic ${Buffer.from(`${this.yookassaShopId}:${this.yookassaSecretKey}`).toString('base64')}`,
          },
        },
      );

      return await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalPaymentId: yookassaPayment.data.id,
          paymentUrl: yookassaPayment.data.confirmation.confirmation_url,
          metadata: {
            ...payment.metadata as any,
            yookassaPaymentId: yookassaPayment.data.id,
            yookassaStatus: yookassaPayment.data.status,
          },
        },
        include: {
          order: {
            include: {
              restaurant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('YooKassa payment creation failed', error.stack);
      throw new BadRequestException(`YooKassa payment failed: ${error.response?.data?.description || error.message}`);
    }
  }

  /**
   * Process cash payment
   */
  async processCashPayment(cashPaymentDto: CashPaymentDto, currentUser: User): Promise<Payment> {
    // Only restaurant staff can process cash payments
    if (![Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE].includes(currentUser.role as any)) {
      throw new ForbiddenException('Only restaurant staff can process cash payments');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: cashPaymentDto.orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment) {
      throw new BadRequestException('Order already has a payment');
    }

    const commissionAmount = Math.round(order.totalAmount * this.commissionRate);
    const netAmount = order.totalAmount - commissionAmount;

    return await this.prisma.payment.create({
      data: {
        amount: order.totalAmount,
        currency: 'USD', // Default currency
        method: PaymentMethod.CASH,
        status: PrismaPaymentStatus.COMPLETED,
        commission: commissionAmount,
        commissionAmount,
        netAmount,
        provider: 'cash',
        order: {
          connect: { id: cashPaymentDto.orderId },
        },
        metadata: {
          amountReceived: cashPaymentDto.amountReceived,
          changeGiven: cashPaymentDto.changeGiven || 0,
          processedBy: cashPaymentDto.processedBy || currentUser.name,
          processedAt: new Date().toISOString(),
        },
      },
      include: {
        order: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Process card terminal payment
   */
  async processCardTerminalPayment(terminalPaymentDto: CardTerminalPaymentDto, currentUser: User): Promise<Payment> {
    // Only restaurant staff can process terminal payments
    if (![Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE].includes(currentUser.role as any)) {
      throw new ForbiddenException('Only restaurant staff can process terminal payments');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: terminalPaymentDto.orderId },
      include: { payment: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment) {
      throw new BadRequestException('Order already has a payment');
    }

    const commissionAmount = Math.round(order.totalAmount * this.commissionRate);
    const netAmount = order.totalAmount - commissionAmount;

    return await this.prisma.payment.create({
      data: {
        amount: order.totalAmount,
        currency: 'USD', // Default currency
        method: PaymentMethod.CARD_TERMINAL,
        status: PrismaPaymentStatus.COMPLETED,
        commission: commissionAmount,
        commissionAmount,
        netAmount,
        provider: 'terminal',
        externalPaymentId: terminalPaymentDto.terminalTransactionId,
        order: {
          connect: { id: terminalPaymentDto.orderId },
        },
        metadata: {
          terminalId: terminalPaymentDto.terminalId,
          terminalTransactionId: terminalPaymentDto.terminalTransactionId,
          cardLast4: terminalPaymentDto.cardLast4,
          cardType: terminalPaymentDto.cardType,
          processedBy: currentUser.name,
          processedAt: new Date().toISOString(),
        },
      },
      include: {
        order: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Handle payment webhooks
   */
  async handleWebhook(webhookDto: PaymentWebhookDto): Promise<void> {
    try {
      switch (webhookDto.provider) {
        case 'stripe':
          await this.handleStripeWebhook(webhookDto);
          break;
        case 'yookassa':
          await this.handleYookassaWebhook(webhookDto);
          break;
        default:
          throw new BadRequestException('Unknown payment provider');
      }
    } catch (error) {
      this.logger.error('Webhook processing failed', error.stack);
      throw error;
    }
  }

  /**
   * Handle Stripe webhooks
   */
  private async handleStripeWebhook(webhookDto: PaymentWebhookDto): Promise<void> {
    const event = webhookDto.payload;
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handleStripePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handleStripePaymentFailed(event.data.object);
        break;
      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  /**
   * Handle YooKassa webhooks
   */
  private async handleYookassaWebhook(webhookDto: PaymentWebhookDto): Promise<void> {
    const event = webhookDto.payload;
    
    switch (event.event) {
      case 'payment.succeeded':
        await this.handleYookassaPaymentSuccess(event.object);
        break;
      case 'payment.canceled':
        await this.handleYookassaPaymentFailed(event.object);
        break;
      default:
        this.logger.log(`Unhandled YooKassa event type: ${event.event}`);
    }
  }

  /**
   * Handle successful Stripe payment
   */
  private async handleStripePaymentSuccess(paymentIntent: any): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { externalPaymentId: paymentIntent.id },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PrismaPaymentStatus.COMPLETED,
          metadata: {
            ...payment.metadata as any,
            stripePaymentIntent: paymentIntent,
            completedAt: new Date().toISOString(),
          },
        },
      });

      this.logger.log(`Stripe payment completed: ${payment.id}`);
    }
  }

  /**
   * Handle failed Stripe payment
   */
  private async handleStripePaymentFailed(paymentIntent: any): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { externalPaymentId: paymentIntent.id },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PrismaPaymentStatus.FAILED,
          metadata: {
            ...payment.metadata as any,
            stripePaymentIntent: paymentIntent,
            failedAt: new Date().toISOString(),
            failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
          },
        },
      });

      this.logger.log(`Stripe payment failed: ${payment.id}`);
    }
  }

  /**
   * Handle successful YooKassa payment
   */
  private async handleYookassaPaymentSuccess(yookassaPayment: any): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { externalPaymentId: yookassaPayment.id },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PrismaPaymentStatus.COMPLETED,
          metadata: {
            ...payment.metadata as any,
            yookassaPayment,
            completedAt: new Date().toISOString(),
          },
        },
      });

      this.logger.log(`YooKassa payment completed: ${payment.id}`);
    }
  }

  /**
   * Handle failed YooKassa payment
   */
  private async handleYookassaPaymentFailed(yookassaPayment: any): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { externalPaymentId: yookassaPayment.id },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PrismaPaymentStatus.FAILED,
          metadata: {
            ...payment.metadata as any,
            yookassaPayment,
            failedAt: new Date().toISOString(),
            failureReason: yookassaPayment.cancellation_details?.reason || 'Payment failed',
          },
        },
      });

      this.logger.log(`YooKassa payment failed: ${payment.id}`);
    }
  }

  /**
   * Refund a payment
   */
  async refund(id: string, refundDto: RefundPaymentDto, currentUser: User): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            restaurant: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (payment.status !== PrismaPaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    // Verify access
    if (currentUser.role === Role.RESTAURANT_OWNER && payment.order.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only refund payments from your own restaurants');
    }

    const refundAmount = refundDto.amount || payment.amount;

    try {
      let externalRefundId: string | undefined;

      // Process refund based on payment method
      switch (payment.method) {
        case PaymentMethod.STRIPE:
          if (this.stripe && payment.externalPaymentId) {
            const stripeRefund = await this.stripe.refunds.create({
              payment_intent: payment.externalPaymentId,
              amount: refundAmount,
              reason: 'requested_by_customer',
              metadata: {
                reason: refundDto.reason,
                refundedBy: currentUser.name,
              },
            });
            externalRefundId = stripeRefund.id;
          }
          break;
        case PaymentMethod.YOOKASSA:
          if (this.yookassaShopId && this.yookassaSecretKey && payment.externalPaymentId) {
            const yookassaRefund = await axios.post(
              'https://api.yookassa.ru/v3/refunds',
              {
                amount: {
                  value: (refundAmount / 100).toFixed(2),
                  currency: payment.currency,
                },
                payment_id: payment.externalPaymentId,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Idempotence-Key': `refund_${payment.id}_${Date.now()}`,
                  Authorization: `Basic ${Buffer.from(`${this.yookassaShopId}:${this.yookassaSecretKey}`).toString('base64')}`,
                },
              },
            );
            externalRefundId = yookassaRefund.data.id;
          }
          break;
      }

      // Update payment record
      const refundedPayment = await this.prisma.payment.update({
        where: { id },
        data: {
          status: PrismaPaymentStatus.REFUNDED,
          metadata: {
            ...payment.metadata as any,
            refund: {
              amount: refundAmount,
              reason: refundDto.reason,
              externalRefundId,
              refundedBy: currentUser.name,
              refundedAt: new Date().toISOString(),
            },
          },
        },
        include: {
          order: {
            include: {
              restaurant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Payment refunded: ${payment.id}, amount: ${refundAmount}`);
      return refundedPayment;
    } catch (error) {
      this.logger.error('Refund processing failed', error.stack);
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  /**
   * Get payment statistics
   */
  async getStatistics(restaurantId?: string, currentUser?: User) {
    // Apply role-based filtering
    const where: any = {};
    
    if (currentUser?.role === Role.RESTAURANT_OWNER) {
      const restaurants = await this.prisma.restaurant.findMany({
        where: { ownerId: currentUser.id },
        select: { id: true },
      });
      
      where.order = {
        restaurantId: {
          in: restaurants.map(r => r.id),
        },
      };
    } else if (restaurantId) {
      where.order = {
        restaurantId,
      };
    }

    const [
      totalPayments,
      totalAmount,
      totalCommission,
      paymentsByMethod,
      paymentsByStatus,
      dailyTrends,
    ] = await Promise.all([
      // Total payments count
      this.prisma.payment.count({ where }),

      // Total amount and commission
      this.prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
          commissionAmount: true,
          netAmount: true,
        },
      }),

      // Total commission
      this.prisma.payment.aggregate({
        where: {
          ...where,
          status: PrismaPaymentStatus.COMPLETED,
        },
        _sum: {
          commissionAmount: true,
        },
      }),

      // Payments by method
      this.prisma.payment.groupBy({
        by: ['method'],
        where,
        _count: true,
        _sum: {
          amount: true,
        },
      }),

      // Payments by status
      this.prisma.payment.groupBy({
        by: ['status'],
        where,
        _count: true,
        _sum: {
          amount: true,
        },
      }),

      // Daily trends (last 7 days)
      this.prisma.$queryRaw`
        SELECT 
          DATE("createdAt") as date,
          COUNT(*) as count,
          SUM(amount) as amount
        FROM "Payment" 
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
          ${restaurantId ? `AND "orderId" IN (SELECT id FROM "Order" WHERE "restaurantId" = ${restaurantId})` : ''}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
    ]);

    const successfulPayments = await this.prisma.payment.count({
      where: {
        ...where,
        status: PrismaPaymentStatus.COMPLETED,
      },
    });

    return {
      totalPayments,
      totalAmount: totalAmount._sum.amount || 0,
      totalCommission: totalCommission._sum.commissionAmount || 0,
      netAmountToRestaurants: totalAmount._sum.netAmount || 0,
      successRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
      paymentsByMethod: paymentsByMethod.map(item => ({
        method: item.method,
        count: item._count,
        amount: item._sum.amount || 0,
      })),
      paymentsByStatus: paymentsByStatus.map(item => ({
        status: item.status,
        count: item._count,
        amount: item._sum.amount || 0,
      })),
      dailyTrends,
    };
  }

  /**
   * Find all payments with filtering
   */
  async findAll(
    currentUser: User,
    restaurantId?: string,
    status?: PaymentStatus,
    method?: PaymentMethod,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ payments: Payment[]; total: number }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Apply role-based filtering
    if (currentUser.role === Role.RESTAURANT_OWNER) {
      const restaurants = await this.prisma.restaurant.findMany({
        where: { ownerId: currentUser.id },
        select: { id: true },
      });
      
      where.order = {
        restaurantId: {
          in: restaurants.map(r => r.id),
        },
      };
    } else if (currentUser.role === Role.CUSTOMER) {
      where.order = {
        customerId: currentUser.id,
      };
    }

    // Apply additional filters
    if (restaurantId) {
      where.order = {
        ...where.order,
        restaurantId,
      };
    }

    if (status) {
      where.status = status;
    }

    if (method) {
      where.method = method;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          order: {
            include: {
              restaurant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, total };
  }

  /**
   * Find a single payment by ID
   */
  async findOne(id: string, currentUser: User): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Verify access
    if (currentUser.role === Role.CUSTOMER && payment.order.customerId !== currentUser.id) {
      throw new ForbiddenException('You can only access your own payments');
    }

    if (currentUser.role === Role.RESTAURANT_OWNER && payment.order.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only access payments from your own restaurants');
    }

    return payment;
  }
}