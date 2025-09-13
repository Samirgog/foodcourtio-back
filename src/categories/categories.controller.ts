import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseBoolPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
  ReorderCategoriesDto,
  PublishCategoryDto,
} from './dto/category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Categories')
@Controller('restaurants/:restaurantId/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Create a new category',
    description: 'Create a new menu category for a restaurant.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only manage your own restaurants',
  })
  async create(
    @Param('restaurantId') restaurantId: string,
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(restaurantId, createCategoryDto, currentUser);
  }

  @Get()
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get all categories for a restaurant',
    description: 'Get all categories including products. Can optionally exclude drafts.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiQuery({ name: 'includeDrafts', required: false, description: 'Include draft categories (default: true)' })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    type: [CategoryResponseDto],
  })
  async findAll(
    @Param('restaurantId') restaurantId: string,
    @Query('includeDrafts', new ParseBoolPipe({ optional: true })) includeDrafts: boolean = true,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAllByRestaurant(restaurantId, currentUser, includeDrafts);
  }

  @Public()
  @Get('published')
  @ApiOperation({
    summary: 'Get published categories (Public)',
    description: 'Get all published categories with their products. Used by mini-app.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Published categories retrieved successfully',
    type: [CategoryResponseDto],
  })
  async getPublishedCategories(@Param('restaurantId') restaurantId: string): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getPublishedCategories(restaurantId);
  }

  @Get(':id')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get a category by ID',
    description: 'Get detailed category information including all products.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category retrieved successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  async findOne(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Update a category',
    description: 'Update category information. Changes are saved as draft by default.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    type: CategoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  async update(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, updateCategoryDto, currentUser);
  }

  @Delete(':id')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Delete a category',
    description: 'Delete a category. Cannot delete if it contains products.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete category that contains products',
  })
  async remove(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ): Promise<{ message: string }> {
    await this.categoriesService.remove(id, currentUser);
    return { message: 'Category deleted successfully' };
  }

  @Patch('reorder')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Reorder categories',
    description: 'Change the display order of categories.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Categories reordered successfully',
    type: [CategoryResponseDto],
  })
  async reorder(
    @Param('restaurantId') restaurantId: string,
    @Body() reorderDto: ReorderCategoriesDto,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto[]> {
    return this.categoriesService.reorder(restaurantId, reorderDto, currentUser);
  }

  @Patch(':id/publish')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Publish or unpublish a category',
    description: 'Toggle the published status of a category (draft vs published).',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category publish status updated successfully',
    type: CategoryResponseDto,
  })
  async togglePublish(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() publishDto: PublishCategoryDto,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.togglePublish(id, publishDto.isPublished, currentUser);
  }

  @Post(':id/duplicate')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Duplicate a category',
    description: 'Create a copy of a category with all its products.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 201,
    description: 'Category duplicated successfully',
    type: CategoryResponseDto,
  })
  async duplicate(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.duplicate(id, currentUser);
  }

  @Patch(':id/autosave')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Auto-save category changes',
    description: 'Save category changes as draft without publishing.',
  })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category auto-saved successfully',
    type: CategoryResponseDto,
  })
  async autoSave(
    @Param('restaurantId') restaurantId: string,
    @Param('id') id: string,
    @Body() updateData: UpdateCategoryDto,
    @CurrentUser() currentUser: User,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.autoSave(id, updateData, currentUser);
  }
}