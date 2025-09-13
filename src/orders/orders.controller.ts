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
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
  OrderResponseDto,
  OrderStatisticsDto,
  CancelOrderDto,
  OrderStatus,
} from './dto/order.dto';
import { Role, User } from '@prisma/client';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.ordersService.create(createOrderDto, currentUser);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get all orders with filtering and pagination' })
  @ApiQuery({
    name: 'restaurantId',
    required: false,
    description: 'Filter by restaurant ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filter by order status',
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
    description: 'Orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderResponseDto' },
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
    @Query('status') status?: OrderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    
    const { orders, total } = await this.ordersService.findAll(
      currentUser,
      restaurantId,
      status,
      pageNum,
      limitNum,
    );

    return {
      orders,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('restaurant/:restaurantId/statistics')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get order statistics for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order statistics retrieved successfully',
    type: OrderStatisticsDto,
  })
  async getStatistics(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.ordersService.getStatistics(restaurantId, currentUser);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get an order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: User) {
    return this.ordersService.findOne(id, currentUser);
  }

  @Patch(':id/status')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order status updated successfully',
    type: OrderResponseDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.ordersService.updateStatus(id, updateStatusDto, currentUser);
  }

  @Post(':id/cancel')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order cancelled successfully',
    type: OrderResponseDto,
  })
  async cancel(
    @Param('id') id: string,
    @Body() cancelDto: CancelOrderDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.ordersService.cancel(id, cancelDto, currentUser);
  }

  // Additional endpoints for restaurant staff

  @Get('restaurant/:restaurantId/pending')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get pending orders for a restaurant (kitchen display)' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending orders retrieved successfully',
    type: [OrderResponseDto],
  })
  async getPendingOrders(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    const { orders } = await this.ordersService.findAll(
      currentUser,
      restaurantId,
      OrderStatus.PENDING,
      1,
      100,
    );
    return orders;
  }

  @Get('restaurant/:restaurantId/preparing')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get orders being prepared for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preparing orders retrieved successfully',
    type: [OrderResponseDto],
  })
  async getPreparingOrders(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    const { orders } = await this.ordersService.findAll(
      currentUser,
      restaurantId,
      OrderStatus.PREPARING,
      1,
      100,
    );
    return orders;
  }

  @Get('restaurant/:restaurantId/ready')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get ready orders for a restaurant (pickup display)' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ready orders retrieved successfully',
    type: [OrderResponseDto],
  })
  async getReadyOrders(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    const { orders } = await this.ordersService.findAll(
      currentUser,
      restaurantId,
      OrderStatus.READY,
      1,
      100,
    );
    return orders;
  }

  @Get('customer/my-orders')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Get customer\'s own orders' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description: 'Filter by order status',
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
    description: 'Customer orders retrieved successfully',
    type: [OrderResponseDto],
  })
  async getMyOrders(
    @CurrentUser() currentUser: User,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    
    const { orders, total } = await this.ordersService.findAll(
      currentUser,
      undefined, // No restaurant filter
      status,
      pageNum,
      limitNum,
    );

    return {
      orders,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  // Bulk operations for restaurant staff
  
  @Post('bulk/update-status')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Bulk update order status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Orders updated successfully',
  })
  async bulkUpdateStatus(
    @Body() bulkUpdateDto: {
      orderIds: string[];
      status: OrderStatus;
      estimatedTime?: number;
    },
    @CurrentUser() currentUser: User,
  ) {
    const results = [];
    
    for (const orderId of bulkUpdateDto.orderIds) {
      try {
        const order = await this.ordersService.updateStatus(
          orderId,
          {
            status: bulkUpdateDto.status,
            estimatedTime: bulkUpdateDto.estimatedTime,
          },
          currentUser,
        );
        results.push({ orderId, success: true, order });
      } catch (error) {
        results.push({ orderId, success: false, error: error.message });
      }
    }

    return {
      results,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length,
    };
  }
}