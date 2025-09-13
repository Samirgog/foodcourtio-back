import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFoodcourtDto,
  UpdateFoodcourtDto,
  UpdateFoodcourtLayoutDto,
  FoodcourtStatsDto,
} from './dto/foodcourt.dto';
import { Foodcourt } from '@prisma/client';

@Injectable()
export class FoodcourtsService {
  private readonly logger = new Logger(FoodcourtsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new foodcourt
   */
  async create(createFoodcourtDto: CreateFoodcourtDto): Promise<Foodcourt> {
    try {
      // Validate layout if provided
      if (createFoodcourtDto.layout) {
        this.validateLayout(createFoodcourtDto.layout);
      }

      const foodcourt = await this.prisma.foodcourt.create({
        data: {
          name: createFoodcourtDto.name,
          address: createFoodcourtDto.address,
          description: createFoodcourtDto.description,
          commissionRate: createFoodcourtDto.commissionRate,
          layout: createFoodcourtDto.layout ? JSON.stringify(createFoodcourtDto.layout) : null,
          isActive: createFoodcourtDto.isActive ?? true,
        },
      });

      this.logger.log(`Foodcourt created: ${foodcourt.name}`);
      return foodcourt;
    } catch (error) {
      this.logger.error('Error creating foodcourt', error.stack);
      throw error;
    }
  }

  /**
   * Get all foodcourts with pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    isActive?: boolean,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [foodcourts, total] = await Promise.all([
      this.prisma.foodcourt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              restaurants: true,
              tables: true,
            },
          },
        },
      }),
      this.prisma.foodcourt.count({ where }),
    ]);

    const foodcourtsWithCounts = foodcourts.map((foodcourt) => ({
      ...foodcourt,
      restaurantCount: foodcourt._count.restaurants,
      tableCount: foodcourt._count.tables,
    }));

    return {
      foodcourts: foodcourtsWithCounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single foodcourt by ID
   */
  async findOne(id: string): Promise<Foodcourt> {
    const foodcourt = await this.prisma.foodcourt.findUnique({
      where: { id },
      include: {
        restaurants: {
          select: {
            id: true,
            name: true,
            status: true,
            isPublished: true,
          },
        },
        tables: {
          select: {
            id: true,
            number: true,
            position: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            restaurants: true,
            tables: true,
            customers: true,
          },
        },
      },
    });

    if (!foodcourt) {
      throw new NotFoundException(`Foodcourt with ID ${id} not found`);
    }

    return foodcourt;
  }

  /**
   * Update a foodcourt
   */
  async update(id: string, updateFoodcourtDto: UpdateFoodcourtDto): Promise<Foodcourt> {
    const foodcourt = await this.findOne(id);

    // Validate layout if provided
    if (updateFoodcourtDto.layout) {
      this.validateLayout(updateFoodcourtDto.layout);
    }

    try {
      // Handle layout JSON conversion
      const dataToUpdate: any = { ...updateFoodcourtDto };
      if (dataToUpdate.layout) {
        dataToUpdate.layout = JSON.stringify(dataToUpdate.layout);
      }
      
      const updatedFoodcourt = await this.prisma.foodcourt.update({
        where: { id },
        data: dataToUpdate,
      });

      this.logger.log(`Foodcourt updated: ${updatedFoodcourt.name}`);
      return updatedFoodcourt;
    } catch (error) {
      this.logger.error('Error updating foodcourt', error.stack);
      throw error;
    }
  }

  /**
   * Delete a foodcourt
   */
  async remove(id: string): Promise<void> {
    const foodcourt = await this.findOne(id);

    // Check if foodcourt has active restaurants
    const activeRestaurants = await this.prisma.restaurant.count({
      where: {
        foodcourtId: id,
        status: 'ACTIVE',
      },
    });

    if (activeRestaurants > 0) {
      throw new ConflictException(
        'Cannot delete foodcourt with active restaurants. Deactivate all restaurants first.',
      );
    }

    // Check if foodcourt has pending orders
    const pendingOrders = await this.prisma.order.count({
      where: {
        restaurant: {
          foodcourtId: id,
        },
        status: {
          in: ['PENDING', 'PREPARING'],
        },
      },
    });

    if (pendingOrders > 0) {
      throw new ConflictException(
        'Cannot delete foodcourt with pending orders. Complete all orders first.',
      );
    }

    try {
      await this.prisma.foodcourt.delete({
        where: { id },
      });

      this.logger.log(`Foodcourt deleted: ${foodcourt.name}`);
    } catch (error) {
      this.logger.error('Error deleting foodcourt', error.stack);
      throw error;
    }
  }

  /**
   * Update foodcourt layout
   */
  async updateLayout(id: string, updateLayoutDto: UpdateFoodcourtLayoutDto): Promise<Foodcourt> {
    const foodcourt = await this.findOne(id);

    // Validate layout
    this.validateLayout(updateLayoutDto.layout);

    try {
      const updatedFoodcourt = await this.prisma.foodcourt.update({
        where: { id },
        data: {
          layout: JSON.stringify(updateLayoutDto.layout),
        },
      });

      this.logger.log(`Foodcourt layout updated: ${updatedFoodcourt.name}`);
      return updatedFoodcourt;
    } catch (error) {
      this.logger.error('Error updating foodcourt layout', error.stack);
      throw error;
    }
  }

  /**
   * Get foodcourt statistics
   */
  async getStatistics(id: string): Promise<FoodcourtStatsDto> {
    const foodcourt = await this.findOne(id);

    try {
      // Get payment statistics
      const paymentStats = await this.prisma.payment.aggregate({
        where: {
          order: {
            restaurant: {
              foodcourtId: id,
            },
          },
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
          commission: true,
        },
        _count: {
          id: true,
        },
        _avg: {
          amount: true,
        },
      });

      // Get restaurant count
      const activeRestaurants = await this.prisma.restaurant.count({
        where: {
          foodcourtId: id,
          status: 'ACTIVE',
        },
      });

      // Get unique customers count
      const totalCustomers = await this.prisma.order.findMany({
        where: {
          restaurant: {
            foodcourtId: id,
          },
        },
        distinct: ['customerId'],
        select: {
          customerId: true,
        },
      });

      // Get monthly revenue trend (last 12 months)
      const monthlyStats = await this.getMonthlyRevenueTrend(id);

      return {
        totalRevenue: paymentStats._sum.amount || 0,
        totalCommission: paymentStats._sum.commission || 0,
        totalOrders: paymentStats._count.id || 0,
        activeRestaurants,
        totalCustomers: totalCustomers.length,
        averageOrderValue: paymentStats._avg.amount || 0,
        monthlyRevenue: monthlyStats,
      };
    } catch (error) {
      this.logger.error('Error getting foodcourt statistics', error.stack);
      throw error;
    }
  }

  /**
   * Toggle foodcourt active status
   */
  async toggleActive(id: string): Promise<Foodcourt> {
    const foodcourt = await this.findOne(id);

    try {
      const updatedFoodcourt = await this.prisma.foodcourt.update({
        where: { id },
        data: {
          isActive: !foodcourt.isActive,
        },
      });

      this.logger.log(
        `Foodcourt ${updatedFoodcourt.isActive ? 'activated' : 'deactivated'}: ${updatedFoodcourt.name}`,
      );
      return updatedFoodcourt;
    } catch (error) {
      this.logger.error('Error toggling foodcourt status', error.stack);
      throw error;
    }
  }

  /**
   * Get restaurant assignments for foodcourt
   */
  async getRestaurantAssignments(id: string) {
    const foodcourt = await this.findOne(id);

    return this.prisma.restaurant.findMany({
      where: { foodcourtId: id },
      select: {
        id: true,
        name: true,
        status: true,
        isPublished: true,
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        _count: {
          select: {
            orders: true,
            categories: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Validate layout configuration
   */
  private validateLayout(layout: any): void {
    if (!layout || typeof layout !== 'object') {
      throw new BadRequestException('Invalid layout configuration');
    }

    // Validate required fields
    if (!layout.width || !layout.height || layout.width <= 0 || layout.height <= 0) {
      throw new BadRequestException('Layout must have valid width and height');
    }

    // Validate restaurants positions
    if (layout.restaurants && Array.isArray(layout.restaurants)) {
      for (const restaurant of layout.restaurants) {
        if (
          !restaurant.position ||
          restaurant.position.x < 0 ||
          restaurant.position.y < 0 ||
          restaurant.position.x > layout.width ||
          restaurant.position.y > layout.height
        ) {
          throw new BadRequestException(
            `Restaurant ${restaurant.name || restaurant.id} position is outside layout bounds`,
          );
        }
      }
    }

    // Validate tables positions
    if (layout.tables && Array.isArray(layout.tables)) {
      for (const table of layout.tables) {
        if (
          !table.position ||
          table.position.x < 0 ||
          table.position.y < 0 ||
          table.position.x > layout.width ||
          table.position.y > layout.height
        ) {
          throw new BadRequestException(
            `Table ${table.number || table.id} position is outside layout bounds`,
          );
        }
      }
    }
  }

  /**
   * Get monthly revenue trend for the last 12 months
   */
  private async getMonthlyRevenueTrend(foodcourtId: string) {
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const stats = await this.prisma.payment.aggregate({
        where: {
          order: {
            restaurant: {
              foodcourtId,
            },
          },
          status: 'COMPLETED',
          createdAt: {
            gte: month,
            lt: nextMonth,
          },
        },
        _sum: {
          amount: true,
          commission: true,
        },
      });

      months.push({
        month: month.toISOString().slice(0, 7), // YYYY-MM format
        revenue: stats._sum.amount || 0,
        commission: stats._sum.commission || 0,
      });
    }

    return months;
  }
}