import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
} from './dto/category.dto';
import { Category, User, Role } from '@prisma/client';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new category
   */
  async create(restaurantId: string, createCategoryDto: CreateCategoryDto, currentUser: User): Promise<Category> {
    // Verify user has access to this restaurant
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    try {
      // Get the next priority if not specified
      if (createCategoryDto.priority === undefined || createCategoryDto.priority === 0) {
        const maxPriority = await this.prisma.category.aggregate({
          where: { restaurantId },
          _max: { priority: true },
        });
        createCategoryDto.priority = (maxPriority._max.priority || 0) + 1;
      }

      const category = await this.prisma.category.create({
        data: {
          name: createCategoryDto.name,
          description: createCategoryDto.description,
          priority: createCategoryDto.priority,
          isActive: createCategoryDto.isActive ?? true,
          isDraft: createCategoryDto.isDraft ?? true, // Default to draft for autosave
          restaurantId,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      this.logger.log(`Category created: ${category.name} for restaurant ${restaurantId}`);
      return category;
    } catch (error) {
      this.logger.error('Error creating category', error.stack);
      throw error;
    }
  }

  /**
   * Get all categories for a restaurant
   */
  async findAllByRestaurant(
    restaurantId: string,
    currentUser: User,
    includeDrafts: boolean = true,
  ): Promise<Category[]> {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    const where: any = { restaurantId };
    
    // Filter out drafts if not requested (for public API)
    if (!includeDrafts) {
      where.isDraft = false;
    }

    return this.prisma.category.findMany({
      where,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            isAvailable: true,
            isDraft: true,
          },
          orderBy: {
            priority: 'asc',
          },
        },
      },
      orderBy: {
        priority: 'asc',
      },
    });
  }

  /**
   * Get a single category by ID
   */
  async findOne(id: string, currentUser: User): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            ownerId: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
        products: {
          include: {
            _count: {
              select: {
                orderItems: true,
              },
            },
          },
          orderBy: {
            priority: 'asc',
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Verify user has access to this restaurant
    if (currentUser.role === Role.RESTAURANT_OWNER && category.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only access categories from your own restaurants');
    }

    return category;
  }

  /**
   * Update a category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto, currentUser: User): Promise<Category> {
    const category = await this.findOne(id, currentUser);

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: updateCategoryDto,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      this.logger.log(`Category updated: ${updatedCategory.name}`);
      return updatedCategory;
    } catch (error) {
      this.logger.error('Error updating category', error.stack);
      throw error;
    }
  }

  /**
   * Delete a category
   */
  async remove(id: string, currentUser: User): Promise<void> {
    const category = await this.findOne(id, currentUser);

    // Check if category has products
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new BadRequestException('Cannot delete category that contains products. Move or delete products first.');
    }

    try {
      await this.prisma.category.delete({
        where: { id },
      });

      this.logger.log(`Category deleted: ${category.name}`);
    } catch (error) {
      this.logger.error('Error deleting category', error.stack);
      throw error;
    }
  }

  /**
   * Reorder categories
   */
  async reorder(restaurantId: string, reorderDto: ReorderCategoriesDto, currentUser: User): Promise<Category[]> {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    // Verify all category IDs belong to this restaurant
    const categories = await this.prisma.category.findMany({
      where: {
        id: { in: reorderDto.categoryIds },
        restaurantId,
      },
    });

    if (categories.length !== reorderDto.categoryIds.length) {
      throw new BadRequestException('Some category IDs are invalid or do not belong to this restaurant');
    }

    try {
      // Update priorities in a transaction
      await this.prisma.$transaction(
        reorderDto.categoryIds.map((categoryId, index) =>
          this.prisma.category.update({
            where: { id: categoryId },
            data: { priority: index + 1 },
          })
        )
      );

      this.logger.log(`Categories reordered for restaurant ${restaurantId}`);

      // Return updated categories
      return this.findAllByRestaurant(restaurantId, currentUser);
    } catch (error) {
      this.logger.error('Error reordering categories', error.stack);
      throw error;
    }
  }

  /**
   * Publish/unpublish category (toggle draft status)
   */
  async togglePublish(id: string, isPublished: boolean, currentUser: User): Promise<Category> {
    const category = await this.findOne(id, currentUser);

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: { isDraft: !isPublished },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      this.logger.log(`Category ${isPublished ? 'published' : 'unpublished'}: ${updatedCategory.name}`);
      return updatedCategory;
    } catch (error) {
      this.logger.error('Error toggling category publish status', error.stack);
      throw error;
    }
  }

  /**
   * Duplicate a category with all its products
   */
  async duplicate(id: string, currentUser: User): Promise<Category> {
    const originalCategory = await this.findOne(id, currentUser);

    try {
      // Create new category
      const duplicatedCategory = await this.prisma.category.create({
        data: {
          name: `${originalCategory.name} (Copy)`,
          description: originalCategory.description,
          priority: originalCategory.priority + 1,
          isActive: originalCategory.isActive,
          isDraft: true, // Always create as draft
          restaurantId: originalCategory.restaurantId,
        },
      });

      // Duplicate all products in this category
      const products = await this.prisma.product.findMany({
        where: { categoryId: id },
      });

      if (products.length > 0) {
        await this.prisma.product.createMany({
          data: products.map((product, index) => ({
            name: product.name,
            description: product.description,
            image: product.image,
            price: product.price,
            weight: product.weight,
            volume: product.volume,
            variants: product.variants,
            isAvailable: product.isAvailable,
            priority: index + 1,
            isDraft: true,
            categoryId: duplicatedCategory.id,
          })),
        });
      }

      this.logger.log(`Category duplicated: ${originalCategory.name} -> ${duplicatedCategory.name}`);

      return this.prisma.category.findUnique({
        where: { id: duplicatedCategory.id },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error('Error duplicating category', error.stack);
      throw error;
    }
  }

  /**
   * Get published categories for public API (used by mini-app)
   */
  async getPublishedCategories(restaurantId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: {
        restaurantId,
        isDraft: false,
        isActive: true,
      },
      include: {
        products: {
          where: {
            isDraft: false,
            isAvailable: true,
          },
          orderBy: {
            priority: 'asc',
          },
        },
      },
      orderBy: {
        priority: 'asc',
      },
    });
  }

  /**
   * Auto-save category (used for draft functionality)
   */
  async autoSave(id: string, updateData: Partial<CreateCategoryDto>, currentUser: User): Promise<Category> {
    const category = await this.findOne(id, currentUser);

    try {
      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: {
          ...updateData,
          isDraft: true, // Always keep as draft for autosave
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      // Don't log autosave operations to reduce noise
      return updatedCategory;
    } catch (error) {
      this.logger.error('Error auto-saving category', error.stack);
      throw error;
    }
  }

  /**
   * Verify user has access to the restaurant
   */
  private async verifyRestaurantAccess(restaurantId: string, currentUser: User): Promise<void> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, ownerId: true },
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found`);
    }

    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only manage categories for your own restaurants');
    }
  }
}