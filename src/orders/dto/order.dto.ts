import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsUUID,
  IsEnum,
  IsBoolean,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class OrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Product variant selection', required: false })
  @IsString()
  @IsOptional()
  variant?: string;

  @ApiProperty({ description: 'Quantity of the product', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price at time of order' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ description: 'Special instructions for this item', required: false })
  @IsString()
  @IsOptional()
  specialInstructions?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Restaurant ID where the order is placed' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Table ID (for dine-in orders)', required: false })
  @IsUUID()
  @IsOptional()
  tableId?: string;

  @ApiProperty({ 
    description: 'Order items',
    type: [OrderItemDto],
    minLength: 1
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @ArrayMinSize(1)
  items: OrderItemDto[];

  @ApiProperty({ description: 'Customer name' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ description: 'Customer phone number' })
  @IsString()
  @IsNotEmpty()
  customerPhone: string;

  @ApiProperty({ description: 'Special instructions for the entire order', required: false })
  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @ApiProperty({ 
    description: 'Delivery type', 
    enum: ['DINE_IN', 'TAKEAWAY'], 
    default: 'DINE_IN' 
  })
  @IsEnum(['DINE_IN', 'TAKEAWAY'])
  @IsOptional()
  deliveryType?: 'DINE_IN' | 'TAKEAWAY';

  @ApiProperty({ description: 'Payment method', required: false })
  @IsString()
  @IsOptional()
  paymentMethod?: string;
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @ApiProperty({ description: 'Order status', enum: OrderStatus, required: false })
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @ApiProperty({ description: 'Estimated preparation time in minutes', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedTime?: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ description: 'New order status', enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiProperty({ description: 'Status change reason or note', required: false })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({ description: 'Estimated preparation time in minutes', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedTime?: number;
}

export class OrderResponseDto {
  @ApiProperty({ description: 'Order ID' })
  id: string;

  @ApiProperty({ description: 'Order number (display)' })
  orderNumber: string;

  @ApiProperty({ description: 'Order status', enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ description: 'Customer name' })
  customerName: string;

  @ApiProperty({ description: 'Customer phone' })
  customerPhone: string;

  @ApiProperty({ description: 'Total amount' })
  totalAmount: number;

  @ApiProperty({ description: 'Delivery type' })
  deliveryType: string;

  @ApiProperty({ description: 'Special instructions', required: false })
  specialInstructions?: string;

  @ApiProperty({ description: 'Estimated preparation time', required: false })
  estimatedTime?: number;

  @ApiProperty({ description: 'Order creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Restaurant ID' })
  restaurantId: string;

  @ApiProperty({ description: 'Table ID', required: false })
  tableId?: string;

  @ApiProperty({ description: 'Customer ID', required: false })
  customerId?: string;

  @ApiProperty({ description: 'Restaurant information' })
  restaurant?: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Table information', required: false })
  table?: {
    id: string;
    number: number;
  };

  @ApiProperty({ description: 'Order items' })
  items: OrderItemResponseDto[];

  @ApiProperty({ description: 'Payment information', required: false })
  payment?: {
    id: string;
    status: string;
    amount: number;
  };
}

export class OrderItemResponseDto {
  @ApiProperty({ description: 'Order item ID' })
  id: string;

  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({ description: 'Product variant', required: false })
  variant?: string;

  @ApiProperty({ description: 'Quantity' })
  quantity: number;

  @ApiProperty({ description: 'Unit price' })
  unitPrice: number;

  @ApiProperty({ description: 'Total price for this item' })
  totalPrice: number;

  @ApiProperty({ description: 'Special instructions', required: false })
  specialInstructions?: string;

  @ApiProperty({ description: 'Product information' })
  product: {
    id: string;
    name: string;
    image?: string;
  };
}

export class OrderStatisticsDto {
  @ApiProperty({ description: 'Total orders count' })
  totalOrders: number;

  @ApiProperty({ description: 'Orders today' })
  ordersToday: number;

  @ApiProperty({ description: 'Total revenue' })
  totalRevenue: number;

  @ApiProperty({ description: 'Revenue today' })
  revenueToday: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Orders by status' })
  ordersByStatus: {
    status: OrderStatus;
    count: number;
  }[];

  @ApiProperty({ description: 'Popular products' })
  popularProducts: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }[];

  @ApiProperty({ description: 'Hourly order distribution today' })
  hourlyOrders: {
    hour: number;
    count: number;
  }[];
}

export class CancelOrderDto {
  @ApiProperty({ description: 'Cancellation reason' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: 'Whether to refund the payment', default: false })
  @IsBoolean()
  @IsOptional()
  refund?: boolean;
}