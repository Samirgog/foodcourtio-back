import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsEmail,
  IsObject,
} from 'class-validator';

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  STRIPE = 'STRIPE',
  YOOKASSA = 'YOOKASSA',
  CASH = 'CASH',
  CARD_TERMINAL = 'CARD_TERMINAL',
}

export class CreatePaymentDto {
  @ApiProperty({ description: 'Order ID for this payment' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Payment amount in cents/kopecks' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ 
    description: 'Payment method', 
    enum: PaymentMethod,
    example: PaymentMethod.STRIPE 
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ description: 'Currency code (USD, RUB, etc.)', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ description: 'Customer email for receipt', required: false })
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @ApiProperty({ description: 'Payment description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Return URL after payment', required: false })
  @IsString()
  @IsOptional()
  returnUrl?: string;

  @ApiProperty({ description: 'Cancel URL if payment cancelled', required: false })
  @IsString()
  @IsOptional()
  cancelUrl?: string;
}

export class StripePaymentIntentDto {
  @ApiProperty({ description: 'Stripe Payment Intent ID' })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;

  @ApiProperty({ description: 'Order ID' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Amount in cents' })
  @IsNumber()
  @Min(1)
  amount: number;
}

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Payment ID to confirm' })
  @IsUUID()
  @IsNotEmpty()
  paymentId: string;

  @ApiProperty({ description: 'External payment ID from provider', required: false })
  @IsString()
  @IsOptional()
  externalPaymentId?: string;

  @ApiProperty({ description: 'Payment provider response', required: false })
  @IsObject()
  @IsOptional()
  providerResponse?: any;
}

export class RefundPaymentDto {
  @ApiProperty({ description: 'Refund amount in cents (optional, defaults to full amount)', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  amount?: number;

  @ApiProperty({ description: 'Refund reason' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class PaymentWebhookDto {
  @ApiProperty({ description: 'Webhook event type' })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ description: 'Payment provider (stripe/yookassa)' })
  @IsEnum(['stripe', 'yookassa'])
  provider: 'stripe' | 'yookassa';

  @ApiProperty({ description: 'Webhook payload' })
  @IsObject()
  payload: any;

  @ApiProperty({ description: 'Webhook signature for validation' })
  @IsString()
  @IsNotEmpty()
  signature: string;
}

export class PaymentResponseDto {
  @ApiProperty({ description: 'Payment ID' })
  id: string;

  @ApiProperty({ description: 'Order ID' })
  orderId: string;

  @ApiProperty({ description: 'Payment amount' })
  amount: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  method: PaymentMethod;

  @ApiProperty({ description: 'Payment status', enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ description: 'External payment ID from provider', required: false })
  externalPaymentId?: string;

  @ApiProperty({ description: 'Commission amount', required: false })
  commissionAmount?: number;

  @ApiProperty({ description: 'Commission rate used', required: false })
  commissionRate?: number;

  @ApiProperty({ description: 'Net amount after commission', required: false })
  netAmount?: number;

  @ApiProperty({ description: 'Payment URL for customer', required: false })
  paymentUrl?: string;

  @ApiProperty({ description: 'Provider response metadata', required: false })
  metadata?: any;

  @ApiProperty({ description: 'Payment creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Payment update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Order information' })
  order?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    restaurant: {
      id: string;
      name: string;
    };
  };
}

export class PaymentStatisticsDto {
  @ApiProperty({ description: 'Total payments processed' })
  totalPayments: number;

  @ApiProperty({ description: 'Total payment amount' })
  totalAmount: number;

  @ApiProperty({ description: 'Total commission earned' })
  totalCommission: number;

  @ApiProperty({ description: 'Net amount to restaurants' })
  netAmountToRestaurants: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate: number;

  @ApiProperty({ description: 'Payments by method' })
  paymentsByMethod: {
    method: PaymentMethod;
    count: number;
    amount: number;
  }[];

  @ApiProperty({ description: 'Payments by status' })
  paymentsByStatus: {
    status: PaymentStatus;
    count: number;
    amount: number;
  }[];

  @ApiProperty({ description: 'Daily payment trends (last 7 days)' })
  dailyTrends: {
    date: string;
    count: number;
    amount: number;
  }[];
}

export class CashPaymentDto {
  @ApiProperty({ description: 'Order ID for cash payment' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Amount received in cash (in cents)' })
  @IsNumber()
  @Min(1)
  amountReceived: number;

  @ApiProperty({ description: 'Change given to customer (in cents)', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  changeGiven?: number;

  @ApiProperty({ description: 'Employee who processed the payment', required: false })
  @IsString()
  @IsOptional()
  processedBy?: string;
}

export class CardTerminalPaymentDto {
  @ApiProperty({ description: 'Order ID for card terminal payment' })
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: 'Terminal transaction ID' })
  @IsString()
  @IsNotEmpty()
  terminalTransactionId: string;

  @ApiProperty({ description: 'Terminal ID used' })
  @IsString()
  @IsNotEmpty()
  terminalId: string;

  @ApiProperty({ description: 'Card last 4 digits', required: false })
  @IsString()
  @IsOptional()
  cardLast4?: string;

  @ApiProperty({ description: 'Card type (visa, mastercard, etc.)', required: false })
  @IsString()
  @IsOptional()
  cardType?: string;
}