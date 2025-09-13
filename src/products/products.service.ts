import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ReorderProductsDto,
  ProductVariantDto,
} from './dto/product.dto';
import { Product, User, Role } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new product
   */
  async create(createProductDto: CreateProductDto, currentUser: User): Promise<Product> {
    // Verify user has access to this category's restaurant
    await this.verifyCategoryAccess(createProductDto.categoryId, currentUser);

    try {
      // Validate variants (max 3)
      if (createProductDto.variants && createProductDto.variants.length > 3) {
        throw new BadRequestException('Maximum 3 variants allowed per product');
      }

      // Get the next priority if not specified
      if (createProductDto.priority === undefined || createProductDto.priority === 0) {
        const maxPriority = await this.prisma.product.aggregate({
          where: { categoryId: createProductDto.categoryId },
          _max: { priority: true },
        });
        createProductDto.priority = (maxPriority._max.priority || 0) + 1;
      }

      const product = await this.prisma.product.create({
        data: {
          name: createProductDto.name,
          description: createProductDto.description,
          price: createProductDto.price,
          image: createProductDto.image,
          variants: createProductDto.variants ? JSON.stringify(createProductDto.variants) : null,
          priority: createProductDto.priority,
          isAvailable: createProductDto.isAvailable ?? true,
          isDraft: createProductDto.isDraft ?? true, // Default to draft for autosave
          categoryId: createProductDto.categoryId,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              restaurantId: true,
            },
          },
        },
      });

      this.logger.log(`Product created: ${product.name} in category ${createProductDto.categoryId}`);
      return product;
    } catch (error) {
      this.logger.error('Error creating product', error.stack);
      throw error;
    }
  }

  /**
   * Get all products for a category
   */
  async findAllByCategory(
    categoryId: string,
    currentUser: User,
    includeDrafts: boolean = true,
  ): Promise<Product[]> {
    await this.verifyCategoryAccess(categoryId, currentUser);

    const where: any = { categoryId };
    
    // Filter out drafts if not requested (for public API)
    if (!includeDrafts) {
      where.isDraft = false;
    }

    return this.prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            restaurantId: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
      orderBy: {
        priority: 'asc',
      },
    });
  }

  /**
   * Get all products for a restaurant
   */
  async findAllByRestaurant(
    restaurantId: string,
    currentUser: User,
    includeDrafts: boolean = true,
  ): Promise<Product[]> {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    const where: any = {
      category: {
        restaurantId,
      },
    };
    
    // Filter out drafts if not requested
    if (!includeDrafts) {
      where.isDraft = false;
    }

    return this.prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            restaurantId: true,
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
      orderBy: [
        {
          category: {
            priority: 'asc',
          },
        },
        {
          priority: 'asc',
        },
      ],
    });
  }

  /**
   * Get a single product by ID
   */
  async findOne(id: string, currentUser: User): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            restaurant: {
              select: {
                id: true,
                ownerId: true,
              },
            },
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Verify user has access to this restaurant
    if (currentUser.role === Role.RESTAURANT_OWNER && product.category.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only access products from your own restaurants');
    }

    return product;
  }

  /**
   * Update a product
   */
  async update(id: string, updateProductDto: UpdateProductDto, currentUser: User): Promise<Product> {
    const product = await this.findOne(id, currentUser);

    // Validate variants if provided (max 3)
    if (updateProductDto.variants && updateProductDto.variants.length > 3) {
      throw new BadRequestException('Maximum 3 variants allowed per product');
    }

    try {
      const { categoryId, ...dataToUpdate } = updateProductDto;
      
      // Handle variants JSON conversion
      if (dataToUpdate.variants) {
        (dataToUpdate as any).variants = JSON.stringify(dataToUpdate.variants);
      }
      
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: dataToUpdate as any,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              restaurantId: true,
            },
          },
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      this.logger.log(`Product updated: ${updatedProduct.name}`);
      return updatedProduct;
    } catch (error) {
      this.logger.error('Error updating product', error.stack);
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async remove(id: string, currentUser: User): Promise<void> {
    const product = await this.findOne(id, currentUser);

    // Check if product has order items
    const orderItemCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      throw new BadRequestException('Cannot delete product that has been ordered. Set as unavailable instead.');
    }

    try {
      await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`Product deleted: ${product.name}`);
    } catch (error) {
      this.logger.error('Error deleting product', error.stack);
      throw error;
    }
  }

  /**
   * Reorder products within a category
   */
  async reorder(categoryId: string, reorderDto: ReorderProductsDto, currentUser: User): Promise<Product[]> {
    await this.verifyCategoryAccess(categoryId, currentUser);

    try {
      // Update priorities in transaction
      await this.prisma.$transaction(async (prisma) => {
        for (let i = 0; i < reorderDto.productIds.length; i++) {
          await prisma.product.update({
            where: { id: reorderDto.productIds[i], categoryId },
            data: { priority: i + 1 },
          });
        }
      });

      // Return updated products
      return this.findAllByCategory(categoryId, currentUser);
    } catch (error) {
      this.logger.error('Error reordering products', error.stack);
      throw error;
    }
  }

  /**
   * Duplicate a product
   */
  async duplicate(id: string, currentUser: User): Promise<Product> {
    const originalProduct = await this.findOne(id, currentUser);

    try {
      // Get the next priority
      const maxPriority = await this.prisma.product.aggregate({
        where: { categoryId: originalProduct.categoryId },
        _max: { priority: true },
      });

      const duplicatedProduct = await this.prisma.product.create({
        data: {
          name: `${originalProduct.name} (Copy)`,
          description: originalProduct.description,
          price: originalProduct.price,
          image: originalProduct.image,
          variants: originalProduct.variants || [],
          priority: (maxPriority._max.priority || 0) + 1,
          isAvailable: false, // Set as unavailable by default
          isDraft: true, // Set as draft
          categoryId: originalProduct.categoryId,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              restaurantId: true,
            },
          },
        },
      });

      this.logger.log(`Product duplicated: ${duplicatedProduct.name}`);
      return duplicatedProduct;
    } catch (error) {
      this.logger.error('Error duplicating product', error.stack);
      throw error;
    }
  }

  /**
   * Auto-save product (used for draft functionality)
   */
  async autoSave(id: string, updateData: Partial<CreateProductDto>, currentUser: User): Promise<Product> {
    await this.findOne(id, currentUser);

    // Validate variants if provided
    if (updateData.variants && updateData.variants.length > 3) {
      throw new BadRequestException('Maximum 3 variants allowed per product');
    }

    try {
      const { categoryId, ...dataToSave } = updateData;
      
      // Handle variants JSON conversion
      if (dataToSave.variants) {
        (dataToSave as any).variants = JSON.stringify(dataToSave.variants);
      }
      
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: {
          ...dataToSave,
          isDraft: true, // Ensure it stays as draft
        } as any,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              restaurantId: true,
            },
          },
        },
      });

      this.logger.debug(`Product auto-saved: ${updatedProduct.name}`);
      return updatedProduct;
    } catch (error) {
      this.logger.error('Error auto-saving product', error.stack);
      throw error;
    }
  }

  /**
   * Publish product (remove from draft status)
   */
  async publish(id: string, currentUser: User): Promise<Product> {
    const product = await this.findOne(id, currentUser);

    // Validate required fields for publishing
    if (!product.name || !product.price || product.price <= 0) {
      throw new BadRequestException('Product must have a name and valid price to be published');
    }

    try {
      const publishedProduct = await this.prisma.product.update({
        where: { id },
        data: {
          isDraft: false,
          isAvailable: true, // Make available when published
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              restaurantId: true,
            },
          },
        },
      });

      this.logger.log(`Product published: ${publishedProduct.name}`);
      return publishedProduct;
    } catch (error) {
      this.logger.error('Error publishing product', error.stack);
      throw error;
    }
  }

  /**
   * Get product statistics
   */
  async getStatistics(restaurantId: string, currentUser: User) {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    const [totalProducts, publishedProducts, draftProducts, outOfStockProducts, popularProducts] = await Promise.all([
      // Total products count
      this.prisma.product.count({
        where: {
          category: {
            restaurantId,
          },
        },
      }),

      // Published products count
      this.prisma.product.count({
        where: {
          category: {
            restaurantId,
          },
          isDraft: false,
        },
      }),

      // Draft products count
      this.prisma.product.count({
        where: {
          category: {
            restaurantId,
          },
          isDraft: true,
        },
      }),

      // Out of stock products count
      this.prisma.product.count({
        where: {
          category: {
            restaurantId,
          },
          isAvailable: false,
          isDraft: false,
        },
      }),

      // Most popular products (by order count)
      this.prisma.product.findMany({
        where: {
          category: {
            restaurantId,
          },
          isDraft: false,
        },
        include: {
          _count: {
            select: {
              orderItems: true,
            },
          },
          category: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          orderItems: {
            _count: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      totalProducts,
      publishedProducts,
      draftProducts,
      outOfStockProducts,
      publishRate: totalProducts > 0 ? (publishedProducts / totalProducts) * 100 : 0,
      popularProducts: popularProducts.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category.name,
        price: product.price,
        orderCount: product._count.orderItems,
      })),
    };
  }

  /**
   * Verify user has access to the category's restaurant
   */
  private async verifyCategoryAccess(categoryId: string, currentUser: User): Promise<void> {
    if (currentUser.role === Role.SUPERADMIN) return;

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    if (currentUser.role === Role.RESTAURANT_OWNER && category.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only manage products in your own restaurants');
    }
  }

  /**
   * Verify user has access to the restaurant
   */
  private async verifyRestaurantAccess(restaurantId: string, currentUser: User): Promise<void> {
    if (currentUser.role === Role.SUPERADMIN) return;

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found`);
    }

    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only access your own restaurants');
    }
  }
}