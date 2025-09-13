import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRestaurantDto,
  UpdateRestaurantDto,
  RestaurantStatsDto,
} from './dto/restaurant.dto';
import { Restaurant, User, Role, RestaurantStatus } from '@prisma/client';

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new restaurant
   */
  async create(createRestaurantDto: CreateRestaurantDto, currentUser: User): Promise<Restaurant> {
    // Only restaurant owners can create restaurants, or superadmins can create for others
    if (currentUser.role !== Role.RESTAURANT_OWNER && currentUser.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only restaurant owners can create restaurants');
    }

    // Verify foodcourt exists and is active
    const foodcourt = await this.prisma.foodcourt.findUnique({
      where: { id: createRestaurantDto.foodcourtId },
    });

    if (!foodcourt) {
      throw new NotFoundException(`Foodcourt with ID ${createRestaurantDto.foodcourtId} not found`);
    }

    if (!foodcourt.isActive) {
      throw new BadRequestException('Cannot create restaurant in inactive foodcourt');
    }

    // Check if user already has a restaurant with the same name in this foodcourt
    const existingRestaurant = await this.prisma.restaurant.findFirst({
      where: {
        name: createRestaurantDto.name,
        foodcourtId: createRestaurantDto.foodcourtId,
        ownerId: currentUser.id,
      },
    });

    if (existingRestaurant) {
      throw new ConflictException(
        `You already have a restaurant named "${createRestaurantDto.name}" in this foodcourt`,
      );
    }

    try {
      const restaurant = await this.prisma.restaurant.create({
        data: {
          name: createRestaurantDto.name,
          description: createRestaurantDto.description,
          foodcourtId: createRestaurantDto.foodcourtId,
          ownerId: currentUser.id,
          location: createRestaurantDto.location ? JSON.stringify(createRestaurantDto.location) : null,
          status: createRestaurantDto.status || RestaurantStatus.DRAFT,
          isPublished: createRestaurantDto.isPublished ?? false,
        },
        include: {
          foodcourt: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      });

      this.logger.log(`Restaurant created: ${restaurant.name} by ${currentUser.name}`);
      return restaurant;
    } catch (error) {
      this.logger.error('Error creating restaurant', error.stack);
      throw error;
    }
  }

  /**
   * Get all restaurants with filtering and pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    currentUser: User,
    foodcourtId?: string,
    status?: RestaurantStatus,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // Restaurant owners can only see their own restaurants
    if (currentUser.role === Role.RESTAURANT_OWNER) {
      where.ownerId = currentUser.id;
    }

    // Filter by foodcourt
    if (foodcourtId) {
      where.foodcourtId = foodcourtId;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Search functionality
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [restaurants, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          foodcourt: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          _count: {
            select: {
              categories: true,
              employees: true,
              orders: true,
            },
          },
        },
      }),
      this.prisma.restaurant.count({ where }),
    ]);

    // Add basic stats to each restaurant
    const restaurantsWithStats = await Promise.all(
      restaurants.map(async (restaurant) => {
        const revenueStats = await this.prisma.payment.aggregate({
          where: {
            order: {
              restaurantId: restaurant.id,
            },
            status: 'COMPLETED',
          },
          _sum: {
            netAmount: true,
          },
        });

        return {
          ...restaurant,
          stats: {
            totalOrders: restaurant._count.orders,
            totalRevenue: revenueStats._sum.netAmount || 0,
            categoriesCount: restaurant._count.categories,
            productsCount: 0, // Will be calculated properly when needed
            employeesCount: restaurant._count.employees,
          },
        };
      }),
    );

    return {
      restaurants: restaurantsWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single restaurant by ID
   */
  async findOne(id: string, currentUser: User): Promise<Restaurant> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        foodcourt: {
          select: {
            id: true,
            name: true,
            address: true,
            isActive: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        categories: {
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        employees: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${id} not found`);
    }

    // Restaurant owners can only access their own restaurants
    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only access your own restaurants');
    }

    return restaurant;
  }

  /**
   * Update a restaurant
   */
  async update(id: string, updateRestaurantDto: UpdateRestaurantDto, currentUser: User): Promise<Restaurant> {
    const restaurant = await this.findOne(id, currentUser);

    // Only owners or superadmins can update restaurants
    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only update your own restaurants');
    }

    // If changing foodcourt, verify the new one exists and is active
    if (updateRestaurantDto.foodcourtId) {
      const foodcourt = await this.prisma.foodcourt.findUnique({
        where: { id: updateRestaurantDto.foodcourtId },
      });

      if (!foodcourt || !foodcourt.isActive) {
        throw new BadRequestException('Invalid or inactive foodcourt');
      }
    }

    try {
      const { foodcourtId, ...dataToUpdate } = updateRestaurantDto;
      
      // Handle location JSON conversion
      if (dataToUpdate.location) {
        (dataToUpdate as any).location = JSON.stringify(dataToUpdate.location);
      }
      
      const updatedRestaurant = await this.prisma.restaurant.update({
        where: { id },
        data: dataToUpdate as any,
        include: {
          foodcourt: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      });

      this.logger.log(`Restaurant updated: ${updatedRestaurant.name}`);
      return updatedRestaurant;
    } catch (error) {
      this.logger.error('Error updating restaurant', error.stack);
      throw error;
    }
  }

  /**
   * Delete a restaurant
   */
  async remove(id: string, currentUser: User): Promise<void> {
    const restaurant = await this.findOne(id, currentUser);

    // Only owners or superadmins can delete restaurants
    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only delete your own restaurants');
    }

    // Check for pending orders
    const pendingOrders = await this.prisma.order.count({
      where: {
        restaurantId: id,
        status: {
          in: ['PENDING', 'PREPARING'],
        },
      },
    });

    if (pendingOrders > 0) {
      throw new ConflictException('Cannot delete restaurant with pending orders. Complete all orders first.');
    }

    try {
      await this.prisma.restaurant.delete({
        where: { id },
      });

      this.logger.log(`Restaurant deleted: ${restaurant.name} by ${currentUser.name}`);
    } catch (error) {
      this.logger.error('Error deleting restaurant', error.stack);
      throw error;
    }
  }

  /**
   * Toggle restaurant published status
   */
  async togglePublished(id: string, isPublished: boolean, currentUser: User): Promise<Restaurant> {
    const restaurant = await this.findOne(id, currentUser);

    // Only owners can publish/unpublish their restaurants
    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only manage your own restaurants');
    }

    // Validate restaurant is ready for publishing
    if (isPublished) {
      await this.validateRestaurantForPublishing(id);
    }

    try {
      const updatedRestaurant = await this.prisma.restaurant.update({
        where: { id },
        data: { isPublished },
        include: {
          foodcourt: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      });

      this.logger.log(`Restaurant ${isPublished ? 'published' : 'unpublished'}: ${updatedRestaurant.name}`);
      return updatedRestaurant;
    } catch (error) {
      this.logger.error('Error toggling restaurant publish status', error.stack);
      throw error;
    }
  }

  /**
   * Get restaurant statistics
   */
  async getStatistics(id: string, currentUser: User): Promise<RestaurantStatsDto> {
    const restaurant = await this.findOne(id, currentUser);

    try {
      // Get payment statistics
      const paymentStats = await this.prisma.payment.aggregate({
        where: {
          order: {
            restaurantId: id,
          },
          status: 'COMPLETED',
        },
        _sum: {
          netAmount: true,
        },
        _count: {
          id: true,
        },
        _avg: {
          netAmount: true,
        },
      });

      // Get order status distribution
      const orderStatusStats = await this.prisma.order.groupBy({
        by: ['status'],
        where: {
          restaurantId: id,
        },
        _count: {
          id: true,
        },
      });

      // Get unique customers
      const uniqueCustomers = await this.prisma.order.findMany({
        where: {
          restaurantId: id,
        },
        distinct: ['customerId'],
        select: {
          customerId: true,
        },
      });

      // Get monthly revenue trend (last 12 months)
      const monthlyRevenue = await this.getMonthlyRevenueTrend(id);

      // Get top selling products
      const topProducts = await this.getTopSellingProducts(id, 10);

      return {
        totalOrders: paymentStats._count.id || 0,
        totalRevenue: paymentStats._sum.netAmount || 0,
        monthlyRevenue,
        topProducts,
        orderStatusStats: orderStatusStats.map(stat => ({
          status: stat.status,
          count: stat._count.id,
        })),
        averageOrderValue: paymentStats._avg.netAmount || 0,
        customerCount: uniqueCustomers.length,
      };
    } catch (error) {
      this.logger.error('Error getting restaurant statistics', error.stack);
      throw error;
    }
  }

  /**
   * Get restaurants by foodcourt (public method for mini-app)
   */
  async getRestaurantsByFoodcourt(foodcourtId: string) {
    return this.prisma.restaurant.findMany({
      where: {
        foodcourtId,
        isPublished: true,
        status: RestaurantStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        description: true,
        logo: true,
        banner: true,
        location: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Upload restaurant image (logo or banner)
   */
  async uploadImage(
    id: string,
    imageType: 'logo' | 'banner',
    file: Express.Multer.File,
    currentUser: User,
  ): Promise<Restaurant> {
    const restaurant = await this.findOne(id, currentUser);

    // Only owners can upload images for their restaurants
    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only manage your own restaurants');
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    // In a real application, you would upload the file to cloud storage
    // For now, we'll simulate storing the file path
    const imagePath = `/uploads/restaurants/${id}/${imageType}-${Date.now()}-${file.originalname}`;

    try {
      const updateData = {};
      updateData[imageType] = imagePath;

      const updatedRestaurant = await this.prisma.restaurant.update({
        where: { id },
        data: updateData,
        include: {
          foodcourt: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      });

      this.logger.log(`Restaurant ${imageType} updated: ${updatedRestaurant.name}`);
      return updatedRestaurant;
    } catch (error) {
      this.logger.error(`Error uploading restaurant ${imageType}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate restaurant is ready for publishing
   */
  private async validateRestaurantForPublishing(restaurantId: string): Promise<void> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        categories: {
          include: {
            products: true,
          },
        },
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    // Check if restaurant has at least one category
    if (restaurant.categories.length === 0) {
      throw new BadRequestException('Restaurant must have at least one category to be published');
    }

    // Check if restaurant has at least one product
    const totalProducts = restaurant.categories.reduce((sum, category) => sum + category.products.length, 0);
    if (totalProducts === 0) {
      throw new BadRequestException('Restaurant must have at least one product to be published');
    }

    // Check if restaurant has a logo
    if (!restaurant.logo) {
      throw new BadRequestException('Restaurant must have a logo to be published');
    }
  }

  /**
   * Get monthly revenue trend for the last 12 months
   */
  private async getMonthlyRevenueTrend(restaurantId: string) {
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const stats = await this.prisma.payment.aggregate({
        where: {
          order: {
            restaurantId,
          },
          status: 'COMPLETED',
          createdAt: {
            gte: month,
            lt: nextMonth,
          },
        },
        _sum: {
          netAmount: true,
        },
        _count: {
          id: true,
        },
      });

      months.push({
        month: month.toISOString().slice(0, 7), // YYYY-MM format
        revenue: stats._sum.netAmount || 0,
        orders: stats._count.id || 0,
      });
    }

    return months;
  }

  /**
   * Get top selling products
   */
  private async getTopSellingProducts(restaurantId: string, limit: number = 10) {
    const topProducts = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          restaurantId,
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
      take: limit,
    });

    // Get product details
    const productsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
          },
        });

        return {
          id: item.productId,
          name: product?.name || 'Unknown Product',
          totalSold: item._sum.quantity || 0,
          revenue: item._sum.totalPrice || 0,
        };
      }),
    );

    return productsWithDetails;
  }
}