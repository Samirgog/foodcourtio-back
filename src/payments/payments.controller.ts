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
  Headers,
  RawBody,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  ConfirmPaymentDto,
  RefundPaymentDto,
  PaymentWebhookDto,
  CashPaymentDto,
  CardTerminalPaymentDto,
  PaymentResponseDto,
  PaymentStatisticsDto,
  PaymentMethod,
  PaymentStatus,
} from './dto/payment.dto';
import { Role, User } from '@prisma/client';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.paymentsService.create(createPaymentDto, currentUser);
  }

  @Post('cash')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Process cash payment (restaurant staff only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cash payment processed successfully',
    type: PaymentResponseDto,
  })
  async processCashPayment(
    @Body() cashPaymentDto: CashPaymentDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.paymentsService.processCashPayment(cashPaymentDto, currentUser);
  }

  @Post('card-terminal')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Process card terminal payment (restaurant staff only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Card terminal payment processed successfully',
    type: PaymentResponseDto,
  })
  async processCardTerminalPayment(
    @Body() terminalPaymentDto: CardTerminalPaymentDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.paymentsService.processCardTerminalPayment(terminalPaymentDto, currentUser);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get all payments with filtering and pagination' })
  @ApiQuery({
    name: 'restaurantId',
    required: false,
    description: 'Filter by restaurant ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
  @ApiQuery({
    name: 'method',
    required: false,
    enum: PaymentMethod,
    description: 'Filter by payment method',
  })
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payments retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        payments: {
          type: 'array',
          items: { $ref: '#/components/schemas/PaymentResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  async findAll(
    @CurrentUser() currentUser: User,
    @Query('restaurantId') restaurantId?: string,
    @Query('status') status?: PaymentStatus,
    @Query('method') method?: PaymentMethod,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    
    const { payments, total } = await this.paymentsService.findAll(
      currentUser,
      restaurantId,
      status,
      method,
      pageNum,
      limitNum,
    );

    return {
      payments,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('statistics')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Get global payment statistics (superadmin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Global payment statistics retrieved successfully',
    type: PaymentStatisticsDto,
  })
  async getGlobalStatistics(@CurrentUser() currentUser: User) {
    return this.paymentsService.getStatistics(undefined, currentUser);
  }

  @Get('restaurant/:restaurantId/statistics')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get payment statistics for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Restaurant payment statistics retrieved successfully',
    type: PaymentStatisticsDto,
  })
  async getRestaurantStatistics(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.paymentsService.getStatistics(restaurantId, currentUser);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get a payment by ID' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment retrieved successfully',
    type: PaymentResponseDto,
  })
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: User) {
    return this.paymentsService.findOne(id, currentUser);
  }

  @Post(':id/refund')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Refund a payment' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Payment refunded successfully',
    type: PaymentResponseDto,
  })
  async refund(
    @Param('id') id: string,
    @Body() refundDto: RefundPaymentDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.paymentsService.refund(id, refundDto, currentUser);
  }

  // Webhook endpoints (public, no authentication required)

  @Post('webhooks/stripe')
  @Public()
  @ApiExcludeEndpoint()
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @RawBody() rawBody: Buffer,
  ) {
    const webhookDto: PaymentWebhookDto = {
      eventType: 'webhook',
      provider: 'stripe',
      payload: JSON.parse(rawBody.toString()),
      signature,
    };

    await this.paymentsService.handleWebhook(webhookDto);
    return { received: true };
  }

  @Post('webhooks/yookassa')
  @Public()
  @ApiExcludeEndpoint()
  async handleYookassaWebhook(
    @Headers('x-yoomoney-event') eventType: string,
    @Body() payload: any,
  ) {
    const webhookDto: PaymentWebhookDto = {
      eventType,
      provider: 'yookassa',
      payload,
      signature: '', // YooKassa uses different validation
    };

    await this.paymentsService.handleWebhook(webhookDto);
    return { received: true };
  }

  // Customer-specific endpoints

  @Get('customer/my-payments')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get customer\'s own payments' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: PaymentStatus,
    description: 'Filter by payment status',
  })
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
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer payments retrieved successfully',
    type: [PaymentResponseDto],
  })
  async getMyPayments(
    @CurrentUser() currentUser: User,
    @Query('status') status?: PaymentStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    
    const { payments, total } = await this.paymentsService.findAll(
      currentUser,
      undefined, // No restaurant filter
      status,
      undefined, // No method filter
      pageNum,
      limitNum,
    );

    return {
      payments,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  // Restaurant staff endpoints

  @Get('restaurant/:restaurantId/pending')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get pending payments for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending payments retrieved successfully',
    type: [PaymentResponseDto],
  })
  async getPendingPayments(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    const { payments } = await this.paymentsService.findAll(
      currentUser,
      restaurantId,
      PaymentStatus.PENDING,
      undefined,
      1,
      100,
    );
    return payments;
  }

  @Get('restaurant/:restaurantId/completed')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get completed payments for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
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
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Completed payments retrieved successfully',
  })
  async getCompletedPayments(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    
    const { payments, total } = await this.paymentsService.findAll(
      currentUser,
      restaurantId,
      PaymentStatus.COMPLETED,
      undefined,
      pageNum,
      limitNum,
    );

    return {
      payments,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('restaurant/:restaurantId/commission-report')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get commission report for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Commission report retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalPayments: { type: 'number' },
        totalAmount: { type: 'number' },
        totalCommission: { type: 'number' },
        netAmount: { type: 'number' },
        commissionRate: { type: 'number' },
        period: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
  })
  async getCommissionReport(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // This would need additional implementation in the service
    // For now, return basic statistics
    return this.paymentsService.getStatistics(restaurantId, currentUser);
  }

  // Utility endpoints for payment methods

  @Get('methods/available')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get available payment methods' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available payment methods retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        methods: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              method: { type: 'string', enum: Object.values(PaymentMethod) },
              enabled: { type: 'boolean' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getAvailablePaymentMethods() {
    // This could be made configurable via database
    return {
      methods: [
        {
          method: PaymentMethod.STRIPE,
          enabled: true,
          description: 'Credit/Debit Cards via Stripe',
        },
        {
          method: PaymentMethod.YOOKASSA,
          enabled: true,
          description: 'Russian payment methods via YooKassa',
        },
        {
          method: PaymentMethod.CASH,
          enabled: true,
          description: 'Cash payment at restaurant',
        },
        {
          method: PaymentMethod.CARD_TERMINAL,
          enabled: true,
          description: 'Card payment via terminal at restaurant',
        },
      ],
    };
  }
}