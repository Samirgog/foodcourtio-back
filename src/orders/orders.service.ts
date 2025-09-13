import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
  OrderStatus,
  CancelOrderDto,
} from './dto/order.dto';
import { Order, User, Role, OrderStatus as PrismaOrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new order
   */
  async create(createOrderDto: CreateOrderDto, currentUser: User): Promise<Order> {
    try {
      // Verify restaurant exists and is active
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: createOrderDto.restaurantId },
        include: {
          categories: {
            include: {
              products: true,
            },
          },
        },
      });

      if (!restaurant) {
        throw new NotFoundException(`Restaurant with ID ${createOrderDto.restaurantId} not found`);
      }

      if (restaurant.status !== 'ACTIVE') {
        throw new BadRequestException('Restaurant is not currently accepting orders');
      }

      // Verify table if provided
      if (createOrderDto.tableId) {
        const table = await this.prisma.table.findFirst({
          where: {
            id: createOrderDto.tableId,
            foodcourtId: restaurant.foodcourtId,
          },
        });

        if (!table) {
          throw new NotFoundException('Table not found in this foodcourt');
        }
      }

      // Validate order items and calculate total
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of createOrderDto.items) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          include: {
            category: true,
          },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${item.productId} not found`);
        }

        if (product.category.restaurantId !== createOrderDto.restaurantId) {
          throw new BadRequestException('Product does not belong to this restaurant');
        }

        if (!product.isAvailable) {
          throw new BadRequestException(`Product "${product.name}" is currently unavailable`);
        }

        // Calculate item price (base price + variant modifier)
        let itemPrice = product.price;
        if (item.variant && product.variants) {
          const variants = product.variants as any[];
          const selectedVariant = variants.find(v => v.name === item.variant);
          if (selectedVariant) {
            itemPrice += selectedVariant.priceModifier || 0;
          }
        }

        const itemTotal = itemPrice * item.quantity;
        totalAmount += itemTotal;

        validatedItems.push({
          productId: item.productId,
          variant: item.variant,
          quantity: item.quantity,
          unitPrice: itemPrice,
          totalPrice: itemTotal,
          specialInstructions: item.specialInstructions,
        });
      }

      // Generate order number
      const orderNumber = await this.generateOrderNumber(restaurant.id);

      // Create order with items in transaction
      const order = await this.prisma.$transaction(async (prisma) => {
        const newOrder = await prisma.order.create({
          data: {
            orderNumber,
            status: PrismaOrderStatus.PENDING,
            customerName: createOrderDto.customerName,
            customerPhone: createOrderDto.customerPhone,
            totalAmount,
            deliveryType: createOrderDto.deliveryType || 'DINE_IN',
            specialInstructions: createOrderDto.specialInstructions,
            paymentMethod: createOrderDto.paymentMethod,
            restaurantId: createOrderDto.restaurantId,
            tableId: createOrderDto.tableId,
            customerId: currentUser.role === Role.CUSTOMER ? currentUser.id : null,
          },
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },
            table: {
              select: {
                id: true,
                number: true,
              },
            },
          },
        });

        // Create order items
        for (const item of validatedItems) {
          await prisma.orderItem.create({
            data: {
              ...item,
              orderId: newOrder.id,
            },
          });
        }

        return newOrder;
      });

      this.logger.log(`Order created: ${orderNumber} for restaurant ${restaurant.name}`);
      return order;
    } catch (error) {
      this.logger.error('Error creating order', error.stack);
      throw error;
    }
  }

  /**
   * Get all orders with filtering and pagination
   */
  async findAll(
    currentUser: User,
    restaurantId?: string,
    status?: OrderStatus,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Apply role-based filtering
    if (currentUser.role === Role.RESTAURANT_OWNER) {
      const restaurants = await this.prisma.restaurant.findMany({
        where: { ownerId: currentUser.id },
        select: { id: true },
      });
      
      where.restaurantId = {
        in: restaurants.map(r => r.id),
      };
    } else if (currentUser.role === Role.EMPLOYEE) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: currentUser.id },
        select: { restaurantId: true },
      });
      
      if (employee) {
        where.restaurantId = employee.restaurantId;
      } else {
        throw new ForbiddenException('Employee not found');
      }
    } else if (currentUser.role === Role.CUSTOMER) {
      where.customerId = currentUser.id;
    }

    // Apply additional filters
    if (restaurantId) {
      if (currentUser.role !== Role.SUPERADMIN) {
        // Verify user has access to this restaurant
        await this.verifyRestaurantAccess(restaurantId, currentUser);
      }
      where.restaurantId = restaurantId;
    }

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
          table: {
            select: {
              id: true,
              number: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              amount: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total };
  }

  /**
   * Get a single order by ID
   */
  async findOne(id: string, currentUser: User): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        table: {
          select: {
            id: true,
            number: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            telegramId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            method: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Verify access based on user role
    this.verifyOrderAccess(order, currentUser);

    return order;
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto, currentUser: User): Promise<Order> {
    const order = await this.findOne(id, currentUser);

    // Validate status transition
    this.validateStatusTransition(order.status as OrderStatus, updateStatusDto.status);

    // Only restaurant staff can update order status
    if (![Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE].includes(currentUser.role as any)) {
      throw new ForbiddenException('Only restaurant staff can update order status');
    }

    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: {
          status: updateStatusDto.status as PrismaOrderStatus,
          estimatedTime: updateStatusDto.estimatedTime,
          updatedAt: new Date(),
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Order ${order.orderNumber} status updated to ${updateStatusDto.status}`);
      
      // TODO: Send notification to customer
      // await this.notificationService.sendOrderStatusUpdate(updatedOrder);

      return updatedOrder;
    } catch (error) {
      this.logger.error('Error updating order status', error.stack);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancel(id: string, cancelDto: CancelOrderDto, currentUser: User): Promise<Order> {
    const order = await this.findOne(id, currentUser);

    // Validate cancellation
    if (order.status === PrismaOrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed order');
    }

    if (order.status === PrismaOrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    try {
      const cancelledOrder = await this.prisma.order.update({
        where: { id },
        data: {
          status: PrismaOrderStatus.CANCELLED,
          specialInstructions: order.specialInstructions 
            ? `${order.specialInstructions}\n\nCANCELLED: ${cancelDto.reason}`
            : `CANCELLED: ${cancelDto.reason}`,
          updatedAt: new Date(),
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
          payment: true,
        },
      });

      this.logger.log(`Order ${order.orderNumber} cancelled: ${cancelDto.reason}`);

      // TODO: Handle refund if requested and payment exists
      if (cancelDto.refund && cancelledOrder.payment) {
        // await this.paymentService.refund(cancelledOrder.payment.id);
      }

      return cancelledOrder;
    } catch (error) {
      this.logger.error('Error cancelling order', error.stack);
      throw error;
    }
  }

  /**
   * Get order statistics
   */
  async getStatistics(restaurantId: string, currentUser: User) {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalOrders,
      ordersToday,
      totalRevenue,
      revenueToday,
      ordersByStatus,
      popularProducts,
      hourlyOrders,
    ] = await Promise.all([
      // Total orders count
      this.prisma.order.count({
        where: { restaurantId },
      }),

      // Orders today
      this.prisma.order.count({
        where: {
          restaurantId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // Total revenue
      this.prisma.order.aggregate({
        where: {
          restaurantId,
          status: { not: PrismaOrderStatus.CANCELLED },
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Revenue today
      this.prisma.order.aggregate({
        where: {
          restaurantId,
          status: { not: PrismaOrderStatus.CANCELLED },
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Orders by status
      this.prisma.order.groupBy({
        by: ['status'],
        where: { restaurantId },
        _count: true,
      }),

      // Popular products (by quantity)
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            restaurantId,
            status: { not: PrismaOrderStatus.CANCELLED },
          },
        },
        _sum: {
          quantity: true,
          totalPrice: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 10,
      }),

      // Hourly orders today
      this.prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM "createdAt") as hour,
          COUNT(*) as count
        FROM "Order" 
        WHERE "restaurantId" = ${restaurantId}
          AND "createdAt" >= ${today}
          AND "createdAt" < ${tomorrow}
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour
      `,
    ]);

    // Get product names for popular products
    const productIds = popularProducts.map(p => p.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const popularProductsWithNames = popularProducts.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        quantity: item._sum.quantity || 0,
        revenue: item._sum.totalPrice || 0,
      };
    });

    return {
      totalOrders,
      ordersToday,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      revenueToday: revenueToday._sum.totalAmount || 0,
      averageOrderValue: totalOrders > 0 ? (totalRevenue._sum.totalAmount || 0) / totalOrders : 0,
      ordersByStatus: ordersByStatus.map(item => ({
        status: item.status,
        count: item._count,
      })),
      popularProducts: popularProductsWithNames,
      hourlyOrders,
    };
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(restaurantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const dailyCount = await this.prisma.order.count({
      where: {
        restaurantId,
        createdAt: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
          lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
        },
      },
    });

    return `${dateStr}-${String(dailyCount + 1).padStart(3, '0')}`;
  }

  /**
   * Validate order status transition
   */
  private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [], // Cannot transition from completed
      [OrderStatus.CANCELLED]: [], // Cannot transition from cancelled
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Verify user has access to the restaurant
   */
  private async verifyRestaurantAccess(restaurantId: string, currentUser: User): Promise<void> {
    if (currentUser.role === Role.SUPERADMIN) return;

    if (currentUser.role === Role.RESTAURANT_OWNER) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { ownerId: true },
      });

      if (!restaurant) {
        throw new NotFoundException(`Restaurant with ID ${restaurantId} not found`);
      }

      if (restaurant.ownerId !== currentUser.id) {
        throw new ForbiddenException('You can only access your own restaurants');
      }
    } else if (currentUser.role === Role.EMPLOYEE) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: currentUser.id },
        select: { restaurantId: true },
      });

      if (!employee || employee.restaurantId !== restaurantId) {
        throw new ForbiddenException('You can only access orders from your assigned restaurant');
      }
    }
  }

  /**
   * Verify user has access to the order
   */
  private verifyOrderAccess(order: any, currentUser: User): void {
    if (currentUser.role === Role.SUPERADMIN) return;

    if (currentUser.role === Role.RESTAURANT_OWNER) {
      if (order.restaurant.ownerId !== currentUser.id) {
        throw new ForbiddenException('You can only access orders from your own restaurants');
      }
    } else if (currentUser.role === Role.EMPLOYEE) {
      // Employee access will be verified by restaurant check in the caller
    } else if (currentUser.role === Role.CUSTOMER) {
      if (order.customerId !== currentUser.id) {
        throw new ForbiddenException('You can only access your own orders');
      }
    }
  }
}