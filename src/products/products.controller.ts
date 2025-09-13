import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ReorderProductsDto,
  ProductResponseDto,
  ProductStatisticsDto,
} from './dto/product.dto';
import { Role, User } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product created successfully',
    type: ProductResponseDto,
  })
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.productsService.create(createProductDto, currentUser);
  }

  @Post('upload-image')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (req, file, cb) => {
          const uniqueSuffix = uuidv4();
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload product image' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        path: { type: 'string' },
        size: { type: 'number' },
      },
    },
  })
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    return {
      filename: file.filename,
      path: `/uploads/products/${file.filename}`,
      size: file.size,
    };
  }

  @Get('category/:categoryId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get all products in a category' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiQuery({
    name: 'includeDrafts',
    required: false,
    type: 'boolean',
    description: 'Include draft products (owner/admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
    type: [ProductResponseDto],
  })
  async findAllByCategory(
    @Param('categoryId') categoryId: string,
    @CurrentUser() currentUser: User,
    @Query('includeDrafts') includeDrafts?: string,
  ) {
    const shouldIncludeDrafts = includeDrafts === 'true' && 
      (currentUser.role === Role.SUPERADMIN || currentUser.role === Role.RESTAURANT_OWNER);

    return this.productsService.findAllByCategory(categoryId, currentUser, shouldIncludeDrafts);
  }

  @Get('restaurant/:restaurantId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get all products in a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiQuery({
    name: 'includeDrafts',
    required: false,
    type: 'boolean',
    description: 'Include draft products (owner/admin only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products retrieved successfully',
    type: [ProductResponseDto],
  })
  async findAllByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
    @Query('includeDrafts') includeDrafts?: string,
  ) {
    const shouldIncludeDrafts = includeDrafts === 'true' && 
      (currentUser.role === Role.SUPERADMIN || currentUser.role === Role.RESTAURANT_OWNER);

    return this.productsService.findAllByRestaurant(restaurantId, currentUser, shouldIncludeDrafts);
  }

  @Get('restaurant/:restaurantId/statistics')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get product statistics for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product statistics retrieved successfully',
    type: ProductStatisticsDto,
  })
  async getStatistics(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.productsService.getStatistics(restaurantId, currentUser);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product retrieved successfully',
    type: ProductResponseDto,
  })
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: User) {
    return this.productsService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product updated successfully',
    type: ProductResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.productsService.update(id, updateProductDto, currentUser);
  }

  @Patch(':id/autosave')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Auto-save product changes (draft mode)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product auto-saved successfully',
    type: ProductResponseDto,
  })
  async autoSave(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateProductDto>,
    @CurrentUser() currentUser: User,
  ) {
    return this.productsService.autoSave(id, updateData, currentUser);
  }

  @Patch(':id/publish')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Publish a product (remove from draft)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product published successfully',
    type: ProductResponseDto,
  })
  async publish(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.productsService.publish(id, currentUser);
  }

  @Post(':id/duplicate')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Duplicate a product' })
  @ApiParam({ name: 'id', description: 'Product ID to duplicate' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Product duplicated successfully',
    type: ProductResponseDto,
  })
  async duplicate(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.productsService.duplicate(id, currentUser);
  }

  @Patch('category/:categoryId/reorder')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Reorder products within a category' })
  @ApiParam({ name: 'categoryId', description: 'Category ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Products reordered successfully',
    type: [ProductResponseDto],
  })
  async reorder(
    @Param('categoryId') categoryId: string,
    @Body() reorderDto: ReorderProductsDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.productsService.reorder(categoryId, reorderDto, currentUser);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Product deleted successfully',
  })
  async remove(@Param('id') id: string, @CurrentUser() currentUser: User) {
    await this.productsService.remove(id, currentUser);
  }
}